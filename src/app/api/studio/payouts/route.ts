import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { dbAdapter } from "@/lib/supabase/adapter";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    let creatorId = user.id;
    const url = new URL(request.url);
    const queryCreatorId = url.searchParams.get("creator_id");

    if (queryCreatorId) {
      creatorId = queryCreatorId;
    } else if (user.role !== "CO_ADMIN" && user.role !== "SUPER_ADMIN") {
      creatorId = "usr_aris_thorne";
    }

    const payouts = await dbAdapter.getPayouts(
      user.role === "SUPER_ADMIN" && !queryCreatorId ? undefined : creatorId
    );

    const wallet = await dbAdapter.getWallet(creatorId);
    const balanceCents = wallet?.balance_cents ?? 0;

    return NextResponse.json({
      success: true,
      creator_id: creatorId,
      wallet: {
        balance_cents: balanceCents,
        balance_dollars: Number((balanceCents / 100).toFixed(2)),
        currency: wallet?.currency || "USD",
      },
      payouts,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch payout history" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    let creatorId = user.id;
    const body = await request.json().catch(() => ({}));

    if (body.creator_id) {
      creatorId = body.creator_id;
    } else if (user.role !== "CO_ADMIN" && user.role !== "SUPER_ADMIN") {
      creatorId = "usr_aris_thorne";
    }

    const rawAmount = body.amount_cents ?? (body.amount ? Math.round(Number(body.amount) * 100) : 0);
    const amountCents = Math.round(Number(rawAmount));

    if (isNaN(amountCents) || amountCents <= 0) {
      return NextResponse.json(
        { success: false, error: "Withdrawal amount must be greater than zero" },
        { status: 400 }
      );
    }

    const wallet = await dbAdapter.getWallet(creatorId);
    const currentBalance = wallet?.balance_cents ?? 0;

    if (currentBalance < amountCents) {
      return NextResponse.json(
        {
          success: false,
          error: "INSUFFICIENT_FUNDS",
          message: `Requested payout of $${(amountCents / 100).toFixed(2)} exceeds available wallet balance of $${(currentBalance / 100).toFixed(2)}`,
          available_balance_cents: currentBalance,
        },
        { status: 400 }
      );
    }

    const notes = body.notes?.trim() || null;
    const payout = await dbAdapter.createPayoutRequest(creatorId, amountCents, notes);
    const updatedWallet = await dbAdapter.getWallet(creatorId);
    const newBalance = updatedWallet?.balance_cents ?? (currentBalance - amountCents);

    return NextResponse.json(
      {
        success: true,
        payout: {
          id: payout.id,
          creator_id: creatorId,
          amount_cents: amountCents,
          amount_dollars: Number((amountCents / 100).toFixed(2)),
          status: "PENDING",
          requested_at: payout.requested_at,
          processed_at: null,
          notes,
        },
        new_balance_cents: newBalance,
        new_balance_dollars: Number((newBalance / 100).toFixed(2)),
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create payout request" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const url = new URL(request.url);
    const payoutId =
      body.payout_id ||
      body.id ||
      url.searchParams.get("payout_id") ||
      url.searchParams.get("id");
    const status = body.status || "PROCESSED";

    if (!payoutId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: payout_id" },
        { status: 400 }
      );
    }

    const updatedPayout = await dbAdapter.processPayout(payoutId, status);
    if (!updatedPayout) {
      return NextResponse.json(
        { success: false, error: `Payout not found: ${payoutId}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      payout: updatedPayout,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process payout" },
      { status: 500 }
    );
  }
}
