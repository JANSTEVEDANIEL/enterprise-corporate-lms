import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { initDb, getDb } from "../../src/lib/db";
import { dbAdapter } from "../../src/lib/supabase/adapter";
import {
  calculateRevenueSplit,
  calculateRevenueSplitFromCents,
  verifySplitInvariant,
  toCents,
  toDollars,
} from "../../src/lib/finance/split";
import { GET as getWalletRoute } from "../../src/app/api/wallet/route";
import {
  GET as getStudioCoursesRoute,
} from "../../src/app/api/studio/courses/route";
import {
  GET as getStudioPayoutsRoute,
  POST as postStudioPayoutsRoute,
  PATCH as patchStudioPayoutsRoute,
} from "../../src/app/api/studio/payouts/route";
import {
  GET as getStudioCourseDetailRoute,
  PATCH as patchStudioCourseDetailRoute,
  DELETE as deleteStudioCourseDetailRoute,
} from "../../src/app/api/studio/courses/[id]/route";
import {
  GET as getStudioWeeksRoute,
} from "../../src/app/api/studio/courses/[id]/weeks/route";
import { GET as getCourseRoute } from "../../src/app/api/courses/[courseId]/route";
import { POST as postCheckoutRoute } from "../../src/app/api/marketplace/checkout/route";

describe("Milestone 2 Empirical Adversarial Challenge Suite", () => {
  before(() => {
    initDb();
    const db = getDb();

    // Ensure core personas exist in SQLite
    db.prepare(`
      INSERT OR IGNORE INTO users (id, name, email, role, department, job_title, created_at, updated_at)
      VALUES 
        ('usr_sophia_chen', 'Sophia Chen', 'sophia.chen@example.com', 'STUDENT', 'Design', 'Product Design Intern', datetime('now'), datetime('now')),
        ('usr_aris_thorne', 'Dr. Aris Thorne', 'aris.thorne@example.com', 'CO_ADMIN', 'Computer Science', 'Distinguished Professor', datetime('now'), datetime('now')),
        ('usr_david_kim', 'David Kim', 'david.kim@example.com', 'SUPER_ADMIN', 'Executive', 'Chief Platform Officer', datetime('now'), datetime('now'))
    `).run();
  });

  // =========================================================================
  // 1. ZERO-PENNY SPLIT ARITHMETIC & ACCOUNTING INVARIANTS
  // =========================================================================
  describe("1. Zero-Penny Split Arithmetic & Invariant Stress Testing", () => {
    const MANDATORY_PRICE_TIERS = [
      { dollars: 49.99, expectedCents: 4999, expectedFeeCents: 500, expectedNetCents: 4499 },
      { dollars: 79.00, expectedCents: 7900, expectedFeeCents: 790, expectedNetCents: 7110 },
      { dollars: 99.00, expectedCents: 9900, expectedFeeCents: 990, expectedNetCents: 8910 },
      { dollars: 149.00, expectedCents: 14900, expectedFeeCents: 1490, expectedNetCents: 13410 },
    ];

    it("1.1 Mandatory price tiers strictly satisfy gross === fee + net ($49.99, $79.00, $99.00, $149.00)", () => {
      for (const tier of MANDATORY_PRICE_TIERS) {
        const split = calculateRevenueSplit(tier.dollars);

        assert.strictEqual(split.amountCents, tier.expectedCents, `Cents mismatch for $${tier.dollars}`);
        assert.strictEqual(split.platformFeeCents, tier.expectedFeeCents, `Fee mismatch for $${tier.dollars}`);
        assert.strictEqual(split.creatorPayoutCents, tier.expectedNetCents, `Net mismatch for $${tier.dollars}`);

        // STRICT INVARIANT
        assert.strictEqual(
          split.amountCents,
          split.platformFeeCents + split.creatorPayoutCents,
          `Zero-penny invariant failed for tier $${tier.dollars}`
        );
        assert.strictEqual(verifySplitInvariant(split), true);

        // Dollar exactness
        assert.strictEqual(
          split.platformFeeDollars + split.creatorPayoutDollars,
          tier.dollars,
          `Dollar sum mismatch for $${tier.dollars}`
        );
      }
    });

    it("1.2 Property-based stress testing: exhaustive cent-by-cent scan across 50,000 cents ($0.00 to $500.00)", () => {
      for (let cents = 0; cents <= 50000; cents++) {
        const split = calculateRevenueSplitFromCents(cents);

        // Invariant: no penny created or lost
        assert.strictEqual(
          split.amountCents,
          split.platformFeeCents + split.creatorPayoutCents,
          `Leakage detected at ${cents} cents`
        );

        // Non-negativity invariant
        assert.ok(split.platformFeeCents >= 0, `Fee cannot be negative at ${cents} cents`);
        assert.ok(split.creatorPayoutCents >= 0, `Net cannot be negative at ${cents} cents`);

        // Platform fee must be within 1 cent of exact 10%
        const exactFee = cents * 0.10;
        assert.ok(
          Math.abs(split.platformFeeCents - exactFee) <= 0.5,
          `Fee rounding deviation > 0.5 cents at ${cents} cents`
        );
      }
    });

    it("1.3 Micro-transaction boundary cases ($0.00, $0.01, $0.04, $0.05, $0.09)", () => {
      // $0.00 free course
      const split0 = calculateRevenueSplitFromCents(0);
      assert.strictEqual(split0.amountCents, 0);
      assert.strictEqual(split0.platformFeeCents, 0);
      assert.strictEqual(split0.creatorPayoutCents, 0);
      assert.strictEqual(verifySplitInvariant(split0), true);

      // $0.01 micro transaction: Math.round(0.1) = 0 fee, 1 cent creator
      const split1 = calculateRevenueSplitFromCents(1);
      assert.strictEqual(split1.platformFeeCents, 0);
      assert.strictEqual(split1.creatorPayoutCents, 1);
      assert.strictEqual(verifySplitInvariant(split1), true);

      // $0.04: Math.round(0.4) = 0 fee, 4 cents creator
      const split4 = calculateRevenueSplitFromCents(4);
      assert.strictEqual(split4.platformFeeCents, 0);
      assert.strictEqual(split4.creatorPayoutCents, 4);
      assert.strictEqual(verifySplitInvariant(split4), true);

      // $0.05: Math.round(0.5) = 1 cent fee, 4 cents creator
      const split5 = calculateRevenueSplitFromCents(5);
      assert.strictEqual(split5.platformFeeCents, 1);
      assert.strictEqual(split5.creatorPayoutCents, 4);
      assert.strictEqual(verifySplitInvariant(split5), true);

      // $0.09: Math.round(0.9) = 1 cent fee, 8 cents creator
      const split9 = calculateRevenueSplitFromCents(9);
      assert.strictEqual(split9.platformFeeCents, 1);
      assert.strictEqual(split9.creatorPayoutCents, 8);
      assert.strictEqual(verifySplitInvariant(split9), true);
    });

    it("1.4 Adversarial invalid inputs trigger RangeError (negative, NaN, non-integer cents)", () => {
      assert.throws(() => calculateRevenueSplit(-10), RangeError);
      assert.throws(() => calculateRevenueSplit(-0.01), RangeError);
      assert.throws(() => calculateRevenueSplit(NaN), RangeError);
      assert.throws(() => calculateRevenueSplit(Infinity), RangeError);

      assert.throws(() => calculateRevenueSplitFromCents(-1), RangeError);
      assert.throws(() => calculateRevenueSplitFromCents(49.99), RangeError);
      assert.throws(() => calculateRevenueSplitFromCents(NaN), RangeError);
    });

    it("1.5 Studio courses API analytics preserves zero-penny accounting across all creator courses", async () => {
      const req = new NextRequest("http://localhost:3000/api/studio/courses", {
        headers: { "x-lms-user-id": "usr_aris_thorne" },
      });
      const res = await getStudioCoursesRoute(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.analytics);

      const { total_gross_cents, total_platform_fee_cents, total_net_cents } = data.analytics;

      // Assert global ledger invariant
      assert.strictEqual(
        total_gross_cents,
        total_platform_fee_cents + total_net_cents,
        `Studio analytics violated zero-penny split invariant: ${total_gross_cents} !== ${total_platform_fee_cents} + ${total_net_cents}`
      );

      // Assert individual course invariants
      for (const course of data.courses) {
        assert.strictEqual(
          course.gross_revenue_cents,
          course.platform_fee_cents + course.creator_earnings_cents,
          `Course ${course.id} violated zero-penny invariant`
        );
      }
    });
  });

  // =========================================================================
  // 2. PAYOUT STATUS LIFECYCLE & BALANCE RESERVATION
  // =========================================================================
  describe("2. Payout Status Lifecycle & Balance Reservation Verification", () => {
    const TEST_CREATOR = "usr_aris_thorne";

    it("2.1 Requesting payout creates PENDING status and immediately reserves/deducts creator balance", async () => {
      const db = getDb();
      // Provision specific starting balance: $300.00 = 30000 cents
      db.prepare("UPDATE wallets SET balance = 30000, balance_cents = 30000, updated_at = datetime('now') WHERE user_id = ?").run(TEST_CREATOR);

      const initialWallet = db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(TEST_CREATOR) as any;
      assert.strictEqual(initialWallet.balance_cents, 30000);

      const withdrawAmount = 7500; // $75.00

      const req = new NextRequest("http://localhost:3000/api/studio/payouts", {
        method: "POST",
        headers: {
          "x-lms-user-id": TEST_CREATOR,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount_cents: withdrawAmount,
          notes: "Adversarial test reservation withdrawal",
        }),
      });

      const res = await postStudioPayoutsRoute(req);
      assert.strictEqual(res.status, 201);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.payout.status, "PENDING");
      assert.strictEqual(data.payout.amount_cents, withdrawAmount);
      assert.strictEqual(data.payout.processed_at, null);
      assert.strictEqual(data.new_balance_cents, 22500);

      // Verify DB level balance reservation
      const postWallet = db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(TEST_CREATOR) as any;
      assert.strictEqual(postWallet.balance_cents, 22500, "Wallet balance must be immediately reserved/deducted");
    });

    it("2.2 Overdraft attack prevention: rejects payout exceeding available balance with INSUFFICIENT_FUNDS", async () => {
      const db = getDb();
      const wallet = db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(TEST_CREATOR) as any;
      const availableBalance = wallet.balance_cents;

      // Attempt to withdraw availableBalance + 5000 cents
      const excessiveAmount = availableBalance + 5000;

      const req = new NextRequest("http://localhost:3000/api/studio/payouts", {
        method: "POST",
        headers: {
          "x-lms-user-id": TEST_CREATOR,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount_cents: excessiveAmount,
          notes: "Attempted overdraft withdrawal",
        }),
      });

      const res = await postStudioPayoutsRoute(req);
      assert.strictEqual(res.status, 400);

      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, "INSUFFICIENT_FUNDS");

      // Verify balance did not change
      const afterWallet = db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(TEST_CREATOR) as any;
      assert.strictEqual(afterWallet.balance_cents, availableBalance, "Balance must remain unchanged after rejected payout");
    });

    it("2.3 Zero and negative withdrawal amounts are strictly rejected with 400", async () => {
      // 0 cents
      const reqZero = new NextRequest("http://localhost:3000/api/studio/payouts", {
        method: "POST",
        headers: {
          "x-lms-user-id": TEST_CREATOR,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount_cents: 0 }),
      });
      const resZero = await postStudioPayoutsRoute(reqZero);
      assert.strictEqual(resZero.status, 400);

      // Negative cents
      const reqNeg = new NextRequest("http://localhost:3000/api/studio/payouts", {
        method: "POST",
        headers: {
          "x-lms-user-id": TEST_CREATOR,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount_cents: -2500 }),
      });
      const resNeg = await postStudioPayoutsRoute(reqNeg);
      assert.strictEqual(resNeg.status, 400);
    });

    it("2.4 Payout status transition: PENDING -> PROCESSED sets processed_at and updates db", async () => {
      const db = getDb();
      const testPayoutId = `po_adv_${randomUUID().slice(0, 8)}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO payouts (id, creator_id, amount, amount_cents, status, requested_at, notes)
        VALUES (?, ?, 3500, 3500, 'PENDING', ?, 'Test transition')
      `).run(testPayoutId, TEST_CREATOR, now);

      const patchReq = new NextRequest("http://localhost:3000/api/studio/payouts", {
        method: "PATCH",
        headers: {
          "x-lms-user-id": "usr_david_kim", // Super Admin approving
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payout_id: testPayoutId,
          status: "PROCESSED",
        }),
      });

      const patchRes = await patchStudioPayoutsRoute(patchReq);
      assert.strictEqual(patchRes.status, 200);

      const data = await patchRes.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.payout.id, testPayoutId);
      assert.strictEqual(data.payout.status, "PROCESSED");
      assert.ok(data.payout.processed_at, "processed_at must be populated");

      // Verify database persistence
      const row = db.prepare("SELECT * FROM payouts WHERE id = ?").get(testPayoutId) as any;
      assert.strictEqual(row.status, "PROCESSED");
      assert.ok(row.processed_at);
    });

    it("2.5 Rejection of invalid status transitions / inputs", async () => {
      // Missing payout_id
      const reqMissing = new NextRequest("http://localhost:3000/api/studio/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PROCESSED" }),
      });
      const resMissing = await patchStudioPayoutsRoute(reqMissing);
      assert.strictEqual(resMissing.status, 400);

      // Non-existent payout_id
      const reqNotFound = new NextRequest("http://localhost:3000/api/studio/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payout_id: "po_non_existent_fake_id" }),
      });
      const resNotFound = await patchStudioPayoutsRoute(reqNotFound);
      assert.strictEqual(resNotFound.status, 404);
    });
  });

  // =========================================================================
  // 3. STUDENT WALLET LEDGER INTEGRITY
  // =========================================================================
  describe("3. Student Wallet Ledger Integrity & Checkout Flow", () => {
    const STUDENT_ID = "usr_sophia_chen";

    it("3.1 GET /api/wallet returns authentic transactions and accurate balance", async () => {
      const req = new NextRequest("http://localhost:3000/api/wallet", {
        headers: { "x-lms-user-id": STUDENT_ID },
      });
      const res = await getWalletRoute(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.user_id, STUDENT_ID);
      assert.ok(data.wallet);
      assert.strictEqual(typeof data.wallet.balance_cents, "number");
      assert.strictEqual(data.wallet.balance_dollars, data.wallet.balance_cents / 100);
      assert.strictEqual(data.wallet.currency, "USD");
      assert.ok(Array.isArray(data.transactions));
    });

    it("3.2 Marketplace checkout atomically updates wallet balance and creates ledger transaction", async () => {
      const db = getDb();

      // Create a unique test course priced at $49.99 (4999 cents)
      const courseId = `crs_adv_${randomUUID().slice(0, 8)}`;
      const coursePriceCents = 4999;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO courses (
          id, slug, title, description, category, target_role, is_mandatory,
          estimated_minutes, renewal_period_days, passing_score_pct, version,
          is_published, creator_id, price_cents, thumbnail_url, total_weeks,
          created_at, updated_at
        ) VALUES (
          ?, ?, 'Adversarial Ledger Course', 'Description', 'SOFTWARE', 'ALL', 0,
          120, NULL, 80, '1.0.0',
          1, 'usr_aris_thorne', ?, NULL, 4,
          ?, ?
        )
      `).run(courseId, `adv-ledger-${courseId}`, coursePriceCents, now, now);

      // Set known student wallet balance: 50000 cents ($500.00)
      db.prepare(`
        INSERT INTO wallets (id, user_id, balance, balance_cents, currency, created_at, updated_at)
        VALUES ('wal_sophia', ?, 50000, 50000, 'USD', ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET balance = 50000, balance_cents = 50000, updated_at = excluded.updated_at
      `).run(STUDENT_ID, now, now);

      // Clean any existing enrollment for this test course
      db.prepare("DELETE FROM enrollments WHERE user_id = ? AND course_id = ?").run(STUDENT_ID, courseId);

      // Perform checkout
      const checkoutReq = new NextRequest("http://localhost:3000/api/marketplace/checkout", {
        method: "POST",
        headers: {
          "x-lms-user-id": STUDENT_ID,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          course_id: courseId,
          student_id: STUDENT_ID,
        }),
      });

      const checkoutRes = await postCheckoutRoute(checkoutReq);
      assert.strictEqual(checkoutRes.status, 200);

      const checkoutData = await checkoutRes.json();
      assert.strictEqual(checkoutData.success, true);
      assert.ok(checkoutData.transaction_id);
      assert.strictEqual(checkoutData.new_balance_cents, 50000 - coursePriceCents);
      assert.strictEqual(checkoutData.split.amount_cents, 4999);
      assert.strictEqual(checkoutData.split.platform_fee_cents, 500);
      assert.strictEqual(checkoutData.split.creator_payout_cents, 4499);

      // Now query GET /api/wallet and assert ledger authenticity
      const walletReq = new NextRequest(`http://localhost:3000/api/wallet?user_id=${STUDENT_ID}`);
      const walletRes = await getWalletRoute(walletReq);
      assert.strictEqual(walletRes.status, 200);

      const walletData = await walletRes.json();
      assert.strictEqual(walletData.wallet.balance_cents, 45001);
      assert.strictEqual(walletData.wallet.balance_dollars, 450.01);

      // Locate the newly recorded transaction in the ledger
      const recordedTx = walletData.transactions.find((tx: any) => tx.id === checkoutData.transaction_id);
      assert.ok(recordedTx, "Newly created transaction must exist in student ledger");
      assert.strictEqual(recordedTx.amount_cents, 4999);
      assert.strictEqual(recordedTx.amount_dollars, 49.99);
      assert.strictEqual(recordedTx.type, "PURCHASE");
      assert.strictEqual(recordedTx.status, "COMPLETED");
      assert.strictEqual(recordedTx.course_title, "Adversarial Ledger Course");
      assert.ok(recordedTx.created_at);
    });

    it("3.3 Insufficient student balance rejects checkout with 400 without ledger modification", async () => {
      const db = getDb();
      const ephemeralStudent = `usr_poor_student_${randomUUID().slice(0, 6)}`;
      const now = new Date().toISOString();

      // Provision user and poor wallet with only 1000 cents ($10.00)
      db.prepare(`
        INSERT OR REPLACE INTO users (id, name, email, role, department, job_title, created_at, updated_at)
        VALUES (?, 'Poor Student', ?, 'STUDENT', 'Design', 'Intern', ?, ?)
      `).run(ephemeralStudent, `poor_${ephemeralStudent}@example.com`, now, now);

      db.prepare(`
        INSERT INTO wallets (id, user_id, balance, balance_cents, currency, created_at, updated_at)
        VALUES (?, ?, 1000, 1000, 'USD', ?, ?)
      `).run(`wal_${ephemeralStudent}`, ephemeralStudent, now, now);

      // Attempt checkout on a 4999 cent course
      const req = new NextRequest("http://localhost:3000/api/marketplace/checkout", {
        method: "POST",
        headers: {
          "x-lms-user-id": ephemeralStudent,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          course_id: "crs_cloud_arch_7w",
          student_id: ephemeralStudent,
        }),
      });

      const res = await postCheckoutRoute(req);
      assert.strictEqual(res.status, 400);

      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, "INSUFFICIENT_FUNDS");

      // Verify wallet balance is intact
      const wallet = db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(ephemeralStudent) as any;
      assert.strictEqual(wallet.balance_cents, 1000);

      // Verify no transaction was recorded
      const txs = await dbAdapter.getTransactionsForUser(ephemeralStudent);
      assert.strictEqual(txs.length, 0);
    });

    it("3.4 Duplicate purchase attempt rejects with 400 ALREADY_ENROLLED", async () => {
      // Sophia Chen is already enrolled in crs_cloud_arch_7w
      const req = new NextRequest("http://localhost:3000/api/marketplace/checkout", {
        method: "POST",
        headers: {
          "x-lms-user-id": STUDENT_ID,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          course_id: "crs_cloud_arch_7w",
          student_id: STUDENT_ID,
        }),
      });

      const res = await postCheckoutRoute(req);
      assert.strictEqual(res.status, 400);

      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, "ALREADY_ENROLLED");
    });
  });

  // =========================================================================
  // 4. CREATOR CONTENT PRIVACY SHIELD ACCESS BARRIERS
  // =========================================================================
  describe("4. Creator Content Privacy Shield Verification", () => {
    it("4.1 Super Admin is strictly blocked from Studio courses route with 403", async () => {
      const req = new NextRequest("http://localhost:3000/api/studio/courses/crs_cloud_arch_7w", {
        headers: { "x-lms-user-id": "usr_david_kim" },
      });
      const res = await getStudioCourseDetailRoute(req, {
        params: Promise.resolve({ id: "crs_cloud_arch_7w" }),
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
    });

    it("4.2 Super Admin is strictly blocked from Studio weeks route with 403", async () => {
      const req = new NextRequest("http://localhost:3000/api/studio/courses/crs_cloud_arch_7w/weeks", {
        headers: { "x-lms-user-id": "usr_david_kim" },
      });
      const res = await getStudioWeeksRoute(req, {
        params: Promise.resolve({ id: "crs_cloud_arch_7w" }),
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
    });

    it("4.3 Public/Super Admin course route masks title and encrypts content for Super Admin", async () => {
      const req = new NextRequest("http://localhost:3000/api/courses/crs_cloud_arch_7w", {
        headers: { "x-lms-user-id": "usr_david_kim" },
      });
      const res = await getCourseRoute(req, {
        params: Promise.resolve({ courseId: "crs_cloud_arch_7w" }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.course.title.includes("[Content Encrypted]"));
      assert.strictEqual(data.course.is_content_encrypted, true);
      assert.strictEqual(data.course.thumbnail_blurred, true);
    });
  });
});
