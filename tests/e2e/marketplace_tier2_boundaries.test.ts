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
  getCoursePreviewForUser,
  type MarketplaceTestDatabaseContext,
} from "./marketplace_test_helpers";

describe("Marketplace Tier 2 — Boundary Cases, Negative Inputs & Security Barriers (Opaque-Box E2E)", () => {
  let ctx: MarketplaceTestDatabaseContext;

  before(() => {
    ctx = createIsolatedMarketplaceDb("mkt_tier2");
    seedMarketplaceTestDb(ctx.db);
  });

  after(() => {
    ctx.cleanup();
  });

  // ==========================================================================
  // BOUNDARY 1: Insufficient Wallet Balance Handling
  // ==========================================================================
  describe("Boundary 1: Insufficient Wallet Balance Handling", () => {
    it("2.1 Student with $50.00 balance cannot purchase $99.99 course", () => {
      // Create poor student with $50.00
      const poorStudentId = "usr_poor_student";
      const now = new Date().toISOString();
      ctx.db.prepare("INSERT INTO marketplace_users VALUES (?, ?, ?, 'STUDENT', '', '', ?, ?)").run(
        poorStudentId,
        "poor@student.com",
        "Poor Student",
        now,
        now
      );
      ctx.db.prepare("INSERT INTO marketplace_wallets VALUES (?, ?, 50.0, 'USD', ?)").run(
        "wal_poor",
        poorStudentId,
        now
      );

      const res = executeMarketplaceCheckout(ctx.db, poorStudentId, "crs_cloud_arch_7w");
      assert.strictEqual(res.success, false);
      assert.match(res.error || "", /INSUFFICIENT_FUNDS/);
      assert.match(res.error || "", /Available \$50\.00, Required \$99\.99/);
    });

    it("2.2 Student with $0.00 balance cannot purchase paid course ($99.99)", () => {
      const brokeStudentId = "usr_broke_student";
      const now = new Date().toISOString();
      ctx.db.prepare("INSERT INTO marketplace_users VALUES (?, ?, ?, 'STUDENT', '', '', ?, ?)").run(
        brokeStudentId,
        "broke@student.com",
        "Broke Student",
        now,
        now
      );
      ctx.db.prepare("INSERT INTO marketplace_wallets VALUES (?, ?, 0.0, 'USD', ?)").run(
        "wal_broke",
        brokeStudentId,
        now
      );

      const res = executeMarketplaceCheckout(ctx.db, brokeStudentId, "crs_cloud_arch_7w");
      assert.strictEqual(res.success, false);
      assert.match(res.error || "", /INSUFFICIENT_FUNDS/);
    });

    it("2.3 Failed checkout leaves student wallet balance completely intact", () => {
      const wallet = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = 'usr_poor_student'").get() as any;
      assert.strictEqual(wallet.balance, 50.0, "Balance must not be modified after rejection");
    });

    it("2.4 Failed checkout creates neither transaction record nor enrollment row", () => {
      const tx = ctx.db.prepare("SELECT id FROM marketplace_transactions WHERE buyer_id = 'usr_poor_student'").get();
      assert.strictEqual(tx, undefined, "No transaction record must be created");

      const enr = ctx.db.prepare("SELECT id FROM marketplace_enrollments WHERE user_id = 'usr_poor_student'").get();
      assert.strictEqual(enr, undefined, "No enrollment row must be created");
    });

    it("2.5 Wallet balance exactly $0.01 less than price ($99.98 vs $99.99) is strictly rejected", () => {
      const nearStudentId = "usr_near_student";
      const now = new Date().toISOString();
      ctx.db.prepare("INSERT INTO marketplace_users VALUES (?, ?, ?, 'STUDENT', '', '', ?, ?)").run(
        nearStudentId,
        "near@student.com",
        "Near Student",
        now,
        now
      );
      ctx.db.prepare("INSERT INTO marketplace_wallets VALUES (?, ?, 99.98, 'USD', ?)").run(
        "wal_near",
        nearStudentId,
        now
      );

      const res = executeMarketplaceCheckout(ctx.db, nearStudentId, "crs_cloud_arch_7w");
      assert.strictEqual(res.success, false);
      assert.match(res.error || "", /INSUFFICIENT_FUNDS/);
    });

    it("2.6 Multiple repeated failed purchase attempts do not degrade wallet balance", () => {
      for (let i = 0; i < 5; i++) {
        executeMarketplaceCheckout(ctx.db, "usr_poor_student", "crs_cloud_arch_7w");
      }
      const wallet = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = 'usr_poor_student'").get() as any;
      assert.strictEqual(wallet.balance, 50.0);
    });
  });

  // ==========================================================================
  // BOUNDARY 2: Zero-Priced / Free Courses ($0.00)
  // ==========================================================================
  describe("Boundary 2: Zero-Priced / Free Courses", () => {
    it("2.7 Student with $0.00 wallet can successfully checkout a $0.00 free course", () => {
      const brokeId = "usr_broke_student";
      const res = executeMarketplaceCheckout(ctx.db, brokeId, "crs_git_free_1w");
      assert.strictEqual(res.success, true);
      assert.ok(res.transactionId);
      assert.ok(res.enrollmentId);
    });

    it("2.8 Free course checkout causes $0.00 wallet deduction to student", () => {
      const wallet = ctx.db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = 'usr_broke_student'").get() as any;
      assert.strictEqual(wallet.balance, 0.0);
    });

    it("2.9 Free course checkout credits $0.00 platform fee to Super Admin", () => {
      const split = calculateRevenueSplit(0.0);
      assert.strictEqual(split.platformFeeCents, 0);
      assert.strictEqual(split.platformFeeDollars, 0.0);
    });

    it("2.10 Free course checkout credits $0.00 creator payout to Co-Admin", () => {
      const split = calculateRevenueSplit(0.0);
      assert.strictEqual(split.creatorPayoutCents, 0);
      assert.strictEqual(split.creatorPayoutDollars, 0.0);
    });

    it("2.11 Free course purchase unlocks all course lessons and resources for student", () => {
      const preview = getCoursePreviewForUser(ctx.db, "crs_git_free_1w", "STUDENT", "usr_broke_student");
      assert.ok(preview);
      const lesson = preview.weeks[0].lessons[0];
      assert.strictEqual(lesson.video_url, "https://storage.edtech.market/videos/git-intro.mp4");
      assert.strictEqual(lesson.content_shield_active, false);
    });
  });

  // ==========================================================================
  // BOUNDARY 3: Exact Integer Cents Rounding on Weird Prices ($19.99, $49.95, $99.97)
  // ==========================================================================
  describe("Boundary 3: Exact Integer Cents Rounding & Zero Penny Leakage", () => {
    it("2.12 Price $19.99: 1999 cents -> 200 cents ($2.00) fee + 1799 cents ($17.99) creator", () => {
      const split = calculateRevenueSplit(19.99);
      assert.strictEqual(split.amountCents, 1999);
      assert.strictEqual(split.platformFeeCents, 200); // Math.round(199.9) = 200
      assert.strictEqual(split.creatorPayoutCents, 1799); // 1999 - 200 = 1799
      assert.strictEqual(split.platformFeeDollars, 2.0);
      assert.strictEqual(split.creatorPayoutDollars, 17.99);
      assert.strictEqual(split.platformFeeCents + split.creatorPayoutCents, split.amountCents);
    });

    it("2.13 Price $49.95: 4995 cents -> 500 cents ($5.00) fee + 4495 cents ($44.95) creator", () => {
      const split = calculateRevenueSplit(49.95);
      assert.strictEqual(split.amountCents, 4995);
      assert.strictEqual(split.platformFeeCents, 500); // Math.round(499.5) = 500
      assert.strictEqual(split.creatorPayoutCents, 4495);
      assert.strictEqual(split.platformFeeDollars, 5.0);
      assert.strictEqual(split.creatorPayoutDollars, 44.95);
      assert.strictEqual(split.platformFeeCents + split.creatorPayoutCents, split.amountCents);
    });

    it("2.14 Price $99.97: 9997 cents -> 1000 cents ($10.00) fee + 8997 cents ($89.97) creator", () => {
      const split = calculateRevenueSplit(99.97);
      assert.strictEqual(split.amountCents, 9997);
      assert.strictEqual(split.platformFeeCents, 1000); // Math.round(999.7) = 1000
      assert.strictEqual(split.creatorPayoutCents, 8997);
      assert.strictEqual(split.platformFeeDollars, 10.0);
      assert.strictEqual(split.creatorPayoutDollars, 89.97);
      assert.strictEqual(split.platformFeeCents + split.creatorPayoutCents, split.amountCents);
    });

    it("2.15 Micro-price $0.01: 1 cent -> 0 cents fee + 1 cent creator", () => {
      const split = calculateRevenueSplit(0.01);
      assert.strictEqual(split.amountCents, 1);
      assert.strictEqual(split.platformFeeCents, 0); // Math.round(0.1) = 0
      assert.strictEqual(split.creatorPayoutCents, 1);
      assert.strictEqual(split.platformFeeDollars, 0.0);
      assert.strictEqual(split.creatorPayoutDollars, 0.01);
      assert.strictEqual(split.platformFeeCents + split.creatorPayoutCents, split.amountCents);
    });

    it("2.16 High-value price $999.99: 99999 cents -> 10000 cents ($100.00) fee + 89999 cents ($899.99) creator", () => {
      const split = calculateRevenueSplit(999.99);
      assert.strictEqual(split.amountCents, 99999);
      assert.strictEqual(split.platformFeeCents, 10000);
      assert.strictEqual(split.creatorPayoutCents, 89999);
      assert.strictEqual(split.platformFeeDollars, 100.0);
      assert.strictEqual(split.creatorPayoutDollars, 899.99);
      assert.strictEqual(split.platformFeeCents + split.creatorPayoutCents, split.amountCents);
    });

    it("2.17 Comprehensive Monte Carlo sweep: 100 distinct fractional cent prices strictly maintain zero penny leakage", () => {
      for (let cents = 1; cents <= 10000; cents += 97) {
        const price = Number((cents / 100).toFixed(2));
        const split = calculateRevenueSplit(price);
        assert.strictEqual(
          split.platformFeeCents + split.creatorPayoutCents,
          split.amountCents,
          `Invariant broken at price $${price}`
        );
      }
    });

    it("2.18 Negative price throws descriptive validation error", () => {
      assert.throws(
        () => calculateRevenueSplit(-10.0),
        /Course price cannot be negative/
      );
    });
  });

  // ==========================================================================
  // BOUNDARY 4: Edge-Case Week Counts (Week 1, Week 7, Week 12)
  // ==========================================================================
  describe("Boundary 4: Edge-Case Week Counts", () => {
    it("2.19 Single-week course (Week 1) builds and queries successfully", () => {
      const course = ctx.db.prepare("SELECT * FROM marketplace_courses WHERE total_weeks = 1").get() as any;
      assert.ok(course);
      const weeks = ctx.db.prepare("SELECT * FROM marketplace_weeks WHERE course_id = ?").all(course.id) as any[];
      assert.strictEqual(weeks.length, 1);
      assert.strictEqual(weeks[0].week_number, 1);
    });

    it("2.20 Standard 7-week curriculum (Week 1 through Week 7) compiles and indexes sequentially", () => {
      const weeks = ctx.db.prepare("SELECT week_number FROM marketplace_weeks WHERE course_id = 'crs_cloud_arch_7w' ORDER BY week_number ASC").all() as any[];
      assert.strictEqual(weeks.length, 7);
      for (let i = 0; i < 7; i++) {
        assert.strictEqual(weeks[i].week_number, i + 1);
      }
    });

    it("2.21 Extended 12-week intensive course builds and persists without truncation", () => {
      const extendedCourseId = "crs_intensive_12w";
      const now = new Date().toISOString();
      ctx.db.prepare(`
        INSERT INTO marketplace_courses (
          id, creator_id, title, slug, description, category, price, thumbnail_url, is_published, total_weeks, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 12, ?, ?)
      `).run(
        extendedCourseId,
        MARKETPLACE_PERSONAS.elena_creator.id,
        "Enterprise Distributed Systems Engineering (12 Weeks)",
        "enterprise-distributed-systems-12w",
        "12-week comprehensive program",
        "DEVELOPMENT",
        199.99,
        "https://storage.edtech.market/thumbnails/dist-12w.jpg",
        now,
        now
      );

      for (let w = 1; w <= 12; w++) {
        ctx.db.prepare(`
          INSERT INTO marketplace_weeks (id, course_id, week_number, title, description, order_index, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(`wk_dist_${w}`, extendedCourseId, w, `Week ${w}: Scalability Milestone`, "", w, now, now);
      }

      const weeks = ctx.db.prepare("SELECT week_number FROM marketplace_weeks WHERE course_id = ? ORDER BY week_number ASC").all(extendedCourseId) as any[];
      assert.strictEqual(weeks.length, 12);
      assert.strictEqual(weeks[11].week_number, 12);
    });

    it("2.22 Duplicate week_number within same course is rejected by UNIQUE constraint", () => {
      const now = new Date().toISOString();
      assert.throws(
        () => {
          ctx.db.prepare(`
            INSERT INTO marketplace_weeks (id, course_id, week_number, title, description, order_index, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run("wk_dup_3", "crs_cloud_arch_7w", 3, "Duplicate Week 3", "", 3, now, now);
        },
        /UNIQUE constraint failed/
      );
    });

    it("2.23 Week number 0 or negative is rejected by SQLite CHECK constraint", () => {
      const now = new Date().toISOString();
      assert.throws(
        () => {
          ctx.db.prepare(`
            INSERT INTO marketplace_weeks (id, course_id, week_number, title, description, order_index, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run("wk_zero", "crs_cloud_arch_7w", 0, "Zero Week", "", 0, now, now);
        },
        /CHECK constraint failed/
      );
    });
  });

  // ==========================================================================
  // BOUNDARY 5: Title Masking on Short Titles (<= 6 chars) and Long Titles
  // ==========================================================================
  describe("Boundary 5: Title Masking on Short & Long Titles", () => {
    it("2.24 Short title (2 chars, 'Go') masks safely without indexing error", () => {
      const masked = maskCourseTitle("Go", "SUPER_ADMIN", false, false);
      assert.strictEqual(masked, "Go... [Content Encrypted]");
    });

    it("2.25 Short title (4 chars, 'Rust') masks safely", () => {
      const masked = maskCourseTitle("Rust", "SUPER_ADMIN", false, false);
      assert.strictEqual(masked, "Rust... [Content Encrypted]");
    });

    it("2.26 Exactly 6-character title ('Python') masks safely", () => {
      const masked = maskCourseTitle("Python", "SUPER_ADMIN", false, false);
      assert.strictEqual(masked, "Python... [Content Encrypted]");
    });

    it("2.27 7-character title ('DevOps1') slices exactly first 6 characters", () => {
      const masked = maskCourseTitle("DevOps1", "SUPER_ADMIN", false, false);
      assert.strictEqual(masked, "DevOps... [Content Encrypted]");
    });

    it("2.28 Long title (>50 chars) extracts strictly the first 6 characters", () => {
      const longTitle = "Advanced Microservices Architecture with Domain-Driven Design & Kubernetes";
      const masked = maskCourseTitle(longTitle, "SUPER_ADMIN", false, false);
      assert.strictEqual(masked, "Advanc... [Content Encrypted]");
    });

    it("2.29 Multi-byte Unicode / Emoji title preserves characters safely", () => {
      const emojiTitle = "🚀 AI Agents and LLMs in Production";
      const masked = maskCourseTitle(emojiTitle, "SUPER_ADMIN", false, false);
      assert.ok(masked.endsWith("... [Content Encrypted]"));
      assert.ok(masked.startsWith("🚀"));
    });
  });

  // ==========================================================================
  // BOUNDARY 6: Unauthorized Attempts by Super Admin to Fetch Video Streams (403)
  // ==========================================================================
  describe("Boundary 6: Super Admin & Unauthorized Stream Access Barriers (403)", () => {
    it("2.30 Super Admin calling checkContentGate on paid lesson returns 403 FORBIDDEN_SUPER_ADMIN_CONTENT_GATE", () => {
      const gate = checkContentGate("SUPER_ADMIN", false, false, false);
      assert.strictEqual(gate.allowed, false);
      assert.strictEqual(gate.status, 403);
      assert.strictEqual(gate.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
    });

    it("2.31 Super Admin calling checkContentGate even on free preview lesson is blocked with 403", () => {
      // Creator Content Privacy Shield: Super Admin gate is unconditional
      const gate = checkContentGate("SUPER_ADMIN", false, false, true);
      assert.strictEqual(gate.allowed, false);
      assert.strictEqual(gate.status, 403);
      assert.strictEqual(gate.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
    });

    it("2.32 Non-enrolled student attempting to stream paid lesson returns 403 FORBIDDEN_UNENROLLED", () => {
      const gate = checkContentGate("STUDENT", false, false, false);
      assert.strictEqual(gate.allowed, false);
      assert.strictEqual(gate.status, 403);
      assert.strictEqual(gate.error, "FORBIDDEN_UNENROLLED");
    });

    it("2.33 Enrolled student attempting to stream paid lesson passes content gate successfully", () => {
      const gate = checkContentGate("STUDENT", false, true, false);
      assert.strictEqual(gate.allowed, true);
    });

    it("2.34 Non-author Co-Admin attempting to stream another creator's paid lesson is blocked with 403", () => {
      // Co-Admin Jordan attempts to stream Co-Admin Elena's paid lesson without purchase
      const gate = checkContentGate("CO_ADMIN", false, false, false);
      assert.strictEqual(gate.allowed, false);
      assert.strictEqual(gate.status, 403);
      assert.strictEqual(gate.error, "FORBIDDEN_UNENROLLED");
    });

    it("2.35 Authoring Co-Admin streaming own course passes content gate successfully", () => {
      const gate = checkContentGate("CO_ADMIN", true, false, false);
      assert.strictEqual(gate.allowed, true);
    });
  });
});
