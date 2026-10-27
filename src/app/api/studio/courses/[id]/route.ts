import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { dbAdapter } from "@/lib/supabase/adapter";
import { getDb, initDb } from "@/lib/db";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser(request);
    if (currentUser.role === "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE", code: 403 },
        { status: 403 }
      );
    }
    const { id: courseId } = await params;

    const course = await dbAdapter.getCourseById(courseId);
    if (!course) {
      return NextResponse.json(
        { success: false, error: `Course not found: ${courseId}` },
        { status: 404 }
      );
    }

    const weeks = await dbAdapter.getCurriculum(courseId);

    let salesCount = 0;
    let grossCents = 0;
    let netCents = 0;

    if (dbAdapter.isOffline) {
      initDb();
      const db = getDb();
      salesCount = (
        db.prepare("SELECT COUNT(*) as count FROM enrollments WHERE course_id = ?").get(courseId) as any
      )?.count ?? 0;

      const txStats = db
        .prepare(
          `SELECT 
            COALESCE(SUM(amount_cents), 0) as gross_cents,
            COALESCE(SUM(creator_payout_cents), 0) as net_cents
          FROM transactions 
          WHERE course_id = ? AND status = 'COMPLETED'`
        )
        .get(courseId) as any;

      grossCents = txStats?.gross_cents ?? 0;
      netCents = txStats?.net_cents ?? Math.round(grossCents * 0.9);
    } else {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        const [salesRes, txRes] = await Promise.all([
          supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("course_id", courseId),
          supabase.from("transactions").select("amount_cents, creator_payout_cents").eq("course_id", courseId).eq("status", "COMPLETED"),
        ]);
        salesCount = salesRes.count || 0;
        for (const t of txRes.data || []) {
          grossCents += t.amount_cents || 0;
          netCents += t.creator_payout_cents || 0;
        }
      }
    }

    return NextResponse.json({
      success: true,
      course: {
        ...course,
        price_dollars: Number((course.price_cents / 100).toFixed(2)),
        sales_count: salesCount,
        gross_revenue_cents: grossCents,
        gross_revenue_dollars: Number((grossCents / 100).toFixed(2)),
        creator_earnings_cents: netCents,
        creator_earnings_dollars: Number((netCents / 100).toFixed(2)),
        weeks,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch course details" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser(request);
    if (currentUser.role === "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE", code: 403 },
        { status: 403 }
      );
    }
    const { id: courseId } = await params;

    const existingCourse = await dbAdapter.getCourseById(courseId);
    if (!existingCourse) {
      return NextResponse.json(
        { success: false, error: `Course not found: ${courseId}` },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    if (body.title !== undefined && typeof body.title === "string" && body.title.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: "Title must be at least 3 characters" },
        { status: 400 }
      );
    }

    const updatedCourse = await dbAdapter.updateCourse(courseId, body);

    return NextResponse.json({
      success: true,
      course: updatedCourse,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update course" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PATCH(request, context);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser(request);
    if (currentUser.role === "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE", code: 403 },
        { status: 403 }
      );
    }
    const { id: courseId } = await params;

    const existingCourse = await dbAdapter.getCourseById(courseId);
    if (!existingCourse) {
      return NextResponse.json(
        { success: false, error: `Course not found: ${courseId}` },
        { status: 404 }
      );
    }

    await dbAdapter.deleteCourse(courseId);

    return NextResponse.json({
      success: true,
      message: `Course ${courseId} successfully deleted`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete course" },
      { status: 500 }
    );
  }
}
