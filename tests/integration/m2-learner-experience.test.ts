import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { getDb, initDb, seedDb } from "../../src/lib/db";
import { evaluateQuiz, getQuizForModule, submitQuizAttempt } from "../../src/lib/quiz";
import { generateCertificate, verifyCertificate, getCertificateByIdOrCode } from "../../src/lib/certificates";
import { GET as getCoursesRoute, POST as postCoursesRoute } from "../../src/app/api/courses/route";
import { GET as getCourseDetailRoute, POST as enrollCourseRoute } from "../../src/app/api/courses/[courseId]/route";
import { GET as getModuleRoute } from "../../src/app/api/modules/[moduleId]/route";
import { POST as completeModuleRoute } from "../../src/app/api/modules/[moduleId]/complete/route";
import { POST as submitQuizRoute } from "../../src/app/api/quizzes/[quizId]/submit/route";
import { GET as getCertificateRoute } from "../../src/app/api/certificates/[certId]/route";

describe("Milestone M2 — Learner Experience, Modular Player, Quiz Engine & Certificates", () => {
  before(() => {
    initDb();
    seedDb();
  });

  // =========================================================================
  // 1. Quiz Engine Evaluation Tests
  // =========================================================================
  describe("1. Quiz Engine Evaluation (Server-side Grading)", () => {
    it("1.1 Sanitized quiz questions do not expose correct_answers or explanation", () => {
      const sanitized = getQuizForModule("mod_onb_quiz");
      assert.ok(sanitized, "Sanitized quiz should be returned");
      assert.strictEqual(sanitized?.passing_score_pct, 80);
      assert.ok(sanitized?.questions.length! >= 3);

      for (const q of sanitized!.questions) {
        assert.strictEqual((q as any).correct_answers, undefined, "Must not leak correct_answers");
        assert.strictEqual((q as any).explanation, undefined, "Must not leak explanation");
        assert.ok(q.prompt.length > 0);
        assert.ok(q.options.length > 0);
      }
    });

    it("1.2 Evaluates perfect answers to 100% and passed=true", () => {
      const answers = {
        qq_onb_1: "opt_2", // Hardware FIDO2
        qq_onb_2: ["opt_1", "opt_3"], // Lock workstation & report unbadged
        qq_onb_3: "opt_f", // False
      };

      const result = evaluateQuiz("q_onb_1", answers);
      assert.strictEqual(result.scorePct, 100);
      assert.strictEqual(result.passed, true);
      assert.strictEqual(result.correctCount, 3);
      assert.strictEqual(result.totalCount, 3);
      assert.strictEqual(result.results.every((r) => r.isCorrect), true);
    });

    it("1.3 Evaluates partial answers strictly and fails below 80%", () => {
      const answers = {
        qq_onb_1: "opt_1", // Incorrect (SMS text)
        qq_onb_2: ["opt_1"], // Incomplete multiple-choice (missing opt_3)
        qq_onb_3: "opt_f", // Correct
      };

      const result = evaluateQuiz("q_onb_1", answers);
      assert.strictEqual(result.correctCount, 1);
      assert.strictEqual(result.scorePct, 33);
      assert.strictEqual(result.passed, false);
      assert.strictEqual(result.results[0].isCorrect, false);
      assert.strictEqual(result.results[1].isCorrect, false);
      assert.strictEqual(result.results[2].isCorrect, true);
    });

    it("1.4 Throws descriptive error for non-existent quiz ID", () => {
      assert.throws(
        () => evaluateQuiz("q_non_existent_id", {}),
        /Quiz 'q_non_existent_id' not found in database/
      );
    });
  });

  // =========================================================================
  // 2. Quiz Submission & Progress Flow Tests
  // =========================================================================
  describe("2. Quiz Submissions, Retake Tracking & Progress Chain", () => {
    it("2.1 Records failed attempt, increments attempt_number, and keeps module incomplete", () => {
      const result = submitQuizAttempt({
        userId: "usr_alex_rivera",
        quizId: "q_onb_1",
        answers: { qq_onb_1: "opt_1", qq_onb_2: ["opt_1"], qq_onb_3: "opt_t" },
      });

      assert.strictEqual(result.passed, false);
      assert.strictEqual(result.scorePct, 0);
      assert.ok(result.attemptNumber >= 1);
      assert.strictEqual(result.certificate, null);

      // Verify DB record
      const db = getDb();
      const sub = db.prepare("SELECT * FROM quiz_submissions WHERE id = ?").get(result.submissionId) as any;
      assert.ok(sub);
      assert.strictEqual(sub.passed, 0);
      assert.strictEqual(sub.score, 0);
    });

    it("2.2 Passing retake records attempt_number, completes module, and awards certificate upon 100% course completion", () => {
      const db = getDb();

      // Ensure modules 0 and 1 are marked completed for Alex Rivera
      const now = new Date().toISOString();
      const enr = db.prepare("SELECT id FROM enrollments WHERE user_id = 'usr_alex_rivera' AND course_id = 'crs_onboarding_day1'").get() as any;
      assert.ok(enr, "Alex must be enrolled");

      db.prepare(`
        INSERT OR REPLACE INTO module_progress (id, enrollment_id, module_id, user_id, status, completed_at, time_spent_seconds, last_position_seconds, created_at, updated_at)
        VALUES ('mp_test_onb_0', ?, 'mod_onb_welcome', 'usr_alex_rivera', 'COMPLETED', ?, 600, 600, ?, ?)
      `).run(enr.id, now, now, now);

      db.prepare(`
        INSERT OR REPLACE INTO module_progress (id, enrollment_id, module_id, user_id, status, completed_at, time_spent_seconds, last_position_seconds, created_at, updated_at)
        VALUES ('mp_test_onb_1', ?, 'mod_onb_security_video', 'usr_alex_rivera', 'COMPLETED', ?, 180, 180, ?, ?)
      `).run(enr.id, now, now, now);

      // Now pass the quiz (Module 2)
      const result = submitQuizAttempt({
        userId: "usr_alex_rivera",
        quizId: "q_onb_1",
        answers: {
          qq_onb_1: "opt_2",
          qq_onb_2: ["opt_1", "opt_3"],
          qq_onb_3: "opt_f",
        },
      });

      assert.strictEqual(result.passed, true);
      assert.strictEqual(result.scorePct, 100);
      assert.strictEqual(result.enrollmentProgressPct, 100);
      assert.ok(result.certificate, "Certificate must be automatically issued upon 100% completion");
      assert.match(result.certificate!.certificate_code, /^CERT-\d{4}-[A-Z]+-\d+$/);

      // Verify enrollment status updated to COMPLETED
      const updatedEnr = db.prepare("SELECT * FROM enrollments WHERE id = ?").get(enr.id) as any;
      assert.strictEqual(updatedEnr.status, "COMPLETED");
      assert.strictEqual(updatedEnr.progress_pct, 100);
      assert.ok(updatedEnr.completed_at);
    });
  });

  // =========================================================================
  // 3. Certificate Generation & Verification Tests
  // =========================================================================
  describe("3. Certificate Generation, Cryptographic Hashing & Public Verification", () => {
    it("3.1 Formats certificate code matching /^CERT-\\d{4}-[A-Z]+-\\d+$/", () => {
      const db = getDb();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT OR REPLACE INTO enrollments (id, user_id, course_id, status, progress_pct, assigned_at, created_at, updated_at)
        VALUES ('enr_cert_gen_test', 'usr_marcus_vance', 'crs_sec_soc2_2026', 'COMPLETED', 100, ?, ?, ?)
      `).run(now, now, now);

      const cert = generateCertificate({
        userId: "usr_marcus_vance",
        courseId: "crs_sec_soc2_2026",
        enrollmentId: "enr_cert_gen_test",
        score: 100,
      });

      assert.ok(cert);
      assert.match(cert.certificate_code, /^CERT-\d{4}-[A-Z]+-\d+$/);
      assert.strictEqual(cert.score, 100);
      assert.strictEqual(cert.user_id, "usr_marcus_vance");
    });

    it("3.2 Generates valid 64-character SHA-256 cryptographic verification hash", () => {
      const cert = getCertificateByIdOrCode("enr_cert_gen_test");
      assert.ok(cert);
      assert.strictEqual(cert.verification_hash.length, 64);
      assert.match(cert.verification_hash, /^[a-f0-9]{64}$/);
    });

    it("3.3 verifyCertificate successfully verifies authentic certificate", () => {
      const cert = getDb().prepare("SELECT * FROM certificates LIMIT 1").get() as any;
      assert.ok(cert);

      const verification = verifyCertificate(cert.certificate_code);
      assert.strictEqual(verification.valid, true);
      assert.ok(verification.certificate);
      assert.strictEqual(verification.certificate?.certificate_code, cert.certificate_code);
    });

    it("3.4 verifyCertificate safely rejects non-existent certificate code", () => {
      const verification = verifyCertificate("CERT-9999-FAKE-00000");
      assert.strictEqual(verification.valid, false);
      assert.strictEqual(verification.certificate, null);
      assert.match(verification.message, /No certificate found/);
    });
  });

  // =========================================================================
  // 4. API Endpoints Integration Tests
  // =========================================================================
  describe("4. Next.js API Route Handlers Integration", () => {
    it("4.1 GET /api/courses returns published course catalog", async () => {
      const req = new NextRequest("http://localhost:3000/api/courses");
      const res = await getCoursesRoute(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.courses));
      assert.ok(data.courses.length >= 3);
      assert.ok(data.courses.some((c: any) => c.slug === "day-1-enterprise-orientation"));
    });

    it("4.2 GET /api/courses?category=ONBOARDING filters by category", async () => {
      const req = new NextRequest("http://localhost:3000/api/courses?category=ONBOARDING");
      const res = await getCoursesRoute(req);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.courses.every((c: any) => c.category === "ONBOARDING"));
    });

    it("4.3 GET /api/courses/[courseId] returns course details with modular chapters", async () => {
      const req = new NextRequest("http://localhost:3000/api/courses/crs_onboarding_day1");
      const res = await getCourseDetailRoute(req, {
        params: Promise.resolve({ courseId: "crs_onboarding_day1" }),
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.course.id, "crs_onboarding_day1");
      assert.ok(Array.isArray(data.modules));
      assert.strictEqual(data.modules.length, 3);
    });

    it("4.4 GET /api/modules/[moduleId] returns module content and chapter navigation", async () => {
      const req = new NextRequest("http://localhost:3000/api/modules/mod_onb_welcome");
      const res = await getModuleRoute(req, {
        params: Promise.resolve({ moduleId: "mod_onb_welcome" }),
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.module.id, "mod_onb_welcome");
      assert.strictEqual(data.module.type, "RICH_MARKDOWN");
      assert.ok(data.navigation);
      assert.strictEqual(data.navigation.nextModule.id, "mod_onb_security_video");
    });

    it("4.5 POST /api/modules/[moduleId]/complete marks progress and returns next module", async () => {
      const req = new NextRequest("http://localhost:3000/api/modules/mod_onb_welcome/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeSpentSeconds: 90 }),
      });

      const res = await completeModuleRoute(req, {
        params: Promise.resolve({ moduleId: "mod_onb_welcome" }),
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.progressPct > 0);
    });

    it("4.6 POST /api/quizzes/[quizId]/submit grades submission and records audit log", async () => {
      const req = new NextRequest("http://localhost:3000/api/quizzes/q_onb_1/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: {
            qq_onb_1: "opt_2",
            qq_onb_2: ["opt_1", "opt_3"],
            qq_onb_3: "opt_f",
          },
        }),
      });

      const res = await submitQuizRoute(req, {
        params: Promise.resolve({ quizId: "q_onb_1" }),
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.passed, true);
      assert.strictEqual(data.scorePct, 100);
      assert.ok(data.evaluation);
    });

    it("4.7 GET /api/certificates/[certId] verifies certificate and returns 404 for invalid code", async () => {
      const db = getDb();
      const existingCert = db.prepare("SELECT * FROM certificates LIMIT 1").get() as any;
      assert.ok(existingCert);

      // Valid check
      const validReq = new NextRequest(`http://localhost:3000/api/certificates/${existingCert.certificate_code}`);
      const validRes = await getCertificateRoute(validReq, {
        params: Promise.resolve({ certId: existingCert.certificate_code }),
      });
      assert.strictEqual(validRes.status, 200);
      const validData = await validRes.json();
      assert.strictEqual(validData.valid, true);
      assert.strictEqual(validData.certificate.certificate_code, existingCert.certificate_code);

      // Invalid check
      const invalidReq = new NextRequest("http://localhost:3000/api/certificates/UNKNOWN-CODE");
      const invalidRes = await getCertificateRoute(invalidReq, {
        params: Promise.resolve({ certId: "UNKNOWN-CODE" }),
      });
      assert.strictEqual(invalidRes.status, 404);
      const invalidData = await invalidRes.json();
      assert.strictEqual(invalidData.valid, false);
    });
  });
});
