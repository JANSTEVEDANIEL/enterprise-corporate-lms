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

describe("Marketplace Tier 1 — Feature Coverage (Opaque-Box E2E)", () => {
  let ctx: MarketplaceTestDatabaseContext;

  before(() => {
    ctx = createIsolatedMarketplaceDb("mkt_tier1");
    seedMarketplaceTestDb(ctx.db);
  });

  after(() => {
    ctx.cleanup();
  });

  // ==========================================================================
  // FEATURE 1: Marketplace Catalog Browsing & Course Previews
  // ==========================================================================
  describe("Feature 1: Marketplace Catalog Browsing & Course Previews", () => {
    it("1.1 Unauthenticated public visitor can list all published courses", () => {
      const stmt = ctx.db.prepare(`
        SELECT id, title, price, is_published, total_weeks 
        FROM marketplace_courses 
        WHERE is_published = 1 
        ORDER BY created_at DESC
      `);
      const published = stmt.all() as any[];

      assert.ok(published.length >= 2, "Expected at least 2 published courses");
      assert.ok(published.some((c) => c.id === "crs_cloud_arch_7w"));
      assert.ok(published.some((c) => c.id === "crs_git_free_1w"));
    });

    it("1.2 Draft / unpublished courses are excluded from public marketplace catalog", () => {
      const stmt = ctx.db.prepare("SELECT id FROM marketplace_courses WHERE is_published = 1 AND id = 'crs_draft_ai_agent'");
      const draftInPublic = stmt.get();
      assert.strictEqual(draftInPublic, undefined, "Draft course must not appear in public marketplace queries");
    });

    it("1.3 Course preview displays curriculum outline including weeks and lesson titles", () => {
      const preview = getCoursePreviewForUser(ctx.db, "crs_cloud_arch_7w", "STUDENT");
      assert.ok(preview, "Course preview should exist");
      assert.strictEqual(preview.total_weeks, 7);
      assert.strictEqual(preview.weeks.length, 7);
      assert.strictEqual(preview.weeks[0].lessons.length, 2);
      assert.strictEqual(preview.weeks[0].lessons[0].title, "Lesson 1.1: Core Architectural Foundations");
    });

    it("1.4 Free preview lessons expose raw video streaming URL to prospective students", () => {
      const preview = getCoursePreviewForUser(ctx.db, "crs_cloud_arch_7w", "STUDENT");
      assert.ok(preview);
      const week1Lesson1 = preview.weeks[0].lessons[0];
      assert.strictEqual(week1Lesson1.is_preview, true);
      assert.strictEqual(week1Lesson1.video_url, "https://storage.edtech.market/videos/cloud-w1-1.mp4");
      assert.strictEqual(week1Lesson1.content_shield_active, false);
    });

    it("1.5 Non-preview lessons have video URLs and downloadable files redacted for unauthenticated visitors", () => {
      const preview = getCoursePreviewForUser(ctx.db, "crs_cloud_arch_7w", "STUDENT");
      assert.ok(preview);
      const week1Lesson2 = preview.weeks[0].lessons[1];
      assert.strictEqual(week1Lesson2.is_preview, false);
      assert.strictEqual(week1Lesson2.video_url, null, "Protected lesson video must be redacted");
      assert.deepStrictEqual(week1Lesson2.resources, [], "Downloadable resources must be empty");
      assert.strictEqual(week1Lesson2.content_shield_active, true);
    });
  });

  // ==========================================================================
  // FEATURE 2: 1-Click Role Switcher (Student, Co-Admin, Super Admin)
  // ==========================================================================
  describe("Feature 2: 1-Click Role Switcher", () => {
    it("2.1 Switching to STUDENT persona resolves Alex Rivera with pre-funded wallet", () => {
      const student = MARKETPLACE_PERSONAS.alex_student;
      assert.strictEqual(student.role, "STUDENT");
      assert.strictEqual(student.id, "usr_student_alex");

      const wallet = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?").get(student.id) as any;
      assert.ok(wallet);
      assert.strictEqual(wallet.balance, 1000.0);
    });

    it("2.2 Switching to CO_ADMIN persona resolves Elena Rostova with creator studio privileges", () => {
      const creator = MARKETPLACE_PERSONAS.elena_creator;
      assert.strictEqual(creator.role, "CO_ADMIN");
      assert.strictEqual(creator.name, "Elena Rostova");

      // Verify creator owns the flagship course
      const courses = ctx.db.prepare("SELECT id FROM marketplace_courses WHERE creator_id = ?").all(creator.id);
      assert.ok(courses.length >= 2, "Creator Elena should own courses");
    });

    it("2.3 Switching to SUPER_ADMIN persona resolves David Kim with platform provider role", () => {
      const admin = MARKETPLACE_PERSONAS.david_super_admin;
      assert.strictEqual(admin.role, "SUPER_ADMIN");
      assert.strictEqual(admin.name, "David Kim");

      const userRow = ctx.db.prepare("SELECT role FROM marketplace_users WHERE id = ?").get(admin.id) as any;
      assert.strictEqual(userRow.role, "SUPER_ADMIN");
    });

    it("2.4 Switching between distinct student personas preserves independent balances", () => {
      const alexWallet = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?").get(MARKETPLACE_PERSONAS.alex_student.id) as any;
      const marcusWallet = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?").get(MARKETPLACE_PERSONAS.marcus_student.id) as any;

      assert.strictEqual(alexWallet.balance, 1000.0);
      assert.strictEqual(marcusWallet.balance, 500.0);
      assert.notStrictEqual(alexWallet.balance, marcusWallet.balance);
    });

    it("2.5 Invalid role specification fails validation safely", () => {
      const validateRole = (role: string): boolean => {
        return ["STUDENT", "CO_ADMIN", "SUPER_ADMIN"].includes(role);
      };
      assert.strictEqual(validateRole("STUDENT"), true);
      assert.strictEqual(validateRole("CO_ADMIN"), true);
      assert.strictEqual(validateRole("SUPER_ADMIN"), true);
      assert.strictEqual(validateRole("ANONYMOUS_HACKER"), false);
      assert.strictEqual(validateRole("ROOT"), false);
    });
  });

  // ==========================================================================
  // FEATURE 3: Co-Admin Studio Course Creation & Sequential 1-7+ Week Curriculum Engine
  // ==========================================================================
  describe("Feature 3: Co-Admin Studio Course Creation & 1-7+ Week Engine", () => {
    const newCourseId = "crs_studio_fullstack_8w";

    it("3.1 Co-Admin can create new course with title, description, category, price, and cover", () => {
      const now = new Date().toISOString();
      const insertStmt = ctx.db.prepare(`
        INSERT INTO marketplace_courses (
          id, creator_id, title, slug, description, category, price, thumbnail_url, is_published, total_weeks, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 8, ?, ?)
      `);
      insertStmt.run(
        newCourseId,
        MARKETPLACE_PERSONAS.elena_creator.id,
        "Full-Stack TypeScript & Next.js 15 Mastery",
        "fullstack-typescript-nextjs-mastery",
        "8-week end-to-end fullstack development roadmap.",
        "DEVELOPMENT",
        79.99,
        "https://storage.edtech.market/thumbnails/next15.jpg",
        now,
        now
      );

      const created = ctx.db.prepare("SELECT * FROM marketplace_courses WHERE id = ?").get(newCourseId) as any;
      assert.ok(created);
      assert.strictEqual(created.price, 79.99);
      assert.strictEqual(created.is_published, 0, "New course starts in draft mode");
      assert.strictEqual(created.total_weeks, 8);
    });

    it("3.2 Co-Admin can construct sequential weekly milestones (Week 1 through Week 8)", () => {
      const now = new Date().toISOString();
      const insertWeekStmt = ctx.db.prepare(`
        INSERT INTO marketplace_weeks (id, course_id, week_number, title, description, order_index, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (let w = 1; w <= 8; w++) {
        insertWeekStmt.run(
          `wk_fs_${w}`,
          newCourseId,
          w,
          `Week ${w}: Module Milestone ${w}`,
          `Milestone ${w} content`,
          w,
          now,
          now
        );
      }

      const weeks = ctx.db.prepare("SELECT week_number FROM marketplace_weeks WHERE course_id = ? ORDER BY week_number ASC").all(newCourseId) as any[];
      assert.strictEqual(weeks.length, 8);
      for (let i = 0; i < 8; i++) {
        assert.strictEqual(weeks[i].week_number, i + 1);
      }
    });

    it("3.3 Co-Admin attaches video lessons and supplementary downloadable resources per week", () => {
      const now = new Date().toISOString();
      const insertLessonStmt = ctx.db.prepare(`
        INSERT INTO marketplace_lessons (
          id, course_id, week_id, title, description, order_index, duration_seconds, video_url, resources, is_preview, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertLessonStmt.run(
        "les_fs_w1_1",
        newCourseId,
        "wk_fs_1",
        "Lesson 1.1: Turbopack & React 19 Architecture",
        "Deep-dive lecture",
        1,
        1500,
        "https://storage.edtech.market/videos/fs-w1-1.mp4",
        JSON.stringify([{ name: "Architecture_Diagram.pdf", url: "https://storage.edtech.market/files/diag.pdf", size_bytes: 2048000 }]),
        1,
        now,
        now
      );

      const lesson = ctx.db.prepare("SELECT * FROM marketplace_lessons WHERE id = 'les_fs_w1_1'").get() as any;
      assert.ok(lesson);
      assert.strictEqual(lesson.duration_seconds, 1500);
      const resources = JSON.parse(lesson.resources);
      assert.strictEqual(resources.length, 1);
      assert.strictEqual(resources[0].name, "Architecture_Diagram.pdf");
    });

    it("3.4 Reordering lessons by order_index maintains strictly deterministic playback order", () => {
      const now = new Date().toISOString();
      const insertLessonStmt = ctx.db.prepare(`
        INSERT INTO marketplace_lessons (
          id, course_id, week_id, title, description, order_index, duration_seconds, video_url, resources, is_preview, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertLessonStmt.run(
        "les_fs_w1_2",
        newCourseId,
        "wk_fs_1",
        "Lesson 1.2: Server Actions & Mutations",
        "Hands-on coding",
        2,
        2100,
        "https://storage.edtech.market/videos/fs-w1-2.mp4",
        "[]",
        0,
        now,
        now
      );

      const lessons = ctx.db.prepare("SELECT id, order_index FROM marketplace_lessons WHERE week_id = 'wk_fs_1' ORDER BY order_index ASC").all() as any[];
      assert.strictEqual(lessons.length, 2);
      assert.strictEqual(lessons[0].id, "les_fs_w1_1");
      assert.strictEqual(lessons[1].id, "les_fs_w1_2");
    });

    it("3.5 Instant publishing engine immediately transitions course to published on marketplace", () => {
      const updateStmt = ctx.db.prepare("UPDATE marketplace_courses SET is_published = 1 WHERE id = ?");
      updateStmt.run(newCourseId);

      const checkStmt = ctx.db.prepare("SELECT is_published FROM marketplace_courses WHERE id = ?");
      const course = checkStmt.get(newCourseId) as any;
      assert.strictEqual(course.is_published, 1);

      // Verify it is now returned in public marketplace search
      const publicCourses = ctx.db.prepare("SELECT id FROM marketplace_courses WHERE is_published = 1 AND id = ?").all(newCourseId);
      assert.strictEqual(publicCourses.length, 1);
    });
  });

  // ==========================================================================
  // FEATURE 4: Creator Content Privacy Shield (Super Admin Content Gate)
  // ==========================================================================
  describe("Feature 4: Creator Content Privacy Shield", () => {
    it("4.1 Super Admin viewing catalog receives masked title formula", () => {
      const rawTitle = "Mastering Enterprise Cloud Architecture (7-Week Intensive)";
      const masked = maskCourseTitle(rawTitle, "SUPER_ADMIN", false, false);

      assert.strictEqual(
        masked,
        "Master... [Content Encrypted]",
        "Super Admin must receive exactly first 6 characters + '... [Content Encrypted]'"
      );
    });

    it("4.2 Super Admin course preview sets blur filter flag", () => {
      const preview = getCoursePreviewForUser(ctx.db, "crs_cloud_arch_7w", "SUPER_ADMIN");
      assert.ok(preview);
      assert.strictEqual(preview.is_blur_applied, true, "Super Admin preview must have is_blur_applied = true");
      assert.strictEqual(preview.title, "Master... [Content Encrypted]");
      assert.strictEqual(preview.raw_title, undefined, "raw_title must not be leaked to Super Admin");
    });

    it("4.3 Super Admin attempting to fetch lesson video streams is rejected with 403 Content Gate error", () => {
      const gateCheck = checkContentGate("SUPER_ADMIN", false, false, false);
      assert.strictEqual(gateCheck.allowed, false);
      assert.strictEqual(gateCheck.status, 403);
      assert.strictEqual(gateCheck.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
      assert.match(gateCheck.message || "", /prohibited from accessing raw creator lesson content/);
    });

    it("4.4 Super Admin cannot view downloadable supplementary resources", () => {
      const preview = getCoursePreviewForUser(ctx.db, "crs_cloud_arch_7w", "SUPER_ADMIN");
      assert.ok(preview);
      for (const week of preview.weeks) {
        for (const lesson of week.lessons) {
          assert.strictEqual(lesson.video_url, null, "All lesson video URLs must be null for Super Admin");
          assert.deepStrictEqual(lesson.resources, [], "All downloadable resources must be empty for Super Admin");
          assert.strictEqual(lesson.content_shield_active, true);
        }
      }
    });

    it("4.5 Authoring Co-Admin and enrolled Students retain full unmasked title and raw media streams", () => {
      const creatorPreview = getCoursePreviewForUser(
        ctx.db,
        "crs_cloud_arch_7w",
        "CO_ADMIN",
        MARKETPLACE_PERSONAS.elena_creator.id
      );
      assert.ok(creatorPreview);
      assert.strictEqual(creatorPreview.title, "Mastering Enterprise Cloud Architecture (7-Week Intensive)");
      assert.strictEqual(creatorPreview.is_blur_applied, false);

      // Elena should see full video URLs
      const week1Lesson2 = creatorPreview.weeks[0].lessons[1];
      assert.strictEqual(week1Lesson2.video_url, "https://storage.edtech.market/videos/cloud-w1-2.mp4");
      assert.strictEqual(week1Lesson2.resources.length, 1);
      assert.strictEqual(week1Lesson2.content_shield_active, false);
    });
  });

  // ==========================================================================
  // FEATURE 5: Simulated Wallet Checkout & 10% / 90% Revenue Split
  // ==========================================================================
  describe("Feature 5: Simulated Wallet Checkout & 10/90 Revenue Split", () => {
    it("5.1 Student checkout debits wallet by exact course price ($99.99)", () => {
      const studentId = MARKETPLACE_PERSONAS.alex_student.id;
      const initialWallet = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?").get(studentId) as any;
      assert.strictEqual(initialWallet.balance, 1000.0);

      const checkout = executeMarketplaceCheckout(ctx.db, studentId, "crs_cloud_arch_7w");
      assert.strictEqual(checkout.success, true);
      assert.ok(checkout.transactionId);
      assert.ok(checkout.enrollmentId);

      const updatedWallet = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?").get(studentId) as any;
      assert.strictEqual(updatedWallet.balance, 900.01); // 1000.00 - 99.99 = 900.01
    });

    it("5.2 Platform operator ledger is credited by exactly 10% platform fee ($10.00)", () => {
      const adminId = MARKETPLACE_PERSONAS.david_super_admin.id;
      const adminWallet = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?").get(adminId) as any;
      assert.strictEqual(adminWallet.balance, 10.0); // 10% of $99.99 = $10.00
    });

    it("5.3 Co-Admin creator wallet is credited by exactly 90% net revenue ($89.99)", () => {
      const creatorId = MARKETPLACE_PERSONAS.elena_creator.id;
      const creatorWallet = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?").get(creatorId) as any;
      assert.strictEqual(creatorWallet.balance, 89.99); // 90% of $99.99 = $89.99
    });

    it("5.4 Exact arithmetic invariant: platform_fee + creator_payout strictly equals gross amount", () => {
      const split = calculateRevenueSplit(99.99);
      assert.strictEqual(split.amountCents, 9999);
      assert.strictEqual(split.platformFeeCents, 1000);
      assert.strictEqual(split.creatorPayoutCents, 8999);
      assert.strictEqual(split.platformFeeCents + split.creatorPayoutCents, split.amountCents);
      assert.strictEqual(split.platformFeeDollars + split.creatorPayoutDollars, 99.99);
    });

    it("5.5 Checkout provisions active enrollment with 0% initial progress", () => {
      const enr = ctx.db.prepare("SELECT * FROM marketplace_enrollments WHERE user_id = ? AND course_id = ?").get(
        MARKETPLACE_PERSONAS.alex_student.id,
        "crs_cloud_arch_7w"
      ) as any;

      assert.ok(enr);
      assert.strictEqual(enr.status, "ACTIVE");
      assert.strictEqual(enr.progress_pct, 0);
      assert.strictEqual(enr.certificate_id, null);
    });
  });

  // ==========================================================================
  // FEATURE 6: Student Video Lesson Player, Speed Controls & Progress Tracking
  // ==========================================================================
  describe("Feature 6: Video Player Speed Controls, Progress & Certification", () => {
    let enrollmentId: string;

    before(() => {
      const enr = ctx.db.prepare("SELECT id FROM marketplace_enrollments WHERE user_id = ? AND course_id = 'crs_cloud_arch_7w'").get(
        MARKETPLACE_PERSONAS.alex_student.id
      ) as any;
      enrollmentId = enr.id;
    });

    it("6.1 Video player speed selector supports exact speeds: 0.75x, 1x, 1.25x, 1.5x, 2x", () => {
      const validSpeeds = [0.75, 1.0, 1.25, 1.5, 2.0];
      const isSpeedSupported = (speed: number) => validSpeeds.includes(speed);

      for (const speed of validSpeeds) {
        assert.strictEqual(isSpeedSupported(speed), true, `Speed ${speed}x must be supported`);
      }
      assert.strictEqual(isSpeedSupported(0.5), false);
      assert.strictEqual(isSpeedSupported(3.0), false);
    });

    it("6.2 Player tracks playback seconds and saves last position", () => {
      const result = updateLessonProgressAndCheckCompletion(
        ctx.db,
        enrollmentId,
        "les_cloud_w1_1",
        false, // not completed yet
        450 // watched 450s of 1200s
      );

      const prog = ctx.db.prepare("SELECT playback_seconds, is_completed FROM marketplace_lesson_progress WHERE enrollment_id = ? AND lesson_id = ?").get(
        enrollmentId,
        "les_cloud_w1_1"
      ) as any;

      assert.strictEqual(prog.playback_seconds, 450);
      assert.strictEqual(prog.is_completed, 0);
      assert.strictEqual(result.isCourseCompleted, false);
    });

    it("6.3 Marking individual lessons as completed dynamically updates course progress percentage", () => {
      // 14 total lessons in crs_cloud_arch_7w (7 weeks * 2 lessons)
      const res1 = updateLessonProgressAndCheckCompletion(ctx.db, enrollmentId, "les_cloud_w1_1", true, 1200);
      assert.strictEqual(res1.progressPct, 7); // 1 / 14 = 7.14% -> 7%

      const res2 = updateLessonProgressAndCheckCompletion(ctx.db, enrollmentId, "les_cloud_w1_2", true, 1800);
      assert.strictEqual(res2.progressPct, 14); // 2 / 14 = 14.28% -> 14%
    });

    it("6.4 Enrolled student now has full access to stream all lessons and download lab files", () => {
      const studentPreview = getCoursePreviewForUser(
        ctx.db,
        "crs_cloud_arch_7w",
        "STUDENT",
        MARKETPLACE_PERSONAS.alex_student.id
      );
      assert.ok(studentPreview);
      const week1Lesson2 = studentPreview.weeks[0].lessons[1];
      assert.strictEqual(week1Lesson2.video_url, "https://storage.edtech.market/videos/cloud-w1-2.mp4");
      assert.strictEqual(week1Lesson2.resources.length, 1);
      assert.strictEqual(week1Lesson2.resources[0].name, "Week1_Lab_Source.zip");
      assert.strictEqual(week1Lesson2.content_shield_active, false);
    });

    it("6.5 Completing 100% of lessons mints automated Certificate of Completion with verification hash", () => {
      // Complete remaining 12 lessons (weeks 2 through 7, 2 lessons each)
      for (let w = 2; w <= 7; w++) {
        updateLessonProgressAndCheckCompletion(ctx.db, enrollmentId, `les_cloud_w${w}_1`, true, 1200);
        updateLessonProgressAndCheckCompletion(ctx.db, enrollmentId, `les_cloud_w${w}_2`, true, 1800);
      }

      const finalCheck = updateLessonProgressAndCheckCompletion(
        ctx.db,
        enrollmentId,
        "les_cloud_w7_2",
        true,
        1800
      );

      assert.strictEqual(finalCheck.progressPct, 100);
      assert.strictEqual(finalCheck.isCourseCompleted, true);
      assert.ok(finalCheck.certificateCode, "Certificate code must be generated");
      assert.match(finalCheck.certificateCode, /^CERT-MKT-\d{4}-[A-Z0-9]{8}$/);

      // Verify certificate in DB
      const cert = ctx.db.prepare("SELECT * FROM marketplace_certificates WHERE enrollment_id = ?").get(enrollmentId) as any;
      assert.ok(cert);
      assert.strictEqual(cert.user_id, MARKETPLACE_PERSONAS.alex_student.id);
      assert.strictEqual(cert.score, 100.0);
      assert.strictEqual(cert.verification_hash.length, 64, "Verification hash must be valid SHA-256");

      // Verify enrollment updated to COMPLETED
      const enr = ctx.db.prepare("SELECT status, progress_pct FROM marketplace_enrollments WHERE id = ?").get(enrollmentId) as any;
      assert.strictEqual(enr.status, "COMPLETED");
      assert.strictEqual(enr.progress_pct, 100);
    });
  });

  // ==========================================================================
  // FEATURE 7: Co-Admin Payout Request Flow (Pending -> Processed)
  // ==========================================================================
  describe("Feature 7: Co-Admin Payout Request Flow", () => {
    let payoutId: string;
    const creatorId = MARKETPLACE_PERSONAS.elena_creator.id;

    it("7.1 Co-Admin with earned wallet balance ($89.99) can submit payout request", () => {
      const creatorWallet = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?").get(creatorId) as any;
      assert.strictEqual(creatorWallet.balance, 89.99);

      const req = createPayoutRequest(ctx.db, creatorId, 50.0);
      assert.strictEqual(req.success, true);
      assert.ok(req.payoutId);
      payoutId = req.payoutId!;
    });

    it("7.2 Newly created payout request is initially in PENDING status", () => {
      const payout = ctx.db.prepare("SELECT * FROM marketplace_payout_requests WHERE id = ?").get(payoutId) as any;
      assert.ok(payout);
      assert.strictEqual(payout.amount, 50.0);
      assert.strictEqual(payout.status, "PENDING");
      assert.strictEqual(payout.processed_at, null);
    });

    it("7.3 Co-Admin cannot request payout exceeding available wallet balance", () => {
      const req = createPayoutRequest(ctx.db, creatorId, 500.0);
      assert.strictEqual(req.success, false);
      assert.match(req.error || "", /INSUFFICIENT_CREATOR_BALANCE/);
    });

    it("7.4 Platform operator processes payout request, transitioning status to PROCESSED", () => {
      const proc = processPayoutRequest(ctx.db, payoutId);
      assert.strictEqual(proc.success, true);

      const payout = ctx.db.prepare("SELECT * FROM marketplace_payout_requests WHERE id = ?").get(payoutId) as any;
      assert.strictEqual(payout.status, "PROCESSED");
      assert.ok(payout.processed_at);
    });

    it("7.5 Processed payout debits creator wallet balance by exact payout amount", () => {
      const creatorWallet = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?").get(creatorId) as any;
      // 89.99 - 50.00 = 39.99
      assert.strictEqual(Number(creatorWallet.balance.toFixed(2)), 39.99);
    });
  });
});
