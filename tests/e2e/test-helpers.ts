import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { SCHEMA_SQL } from "../../src/lib/db/schema";
import { CORPORATE_PERSONAS } from "../../src/lib/auth";
import type { AuditLogRecord, Role, ComplianceRenewalStatus } from "../../src/types";

export const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

export interface TestDatabaseContext {
  db: DatabaseSync;
  dbPath: string;
  cleanup: () => void;
}

export function createIsolatedTestDb(prefix: string = "test"): TestDatabaseContext {
  const dataDir = path.join(process.cwd(), ".data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const randSuffix = Math.random().toString(36).substring(2, 9);
  const dbPath = path.join(dataDir, `${prefix}_${Date.now()}_${randSuffix}.db`);

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA synchronous = NORMAL;");

  // Run schema
  db.exec(SCHEMA_SQL);

  const cleanup = () => {
    try {
      db.close();
    } catch {
      // ignore
    }
    for (const ext of ["", "-wal", "-shm"]) {
      const p = `${dbPath}${ext}`;
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch {
          // ignore
        }
      }
    }
  };

  return { db, dbPath, cleanup };
}

export function canonicalStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalStringify).join(",") + "]";
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalStringify((obj as Record<string, unknown>)[k])}`
  );
  return "{" + entries.join(",") + "}";
}

export function computeRecordHash(payload: {
  uuid: string;
  prevHash: string;
  timestamp: string;
  actorId: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  courseId?: string | null;
  moduleId?: string | null;
  moduleVersion?: string | null;
  score?: number | null;
  metadata?: string | null;
}): string {
  const canonicalData = canonicalStringify({
    uuid: payload.uuid,
    prev_hash: payload.prevHash,
    timestamp: payload.timestamp,
    actor_id: payload.actorId,
    actor_role: payload.actorRole,
    action: payload.action,
    target_type: payload.targetType,
    target_id: payload.targetId,
    course_id: payload.courseId ?? null,
    module_id: payload.moduleId ?? null,
    module_version: payload.moduleVersion ?? null,
    score: payload.score ?? null,
    metadata: payload.metadata ?? null,
  });

  return createHash("sha256").update(canonicalData).digest("hex");
}

export function recordTestAuditEvent(
  db: DatabaseSync,
  event: {
    actorId: string;
    actorRole: Role;
    actorName?: string;
    action: string;
    targetType: string;
    targetId: string;
    courseId?: string | null;
    moduleId?: string | null;
    moduleVersion?: string | null;
    score?: number | null;
    details?: Record<string, unknown> | null;
  }
): AuditLogRecord {
  const lastRecordStmt = db.prepare("SELECT record_hash FROM audit_logs ORDER BY id DESC LIMIT 1");
  const lastRecord = lastRecordStmt.get() as { record_hash: string } | undefined;
  const prevHash = lastRecord ? lastRecord.record_hash : GENESIS_HASH;

  const uuid = randomUUID();
  const timestamp = new Date().toISOString();
  const metadata = JSON.stringify(event.details || {});
  const actorName = event.actorName || event.actorId;

  const recordHash = computeRecordHash({
    uuid,
    prevHash,
    timestamp,
    actorId: event.actorId,
    actorRole: event.actorRole,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    courseId: event.courseId,
    moduleId: event.moduleId,
    moduleVersion: event.moduleVersion,
    score: event.score,
    metadata,
  });

  const insertStmt = db.prepare(`
    INSERT INTO audit_logs (
      uuid, timestamp, actor_id, actor_role, actor_name, action,
      target_type, target_id, course_id, module_id, module_version,
      score, metadata, prev_hash, record_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = insertStmt.run(
    uuid,
    timestamp,
    event.actorId,
    event.actorRole,
    actorName,
    event.action,
    event.targetType,
    event.targetId,
    event.courseId || null,
    event.moduleId || null,
    event.moduleVersion || null,
    event.score ?? null,
    metadata,
    prevHash,
    recordHash
  );

  return {
    id: Number(result.lastInsertRowid),
    uuid,
    timestamp,
    actor_id: event.actorId,
    actor_role: event.actorRole,
    actor_name: actorName,
    action: event.action,
    target_type: event.targetType,
    target_id: event.targetId,
    course_id: event.courseId || null,
    module_id: event.moduleId || null,
    module_version: event.moduleVersion || null,
    score: event.score ?? null,
    metadata,
    prev_hash: prevHash,
    record_hash: recordHash,
  };
}

export function seedTestDb(db: DatabaseSync): void {
  const now = new Date().toISOString();

  // 1. Users
  const insertUser = db.prepare(`
    INSERT OR REPLACE INTO users (
      id, email, name, avatar_url, role, department, job_title, manager_id, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  for (const p of Object.values(CORPORATE_PERSONAS)) {
    insertUser.run(p.id, p.email, p.name, p.avatarUrl || null, p.role, p.department, p.jobTitle, p.managerId || null, now, now);
  }

  // 2. Courses
  const insertCourse = db.prepare(`
    INSERT OR REPLACE INTO courses (
      id, slug, title, description, category, target_role, is_mandatory,
      estimated_minutes, renewal_period_days, passing_score_pct, version,
      is_published, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertCourse.run(
    "crs_onboarding_day1",
    "day-1-enterprise-orientation",
    "Day-1 Enterprise Orientation & Engineering Setup",
    "Mandatory onboarding track for all new corporate hires.",
    "ONBOARDING",
    "NEW_HIRE",
    1,
    45,
    null,
    80,
    "1.0.0",
    1,
    now,
    now
  );

  insertCourse.run(
    "crs_sec_soc2_2026",
    "soc2-information-security-data-privacy-2026",
    "SOC 2 Information Security & Data Privacy 2026",
    "Annual mandatory compliance training required for SOC 2 Type II audit readiness.",
    "COMPLIANCE",
    "ALL",
    1,
    60,
    365,
    80,
    "2026.1.0",
    1,
    now,
    now
  );

  insertCourse.run(
    "crs_tech_prod_safety",
    "production-infrastructure-safety-standards",
    "Production Infrastructure Safety & Operational Resilience",
    "Advanced technical compliance course for engineering staff.",
    "TECHNICAL_UPSKILLING",
    "ENGINEERING",
    1,
    50,
    365,
    85,
    "2.1.0",
    1,
    now,
    now
  );

  // 3. Modules for crs_onboarding_day1
  const insertModule = db.prepare(`
    INSERT OR REPLACE INTO modules (
      id, course_id, title, description, order_index, type, content,
      estimated_minutes, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertModule.run(
    "mod_onb_welcome",
    "crs_onboarding_day1",
    "Welcome to Enterprise Core & Cultural Values",
    "Introduction to enterprise mission and values.",
    0,
    "RICH_MARKDOWN",
    "# Welcome to Enterprise Core\n\nCulture, security, and integrity values.",
    15,
    "1.0.0",
    now,
    now
  );

  insertModule.run(
    "mod_onb_security_video",
    "crs_onboarding_day1",
    "Workplace Physical & Digital Security Overview",
    "Video walkthrough detailing badge security.",
    1,
    "VIDEO_EMBED",
    JSON.stringify({ videoUrl: "https://example.com/video.mp4", durationSeconds: 180 }),
    15,
    "1.0.0",
    now,
    now
  );

  insertModule.run(
    "mod_onb_quiz",
    "crs_onboarding_day1",
    "Day-1 Orientation Knowledge Check",
    "Validate your comprehension.",
    2,
    "INTERACTIVE_QUIZ",
    "Passing threshold is 80%.",
    15,
    "1.0.0",
    now,
    now
  );

  // 4. Quiz & Questions
  const insertQuiz = db.prepare(`
    INSERT OR REPLACE INTO quizzes (id, module_id, title, passing_score_pct, time_limit_minutes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertQuiz.run("q_onb_1", "mod_onb_quiz", "Day-1 Orientation Knowledge Check", 80, 15, now, now);

  const insertQuestion = db.prepare(`
    INSERT OR REPLACE INTO quiz_questions (
      id, quiz_id, order_index, prompt, question_type, options, correct_answers, explanation, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertQuestion.run(
    "qq_onb_1",
    "q_onb_1",
    0,
    "What is the mandatory authentication requirement for corporate laptops?",
    "SINGLE_CHOICE",
    JSON.stringify([
      { id: "opt_1", text: "SMS text message code" },
      { id: "opt_2", text: "Hardware FIDO2 Security Key with 2FA" },
      { id: "opt_3", text: "Simple password" },
    ]),
    JSON.stringify(["opt_2"]),
    "Hardware FIDO2 keys are phishing-resistant and mandatory.",
    now
  );

  insertQuestion.run(
    "qq_onb_2",
    "q_onb_1",
    1,
    "Which actions comply with Device Security Policy? (Select all)",
    "MULTIPLE_CHOICE",
    JSON.stringify([
      { id: "opt_1", text: "Lock workstation when stepping away" },
      { id: "opt_2", text: "Write credentials on sticky notes" },
      { id: "opt_3", text: "Report unbadged visitors" },
    ]),
    JSON.stringify(["opt_1", "opt_3"]),
    "Lock workstations and report unbadged visitors.",
    now
  );

  insertQuestion.run(
    "qq_onb_3",
    "q_onb_1",
    2,
    "True or False: You may share your corporate VPN credentials with contractors.",
    "TRUE_FALSE",
    JSON.stringify([
      { id: "opt_t", text: "True" },
      { id: "opt_f", text: "False" },
    ]),
    JSON.stringify(["opt_f"]),
    "Credential sharing is strictly prohibited under SOC 2.",
    now
  );

  // Initial audit logs
  recordTestAuditEvent(db, {
    actorId: "usr_david_kim",
    actorRole: "SUPER_ADMIN",
    actorName: "David Kim",
    action: "SYSTEM_INITIALIZED",
    targetType: "SYSTEM",
    targetId: "lms_core_v1",
    details: { message: "Test environment initialized" },
  });

  recordTestAuditEvent(db, {
    actorId: "usr_sarah_jenkins",
    actorRole: "MANAGER",
    actorName: "Sarah Jenkins",
    action: "COURSE_ASSIGNED",
    targetType: "ENROLLMENT",
    targetId: "enr_alex_onb",
    courseId: "crs_onboarding_day1",
    details: { assignedTo: "usr_alex_rivera", courseTitle: "Day-1 Enterprise Orientation & Engineering Setup" },
  });

  recordTestAuditEvent(db, {
    actorId: "usr_elena_rostova",
    actorRole: "EMPLOYEE",
    actorName: "Elena Rostova",
    action: "COMPLIANCE_CERTIFIED",
    targetType: "CERTIFICATE",
    targetId: "cert_elena_sec_2026",
    courseId: "crs_sec_soc2_2026",
    score: 100,
    details: { certificateCode: "CERT-2026-SEC-89214", validityDays: 365 },
  });
}

export interface QuestionFeedback {
  questionId: string;
  prompt: string;
  userAnswer: string | string[];
  correctAnswer: string[];
  isCorrect: boolean;
  explanation: string;
}

export interface QuizEvaluationResult {
  scorePct: number;
  passed: boolean;
  correctCount: number;
  totalCount: number;
  passingScorePct: number;
  results: QuestionFeedback[];
}

export function evaluateQuizAgainstDb(
  db: DatabaseSync,
  quizId: string,
  answers: Record<string, string | string[]>
): QuizEvaluationResult {
  const quizStmt = db.prepare("SELECT * FROM quizzes WHERE id = ?");
  const quiz = quizStmt.get(quizId) as any;
  if (!quiz) {
    throw new Error(`Quiz ${quizId} not found`);
  }

  const questionsStmt = db.prepare("SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY order_index ASC");
  const questions = questionsStmt.all(quizId) as any[];

  if (questions.length === 0) {
    throw new Error(`Quiz ${quizId} has no questions configured`);
  }

  let correctCount = 0;
  const feedbackList: QuestionFeedback[] = [];

  for (const q of questions) {
    const correctAnswers: string[] = JSON.parse(q.correct_answers);
    const userAnswer = answers[q.id];

    let isCorrect = false;
    if (userAnswer !== undefined && userAnswer !== null) {
      if (Array.isArray(userAnswer)) {
        const sortedUser = [...userAnswer].sort();
        const sortedCorrect = [...correctAnswers].sort();
        isCorrect =
          sortedUser.length === sortedCorrect.length &&
          sortedUser.every((val, idx) => val === sortedCorrect[idx]);
      } else {
        isCorrect = correctAnswers.length === 1 && correctAnswers[0] === userAnswer;
      }
    }

    if (isCorrect) {
      correctCount++;
    }

    feedbackList.push({
      questionId: q.id,
      prompt: q.prompt,
      userAnswer: userAnswer ?? "",
      correctAnswer: correctAnswers,
      isCorrect,
      explanation: q.explanation,
    });
  }

  const scorePct = Math.round((correctCount / questions.length) * 100);
  const passed = scorePct >= quiz.passing_score_pct;

  return {
    scorePct,
    passed,
    correctCount,
    totalCount: questions.length,
    passingScorePct: quiz.passing_score_pct,
    results: feedbackList,
  };
}

export function computeComplianceStatus(
  completedAt: string | null,
  renewalPeriodDays: number | null,
  referenceDate: Date = new Date()
): ComplianceRenewalStatus {
  if (!completedAt) {
    return "NOT_STARTED";
  }

  if (renewalPeriodDays === null || renewalPeriodDays <= 0) {
    return "VALID";
  }

  const completedTime = new Date(completedAt).getTime();
  const refTime = referenceDate.getTime();
  const diffDays = Math.floor((refTime - completedTime) / (1000 * 60 * 60 * 24));
  const daysRemaining = renewalPeriodDays - diffDays;

  if (daysRemaining < 0) {
    return "EXPIRED";
  }
  if (daysRemaining <= 30) {
    return "EXPIRING_SOON";
  }
  return "VALID";
}

export function generateAuditCsv(records: AuditLogRecord[]): string {
  const headers = [
    "AuditID",
    "Timestamp",
    "UserID",
    "EmployeeName",
    "Action",
    "CourseID",
    "TargetID",
    "ModuleVersion",
    "Score",
    "RecordHash",
  ];

  const escapeField = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = records.map((r) => [
    escapeField(r.id),
    escapeField(r.timestamp),
    escapeField(r.actor_id),
    escapeField(r.actor_name),
    escapeField(r.action),
    escapeField(
      r.course_id
        ? r.target_id && r.target_id.startsWith("CERT-")
          ? `${r.course_id} [${r.target_id}]`
          : r.course_id
        : r.target_id || ""
    ),
    escapeField(r.module_version || ""),
    escapeField(r.score !== null && r.score !== undefined ? r.score : ""),
    escapeField(r.record_hash),
  ]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
}

export function generateAuditJson(records: AuditLogRecord[]): string {
  const rootHash = records.length > 0 ? records[records.length - 1].record_hash : GENESIS_HASH;
  const manifest = {
    exportedAt: new Date().toISOString(),
    totalRecords: records.length,
    genesisHash: GENESIS_HASH,
    rootHash,
    isChainValid: true,
    records,
  };
  return JSON.stringify(manifest, null, 2);
}

export function verifyAuditChainInMemory(records: AuditLogRecord[]): {
  isValid: boolean;
  tamperedIndex?: number;
  failureReason?: string;
} {
  if (records.length === 0) return { isValid: true };

  let expectedPrev = GENESIS_HASH;
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (r.prev_hash !== expectedPrev) {
      return {
        isValid: false,
        tamperedIndex: i,
        failureReason: `Broken chain at index ${i}: prev_hash does not match expected previous record_hash`,
      };
    }

    const recomputed = computeRecordHash({
      uuid: r.uuid,
      prevHash: r.prev_hash,
      timestamp: r.timestamp,
      actorId: r.actor_id,
      actorRole: r.actor_role,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      courseId: r.course_id,
      moduleId: r.module_id,
      moduleVersion: r.module_version,
      score: r.score,
      metadata: r.metadata,
    });

    if (recomputed !== r.record_hash) {
      return {
        isValid: false,
        tamperedIndex: i,
        failureReason: `Hash mismatch at index ${i}: stored record_hash does not match recomputed SHA-256`,
      };
    }

    expectedPrev = r.record_hash;
  }

  return { isValid: true };
}
