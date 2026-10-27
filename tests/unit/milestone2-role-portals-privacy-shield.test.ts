import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { initDb, getDb } from "../../src/lib/db";
import { dbAdapter } from "../../src/lib/supabase/adapter";
import { GET as getWalletRoute } from "../../src/app/api/wallet/route";
import { GET as getAdminStatsRoute } from "../../src/app/api/admin/stats/route";
import {
  GET as getStudioCoursesRoute,
} from "../../src/app/api/studio/courses/route";
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
import {
  GET as getStudioPayoutsRoute,
  POST as postStudioPayoutsRoute,
  PATCH as patchStudioPayoutsRoute,
} from "../../src/app/api/studio/payouts/route";
import { GET as getCourseRoute } from "../../src/app/api/courses/[courseId]/route";
import { maskCourseTitle } from "../../src/lib/privacy";

describe("Milestone 2: Three Pure Role Portals & Privacy Shield Hardening Suite", () => {
  before(() => {
    initDb();
    const db = getDb();

    // Ensure test user and courses exist
    try {
      db.prepare(`
        INSERT OR IGNORE INTO users (id, name, email, role, department, job_title, created_at, updated_at)
        VALUES ('usr_sophia_chen', 'Sophia Chen', 'sophia.chen@example.com', 'STUDENT', 'Design', 'Product Design Intern', datetime('now'), datetime('now'))
      `).run();
    } catch {}

    try {
      db.prepare(`
        INSERT OR IGNORE INTO users (id, name, email, role, department, job_title, created_at, updated_at)
        VALUES ('usr_aris_thorne', 'Dr. Aris Thorne', 'aris.thorne@example.com', 'CO_ADMIN', 'Computer Science', 'Distinguished Professor', datetime('now'), datetime('now'))
      `).run();
    } catch {}

    try {
      db.prepare(`
        INSERT OR IGNORE INTO users (id, name, email, role, department, job_title, created_at, updated_at)
        VALUES ('usr_david_kim', 'David Kim', 'david.kim@example.com', 'SUPER_ADMIN', 'Executive', 'Chief Platform Officer', datetime('now'), datetime('now'))
      `).run();
    } catch {}
  });

  // =========================================================================
  // SUITE 1: Feature 9 & 11 — Student Wallet Transaction Ledger & GET /api/wallet
  // =========================================================================
  describe("1. Student Wallet Transaction Ledger & GET /api/wallet", () => {
    it("1.1 GET /api/wallet returns wallet balance and transactions array for Sophia Chen", async () => {
      const req = new NextRequest("http://localhost:3000/api/wallet", {
        headers: { "x-lms-user-id": "usr_sophia_chen" },
      });
      const res = await getWalletRoute(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.user_id, "usr_sophia_chen");
      assert.ok(data.wallet, "Must return wallet object");
      assert.strictEqual(typeof data.wallet.balance_cents, "number");
      assert.strictEqual(typeof data.wallet.balance_dollars, "number");
      assert.strictEqual(data.wallet.currency, "USD");
      assert.ok(Array.isArray(data.transactions), "Must return transactions array");
    });

    it("1.2 GET /api/wallet supports query parameter ?user_id=...", async () => {
      const req = new NextRequest("http://localhost:3000/api/wallet?user_id=usr_sophia_chen");
      const res = await getWalletRoute(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.user_id, "usr_sophia_chen");
      assert.ok(data.wallet.balance_cents >= 0);
    });

    it("1.3 dbAdapter.getTransactionsForUser returns properly formatted transaction records", async () => {
      // Record a test transaction to verify ledger fields
      const db = getDb();
      const testTxId = `tx_test_${Date.now()}`;
      db.prepare(`
        INSERT OR REPLACE INTO transactions (
          id, course_id, student_id, creator_id,
          amount, amount_cents, platform_fee, platform_fee_cents,
          creator_earnings, creator_payout_cents, currency, status, created_at
        ) VALUES (?, 'crs_cloud_arch_7w', 'usr_sophia_chen', 'usr_aris_thorne', 4999, 4999, 500, 500, 4499, 4499, 'USD', 'COMPLETED', datetime('now'))
      `).run(testTxId);

      const transactions = await dbAdapter.getTransactionsForUser("usr_sophia_chen");
      assert.ok(Array.isArray(transactions), "Should return an array");
      assert.ok(transactions.length > 0, "Should have at least 1 transaction");

      const found = transactions.find((t: any) => t.id === testTxId);
      assert.ok(found, "Inserted test transaction should be retrieved");
      assert.strictEqual(found.type, "PURCHASE");
      assert.strictEqual(found.status, "COMPLETED");
      assert.strictEqual(found.amount_cents, 4999);
      assert.strictEqual(found.amount_dollars, 49.99);
      assert.ok(found.course_title, "Should include joined course title");
      assert.ok(found.created_at, "Should include created_at timestamp");
    });
  });

  // =========================================================================
  // SUITE 2: Feature 10 — Live Weekly Progress Bars & Multi-Week Milestones
  // =========================================================================
  describe("2. Live Weekly Progress Bars & Multi-Week Milestones Logic", () => {
    function computeWeeklyMilestones(totalWeeks: number, progressPct: number) {
      const validTotalWeeks = Math.max(1, totalWeeks);
      const completedWeeks =
        progressPct === 100
          ? validTotalWeeks
          : Math.min(validTotalWeeks, Math.floor((progressPct / 100) * validTotalWeeks));
      const activeWeek = completedWeeks < validTotalWeeks ? completedWeeks + 1 : validTotalWeeks;
      return { totalWeeks: validTotalWeeks, completedWeeks, activeWeek };
    }

    it("2.1 100% course completion yields completedWeeks equal to totalWeeks", () => {
      const result7w = computeWeeklyMilestones(7, 100);
      assert.strictEqual(result7w.completedWeeks, 7);
      assert.strictEqual(result7w.activeWeek, 7);

      const result4w = computeWeeklyMilestones(4, 100);
      assert.strictEqual(result4w.completedWeeks, 4);

      const result1w = computeWeeklyMilestones(1, 100);
      assert.strictEqual(result1w.completedWeeks, 1);
    });

    it("2.2 Partial course completion computes correct completed and active weeks", () => {
      // 50% on 4-week course: 2 weeks done, week 3 active
      const result4w = computeWeeklyMilestones(4, 50);
      assert.strictEqual(result4w.completedWeeks, 2);
      assert.strictEqual(result4w.activeWeek, 3);

      // 28% on 7-week course: Math.floor(0.28 * 7) = 1 week done, week 2 active
      const result7w = computeWeeklyMilestones(7, 28);
      assert.strictEqual(result7w.completedWeeks, 1);
      assert.strictEqual(result7w.activeWeek, 2);

      // 0% on 6-week course: 0 weeks done, week 1 active
      const result0 = computeWeeklyMilestones(6, 0);
      assert.strictEqual(result0.completedWeeks, 0);
      assert.strictEqual(result0.activeWeek, 1);
    });

    it("2.3 Completed weeks is always bounded within [0, totalWeeks]", () => {
      for (let pct = 0; pct <= 100; pct += 5) {
        for (let w = 1; w <= 12; w++) {
          const { completedWeeks, totalWeeks } = computeWeeklyMilestones(w, pct);
          assert.ok(completedWeeks >= 0, `completedWeeks must be >= 0 for ${pct}% of ${w} weeks`);
          assert.ok(completedWeeks <= totalWeeks, `completedWeeks cannot exceed totalWeeks for ${pct}% of ${w} weeks`);
        }
      }
    });
  });

  // =========================================================================
  // SUITE 3: Feature 12 — Co-Admin Studio 10% Platform Fee Metric & Analytics
  // =========================================================================
  describe("3. Co-Admin Studio 10% Platform Fee Metric & Analytics", () => {
    it("3.1 GET /api/studio/courses returns 3-way split metrics in analytics payload", async () => {
      const req = new NextRequest("http://localhost:3000/api/studio/courses", {
        headers: { "x-lms-user-id": "usr_aris_thorne" },
      });
      const res = await getStudioCoursesRoute(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.analytics, "Must include analytics object");

      const a = data.analytics;
      assert.strictEqual(typeof a.total_gross_cents, "number");
      assert.strictEqual(typeof a.total_gross_dollars, "number");
      assert.strictEqual(typeof a.total_platform_fee_cents, "number");
      assert.strictEqual(typeof a.total_platform_fee_dollars, "number");
      assert.strictEqual(typeof a.total_net_cents, "number");
      assert.strictEqual(typeof a.total_net_dollars, "number");

      // Verify exact 3-way split arithmetic invariant: Gross = Platform Fee + Net
      assert.strictEqual(
        a.total_gross_cents,
        a.total_platform_fee_cents + a.total_net_cents,
        "Zero-penny invariant: total_gross_cents must exactly equal total_platform_fee_cents + total_net_cents"
      );
    });

    it("3.2 Each enhanced course in /api/studio/courses includes platform_fee_cents and platform_fee_dollars", async () => {
      const req = new NextRequest("http://localhost:3000/api/studio/courses", {
        headers: { "x-lms-user-id": "usr_aris_thorne" },
      });
      const res = await getStudioCoursesRoute(req);
      const data = await res.json();

      assert.ok(Array.isArray(data.courses));
      for (const course of data.courses) {
        assert.strictEqual(typeof course.platform_fee_cents, "number");
        assert.strictEqual(typeof course.platform_fee_dollars, "number");
        assert.strictEqual(
          course.gross_revenue_cents,
          course.platform_fee_cents + course.creator_earnings_cents,
          "Per-course 3-way split arithmetic invariant must hold"
        );
      }
    });
  });

  // =========================================================================
  // SUITE 4: Feature 13 — Payout Status Progression Flow (PENDING -> PROCESSED)
  // =========================================================================
  describe("4. Payout Status Progression Flow", () => {
    let testPayoutId: string;

    it("4.1 POST /api/studio/payouts creates a payout with PENDING status", async () => {
      // First ensure creator has sufficient wallet balance
      const db = getDb();
      db.prepare("UPDATE wallets SET balance = 50000, balance_cents = 50000 WHERE user_id = 'usr_aris_thorne'").run();

      const req = new NextRequest("http://localhost:3000/api/studio/payouts", {
        method: "POST",
        headers: {
          "x-lms-user-id": "usr_aris_thorne",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount_cents: 5000,
          notes: "Automated test payout progression",
        }),
      });

      const res = await postStudioPayoutsRoute(req);
      assert.strictEqual(res.status, 201);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.payout.status, "PENDING");
      assert.strictEqual(data.payout.amount_cents, 5000);
      assert.strictEqual(data.payout.amount_dollars, 50.0);
      assert.ok(data.payout.id);

      testPayoutId = data.payout.id;
    });

    it("4.2 PATCH /api/studio/payouts transitions payout status to PROCESSED with processed_at", async () => {
      assert.ok(testPayoutId, "testPayoutId must be defined from previous step");

      const req = new NextRequest("http://localhost:3000/api/studio/payouts", {
        method: "PATCH",
        headers: {
          "x-lms-user-id": "usr_aris_thorne",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payout_id: testPayoutId,
          status: "PROCESSED",
        }),
      });

      const res = await patchStudioPayoutsRoute(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.payout.id, testPayoutId);
      assert.strictEqual(data.payout.status, "PROCESSED");
      assert.ok(data.payout.processed_at, "processed_at must be populated");
    });

    it("4.3 PATCH /api/studio/payouts rejects missing payout_id with 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/studio/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res = await patchStudioPayoutsRoute(req);
      assert.strictEqual(res.status, 400);

      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, "Missing required parameter: payout_id");
    });

    it("4.4 PATCH /api/studio/payouts rejects non-existent payout with 404", async () => {
      const req = new NextRequest("http://localhost:3000/api/studio/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payout_id: "po_non_existent_99999" }),
      });
      const res = await patchStudioPayoutsRoute(req);
      assert.strictEqual(res.status, 404);

      const data = await res.json();
      assert.strictEqual(data.success, false);
    });

    it("4.5 dbAdapter.processPayout transitions payout and returns updated object", async () => {
      // Create another payout in db directly
      const db = getDb();
      const directPayoutId = `po_adapter_test_${Date.now()}`;
      db.prepare(`
        INSERT INTO payouts (id, creator_id, amount, amount_cents, status, requested_at, notes)
        VALUES (?, 'usr_aris_thorne', 2500, 2500, 'PENDING', datetime('now'), 'Direct adapter test')
      `).run(directPayoutId);

      const updated = await dbAdapter.processPayout(directPayoutId, "PROCESSED");
      assert.ok(updated, "Must return updated payout");
      assert.strictEqual(updated.status, "PROCESSED");
      assert.strictEqual(updated.amount_cents, 2500);
      assert.strictEqual(updated.amount_dollars, 25.0);
      assert.ok(updated.processed_at);
    });
  });

  // =========================================================================
  // SUITE 5: Feature 14 — Creator Content Privacy Shield in Studio APIs
  // =========================================================================
  describe("5. Creator Content Privacy Shield in Studio APIs", () => {
    it("5.1 GET /api/studio/courses/[id] rejects Super Admin with 403 FORBIDDEN_SUPER_ADMIN_CONTENT_GATE", async () => {
      const req = new NextRequest("http://localhost:3000/api/studio/courses/crs_cloud_arch_7w", {
        headers: { "x-lms-user-id": "usr_david_kim" }, // Super Admin
      });
      const res = await getStudioCourseDetailRoute(req, {
        params: Promise.resolve({ id: "crs_cloud_arch_7w" }),
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
      assert.strictEqual(data.code, 403);
    });

    it("5.2 PATCH /api/studio/courses/[id] rejects Super Admin with 403", async () => {
      const req = new NextRequest("http://localhost:3000/api/studio/courses/crs_cloud_arch_7w", {
        method: "PATCH",
        headers: {
          "x-lms-user-id": "usr_david_kim",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: "Tampered Title" }),
      });
      const res = await patchStudioCourseDetailRoute(req, {
        params: Promise.resolve({ id: "crs_cloud_arch_7w" }),
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
    });

    it("5.3 DELETE /api/studio/courses/[id] rejects Super Admin with 403", async () => {
      const req = new NextRequest("http://localhost:3000/api/studio/courses/crs_cloud_arch_7w", {
        method: "DELETE",
        headers: { "x-lms-user-id": "usr_david_kim" },
      });
      const res = await deleteStudioCourseDetailRoute(req, {
        params: Promise.resolve({ id: "crs_cloud_arch_7w" }),
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
    });

    it("5.4 GET /api/studio/courses/[id]/weeks rejects Super Admin with 403", async () => {
      const req = new NextRequest("http://localhost:3000/api/studio/courses/crs_cloud_arch_7w/weeks", {
        headers: { "x-lms-user-id": "usr_david_kim" },
      });
      const res = await getStudioWeeksRoute(req, {
        params: Promise.resolve({ id: "crs_cloud_arch_7w" }),
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
      assert.strictEqual(data.code, 403);
    });

    it("5.5 POST /api/studio/courses/[id]/weeks rejects Super Admin with 403", async () => {
      const req = new NextRequest("http://localhost:3000/api/studio/courses/crs_cloud_arch_7w/weeks", {
        method: "POST",
        headers: {
          "x-lms-user-id": "usr_david_kim",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "ADD_WEEK", title: "Unauthorized Week" }),
      });
      const res = await postStudioWeeksRoute(req, {
        params: Promise.resolve({ id: "crs_cloud_arch_7w" }),
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
    });

    it("5.6 Co-Admin author can access GET /api/studio/courses/[id] and /weeks cleanly", async () => {
      const reqDetail = new NextRequest("http://localhost:3000/api/studio/courses/crs_cloud_arch_7w", {
        headers: { "x-lms-user-id": "usr_aris_thorne" },
      });
      const resDetail = await getStudioCourseDetailRoute(reqDetail, {
        params: Promise.resolve({ id: "crs_cloud_arch_7w" }),
      });
      assert.strictEqual(resDetail.status, 200);

      const reqWeeks = new NextRequest("http://localhost:3000/api/studio/courses/crs_cloud_arch_7w/weeks", {
        headers: { "x-lms-user-id": "usr_aris_thorne" },
      });
      const resWeeks = await getStudioWeeksRoute(reqWeeks, {
        params: Promise.resolve({ id: "crs_cloud_arch_7w" }),
      });
      assert.strictEqual(resWeeks.status, 200);
    });
  });

  // =========================================================================
  // SUITE 6: Feature 15 — Creator Content Privacy Shield in Course API
  // =========================================================================
  describe("6. Creator Content Privacy Shield in Course API (/api/courses/[courseId])", () => {
    it("6.1 GET /api/courses/[courseId] masks title and redacts module video URLs for Super Admin", async () => {
      const req = new NextRequest("http://localhost:3000/api/courses/crs_cloud_arch_7w", {
        headers: { "x-lms-user-id": "usr_david_kim" }, // Super Admin
      });
      const res = await getCourseRoute(req, {
        params: Promise.resolve({ courseId: "crs_cloud_arch_7w" }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.course, "Must return course");

      // Verify title is masked with Content Encrypted suffix
      assert.ok(
        data.course.title.includes("[Content Encrypted]"),
        `Expected title to be masked, got: ${data.course.title}`
      );
      assert.strictEqual(data.course.is_content_encrypted, true);
      assert.strictEqual(data.course.thumbnail_blurred, true);

      // Verify module contents and video URLs are redacted
      if (Array.isArray(data.modules) && data.modules.length > 0) {
        for (const mod of data.modules) {
          assert.strictEqual(mod.video_url, null, "Module video_url must be null for Super Admin");
          assert.strictEqual(mod.content, "[Content Encrypted - Super Admin Restricted]");
        }
      }
    });

    it("6.2 GET /api/courses/[courseId] preserves unmasked title for Student learner", async () => {
      const req = new NextRequest("http://localhost:3000/api/courses/crs_cloud_arch_7w", {
        headers: { "x-lms-user-id": "usr_sophia_chen" }, // Student
      });
      const res = await getCourseRoute(req, {
        params: Promise.resolve({ courseId: "crs_cloud_arch_7w" }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(!data.course.title.includes("[Content Encrypted]"), "Student must see unmasked title");
    });
  });

  // =========================================================================
  // SUITE 7: Feature 16 — Super Admin Payout Console & Platform Stats API
  // =========================================================================
  describe("7. Super Admin Payout Console & Platform Stats API", () => {
    it("7.1 GET /api/admin/stats returns GMV, 10% fee commission, and user metrics for Super Admin", async () => {
      const req = new NextRequest("http://localhost:3000/api/admin/stats", {
        headers: { "x-lms-user-id": "usr_david_kim" }, // Super Admin
      });
      const res = await getAdminStatsRoute(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.stats, "Must include stats object");

      const s = data.stats;
      assert.strictEqual(typeof s.gmv_cents, "number");
      assert.strictEqual(typeof s.gmv_dollars, "number");
      assert.strictEqual(typeof s.platform_fee_cents, "number");
      assert.strictEqual(typeof s.platform_fee_dollars, "number");
      assert.strictEqual(typeof s.completed_transactions, "number");
      assert.strictEqual(typeof s.payouts_processed_cents, "number");
      assert.strictEqual(typeof s.payouts_processed_dollars, "number");
      assert.strictEqual(typeof s.payouts_processed_count, "number");
      assert.strictEqual(typeof s.total_users, "number");
      assert.ok(s.total_users >= 3, "Expected at least 3 seeded users");
    });

    it("7.2 GET /api/admin/stats strictly rejects non-admin users with HTTP 403", async () => {
      const reqStudent = new NextRequest("http://localhost:3000/api/admin/stats", {
        headers: { "x-lms-user-id": "usr_sophia_chen" },
      });
      const resStudent = await getAdminStatsRoute(reqStudent);
      assert.strictEqual(resStudent.status, 403);

      const data = await resStudent.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, "FORBIDDEN_SUPER_ADMIN_REQUIRED");
    });

    it("7.3 GET /api/studio/payouts with Super Admin returns all platform payouts with creator details", async () => {
      const req = new NextRequest("http://localhost:3000/api/studio/payouts", {
        headers: { "x-lms-user-id": "usr_david_kim" },
      });
      const res = await getStudioPayoutsRoute(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.payouts), "Should return all payouts");
      if (data.payouts.length > 0) {
        assert.ok(data.payouts[0].creator_name, "Payout item should include creator_name");
      }
    });

    it("7.4 Super Admin approves and processes pending creator payout via PATCH /api/studio/payouts", async () => {
      // Create a pending payout for testing approval
      const db = getDb();
      const adminPayoutId = `po_admin_test_${Date.now()}`;
      db.prepare(`
        INSERT INTO payouts (id, creator_id, amount, amount_cents, status, requested_at, notes)
        VALUES (?, 'usr_aris_thorne', 12000, 12000, 'PENDING', datetime('now'), 'Admin approval test')
      `).run(adminPayoutId);

      const req = new NextRequest("http://localhost:3000/api/studio/payouts", {
        method: "PATCH",
        headers: {
          "x-lms-user-id": "usr_david_kim", // Super Admin approving
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payout_id: adminPayoutId,
          status: "PROCESSED",
        }),
      });

      const res = await patchStudioPayoutsRoute(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.payout.id, adminPayoutId);
      assert.strictEqual(data.payout.status, "PROCESSED");
      assert.ok(data.payout.processed_at);

      // Verify db persistence
      const row = db.prepare("SELECT * FROM payouts WHERE id = ?").get(adminPayoutId) as any;
      assert.strictEqual(row.status, "PROCESSED");
      assert.ok(row.processed_at);
    });
  });
});
