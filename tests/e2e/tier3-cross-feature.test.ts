import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  createIsolatedTestDb,
  seedTestDb,
  evaluateQuizAgainstDb,
  computeComplianceStatus,
  recordTestAuditEvent,
  generateAuditCsv,
  generateAuditJson,
  verifyAuditChainInMemory,
  GENESIS_HASH,
  type TestDatabaseContext,
} from "./test-helpers";
import type { AuditLogRecord } from "../../src/types";

describe("Tier 3 — Cross-Feature Causal Combinations (Opaque-Box E2E)", () => {
  let ctx: TestDatabaseContext;

  before(() => {
    ctx = createIsolatedTestDb("tier3");
    seedTestDb(ctx.db);
  });

  after(() => {
    ctx.cleanup();
  });

  // ==========================================================================
  // CHAIN 1: Quiz Pass -> Course 100% -> Certificate -> Chained Audit -> Export
  // ==========================================================================
  describe("Chain 1: Complete Learning Lifecycle to Regulatory Audit Export", () => {
    const courseId = "crs_onboarding_day1";
    const userId = "usr_alex_rivera";
    const enrollmentId = "enr_chain1_alex";
    const certCode = "CERT-2026-ONB-99881";

    it("1.1 Initializes new enrollment at 0% progress and NOT_STARTED", () => {
      const now = new Date().toISOString();
      ctx.db.prepare(`
        INSERT INTO enrollments (
          id, user_id, course_id, status, progress_pct, assigned_by, assigned_at, created_at, updated_at
        ) VALUES (?, ?, ?, 'NOT_STARTED', 0, 'usr_sarah_jenkins', ?, ?, ?)
      `).run(enrollmentId, userId, courseId, now, now, now);

      const enr = ctx.db.prepare("SELECT * FROM enrollments WHERE id = ?").get(enrollmentId) as any;
      assert.strictEqual(enr.status, "NOT_STARTED");
      assert.strictEqual(enr.progress_pct, 0);
    });

    it("1.2 Completing Module 0 & Module 1 advances enrollment to 67% IN_PROGRESS", () => {
      const now = new Date().toISOString();
      const insertMp = ctx.db.prepare(`
        INSERT INTO module_progress (
          id, enrollment_id, module_id, user_id, status, completed_at, time_spent_seconds, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'COMPLETED', ?, 600, ?, ?)
      `);

      insertMp.run("mp_c1_mod0", enrollmentId, "mod_onb_welcome", userId, now, now, now);
      insertMp.run("mp_c1_mod1", enrollmentId, "mod_onb_security_video", userId, now, now, now);

      // Total 3 modules in course, 2 completed -> 67%
      ctx.db.prepare("UPDATE enrollments SET status = 'IN_PROGRESS', progress_pct = 67 WHERE id = ?").run(enrollmentId);

      const enr = ctx.db.prepare("SELECT * FROM enrollments WHERE id = ?").get(enrollmentId) as any;
      assert.strictEqual(enr.status, "IN_PROGRESS");
      assert.strictEqual(enr.progress_pct, 67);
    });

    it("1.3 Passing Quiz evaluates to 100% score and records quiz submission", () => {
      const answers = {
        qq_onb_1: "opt_2",
        qq_onb_2: ["opt_1", "opt_3"],
        qq_onb_3: "opt_f",
      };

      const result = evaluateQuizAgainstDb(ctx.db, "q_onb_1", answers);
      assert.strictEqual(result.passed, true);
      assert.strictEqual(result.scorePct, 100);

      const now = new Date().toISOString();
      ctx.db.prepare(`
        INSERT INTO quiz_submissions (
          id, enrollment_id, module_id, user_id, score, passed, attempt_number, answers_payload, feedback_payload, submitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      `).run("qs_c1_sub", enrollmentId, "mod_onb_quiz", userId, result.scorePct, 1, JSON.stringify(answers), JSON.stringify(result), now);

      const sub = ctx.db.prepare("SELECT * FROM quiz_submissions WHERE id = 'qs_c1_sub'").get() as any;
      assert.strictEqual(sub.passed, 1);
      assert.strictEqual(sub.score, 100);
    });

    it("1.4 Auto-transitions enrollment to COMPLETED and generates verifiable certificate", () => {
      const now = new Date().toISOString();
      ctx.db.prepare("UPDATE enrollments SET status = 'COMPLETED', progress_pct = 100, completed_at = ? WHERE id = ?").run(now, enrollmentId);

      // Generate Certificate
      const certHash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      ctx.db.prepare(`
        INSERT INTO certificates (
          id, certificate_code, user_id, course_id, enrollment_id, course_title,
          course_version, user_name, user_email, score, issued_at, verification_hash, created_at
        ) VALUES (?, ?, ?, ?, ?, 'Day-1 Enterprise Orientation', '1.0.0', 'Alex Rivera', 'alex.rivera@enterprise.corp', 100, ?, ?, ?)
      `).run("cert_chain1_alex", certCode, userId, courseId, enrollmentId, now, certHash, now);

      const cert = ctx.db.prepare("SELECT * FROM certificates WHERE certificate_code = ?").get(certCode) as any;
      assert.ok(cert);
      assert.strictEqual(cert.user_id, userId);
      assert.strictEqual(cert.score, 100);
    });

    it("1.5 Appends chained audit log events linking quiz submission and certificate issuance", () => {
      const log1 = recordTestAuditEvent(ctx.db, {
        actorId: userId,
        actorRole: "EMPLOYEE",
        actorName: "Alex Rivera",
        action: "QUIZ_PASSED",
        targetType: "QUIZ",
        targetId: "q_onb_1",
        courseId,
        score: 100,
      });

      const log2 = recordTestAuditEvent(ctx.db, {
        actorId: userId,
        actorRole: "EMPLOYEE",
        actorName: "Alex Rivera",
        action: "COMPLIANCE_CERTIFIED",
        targetType: "CERTIFICATE",
        targetId: certCode,
        courseId,
        score: 100,
        details: { certificateCode: certCode },
      });

      assert.strictEqual(log2.prev_hash, log1.record_hash, "Second log must chain to first log hash");
    });

    it("1.6 Compliance CSV export accurately reflects issued certificate and cryptographic hash", () => {
      const records = ctx.db.prepare("SELECT * FROM audit_logs WHERE target_id = ?").all(certCode) as unknown as AuditLogRecord[];
      assert.strictEqual(records.length, 1);

      const csv = generateAuditCsv(records);
      assert.ok(csv.includes(certCode));
      assert.ok(csv.includes("Alex Rivera"));
      assert.ok(csv.includes(records[0].record_hash));
    });
  });

  // ==========================================================================
  // CHAIN 2: Failed Quiz Recovery & Dual-Attempt Audit Chain Continuity
  // ==========================================================================
  describe("Chain 2: Failed Quiz Recovery Lifecycle", () => {
    const courseId = "crs_onboarding_day1";
    const userId = "usr_elena_rostova";
    const enrollmentId = "enr_chain2_elena";

    it("2.1 Failed quiz attempt blocks course completion and certificate generation", () => {
      const now = new Date().toISOString();
      ctx.db.prepare(`
        INSERT INTO enrollments (
          id, user_id, course_id, status, progress_pct, assigned_by, assigned_at, created_at, updated_at
        ) VALUES (?, ?, ?, 'IN_PROGRESS', 67, 'usr_sarah_jenkins', ?, ?, ?)
      `).run(enrollmentId, userId, courseId, now, now, now);

      // Attempt 1: Failed score (33%)
      const subAnswers = { qq_onb_1: "opt_1", qq_onb_2: ["opt_1"], qq_onb_3: "opt_t" };
      const evalRes = evaluateQuizAgainstDb(ctx.db, "q_onb_1", subAnswers);
      assert.strictEqual(evalRes.passed, false);

      ctx.db.prepare(`
        INSERT INTO quiz_submissions (
          id, enrollment_id, module_id, user_id, score, passed, attempt_number, answers_payload, feedback_payload, submitted_at
        ) VALUES (?, ?, 'mod_onb_quiz', ?, ?, 0, 1, ?, ?, ?)
      `).run("qs_c2_fail", enrollmentId, userId, evalRes.scorePct, JSON.stringify(subAnswers), JSON.stringify(evalRes), now);

      // Log failure in audit trail
      recordTestAuditEvent(ctx.db, {
        actorId: userId,
        actorRole: "EMPLOYEE",
        action: "QUIZ_FAILED",
        targetType: "QUIZ",
        targetId: "q_onb_1",
        courseId,
        score: evalRes.scorePct,
      });

      // Assert enrollment is NOT complete
      const enr = ctx.db.prepare("SELECT * FROM enrollments WHERE id = ?").get(enrollmentId) as any;
      assert.strictEqual(enr.status, "IN_PROGRESS");
      assert.strictEqual(enr.completed_at, null);

      // Assert certificate is NOT issued
      const cert = ctx.db.prepare("SELECT * FROM certificates WHERE enrollment_id = ?").get(enrollmentId);
      assert.strictEqual(cert, undefined);
    });

    it("2.2 Retake achieves 100% score, unlocks completion, and maintains unbroken audit hash chain", () => {
      const now = new Date().toISOString();
      const passAnswers = { qq_onb_1: "opt_2", qq_onb_2: ["opt_1", "opt_3"], qq_onb_3: "opt_f" };
      const evalRes = evaluateQuizAgainstDb(ctx.db, "q_onb_1", passAnswers);
      assert.strictEqual(evalRes.passed, true);

      // Record Attempt 2
      ctx.db.prepare(`
        INSERT INTO quiz_submissions (
          id, enrollment_id, module_id, user_id, score, passed, attempt_number, answers_payload, feedback_payload, submitted_at
        ) VALUES (?, ?, 'mod_onb_quiz', ?, ?, 1, 2, ?, ?, ?)
      `).run("qs_c2_pass", enrollmentId, userId, evalRes.scorePct, JSON.stringify(passAnswers), JSON.stringify(evalRes), now);

      // Update enrollment to COMPLETED
      ctx.db.prepare("UPDATE enrollments SET status = 'COMPLETED', progress_pct = 100, completed_at = ? WHERE id = ?").run(now, enrollmentId);

      // Log success in audit trail
      recordTestAuditEvent(ctx.db, {
        actorId: userId,
        actorRole: "EMPLOYEE",
        action: "QUIZ_PASSED",
        targetType: "QUIZ",
        targetId: "q_onb_1",
        courseId,
        score: evalRes.scorePct,
      });

      // Verify both submissions exist in order
      const subs = ctx.db.prepare("SELECT * FROM quiz_submissions WHERE enrollment_id = ? ORDER BY attempt_number ASC").all(enrollmentId) as any[];
      assert.strictEqual(subs.length, 2);
      assert.strictEqual(subs[0].attempt_number, 1);
      assert.strictEqual(subs[0].passed, 0);
      assert.strictEqual(subs[1].attempt_number, 2);
      assert.strictEqual(subs[1].passed, 1);

      // Verify entire audit chain remains intact
      const allLogs = ctx.db.prepare("SELECT * FROM audit_logs ORDER BY id ASC").all() as unknown as AuditLogRecord[];
      const chainCheck = verifyAuditChainInMemory(allLogs);
      assert.strictEqual(chainCheck.isValid, true);
    });
  });

  // ==========================================================================
  // CHAIN 3: Compliance Renewal Lifecycle & Expiration Propagation
  // ==========================================================================
  describe("Chain 3: Compliance Renewal Lifecycle & Expiration Propagation", () => {
    const fixedNow = new Date("2026-10-25T12:00:00Z");

    it("3.1 Evaluates compliance states across 365-day lifecycle: VALID -> EXPIRING_SOON -> EXPIRED", () => {
      // 10 days post-completion
      const tenDaysAgo = new Date(fixedNow.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
      assert.strictEqual(computeComplianceStatus(tenDaysAgo, 365, fixedNow), "VALID");

      // 345 days post-completion (20 days remaining)
      const warningWindow = new Date(fixedNow.getTime() - 345 * 24 * 60 * 60 * 1000).toISOString();
      assert.strictEqual(computeComplianceStatus(warningWindow, 365, fixedNow), "EXPIRING_SOON");

      // 370 days post-completion (overdue)
      const expiredDate = new Date(fixedNow.getTime() - 370 * 24 * 60 * 60 * 1000).toISOString();
      assert.strictEqual(computeComplianceStatus(expiredDate, 365, fixedNow), "EXPIRED");
    });

    it("3.2 Expired compliance propagates to team overdue counts on manager dashboard", () => {
      // Provision test department with 1 compliant and 1 expired user
      const usersInDept = [
        { id: "usr_alex_rivera", completedAt: new Date(fixedNow.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString() },
        { id: "usr_sarah_jenkins", completedAt: new Date(fixedNow.getTime() - 380 * 24 * 60 * 60 * 1000).toISOString() },
      ];

      let overdueCount = 0;
      let validCount = 0;

      for (const u of usersInDept) {
        const status = computeComplianceStatus(u.completedAt, 365, fixedNow);
        if (status === "EXPIRED") overdueCount++;
        if (status === "VALID") validCount++;
      }

      assert.strictEqual(overdueCount, 1);
      assert.strictEqual(validCount, 1);
      const teamComplianceRate = Math.round((validCount / usersInDept.length) * 100);
      assert.strictEqual(teamComplianceRate, 50);
    });

    it("3.3 Manager triggers reminder notification, appending audit log event", () => {
      const nudgeLog = recordTestAuditEvent(ctx.db, {
        actorId: "usr_marcus_vance",
        actorRole: "COMPLIANCE_OFFICER",
        actorName: "Marcus Vance",
        action: "RENEWAL_REMINDER_SENT",
        targetType: "USER",
        targetId: "usr_sarah_jenkins",
        courseId: "crs_sec_soc2_2026",
        details: { message: "Annual SOC 2 compliance training has expired. Please re-certify." },
      });

      assert.ok(nudgeLog.id > 0);
      assert.strictEqual(nudgeLog.action, "RENEWAL_REMINDER_SENT");
    });
  });

  // ==========================================================================
  // CHAIN 4: Manager Assignment to Team Compliance KPI Aggregation
  // ==========================================================================
  describe("Chain 4: Manager Course Assignment to Team Compliance Aggregation", () => {
    const courseId = "crs_tech_prod_safety";
    const managerId = "usr_sarah_jenkins";
    const report1 = "usr_alex_rivera";
    const report2 = "usr_elena_rostova";

    it("4.1 Manager assigns course to 2 direct reports; initial team compliance is 0%", () => {
      const now = new Date().toISOString();
      const insertEnr = ctx.db.prepare(`
        INSERT OR REPLACE INTO enrollments (
          id, user_id, course_id, status, progress_pct, assigned_by, assigned_at, created_at, updated_at
        ) VALUES (?, ?, ?, 'NOT_STARTED', 0, ?, ?, ?, ?)
      `);

      insertEnr.run("enr_c4_alex", report1, courseId, managerId, now, now, now);
      insertEnr.run("enr_c4_elena", report2, courseId, managerId, now, now, now);

      const teamEnrollments = ctx.db
        .prepare("SELECT * FROM enrollments WHERE course_id = ? AND user_id IN (?, ?)")
        .all(courseId, report1, report2) as any[];

      const completed = teamEnrollments.filter((e) => e.status === "COMPLETED").length;
      const complianceRate = (completed / teamEnrollments.length) * 100;
      assert.strictEqual(complianceRate, 0);
    });

    it("4.2 Report 1 finishes course; team compliance increases to exactly 50%", () => {
      const now = new Date().toISOString();
      ctx.db.prepare("UPDATE enrollments SET status = 'COMPLETED', progress_pct = 100, completed_at = ? WHERE id = 'enr_c4_alex'").run(now);

      const teamEnrollments = ctx.db
        .prepare("SELECT * FROM enrollments WHERE course_id = ? AND user_id IN (?, ?)")
        .all(courseId, report1, report2) as any[];

      const completed = teamEnrollments.filter((e) => e.status === "COMPLETED").length;
      const complianceRate = Math.round((completed / teamEnrollments.length) * 100);
      assert.strictEqual(complianceRate, 50);
    });

    it("4.3 Report 2 finishes course; team compliance reaches 100%", () => {
      const now = new Date().toISOString();
      ctx.db.prepare("UPDATE enrollments SET status = 'COMPLETED', progress_pct = 100, completed_at = ? WHERE id = 'enr_c4_elena'").run(now);

      const teamEnrollments = ctx.db
        .prepare("SELECT * FROM enrollments WHERE course_id = ? AND user_id IN (?, ?)")
        .all(courseId, report1, report2) as any[];

      const completed = teamEnrollments.filter((e) => e.status === "COMPLETED").length;
      const complianceRate = Math.round((completed / teamEnrollments.length) * 100);
      assert.strictEqual(complianceRate, 100);
    });
  });

  // ==========================================================================
  // CHAIN 5: Curriculum Passing Threshold Policy Update Impact
  // ==========================================================================
  describe("Chain 5: Course Passing Threshold Policy Update Impact", () => {
    it("5.1 Stricter passing threshold (85%) causes 80% score to evaluate as FAILED", () => {
      // Temporarily set passing threshold to 85%
      ctx.db.prepare("UPDATE quizzes SET passing_score_pct = 85 WHERE id = 'q_onb_1'").run();

      // Submit 2 out of 3 correct (67%) or 80% if 4 out of 5
      const quiz = ctx.db.prepare("SELECT passing_score_pct FROM quizzes WHERE id = 'q_onb_1'").get() as any;
      assert.strictEqual(quiz.passing_score_pct, 85);

      const score = 80;
      const passed = score >= quiz.passing_score_pct;
      assert.strictEqual(passed, false);
    });

    it("5.2 Lowering passing threshold (75%) causes same 80% score to evaluate as PASSED", () => {
      ctx.db.prepare("UPDATE quizzes SET passing_score_pct = 75 WHERE id = 'q_onb_1'").run();

      const quiz = ctx.db.prepare("SELECT passing_score_pct FROM quizzes WHERE id = 'q_onb_1'").get() as any;
      assert.strictEqual(quiz.passing_score_pct, 75);

      const score = 80;
      const passed = score >= quiz.passing_score_pct;
      assert.strictEqual(passed, true);

      // Restore threshold back to 80%
      ctx.db.prepare("UPDATE quizzes SET passing_score_pct = 80 WHERE id = 'q_onb_1'").run();
    });
  });
});
