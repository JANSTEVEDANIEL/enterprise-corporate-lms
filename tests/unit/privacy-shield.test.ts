import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  maskCourseTitle,
  isTitleMasked,
  checkContentGate,
  assertContentAccess,
  sanitizeCourseForRole,
  sanitizeCourseCatalogForRole,
  sanitizeLessonForRole,
  getCoverPrivacyStyles,
  PRIVACY_SHIELD_CONSTANTS,
} from "../../src/lib/privacy";
import { initDb, getDb } from "../../src/lib/db";
import { GET as getLessonRoute } from "../../src/app/api/courses/[courseId]/lessons/[lessonId]/route";
import { GET as getStreamRoute } from "../../src/app/api/lessons/[lessonId]/stream/route";
import { GET as getModuleRoute } from "../../src/app/api/modules/[moduleId]/route";
import { GET as getCoursesRoute } from "../../src/app/api/courses/route";

describe("Creator Content Privacy Shield Unit & Route Security Suite", () => {
  before(() => {
    initDb();
    const db = getDb();
    const now = new Date().toISOString();

    // Ensure mock Co-Admin creator user exists
    db.prepare(`
      INSERT OR IGNORE INTO users (id, email, name, role, department, job_title, is_active, created_at, updated_at)
      VALUES ('usr_coadmin_creator', 'creator@creator.corp', 'Elena Creator', 'CO_ADMIN', 'Content', 'Lead Instructor', 1, ?, ?)
    `).run(now, now);

    // Ensure mock Student user exists
    db.prepare(`
      INSERT OR IGNORE INTO users (id, email, name, role, department, job_title, is_active, created_at, updated_at)
      VALUES ('usr_student_dan', 'dan@student.corp', 'Dan Student', 'STUDENT', 'General', 'Learner', 1, ?, ?)
    `).run(now, now);

    // Insert test course created by Co-Admin
    db.prepare(`
      INSERT OR IGNORE INTO courses (
        id, slug, title, description, category, target_role, is_mandatory,
        estimated_minutes, passing_score_pct, version, is_published,
        creator_id, price_cents, thumbnail_url, total_weeks, created_at, updated_at
      ) VALUES (
        'crs_shield_test', 'shield-test-course', 'Advanced Next.js Architecture',
        'Deep dive into full-stack architecture', 'SOFTWARE', 'ALL', 0,
        120, 80, '1.0.0', 1,
        'usr_coadmin_creator', 9900, 'https://cdn.example.com/thumb.jpg', 4, ?, ?
      )
    `).run(now, now);

    // Insert test week
    db.prepare(`
      INSERT OR IGNORE INTO weeks (
        id, course_id, week_number, title, description, created_at, updated_at
      ) VALUES (
        'wk_shield_1', 'crs_shield_test', 1, 'Week 1: Fundamentals', 'Intro', ?, ?
      )
    `).run(now, now);

    // Insert protected lesson
    db.prepare(`
      INSERT OR IGNORE INTO lessons (
        id, week_id, course_id, title, order_index, duration_seconds,
        video_url, supplementary_files, is_preview, created_at, updated_at
      ) VALUES (
        'lsn_shield_protected', 'wk_shield_1', 'crs_shield_test', 'Mastering RSC & Edge Data',
        1, 1800, 'https://cdn.example.com/secret_video.mp4',
        '[{"id":"f1","name":"slides.pdf","file_url":"https://cdn.example.com/slides.pdf","file_size_bytes":1024,"file_type":"PDF"}]',
        0, ?, ?
      )
    `).run(now, now);

    // Insert preview lesson
    db.prepare(`
      INSERT OR IGNORE INTO lessons (
        id, week_id, course_id, title, order_index, duration_seconds,
        video_url, supplementary_files, is_preview, created_at, updated_at
      ) VALUES (
        'lsn_shield_preview', 'wk_shield_1', 'crs_shield_test', 'Free Course Overview',
        2, 300, 'https://cdn.example.com/preview.mp4',
        '[]', 1, ?, ?
      )
    `).run(now, now);

    // Enroll Dan Student
    db.prepare(`
      INSERT OR IGNORE INTO enrollments (
        id, user_id, course_id, status, progress_pct, assigned_at, created_at, updated_at
      ) VALUES (
        'enr_dan_shield', 'usr_student_dan', 'crs_shield_test', 'IN_PROGRESS', 25, ?, ?, ?
      )
    `).run(now, now, now);
  });

  // =========================================================================
  // 1. Title Masking Algorithm
  // =========================================================================
  describe("1. Title Masking Algorithm (maskCourseTitle)", () => {
    it("1.1 Masks titles with length > 6 by slicing first 6 characters and appending suffix", () => {
      const result = maskCourseTitle("Advanced Next.js Mastery");
      assert.strictEqual(result, "Advanc... [Content Encrypted]");
    });

    it("1.2 Masks 6-character titles without truncation", () => {
      const result = maskCourseTitle("Python");
      assert.strictEqual(result, "Python... [Content Encrypted]");
    });

    it("1.3 Masks short titles (<= 5 characters)", () => {
      assert.strictEqual(maskCourseTitle("Go"), "Go... [Content Encrypted]");
      assert.strictEqual(maskCourseTitle("C"), "C... [Content Encrypted]");
      assert.strictEqual(maskCourseTitle("React"), "React... [Content Encrypted]");
    });

    it("1.4 Handles empty string safely", () => {
      assert.strictEqual(maskCourseTitle(""), "[Content Encrypted]");
    });

    it("1.5 Handles whitespace-only string safely", () => {
      assert.strictEqual(maskCourseTitle("   "), "[Content Encrypted]");
    });

    it("1.6 Handles null and undefined values safely", () => {
      assert.strictEqual(maskCourseTitle(null), "[Content Encrypted]");
      assert.strictEqual(maskCourseTitle(undefined), "[Content Encrypted]");
    });

    it("1.7 isTitleMasked correctly detects encrypted titles", () => {
      assert.strictEqual(isTitleMasked("Advanc... [Content Encrypted]"), true);
      assert.strictEqual(isTitleMasked("Advanced Next.js Mastery"), false);
      assert.strictEqual(isTitleMasked(null), false);
    });
  });

  // =========================================================================
  // 2. Content Gate Logic & Access Assertion
  // =========================================================================
  describe("2. checkContentGate & assertContentAccess Barrier Logic", () => {
    it("2.1 Strictly rejects SUPER_ADMIN even if marked as author or enrolled", () => {
      const gate1 = checkContentGate("SUPER_ADMIN", false, false);
      assert.strictEqual(gate1.allowed, false);
      assert.strictEqual(gate1.status, 403);
      assert.strictEqual(gate1.errorCode, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");

      // Super Admin bypass attempt with isAuthor=true and isEnrolled=true
      const gate2 = checkContentGate("SUPER_ADMIN", true, true);
      assert.strictEqual(gate2.allowed, false);
      assert.strictEqual(gate2.status, 403);
      assert.strictEqual(gate2.errorCode, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
    });

    it("2.2 Allows authoring Co-Admin regardless of enrollment", () => {
      const gate = checkContentGate("CO_ADMIN", true, false);
      assert.strictEqual(gate.allowed, true);
      assert.strictEqual(gate.status, 200);
    });

    it("2.3 Allows enrolled Student", () => {
      const gate = checkContentGate("STUDENT", false, true);
      assert.strictEqual(gate.allowed, true);
      assert.strictEqual(gate.status, 200);
    });

    it("2.4 Rejects unenrolled Student with 403 FORBIDDEN_UNENROLLED", () => {
      const gate = checkContentGate("STUDENT", false, false);
      assert.strictEqual(gate.allowed, false);
      assert.strictEqual(gate.status, 403);
      assert.strictEqual(gate.errorCode, "FORBIDDEN_UNENROLLED");
    });

    it("2.5 Rejects corporate non-enrolled roles (EMPLOYEE, MANAGER)", () => {
      const empGate = checkContentGate("EMPLOYEE", false, false);
      assert.strictEqual(empGate.allowed, false);
      assert.strictEqual(empGate.status, 403);
      assert.strictEqual(empGate.errorCode, "FORBIDDEN_UNENROLLED");

      const mgrGate = checkContentGate("MANAGER", false, false);
      assert.strictEqual(mgrGate.allowed, false);
      assert.strictEqual(mgrGate.status, 403);
    });

    it("2.6 assertContentAccess throws 403 error for Super Admin", () => {
      assert.throws(
        () => assertContentAccess("SUPER_ADMIN", true, true),
        (err: any) => err.status === 403 && err.code === "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE"
      );
    });

    it("2.7 assertContentAccess passes without throwing for authorized users", () => {
      assert.doesNotThrow(() => assertContentAccess("CO_ADMIN", true, false));
      assert.doesNotThrow(() => assertContentAccess("STUDENT", false, true));
    });
  });

  // =========================================================================
  // 3. Sanitizers for Courses and Lessons
  // =========================================================================
  describe("3. Data Sanitizers for Catalog and Lessons", () => {
    const rawCourse = {
      id: "crs_1",
      title: "Fullstack Rust & WebAssembly",
      price_cents: 4999,
      thumbnail_url: "https://example.com/rust.png",
    };

    it("3.1 sanitizeCourseForRole masks title and sets encryption flags for SUPER_ADMIN", () => {
      const sanitized = sanitizeCourseForRole(rawCourse, "SUPER_ADMIN");
      assert.strictEqual(sanitized.title, "Fullst... [Content Encrypted]");
      assert.strictEqual(sanitized.is_content_encrypted, true);
      assert.strictEqual(sanitized.thumbnail_blurred, true);
    });

    it("3.2 sanitizeCourseForRole preserves unmasked title for non-admin", () => {
      const sanitized = sanitizeCourseForRole(rawCourse, "STUDENT");
      assert.strictEqual(sanitized.title, "Fullstack Rust & WebAssembly");
      assert.strictEqual(sanitized.is_content_encrypted, false);
      assert.strictEqual(sanitized.thumbnail_blurred, false);
    });

    it("3.3 sanitizeCourseCatalogForRole processes multiple courses cleanly", () => {
      const courses = [
        rawCourse,
        { id: "crs_2", title: "Python Machine Learning", price_cents: 2999 },
      ];
      const sanitized = sanitizeCourseCatalogForRole(courses, "SUPER_ADMIN");
      assert.strictEqual(sanitized[0].title, "Fullst... [Content Encrypted]");
      assert.strictEqual(sanitized[1].title, "Python... [Content Encrypted]");
      assert.strictEqual(sanitized[0].thumbnail_blurred, true);
      assert.strictEqual(sanitized[1].thumbnail_blurred, true);
    });

    it("3.4 sanitizeLessonForRole redacts video_url and files for Super Admin", () => {
      const rawLesson = {
        id: "lsn_1",
        title: "Kernel Internals",
        video_url: "https://cdn.example.com/kernel.mp4",
        content: "Sensitive kernel implementation details...",
        supplementary_files: [{ name: "firmware.bin" }],
      };

      const sanitized = sanitizeLessonForRole(rawLesson, "SUPER_ADMIN", false, false);
      assert.strictEqual(sanitized.video_url, null);
      assert.strictEqual(sanitized.content, "[Content Encrypted]");
      assert.deepStrictEqual(sanitized.supplementary_files, []);
      assert.strictEqual(sanitized.is_content_encrypted, true);
    });

    it("3.5 sanitizeLessonForRole preserves raw content for author", () => {
      const rawLesson = {
        id: "lsn_1",
        title: "Kernel Internals",
        video_url: "https://cdn.example.com/kernel.mp4",
        content: "Sensitive kernel implementation details...",
        supplementary_files: [{ name: "firmware.bin" }],
      };

      const result = sanitizeLessonForRole(rawLesson, "CO_ADMIN", true, false);
      assert.strictEqual(result.video_url, "https://cdn.example.com/kernel.mp4");
      assert.strictEqual(result.is_content_encrypted, false);
    });

    it("3.6 getCoverPrivacyStyles returns blur and badge for Super Admin", () => {
      const styles = getCoverPrivacyStyles(true);
      assert.ok(styles.imageClasses.includes("blur-md"));
      assert.strictEqual(styles.isEncrypted, true);
      assert.strictEqual(styles.badgeLabel, "Content Encrypted");

      const normalStyles = getCoverPrivacyStyles(false);
      assert.strictEqual(normalStyles.isEncrypted, false);
      assert.strictEqual(normalStyles.imageClasses, "");
    });
  });

  // =========================================================================
  // 4. API Endpoints Privacy Shield Enforcement
  // =========================================================================
  describe("4. API Route Guard Verification (Super Admin Interception)", () => {
    it("4.1 GET /api/courses/[courseId]/lessons/[lessonId] returns 403 for Super Admin", async () => {
      const req = new NextRequest("http://localhost:3000/api/courses/crs_shield_test/lessons/lsn_shield_protected", {
        headers: { "x-lms-user-id": "usr_david_kim" }, // Super Admin
      });
      const res = await getLessonRoute(req, {
        params: Promise.resolve({ courseId: "crs_shield_test", lessonId: "lsn_shield_protected" }),
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
    });

    it("4.2 GET /api/courses/[courseId]/lessons/[lessonId] returns 200 for enrolled Student", async () => {
      const req = new NextRequest("http://localhost:3000/api/courses/crs_shield_test/lessons/lsn_shield_protected", {
        headers: { "x-lms-user-id": "usr_student_dan" }, // Enrolled Student
      });
      const res = await getLessonRoute(req, {
        params: Promise.resolve({ courseId: "crs_shield_test", lessonId: "lsn_shield_protected" }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.lesson.id, "lsn_shield_protected");
      assert.strictEqual(data.lesson.video_url, "https://cdn.example.com/secret_video.mp4");
    });

    it("4.3 GET /api/lessons/[lessonId]/stream returns 403 for Super Admin", async () => {
      const req = new NextRequest("http://localhost:3000/api/lessons/lsn_shield_protected/stream", {
        headers: { "x-lms-user-id": "usr_david_kim" }, // Super Admin
      });
      const res = await getStreamRoute(req, {
        params: Promise.resolve({ lessonId: "lsn_shield_protected" }),
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
    });

    it("4.4 GET /api/lessons/[lessonId]/stream returns 200 for enrolled Student", async () => {
      const req = new NextRequest("http://localhost:3000/api/lessons/lsn_shield_protected/stream", {
        headers: { "x-lms-user-id": "usr_student_dan" }, // Enrolled Student
      });
      const res = await getStreamRoute(req, {
        params: Promise.resolve({ lessonId: "lsn_shield_protected" }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.lessonId, "lsn_shield_protected");
      assert.ok(data.streamUrl.includes("secret_video.mp4"));
    });

    it("4.5 GET /api/modules/[moduleId] returns 403 for Super Admin", async () => {
      const req = new NextRequest("http://localhost:3000/api/modules/mod_onb_welcome", {
        headers: { "x-lms-user-id": "usr_david_kim" }, // Super Admin
      });
      const res = await getModuleRoute(req, {
        params: Promise.resolve({ moduleId: "mod_onb_welcome" }),
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
    });

    it("4.6 GET /api/courses returns masked titles for Super Admin", async () => {
      const req = new NextRequest("http://localhost:3000/api/courses", {
        headers: { "x-lms-user-id": "usr_david_kim" }, // Super Admin
      });
      const res = await getCoursesRoute(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.courses.length > 0);
      // All returned courses must have masked titles and blurred thumbnails for Super Admin
      for (const course of data.courses) {
        assert.ok(course.title.includes("[Content Encrypted]"), `Expected masked title, got: ${course.title}`);
        assert.strictEqual(course.thumbnail_blurred, true);
        assert.strictEqual(course.is_content_encrypted, true);
      }
    });

    it("4.7 GET /api/courses returns unmasked titles for Student", async () => {
      const req = new NextRequest("http://localhost:3000/api/courses", {
        headers: { "x-lms-user-id": "usr_student_dan" }, // Student
      });
      const res = await getCoursesRoute(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      // Courses should NOT be encrypted for student
      const shieldCourse = data.courses.find((c: any) => c.id === "crs_shield_test");
      if (shieldCourse) {
        assert.strictEqual(shieldCourse.title, "Advanced Next.js Architecture");
        assert.strictEqual(shieldCourse.thumbnail_blurred, false);
        assert.strictEqual(shieldCourse.is_content_encrypted, false);
      }
    });
  });
});
