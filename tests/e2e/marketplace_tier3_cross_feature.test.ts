import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  createIsolatedMarketplaceDb,
  seedMarketplaceTestDb,
  MARKETPLACE_PERSONAS,
  calculateRevenueSplit,
  maskCourseTitle,
  checkContentGate,
  executeMarketplaceCheckout,
  updateLessonProgressAndCheckCompletion,
  createPayoutRequest,
  processPayoutRequest,
  getCoursePreviewForUser,
  type MarketplaceTestDatabaseContext,
} from "./marketplace_test_helpers";

describe("Marketplace Tier 3 — Cross-Feature Causal Combinations (Opaque-Box E2E)", () => {
  let ctx: MarketplaceTestDatabaseContext;

  before(() => {
    ctx = createIsolatedMarketplaceDb("mkt_tier3");
    seedMarketplaceTestDb(ctx.db);
  });

  after(() => {
    ctx.cleanup();
  });

  // ==========================================================================
  // CHAIN 1: The Canonical End-to-End Creator-to-Student Lifecycle
  // Co-Admin creates 7-week course -> Student buys course -> Student watches lessons ->
  // Progress reaches 100% -> Certificate minted -> Co-Admin checks earnings and requests payout.
  // ==========================================================================
  describe("Chain 1: Canonical 7-Week Marketplace Course Lifecycle", () => {
    const courseId = "crs_cloud_native_7w";
    let enrollmentId: string;
    let payoutId: string;
    let certCode: string;

    it("Step 1.1: Co-Admin Elena authors 7-week course ($120.00) with 14 lessons", () => {
      const now = new Date().toISOString();
      ctx.db.prepare(`
        INSERT INTO marketplace_courses (
          id, creator_id, title, slug, description, category, price, thumbnail_url, is_published, total_weeks, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 7, ?, ?)
      `).run(
        courseId,
        MARKETPLACE_PERSONAS.elena_creator.id,
        "Cloud-Native Distributed Systems on Kubernetes (7 Weeks)",
        "cloud-native-distributed-systems-7w",
        "Deep curriculum for high-scale backend engineers.",
        "DEVELOPMENT",
        120.00,
        "https://storage.edtech.market/thumbnails/k8s-7w.jpg",
        now,
        now
      );

      // Create 7 weeks with 2 lessons each
      for (let w = 1; w <= 7; w++) {
        const weekId = `wk_cn_${w}`;
        ctx.db.prepare(`
          INSERT INTO marketplace_weeks (id, course_id, week_number, title, description, order_index, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(weekId, courseId, w, `Week ${w}: Architecture & Labs`, "", w, now, now);

        ctx.db.prepare(`
          INSERT INTO marketplace_lessons (id, course_id, week_id, title, description, order_index, duration_seconds, video_url, resources, is_preview, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 1, 1000, ?, '[]', ?, ?, ?)
        `).run(`les_cn_w${w}_1`, courseId, weekId, `Lesson ${w}.1: Core Lecture`, "", `https://storage.edtech.market/videos/cn-w${w}-1.mp4`, w === 1 ? 1 : 0, now, now);

        ctx.db.prepare(`
          INSERT INTO marketplace_lessons (id, course_id, week_id, title, description, order_index, duration_seconds, video_url, resources, is_preview, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 2, 1500, ?, '[]', 0, ?, ?)
        `).run(`les_cn_w${w}_2`, courseId, weekId, `Lesson ${w}.2: Lab Implementation`, "", `https://storage.edtech.market/videos/cn-w${w}-2.mp4`, now, now);
      }

      const totalLessons = ctx.db.prepare("SELECT COUNT(*) as c FROM marketplace_lessons WHERE course_id = ?").get(courseId) as any;
      assert.strictEqual(totalLessons.c, 14);
    });

    it("Step 1.2: Prospective student Alex previews week 1 lesson 1 and initiates checkout", () => {
      const preview = getCoursePreviewForUser(ctx.db, courseId, "STUDENT", MARKETPLACE_PERSONAS.alex_student.id);
      assert.ok(preview);
      // Free preview lesson is playable
      assert.strictEqual(preview.weeks[0].lessons[0].video_url, "https://storage.edtech.market/videos/cn-w1-1.mp4");
      // Protected lesson is blocked
      assert.strictEqual(preview.weeks[0].lessons[1].video_url, null);

      const checkout = executeMarketplaceCheckout(ctx.db, MARKETPLACE_PERSONAS.alex_student.id, courseId);
      assert.strictEqual(checkout.success, true);
      assert.ok(checkout.enrollmentId);
      enrollmentId = checkout.enrollmentId!;
    });

    it("Step 1.3: Revenue split credits 90% ($108.00) to Elena and 10% ($12.00) to Super Admin", () => {
      const elenaWallet = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?").get(
        MARKETPLACE_PERSONAS.elena_creator.id
      ) as any;
      assert.strictEqual(elenaWallet.balance, 108.0); // 90% of $120.00

      const adminWallet = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?").get(
        MARKETPLACE_PERSONAS.david_super_admin.id
      ) as any;
      assert.strictEqual(adminWallet.balance, 12.0); // 10% of $120.00

      const alexWallet = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?").get(
        MARKETPLACE_PERSONAS.alex_student.id
      ) as any;
      assert.strictEqual(alexWallet.balance, 880.0); // 1000 - 120 = 880
    });

    it("Step 1.4: Alex completes all 14 lessons across 7 weeks, tracking progress sequentially", () => {
      for (let w = 1; w <= 7; w++) {
        const res1 = updateLessonProgressAndCheckCompletion(ctx.db, enrollmentId, `les_cn_w${w}_1`, true, 1000);
        const res2 = updateLessonProgressAndCheckCompletion(ctx.db, enrollmentId, `les_cn_w${w}_2`, true, 1500);

        if (w < 7) {
          assert.strictEqual(res2.isCourseCompleted, false);
          assert.ok(res2.progressPct < 100);
        } else {
          // Final lesson of week 7
          assert.strictEqual(res2.progressPct, 100);
          assert.strictEqual(res2.isCourseCompleted, true);
          assert.ok(res2.certificateCode);
          certCode = res2.certificateCode!;
        }
      }
    });

    it("Step 1.5: Verifiable certificate is issued to Alex with cryptographic verification hash", () => {
      const cert = ctx.db.prepare("SELECT * FROM marketplace_certificates WHERE certificate_code = ?").get(certCode) as any;
      assert.ok(cert);
      assert.strictEqual(cert.user_id, MARKETPLACE_PERSONAS.alex_student.id);
      assert.strictEqual(cert.course_id, courseId);
      assert.strictEqual(cert.user_name, "Alex Rivera");
      assert.strictEqual(cert.score, 100.0);
      assert.strictEqual(cert.verification_hash.length, 64);
    });

    it("Step 1.6: Elena inspects creator studio balance and requests $100.00 payout", () => {
      const req = createPayoutRequest(ctx.db, MARKETPLACE_PERSONAS.elena_creator.id, 100.0);
      assert.strictEqual(req.success, true);
      assert.ok(req.payoutId);
      payoutId = req.payoutId!;

      const payout = ctx.db.prepare("SELECT status FROM marketplace_payout_requests WHERE id = ?").get(payoutId) as any;
      assert.strictEqual(payout.status, "PENDING");
    });

    it("Step 1.7: Super Admin processes payout, debiting Elena's wallet down to $8.00 remaining", () => {
      const proc = processPayoutRequest(ctx.db, payoutId);
      assert.strictEqual(proc.success, true);

      const payout = ctx.db.prepare("SELECT status, processed_at FROM marketplace_payout_requests WHERE id = ?").get(payoutId) as any;
      assert.strictEqual(payout.status, "PROCESSED");
      assert.ok(payout.processed_at);

      const elenaWallet = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?").get(
        MARKETPLACE_PERSONAS.elena_creator.id
      ) as any;
      assert.strictEqual(Number(elenaWallet.balance.toFixed(2)), 8.0); // 108 - 100 = 8.00
    });
  });

  // ==========================================================================
  // CHAIN 2: Multi-Creator, Multi-Student Transactions & Ledger Aggregation
  // ==========================================================================
  describe("Chain 2: Multi-Creator Marketplace Transactions & Platform Fee Aggregation", () => {
    it("2.1 Student Marcus purchases Jordan's course for $149.99 after publication", () => {
      // Publish Jordan's course
      ctx.db.prepare("UPDATE marketplace_courses SET is_published = 1 WHERE id = 'crs_draft_ai_agent'").run();

      const marcusBefore = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?").get(
        MARKETPLACE_PERSONAS.marcus_student.id
      ) as any;
      assert.strictEqual(marcusBefore.balance, 500.0);

      const checkout = executeMarketplaceCheckout(ctx.db, MARKETPLACE_PERSONAS.marcus_student.id, "crs_draft_ai_agent");
      assert.strictEqual(checkout.success, true);

      const marcusAfter = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?").get(
        MARKETPLACE_PERSONAS.marcus_student.id
      ) as any;
      assert.strictEqual(marcusAfter.balance, 350.01); // 500 - 149.99 = 350.01

      // Jordan gets 90% ($134.99)
      const jordanWallet = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?").get(
        MARKETPLACE_PERSONAS.jordan_creator.id
      ) as any;
      assert.strictEqual(jordanWallet.balance, 134.99);

      // Super Admin gets 10% ($15.00)
      const adminWallet = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?").get(
        MARKETPLACE_PERSONAS.david_super_admin.id
      ) as any;
      // Previous admin was $12.00 + $15.00 = $27.00
      assert.strictEqual(adminWallet.balance, 27.0);
    });

    it("2.2 Super Admin platform ledger records all distinct transactions with matching total GMV", () => {
      const txs = ctx.db.prepare("SELECT amount, platform_fee, creator_payout FROM marketplace_transactions").all() as any[];
      assert.strictEqual(txs.length, 2);

      const totalGmv = txs.reduce((sum, tx) => sum + tx.amount, 0);
      const totalFees = txs.reduce((sum, tx) => sum + tx.platform_fee, 0);
      const totalCreatorPayouts = txs.reduce((sum, tx) => sum + tx.creator_payout, 0);

      assert.strictEqual(Number(totalGmv.toFixed(2)), 269.99); // 120 + 149.99 = 269.99
      assert.strictEqual(Number(totalFees.toFixed(2)), 27.0); // 12 + 15 = 27.00
      assert.strictEqual(Number(totalCreatorPayouts.toFixed(2)), 242.99); // 108 + 134.99 = 242.99
      assert.strictEqual(Number((totalFees + totalCreatorPayouts).toFixed(2)), totalGmv);
    });
  });

  // ==========================================================================
  // CHAIN 3: Super Admin Privacy Shield Surveillance Barrier
  // ==========================================================================
  describe("Chain 3: Super Admin Surveillance vs Creator Content Privacy Shield", () => {
    it("3.1 Super Admin viewing courses sees masked titles across all creator catalogs", () => {
      const courses = ctx.db.prepare("SELECT title FROM marketplace_courses WHERE is_published = 1").all() as any[];
      for (const c of courses) {
        const masked = maskCourseTitle(c.title, "SUPER_ADMIN", false, false);
        assert.ok(masked.endsWith("... [Content Encrypted]"), `Title "${c.title}" must be masked for Super Admin`);
      }
    });

    it("3.2 Super Admin attempting direct streaming from all 14 lessons of Elena's course is rejected", () => {
      const lessons = ctx.db.prepare("SELECT id FROM marketplace_lessons WHERE course_id = 'crs_cloud_native_7w'").all() as any[];
      assert.strictEqual(lessons.length, 14);

      for (const l of lessons) {
        const gate = checkContentGate("SUPER_ADMIN", false, false, false);
        assert.strictEqual(gate.allowed, false);
        assert.strictEqual(gate.status, 403);
        assert.strictEqual(gate.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
      }
    });

    it("3.3 Authoring Co-Admin and enrolled Student can stream every single lesson without restriction", () => {
      const lessons = ctx.db.prepare("SELECT id FROM marketplace_lessons WHERE course_id = 'crs_cloud_native_7w'").all() as any[];

      for (const l of lessons) {
        const authorGate = checkContentGate("CO_ADMIN", true, false, false);
        assert.strictEqual(authorGate.allowed, true);

        const studentGate = checkContentGate("STUDENT", false, true, false);
        assert.strictEqual(studentGate.allowed, true);
      }
    });
  });

  // ==========================================================================
  // CHAIN 4: Course Unpublishing / Archival Access Invariants
  // ==========================================================================
  describe("Chain 4: Unpublishing & Existing Student Continuity", () => {
    it("4.1 Co-Admin unpublishes course: hidden from marketplace public catalog", () => {
      ctx.db.prepare("UPDATE marketplace_courses SET is_published = 0 WHERE id = 'crs_cloud_native_7w'").run();

      const publicSearch = ctx.db.prepare("SELECT id FROM marketplace_courses WHERE is_published = 1 AND id = 'crs_cloud_native_7w'").get();
      assert.strictEqual(publicSearch, undefined, "Unpublished course must disappear from marketplace catalog");
    });

    it("4.2 New student cannot purchase unpublished course", () => {
      const res = executeMarketplaceCheckout(ctx.db, MARKETPLACE_PERSONAS.marcus_student.id, "crs_cloud_native_7w");
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error, "COURSE_NOT_PUBLISHED");
    });

    it("4.3 Enrolled student Alex continues to have full learning access to unpublished course", () => {
      const alexPreview = getCoursePreviewForUser(
        ctx.db,
        "crs_cloud_native_7w",
        "STUDENT",
        MARKETPLACE_PERSONAS.alex_student.id
      );
      assert.ok(alexPreview);
      // Still has access to full lesson videos
      assert.strictEqual(alexPreview.weeks[0].lessons[1].video_url, "https://storage.edtech.market/videos/cn-w1-2.mp4");
      assert.strictEqual(alexPreview.weeks[0].lessons[1].content_shield_active, false);
    });
  });
});
