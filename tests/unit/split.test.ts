import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import {
  toCents,
  toDollars,
  formatCurrency,
  calculateRevenueSplit,
  calculateRevenueSplitFromCents,
  verifySplitInvariant,
} from "../../src/lib/finance";
import { dbAdapter } from "../../src/lib/supabase";
import { initDb, getDb } from "../../src/lib/db";

describe("Financial Split & Wallet Ledger Engine Suite", () => {
  before(() => {
    initDb();
    const db = getDb();
    const now = new Date().toISOString();

    // Clean up any test records from prior runs
    db.prepare("DELETE FROM transactions WHERE student_id = 'usr_split_student' OR creator_id = 'usr_split_creator'").run();
    db.prepare("DELETE FROM payouts WHERE creator_id = 'usr_split_creator'").run();
    db.prepare("DELETE FROM wallets WHERE user_id IN ('usr_split_student', 'usr_split_creator')").run();

    // Ensure test student and creator exist
    db.prepare(`
      INSERT OR IGNORE INTO users (id, email, name, role, department, job_title, is_active, created_at, updated_at)
      VALUES ('usr_split_student', 'split.student@test.corp', 'Split Student', 'STUDENT', 'Eng', 'Tester', 1, ?, ?)
    `).run(now, now);

    db.prepare(`
      INSERT OR IGNORE INTO users (id, email, name, role, department, job_title, is_active, created_at, updated_at)
      VALUES ('usr_split_creator', 'split.creator@test.corp', 'Split Creator', 'CO_ADMIN', 'Eng', 'Creator', 1, ?, ?)
    `).run(now, now);
  });

  // =========================================================================
  // 1. Currency Conversion & Formatting Utilities
  // =========================================================================
  describe("1. Currency Conversion & Formatting (toCents, toDollars, formatCurrency)", () => {
    it("1.1 toCents accurately converts float dollars to integer cents without float drift", () => {
      assert.strictEqual(toCents(19.99), 1999);
      assert.strictEqual(toCents(0.05), 5);
      assert.strictEqual(toCents(100), 10000);
      assert.strictEqual(toCents(0), 0);
      assert.strictEqual(toCents(0.01), 1);
      assert.strictEqual(toCents(49.95), 4995);
      assert.strictEqual(toCents(1234.56), 123456);
    });

    it("1.2 toCents rejects negative numbers, NaN, and non-finite values", () => {
      assert.throws(() => toCents(-5), RangeError);
      assert.throws(() => toCents(NaN), RangeError);
      assert.throws(() => toCents(Infinity), RangeError);
      assert.throws(() => toCents(-Infinity), RangeError);
    });

    it("1.3 toDollars converts integer cents to decimal float", () => {
      assert.strictEqual(toDollars(1999), 19.99);
      assert.strictEqual(toDollars(5), 0.05);
      assert.strictEqual(toDollars(0), 0);
      assert.strictEqual(toDollars(50000), 500);
    });

    it("1.4 toDollars rejects non-integers and negative numbers", () => {
      assert.throws(() => toDollars(-100), RangeError);
      assert.throws(() => toDollars(19.99), RangeError);
    });

    it("1.5 formatCurrency formats cents into standard USD strings", () => {
      assert.strictEqual(formatCurrency(1999), "$19.99");
      assert.strictEqual(formatCurrency(50000), "$500.00");
      assert.strictEqual(formatCurrency(0), "$0.00");
      assert.strictEqual(formatCurrency(5), "$0.05");
    });
  });

  // =========================================================================
  // 2. Integer-Cents 10/90 Split Arithmetic
  // =========================================================================
  describe("2. 10/90 Revenue Split Arithmetic & Zero-Penny Invariant", () => {
    it("2.1 Computes exact 10/90 split for round dollar amounts ($100.00)", () => {
      const split = calculateRevenueSplit(100.0);
      assert.strictEqual(split.amountCents, 10000);
      assert.strictEqual(split.platformFeeCents, 1000);
      assert.strictEqual(split.creatorPayoutCents, 9000);
      assert.strictEqual(split.platformFeeDollars, 10.0);
      assert.strictEqual(split.creatorPayoutDollars, 90.0);
      assert.strictEqual(verifySplitInvariant(split), true);
    });

    it("2.2 Computes exact 10/90 split for $19.99 (1999 cents)", () => {
      // 1999 * 0.10 = 199.9 -> rounds to 200 cents ($2.00)
      // Creator payout = 1999 - 200 = 1799 cents ($17.99)
      const split = calculateRevenueSplit(19.99);
      assert.strictEqual(split.amountCents, 1999);
      assert.strictEqual(split.platformFeeCents, 200);
      assert.strictEqual(split.creatorPayoutCents, 1799);
      assert.strictEqual(split.platformFeeCents + split.creatorPayoutCents, 1999);
      assert.strictEqual(verifySplitInvariant(split), true);
    });

    it("2.3 Computes exact 10/90 split for $49.95 (4995 cents)", () => {
      // 4995 * 0.10 = 499.5 -> rounds to 500 cents ($5.00)
      // Creator payout = 4995 - 500 = 4495 cents ($44.95)
      const split = calculateRevenueSplit(49.95);
      assert.strictEqual(split.amountCents, 4995);
      assert.strictEqual(split.platformFeeCents, 500);
      assert.strictEqual(split.creatorPayoutCents, 4495);
      assert.strictEqual(verifySplitInvariant(split), true);
    });

    it("2.4 Free courses ($0.00) yield 0 fees and 0 payouts cleanly", () => {
      const split = calculateRevenueSplit(0);
      assert.strictEqual(split.amountCents, 0);
      assert.strictEqual(split.platformFeeCents, 0);
      assert.strictEqual(split.creatorPayoutCents, 0);
      assert.strictEqual(verifySplitInvariant(split), true);
    });

    it("2.5 $0.05 edge case: prevents phantom money creation", () => {
      // 5 cents * 0.10 = 0.5 -> 1 cent platform fee
      // Creator payout = 5 - 1 = 4 cents (Sum = 5, not 6!)
      const split = calculateRevenueSplit(0.05);
      assert.strictEqual(split.amountCents, 5);
      assert.strictEqual(split.platformFeeCents, 1);
      assert.strictEqual(split.creatorPayoutCents, 4);
      assert.strictEqual(verifySplitInvariant(split), true);
    });

    it("2.6 $0.01 micro-transaction: rounds fee to 0, grants 1 cent to creator", () => {
      const split = calculateRevenueSplit(0.01);
      assert.strictEqual(split.amountCents, 1);
      assert.strictEqual(split.platformFeeCents, 0);
      assert.strictEqual(split.creatorPayoutCents, 1);
      assert.strictEqual(verifySplitInvariant(split), true);
    });

    it("2.7 Exhaustive 26-case boundary validation strictly satisfies invariant", () => {
      const testCases = [
        0.0, 0.01, 0.02, 0.04, 0.05, 0.06, 0.09, 0.1, 0.14, 0.15,
        0.49, 0.5, 0.99, 1.0, 4.99, 5.0, 9.99, 10.0, 19.99, 29.95,
        49.99, 99.0, 99.99, 100.0, 499.99, 1234.56,
      ];

      for (const dollars of testCases) {
        const split = calculateRevenueSplit(dollars);
        assert.strictEqual(
          verifySplitInvariant(split),
          true,
          `Invariant failed for $${dollars}: ${split.platformFeeCents} + ${split.creatorPayoutCents} !== ${split.amountCents}`
        );
        assert.strictEqual(split.platformFeeCents + split.creatorPayoutCents, split.amountCents);
      }
    });

    it("2.8 calculateRevenueSplitFromCents rejects negative or non-integer cents", () => {
      assert.throws(() => calculateRevenueSplitFromCents(-10), RangeError);
      assert.throws(() => calculateRevenueSplitFromCents(12.5), RangeError);
    });
  });

  // =========================================================================
  // 3. Wallet Ledger & Atomic Settlement Integration (DbAdapter)
  // =========================================================================
  describe("3. DbAdapter Wallet Provisioning, Transactions & Payouts", () => {
    it("3.1 getWallet auto-provisions test student wallet with $500.00 (50000 cents)", async () => {
      const wallet = await dbAdapter.getWallet("usr_split_student");
      assert.ok(wallet);
      assert.strictEqual(wallet.user_id, "usr_split_student");
      assert.strictEqual(wallet.balance_cents ?? wallet.balance, 50000);
      assert.strictEqual(wallet.currency, "USD");
    });

    it("3.2 recordTransaction executes atomic debit/credit split with zero penny loss", async () => {
      await dbAdapter.getWallet("usr_split_creator");
      const split = calculateRevenueSplit(19.99); // 1999 cents: 200 fee, 1799 payout

      const txResult = await dbAdapter.recordTransaction({
        id: "tx_split_test_1",
        course_id: "crs_shield_test",
        student_id: "usr_split_student",
        creator_id: "usr_split_creator",
        amount_cents: split.amountCents,
        platform_fee_cents: split.platformFeeCents,
        creator_payout_cents: split.creatorPayoutCents,
        currency: "USD",
        status: "COMPLETED",
      });

      assert.ok(txResult);
      assert.strictEqual(txResult.amount_cents ?? txResult.amount, 1999);
      assert.strictEqual(txResult.platform_fee_cents ?? txResult.platform_fee, 200);
      assert.strictEqual(txResult.creator_payout_cents ?? txResult.creator_earnings, 1799);

      // Verify Student Wallet was debited by 1999 cents (50000 - 1999 = 48001)
      const studentWallet = await dbAdapter.getWallet("usr_split_student");
      assert.strictEqual(studentWallet.balance_cents ?? studentWallet.balance, 48001);

      // Verify Creator Wallet was credited by 1799 cents (50000 + 1799 = 51799)
      const creatorWallet = await dbAdapter.getWallet("usr_split_creator");
      assert.strictEqual(creatorWallet.balance_cents ?? creatorWallet.balance, 51799);
    });

    it("3.3 createPayoutRequest successfully reserves funds and creates PENDING payout", async () => {
      const payout = await dbAdapter.createPayoutRequest("usr_split_creator", 5000, "Monthly payout");
      assert.ok(payout);
      assert.strictEqual(payout.creator_id, "usr_split_creator");
      assert.strictEqual(payout.amount_cents ?? payout.amount, 5000);
      assert.strictEqual(payout.status, "PENDING");

      // Creator balance should be deducted by 5000 cents (51799 - 5000 = 46799)
      const creatorWallet = await dbAdapter.getWallet("usr_split_creator");
      assert.strictEqual(creatorWallet.balance_cents ?? creatorWallet.balance, 46799);

      // Check getPayouts list
      const payouts = await dbAdapter.getPayouts("usr_split_creator");
      assert.ok(payouts.length >= 1);
      assert.strictEqual(payouts[0].status, "PENDING");
    });

    it("3.4 createPayoutRequest rejects if requested amount exceeds wallet balance", async () => {
      await assert.rejects(
        async () => {
          await dbAdapter.createPayoutRequest("usr_split_creator", 9999999);
        },
        /INSUFFICIENT_FUNDS/
      );
    });
  });
});
