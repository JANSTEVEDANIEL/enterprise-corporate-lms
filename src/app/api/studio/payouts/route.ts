import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { randomUUID } from "node:crypto";

export async function GET(request: NextRequest) {
  try {
    initDb();
    const db = getDb();
    const user = await getCurrentUser(request);

    let creatorId = user.id;
    const url = new URL(request.url);
    const queryCreatorId = url.searchParams.get("creator_id");

    if (queryCreatorId) {
      creatorId = queryCreatorId;
    } else if (user.role !== "CO_ADMIN" && user.role !== "SUPER_ADMIN") {
      const coAdmin = db.prepare("SELECT id FROM users WHERE role = 'CO_ADMIN' LIMIT 1").get() as any;
      if (coAdmin) {
        creatorId = coAdmin.id;
      }
    }

    // Get payouts
    let payouts: any[];
    if (user.role === "SUPER_ADMIN" && !queryCreatorId) {
      payouts = db
        .prepare(`
          SELECT p.*, COALESCE(u.name, p.creator_id) as creator_name, u.email as creator_email
          FROM payouts p
          LEFT JOIN users u ON p.creator_id = u.id
          ORDER BY p.requested_at DESC
        `)
        .all() as any[];
    } else {
      payouts = db
        .prepare(`
          SELECT p.*, COALESCE(u.name, p.creator_id) as creator_name, u.email as creator_email
          FROM payouts p
          LEFT JOIN users u ON p.creator_id = u.id
          WHERE p.creator_id = ?
          ORDER BY p.requested_at DESC
        `)
        .all(creatorId) as any[];
    }

    const enhancedPayouts = payouts.map((p) => ({
      ...p,
      amount_cents: p.amount_cents ?? p.amount ?? 0,
      amount_dollars: Number(((p.amount_cents ?? p.amount ?? 0) / 100).toFixed(2)),
    }));

    // Get creator wallet
    const wallet = db
      .prepare("SELECT * FROM wallets WHERE user_id = ?")
      .get(creatorId) as any;

    const balanceCents = wallet?.balance_cents ?? wallet?.balance ?? 0;

    return NextResponse.json({
      success: true,
      creator_id: creatorId,
      wallet: {
        balance_cents: balanceCents,
        balance_dollars: Number((balanceCents / 100).toFixed(2)),
        currency: wallet?.currency || "USD",
      },
      payouts: enhancedPayouts,
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
    initDb();
    const db = getDb();
    const user = await getCurrentUser(request);

    let creatorId = user.id;
    const body = await request.json().catch(() => ({}));

    if (body.creator_id) {
      creatorId = body.creator_id;
    } else if (user.role !== "CO_ADMIN" && user.role !== "SUPER_ADMIN") {
      const coAdmin = db.prepare("SELECT id FROM users WHERE role = 'CO_ADMIN' LIMIT 1").get() as any;
      if (coAdmin) {
        creatorId = coAdmin.id;
      }
    }

    const rawAmount = body.amount_cents ?? (body.amount ? Math.round(Number(body.amount) * 100) : 0);
    const amountCents = Math.round(Number(rawAmount));

    if (isNaN(amountCents) || amountCents <= 0) {
      return NextResponse.json(
        { success: false, error: "Withdrawal amount must be greater than zero" },
        { status: 400 }
      );
    }

    // Check wallet balance
    const wallet = db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(creatorId) as any;
    const currentBalance = wallet ? (wallet.balance_cents ?? wallet.balance ?? 0) : 0;

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

    const now = new Date().toISOString();
    const payoutId = `po_${randomUUID().slice(0, 8)}`;
    const notes = body.notes?.trim() || null;

    // Deduct from wallet
    db.prepare(
      `UPDATE wallets 
       SET balance = balance - ?, balance_cents = balance_cents - ?, updated_at = ? 
       WHERE user_id = ?`
    ).run(amountCents, amountCents, now, creatorId);

    // Insert into payouts
    db.prepare(
      `INSERT INTO payouts (id, creator_id, amount, amount_cents, status, requested_at, processed_at, notes)
       VALUES (?, ?, ?, ?, 'PENDING', ?, NULL, ?)`
    ).run(payoutId, creatorId, amountCents, amountCents, now, notes);

    // Also record into payout_requests
    try {
      db.prepare(
        `INSERT INTO payout_requests (id, creator_id, amount, amount_cents, status, created_at, requested_at, processed_at, notes)
         VALUES (?, ?, ?, ?, 'PENDING', ?, ?, NULL, ?)`
      ).run(payoutId, creatorId, amountCents, amountCents, now, now, notes);
    } catch {}

    const newBalance = currentBalance - amountCents;

    return NextResponse.json(
      {
        success: true,
        payout: {
          id: payoutId,
          creator_id: creatorId,
          amount_cents: amountCents,
          amount_dollars: Number((amountCents / 100).toFixed(2)),
          status: "PENDING",
          requested_at: now,
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
    initDb();
    const db = getDb();
    const user = await getCurrentUser(request);

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

    const existingPayout = db
      .prepare("SELECT * FROM payouts WHERE id = ?")
      .get(payoutId) as any;
    if (!existingPayout) {
      return NextResponse.json(
        { success: false, error: `Payout not found: ${payoutId}` },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    db.prepare("UPDATE payouts SET status = ?, processed_at = ? WHERE id = ?").run(
      status,
      now,
      payoutId
    );
    try {
      db.prepare(
        "UPDATE payout_requests SET status = ?, processed_at = ? WHERE id = ?"
      ).run(status, now, payoutId);
    } catch {}

    const updatedPayout = db
      .prepare(`
        SELECT p.*, COALESCE(u.name, p.creator_id) as creator_name
        FROM payouts p
        LEFT JOIN users u ON p.creator_id = u.id
        WHERE p.id = ?
      `)
      .get(payoutId) as any;

    return NextResponse.json({
      success: true,
      payout: {
        ...updatedPayout,
        amount_cents: updatedPayout.amount_cents ?? updatedPayout.amount ?? 0,
        amount_dollars: Number(
          ((updatedPayout.amount_cents ?? updatedPayout.amount ?? 0) / 100).toFixed(2)
        ),
        status,
        processed_at: now,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process payout" },
      { status: 500 }
    );
  }
}

