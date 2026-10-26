import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { resolveSessionUser } from "@/lib/auth";
import { calculateRevenueSplitFromCents } from "@/lib/finance/split";
import { recordAuditEvent } from "@/lib/audit";
import { randomUUID } from "node:crypto";

export async function GET(request: NextRequest) {
  try {
    initDb();
    const db = getDb();
    const user = await resolveSessionUser(request);

    const url = new URL(request.url);
    const courseId = url.searchParams.get("course_id") || url.searchParams.get("courseId");
    let studentId = url.searchParams.get("student_id") || url.searchParams.get("studentId") || user.id;

    if (user.role !== "STUDENT" && !url.searchParams.get("student_id")) {
      // In demo mode for students, fallback to Sophia Chen if not explicitly set
      studentId = "usr_sophia_chen";
    }

    // Auto-provision wallet if missing ($500.00 default = 50000 cents)
    let wallet = db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(studentId) as any;
    if (!wallet) {
      const now = new Date().toISOString();
      const walId = `wal_${studentId}`;
      db.prepare(
        "INSERT INTO wallets (id, user_id, balance, balance_cents, currency, created_at, updated_at) VALUES (?, ?, 50000, 50000, 'USD', ?, ?)"
      ).run(walId, studentId, now, now);
      wallet = db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(studentId);
    }

    const balanceCents = wallet?.balance_cents ?? wallet?.balance ?? 50000;
    const balanceDollars = Number((balanceCents / 100).toFixed(2));

    let isEnrolled = false;
    let courseData: any = null;
    let canAfford = true;

    if (courseId) {
      const course = db.prepare("SELECT * FROM courses WHERE id = ? OR slug = ?").get(courseId, courseId) as any;
      if (course) {
        courseData = {
          id: course.id,
          title: course.title,
          slug: course.slug,
          price_cents: course.price_cents,
          price_dollars: Number((course.price_cents / 100).toFixed(2)),
          is_published: course.is_published === 1,
        };
        const enr = db.prepare("SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?").get(studentId, course.id);
        isEnrolled = !!enr;
        canAfford = balanceCents >= course.price_cents;
      }
    }

    return NextResponse.json({
      success: true,
      student_id: studentId,
      wallet_balance_cents: balanceCents,
      wallet_balance_dollars: balanceDollars,
      course: courseData,
      is_enrolled: isEnrolled,
      can_afford: canAfford,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to query wallet status" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    initDb();
    const db = getDb();
    const user = await resolveSessionUser(request);

    const body = await request.json().catch(() => ({}));
    const { course_id, courseId } = body;
    const targetCourseId = course_id || courseId;

    if (!targetCourseId) {
      return NextResponse.json(
        { success: false, error: "MISSING_COURSE_ID", message: "Course ID is required for checkout" },
        { status: 400 }
      );
    }

    // Determine student ID
    let studentId = user.id;
    if (body.student_id) {
      studentId = body.student_id;
    } else if (body.buyer_id) {
      studentId = body.buyer_id;
    } else if (user.role !== "STUDENT" && !user.id.startsWith("usr_")) {
      studentId = "usr_sophia_chen";
    }

    // 1. Validate course
    const course = db
      .prepare("SELECT * FROM courses WHERE id = ? OR slug = ?")
      .get(targetCourseId, targetCourseId) as any;

    if (!course) {
      return NextResponse.json(
        { success: false, error: "COURSE_NOT_FOUND", message: "Course could not be found" },
        { status: 404 }
      );
    }

    if (course.is_published !== 1) {
      return NextResponse.json(
        { success: false, error: "COURSE_NOT_PUBLISHED", message: "Course is in draft mode and not available for purchase" },
        { status: 400 }
      );
    }

    // 2. Validate duplicate enrollment
    const existingEnrollment = db
      .prepare("SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?")
      .get(studentId, course.id) as any;

    if (existingEnrollment) {
      return NextResponse.json(
        {
          success: false,
          error: "ALREADY_ENROLLED",
          message: "You are already enrolled in this course",
          enrollment_id: existingEnrollment.id,
        },
        { status: 400 }
      );
    }

    // 3. Ensure student wallet exists with default $500.00 (50000 cents)
    let wallet = db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(studentId) as any;
    if (!wallet) {
      const now = new Date().toISOString();
      const walId = `wal_${studentId}`;
      db.prepare(
        "INSERT INTO wallets (id, user_id, balance, balance_cents, currency, created_at, updated_at) VALUES (?, ?, 50000, 50000, 'USD', ?, ?)"
      ).run(walId, studentId, now, now);
      wallet = db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(studentId);
    }

    const currentBalanceCents = wallet?.balance_cents ?? wallet?.balance ?? 50000;
    const priceCents = course.price_cents ?? 0;

    if (currentBalanceCents < priceCents) {
      const diffDollars = ((priceCents - currentBalanceCents) / 100).toFixed(2);
      return NextResponse.json(
        {
          success: false,
          error: "INSUFFICIENT_FUNDS",
          message: `Insufficient wallet balance. You need $${diffDollars} more to complete this purchase.`,
          current_balance_cents: currentBalanceCents,
          current_balance_dollars: Number((currentBalanceCents / 100).toFixed(2)),
          price_cents: priceCents,
          price_dollars: Number((priceCents / 100).toFixed(2)),
        },
        { status: 400 }
      );
    }

    // 4. Calculate exact integer-cents 10/90 split
    const split = calculateRevenueSplitFromCents(priceCents);

    const transactionId = `tx_${randomUUID().slice(0, 8)}`;
    const enrollmentId = `enr_${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    const creatorId = course.creator_id || "usr_aris_thorne";
    const superAdmin = db.prepare("SELECT id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1").get() as any;
    const superAdminId = superAdmin?.id || "usr_david_kim";

    // 5. Execute atomic wallet deductions and credits
    let transactionStarted = false;
    try {
      db.exec("BEGIN IMMEDIATE;");
      transactionStarted = true;
    } catch {
      // Transaction already active
    }

    try {
      // Debit student wallet
      db.prepare(
        "UPDATE wallets SET balance = balance - ?, balance_cents = balance_cents - ?, updated_at = ? WHERE user_id = ?"
      ).run(priceCents, priceCents, now, studentId);

      // Credit creator wallet (90% net earnings)
      db.prepare(`
        INSERT INTO wallets (id, user_id, balance, balance_cents, currency, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'USD', ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET 
          balance = balance + excluded.balance,
          balance_cents = balance_cents + excluded.balance_cents,
          updated_at = excluded.updated_at
      `).run(`wal_${creatorId}`, creatorId, split.creatorPayoutCents, split.creatorPayoutCents, now, now);

      // Credit platform fee (10%) to super admin wallet if positive
      if (split.platformFeeCents > 0) {
        db.prepare(`
          INSERT INTO wallets (id, user_id, balance, balance_cents, currency, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'USD', ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET 
            balance = balance + excluded.balance,
            balance_cents = balance_cents + excluded.balance_cents,
            updated_at = excluded.updated_at
        `).run(`wal_${superAdminId}`, superAdminId, split.platformFeeCents, split.platformFeeCents, now, now);
      }

      // Create active course enrollment
      db.prepare(`
        INSERT INTO enrollments (
          id, user_id, course_id, status, progress_pct, assigned_by, assigned_at, due_date, completed_at, expires_at, created_at, updated_at
        ) VALUES (
          ?, ?, ?, 'ACTIVE', 0, NULL, ?, NULL, NULL, NULL, ?, ?
        )
      `).run(enrollmentId, studentId, course.id, now, now, now);

      // Record transaction in transactions ledger
      db.prepare(`
        INSERT INTO transactions (
          id, course_id, student_id, creator_id,
          amount, amount_cents,
          platform_fee, platform_fee_cents,
          creator_earnings, creator_payout_cents,
          currency, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'USD', 'COMPLETED', ?)
      `).run(
        transactionId,
        course.id,
        studentId,
        creatorId,
        split.amountCents,
        split.amountCents,
        split.platformFeeCents,
        split.platformFeeCents,
        split.creatorPayoutCents,
        split.creatorPayoutCents,
        now
      );

      if (transactionStarted) {
        db.exec("COMMIT;");
      }
    } catch (atomicErr) {
      if (transactionStarted) {
        try {
          db.exec("ROLLBACK;");
        } catch {}
      }
      throw atomicErr;
    }

    // 6. Write immutable SHA-256 audit log entry
    try {
      recordAuditEvent({
        actorId: studentId,
        actorRole: (user.id === studentId ? user.role : "STUDENT") as any,
        actorName: user.name || "Student",
        action: "MARKETPLACE_CHECKOUT",
        targetType: "COURSE",
        targetId: course.id,
        courseId: course.id,
        details: {
          transaction_id: transactionId,
          enrollment_id: enrollmentId,
          course_title: course.title,
          amount_cents: split.amountCents,
          amount_dollars: split.amountCents / 100,
          platform_fee_cents: split.platformFeeCents,
          platform_fee_dollars: split.platformFeeDollars,
          creator_payout_cents: split.creatorPayoutCents,
          creator_payout_dollars: split.creatorPayoutDollars,
          status: "COMPLETED",
        },
      });
    } catch (auditErr) {
      console.error("Audit log record error during marketplace checkout:", auditErr);
    }

    // Fetch updated student wallet balance
    const updatedWallet = db.prepare("SELECT balance_cents FROM wallets WHERE user_id = ?").get(studentId) as any;
    const newBalanceCents = updatedWallet?.balance_cents ?? (currentBalanceCents - priceCents);
    const newBalanceDollars = Number((newBalanceCents / 100).toFixed(2));

    return NextResponse.json({
      success: true,
      enrollment_id: enrollmentId,
      transaction_id: transactionId,
      new_balance: newBalanceDollars,
      new_balance_cents: newBalanceCents,
      split: {
        amount_cents: split.amountCents,
        platform_fee_cents: split.platformFeeCents,
        creator_earnings_cents: split.creatorPayoutCents,
        creator_payout_cents: split.creatorPayoutCents,
        platform_fee_dollars: split.platformFeeDollars,
        creator_payout_dollars: split.creatorPayoutDollars,
        amount_dollars: split.amountCents / 100,
      },
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        price_dollars: Number((priceCents / 100).toFixed(2)),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to complete checkout" },
      { status: 500 }
    );
  }
}
