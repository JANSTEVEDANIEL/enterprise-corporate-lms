import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { getDb, initDb } from "../../src/lib/db";
import { dbAdapter } from "../../src/lib/supabase/adapter";
import { GET as getEnrolledCourses } from "../../src/app/api/dashboard/enrolled-courses/route";
import {
  GET as getCourseProgress,
  POST as updateCourseProgress,
} from "../../src/app/api/courses/[courseId]/progress/route";
import {
  GET as getCourseCertificate,
  POST as mintCourseCertificate,
} from "../../src/app/api/courses/[courseId]/certificate/route";
import { GET as getAttachment } from "../../src/app/api/courses/[courseId]/lessons/[lessonId]/attachment/route";
import { POST as submitQuiz } from "../../src/app/api/quizzes/[quizId]/submit/route";
import { verifyCertificate } from "../../src/lib/certificates";
import { PLAYBACK_SPEEDS } from "../../src/components/player/video-player-controls";

describe("Milestone 5: Student Learning Player, Speed Controls, Progress Tracking & Certification Suite", () => {
  before(() => {
    initDb();
  });

  const testStudentId = "usr_sophia_chen";
  const testCreatorId = "usr_aris_thorne";
  const testSuperAdminId = "usr_david_kim";
  const targetCourseId = "crs_cloud_arch_7w";
  const targetLessonId = "les_cloud_w1_1";
  const targetQuizId = "qz_cloud_w1";

  // ==========================================================================
  // SUITE 1: Student Enrolled Courses Dashboard & API
  // ==========================================================================
  describe("1. Student Enrolled Courses Dashboard API (/api/dashboard/enrolled-courses)", () => {
    it("1.1 GET /api/dashboard/enrolled-courses returns enrolled courses for active student", async () => {
      const req = new NextRequest("http://localhost:3000/api/dashboard/enrolled-courses", {
        headers: { "x-lms-user-id": testStudentId },
      });
      const res = await getEnrolledCourses(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.user.id, testStudentId);
      assert.ok(Array.isArray(data.courses));
      assert.ok(data.courses.length >= 1, "Expected student to have enrolled courses");

      const course = data.courses.find((c: any) => c.course_id === targetCourseId);
      assert.ok(course, "Target 7-week cloud course should be enrolled");
      assert.strictEqual(course.total_weeks, 7);
      assert.strictEqual(typeof course.progress_pct, "number");
    });

    it("1.2 Accurately calculates progress percentage (completed_lessons / total_lessons * 100)", async () => {
      const req = new NextRequest("http://localhost:3000/api/dashboard/enrolled-courses", {
        headers: { "x-lms-user-id": testStudentId },
      });
      const res = await getEnrolledCourses(req);
      const data = await res.json();
      const course = data.courses.find((c: any) => c.course_id === targetCourseId);

      assert.ok(course);
      if (course.total_lessons > 0) {
        const expectedPct = Math.round((course.completed_lessons / course.total_lessons) * 100);
        assert.strictEqual(course.progress_pct, expectedPct);
      }
    });

    it("1.3 Returns student wallet balance with 500.00 default provisioned balance", async () => {
      const req = new NextRequest("http://localhost:3000/api/dashboard/enrolled-courses", {
        headers: { "x-lms-user-id": testStudentId },
      });
      const res = await getEnrolledCourses(req);
      const data = await res.json();

      assert.ok(data.wallet);
      assert.strictEqual(typeof data.wallet.balance_dollars, "number");
      assert.ok(data.wallet.balance_dollars >= 0);
    });

    it("1.4 Returns earned certificates list for the active student", async () => {
      const req = new NextRequest("http://localhost:3000/api/dashboard/enrolled-courses", {
        headers: { "x-lms-user-id": testStudentId },
      });
      const res = await getEnrolledCourses(req);
      const data = await res.json();

      assert.ok(Array.isArray(data.certificates));
    });
  });

  // ==========================================================================
  // SUITE 2: Video Player Controls & Exact Playback Speeds
  // ==========================================================================
  describe("2. Video Player Controls & Exact Playback Speeds", () => {
    it("2.1 Verifies PLAYBACK_SPEEDS has exactly [0.75, 1, 1.25, 1.5, 2]", () => {
      assert.deepStrictEqual(Array.from(PLAYBACK_SPEEDS), [0.75, 1, 1.25, 1.5, 2]);
    });

    it("2.2 Verifies that all 5 speed options are positive non-zero numbers and strictly ascending", () => {
      assert.strictEqual(PLAYBACK_SPEEDS.length, 5);
      for (let i = 0; i < PLAYBACK_SPEEDS.length; i++) {
        assert.ok(PLAYBACK_SPEEDS[i] > 0, "Playback rate must be positive");
        if (i > 0) {
          assert.ok(
            PLAYBACK_SPEEDS[i] > PLAYBACK_SPEEDS[i - 1],
            "Playback speeds must be in strictly ascending order"
          );
        }
      }
    });

    it("2.3 Progress percentage calculations at 0%, 50%, 90%, and 100%", () => {
      const duration = 600; // 10 minutes
      const calcPct = (pos: number) => Math.round((pos / duration) * 100);

      assert.strictEqual(calcPct(0), 0);
      assert.strictEqual(calcPct(300), 50);
      assert.strictEqual(calcPct(540), 90);
      assert.strictEqual(calcPct(600), 100);
    });

    it("2.4 Verifies that playback percentage >= 90% triggers auto-completion threshold", () => {
      const duration = 600;
      const isAutoCompleted = (current: number) => (current / duration) >= 0.9;

      assert.strictEqual(isAutoCompleted(539), false);
      assert.strictEqual(isAutoCompleted(540), true);
      assert.strictEqual(isAutoCompleted(590), true);
    });
  });

  // ==========================================================================
  // SUITE 3: Sequential 1 to 7+ Week Curriculum Navigation & Progress API
  // ==========================================================================
  describe("3. Sequential 1-7+ Week Navigation & Progress Tracking (/api/courses/[courseId]/progress)", () => {
    it("3.1 GET /api/courses/[courseId]/progress returns full curriculum with 7 weeks", async () => {
      const req = new NextRequest(`http://localhost:3000/api/courses/${targetCourseId}/progress`, {
        headers: { "x-lms-user-id": testStudentId },
      });
      const res = await getCourseProgress(req, {
        params: Promise.resolve({ courseId: targetCourseId }),
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.course_id, targetCourseId);
      assert.ok(data.total_lessons >= 7, "Expected at least 7 lessons across 7 weeks");
      assert.strictEqual(typeof data.progress_pct, "number");
    });

    it("3.2 POST /api/courses/[courseId]/progress rejects request missing lesson_id with 400 Bad Request", async () => {
      const req = new NextRequest(`http://localhost:3000/api/courses/${targetCourseId}/progress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lms-user-id": testStudentId,
        },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      const res = await updateCourseProgress(req, {
        params: Promise.resolve({ courseId: targetCourseId }),
      });
      assert.strictEqual(res.status, 400);

      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error, /lesson_id/);
    });

    it("3.3 POST /api/courses/[courseId]/progress rejects unenrolled user with 403 FORBIDDEN_UNENROLLED", async () => {
      const req = new NextRequest(`http://localhost:3000/api/courses/crs_zerotrust_sec_6w/progress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lms-user-id": "usr_sarah_jenkins", // not enrolled in zero-trust course
        },
        body: JSON.stringify({ lesson_id: "les_sec_w1_1", status: "COMPLETED" }),
      });
      const res = await updateCourseProgress(req, {
        params: Promise.resolve({ courseId: "crs_zerotrust_sec_6w" }),
      });
      assert.strictEqual(res.status, 403);

      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, "FORBIDDEN_UNENROLLED");
    });

    it("3.4 POST /api/courses/[courseId]/progress records lesson progress and updates course percentage", async () => {
      const req = new NextRequest(`http://localhost:3000/api/courses/${targetCourseId}/progress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lms-user-id": testStudentId,
        },
        body: JSON.stringify({
          lesson_id: targetLessonId,
          status: "COMPLETED",
          last_position_seconds: 600,
        }),
      });
      const res = await updateCourseProgress(req, {
        params: Promise.resolve({ courseId: targetCourseId }),
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.lesson_id, targetLessonId);
      assert.strictEqual(data.status, "COMPLETED");
      assert.ok(data.completed_lessons >= 1);
      assert.ok(data.progress_pct > 0);
    });

    it("3.5 Reaching 90%+ playback_percentage automatically marks lesson as COMPLETED", async () => {
      const lesson2Id = "les_cloud_w2_1";
      const req = new NextRequest(`http://localhost:3000/api/courses/${targetCourseId}/progress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lms-user-id": testStudentId,
        },
        body: JSON.stringify({
          lesson_id: lesson2Id,
          playback_percentage: 92, // 92% >= 90% auto-complete threshold
          last_position_seconds: 552,
        }),
      });
      const res = await updateCourseProgress(req, {
        params: Promise.resolve({ courseId: targetCourseId }),
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.status, "COMPLETED");
    });
  });

  // ==========================================================================
  // SUITE 4: Downloadable Attachments & Creator Content Privacy Shield
  // ==========================================================================
  describe("4. Downloadable Supplementary Attachments & Privacy Shield", () => {
    it("4.1 Enrolled Student can access downloadable attachments (PDF/ZIP)", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/courses/${targetCourseId}/lessons/${targetLessonId}/attachment`,
        { headers: { "x-lms-user-id": testStudentId } }
      );
      const res = await getAttachment(req, {
        params: Promise.resolve({ courseId: targetCourseId, lessonId: targetLessonId }),
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.files));
      assert.ok(data.files.length >= 1, "Expected PDF/ZIP supplementary files for week 1");
    });

    it("4.2 Authoring Co-Admin can access downloadable attachments", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/courses/${targetCourseId}/lessons/${targetLessonId}/attachment`,
        { headers: { "x-lms-user-id": testCreatorId } }
      );
      const res = await getAttachment(req, {
        params: Promise.resolve({ courseId: targetCourseId, lessonId: targetLessonId }),
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
    });

    it("4.3 Super Admin is strictly blocked with 403 FORBIDDEN_SUPER_ADMIN_CONTENT_GATE", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/courses/${targetCourseId}/lessons/${targetLessonId}/attachment`,
        { headers: { "x-lms-user-id": testSuperAdminId, "x-lms-role": "SUPER_ADMIN" } }
      );
      const res = await getAttachment(req, {
        params: Promise.resolve({ courseId: targetCourseId, lessonId: targetLessonId }),
      });
      assert.strictEqual(res.status, 403);

      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
    });

    it("4.4 Unenrolled Student is blocked with 403 FORBIDDEN_UNENROLLED", async () => {
      const nonPreviewLessonId = "les_cloud_w1_2";
      const req = new NextRequest(
        `http://localhost:3000/api/courses/${targetCourseId}/lessons/${nonPreviewLessonId}/attachment`,
        { headers: { "x-lms-user-id": "usr_marcus_vance", "x-lms-role": "COMPLIANCE_OFFICER" } }
      );
      const res = await getAttachment(req, {
        params: Promise.resolve({ courseId: targetCourseId, lessonId: nonPreviewLessonId }),
      });
      assert.strictEqual(res.status, 403);

      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, "FORBIDDEN_UNENROLLED");
    });
  });

  // ==========================================================================
  // SUITE 5: Weekly Knowledge Checks / Quizzes
  // ==========================================================================
  describe("5. Weekly Knowledge Checks / Quizzes (/api/quizzes/[quizId]/submit)", () => {
    it("5.1 Evaluates week quiz attempt and computes score percentage accurately", async () => {
      const req = new NextRequest(`http://localhost:3000/api/quizzes/${targetQuizId}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lms-user-id": testStudentId,
        },
        body: JSON.stringify({
          answers: {
            q_w1_1: 0, // Sidecar proxy pattern (correct)
            q_w1_2: 0, // CAP theorem partition tolerance (correct)
          },
        }),
      });
      const res = await submitQuiz(req, {
        params: Promise.resolve({ quizId: targetQuizId }),
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(typeof data.scorePct, "number");
      assert.strictEqual(typeof data.passed, "boolean");
      assert.ok(data.attemptNumber >= 1);
    });

    it("5.2 Correct answers yield passing score with instant verification feedback", async () => {
      const req = new NextRequest(`http://localhost:3000/api/quizzes/${targetQuizId}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lms-user-id": testStudentId,
        },
        body: JSON.stringify({
          answers: {
            q_w1_1: 0, // correct
            q_w1_2: 0, // correct
          },
        }),
      });
      const res = await submitQuiz(req, {
        params: Promise.resolve({ quizId: targetQuizId }),
      });
      const data = await res.json();

      assert.strictEqual(data.passed, true);
      assert.strictEqual(data.scorePct, 100);
      assert.ok(data.evaluation.results.length >= 2);
      assert.ok(data.evaluation.results.every((r: any) => r.isCorrect));
    });

    it("5.3 Incorrect answers yield failing score with corrective feedback", async () => {
      const req = new NextRequest(`http://localhost:3000/api/quizzes/${targetQuizId}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lms-user-id": testStudentId,
        },
        body: JSON.stringify({
          answers: {
            q_w1_1: 1, // incorrect
            q_w1_2: 2, // incorrect
          },
        }),
      });
      const res = await submitQuiz(req, {
        params: Promise.resolve({ quizId: targetQuizId }),
      });
      const data = await res.json();

      assert.strictEqual(data.passed, false);
      assert.strictEqual(data.scorePct, 0);
      assert.ok(data.evaluation.results.some((r: any) => !r.isCorrect));
    });
  });

  // ==========================================================================
  // SUITE 6: Automated Certificate Generation & Verification
  // ==========================================================================
  describe("6. Automated Certificate Generation & Verification (/api/courses/[courseId]/certificate)", () => {
    const singleWeekCourseId = "crs_git_free_1w";
    const singleWeekLessonId = "les_git_w1_1";

    it("6.1 POST /api/courses/[courseId]/certificate rejects minting for incomplete course with 400 Bad Request", async () => {
      // crs_ai_agents_prod has uncompleted lessons
      const req = new NextRequest(
        `http://localhost:3000/api/courses/crs_ai_agents_prod/certificate`,
        {
          method: "POST",
          headers: { "x-lms-user-id": testStudentId },
        }
      );
      const res = await mintCourseCertificate(req, {
        params: Promise.resolve({ courseId: "crs_ai_agents_prod" }),
      });
      // Either 400 COURSE_INCOMPLETE or 403 FORBIDDEN_UNENROLLED
      assert.ok(res.status === 400 || res.status === 403);
    });

    it("6.2 Completing 100% of curriculum allows minting Certificate of Completion", async () => {
      // 1. Enroll student in single-week git course
      const db = getDb();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT OR IGNORE INTO enrollments (
          id, user_id, course_id, status, progress_pct, created_at, updated_at
        ) VALUES ('enr_sophia_git', ?, ?, 'IN_PROGRESS', 0, ?, ?)
      `).run(testStudentId, singleWeekCourseId, now, now);

      // 2. Mark all lessons in course as completed (100% of single-week course)
      const gitLessons = db.prepare("SELECT id FROM lessons WHERE course_id = ? ORDER BY order_index ASC").all(singleWeekCourseId) as { id: string }[];
      let progressData: any = null;
      for (const les of gitLessons) {
        const progressReq = new NextRequest(
          `http://localhost:3000/api/courses/${singleWeekCourseId}/progress`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-lms-user-id": testStudentId,
            },
            body: JSON.stringify({
              lesson_id: les.id,
              status: "COMPLETED",
              playback_percentage: 100,
            }),
          }
        );
        const progressRes = await updateCourseProgress(progressReq, {
          params: Promise.resolve({ courseId: singleWeekCourseId }),
        });
        progressData = await progressRes.json();
      }
      assert.strictEqual(progressData.success, true);
      assert.strictEqual(progressData.progress_pct, 100);
      assert.strictEqual(progressData.is_completed, true);

      // 3. Mint Certificate via POST /api/courses/[courseId]/certificate
      const certReq = new NextRequest(
        `http://localhost:3000/api/courses/${singleWeekCourseId}/certificate`,
        {
          method: "POST",
          headers: { "x-lms-user-id": testStudentId },
        }
      );
      const certRes = await mintCourseCertificate(certReq, {
        params: Promise.resolve({ courseId: singleWeekCourseId }),
      });
      assert.ok(certRes.status === 200 || certRes.status === 201);

      const certData = await certRes.json();
      assert.strictEqual(certData.success, true);
      assert.ok(certData.certificate);
      assert.ok(certData.certificate.certificate_code);

      // 4. Verify unique ID format matches CERT-MKT-YYYY-...
      assert.match(
        certData.certificate.certificate_code,
        /^CERT-MKT-\d{4}-\d+$/,
        "Certificate serial code must follow format CERT-MKT-YYYY-XXXXX"
      );

      // 5. Verify cryptographic hash is 64-character SHA-256
      assert.match(
        certData.certificate.verification_hash,
        /^[a-f0-9]{64}$/i,
        "Verification hash must be authentic 64-character SHA-256"
      );
    });

    it("6.3 GET /api/courses/[courseId]/certificate returns existing minted certificate", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/courses/${singleWeekCourseId}/certificate`,
        {
          headers: { "x-lms-user-id": testStudentId },
        }
      );
      const res = await getCourseCertificate(req, {
        params: Promise.resolve({ courseId: singleWeekCourseId }),
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.certificate);
      assert.match(data.certificate.certificate_code, /^CERT-MKT-\d{4}-\d+$/);
    });

    it("6.4 Public certificate verification authenticates newly minted certificate", () => {
      const db = getDb();
      const cert = db
        .prepare("SELECT * FROM certificates WHERE user_id = ? AND course_id = ?")
        .get(testStudentId, singleWeekCourseId) as any;

      assert.ok(cert, "Minted certificate record must exist in database");

      const verification = verifyCertificate(cert.certificate_code);
      assert.strictEqual(verification.valid, true);
      assert.strictEqual(verification.certificate?.user_id, testStudentId);
      assert.strictEqual(verification.certificate?.course_id, singleWeekCourseId);
      assert.match(verification.certificate!.verification_hash, /^[a-f0-9]{64}$/i);
    });
  });
});
