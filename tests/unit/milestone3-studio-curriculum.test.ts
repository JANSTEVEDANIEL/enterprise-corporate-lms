import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { getDb, initDb } from "../../src/lib/db";
import { GET as getCourses, POST as createCourse } from "../../src/app/api/studio/courses/route";
import {
  GET as getCourseById,
  PATCH as updateCourseById,
  DELETE as deleteCourseById,
} from "../../src/app/api/studio/courses/[id]/route";
import {
  GET as getWeeks,
  POST as postWeekAction,
  PATCH as patchWeekAction,
  DELETE as deleteWeekAction,
} from "../../src/app/api/studio/courses/[id]/weeks/route";
import {
  GET as getPayouts,
  POST as requestPayout,
} from "../../src/app/api/studio/payouts/route";
import { POST as uploadMedia } from "../../src/app/api/studio/upload/route";

describe("Milestone 3: Co-Admin Creator Studio & 1-7+ Week Curriculum Builder Suite", () => {
  before(() => {
    initDb();
  });

  const testCreatorId = "usr_aris_thorne";
  let createdCourseId: string;
  let testWeekId: string;
  let testLessonId: string;

  // ==========================================================================
  // SUITE 1: Creator Studio Courses API (Listing, Analytics, Creation)
  // ==========================================================================
  describe("1. Creator Studio Courses API (Listing & Creation)", () => {
    it("1.1 GET /api/studio/courses returns creator courses and top-level analytics", async () => {
      const req = new NextRequest("http://localhost:3000/api/studio/courses", {
        headers: { "x-lms-user-id": testCreatorId },
      });
      const res = await getCourses(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.courses));
      assert.ok(data.analytics);
      assert.ok(typeof data.analytics.total_gross_cents === "number");
      assert.ok(typeof data.analytics.total_net_cents === "number");
      assert.ok(typeof data.analytics.total_courses === "number");
      assert.ok(typeof data.analytics.total_enrolled_students === "number");
      assert.ok(typeof data.analytics.wallet_balance_cents === "number");
    });

    it("1.2 POST /api/studio/courses rejects empty or short title (< 3 chars) with 400 Bad Request", async () => {
      const req = new NextRequest("http://localhost:3000/api/studio/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lms-user-id": testCreatorId,
        },
        body: JSON.stringify({
          title: "ab",
          category: "SOFTWARE",
          price: 49.99,
        }),
      });

      const res = await createCourse(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error, /at least 3 characters/i);
    });

    it("1.3 POST /api/studio/courses successfully creates course and provisions 7 sequential weeks", async () => {
      const req = new NextRequest("http://localhost:3000/api/studio/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lms-user-id": testCreatorId,
        },
        body: JSON.stringify({
          title: "Distributed Systems & Event-Driven Architecture",
          description: "Comprehensive 7-week curriculum on distributed microservices and event streaming.",
          category: "SOFTWARE",
          price: 89.99,
          total_weeks: 7,
          thumbnail_url: "https://storage.edtech.market/thumbnails/dist-sys.jpg",
        }),
      });

      const res = await createCourse(req);
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.course);
      assert.strictEqual(data.course.title, "Distributed Systems & Event-Driven Architecture");
      assert.strictEqual(data.course.price_cents, 8999);
      assert.strictEqual(data.course.price_dollars, 89.99);
      assert.strictEqual(data.course.total_weeks, 7);
      assert.strictEqual(data.course.is_published, 0, "New course starts in draft mode");

      createdCourseId = data.course.id;

      // Verify that 7 sequential weeks were created in DB
      const db = getDb();
      const weeks = db
        .prepare("SELECT week_number FROM weeks WHERE course_id = ? ORDER BY week_number ASC")
        .all(createdCourseId) as any[];
      assert.strictEqual(weeks.length, 7);
      for (let i = 0; i < 7; i++) {
        assert.strictEqual(weeks[i].week_number, i + 1);
      }
    });

    it("1.4 Auto-generates collision-free URL slug from course title", async () => {
      const uniqueBase = `Course Collision Test ${Date.now()}`;
      const req1 = new NextRequest("http://localhost:3000/api/studio/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lms-user-id": testCreatorId,
        },
        body: JSON.stringify({
          title: uniqueBase,
          category: "SOFTWARE",
          price: 59.99,
        }),
      });

      const res1 = await createCourse(req1);
      assert.strictEqual(res1.status, 201);
      const data1 = await res1.json();
      assert.ok(data1.course.slug);

      // Now create course with the exact same title to trigger collision handling
      const req2 = new NextRequest("http://localhost:3000/api/studio/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lms-user-id": testCreatorId,
        },
        body: JSON.stringify({
          title: uniqueBase,
          category: "SOFTWARE",
          price: 59.99,
        }),
      });

      const res2 = await createCourse(req2);
      assert.strictEqual(res2.status, 201);
      const data2 = await res2.json();
      assert.strictEqual(data2.course.slug, `${data1.course.slug}-1`);

      // Clean up collision test courses
      const db = getDb();
      db.prepare("DELETE FROM courses WHERE id IN (?, ?)").run(data1.course.id, data2.course.id);
    });
  });

  // ==========================================================================
  // SUITE 2: Course Details & Instant Publish Toggle
  // ==========================================================================
  describe("2. Course Details & Instant Publish Engine", () => {
    it("2.1 GET /api/studio/courses/[id] returns full course with populated weeks and lessons", async () => {
      const req = new NextRequest(`http://localhost:3000/api/studio/courses/${createdCourseId}`);
      const res = await getCourseById(req, {
        params: Promise.resolve({ id: createdCourseId }),
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.course.id, createdCourseId);
      assert.ok(Array.isArray(data.course.weeks));
      assert.strictEqual(data.course.weeks.length, 7);
      testWeekId = data.course.weeks[0].id;
    });

    it("2.2 Instant publish toggle transitions course from draft to published", async () => {
      const req = new NextRequest(`http://localhost:3000/api/studio/courses/${createdCourseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: true }),
      });

      const res = await updateCourseById(req, {
        params: Promise.resolve({ id: createdCourseId }),
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.course.is_published, 1);

      // Verify in DB directly
      const db = getDb();
      const courseInDb = db.prepare("SELECT is_published FROM courses WHERE id = ?").get(createdCourseId) as any;
      assert.strictEqual(courseInDb.is_published, 1);
    });

    it("2.3 Instant unpublish reverts course back to draft mode", async () => {
      const req = new NextRequest(`http://localhost:3000/api/studio/courses/${createdCourseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: false }),
      });

      const res = await updateCourseById(req, {
        params: Promise.resolve({ id: createdCourseId }),
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.course.is_published, 0);
    });

    it("2.4 PATCH /api/studio/courses/[id] updates course title, description, category, and price", async () => {
      const req = new NextRequest(`http://localhost:3000/api/studio/courses/${createdCourseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Enterprise Distributed Systems Masterclass",
          description: "Updated description for enterprise engineers.",
          category: "SOFTWARE",
          price_cents: 9999,
        }),
      });

      const res = await updateCourseById(req, {
        params: Promise.resolve({ id: createdCourseId }),
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.course.title, "Enterprise Distributed Systems Masterclass");
      assert.strictEqual(data.course.price_cents, 9999);
      assert.strictEqual(data.course.price_dollars, 99.99);
    });

    it("2.5 Returns 404 Not Found for non-existent course ID", async () => {
      const req = new NextRequest("http://localhost:3000/api/studio/courses/crs_non_existent_999");
      const res = await getCourseById(req, {
        params: Promise.resolve({ id: "crs_non_existent_999" }),
      });
      assert.strictEqual(res.status, 404);
    });
  });

  // ==========================================================================
  // SUITE 3: Sequential 1-7+ Week Curriculum Engine
  // ==========================================================================
  describe("3. Sequential 1-7+ Week Curriculum Engine", () => {
    it("3.1 Co-Admin can dynamically add Week 8 milestone", async () => {
      const req = new NextRequest(`http://localhost:3000/api/studio/courses/${createdCourseId}/weeks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_WEEK",
          title: "Week 8: Capstone Project & Production Deployment",
          description: "End-to-end design doc and multi-region deployment.",
        }),
      });

      const res = await postWeekAction(req, {
        params: Promise.resolve({ id: createdCourseId }),
      });
      assert.strictEqual(res.status, 201);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.week.week_number, 8);
      assert.strictEqual(data.week.title, "Week 8: Capstone Project & Production Deployment");

      // Verify course total_weeks updated to 8
      const db = getDb();
      const course = db.prepare("SELECT total_weeks FROM courses WHERE id = ?").get(createdCourseId) as any;
      assert.strictEqual(course.total_weeks, 8);
    });

    it("3.2 Co-Admin attaches video lessons with duration and preview toggle to a week", async () => {
      const req = new NextRequest(`http://localhost:3000/api/studio/courses/${createdCourseId}/weeks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_LESSON",
          week_id: testWeekId,
          title: "Lesson 1.1: Event Sourcing & CQRS Principles",
          duration_seconds: 1800,
          video_url: "https://storage.edtech.market/videos/lesson1-1.mp4",
          is_preview: true,
          supplementary_files: [
            {
              id: "att_cqrs_pdf",
              name: "CQRS_Architecture_Patterns.pdf",
              file_url: "https://storage.edtech.market/files/cqrs.pdf",
              file_size_bytes: 2048576,
              file_type: "PDF",
            },
          ],
        }),
      });

      const res = await postWeekAction(req, {
        params: Promise.resolve({ id: createdCourseId }),
      });
      assert.strictEqual(res.status, 201);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.lesson.id);
      assert.strictEqual(data.lesson.order_index, 1);
      assert.strictEqual(data.lesson.duration_seconds, 1800);
      assert.strictEqual(data.lesson.is_preview, 1);
      assert.strictEqual(data.lesson.supplementary_files.length, 1);
      assert.strictEqual(data.lesson.supplementary_files[0].name, "CQRS_Architecture_Patterns.pdf");

      testLessonId = data.lesson.id;
    });

    it("3.3 Adds second lesson and confirms deterministic order indexing", async () => {
      const req = new NextRequest(`http://localhost:3000/api/studio/courses/${createdCourseId}/weeks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_LESSON",
          week_id: testWeekId,
          title: "Lesson 1.2: Kafka Partitioning & Consumer Groups",
          duration_seconds: 2100,
          video_url: "https://storage.edtech.market/videos/lesson1-2.mp4",
          is_preview: false,
        }),
      });

      const res = await postWeekAction(req, {
        params: Promise.resolve({ id: createdCourseId }),
      });
      assert.strictEqual(res.status, 201);

      const data = await res.json();
      assert.strictEqual(data.lesson.order_index, 2);
    });

    it("3.4 Reordering lessons by IDs maintains strictly deterministic order_index", async () => {
      const db = getDb();
      const lessonsBefore = db
        .prepare("SELECT id FROM lessons WHERE week_id = ? ORDER BY order_index ASC")
        .all(testWeekId) as any[];

      assert.strictEqual(lessonsBefore.length, 2);
      const reversedIds = [lessonsBefore[1].id, lessonsBefore[0].id];

      const req = new NextRequest(`http://localhost:3000/api/studio/courses/${createdCourseId}/weeks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REORDER_LESSONS",
          week_id: testWeekId,
          lesson_ids: reversedIds,
        }),
      });

      const res = await patchWeekAction(req, {
        params: Promise.resolve({ id: createdCourseId }),
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.lessons[0].id, reversedIds[0]);
      assert.strictEqual(data.lessons[0].order_index, 1);
      assert.strictEqual(data.lessons[1].id, reversedIds[1]);
      assert.strictEqual(data.lessons[1].order_index, 2);
    });

    it("3.5 Configures weekly knowledge checks / quiz builder (SET_QUIZ)", async () => {
      const req = new NextRequest(`http://localhost:3000/api/studio/courses/${createdCourseId}/weeks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SET_QUIZ",
          week_id: testWeekId,
          title: "Week 1 Comprehensive Knowledge Check",
          passing_score_pct: 85,
          questions: [
            {
              id: "q1",
              prompt: "What is the primary benefit of the transactional outbox pattern?",
              options: [
                "Guarantees at-least-once message publication without distributed two-phase commits",
                "Compresses payload size by 90%",
                "Eliminates database tables entirely",
                "Encrypts DNS network packets",
              ],
              correct_index: 0,
              explanation: "Transactional outbox uses a local DB transaction to reliably record outbound messages.",
            },
          ],
        }),
      });

      const res = await postWeekAction(req, {
        params: Promise.resolve({ id: createdCourseId }),
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.quiz.title, "Week 1 Comprehensive Knowledge Check");
      assert.strictEqual(data.quiz.passing_score_pct, 85);
      assert.strictEqual(data.quiz.questions.length, 1);
      assert.strictEqual(data.quiz.questions[0].correct_index, 0);
    });

    it("3.6 Deleting a week re-numbers subsequent weeks sequentially", async () => {
      const db = getDb();
      const week8 = db
        .prepare("SELECT id FROM weeks WHERE course_id = ? AND week_number = 8")
        .get(createdCourseId) as any;

      assert.ok(week8);

      const req = new NextRequest(`http://localhost:3000/api/studio/courses/${createdCourseId}/weeks`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DELETE_WEEK",
          week_id: week8.id,
        }),
      });

      const res = await deleteWeekAction(req, {
        params: Promise.resolve({ id: createdCourseId }),
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.total_weeks, 7);

      const remainingWeeks = db
        .prepare("SELECT week_number FROM weeks WHERE course_id = ? ORDER BY week_number ASC")
        .all(createdCourseId) as any[];
      assert.strictEqual(remainingWeeks.length, 7);
    });
  });

  // ==========================================================================
  // SUITE 4: Creator Payout & Withdrawal Workflow
  // ==========================================================================
  describe("4. Creator Payout & Withdrawal Flow", () => {
    it("4.1 GET /api/studio/payouts returns creator payout history and available balance", async () => {
      const req = new NextRequest("http://localhost:3000/api/studio/payouts", {
        headers: { "x-lms-user-id": testCreatorId },
      });

      const res = await getPayouts(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.wallet);
      assert.ok(data.wallet.balance_cents > 0);
      assert.ok(Array.isArray(data.payouts));
    });

    it("4.2 Successfully submits valid payout request with initial status PENDING", async () => {
      const db = getDb();
      const walletBefore = db.prepare("SELECT balance_cents FROM wallets WHERE user_id = ?").get(testCreatorId) as any;
      const initialBalance = walletBefore?.balance_cents ?? 10000;

      const req = new NextRequest("http://localhost:3000/api/studio/payouts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lms-user-id": testCreatorId,
        },
        body: JSON.stringify({
          amount: 25.0, // $25.00 = 2500 cents
          notes: "Creator monthly milestone withdrawal",
        }),
      });

      const res = await requestPayout(req);
      assert.strictEqual(res.status, 201);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.payout.id);
      assert.strictEqual(data.payout.status, "PENDING");
      assert.strictEqual(data.payout.amount_cents, 2500);
      assert.strictEqual(data.payout.amount_dollars, 25.0);
      assert.strictEqual(data.new_balance_cents, initialBalance - 2500);

      // Verify wallet was debited in DB
      const walletAfter = db.prepare("SELECT balance_cents FROM wallets WHERE user_id = ?").get(testCreatorId) as any;
      assert.strictEqual(walletAfter.balance_cents, initialBalance - 2500);
    });

    it("4.3 Strictly rejects withdrawal request exceeding available wallet balance", async () => {
      const req = new NextRequest("http://localhost:3000/api/studio/payouts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lms-user-id": testCreatorId,
        },
        body: JSON.stringify({
          amount: 999999.0, // Exceeds wallet
        }),
      });

      const res = await requestPayout(req);
      assert.strictEqual(res.status, 400);

      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, "INSUFFICIENT_FUNDS");
    });

    it("4.4 Rejects non-positive withdrawal requests with 400 Bad Request", async () => {
      const req = new NextRequest("http://localhost:3000/api/studio/payouts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lms-user-id": testCreatorId,
        },
        body: JSON.stringify({
          amount: 0,
        }),
      });

      const res = await requestPayout(req);
      assert.strictEqual(res.status, 400);
    });
  });

  // ==========================================================================
  // SUITE 5: Media & Resource Upload Handler
  // ==========================================================================
  describe("5. Media & Resource Upload Handler", () => {
    it("5.1 Accepts direct JSON media URL payload and categorizes PDF file type", async () => {
      const req = new NextRequest("http://localhost:3000/api/studio/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://storage.edtech.market/files/handout.pdf",
          name: "Lecture_Notes_Week1.pdf",
          size_bytes: 1048576,
        }),
      });

      const res = await uploadMedia(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.file_type, "PDF");
      assert.strictEqual(data.name, "Lecture_Notes_Week1.pdf");
      assert.strictEqual(data.size_bytes, 1048576);
    });

    it("5.2 Rejects upload request missing URL with 400 Bad Request", async () => {
      const req = new NextRequest("http://localhost:3000/api/studio/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const res = await uploadMedia(req);
      assert.strictEqual(res.status, 400);
    });
  });

  after(() => {
    // Clean up created test course
    try {
      const db = getDb();
      if (createdCourseId) {
        db.prepare("DELETE FROM courses WHERE id = ?").run(createdCourseId);
      }
    } catch {}
  });
});
