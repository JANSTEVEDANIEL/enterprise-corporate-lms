import { getDb, initDb } from "@/lib/db";
import { evaluateQuiz } from "@/lib/quiz";
import { generateCertificate } from "@/lib/certificates";
import { recordAuditEvent, verifyAuditLogIntegrity } from "@/lib/audit";
import { computeComplianceStatus } from "@/lib/compliance";
import { randomUUID } from "node:crypto";
import {
  SIMULATION_PERSONAS,
  type PersonaSimulationResult,
  type SimulationOptions,
  type SimulationStepResult,
} from "./personas";

export async function runElenaEngineerSimulation(
  options?: SimulationOptions
): Promise<PersonaSimulationResult> {
  const startTime = Date.now();
  if (!options?.db) {
    initDb();
  }
  const db = options?.db || getDb();
  const persona = SIMULATION_PERSONAS.elena;
  const steps: SimulationStepResult[] = [];
  const log = options?.logger || (options?.logProgress ? console.log : () => {});

  const elenaId = persona.id;
  const courseId = persona.targetCourseId;
  const enrollmentId = "enr_elena_tech_sim";

  let certificateCode: string | undefined;
  let certificateHash: string | undefined;

  try {
    // ========================================================================
    // Step 1: Session Init & Technical Curriculum Resume
    // ========================================================================
    const s1Start = Date.now();
    log(`[Elena Rostova] Step 1: Initializing Senior Engineer session & resuming safety track...`);

    const elena = db.prepare("SELECT * FROM users WHERE id = ?").get(elenaId) as any;
    if (!elena) {
      throw new Error(`User '${elenaId}' not found in database`);
    }
    if (elena.role !== "EMPLOYEE") {
      throw new Error(`Expected role EMPLOYEE for Elena Rostova, got '${elena.role}'`);
    }

    const course = db.prepare("SELECT * FROM courses WHERE id = ?").get(courseId) as any;
    if (!course) {
      throw new Error(`Course '${courseId}' not found`);
    }
    if (course.passing_score_pct !== 85) {
      throw new Error(`Expected passing threshold 85%, got ${course.passing_score_pct}%`);
    }
    if (course.renewal_period_days !== 365) {
      throw new Error(`Expected 365-day renewal period, got ${course.renewal_period_days}`);
    }
    if (course.version !== "2.1.0") {
      throw new Error(`Expected version 2.1.0, got ${course.version}`);
    }

    // Clean up prior simulation artifacts for repeatable execution
    const prevEnrollments = db.prepare("SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?").all(elenaId, courseId) as any[];
    for (const prev of prevEnrollments) {
      db.prepare("DELETE FROM module_progress WHERE enrollment_id = ?").run(prev.id);
      db.prepare("DELETE FROM quiz_submissions WHERE enrollment_id = ?").run(prev.id);
      db.prepare("DELETE FROM certificates WHERE enrollment_id = ?").run(prev.id);
    }
    db.prepare("DELETE FROM certificates WHERE user_id = ? AND course_id = ?").run(elenaId, courseId);
    db.prepare("DELETE FROM enrollments WHERE user_id = ? AND course_id = ?").run(elenaId, courseId);
    db.prepare("DELETE FROM enrollments WHERE id = ?").run(enrollmentId);

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO enrollments (
        id, user_id, course_id, status, progress_pct, assigned_by, assigned_at, created_at, updated_at
      ) VALUES (?, ?, ?, 'IN_PROGRESS', 50, 'usr_sarah_jenkins', ?, ?, ?)
    `).run(enrollmentId, elenaId, courseId, now, now, now);

    const enr = db.prepare("SELECT * FROM enrollments WHERE id = ?").get(enrollmentId) as any;
    if (!enr || enr.status !== "IN_PROGRESS" || enr.progress_pct !== 50) {
      throw new Error("Failed to initialize Elena enrollment in IN_PROGRESS state at 50%");
    }

    steps.push({
      stepNumber: 1,
      name: "Session Init & Technical Curriculum Resume",
      description: "Assumed Elena Rostova session; verified Security Engineer profile, 85% passing threshold, and resumed at 50%",
      status: "PASSED",
      durationMs: Date.now() - s1Start,
      stateTransition: {
        entity: "Elena Rostova Session",
        from: "Unauthenticated",
        to: "Authenticated (Senior Engineer)",
        metadata: { courseId, status: "IN_PROGRESS", progressPct: 50 },
      },
      details: {
        userId: elenaId,
        userName: elena.name,
        role: elena.role,
        department: elena.department,
        jobTitle: elena.job_title,
        courseTitle: course.title,
        passingThresholdPct: course.passing_score_pct,
        version: course.version,
      },
    });

    // ========================================================================
    // Step 2: Technical Markdown Review (Canary & Rollback Runbooks)
    // ========================================================================
    const s2Start = Date.now();
    log(`[Elena Rostova] Step 2: Reviewing canary deployments and automated rollback runbooks...`);

    const mod = db.prepare("SELECT * FROM modules WHERE id = 'mod_tech_canary'").get() as any;
    if (!mod) {
      throw new Error("Module 'mod_tech_canary' not found in database");
    }
    if (!mod.content || !mod.content.includes("Canary Deployments") || !mod.content.includes("Automated Rollback")) {
      throw new Error("Module 'mod_tech_canary' does not contain required technical runbook documentation");
    }

    const t2 = new Date().toISOString();
    db.prepare(`
      INSERT INTO module_progress (
        id, enrollment_id, module_id, user_id, status, completed_at, time_spent_seconds, created_at, updated_at
      ) VALUES (?, ?, 'mod_tech_canary', ?, 'COMPLETED', ?, 1200, ?, ?)
    `).run(`mp_elena_canary_${randomUUID().substring(0, 8)}`, enrollmentId, elenaId, t2, t2, t2);

    recordAuditEvent(
      {
        actorId: elenaId,
        actorRole: "EMPLOYEE",
        actorName: persona.name,
        action: "MODULE_COMPLETED",
        targetType: "MODULE",
        targetId: "mod_tech_canary",
        courseId,
        moduleId: "mod_tech_canary",
        moduleVersion: "2.1.0",
        details: { timeSpentSeconds: 1200, runbookReview: "Canary Rollback & Database Expansion" },
      },
      db
    );

    steps.push({
      stepNumber: 2,
      name: "Technical Markdown Review (Canary & Rollback Runbooks)",
      description: "Traversed technical markdown on canary releases, error budget thresholds (0.05%), and zero-downtime database migrations",
      status: "PASSED",
      durationMs: Date.now() - s2Start,
      stateTransition: {
        entity: "Module (mod_tech_canary)",
        from: "IN_PROGRESS",
        to: "COMPLETED",
        metadata: { moduleVersion: "2.1.0", type: "RICH_MARKDOWN" },
      },
      details: {
        moduleId: mod.id,
        moduleTitle: mod.title,
        version: "2.1.0",
      },
    });

    // ========================================================================
    // Step 3: Technical Safety Exam (100% Score >= 85% Strict Threshold)
    // ========================================================================
    const s3Start = Date.now();
    log(`[Elena Rostova] Step 3: Executing Production Resilience & Safety Exam...`);

    const elenaAnswers = {
      qq_tech_1: "opt_2", // Automated rollback on error budget spike
      qq_tech_2: "opt_f", // False (must use expand-and-contract)
    };

    const evaluation = evaluateQuiz("q_tech_1", elenaAnswers, db);
    if (!evaluation.passed || evaluation.scorePct !== 100) {
      throw new Error(`Expected 100% score on technical exam, got ${evaluation.scorePct}%`);
    }
    if (evaluation.scorePct < course.passing_score_pct) {
      throw new Error(`Score ${evaluation.scorePct}% does not meet strict ${course.passing_score_pct}% threshold`);
    }

    const t3 = new Date().toISOString();
    const submissionId = `qs_elena_tech_${randomUUID().substring(0, 8)}`;
    db.prepare(`
      INSERT INTO quiz_submissions (
        id, enrollment_id, module_id, user_id, score, passed, attempt_number, answers_payload, feedback_payload, submitted_at
      ) VALUES (?, ?, 'mod_tech_safety_quiz', ?, ?, 1, 1, ?, ?, ?)
    `).run(
      submissionId,
      enrollmentId,
      elenaId,
      evaluation.scorePct,
      JSON.stringify(elenaAnswers),
      JSON.stringify(evaluation),
      t3
    );

    db.prepare(`
      INSERT INTO module_progress (
        id, enrollment_id, module_id, user_id, status, completed_at, time_spent_seconds, created_at, updated_at
      ) VALUES (?, ?, 'mod_tech_safety_quiz', ?, 'COMPLETED', ?, 600, ?, ?)
    `).run(`mp_elena_quiz_${randomUUID().substring(0, 8)}`, enrollmentId, elenaId, t3, t3, t3);

    recordAuditEvent(
      {
        actorId: elenaId,
        actorRole: "EMPLOYEE",
        actorName: persona.name,
        action: "QUIZ_PASSED",
        targetType: "QUIZ",
        targetId: "q_tech_1",
        courseId,
        moduleId: "mod_tech_safety_quiz",
        moduleVersion: "2.1.0",
        score: evaluation.scorePct,
        details: {
          attemptNumber: 1,
          scorePct: 100,
          passingThresholdPct: 85,
          passed: true,
        },
      },
      db
    );

    steps.push({
      stepNumber: 3,
      name: "Technical Safety Exam (100% Score >= 85% Strict Threshold)",
      description: "Completed edge-case resilience questions; scored 100% against strict 85% passing requirement",
      status: "PASSED",
      durationMs: Date.now() - s3Start,
      stateTransition: {
        entity: "Exam (q_tech_1)",
        from: "PENDING",
        to: "PASSED (100% >= 85% strict threshold)",
        metadata: { score: 100, passingThreshold: 85 },
      },
      details: {
        quizId: "q_tech_1",
        submissionId,
        scorePct: 100,
        passingThresholdPct: 85,
      },
    });

    // ========================================================================
    // Step 4: Assert Terminal State: Versioned Audit & 365-Day Renewal
    // ========================================================================
    const s4Start = Date.now();
    log(`[Elena Rostova] Step 4: Finalizing technical certification & 365-day renewal...`);

    const t4 = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      UPDATE enrollments 
      SET status = 'COMPLETED', progress_pct = 100, completed_at = ?, expires_at = ?, updated_at = ?
      WHERE id = ?
    `).run(t4, expiresAt, t4, enrollmentId);

    const cert = generateCertificate({
      userId: elenaId,
      courseId,
      enrollmentId,
      score: 100,
      actorRole: "EMPLOYEE",
      actorName: persona.name,
      customDb: db,
    });

    certificateCode = cert.certificate_code;
    certificateHash = cert.verification_hash;

    const certAuditLog = recordAuditEvent(
      {
        actorId: elenaId,
        actorRole: "EMPLOYEE",
        actorName: persona.name,
        action: "PRODUCTION_ACCESS_CERTIFIED",
        targetType: "COURSE",
        targetId: courseId,
        courseId,
        moduleVersion: "2.1.0",
        score: 100,
        details: {
          validityDays: 365,
          certifiedRole: "Staff Security Engineer",
          certificateCode,
        },
      },
      db
    );

    if (certAuditLog.module_version !== "2.1.0" || certAuditLog.score !== 100) {
      throw new Error("Audit log entry does not contain version 2.1.0 and score 100");
    }

    const renewalStatus = computeComplianceStatus(t4, 365);
    if (renewalStatus !== "VALID") {
      throw new Error(`Expected renewal status VALID, got '${renewalStatus}'`);
    }

    const finalEnr = db.prepare("SELECT * FROM enrollments WHERE id = ?").get(enrollmentId) as any;
    if (finalEnr.status !== "COMPLETED" || finalEnr.expires_at !== expiresAt) {
      throw new Error("Enrollment does not reflect COMPLETED status with 365-day expires_at");
    }

    const auditIntegrity = verifyAuditLogIntegrity(db);
    if (!auditIntegrity.isValid) {
      throw new Error("Audit log hash chain is invalid");
    }

    steps.push({
      stepNumber: 4,
      name: "Assert Terminal State: Versioned Audit Logging (v2.1.0) & 365-Day Renewal Validity",
      description: `Production safety certified; audit log records v2.1.0 and score 100; credential expiration scheduled for ${expiresAt.split("T")[0]} (VALID)`,
      status: "PASSED",
      durationMs: Date.now() - s4Start,
      stateTransition: {
        entity: "Course (crs_tech_prod_safety)",
        from: "IN_PROGRESS (50%)",
        to: "COMPLETED (100%)",
        metadata: {
          renewalStatus: "VALID",
          validityDays: 365,
          moduleVersion: "2.1.0",
          certificateCode,
        },
      },
      details: {
        enrollmentId,
        certificateCode,
        certificateHash,
        renewalStatus,
        expiresAt,
        moduleVersion: "2.1.0",
        score: 100,
        auditChainValid: auditIntegrity.isValid,
      },
    });

    log(`[Elena Rostova] ✅ Senior Engineer Simulation Completed Successfully in ${Date.now() - startTime}ms`);

    return {
      personaKey: "elena",
      personaId: elenaId,
      personaName: persona.name,
      role: persona.role,
      targetCourseId: courseId,
      targetCourseTitle: persona.targetCourseTitle,
      status: "PASSED",
      totalDurationMs: Date.now() - startTime,
      steps,
      artifacts: {
        certificateCode,
        certificateHash,
        quizScore: 100,
        quizPassed: true,
        auditLogsGenerated: 3,
        auditRootHash: auditIntegrity.actualHash,
      },
    };
  } catch (err: any) {
    const failedDuration = Date.now() - startTime;
    log(`[Elena Rostova] ❌ Simulation failed: ${err.message}`);
    return {
      personaKey: "elena",
      personaId: elenaId,
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
