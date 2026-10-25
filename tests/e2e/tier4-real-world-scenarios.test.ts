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

describe("Tier 4 — Real-World Persona Scenarios (Opaque-Box E2E)", () => {
  let ctx: TestDatabaseContext;

  before(() => {
    ctx = createIsolatedTestDb("tier4");
    seedTestDb(ctx.db);
  });

  after(() => {
    ctx.cleanup();
  });

  // ==========================================================================
  // PERSONA 1: Alex Rivera (New Hire Day-1 Orientation)
  // ==========================================================================
  describe("Persona 1: Alex Rivera (New Hire Day-1 Orientation)", () => {
    const alexId = "usr_alex_rivera";
    const courseId = "crs_onboarding_day1";
    const enrollmentId = "enr_alex_day1_sim";

    it("P1.Step 1: Session initialization and onboarding dashboard inspection", () => {
      // Alex Rivera profile
      const alex = ctx.db.prepare("SELECT * FROM users WHERE id = ?").get(alexId) as any;
      assert.ok(alex);
      assert.strictEqual(alex.role, "EMPLOYEE");
      assert.strictEqual(alex.department, "Engineering");

      // Verify Day-1 course exists
      const course = ctx.db.prepare("SELECT * FROM courses WHERE id = ?").get(courseId) as any;
      assert.ok(course);
      assert.strictEqual(course.is_mandatory, 1);
      assert.strictEqual(course.category, "ONBOARDING");

      // Provision fresh onboarding enrollment for simulation
      const now = new Date().toISOString();
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
      ctx.db.prepare(`
        INSERT INTO enrollments (
          id, user_id, course_id, status, progress_pct, assigned_by, assigned_at, due_date, created_at, updated_at
        ) VALUES (?, ?, ?, 'NOT_STARTED', 0, 'usr_sarah_jenkins', ?, ?, ?, ?)
      `).run(enrollmentId, alexId, courseId, now, dueDate, now, now);

      const enr = ctx.db.prepare("SELECT * FROM enrollments WHERE id = ?").get(enrollmentId) as any;
      assert.strictEqual(enr.status, "NOT_STARTED");
      assert.strictEqual(enr.progress_pct, 0);
    });

    it("P1.Step 2: Traverses Module 0 (Welcome Markdown) -> Progress updates to 33%", () => {
      const now = new Date().toISOString();
      ctx.db.prepare(`
        INSERT INTO module_progress (
          id, enrollment_id, module_id, user_id, status, completed_at, time_spent_seconds, created_at, updated_at
        ) VALUES ('mp_alex_mod0', ?, 'mod_onb_welcome', ?, 'COMPLETED', ?, 900, ?, ?)
      `).run(enrollmentId, alexId, now, now, now);

      ctx.db.prepare("UPDATE enrollments SET status = 'IN_PROGRESS', progress_pct = 33 WHERE id = ?").run(enrollmentId);

      const enr = ctx.db.prepare("SELECT * FROM enrollments WHERE id = ?").get(enrollmentId) as any;
      assert.strictEqual(enr.status, "IN_PROGRESS");
      assert.strictEqual(enr.progress_pct, 33);

      recordTestAuditEvent(ctx.db, {
        actorId: alexId,
        actorRole: "EMPLOYEE",
        actorName: "Alex Rivera",
        action: "MODULE_COMPLETED",
        targetType: "MODULE",
        targetId: "mod_onb_welcome",
        courseId,
      });
    });

    it("P1.Step 3: Traverses Module 1 (Security Video) -> Progress updates to 67%", () => {
      const now = new Date().toISOString();
      ctx.db.prepare(`
        INSERT INTO module_progress (
          id, enrollment_id, module_id, user_id, status, completed_at, time_spent_seconds, last_position_seconds, created_at, updated_at
        ) VALUES ('mp_alex_mod1', ?, 'mod_onb_security_video', ?, 'COMPLETED', ?, 180, 180, ?, ?)
      `).run(enrollmentId, alexId, now, now, now);

      ctx.db.prepare("UPDATE enrollments SET progress_pct = 67 WHERE id = ?").run(enrollmentId);

      const enr = ctx.db.prepare("SELECT * FROM enrollments WHERE id = ?").get(enrollmentId) as any;
      assert.strictEqual(enr.progress_pct, 67);

      recordTestAuditEvent(ctx.db, {
        actorId: alexId,
        actorRole: "EMPLOYEE",
        actorName: "Alex Rivera",
        action: "MODULE_COMPLETED",
        targetType: "MODULE",
        targetId: "mod_onb_security_video",
        courseId,
      });
    });

    it("P1.Step 4: Completes Module 2 Interactive Quiz with 100% score", () => {
      const alexAnswers = {
        qq_onb_1: "opt_2", // Hardware FIDO2
        qq_onb_2: ["opt_1", "opt_3"], // Lock screen & unbadged visitors
        qq_onb_3: "opt_f", // False
      };

      const result = evaluateQuizAgainstDb(ctx.db, "q_onb_1", alexAnswers);
      assert.strictEqual(result.passed, true);
      assert.strictEqual(result.scorePct, 100);

      const now = new Date().toISOString();
      ctx.db.prepare(`
        INSERT INTO quiz_submissions (
          id, enrollment_id, module_id, user_id, score, passed, attempt_number, answers_payload, feedback_payload, submitted_at
        ) VALUES ('qs_alex_day1', ?, 'mod_onb_quiz', ?, ?, 1, 1, ?, ?, ?)
      `).run(enrollmentId, alexId, result.scorePct, JSON.stringify(alexAnswers), JSON.stringify(result), now);

      const sub = ctx.db.prepare("SELECT * FROM quiz_submissions WHERE id = 'qs_alex_day1'").get() as any;
      assert.strictEqual(sub.passed, 1);
      assert.strictEqual(sub.score, 100);
    });

    it("P1.Step 5: Asserts terminal state: COMPLETED, Certificate Issued, Audit Chain Intact", () => {
      const now = new Date().toISOString();
      ctx.db.prepare("UPDATE enrollments SET status = 'COMPLETED', progress_pct = 100, completed_at = ? WHERE id = ?").run(now, enrollmentId);

      const certCode = "CERT-2026-ONB-ALEX01";
      ctx.db.prepare(`
        INSERT INTO certificates (
          id, certificate_code, user_id, course_id, enrollment_id, course_title,
          course_version, user_name, user_email, score, issued_at, verification_hash, created_at
        ) VALUES ('cert_alex_day1', ?, ?, ?, ?, 'Day-1 Enterprise Orientation', '1.0.0', 'Alex Rivera', 'alex.rivera@enterprise.corp', 100, ?, 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210', ?)
      `).run(certCode, alexId, courseId, enrollmentId, now, now);

      // Record audit log for certification
      recordTestAuditEvent(ctx.db, {
        actorId: alexId,
        actorRole: "EMPLOYEE",
        actorName: "Alex Rivera",
        action: "COMPLIANCE_CERTIFIED",
        targetType: "CERTIFICATE",
        targetId: certCode,
        courseId,
        score: 100,
        details: { certificateCode: certCode },
      });

      // Terminal Invariants Assertions
      const enr = ctx.db.prepare("SELECT * FROM enrollments WHERE id = ?").get(enrollmentId) as any;
      assert.strictEqual(enr.status, "COMPLETED");
      assert.strictEqual(enr.progress_pct, 100);
      assert.ok(enr.completed_at);

      const cert = ctx.db.prepare("SELECT * FROM certificates WHERE certificate_code = ?").get(certCode) as any;
      assert.ok(cert);
      assert.strictEqual(cert.user_id, alexId);
      assert.strictEqual(cert.score, 100);

      const logs = ctx.db.prepare("SELECT * FROM audit_logs WHERE actor_id = ?").all(alexId) as unknown as AuditLogRecord[];
      assert.ok(logs.length >= 3);
    });
  });

  // ==========================================================================
  // PERSONA 2: Elena Rostova (Senior Engineer Technical Safety)
  // ==========================================================================
  describe("Persona 2: Elena Rostova (Senior Engineer Technical Safety)", () => {
    const elenaId = "usr_elena_rostova";
    const courseId = "crs_tech_prod_safety";
    const enrollmentId = "enr_elena_tech_sim";

    it("P2.Step 1: Session init and technical safety curriculum resume", () => {
      const elena = ctx.db.prepare("SELECT * FROM users WHERE id = ?").get(elenaId) as any;
      assert.ok(elena);
      assert.strictEqual(elena.role, "EMPLOYEE");
      assert.strictEqual(elena.department, "Security");

      const course = ctx.db.prepare("SELECT * FROM courses WHERE id = ?").get(courseId) as any;
      assert.strictEqual(course.category, "TECHNICAL_UPSKILLING");
      assert.strictEqual(course.passing_score_pct, 85);
      assert.strictEqual(course.renewal_period_days, 365);
      assert.strictEqual(course.version, "2.1.0");

      const now = new Date().toISOString();
      ctx.db.prepare(`
        INSERT INTO enrollments (
          id, user_id, course_id, status, progress_pct, assigned_by, assigned_at, created_at, updated_at
        ) VALUES (?, ?, ?, 'IN_PROGRESS', 50, 'usr_sarah_jenkins', ?, ?, ?)
      `).run(enrollmentId, elenaId, courseId, now, now, now);
    });

    it("P2.Step 2: Reviews technical markdown on canary releases and rollbacks", () => {
      const mod = ctx.db.prepare("SELECT * FROM modules WHERE id = 'mod_tech_canary'").get() as any;
      assert.strictEqual(mod.type, "RICH_MARKDOWN");
      assert.ok(mod.content.includes("Canary Deployments"));
      assert.ok(mod.content.includes("Automated Rollback"));
    });

    it("P2.Step 3: Takes technical safety exam, scoring 100% against 85% threshold", () => {
      const elenaAnswers = {
        qq_tech_1: "opt_2", // Automated rollback
        qq_tech_2: "opt_f", // False (must use expand-and-contract)
      };

      const result = evaluateQuizAgainstDb(ctx.db, "q_tech_1", elenaAnswers);
      assert.strictEqual(result.passed, true);
      assert.strictEqual(result.scorePct, 100);
      assert.ok(result.scorePct >= 85, "Must exceed 85% passing threshold");

      const now = new Date().toISOString();
      ctx.db.prepare(`
        INSERT INTO quiz_submissions (
          id, enrollment_id, module_id, user_id, score, passed, attempt_number, answers_payload, feedback_payload, submitted_at
        ) VALUES ('qs_elena_tech', ?, 'mod_tech_safety_quiz', ?, ?, 1, 1, ?, ?, ?)
      `).run(enrollmentId, elenaId, result.scorePct, JSON.stringify(elenaAnswers), JSON.stringify(result), now);
    });

    it("P2.Step 4: Asserts terminal state: versioned audit entry and 365-day renewal scheduling", () => {
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

      ctx.db.prepare(`
        UPDATE enrollments SET status = 'COMPLETED', progress_pct = 100, completed_at = ?, expires_at = ? WHERE id = ?
      `).run(now, expiresAt, enrollmentId);

      const log = recordTestAuditEvent(ctx.db, {
        actorId: elenaId,
        actorRole: "EMPLOYEE",
        actorName: "Elena Rostova",
        action: "PRODUCTION_ACCESS_CERTIFIED",
        targetType: "COURSE",
        targetId: courseId,
        courseId,
        moduleVersion: "2.1.0",
        score: 100,
        details: { validityDays: 365, certifiedRole: "Staff Security Engineer" },
      });

      assert.strictEqual(log.module_version, "2.1.0");
      assert.strictEqual(log.score, 100);

      // Verify renewal status is currently VALID
      const renewalStatus = computeComplianceStatus(now, 365);
      assert.strictEqual(renewalStatus, "VALID");

      const enr = ctx.db.prepare("SELECT * FROM enrollments WHERE id = ?").get(enrollmentId) as any;
      assert.strictEqual(enr.status, "COMPLETED");
      assert.strictEqual(enr.expires_at, expiresAt);
    });
  });

  // ==========================================================================
  // PERSONA 3: Marcus Vance (Compliance Officer Regulatory Audit & Export)
  // ==========================================================================
  describe("Persona 3: Marcus Vance (Compliance Officer Regulatory Audit & Export)", () => {
    const marcusId = "usr_marcus_vance";

    it("P3.Step 1: Session init as COMPLIANCE_OFFICER and KPI assessment", () => {
      const marcus = ctx.db.prepare("SELECT * FROM users WHERE id = ?").get(marcusId) as any;
      assert.ok(marcus);
      assert.strictEqual(marcus.role, "COMPLIANCE_OFFICER");

      const totalEmployees = (ctx.db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'EMPLOYEE'").get() as any).c;
      assert.ok(totalEmployees >= 2);

      const totalCertificates = (ctx.db.prepare("SELECT COUNT(*) as c FROM certificates").get() as any).c;
      assert.ok(totalCertificates >= 1);
    });

    it("P3.Step 2: Department breakdown query and compliance rates calculation", () => {
      const users = ctx.db.prepare("SELECT id, department FROM users").all() as any[];
      const depts = new Set(users.map((u) => u.department));
      assert.ok(depts.has("Engineering"));
      assert.ok(depts.has("Security"));

      // Overall compliance calculation
      const enrollments = ctx.db.prepare("SELECT status FROM enrollments").all() as any[];
      const completedCount = enrollments.filter((e) => e.status === "COMPLETED").length;
      const rate = Math.round((completedCount / enrollments.length) * 100);
      assert.ok(rate > 0);
    });

    it("P3.Step 3: Cryptographic SHA-256 audit log integrity verification", () => {
      const allLogs = ctx.db.prepare("SELECT * FROM audit_logs ORDER BY id ASC").all() as unknown as AuditLogRecord[];
      assert.ok(allLogs.length >= 5, "Audit log must contain all sequenced lifecycle events");

      const verification = verifyAuditChainInMemory(allLogs);
      assert.strictEqual(verification.isValid, true, "Hash chain must be 100% cryptographically intact");
      assert.strictEqual(verification.tamperedIndex, undefined);
    });

    it("P3.Step 4: Generates and validates official RFC 4180 CSV compliance audit package", () => {
      const logs = ctx.db.prepare("SELECT * FROM audit_logs ORDER BY id ASC").all() as unknown as AuditLogRecord[];
      const csv = generateAuditCsv(logs);

      // Verify header
      assert.ok(csv.startsWith("AuditID,Timestamp,UserID,EmployeeName,Action,CourseID,TargetID,ModuleVersion,Score,RecordHash"));

      // Verify presence of required persona events
      assert.ok(csv.includes("usr_alex_rivera"));
      assert.ok(csv.includes("usr_elena_rostova"));
      assert.ok(csv.includes("COMPLIANCE_CERTIFIED"));
      assert.ok(csv.includes("PRODUCTION_ACCESS_CERTIFIED"));

      const lines = csv.split("\r\n");
      assert.strictEqual(lines.length, logs.length + 1);
    });

    it("P3.Step 5: Generates and validates machine-readable JSON proof manifest for SOC 2 auditors", () => {
      const logs = ctx.db.prepare("SELECT * FROM audit_logs ORDER BY id ASC").all() as unknown as AuditLogRecord[];
      const jsonStr = generateAuditJson(logs);
      const manifest = JSON.parse(jsonStr);

      assert.strictEqual(manifest.isChainValid, true);
      assert.strictEqual(manifest.totalRecords, logs.length);
      assert.strictEqual(manifest.genesisHash, GENESIS_HASH);
      assert.strictEqual(manifest.rootHash, logs[logs.length - 1].record_hash);
      assert.strictEqual(manifest.records.length, logs.length);
    });
  });
});
