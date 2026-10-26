import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { getDb, initDb } from "../../src/lib/db";
import { dbAdapter } from "../../src/lib/supabase/adapter";
import { GET as getMarketplaceCourses } from "../../src/app/api/marketplace/courses/route";
import {
  GET as getCheckoutStatus,
  POST as executeCheckout,
} from "../../src/app/api/marketplace/checkout/route";
import { maskCourseTitle, checkContentGate } from "../../src/lib/privacy";
import { calculateRevenueSplit, calculateRevenueSplitFromCents } from "../../src/lib/finance/split";
import { verifyAuditLogIntegrity } from "../../src/lib/audit";
import { randomUUID } from "node:crypto";

describe("Milestone 4: Marketplace Catalog, Simulated Wallet Checkout & 10/90 Revenue Split, and Super Admin Dashboard Suite", () => {
  before(() => {
    initDb();
  });

  const testStudentId = "usr_sophia_chen";
  const testCreatorId = "usr_aris_thorne";
  const targetCourseId = "crs_cloud_arch_7w";
  const targetCourseSlug = "cloud-native-architecture-distributed-systems";

  // ==========================================================================
  // SUITE 1: Public Marketplace Catalog & Filtering (Zero Login Barrier)
  // ==========================================================================
  describe("1. Public Marketplace Catalog & Course Browsing", () => {
    it("1.1 Unauthenticated visitors can view public course catalog with zero login barrier", async () => {
      // No auth headers or cookies provided
      const req = new NextRequest("http://localhost:3000/api/marketplace/courses");
      const res = await getMarketplaceCourses(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.courses));
      assert.ok(data.courses.length >= 2, "Expected multiple published courses in catalog");

      // Verify each course contains required marketplace card metadata
      const sample = data.courses.find((c: any) => c.id === targetCourseId);
      assert.ok(sample, "Target 7-week course must be present in public catalog");
      assert.ok(sample.title);
      assert.ok(sample.creator_name);
      assert.ok(sample.category);
      assert.strictEqual(typeof sample.price_dollars, "number");
      assert.ok(sample.total_weeks >= 1);
      assert.strictEqual(sample.is_published, 1);
    });

    it("1.2 Draft / unpublished courses are strictly excluded from public marketplace catalog", async () => {
      const req = new NextRequest("http://localhost:3000/api/marketplace/courses");
      const res = await getMarketplaceCourses(req);
      const data = await res.json();

      const draftCourse = data.courses.find((c: any) => c.id === "crs_ai_agents_prod");
      assert.strictEqual(
        draftCourse,
        undefined,
        "Draft courses (is_published = 0) must never appear in public marketplace queries"
      );
    });

    it("1.3 Filters public catalog by category (e.g. SOFTWARE)", async () => {
      const req = new NextRequest("http://localhost:3000/api/marketplace/courses?category=SOFTWARE");
      const res = await getMarketplaceCourses(req);
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.ok(data.courses.length >= 1);
      for (const c of data.courses) {
        assert.strictEqual(c.category, "SOFTWARE");
      }
    });

    it("1.4 Filters public catalog by keyword search in title or description", async () => {
      const req = new NextRequest("http://localhost:3000/api/marketplace/courses?search=Cloud");
      const res = await getMarketplaceCourses(req);
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.ok(data.courses.length >= 1);
      assert.ok(data.courses.some((c: any) => c.title.includes("Cloud")));
    });

    it("1.5 Filters public catalog by price type (free vs paid)", async () => {
      const freeReq = new NextRequest("http://localhost:3000/api/marketplace/courses?price_type=free");
      const freeRes = await getMarketplaceCourses(freeReq);
      const freeData = await freeRes.json();
      assert.strictEqual(freeRes.status, 200);
      for (const c of freeData.courses) {
        assert.strictEqual(c.price_cents, 0);
      }

      const paidReq = new NextRequest("http://localhost:3000/api/marketplace/courses?price_type=paid");
      const paidRes = await getMarketplaceCourses(paidReq);
      const paidData = await paidRes.json();
      assert.strictEqual(paidRes.status, 200);
      for (const c of paidData.courses) {
        assert.ok(c.price_cents > 0);
      }
    });
  });

  // ==========================================================================
  // SUITE 2: Course Preview Page & Curriculum Outline
  // ==========================================================================
  describe("2. Course Preview Page & Curriculum Outline", () => {
    it("2.1 Resolves course preview by slug with complete metadata", async () => {
      const course = await dbAdapter.getCourseBySlug(targetCourseSlug);
      assert.ok(course, "Course should resolve by URL slug");
      assert.strictEqual(course.id, targetCourseId);
      assert.strictEqual(course.total_weeks, 7);
      assert.strictEqual(course.price_dollars, 99.0);
      assert.ok(course.creator_name);
    });

    it("2.2 Retrieves complete sequential curriculum outline from Week 1 through Week 7+", async () => {
      const weeks = await dbAdapter.getCurriculum(targetCourseId);
      assert.ok(weeks.length >= 7, "Curriculum must include at least 7 sequential weeks");

      for (let i = 0; i < weeks.length; i++) {
        assert.strictEqual(weeks[i].week_number, i + 1);
        assert.ok(weeks[i].title);
        assert.ok(Array.isArray(weeks[i].lessons));
        assert.ok(weeks[i].lessons.length >= 1);
      }
    });

    it("2.3 Free preview lessons expose raw video streaming URL to prospective students", async () => {
      const weeks = await dbAdapter.getCurriculum(targetCourseId);
      const week1 = weeks.find((w: any) => w.week_number === 1);
      assert.ok(week1);

      const previewLesson = week1.lessons.find((l: any) => l.is_preview === 1 || l.is_preview === true);
      assert.ok(previewLesson, "Week 1 must contain a free preview lesson");
      assert.ok(previewLesson.video_url, "Free preview lesson must expose streaming video URL");
      assert.ok(previewLesson.duration_seconds > 0, "Lesson must specify duration");
    });
  });

  // ==========================================================================
  // SUITE 3: Simulated Wallet Checkout Flow & Exact 10/90 Revenue Split
  // ==========================================================================
  describe("3. Simulated Wallet Checkout Flow & 10/90 Split", () => {
    const freshStudentId = `usr_test_student_${randomUUID().slice(0, 6)}`;
    const checkoutCourseId = "crs_fullstack_ai_8w"; // $149.00 = 14900 cents
    let testTransactionId: string;
    let testEnrollmentId: string;

    before(() => {
      const db = getDb();
      const now = new Date().toISOString();
      // Provision test student user and pre-funded $500.00 wallet (50000 cents)
      db.prepare(`
        INSERT OR REPLACE INTO users (id, email, name, role, department, job_title, is_active, created_at, updated_at)
        VALUES (?, ?, 'Test Student Sophia', 'STUDENT', 'Learning', 'Student', 1, ?, ?)
      `).run(freshStudentId, `${freshStudentId}@test.lms`, now, now);

      db.prepare(`
        INSERT OR REPLACE INTO wallets (id, user_id, balance, balance_cents, currency, created_at, updated_at)
        VALUES (?, ?, 50000, 50000, 'USD', ?, ?)
      `).run(`wal_${freshStudentId}`, freshStudentId, now, now);
    });

    it("3.1 GET /api/marketplace/checkout returns student wallet balance and eligibility", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/marketplace/checkout?student_id=${freshStudentId}&course_id=${checkoutCourseId}`
      );
      const res = await getCheckoutStatus(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.student_id, freshStudentId);
      assert.strictEqual(data.wallet_balance_cents, 50000);
      assert.strictEqual(data.wallet_balance_dollars, 500.0);
      assert.strictEqual(data.is_enrolled, false);
      assert.strictEqual(data.can_afford, true);
    });

    it("3.2 POST /api/marketplace/checkout rejects request missing course_id with 400 Bad Request", async () => {
      const req = new NextRequest("http://localhost:3000/api/marketplace/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: freshStudentId }),
      });
      const res = await executeCheckout(req);
      assert.strictEqual(res.status, 400);

      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, "MISSING_COURSE_ID");
    });

    it("3.3 POST /api/marketplace/checkout rejects nonexistent course with 404 Not Found", async () => {
      const req = new NextRequest("http://localhost:3000/api/marketplace/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: "crs_nonexistent_9999",
          student_id: freshStudentId,
        }),
      });
      const res = await executeCheckout(req);
      assert.strictEqual(res.status, 404);

      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, "COURSE_NOT_FOUND");
    });

    it("3.4 POST /api/marketplace/checkout rejects draft/unpublished course with 400 Bad Request", async () => {
      const req = new NextRequest("http://localhost:3000/api/marketplace/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: "crs_ai_agents_prod", // Draft course
          student_id: freshStudentId,
        }),
      });
      const res = await executeCheckout(req);
      assert.strictEqual(res.status, 400);

      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, "COURSE_NOT_PUBLISHED");
    });

    it("3.5 Successfully executes checkout: debits student wallet, credits 10/90 split, provisions enrollment, and writes audit log", async () => {
      const db = getDb();
      const creatorBefore = (db.prepare("SELECT balance_cents FROM wallets WHERE user_id = ?").get(testCreatorId) as any)?.balance_cents ?? 0;

      const req = new NextRequest("http://localhost:3000/api/marketplace/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lms-user-id": freshStudentId,
        },
        body: JSON.stringify({
          course_id: checkoutCourseId,
          student_id: freshStudentId,
        }),
      });

      const res = await executeCheckout(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.transaction_id);
      assert.ok(data.enrollment_id);
      testTransactionId = data.transaction_id;
      testEnrollmentId = data.enrollment_id;

      // 14900 cents ($149.00)
      // 10% platform fee = 1490 cents ($14.90)
      // 90% creator payout = 13410 cents ($134.10)
      // Student new balance: 50000 - 14900 = 35100 cents ($351.00)
      assert.strictEqual(data.split.amount_cents, 14900);
      assert.strictEqual(data.split.platform_fee_cents, 1490);
      assert.strictEqual(data.split.creator_payout_cents, 13410);
      assert.strictEqual(data.split.platform_fee_cents + data.split.creator_payout_cents, data.split.amount_cents);
      assert.strictEqual(data.new_balance, 351.0);
      assert.strictEqual(data.new_balance_cents, 35100);

      // Verify Student Wallet DB state
      const studentWallet = db.prepare("SELECT balance_cents FROM wallets WHERE user_id = ?").get(freshStudentId) as any;
      assert.strictEqual(studentWallet.balance_cents, 35100);

      // Verify Creator Wallet received exactly 90%
      const creatorAfter = (db.prepare("SELECT balance_cents FROM wallets WHERE user_id = ?").get(testCreatorId) as any)?.balance_cents ?? 0;
      assert.strictEqual(creatorAfter - creatorBefore, 13410);

      // Verify Active Enrollment provisioned
      const enrollment = db.prepare("SELECT * FROM enrollments WHERE id = ?").get(testEnrollmentId) as any;
      assert.ok(enrollment);
      assert.strictEqual(enrollment.user_id, freshStudentId);
      assert.strictEqual(enrollment.course_id, checkoutCourseId);
      assert.strictEqual(enrollment.status, "ACTIVE");
      assert.strictEqual(enrollment.progress_pct, 0);

      // Verify Transaction recorded in ledger
      const tx = db.prepare("SELECT * FROM transactions WHERE id = ?").get(testTransactionId) as any;
      assert.ok(tx);
      assert.strictEqual(tx.student_id, freshStudentId);
      assert.strictEqual(tx.course_id, checkoutCourseId);
      assert.strictEqual(tx.amount_cents, 14900);
      assert.strictEqual(tx.platform_fee_cents, 1490);
      assert.strictEqual(tx.creator_payout_cents, 13410);
      assert.strictEqual(tx.status, "COMPLETED");

      // Verify SHA-256 Audit Log integrity
      const auditResult = verifyAuditLogIntegrity(db);
      assert.strictEqual(auditResult.isValid, true, "Audit log hash chain must remain valid after checkout");
    });

    it("3.6 POST /api/marketplace/checkout rejects duplicate purchase attempt", async () => {
      const req = new NextRequest("http://localhost:3000/api/marketplace/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: checkoutCourseId,
          student_id: freshStudentId,
        }),
      });

      const res = await executeCheckout(req);
      assert.strictEqual(res.status, 400);

      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, "ALREADY_ENROLLED");
    });

    it("3.7 POST /api/marketplace/checkout strictly rejects purchase with insufficient funds", async () => {
      const brokeStudentId = `usr_broke_${randomUUID().slice(0, 6)}`;
      const db = getDb();
      const now = new Date().toISOString();

      // Provision broke student with only $5.00 (500 cents)
      db.prepare(`
        INSERT OR REPLACE INTO users (id, email, name, role, department, job_title, is_active, created_at, updated_at)
        VALUES (?, ?, 'Broke Student', 'STUDENT', 'Learning', 'Student', 1, ?, ?)
      `).run(brokeStudentId, `${brokeStudentId}@test.lms`, now, now);

      db.prepare(`
        INSERT OR REPLACE INTO wallets (id, user_id, balance, balance_cents, currency, created_at, updated_at)
        VALUES (?, ?, 500, 500, 'USD', ?, ?)
      `).run(`wal_${brokeStudentId}`, brokeStudentId, now, now);

      const req = new NextRequest("http://localhost:3000/api/marketplace/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: "crs_zerotrust_sec_6w", // $79.00
          student_id: brokeStudentId,
        }),
      });

      const res = await executeCheckout(req);
      assert.strictEqual(res.status, 400);

      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, "INSUFFICIENT_FUNDS");
      assert.match(data.message, /Insufficient wallet balance/);
    });
  });

  // ==========================================================================
  // SUITE 4: Super Admin Platform Dashboard & Creator Content Privacy Shield
  // ==========================================================================
  describe("4. Super Admin Platform Dashboard & Creator Privacy Shield", () => {
    it("4.1 Accurately computes Platform GMV, 10% platform fee commission, and completed transactions count", () => {
      const db = getDb();
      const txStats = db.prepare(`
        SELECT 
          COALESCE(SUM(amount_cents), 0) as total_gmv_cents,
          COALESCE(SUM(platform_fee_cents), 0) as total_platform_cents,
          COUNT(*) as tx_count
        FROM transactions 
        WHERE status = 'COMPLETED'
      `).get() as any;

      assert.ok(txStats.total_gmv_cents > 0, "GMV must be positive from completed transactions");
      assert.ok(txStats.total_platform_cents > 0, "Platform fee commission must be positive");
      assert.ok(txStats.tx_count >= 1, "Completed transactions count must be >= 1");

      // Verify exact 10% platform commission on total transactions
      const feeRatio = txStats.total_platform_cents / txStats.total_gmv_cents;
      assert.ok(Math.abs(feeRatio - 0.10) < 0.01, "Platform fee must be approximately 10% across transactions");
    });

    it("4.2 Course titles are strictly masked with prefix + '... [Content Encrypted]' formula", () => {
      const rawTitle1 = "Cloud Native Architecture & Distributed Systems";
      const masked1 = maskCourseTitle(rawTitle1);
      assert.strictEqual(masked1, "Cloud ... [Content Encrypted]");

      const rawTitle2 = "Full-Stack AI Engineering & Production LLM Deployment";
      const masked2 = maskCourseTitle(rawTitle2);
      assert.strictEqual(masked2, "Full-S... [Content Encrypted]");

      const rawTitle3 = "Zero-Trust Cloud Security & DevSecOps Mastery";
      const masked3 = maskCourseTitle(rawTitle3);
      assert.strictEqual(masked3, "Zero-T... [Content Encrypted]");
    });

    it("4.3 Content Gate strictly blocks Super Admin from raw lesson video streams and file downloads", () => {
      const gateResult = checkContentGate("SUPER_ADMIN", false, false);
      assert.strictEqual(gateResult.allowed, false);
      assert.strictEqual(gateResult.status, 403);
      assert.strictEqual(gateResult.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
      assert.strictEqual(gateResult.errorCode, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
    });

    it("4.4 Content Gate allows enrolled Student and authoring Co-Admin full access to lessons", () => {
      const studentGate = checkContentGate("STUDENT", false, true);
      assert.strictEqual(studentGate.allowed, true);
      assert.strictEqual(studentGate.status, 200);

      const creatorGate = checkContentGate("CO_ADMIN", true, false);
      assert.strictEqual(creatorGate.allowed, true);
      assert.strictEqual(creatorGate.status, 200);
    });
  });
});
