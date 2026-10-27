import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    initDb();
    const db = getDb();
    const user = await getCurrentUser(request);

    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN_SUPER_ADMIN_REQUIRED" },
        { status: 403 }
      );
    }

    // 1. Transaction GMV and 10% fee commission metrics
    const txStats = db
      .prepare(`
        SELECT 
          COALESCE(SUM(amount_cents), 0) as gmv_cents,
          COALESCE(SUM(platform_fee_cents), 0) as platform_fee_cents,
          COALESCE(SUM(creator_payout_cents), 0) as creator_earnings_cents,
          COUNT(*) as completed_transactions
        FROM transactions 
        WHERE status = 'COMPLETED'
      `)
      .get() as any;

    // 2. Processed creator disbursements
    const payoutStats = db
      .prepare(`
        SELECT 
          COALESCE(SUM(amount_cents), 0) as payouts_processed_cents,
          COUNT(*) as payouts_processed_count
        FROM payouts 
        WHERE status = 'PROCESSED'
      `)
      .get() as any;

    // 3. User counts
    const userCount =
      (db.prepare("SELECT COUNT(*) as count FROM users").get() as any)?.count ?? 0;

    const gmvCents = txStats?.gmv_cents ?? 0;
    const platformFeeCents = txStats?.platform_fee_cents ?? 0;
    const payoutsProcessedCents = payoutStats?.payouts_processed_cents ?? 0;

    return NextResponse.json({
      success: true,
      stats: {
        gmv_cents: gmvCents,
        gmv_dollars: Number((gmvCents / 100).toFixed(2)),
        platform_fee_cents: platformFeeCents,
        platform_fee_dollars: Number((platformFeeCents / 100).toFixed(2)),
        completed_transactions: txStats?.completed_transactions ?? 0,
        payouts_processed_cents: payoutsProcessedCents,
        payouts_processed_dollars: Number((payoutsProcessedCents / 100).toFixed(2)),
        payouts_processed_count: payoutStats?.payouts_processed_count ?? 0,
        total_users: userCount,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load admin stats" },
      { status: 500 }
    );
  }
}
