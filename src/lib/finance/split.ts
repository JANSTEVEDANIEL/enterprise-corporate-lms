import type { RevenueSplitResult } from "@/types/marketplace";

export type { RevenueSplitResult };

/**
 * Converts a floating dollar value to integer cents safely.
 * e.g., 19.99 -> 1999, 0.05 -> 5
 */
export function toCents(dollars: number): number {
  if (!Number.isFinite(dollars) || dollars < 0) {
    throw new RangeError("Price in dollars must be a non-negative finite number");
  }
  return Math.round(dollars * 100);
}

/**
 * Converts integer cents to formatted dollar value.
 * e.g., 1999 -> 19.99
 */
export function toDollars(cents: number): number {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new RangeError("Cents must be a non-negative integer");
  }
  return cents / 100;
}

/**
 * Formats integer cents into a standard currency string.
 * e.g., 1999 -> "$19.99", 50000 -> "$500.00"
 */
export function formatCurrency(cents: number, currency: string = "USD"): string {
  const dollars = toDollars(cents);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Calculates 10% platform fee and 90% creator earnings from dollars.
 * 
 * Strict Invariant:
 *   amountCents = Math.round(priceDollars * 100)
 *   platformFeeCents = Math.round(amountCents * 0.10)
 *   creatorPayoutCents = amountCents - platformFeeCents
 *   platformFeeCents + creatorPayoutCents === amountCents strictly (zero penny leakage).
 */
export function calculateRevenueSplit(priceDollars: number): RevenueSplitResult {
  const amountCents = toCents(priceDollars);
  return calculateRevenueSplitFromCents(amountCents);
}

/**
 * Calculates 10% platform fee and 90% creator earnings directly from integer cents.
 */
export function calculateRevenueSplitFromCents(amountCents: number): RevenueSplitResult {
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new RangeError("amountCents must be a non-negative integer");
  }

  const platformFeeCents = Math.round(amountCents * 0.10);
  const creatorPayoutCents = amountCents - platformFeeCents;

  return {
    amountCents,
    platformFeeCents,
    creatorPayoutCents,
    platformFeeDollars: platformFeeCents / 100,
    creatorPayoutDollars: creatorPayoutCents / 100,
  };
}

/**
 * Asserts the strict zero-penny leakage invariant:
 * platformFeeCents + creatorPayoutCents === amountCents
 */
export function verifySplitInvariant(split: RevenueSplitResult): boolean {
  return split.platformFeeCents + split.creatorPayoutCents === split.amountCents;
}
