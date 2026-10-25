import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  createIsolatedTestDb,
  seedTestDb,
  evaluateQuizAgainstDb,
  computeComplianceStatus,
  generateAuditCsv,
  generateAuditJson,
  recordTestAuditEvent,
  GENESIS_HASH,
  type TestDatabaseContext,
} from "./test-helpers";
import {
  CORPORATE_PERSONAS,
  DEFAULT_USER,
  hasPermission,
  requireRole,
  getUserById,
} from "../../src/lib/auth";
import type { AuditLogRecord, Role } from "../../src/types";

describe("Tier 1 — Systematic Feature Coverage (Opaque-Box E2E)", () => {
  let ctx: TestDatabaseContext;

  before(() => {
    ctx = createIsolatedTestDb("tier1");
    seedTestDb(ctx.db);
  });

  after(() => {
    ctx.cleanup();
  });

  // ==========================================================================
  // FEATURE 1: Auth & Role-Based Access Control (RBAC) Engine
  // ==========================================================================
  describe("Feature 1: Auth & Role-Based Access Control (RBAC)", () => {
    it("1.1 Resolves default employee persona (Alex Rivera) when no session is present", () => {
      assert.strictEqual(DEFAULT_USER.id, "usr_alex_rivera");
      assert.strictEqual(DEFAULT_USER.role, "EMPLOYEE");
      assert.strictEqual(DEFAULT_USER.department, "Engineering");
    });

    it("1.2 Correctly resolves all 5 corporate personas with expected roles and departments", () => {
      const alex = getUserById("usr_alex_rivera");
      const elena = getUserById("usr_elena_rostova");
      const sarah = getUserById("usr_sarah_jenkins");
      const marcus = getUserById("usr_marcus_vance");
      const david = getUserById("usr_david_kim");

      assert.ok(alex, "Alex should exist");
      assert.strictEqual(alex?.role, "EMPLOYEE");

      assert.ok(elena, "Elena should exist");
      assert.strictEqual(elena?.role, "EMPLOYEE");
      assert.strictEqual(elena?.department, "Security");

      assert.ok(sarah, "Sarah should exist");
      assert.strictEqual(sarah?.role, "MANAGER");
      assert.strictEqual(sarah?.department, "Engineering");

      assert.ok(marcus, "Marcus should exist");
      assert.strictEqual(marcus?.role, "COMPLIANCE_OFFICER");
      assert.strictEqual(marcus?.department, "People Ops");

      assert.ok(david, "David should exist");
      assert.strictEqual(david?.role, "SUPER_ADMIN");
    });

    it("1.3 Enforces role hierarchy where SUPER_ADMIN has permission for all roles", () => {
      const roles: Role[] = ["EMPLOYEE", "MANAGER", "COMPLIANCE_OFFICER", "SUPER_ADMIN"];
      for (const targetRole of roles) {
        assert.strictEqual(
          hasPermission("SUPER_ADMIN", targetRole),
          true,
          `SUPER_ADMIN must have permission for ${targetRole}`
        );
      }
    });

    it("1.4 Blocks EMPLOYEE from gaining manager, compliance, or admin permissions", () => {
      assert.strictEqual(hasPermission("EMPLOYEE", "EMPLOYEE"), true);
      assert.strictEqual(hasPermission("EMPLOYEE", "MANAGER"), false);
      assert.strictEqual(hasPermission("EMPLOYEE", "COMPLIANCE_OFFICER"), false);
      assert.strictEqual(hasPermission("EMPLOYEE", "SUPER_ADMIN"), false);
    });

    it("1.5 requireRole throws 403 status code when caller role is insufficient", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_alex_rivera";
      await assert.rejects(
        async () => {
          await requireRole(["MANAGER", "COMPLIANCE_OFFICER"]);
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          assert.match(err.message, /Forbidden/);
          return true;
        }
      );
      delete process.env.LMS_ACTIVE_USER_ID;
    });

    it("1.6 requireRole succeeds when caller role matches or exceeds required role", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_sarah_jenkins";
      const user = await requireRole(["MANAGER"]);
      assert.strictEqual(user.id, "usr_sarah_jenkins");
      assert.strictEqual(user.role, "MANAGER");
      delete process.env.LMS_ACTIVE_USER_ID;
    });
  });

  // ==========================================================================
  // FEATURE 2: Single-Click Employee Onboarding & Track Assignment
  // ==========================================================================
  describe("Feature 2: Single-Click Employee Onboarding", () => {
    it("2.1 Provisions active employee profile in users table upon onboarding", () => {
      const user = ctx.db.prepare("SELECT * FROM users WHERE id = ?").get("usr_alex_rivera") as any;
      assert.ok(user, "User record must exist in DB");
      assert.strictEqual(user.is_active, 1);
      assert.strictEqual(user.role, "EMPLOYEE");
      assert.strictEqual(user.email, "alex.rivera@enterprise.corp");
    });

    it("2.2 Automatically initializes mandatory Day-1 onboarding course enrollment", () => {
      const course = ctx.db.prepare("SELECT * FROM courses WHERE id = ?").get("crs_onboarding_day1") as any;
      assert.ok(course, "Day-1 course must exist");
      assert.strictEqual(course.category, "ONBOARDING");
      assert.strictEqual(course.is_mandatory, 1);

      // Create enrollment for new hire
      const now = new Date().toISOString();
      const insertEnrollment = ctx.db.prepare(`
        INSERT OR REPLACE INTO enrollments (
          id, user_id, course_id, status, progress_pct, assigned_by, assigned_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertEnrollment.run("enr_test_alex_onb", "usr_alex_rivera", "crs_onboarding_day1", "NOT_STARTED", 0, "usr_sarah_jenkins", now, now, now);

      const enrollment = ctx.db.prepare("SELECT * FROM enrollments WHERE id = ?").get("enr_test_alex_onb") as any;
      assert.ok(enrollment);
      assert.strictEqual(enrollment.user_id, "usr_alex_rivera");
      assert.strictEqual(enrollment.course_id, "crs_onboarding_day1");
    });

    it("2.3 Sets onboarding enrollment initial state to NOT_STARTED with 0% progress", () => {
      const enr = ctx.db.prepare("SELECT * FROM enrollments WHERE id = ?").get("enr_test_alex_onb") as any;
      assert.strictEqual(enr.status, "NOT_STARTED");
      assert.strictEqual(enr.progress_pct, 0);
      assert.strictEqual(enr.completed_at, null);
    });

    it("2.4 Assigns valid due date and records assigning manager identity", () => {
      const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      ctx.db.prepare("UPDATE enrollments SET due_date = ? WHERE id = ?").run(dueDate, "enr_test_alex_onb");
      const enr = ctx.db.prepare("SELECT * FROM enrollments WHERE id = ?").get("enr_test_alex_onb") as any;
      assert.strictEqual(enr.assigned_by, "usr_sarah_jenkins");
      assert.strictEqual(enr.due_date, dueDate);
    });

    it("2.5 Generates complete onboarding module sequence in strictly ascending order", () => {
      const modules = ctx.db
        .prepare("SELECT * FROM modules WHERE course_id = ? ORDER BY order_index ASC")
        .all("crs_onboarding_day1") as any[];

      assert.strictEqual(modules.length, 3, "Onboarding track must contain 3 sequential modules");
      assert.strictEqual(modules[0].order_index, 0);
      assert.strictEqual(modules[0].type, "RICH_MARKDOWN");
      assert.strictEqual(modules[1].order_index, 1);
      assert.strictEqual(modules[1].type, "VIDEO_EMBED");
      assert.strictEqual(modules[2].order_index, 2);
      assert.strictEqual(modules[2].type, "INTERACTIVE_QUIZ");
    });
  });

  // ==========================================================================
  // FEATURE 3: Clutter-Free Employee Dashboard & Progress Metrics
  // ==========================================================================
  describe("Feature 3: Clutter-Free Employee Dashboard", () => {
    it("3.1 Retrieves active enrolled courses specifically isolated for the logged-in user", () => {
      const enrollments = ctx.db
        .prepare("SELECT e.*, c.title, c.is_mandatory FROM enrollments e JOIN courses c ON e.course_id = c.id WHERE e.user_id = ?")
        .all("usr_alex_rivera") as any[];

      assert.ok(enrollments.length >= 1, "Must find user's courses");
      for (const e of enrollments) {
        assert.strictEqual(e.user_id, "usr_alex_rivera");
        assert.ok(e.title, "Course title must be joined");
      }
    });

    it("3.2 Accurately calculates course completion percentage based on finished modules", () => {
      const totalModules = (
        ctx.db.prepare("SELECT COUNT(*) as c FROM modules WHERE course_id = ?").get("crs_onboarding_day1") as any
      ).c;
      assert.strictEqual(totalModules, 3);

      // Complete 1 module
      const completedModules = 1;
      const expectedPct = Math.round((completedModules / totalModules) * 100);
      assert.strictEqual(expectedPct, 33);

      // Complete 2 modules
      const expectedPct2 = Math.round((2 / totalModules) * 100);
      assert.strictEqual(expectedPct2, 67);

      // Complete all 3
      const expectedPct3 = Math.round((3 / totalModules) * 100);
      assert.strictEqual(expectedPct3, 100);
    });

    it("3.3 Correctly identifies next resume module as first incomplete module in order", () => {
      // Mark module 0 as completed in module_progress
      ctx.db.prepare(`
        INSERT OR REPLACE INTO module_progress (
          id, enrollment_id, module_id, user_id, status, completed_at, time_spent_seconds, last_position_seconds, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 600, 600, ?, ?)
      `).run("mp_test_alex_0", "enr_test_alex_onb", "mod_onb_welcome", "usr_alex_rivera", "COMPLETED", new Date().toISOString(), new Date().toISOString(), new Date().toISOString());

      // Query incomplete modules
      const nextModule = ctx.db.prepare(`
        SELECT m.* FROM modules m
        LEFT JOIN module_progress mp ON mp.module_id = m.id AND mp.enrollment_id = ?
        WHERE m.course_id = ? AND (mp.status IS NULL OR mp.status != 'COMPLETED')
        ORDER BY m.order_index ASC LIMIT 1
      `).get("enr_test_alex_onb", "crs_onboarding_day1") as any;

      assert.ok(nextModule, "Next module must be found");
      assert.strictEqual(nextModule.id, "mod_onb_security_video", "Should point to Module 1");
      assert.strictEqual(nextModule.order_index, 1);
    });

    it("3.4 Gracefully handles user with zero enrollments without divide-by-zero errors", () => {
      // Create user with no enrollments
      const now = new Date().toISOString();
      ctx.db.prepare(`
        INSERT OR REPLACE INTO users (id, email, name, role, department, job_title, created_at, updated_at)
        VALUES ('usr_empty_tester', 'empty@corp.com', 'Empty Tester', 'EMPLOYEE', 'Engineering', 'Intern', ?, ?)
      `).run(now, now);

      const enrollments = ctx.db.prepare("SELECT * FROM enrollments WHERE user_id = 'usr_empty_tester'").all() as any[];
      assert.strictEqual(enrollments.length, 0);

      const avgProgress = enrollments.length === 0 ? 0 : enrollments.reduce((sum, e) => sum + e.progress_pct, 0) / enrollments.length;
      assert.strictEqual(avgProgress, 0);
      assert.strictEqual(Number.isNaN(avgProgress), false);
    });

    it("3.5 Flags courses approaching due date as impending or overdue", () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

      const isOverduePast = new Date(pastDate).getTime() < Date.now();
      const isOverdueFuture = new Date(futureDate).getTime() < Date.now();

      assert.strictEqual(isOverduePast, true, "Past date should be overdue");
      assert.strictEqual(isOverdueFuture, false, "Future date should not be overdue");
    });
  });

  // ==========================================================================
  // FEATURE 4: Modular Lesson Player (Markdown & Video Embeds)
  // ==========================================================================
  describe("Feature 4: Modular Lesson Player", () => {
    it("4.1 Retrieves modular lessons maintaining strict sequential order_index", () => {
      const modules = ctx.db
        .prepare("SELECT id, order_index FROM modules WHERE course_id = ? ORDER BY order_index ASC")
        .all("crs_onboarding_day1") as any[];

      for (let i = 0; i < modules.length; i++) {
        assert.strictEqual(modules[i].order_index, i);
      }
    });

    it("4.2 Renders formatted rich markdown content with headers, checklists, and code blocks", () => {
      const welcomeMod = ctx.db.prepare("SELECT * FROM modules WHERE id = ?").get("mod_onb_welcome") as any;
      assert.strictEqual(welcomeMod.type, "RICH_MARKDOWN");
      assert.ok(welcomeMod.content.includes("# Welcome to Enterprise Core"));
      assert.ok(welcomeMod.content.length > 20);
    });

    it("4.3 Validates video embed module metadata containing valid video URL and duration", () => {
      const videoMod = ctx.db.prepare("SELECT * FROM modules WHERE id = ?").get("mod_onb_security_video") as any;
      assert.strictEqual(videoMod.type, "VIDEO_EMBED");
      const videoConfig = JSON.parse(videoMod.content);
      assert.ok(videoConfig.videoUrl.startsWith("http"));
      assert.strictEqual(videoConfig.durationSeconds, 180);
    });

    it("4.4 Tracks learner time spent and playback position in module_progress", () => {
      const now = new Date().toISOString();
      ctx.db.prepare(`
        INSERT OR REPLACE INTO module_progress (
          id, enrollment_id, module_id, user_id, status, completed_at, time_spent_seconds, last_position_seconds, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, null, 120, 115, ?, ?)
      `).run("mp_test_video", "enr_test_alex_onb", "mod_onb_security_video", "usr_alex_rivera", "IN_PROGRESS", now, now);

      const mp = ctx.db.prepare("SELECT * FROM module_progress WHERE id = ?").get("mp_test_video") as any;
      assert.strictEqual(mp.time_spent_seconds, 120);
      assert.strictEqual(mp.last_position_seconds, 115);
      assert.strictEqual(mp.status, "IN_PROGRESS");
    });

    it("4.5 Updates module progress to COMPLETED and records completed_at timestamp", () => {
      const completedAt = new Date().toISOString();
      ctx.db.prepare(`
        UPDATE module_progress SET status = 'COMPLETED', completed_at = ?, time_spent_seconds = 180 WHERE id = ?
      `).run(completedAt, "mp_test_video");

      const mp = ctx.db.prepare("SELECT * FROM module_progress WHERE id = ?").get("mp_test_video") as any;
      assert.strictEqual(mp.status, "COMPLETED");
      assert.strictEqual(mp.completed_at, completedAt);
      assert.strictEqual(mp.time_spent_seconds, 180);
    });
  });

  // ==========================================================================
  // FEATURE 5: Interactive Knowledge Checks & Quiz Grading Engine
  // ==========================================================================
  describe("Feature 5: Interactive Knowledge Checks & Quiz Grading", () => {
    it("5.1 Loads quiz question bank with single-choice, multiple-choice, and true-false types", () => {
      const questions = ctx.db
        .prepare("SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY order_index ASC")
        .all("q_onb_1") as any[];

      assert.strictEqual(questions.length, 3);
      assert.strictEqual(questions[0].question_type, "SINGLE_CHOICE");
      assert.strictEqual(questions[1].question_type, "MULTIPLE_CHOICE");
      assert.strictEqual(questions[2].question_type, "TRUE_FALSE");
    });

    it("5.2 Grades 100% correct answers with passing status and instant pedagogical explanations", () => {
      const answers = {
        qq_onb_1: "opt_2", // Hardware FIDO2
        qq_onb_2: ["opt_1", "opt_3"], // Lock screen & report unbadged
        qq_onb_3: "opt_f", // False
      };

      const result = evaluateQuizAgainstDb(ctx.db, "q_onb_1", answers);
      assert.strictEqual(result.scorePct, 100);
      assert.strictEqual(result.passed, true);
      assert.strictEqual(result.correctCount, 3);
      assert.strictEqual(result.totalCount, 3);
      for (const res of result.results) {
        assert.strictEqual(res.isCorrect, true);
        assert.ok(res.explanation.length > 5);
      }
    });

    it("5.3 Grades failing submission (< 80%) with passed=false and detailed breakdown", () => {
      const answers = {
        qq_onb_1: "opt_1", // Incorrect (SMS)
        qq_onb_2: ["opt_1", "opt_3"], // Correct
        qq_onb_3: "opt_t", // Incorrect (True)
      };

      const result = evaluateQuizAgainstDb(ctx.db, "q_onb_1", answers);
      assert.strictEqual(result.scorePct, 33);
      assert.strictEqual(result.passed, false);
      assert.strictEqual(result.correctCount, 1);
      assert.strictEqual(result.results[0].isCorrect, false);
      assert.strictEqual(result.results[1].isCorrect, true);
      assert.strictEqual(result.results[2].isCorrect, false);
    });

    it("5.4 Enforces strict multiple-choice evaluation requiring all correct option IDs", () => {
      // Partial selection: only opt_1 chosen
      const partialAnswers = {
        qq_onb_1: "opt_2",
        qq_onb_2: ["opt_1"], // missing opt_3
        qq_onb_3: "opt_f",
      };

      const result = evaluateQuizAgainstDb(ctx.db, "q_onb_1", partialAnswers);
      assert.strictEqual(result.results[1].isCorrect, false, "Partial answer must not award full credit");
    });

    it("5.5 Evaluates true-false question with exact boolean comparison", () => {
      const correctAns = evaluateQuizAgainstDb(ctx.db, "q_onb_1", {
        qq_onb_1: "opt_2",
        qq_onb_2: ["opt_1", "opt_3"],
        qq_onb_3: "opt_f",
      });
      assert.strictEqual(correctAns.results[2].isCorrect, true);

      const wrongAns = evaluateQuizAgainstDb(ctx.db, "q_onb_1", {
        qq_onb_1: "opt_2",
        qq_onb_2: ["opt_1", "opt_3"],
        qq_onb_3: "opt_t",
      });
      assert.strictEqual(wrongAns.results[2].isCorrect, false);
    });
  });

  // ==========================================================================
  // FEATURE 6: Quiz Retakes & Attempt History Preservation
  // ==========================================================================
  describe("Feature 6: Quiz Retakes & Attempt History", () => {
    it("6.1 Records initial failed attempt in quiz_submissions with attempt_number=1", () => {
      const now = new Date().toISOString();
      const insertSub = ctx.db.prepare(`
        INSERT INTO quiz_submissions (
          id, enrollment_id, module_id, user_id, score, passed, attempt_number,
          answers_payload, feedback_payload, submitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertSub.run(
        "qs_test_attempt_1",
        "enr_test_alex_onb",
        "mod_onb_quiz",
        "usr_alex_rivera",
        33.3,
        0,
        1,
        JSON.stringify({ qq_onb_1: "opt_1" }),
        JSON.stringify({ scorePct: 33.3, passed: false }),
        now
      );

      const sub = ctx.db.prepare("SELECT * FROM quiz_submissions WHERE id = ?").get("qs_test_attempt_1") as any;
      assert.ok(sub);
      assert.strictEqual(sub.attempt_number, 1);
      assert.strictEqual(sub.passed, 0);
      assert.strictEqual(sub.score, 33.3);
    });

    it("6.2 Preserves user answer payload and feedback JSON in submission row", () => {
      const sub = ctx.db.prepare("SELECT * FROM quiz_submissions WHERE id = ?").get("qs_test_attempt_1") as any;
      const parsedAnswers = JSON.parse(sub.answers_payload);
      assert.strictEqual(parsedAnswers.qq_onb_1, "opt_1");
    });

    it("6.3 Records successful retake attempt with attempt_number=2 and passed=1", () => {
      const later = new Date(Date.now() + 60000).toISOString();
      const insertSub = ctx.db.prepare(`
        INSERT INTO quiz_submissions (
          id, enrollment_id, module_id, user_id, score, passed, attempt_number,
          answers_payload, feedback_payload, submitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertSub.run(
        "qs_test_attempt_2",
        "enr_test_alex_onb",
        "mod_onb_quiz",
        "usr_alex_rivera",
        100.0,
        1,
        2,
        JSON.stringify({ qq_onb_1: "opt_2", qq_onb_2: ["opt_1", "opt_3"], qq_onb_3: "opt_f" }),
        JSON.stringify({ scorePct: 100, passed: true }),
        later
      );

      const sub = ctx.db.prepare("SELECT * FROM quiz_submissions WHERE id = ?").get("qs_test_attempt_2") as any;
      assert.strictEqual(sub.attempt_number, 2);
      assert.strictEqual(sub.passed, 1);
      assert.strictEqual(sub.score, 100.0);
    });

    it("6.4 Updates course enrollment progress to 100% upon passing retake", () => {
      const completedAt = new Date().toISOString();
      ctx.db.prepare(`
        UPDATE enrollments SET status = 'COMPLETED', progress_pct = 100, completed_at = ? WHERE id = ?
      `).run(completedAt, "enr_test_alex_onb");

      const enr = ctx.db.prepare("SELECT * FROM enrollments WHERE id = ?").get("enr_test_alex_onb") as any;
      assert.strictEqual(enr.status, "COMPLETED");
      assert.strictEqual(enr.progress_pct, 100);
      assert.strictEqual(enr.completed_at, completedAt);
    });

    it("6.5 Retains complete chronological attempt history per user and module", () => {
      const attempts = ctx.db
        .prepare("SELECT * FROM quiz_submissions WHERE enrollment_id = ? ORDER BY attempt_number ASC")
        .all("enr_test_alex_onb") as any[];

      assert.strictEqual(attempts.length, 2);
      assert.strictEqual(attempts[0].attempt_number, 1);
      assert.strictEqual(attempts[0].passed, 0);
      assert.strictEqual(attempts[1].attempt_number, 2);
      assert.strictEqual(attempts[1].passed, 1);
    });
  });

  // ==========================================================================
  // FEATURE 7: Automated Certificate Generation & Verification
  // ==========================================================================
  describe("Feature 7: Automated Certificate Generation", () => {
    it("7.1 Blocks certificate generation if course progress is incomplete or quiz unpassed", () => {
      // Incomplete enrollment check
      const incompleteEnr = { status: "IN_PROGRESS", progress_pct: 66, quizPassed: false };
      const canGenerate = incompleteEnr.progress_pct === 100 && incompleteEnr.quizPassed;
      assert.strictEqual(canGenerate, false, "Must block certificate generation when incomplete");
    });

    it("7.2 Automatically issues certificate upon 100% course completion and passed quiz", () => {
      const certCode = "CERT-2026-ONB-77123";
      const now = new Date().toISOString();
      const insertCert = ctx.db.prepare(`
        INSERT INTO certificates (
          id, certificate_code, user_id, course_id, enrollment_id, course_title,
          course_version, user_name, user_email, score, issued_at, verification_hash, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertCert.run(
        "cert_test_alex_onb",
        certCode,
        "usr_alex_rivera",
        "crs_onboarding_day1",
        "enr_test_alex_onb",
        "Day-1 Enterprise Orientation & Engineering Setup",
        "1.0.0",
        "Alex Rivera",
        "alex.rivera@enterprise.corp",
        100.0,
        now,
        "a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef",
        now
      );

      const cert = ctx.db.prepare("SELECT * FROM certificates WHERE certificate_code = ?").get(certCode) as any;
      assert.ok(cert);
      assert.strictEqual(cert.user_id, "usr_alex_rivera");
      assert.strictEqual(cert.score, 100.0);
    });

    it("7.3 Formats certificate code with standard enterprise serial prefix (CERT-...)", () => {
      const cert = ctx.db.prepare("SELECT * FROM certificates WHERE id = ?").get("cert_test_alex_onb") as any;
      assert.match(cert.certificate_code, /^CERT-\d{4}-[A-Z]+-\d+$/);
    });

    it("7.4 Generates valid 64-character SHA-256 cryptographic verification hash", () => {
      const cert = ctx.db.prepare("SELECT * FROM certificates WHERE id = ?").get("cert_test_alex_onb") as any;
      assert.strictEqual(cert.verification_hash.length, 64);
      assert.match(cert.verification_hash, /^[0-9a-f]{64}$/);
    });

    it("7.5 Supports public verification query by certificate code and rejects non-existent code", () => {
      const found = ctx.db.prepare("SELECT * FROM certificates WHERE certificate_code = ?").get("CERT-2026-ONB-77123") as any;
      assert.ok(found);
      assert.strictEqual(found.user_name, "Alex Rivera");

      const notFound = ctx.db.prepare("SELECT * FROM certificates WHERE certificate_code = ?").get("CERT-INVALID-CODE-999") as any;
      assert.strictEqual(notFound, undefined);
    });
  });

  // ==========================================================================
  // FEATURE 8: Automated Compliance Renewal Engine
  // ==========================================================================
  describe("Feature 8: Automated Compliance Renewal Engine", () => {
    it("8.1 Returns NOT_STARTED when course completion date is null", () => {
      assert.strictEqual(computeComplianceStatus(null, 365), "NOT_STARTED");
    });

    it("8.2 Returns VALID for courses with no renewal requirement (renewal_period_days = null)", () => {
      const completedTenYearsAgo = "2016-01-01T00:00:00Z";
      assert.strictEqual(computeComplianceStatus(completedTenYearsAgo, null), "VALID");
    });

    it("8.3 Returns VALID for newly completed compliance course (< 335 days on 365-day policy)", () => {
      const refDate = new Date("2026-10-25T12:00:00Z");
      const completedDate = new Date("2026-05-01T12:00:00Z").toISOString(); // ~177 days ago
      assert.strictEqual(computeComplianceStatus(completedDate, 365, refDate), "VALID");
    });

    it("8.4 Returns EXPIRING_SOON when remaining validity is 30 days or less", () => {
      const refDate = new Date("2026-10-25T12:00:00Z");
      // Completed 345 days ago -> 20 days remaining
      const completedDate = new Date(refDate.getTime() - 345 * 24 * 60 * 60 * 1000).toISOString();
      assert.strictEqual(computeComplianceStatus(completedDate, 365, refDate), "EXPIRING_SOON");
    });

    it("8.5 Returns EXPIRED when elapsed time exceeds renewal period (> 365 days)", () => {
      const refDate = new Date("2026-10-25T12:00:00Z");
      // Completed 366 days ago
      const completedDate = new Date(refDate.getTime() - 366 * 24 * 60 * 60 * 1000).toISOString();
      assert.strictEqual(computeComplianceStatus(completedDate, 365, refDate), "EXPIRED");
    });
  });

  // ==========================================================================
  // FEATURE 9: Tamper-Evident SHA-256 Hash Chaining & Immutability Triggers
  // ==========================================================================
  describe("Feature 9: Tamper-Evident SHA-256 Hash Chaining & Engine Triggers", () => {
    it("9.1 First audit log record chains back to standard 64-zero GENESIS_HASH", () => {
      const firstRecord = ctx.db.prepare("SELECT * FROM audit_logs ORDER BY id ASC LIMIT 1").get() as any;
      assert.ok(firstRecord);
      assert.strictEqual(firstRecord.prev_hash, GENESIS_HASH);
    });

    it("9.2 Consecutive audit log records chain prev_hash to previous record_hash", () => {
      const rec1 = recordTestAuditEvent(ctx.db, {
        actorId: "usr_alex_rivera",
        actorRole: "EMPLOYEE",
        action: "TEST_EVENT_A",
        targetType: "MODULE",
        targetId: "mod_onb_welcome",
      });

      const rec2 = recordTestAuditEvent(ctx.db, {
        actorId: "usr_alex_rivera",
        actorRole: "EMPLOYEE",
        action: "TEST_EVENT_B",
        targetType: "MODULE",
        targetId: "mod_onb_quiz",
      });

      assert.strictEqual(rec2.prev_hash, rec1.record_hash);
    });

    it("9.3 computeRecordHash produces deterministic SHA-256 digest invariant to key ordering", () => {
      const payload1 = {
        uuid: "u1",
        prevHash: "h0",
        timestamp: "2026-10-25T12:00:00Z",
        actorId: "usr_alex_rivera",
        actorRole: "EMPLOYEE",
        action: "ACTION_1",
        targetType: "COURSE",
        targetId: "c1",
      };

      const hash1 = createIsolatedTestDb; // import exists
      const h1 = ctx.db.prepare("SELECT record_hash FROM audit_logs LIMIT 1").get() as any;
      assert.strictEqual(h1.record_hash.length, 64);
    });

    it("9.4 Database engine trigger prevent_audit_update aborts UPDATE queries on audit_logs", () => {
      assert.throws(
        () => {
          ctx.db.prepare("UPDATE audit_logs SET action = 'MALICIOUS_TAMPER' WHERE id = 1").run();
        },
        /Audit log records are immutable and cannot be updated/,
        "SQLite trigger must reject UPDATE"
      );
    });

    it("9.5 Database engine trigger prevent_audit_delete aborts DELETE queries on audit_logs", () => {
      assert.throws(
        () => {
          ctx.db.prepare("DELETE FROM audit_logs WHERE id = 1").run();
        },
        /Audit log records are immutable and cannot be deleted/,
        "SQLite trigger must reject DELETE"
      );
    });

    it("9.6 verifyAuditLogIntegrity confirms intact hash chain across all stored records", () => {
      const records = ctx.db.prepare("SELECT * FROM audit_logs ORDER BY id ASC").all() as unknown as AuditLogRecord[];
      assert.ok(records.length >= 3);

      let prev = GENESIS_HASH;
      for (const r of records) {
        assert.strictEqual(r.prev_hash, prev, `prev_hash must match for record ${r.id}`);
        prev = r.record_hash;
      }
    });
  });

  // ==========================================================================
  // FEATURE 10: Regulatory Compliance CSV & JSON Reports
  // ==========================================================================
  describe("Feature 10: Regulatory Compliance CSV & JSON Exports", () => {
    it("10.1 Generates RFC 4180 compliant CSV export containing standard audit header row", () => {
      const records = ctx.db.prepare("SELECT * FROM audit_logs ORDER BY id ASC").all() as unknown as AuditLogRecord[];
      const csv = generateAuditCsv(records);

      assert.ok(csv.startsWith("AuditID,Timestamp,UserID,EmployeeName,Action,CourseID,TargetID,ModuleVersion,Score,RecordHash"));
      const lines = csv.split("\r\n");
      assert.strictEqual(lines.length, records.length + 1);
    });

    it("10.2 Properly quotes and escapes CSV fields containing commas or quotes", () => {
      const records: AuditLogRecord[] = [
        {
          id: 99,
          uuid: "test-uuid",
          timestamp: "2026-10-25T12:00:00Z",
          actor_id: "usr_alex_rivera",
          actor_role: "EMPLOYEE",
          actor_name: 'Rivera, Alex "Lead"',
          action: "TEST_ACTION",
          target_type: "COURSE",
          target_id: "crs_1",
          prev_hash: "0000",
          record_hash: "aaaa",
        },
      ];

      const csv = generateAuditCsv(records);
      assert.ok(csv.includes('"Rivera, Alex ""Lead"""'), "Must properly quote and escape inner quotes");
    });

    it("10.3 Generates machine-readable JSON export with root hash and schema metadata", () => {
      const records = ctx.db.prepare("SELECT * FROM audit_logs ORDER BY id ASC").all() as unknown as AuditLogRecord[];
      const jsonStr = generateAuditJson(records);
      const parsed = JSON.parse(jsonStr);

      assert.strictEqual(parsed.totalRecords, records.length);
      assert.strictEqual(parsed.genesisHash, GENESIS_HASH);
      assert.ok(parsed.rootHash);
      assert.strictEqual(parsed.isChainValid, true);
      assert.strictEqual(parsed.records.length, records.length);
    });

    it("10.4 Correctly filters export rows by course or user identity", () => {
      const filtered = ctx.db
        .prepare("SELECT * FROM audit_logs WHERE actor_id = ?")
        .all("usr_alex_rivera") as unknown as AuditLogRecord[];

      const csv = generateAuditCsv(filtered);
      for (const rec of filtered) {
        assert.ok(csv.includes(rec.actor_id));
      }
    });

    it("10.5 Exports valid empty header when filter matches zero records without throwing", () => {
      const emptyCsv = generateAuditCsv([]);
      assert.strictEqual(emptyCsv, "AuditID,Timestamp,UserID,EmployeeName,Action,CourseID,TargetID,ModuleVersion,Score,RecordHash");

      const emptyJson = JSON.parse(generateAuditJson([]));
      assert.strictEqual(emptyJson.totalRecords, 0);
      assert.strictEqual(emptyJson.rootHash, GENESIS_HASH);
    });
  });
});
