import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { dbAdapter } from "@/lib/supabase/adapter";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const url = new URL(request.url);
    const requestedUserId = url.searchParams.get("user_id") || url.searchParams.get("userId");
    const targetUserId = requestedUserId || user.id;

    // Fetch wallet (auto-provisions if not existing)
    const wallet = await dbAdapter.getWallet(targetUserId);
    const transactions = await dbAdapter.getTransactionsForUser(targetUserId);

    const balanceCents = wallet?.balance_cents ?? wallet?.balance ?? 50000;
    const balanceDollars = wallet?.balance_dollars ?? Number((balanceCents / 100).toFixed(2));
    const currency = wallet?.currency || "USD";

    return NextResponse.json({
      success: true,
      user_id: targetUserId,
      wallet: {
        balance_cents: balanceCents,
        balance_dollars: balanceDollars,
        currency,
      },
      transactions: transactions || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch wallet ledger" },
      { status: 500 }
    );
  }
}
