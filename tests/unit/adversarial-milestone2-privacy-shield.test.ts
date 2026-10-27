import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { initDb, getDb } from "../../src/lib/db";
import {
  GET as getStudioCourseDetailRoute,
  PATCH as patchStudioCourseDetailRoute,
  DELETE as deleteStudioCourseDetailRoute,
} from "../../src/app/api/studio/courses/[id]/route";
import {
  GET as getStudioWeeksRoute,
  POST as postStudioWeeksRoute,
  PATCH as patchStudioWeeksRoute,
  DELETE as deleteStudioWeeksRoute,
} from "../../src/app/api/studio/courses/[id]/weeks/route";
import { GET as getCourseRoute } from "../../src/app/api/courses/[courseId]/route";
import { GET as getLessonRoute } from "../../src/app/api/courses/[courseId]/lessons/[lessonId]/route";
import { GET as getStreamRoute } from "../../src/app/api/lessons/[lessonId]/stream/route";
import { maskCourseTitle } from "../../src/lib/privacy";

describe("Milestone 2 Empirical Challenger: Penetration Testing of Creator Content Privacy Shield", () => {
  const TEST_COURSE_ID = "crs_pen_test_shield";
  const TEST_COURSE_SLUG = "penetration-testing-architecture-cloud-privacy";
  const TEST_COURSE_TITLE = "Advanced Distributed Systems Privacy Architecture";
  const protectedLessonId = "lsn_pen_test_protected";
  const previewLessonId = "lsn_pen_test_preview";
  const PROTECTED_VIDEO_URL = "https://cdn.example.com/secret_vault_video.mp4";
  const PREVIEW_VIDEO_URL = "https://cdn.example.com/public_preview_video.mp4";

  before(() => {
    initDb();
    const db = getDb();
    const now = new Date().toISOString();

    // 1. Ensure test personas exist
    db.prepare(`
      INSERT OR IGNORE INTO users (id, name, email, role, department, job_title, created_at, updated_at)
      VALUES ('usr_sophia_chen', 'Sophia Chen', 'sophia.chen@edtech.marketplace', 'STUDENT', 'Design', 'Product Design Intern', ?, ?)
    `).run(now, now);

    db.prepare(`
      INSERT OR IGNORE INTO users (id, name, email, role, department, job_title, created_at, updated_at)
      VALUES ('usr_aris_thorne', 'Dr. Aris Thorne', 'aris.thorne@edtech.marketplace', 'CO_ADMIN', 'Computer Science', 'Distinguished Professor', ?, ?)
    `).run(now, now);

    db.prepare(`
      INSERT OR IGNORE INTO users (id, name, email, role, department, job_title, created_at, updated_at)
      VALUES ('usr_david_kim', 'David Kim', 'david.kim@enterprise.corp', 'SUPER_ADMIN', 'Operations', 'Chief Platform Officer', ?, ?)
    `).run(now, now);

    // 2. Insert dedicated penetration test course authored by Dr. Aris Thorne
    db.prepare(`
      INSERT OR REPLACE INTO courses (
        id, slug, title, description, category, target_role, is_mandatory,
        estimated_minutes, passing_score_pct, version, is_published,
        creator_id, price_cents, thumbnail_url, total_weeks, created_at, updated_at
      ) VALUES (
        ?, ?, ?,
        'Comprehensive security and privacy verification course for empirical challenger tests.',
        'SOFTWARE', 'ALL', 0, 360, 80, '1.0.0', 1,
        'usr_aris_thorne', 19900, 'https://cdn.example.com/privacy_thumb.jpg',
        4, ?, ?
      )
    `).run(TEST_COURSE_ID, TEST_COURSE_SLUG, TEST_COURSE_TITLE, now, now);

    // 3. Insert week for this dedicated test course
    db.prepare(`
      INSERT OR REPLACE INTO weeks (id, course_id, week_number, title, description, created_at, updated_at)
      VALUES ('wk_pen_w1', ?, 1, 'Week 1: Zero Knowledge & Gateway Isolation', 'Core privacy fundamentals', ?, ?)
    `).run(TEST_COURSE_ID, now, now);

    // 4. Insert preview lesson
    db.prepare(`
      INSERT OR REPLACE INTO lessons (
        id, week_id, course_id, title, order_index, duration_seconds,
        video_url, supplementary_files, is_preview, created_at, updated_at
      ) VALUES (
        ?, 'wk_pen_w1', ?,
        'Lesson 1.1: Architecture Overview (Public Preview)',
        1, 480, ?, '[]', 1, ?, ?
      )
    `).run(previewLessonId, TEST_COURSE_ID, PREVIEW_VIDEO_URL, now, now);

    // 5. Insert protected lesson
    db.prepare(`
      INSERT OR REPLACE INTO lessons (
        id, week_id, course_id, title, order_index, duration_seconds,
        video_url, supplementary_files, is_preview, created_at, updated_at
      ) VALUES (
        ?, 'wk_pen_w1', ?,
        'Lesson 1.2: Proprietary Kernel Sharding (Strict Protected)',
        2, 1850, ?,
        '[{"id":"f_priv_1","name":"proprietary_architecture.pdf","file_url":"https://cdn.example.com/prop.pdf","file_size_bytes":5242880,"file_type":"PDF"}]',
        0, ?, ?
      )
    `).run(protectedLessonId, TEST_COURSE_ID, PROTECTED_VIDEO_URL, now, now);

    // 6. Insert module for course details route fallback
    db.prepare(`
      INSERT OR REPLACE INTO modules (
        id, course_id, title, description, order_index, type, estimated_minutes,
        content, version, created_at, updated_at
      ) VALUES (
        'mod_pen_1', ?, 'Module 1: Privacy Architecture Core',
        'Confidential module content', 1, 'VIDEO_EMBED', 45,
        ?, '1.0.0', ?, ?
      )
    `).run(TEST_COURSE_ID, PROTECTED_VIDEO_URL, now, now);

    // 7. Enroll Sophia Chen in this dedicated test course
    db.prepare(`
      INSERT OR REPLACE INTO enrollments (
        id, user_id, course_id, status, progress_pct, assigned_at, created_at, updated_at
      ) VALUES (
        'enr_sophia_pen_course', 'usr_sophia_chen', ?, 'IN_PROGRESS', 25, ?, ?, ?
      )
    `).run(TEST_COURSE_ID, now, now, now);
  });

  // =========================================================================
  // PENETRATION PROBE 1: GET /api/studio/courses/[id] as Super Admin
  // =========================================================================
  describe("Probe 1: Studio Course Details Gate (/api/studio/courses/[id])", () => {
    it("1.1 Super Admin probing GET /api/studio/courses/[id] is blocked with 403 FORBIDDEN_SUPER_ADMIN_CONTENT_GATE", async () => {
      const req = new NextRequest(`http://localhost:3000/api/studio/courses/${TEST_COURSE_ID}`, {
        headers: { "x-lms-user-id": "usr_david_kim" },
      });
      const res = await getStudioCourseDetailRoute(req, {
        params: Promise.resolve({ id: TEST_COURSE_ID }),
      });

      assert.strictEqual(res.status, 403, "Status code must be 403 Forbidden");
      const body = await res.json();
      assert.strictEqual(body.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
      assert.strictEqual(body.code, 403);
      assert.strictEqual(body.course, undefined, "Course details must NOT be leaked to Super Admin");
    });

    it("1.2 Super Admin probing via role header 'x-lms-role: SUPER_ADMIN' is blocked with 403", async () => {
      const req = new NextRequest(`http://localhost:3000/api/studio/courses/${TEST_COURSE_ID}`, {
        headers: { "x-lms-role": "SUPER_ADMIN" },
      });
      const res = await getStudioCourseDetailRoute(req, {
        params: Promise.resolve({ id: TEST_COURSE_ID }),
      });

      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
    });

    it("1.3 Super Admin attempting PATCH /api/studio/courses/[id] to tamper with creator course is blocked with 403", async () => {
      const req = new NextRequest(`http://localhost:3000/api/studio/courses/${TEST_COURSE_ID}`, {
        method: "PATCH",
        headers: {
          "x-lms-user-id": "usr_david_kim",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: "Adversarial Overwrite" }),
      });
      const res = await patchStudioCourseDetailRoute(req, {
        params: Promise.resolve({ id: TEST_COURSE_ID }),
      });

      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
    });

    it("1.4 Super Admin attempting DELETE /api/studio/courses/[id] is blocked with 403", async () => {
      const req = new NextRequest(`http://localhost:3000/api/studio/courses/${TEST_COURSE_ID}`, {
        method: "DELETE",
        headers: { "x-lms-user-id": "usr_david_kim" },
      });
      const res = await deleteStudioCourseDetailRoute(req, {
        params: Promise.resolve({ id: TEST_COURSE_ID }),
      });

      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
    });
  });

  // =========================================================================
  // PENETRATION PROBE 2: GET /api/studio/courses/[id]/weeks as Super Admin
  // =========================================================================
  describe("Probe 2: Studio Weeks & Curriculum Gate (/api/studio/courses/[id]/weeks)", () => {
    it("2.1 Super Admin probing GET /api/studio/courses/[id]/weeks is blocked with 403 FORBIDDEN_SUPER_ADMIN_CONTENT_GATE", async () => {
      const req = new NextRequest(`http://localhost:3000/api/studio/courses/${TEST_COURSE_ID}/weeks`, {
        headers: { "x-lms-user-id": "usr_david_kim" },
      });
      const res = await getStudioWeeksRoute(req, {
        params: Promise.resolve({ id: TEST_COURSE_ID }),
      });

      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
      assert.strictEqual(body.code, 403);
      assert.strictEqual(body.weeks, undefined, "Curriculum weeks must NOT be leaked to Super Admin");
    });

    it("2.2 Super Admin attempting POST /api/studio/courses/[id]/weeks is blocked with 403", async () => {
      const req = new NextRequest(`http://localhost:3000/api/studio/courses/${TEST_COURSE_ID}/weeks`, {
        method: "POST",
        headers: {
          "x-lms-user-id": "usr_david_kim",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "ADD_WEEK", title: "Malicious Week Injection" }),
      });
      const res = await postStudioWeeksRoute(req, {
        params: Promise.resolve({ id: TEST_COURSE_ID }),
      });

      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
    });

    it("2.3 Super Admin attempting PATCH /api/studio/courses/[id]/weeks is blocked with 403", async () => {
      const req = new NextRequest(`http://localhost:3000/api/studio/courses/${TEST_COURSE_ID}/weeks`, {
        method: "PATCH",
        headers: {
          "x-lms-user-id": "usr_david_kim",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "UPDATE_WEEK", week_id: "wk_pen_w1", title: "Compromised Title" }),
      });
      const res = await patchStudioWeeksRoute(req, {
        params: Promise.resolve({ id: TEST_COURSE_ID }),
      });

      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
    });

    it("2.4 Super Admin attempting DELETE /api/studio/courses/[id]/weeks is blocked with 403", async () => {
      const req = new NextRequest(`http://localhost:3000/api/studio/courses/${TEST_COURSE_ID}/weeks`, {
        method: "DELETE",
        headers: { "x-lms-user-id": "usr_david_kim" },
        body: JSON.stringify({ action: "DELETE_WEEK", week_id: "wk_pen_w1" }),
      });
      const res = await deleteStudioWeeksRoute(req, {
        params: Promise.resolve({ id: TEST_COURSE_ID }),
      });

      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
    });
  });

  // =========================================================================
  // PENETRATION PROBE 3: GET /api/courses/[courseId] as Super Admin
  // =========================================================================
  describe("Probe 3: Course Catalog Details Privacy Masking (/api/courses/[courseId])", () => {
    it("3.1 Super Admin receives masked title and privacy flags", async () => {
      const req = new NextRequest(`http://localhost:3000/api/courses/${TEST_COURSE_ID}`, {
        headers: { "x-lms-user-id": "usr_david_kim" },
      });
      const res = await getCourseRoute(req, {
        params: Promise.resolve({ courseId: TEST_COURSE_ID }),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.course, "Course object must be returned");

      // Verify title is masked with the required suffix
      assert.ok(
        body.course.title.includes("[Content Encrypted]"),
        `Title should contain [Content Encrypted], got: ${body.course.title}`
      );
      assert.strictEqual(
        body.course.title,
        "Advanc... [Content Encrypted]",
        "Prefix should be first 6 chars of 'Advanced Distributed Systems Privacy Architecture'"
      );
      assert.strictEqual(body.course.is_content_encrypted, true);
      assert.strictEqual(body.course.thumbnail_blurred, true);
    });

    it("3.2 Super Admin receives redacted modules with null video_url and redacted content string", async () => {
      const req = new NextRequest(`http://localhost:3000/api/courses/${TEST_COURSE_ID}`, {
        headers: { "x-lms-user-id": "usr_david_kim" },
      });
      const res = await getCourseRoute(req, {
        params: Promise.resolve({ courseId: TEST_COURSE_ID }),
      });

      const body = await res.json();
      assert.ok(Array.isArray(body.modules), "Modules array must be returned");
      assert.ok(body.modules.length > 0, "At least one module should exist");

      for (const mod of body.modules) {
        assert.strictEqual(
          mod.video_url,
          null,
          `Module ${mod.id} video_url must be null for Super Admin`
        );
        assert.strictEqual(
          mod.content,
          "[Content Encrypted - Super Admin Restricted]",
          `Module ${mod.id} content must be redacted for Super Admin`
        );
        assert.deepStrictEqual(
          mod.supplementary_files,
          [],
          `Module ${mod.id} supplementary_files must be empty for Super Admin`
        );
      }
    });

    it("3.3 Lookup by slug also enforces privacy masking for Super Admin", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/courses/${TEST_COURSE_SLUG}`,
        {
          headers: { "x-lms-user-id": "usr_david_kim" },
        }
      );
      const res = await getCourseRoute(req, {
        params: Promise.resolve({
          courseId: TEST_COURSE_SLUG,
        }),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.course.title, "Advanc... [Content Encrypted]");
      assert.strictEqual(body.course.is_content_encrypted, true);
      assert.strictEqual(body.course.thumbnail_blurred, true);
    });
  });

  // =========================================================================
  // PENETRATION PROBE 4: Lesson and Stream Endpoints as Super Admin
  // =========================================================================
  describe("Probe 4: Direct Lesson & Stream Probing by Super Admin", () => {
    it("4.1 Probing protected lesson GET /api/courses/[courseId]/lessons/[lessonId] returns 403", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/courses/${TEST_COURSE_ID}/lessons/${protectedLessonId}`,
        {
          headers: { "x-lms-user-id": "usr_david_kim" },
        }
      );
      const res = await getLessonRoute(req, {
        params: Promise.resolve({
          courseId: TEST_COURSE_ID,
          lessonId: protectedLessonId,
        }),
      });

      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
      assert.strictEqual(body.lesson, undefined, "Raw lesson must not be leaked to Super Admin");
    });

    it("4.2 Probing preview lesson GET /api/courses/[courseId]/lessons/[lessonId] STILL returns 403 for Super Admin", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/courses/${TEST_COURSE_ID}/lessons/${previewLessonId}`,
        {
          headers: { "x-lms-user-id": "usr_david_kim" },
        }
      );
      const res = await getLessonRoute(req, {
        params: Promise.resolve({
          courseId: TEST_COURSE_ID,
          lessonId: previewLessonId,
        }),
      });

      assert.strictEqual(res.status, 403, "Super Admin must not access preview lessons either");
      const body = await res.json();
      assert.strictEqual(body.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
    });

    it("4.3 Probing video stream GET /api/lessons/[lessonId]/stream returns 403 for Super Admin", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/lessons/${protectedLessonId}/stream`,
        {
          headers: { "x-lms-user-id": "usr_david_kim" },
        }
      );
      const res = await getStreamRoute(req, {
        params: Promise.resolve({ lessonId: protectedLessonId }),
      });

      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
      assert.strictEqual(body.streamUrl, undefined, "Stream URL must not be leaked to Super Admin");
    });

    it("4.4 Probing preview video stream GET /api/lessons/[lessonId]/stream STILL returns 403 for Super Admin", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/lessons/${previewLessonId}/stream`,
        {
          headers: { "x-lms-user-id": "usr_david_kim" },
        }
      );
      const res = await getStreamRoute(req, {
        params: Promise.resolve({ lessonId: previewLessonId }),
      });

      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
    });
  });

  // =========================================================================
  // PROBE 5: Legitimate Access by Authoring Creator (Dr. Aris Thorne)
  // =========================================================================
  describe("Probe 5: Authoring Creator Legitimate Access (Dr. Aris Thorne)", () => {
    it("5.1 Creator can access GET /api/studio/courses/[id] with unmasked content and full stats", async () => {
      const req = new NextRequest(`http://localhost:3000/api/studio/courses/${TEST_COURSE_ID}`, {
        headers: { "x-lms-user-id": "usr_aris_thorne" },
      });
      const res = await getStudioCourseDetailRoute(req, {
        params: Promise.resolve({ id: TEST_COURSE_ID }),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.course);
      assert.strictEqual(body.course.title, TEST_COURSE_TITLE);
      assert.ok(!body.course.title.includes("[Content Encrypted]"));
      assert.ok(Array.isArray(body.course.weeks), "Creator must receive weeks");
    });

    it("5.2 Creator can access GET /api/studio/courses/[id]/weeks with full lessons", async () => {
      const req = new NextRequest(`http://localhost:3000/api/studio/courses/${TEST_COURSE_ID}/weeks`, {
        headers: { "x-lms-user-id": "usr_aris_thorne" },
      });
      const res = await getStudioWeeksRoute(req, {
        params: Promise.resolve({ id: TEST_COURSE_ID }),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(Array.isArray(body.weeks));
      assert.ok(body.weeks.length > 0);
      const week1 = body.weeks.find((w: any) => w.id === "wk_pen_w1");
      assert.ok(week1, "Week 1 must exist");
      assert.ok(Array.isArray(week1.lessons), "Week 1 must contain lessons");
    });

    it("5.3 Creator can access GET /api/courses/[courseId] with unmasked title", async () => {
      const req = new NextRequest(`http://localhost:3000/api/courses/${TEST_COURSE_ID}`, {
        headers: { "x-lms-user-id": "usr_aris_thorne" },
      });
      const res = await getCourseRoute(req, {
        params: Promise.resolve({ courseId: TEST_COURSE_ID }),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.course.title, TEST_COURSE_TITLE);
      assert.strictEqual(body.course.is_content_encrypted, undefined);
    });

    it("5.4 Creator can access GET /api/courses/[courseId]/lessons/[lessonId] and see raw video_url", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/courses/${TEST_COURSE_ID}/lessons/${protectedLessonId}`,
        {
          headers: { "x-lms-user-id": "usr_aris_thorne" },
        }
      );
      const res = await getLessonRoute(req, {
        params: Promise.resolve({
          courseId: TEST_COURSE_ID,
          lessonId: protectedLessonId,
        }),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.lesson);
      assert.strictEqual(body.lesson.video_url, PROTECTED_VIDEO_URL);
      assert.ok(Array.isArray(body.lesson.supplementary_files));
    });

    it("5.5 Creator can access GET /api/lessons/[lessonId]/stream and get streamUrl", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/lessons/${protectedLessonId}/stream`,
        {
          headers: { "x-lms-user-id": "usr_aris_thorne" },
        }
      );
      const res = await getStreamRoute(req, {
        params: Promise.resolve({ lessonId: protectedLessonId }),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.streamUrl, PROTECTED_VIDEO_URL);
    });
  });

  // =========================================================================
  // PROBE 6: Legitimate Access by Enrolled Student (Sophia Chen)
  // =========================================================================
  describe("Probe 6: Enrolled Student Legitimate Access (Sophia Chen)", () => {
    it("6.1 Enrolled student can access GET /api/courses/[courseId] with unmasked title", async () => {
      const req = new NextRequest(`http://localhost:3000/api/courses/${TEST_COURSE_ID}`, {
        headers: { "x-lms-user-id": "usr_sophia_chen" },
      });
      const res = await getCourseRoute(req, {
        params: Promise.resolve({ courseId: TEST_COURSE_ID }),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.course.title, TEST_COURSE_TITLE);
      assert.strictEqual(body.course.is_content_encrypted, undefined);
      assert.strictEqual(body.course.thumbnail_blurred, undefined);
    });

    it("6.2 Enrolled student can access GET /api/courses/[courseId]/lessons/[lessonId] and view video_url", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/courses/${TEST_COURSE_ID}/lessons/${protectedLessonId}`,
        {
          headers: { "x-lms-user-id": "usr_sophia_chen" },
        }
      );
      const res = await getLessonRoute(req, {
        params: Promise.resolve({
          courseId: TEST_COURSE_ID,
          lessonId: protectedLessonId,
        }),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.lesson.video_url, PROTECTED_VIDEO_URL);
    });

    it("6.3 Enrolled student can access GET /api/lessons/[lessonId]/stream and obtain valid playback URL", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/lessons/${protectedLessonId}/stream`,
        {
          headers: { "x-lms-user-id": "usr_sophia_chen" },
        }
      );
      const res = await getStreamRoute(req, {
        params: Promise.resolve({ lessonId: protectedLessonId }),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.streamUrl);
      assert.strictEqual(body.streamUrl, PROTECTED_VIDEO_URL);
    });
  });

  // =========================================================================
  // PROBE 7: Unenrolled User Access Boundaries
  // =========================================================================
  describe("Probe 7: Unenrolled User Access Boundaries", () => {
    before(() => {
      const db = getDb();
      // Ensure mock unenrolled user exists
      db.prepare(`
        INSERT OR IGNORE INTO users (id, name, email, role, department, job_title, created_at, updated_at)
        VALUES ('usr_unenrolled_student', 'Unenrolled Student', 'unenrolled_student@test.corp', 'STUDENT', 'General', 'Learner', datetime('now'), datetime('now'))
      `).run();
    });

    it("7.1 Unenrolled student probing protected lesson receives 403 FORBIDDEN_UNENROLLED", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/courses/${TEST_COURSE_ID}/lessons/${protectedLessonId}`,
        {
          headers: { "x-lms-user-id": "usr_unenrolled_student" },
        }
      );
      const res = await getLessonRoute(req, {
        params: Promise.resolve({
          courseId: TEST_COURSE_ID,
          lessonId: protectedLessonId,
        }),
      });

      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.error, "FORBIDDEN_UNENROLLED");
    });

    it("7.2 Unenrolled student probing stream for protected lesson receives 403 FORBIDDEN_UNENROLLED", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/lessons/${protectedLessonId}/stream`,
        {
          headers: { "x-lms-user-id": "usr_unenrolled_student" },
        }
      );
      const res = await getStreamRoute(req, {
        params: Promise.resolve({ lessonId: protectedLessonId }),
      });

      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.error, "FORBIDDEN_UNENROLLED");
    });

    it("7.3 Unenrolled student CAN access preview lesson via GET /api/courses/[courseId]/lessons/[previewLessonId]", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/courses/${TEST_COURSE_ID}/lessons/${previewLessonId}`,
        {
          headers: { "x-lms-user-id": "usr_unenrolled_student" },
        }
      );
      const res = await getLessonRoute(req, {
        params: Promise.resolve({
          courseId: TEST_COURSE_ID,
          lessonId: previewLessonId,
        }),
      });

      assert.strictEqual(res.status, 200, "Preview lesson should be accessible to prospective students");
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.lesson.id, previewLessonId);
    });

    it("7.4 Unenrolled student CAN access preview stream via GET /api/lessons/[previewLessonId]/stream", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/lessons/${previewLessonId}/stream`,
        {
          headers: { "x-lms-user-id": "usr_unenrolled_student" },
        }
      );
      const res = await getStreamRoute(req, {
        params: Promise.resolve({ lessonId: previewLessonId }),
      });

      assert.strictEqual(res.status, 200, "Preview stream should be accessible to prospective students");
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.streamUrl);
    });
  });
});
