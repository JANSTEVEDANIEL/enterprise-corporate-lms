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

describe("Marketplace Tier 4 — Real-World Marketplace Simulation Workloads (Opaque-Box E2E)", () => {
  let ctx: MarketplaceTestDatabaseContext;

  before(() => {
    ctx = createIsolatedMarketplaceDb("mkt_tier4");
    seedMarketplaceTestDb(ctx.db);
  });

  after(() => {
    ctx.cleanup();
  });

  // ==========================================================================
  // WORKLOAD 1: Multi-Persona Day-in-the-Life Marketplace Simulation
  // ==========================================================================
  describe("Workload 1: Multi-Persona Day-in-the-Life Marketplace Simulation", () => {
    const courseA = "crs_cloud_arch_7w"; // $99.99 by Elena
    const courseB = "crs_nextjs_mastery"; // $49.99 by Jordan
    const courseC = "crs_devops_fasttrack"; // $19.99 by Maya (new creator)

    before(() => {
      const now = new Date().toISOString();
      // Add Maya (Creator 3)
      ctx.db.prepare("INSERT INTO marketplace_users VALUES (?, ?, ?, 'CO_ADMIN', '', 'DevOps Lead', ?, ?)").run(
        "usr_creator_maya",
        "maya@edtech.market",
        "Maya Lin",
        now,
        now
      );
      ctx.db.prepare("INSERT INTO marketplace_wallets VALUES (?, ?, 0.0, 'USD', ?)").run(
        "wal_maya",
        "usr_creator_maya",
        now
      );

      // Add Carlos (Student 4)
      ctx.db.prepare("INSERT INTO marketplace_users VALUES (?, ?, ?, 'STUDENT', '', 'Junior Dev', ?, ?)").run(
        "usr_student_carlos",
        "carlos@edtech.market",
        "Carlos Mendez",
        now,
        now
      );
      ctx.db.prepare("INSERT INTO marketplace_wallets VALUES (?, ?, 300.0, 'USD', ?)").run(
        "wal_carlos",
        "usr_student_carlos",
        now
      );

      // Create Course B (Jordan)
      ctx.db.prepare(`
        INSERT INTO marketplace_courses (id, creator_id, title, slug, description, category, price, thumbnail_url, is_published, total_weeks, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'DEVELOPMENT', 49.99, '', 1, 4, ?, ?)
      `).run(courseB, MARKETPLACE_PERSONAS.jordan_creator.id, "Next.js 15 & React 19 Mastery (4 Weeks)", "nextjs-15-mastery", "", now, now);

      // Create Course C (Maya)
      ctx.db.prepare(`
        INSERT INTO marketplace_courses (id, creator_id, title, slug, description, category, price, thumbnail_url, is_published, total_weeks, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'DEVELOPMENT', 19.99, '', 1, 1, ?, ?)
      `).run(courseC, "usr_creator_maya", "Docker & Kubernetes Fast-Track (1 Week)", "docker-k8s-fast-track", "", now, now);
    });

    it("1.1 Students explore public marketplace and view available published inventory", () => {
      const published = ctx.db.prepare("SELECT id, title, price, total_weeks FROM marketplace_courses WHERE is_published = 1").all() as any[];
      assert.ok(published.length >= 4, "Should have at least 4 published courses");
      assert.ok(published.some((c) => c.id === courseA));
      assert.ok(published.some((c) => c.id === courseB));
      assert.ok(published.some((c) => c.id === courseC));
    });

    it("1.2 Four students execute purchases across different courses simultaneously", () => {
      // Alex buys Course B ($49.99)
      const resAlex = executeMarketplaceCheckout(ctx.db, MARKETPLACE_PERSONAS.alex_student.id, courseB);
      assert.strictEqual(resAlex.success, true);

      // Marcus buys Course A ($99.99)
      const resMarcus = executeMarketplaceCheckout(ctx.db, MARKETPLACE_PERSONAS.marcus_student.id, courseA);
      assert.strictEqual(resMarcus.success, true);

      // Carlos buys Course C ($19.99)
      const resCarlos = executeMarketplaceCheckout(ctx.db, "usr_student_carlos", courseC);
      assert.strictEqual(resCarlos.success, true);

      // Alex also buys Course C ($19.99)
      const resAlex2 = executeMarketplaceCheckout(ctx.db, MARKETPLACE_PERSONAS.alex_student.id, courseC);
      assert.strictEqual(resAlex2.success, true);
    });

    it("1.3 Each student's wallet is accurately debited without cross-account leakage", () => {
      const alexWallet = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?").get(
        MARKETPLACE_PERSONAS.alex_student.id
      ) as any;
      // 1000 - 49.99 - 19.99 = 930.02
      assert.strictEqual(Number(alexWallet.balance.toFixed(2)), 930.02);

      const marcusWallet = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?").get(
        MARKETPLACE_PERSONAS.marcus_student.id
      ) as any;
      // 500 - 99.99 = 400.01
      assert.strictEqual(Number(marcusWallet.balance.toFixed(2)), 400.01);

      const carlosWallet = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = 'usr_student_carlos'").get() as any;
      // 300 - 19.99 = 280.01
      assert.strictEqual(Number(carlosWallet.balance.toFixed(2)), 280.01);
    });

    it("1.4 All 3 creators receive their exact 90% revenue shares into isolated creator wallets", () => {
      // Elena sold Course A ($99.99) -> 90% = $89.99
      const elenaWallet = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?").get(
        MARKETPLACE_PERSONAS.elena_creator.id
      ) as any;
      assert.strictEqual(elenaWallet.balance, 89.99);

      // Jordan sold Course B ($49.99) -> 90% = $44.99
      const jordanWallet = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?").get(
        MARKETPLACE_PERSONAS.jordan_creator.id
      ) as any;
      assert.strictEqual(jordanWallet.balance, 44.99);

      // Maya sold Course C twice ($19.99 * 2 = $39.98) -> 90% = $17.99 * 2 = $35.98
      const mayaWallet = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = 'usr_creator_maya'").get() as any;
      assert.strictEqual(Number(mayaWallet.balance.toFixed(2)), 35.98);
    });

    it("1.5 Super Admin accumulates the exact 10% platform commission from all 4 transactions", () => {
      // 10% on Course B ($5.00) + 10% on Course A ($10.00) + 10% on Course C ($2.00 * 2 = $4.00) = $19.00
      const adminWallet = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?").get(
        MARKETPLACE_PERSONAS.david_super_admin.id
      ) as any;
      assert.strictEqual(Number(adminWallet.balance.toFixed(2)), 19.00);
    });
  });

  // ==========================================================================
  // WORKLOAD 2: Concurrent High-Velocity Student Purchase Rush & Balance Reconciliation
  // ==========================================================================
  describe("Workload 2: High-Velocity Purchases & Mathematical Reconciliation", () => {
    it("2.1 Simulates 20 rapid sequential purchases across courses and validates zero penny leakage", () => {
      // Create a dedicated course with fractional price $24.95
      const rushCourseId = "crs_rush_course_25";
      const now = new Date().toISOString();
      ctx.db.prepare(`
        INSERT INTO marketplace_courses (id, creator_id, title, slug, description, category, price, thumbnail_url, is_published, total_weeks, created_at, updated_at)
        VALUES (?, ?, ?, ?, '', 'DEVELOPMENT', 24.95, '', 1, 1, ?, ?)
      `).run(rushCourseId, MARKETPLACE_PERSONAS.elena_creator.id, "High Velocity React Patterns", "high-velocity-react", now, now);

      let totalGross = 0;
      let totalFees = 0;
      let totalPayouts = 0;

      for (let i = 1; i <= 20; i++) {
        const studentId = `usr_rush_student_${i}`;
        ctx.db.prepare("INSERT INTO marketplace_users VALUES (?, ?, ?, 'STUDENT', '', '', ?, ?)").run(
          studentId,
          `rush_${i}@test.com`,
          `Rush Student ${i}`,
          now,
          now
        );
        ctx.db.prepare("INSERT INTO marketplace_wallets VALUES (?, ?, 100.0, 'USD', ?)").run(
          `wal_rush_${i}`,
          studentId,
          now
        );

        const checkout = executeMarketplaceCheckout(ctx.db, studentId, rushCourseId);
        assert.strictEqual(checkout.success, true);
        assert.ok(checkout.split);

        totalGross += checkout.split.amountDollars;
        totalFees += checkout.split.platformFeeDollars;
        totalPayouts += checkout.split.creatorPayoutDollars;
      }

      // $24.95 * 20 = $499.00
      assert.strictEqual(Number(totalGross.toFixed(2)), 499.00);
      // Fee on $24.95 = $2.50 * 20 = $50.00
      assert.strictEqual(Number(totalFees.toFixed(2)), 50.00);
      // Payout on $24.95 = $22.45 * 20 = $449.00
      assert.strictEqual(Number(totalPayouts.toFixed(2)), 449.00);
      assert.strictEqual(Number((totalFees + totalPayouts).toFixed(2)), Number(totalGross.toFixed(2)));
    });

    it("2.2 Duplicate purchase attempts by same student in rapid succession are rejected with ALREADY_ENROLLED", () => {
      const res = executeMarketplaceCheckout(ctx.db, "usr_rush_student_1", "crs_rush_course_25");
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error, "ALREADY_ENROLLED");
    });
  });

  // ==========================================================================
  // WORKLOAD 3: Full End-to-End Student Learning Journey Simulation
  // ==========================================================================
  describe("Workload 3: Comprehensive Student Learning Journey & Progress Milestones", () => {
    const journeyCourseId = "crs_cloud_arch_7w";
    let enrollmentId: string;

    before(() => {
      // Alex purchases crs_cloud_arch_7w
      const res = executeMarketplaceCheckout(ctx.db, MARKETPLACE_PERSONAS.alex_student.id, journeyCourseId);
      if (!res.success && res.error === "ALREADY_ENROLLED") {
        const enr = ctx.db.prepare("SELECT id FROM marketplace_enrollments WHERE user_id = ? AND course_id = ?").get(
          MARKETPLACE_PERSONAS.alex_student.id,
          journeyCourseId
        ) as any;
        enrollmentId = enr.id;
      } else {
        enrollmentId = res.enrollmentId!;
      }
    });

    it("3.1 Student sets playback speed to 1.5x and watches partial lesson (300s)", () => {
      const progress = updateLessonProgressAndCheckCompletion(
        ctx.db,
        enrollmentId,
        "les_cloud_w1_1",
        false, // still in progress
        300
      );

      assert.strictEqual(progress.isCourseCompleted, false);

      const progRecord = ctx.db.prepare("SELECT playback_seconds, is_completed FROM marketplace_lesson_progress WHERE enrollment_id = ? AND lesson_id = ?").get(
        enrollmentId,
        "les_cloud_w1_1"
      ) as any;
      assert.strictEqual(progRecord.playback_seconds, 300);
      assert.strictEqual(progRecord.is_completed, 0);
    });

    it("3.2 Student resumes and marks lesson complete, incrementing progress", () => {
      const progress = updateLessonProgressAndCheckCompletion(
        ctx.db,
        enrollmentId,
        "les_cloud_w1_1",
        true,
        1200
      );

      assert.ok(progress.progressPct > 0);
      assert.strictEqual(progress.isCourseCompleted, false);
    });

    it("3.3 Completing half the course (7 of 14 lessons) achieves 50% progress without unlocking certificate", () => {
      // Mark lessons w1_2, w2_1, w2_2, w3_1, w3_2, w4_1 complete
      const lessonIds = [
        "les_cloud_w1_2",
        "les_cloud_w2_1",
        "les_cloud_w2_2",
        "les_cloud_w3_1",
        "les_cloud_w3_2",
        "les_cloud_w4_1",
      ];

      for (const id of lessonIds) {
        updateLessonProgressAndCheckCompletion(ctx.db, enrollmentId, id, true, 1000);
      }

      const enr = ctx.db.prepare("SELECT progress_pct, status, certificate_id FROM marketplace_enrollments WHERE id = ?").get(enrollmentId) as any;
      assert.strictEqual(enr.progress_pct, 50); // 7 / 14 = 50%
      assert.strictEqual(enr.status, "ACTIVE");
      assert.strictEqual(enr.certificate_id, null, "Certificate must remain locked at 50% completion");
    });

    it("3.4 Completing remaining 7 lessons reaches 100% and unlocks automated certificate", () => {
      const remainingLessonIds = [
        "les_cloud_w4_2",
        "les_cloud_w5_1",
        "les_cloud_w5_2",
        "les_cloud_w6_1",
        "les_cloud_w6_2",
        "les_cloud_w7_1",
        "les_cloud_w7_2",
      ];

      for (const id of remainingLessonIds) {
        updateLessonProgressAndCheckCompletion(ctx.db, enrollmentId, id, true, 1200);
      }

      const enr = ctx.db.prepare("SELECT progress_pct, status, certificate_id FROM marketplace_enrollments WHERE id = ?").get(enrollmentId) as any;
      assert.strictEqual(enr.progress_pct, 100);
      assert.strictEqual(enr.status, "COMPLETED");
      assert.ok(enr.certificate_id, "Certificate ID must be assigned");

      const cert = ctx.db.prepare("SELECT * FROM marketplace_certificates WHERE certificate_code = ?").get(enr.certificate_id) as any;
      assert.ok(cert);
      assert.strictEqual(cert.user_id, MARKETPLACE_PERSONAS.alex_student.id);
      assert.strictEqual(cert.score, 100.0);
    });
  });

  // ==========================================================================
  // WORKLOAD 4: Creator Payout Lifecycle & High-Volume Financial Settlement
  // ==========================================================================
  describe("Workload 4: Creator Payout Lifecycle & Settlement", () => {
    it("4.1 Creator Elena initiates multiple payout requests within current balance", () => {
      const elenaWallet = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?").get(
        MARKETPLACE_PERSONAS.elena_creator.id
      ) as any;
      assert.ok(elenaWallet.balance >= 100.0);

      // Payout 1: $50.00
      const p1 = createPayoutRequest(ctx.db, MARKETPLACE_PERSONAS.elena_creator.id, 50.0);
      assert.strictEqual(p1.success, true);

      // Payout 2: $40.00
      const p2 = createPayoutRequest(ctx.db, MARKETPLACE_PERSONAS.elena_creator.id, 40.0);
      assert.strictEqual(p2.success, true);
    });

    it("4.2 Platform operator processes payouts and creator wallet reflects accurate remaining balance", () => {
      const pending = ctx.db.prepare("SELECT id, amount FROM marketplace_payout_requests WHERE creator_id = ? AND status = 'PENDING'").all(
        MARKETPLACE_PERSONAS.elena_creator.id
      ) as any[];

      const beforeBalance = (ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?").get(
        MARKETPLACE_PERSONAS.elena_creator.id
      ) as any).balance;

      let totalProcessed = 0;
      for (const p of pending) {
        const res = processPayoutRequest(ctx.db, p.id);
        assert.strictEqual(res.success, true);
        totalProcessed += p.amount;
      }

      const afterBalance = (ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?").get(
        MARKETPLACE_PERSONAS.elena_creator.id
      ) as any).balance;

      assert.strictEqual(Number((beforeBalance - totalProcessed).toFixed(2)), Number(afterBalance.toFixed(2)));
    });

    it("4.3 Attempting to process an already PROCESSED payout request returns error", () => {
      const processedPayout = ctx.db.prepare("SELECT id FROM marketplace_payout_requests WHERE status = 'PROCESSED' LIMIT 1").get() as any;
      assert.ok(processedPayout);

      const res = processPayoutRequest(ctx.db, processedPayout.id);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error, "PAYOUT_ALREADY_PROCESSED");
    });
  });

  // ==========================================================================
  // WORKLOAD 5: Hostile Super Admin Inspection Resistance Simulation
  // ==========================================================================
  describe("Workload 5: Hostile Super Admin Platform Surveillance Resistance", () => {
    it("5.1 Super Admin crawler iterating entire marketplace catalog only receives masked titles", () => {
      const courses = ctx.db.prepare("SELECT id, title FROM marketplace_courses").all() as any[];
      assert.ok(courses.length >= 5);

      for (const c of courses) {
        const masked = maskCourseTitle(c.title, "SUPER_ADMIN", false, false);
        assert.ok(masked.endsWith("... [Content Encrypted]"), `Failed to mask title: ${c.title}`);
        assert.notStrictEqual(masked, c.title, "Original title must never be exposed to Super Admin");
      }
    });

    it("5.2 Super Admin crawler calling preview on all courses receives blurred flag and zero raw files", () => {
      const courses = ctx.db.prepare("SELECT id FROM marketplace_courses WHERE is_published = 1").all() as any[];

      for (const c of courses) {
        const preview = getCoursePreviewForUser(ctx.db, c.id, "SUPER_ADMIN");
        assert.ok(preview);
        assert.strictEqual(preview.is_blur_applied, true);
        assert.strictEqual(preview.raw_title, undefined);

        for (const week of preview.weeks) {
          for (const lesson of week.lessons) {
            assert.strictEqual(lesson.video_url, null, "Video URL leaked to Super Admin crawler");
            assert.deepStrictEqual(lesson.resources, [], "Resource files leaked to Super Admin crawler");
            assert.strictEqual(lesson.content_shield_active, true);
          }
        }
      }
    });

    it("5.3 Hostile direct SQL or API query simulation by Super Admin fails closed", () => {
      const allLessons = ctx.db.prepare("SELECT id FROM marketplace_lessons").all() as any[];
      assert.ok(allLessons.length >= 15);

      for (const l of allLessons) {
        const gate = checkContentGate("SUPER_ADMIN", false, false, false);
        assert.strictEqual(gate.allowed, false);
        assert.strictEqual(gate.status, 403);
        assert.strictEqual(gate.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
      }
    });
  });
});
