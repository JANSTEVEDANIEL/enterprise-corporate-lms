import { getDb, initDb } from "@/lib/db";
import { evaluateQuiz } from "@/lib/quiz";
import { generateCertificate, computeCertificateHash } from "@/lib/certificates";
import { recordAuditEvent, verifyAuditLogIntegrity } from "@/lib/audit";
import { randomUUID } from "node:crypto";
import {
  SIMULATION_PERSONAS,
  type PersonaSimulationResult,
  type SimulationOptions,
  type SimulationStepResult,
} from "./personas";

export async function runAlexNewHireSimulation(
  options?: SimulationOptions
): Promise<PersonaSimulationResult> {
  const startTime = Date.now();
  if (!options?.db) {
    initDb();
  }
  const db = options?.db || getDb();
  const persona = SIMULATION_PERSONAS.alex;
  const steps: SimulationStepResult[] = [];
  const log = options?.logger || (options?.logProgress ? console.log : () => {});

  const alexId = persona.id;
  const courseId = persona.targetCourseId;
  const enrollmentId = "enr_alex_day1_sim";

  let certificateCode: string | undefined;
  let certificateHash: string | undefined;
  let certId: string | undefined;

  try {
    // ========================================================================
    // Step 1: Session Assumption & Onboarding Initialization
    // ========================================================================
    const s1Start = Date.now();
    log(`[Alex Rivera] Step 1: Initializing Day-1 onboarding session...`);

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(alexId) as any;
    if (!user) {
      throw new Error(`Persona user '${alexId}' does not exist in database`);
    }
    if (user.role !== "EMPLOYEE") {
      throw new Error(`Expected role EMPLOYEE for Alex Rivera, got '${user.role}'`);
    }

    const course = db.prepare("SELECT * FROM courses WHERE id = ?").get(courseId) as any;
    if (!course) {
      throw new Error(`Mandatory course '${courseId}' not found`);
    }
    if (course.is_mandatory !== 1) {
      throw new Error(`Expected course '${courseId}' to be mandatory`);
    }

    // Clean up prior simulation artifacts for repeatable execution
    const prevEnrollments = db.prepare("SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?").all(alexId, courseId) as any[];
    for (const prev of prevEnrollments) {
      db.prepare("DELETE FROM module_progress WHERE enrollment_id = ?").run(prev.id);
      db.prepare("DELETE FROM quiz_submissions WHERE enrollment_id = ?").run(prev.id);
      db.prepare("DELETE FROM certificates WHERE enrollment_id = ?").run(prev.id);
    }
    db.prepare("DELETE FROM certificates WHERE user_id = ? AND course_id = ?").run(alexId, courseId);
    db.prepare("DELETE FROM enrollments WHERE user_id = ? AND course_id = ?").run(alexId, courseId);
    db.prepare("DELETE FROM enrollments WHERE id = ?").run(enrollmentId);

    const now = new Date().toISOString();
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO enrollments (
        id, user_id, course_id, status, progress_pct, assigned_by, assigned_at, due_date, created_at, updated_at
      ) VALUES (?, ?, ?, 'NOT_STARTED', 0, 'usr_sarah_jenkins', ?, ?, ?, ?)
    `).run(enrollmentId, alexId, courseId, now, dueDate, now, now);

    const enrStep1 = db.prepare("SELECT * FROM enrollments WHERE id = ?").get(enrollmentId) as any;
    if (!enrStep1 || enrStep1.status !== "NOT_STARTED" || enrStep1.progress_pct !== 0) {
      throw new Error(`Failed to initialize enrollment in NOT_STARTED state`);
    }

    steps.push({
      stepNumber: 1,
      name: "Session Assumption & Onboarding Initialization",
      description: "Assumed Alex Rivera session, verified role EMPLOYEE, provisioned Day-1 enrollment roadmap",
      status: "PASSED",
      durationMs: Date.now() - s1Start,
      stateTransition: {
        entity: "Alex Rivera Session",
        from: "Unauthenticated",
        to: "Authenticated (EMPLOYEE)",
        metadata: { courseId, status: "NOT_STARTED", progressPct: 0 },
      },
      details: {
        userId: alexId,
        userName: user.name,
        role: user.role,
        department: user.department,
        enrollmentId,
        courseTitle: course.title,
      },
    });

    // ========================================================================
    // Step 2: Traverse Module 0 (Welcome Markdown & Values)
    // ========================================================================
    const s2Start = Date.now();
    log(`[Alex Rivera] Step 2: Traversal of Module 0 (Welcome Markdown & Values)...`);

    const mod0 = db.prepare("SELECT * FROM modules WHERE id = 'mod_onb_welcome'").get() as any;
    if (!mod0) {
      throw new Error("Module 'mod_onb_welcome' not found in database");
    }
    if (!mod0.content || !mod0.content.includes("Welcome to Enterprise Core")) {
      throw new Error("Module 'mod_onb_welcome' content is missing enterprise orientation text");
    }

    const t2 = new Date().toISOString();
    db.prepare(`
      INSERT INTO module_progress (
        id, enrollment_id, module_id, user_id, status, completed_at, time_spent_seconds, created_at, updated_at
      ) VALUES (?, ?, 'mod_onb_welcome', ?, 'COMPLETED', ?, 900, ?, ?)
    `).run(`mp_alex_mod0_${randomUUID().substring(0, 8)}`, enrollmentId, alexId, t2, t2, t2);

    db.prepare("UPDATE enrollments SET status = 'IN_PROGRESS', progress_pct = 33, updated_at = ? WHERE id = ?").run(
      t2,
      enrollmentId
    );

    recordAuditEvent(
      {
        actorId: alexId,
        actorRole: "EMPLOYEE",
        actorName: persona.name,
        action: "MODULE_COMPLETED",
        targetType: "MODULE",
        targetId: "mod_onb_welcome",
        courseId,
        moduleId: "mod_onb_welcome",
        moduleVersion: mod0.version || "1.0.0",
        details: { timeSpentSeconds: 900, moduleTitle: mod0.title },
      },
      db
    );

    const enrStep2 = db.prepare("SELECT * FROM enrollments WHERE id = ?").get(enrollmentId) as any;
    if (enrStep2.progress_pct !== 33 || enrStep2.status !== "IN_PROGRESS") {
      throw new Error(`Enrollment progress did not update to 33% IN_PROGRESS`);
    }

    steps.push({
      stepNumber: 2,
      name: "Traverse Module 0 (Welcome Markdown & Values)",
      description: "Read enterprise orientation guidelines, code of conduct, and leadership values; progress updated to 33%",
      status: "PASSED",
      durationMs: Date.now() - s2Start,
      stateTransition: {
        entity: "Enrollment (crs_onboarding_day1)",
        from: "NOT_STARTED (0%)",
        to: "IN_PROGRESS (33%)",
        metadata: { completedModule: "mod_onb_welcome" },
      },
      details: {
        moduleId: mod0.id,
        moduleTitle: mod0.title,
        progressPct: enrStep2.progress_pct,
      },
    });

    // ========================================================================
    // Step 3: Traverse Module 1 (Physical Security Video)
    // ========================================================================
    const s3Start = Date.now();
    log(`[Alex Rivera] Step 3: Traversal of Module 1 (Physical Security Video)...`);

    const mod1 = db.prepare("SELECT * FROM modules WHERE id = 'mod_onb_security_video'").get() as any;
    if (!mod1) {
      throw new Error("Module 'mod_onb_security_video' not found");
    }

    const t3 = new Date().toISOString();
    db.prepare(`
      INSERT INTO module_progress (
        id, enrollment_id, module_id, user_id, status, completed_at, time_spent_seconds, last_position_seconds, created_at, updated_at
      ) VALUES (?, ?, 'mod_onb_security_video', ?, 'COMPLETED', ?, 180, 180, ?, ?)
    `).run(`mp_alex_mod1_${randomUUID().substring(0, 8)}`, enrollmentId, alexId, t3, t3, t3);

    db.prepare("UPDATE enrollments SET progress_pct = 67, updated_at = ? WHERE id = ?").run(t3, enrollmentId);

    recordAuditEvent(
      {
        actorId: alexId,
        actorRole: "EMPLOYEE",
        actorName: persona.name,
        action: "MODULE_COMPLETED",
        targetType: "MODULE",
        targetId: "mod_onb_security_video",
        courseId,
        moduleId: "mod_onb_security_video",
        moduleVersion: mod1.version || "1.0.0",
        details: { timeSpentSeconds: 180, lastPositionSeconds: 180 },
      },
      db
    );

    const enrStep3 = db.prepare("SELECT * FROM enrollments WHERE id = ?").get(enrollmentId) as any;
    if (enrStep3.progress_pct !== 67) {
      throw new Error(`Enrollment progress did not update to 67%`);
    }

    steps.push({
      stepNumber: 3,
      name: "Traverse Module 1 (Physical Security Video)",
      description: "Completed building safety & hardware token video lesson; playback synced; progress updated to 67%",
      status: "PASSED",
      durationMs: Date.now() - s3Start,
      stateTransition: {
        entity: "Enrollment (crs_onboarding_day1)",
        from: "IN_PROGRESS (33%)",
        to: "IN_PROGRESS (67%)",
        metadata: { completedModule: "mod_onb_security_video" },
      },
      details: {
        moduleId: mod1.id,
        moduleTitle: mod1.title,
        progressPct: enrStep3.progress_pct,
      },
    });

    // ========================================================================
    // Step 4: Complete Interactive Quiz (100% Score >= 80% Pass Threshold)
    // ========================================================================
    const s4Start = Date.now();
    log(`[Alex Rivera] Step 4: Submitting Day-1 Knowledge Check Quiz...`);

    const alexAnswers = {
      qq_onb_1: "opt_2", // Hardware FIDO2 Security Key
      qq_onb_2: ["opt_1", "opt_3"], // Workstation lock & report unbadged
      qq_onb_3: "opt_f", // False
    };

    const evaluation = evaluateQuiz("q_onb_1", alexAnswers, db);
    if (!evaluation.passed || evaluation.scorePct !== 100) {
      throw new Error(`Quiz evaluation failed. Expected 100% passed, got ${evaluation.scorePct}%`);
    }

    const t4 = new Date().toISOString();
    const submissionId = `qs_alex_day1_${randomUUID().substring(0, 8)}`;
    db.prepare(`
      INSERT INTO quiz_submissions (
        id, enrollment_id, module_id, user_id, score, passed, attempt_number, answers_payload, feedback_payload, submitted_at
      ) VALUES (?, ?, 'mod_onb_quiz', ?, ?, 1, 1, ?, ?, ?)
    `).run(
      submissionId,
      enrollmentId,
      alexId,
      evaluation.scorePct,
      JSON.stringify(alexAnswers),
      JSON.stringify(evaluation),
      t4
    );

    db.prepare(`
      INSERT INTO module_progress (
        id, enrollment_id, module_id, user_id, status, completed_at, time_spent_seconds, created_at, updated_at
      ) VALUES (?, ?, 'mod_onb_quiz', ?, 'COMPLETED', ?, 300, ?, ?)
    `).run(`mp_alex_quiz_${randomUUID().substring(0, 8)}`, enrollmentId, alexId, t4, t4, t4);

    recordAuditEvent(
      {
        actorId: alexId,
        actorRole: "EMPLOYEE",
        actorName: persona.name,
        action: "QUIZ_PASSED",
        targetType: "QUIZ",
        targetId: "q_onb_1",
        courseId,
        moduleId: "mod_onb_quiz",
        moduleVersion: "1.0.0",
        score: evaluation.scorePct,
        details: {
          attemptNumber: 1,
          scorePct: evaluation.scorePct,
          passed: true,
          correctCount: evaluation.correctCount,
          totalCount: evaluation.totalCount,
        },
      },
      db
    );

    const submissionRow = db.prepare("SELECT * FROM quiz_submissions WHERE id = ?").get(submissionId) as any;
    if (!submissionRow || submissionRow.passed !== 1 || submissionRow.score !== 100) {
      throw new Error(`Quiz submission was not persisted with score 100`);
    }

    steps.push({
      stepNumber: 4,
      name: "Complete Interactive Quiz (100% Score >= 80% Pass Threshold)",
      description: "Answered all 3 policy & security questions correctly; server graded 100%; recorded in quiz_submissions and audit log",
      status: "PASSED",
      durationMs: Date.now() - s4Start,
      stateTransition: {
        entity: "Quiz (mod_onb_quiz)",
        from: "UNATTEMPTED",
        to: "PASSED (100%)",
        metadata: { score: 100, passingThreshold: 80 },
      },
      details: {
        quizId: "q_onb_1",
        submissionId,
        scorePct: evaluation.scorePct,
        passed: evaluation.passed,
        correctQuestions: evaluation.correctCount,
        totalQuestions: evaluation.totalCount,
      },
    });

    // ========================================================================
    // Step 5: Assert Terminal State: 100% Course Completion & Certificate
    // ========================================================================
    const s5Start = Date.now();
    log(`[Alex Rivera] Step 5: Issuing certificate and validating terminal state...`);

    const t5 = new Date().toISOString();
    db.prepare(`
      UPDATE enrollments 
      SET status = 'COMPLETED', progress_pct = 100, completed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(t5, t5, enrollmentId);

    const cert = generateCertificate({
      userId: alexId,
      courseId,
      enrollmentId,
      score: 100,
      actorRole: "EMPLOYEE",
      actorName: persona.name,
      customDb: db,
    });

    certId = cert.id;
    certificateCode = cert.certificate_code;
    certificateHash = cert.verification_hash;

    // Terminal Invariants Assertions
    const finalEnr = db.prepare("SELECT * FROM enrollments WHERE id = ?").get(enrollmentId) as any;
    if (finalEnr.status !== "COMPLETED" || finalEnr.progress_pct !== 100 || !finalEnr.completed_at) {
      throw new Error("Terminal assertion failed: Enrollment is not COMPLETED at 100%");
    }

    const certRow = db.prepare("SELECT * FROM certificates WHERE certificate_code = ?").get(certificateCode) as any;
    if (!certRow || certRow.user_id !== alexId || certRow.score !== 100) {
      throw new Error("Terminal assertion failed: Certificate was not properly stored for Alex Rivera");
    }

    const recomputedHash = computeCertificateHash({
      certificateCode: certRow.certificate_code,
      userId: certRow.user_id,
      courseId: certRow.course_id,
      enrollmentId: certRow.enrollment_id,
      issuedAt: certRow.issued_at,
      score: certRow.score,
    });
    if (recomputedHash !== certRow.verification_hash) {
      throw new Error("Terminal assertion failed: Certificate verification hash mismatch");
    }

    const alexAuditLogs = db.prepare("SELECT * FROM audit_logs WHERE actor_id = ?").all(alexId) as any[];
    if (alexAuditLogs.length < 4) {
      throw new Error(`Terminal assertion failed: Expected at least 4 audit logs for Alex, found ${alexAuditLogs.length}`);
    }

    const auditIntegrity = verifyAuditLogIntegrity(db);
    if (!auditIntegrity.isValid) {
      throw new Error("Terminal assertion failed: Audit log hash chain is invalid");
    }

    steps.push({
      stepNumber: 5,
      name: "Assert Terminal State: 100% Course Completion, Certificate Issued & Audit Chain Verified",
      description: `Course marked COMPLETED (100%); Certificate ${certificateCode} generated with SHA-256 hash ${certificateHash.substring(0, 16)}...; Audit trail validated`,
      status: "PASSED",
      durationMs: Date.now() - s5Start,
      stateTransition: {
        entity: "Enrollment (crs_onboarding_day1)",
        from: "IN_PROGRESS (67%)",
        to: "COMPLETED (100%)",
        metadata: {
          certificateCode,
          certificateHash,
          auditChainValid: true,
        },
      },
      details: {
        enrollmentId,
        certificateCode,
        certificateHash,
        auditLogsRecorded: alexAuditLogs.length,
        hashChainValid: auditIntegrity.isValid,
      },
    });

    log(`[Alex Rivera] ✅ Day-1 Orientation Simulation Completed Successfully in ${Date.now() - startTime}ms`);

    return {
      personaKey: "alex",
      personaId: alexId,
      personaName: persona.name,
      role: persona.role,
      targetCourseId: courseId,
      targetCourseTitle: persona.targetCourseTitle,
      status: "PASSED",
      totalDurationMs: Date.now() - startTime,
      steps,
      artifacts: {
        certificateId: certId,
        certificateCode,
        certificateHash,
        quizScore: 100,
        quizPassed: true,
        auditLogsGenerated: alexAuditLogs.length,
        auditRootHash: auditIntegrity.actualHash,
      },
    };
  } catch (err: any) {
    const failedDuration = Date.now() - startTime;
    log(`[Alex Rivera] ❌ Simulation failed: ${err.message}`);
    return {
      personaKey: "alex",
      personaId: alexId,
      personaName: persona.name,
      role: persona.role,
      targetCourseId: courseId,
      targetCourseTitle: persona.targetCourseTitle,
      status: "FAILED",
      totalDurationMs: failedDuration,
      steps,
      error: err.message,
    };
  }
}
