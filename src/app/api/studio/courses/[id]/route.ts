import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    initDb();
    const db = getDb();
    const { id: courseId } = await params;

    const course = db.prepare("SELECT * FROM courses WHERE id = ?").get(courseId) as any;
    if (!course) {
      return NextResponse.json(
        { success: false, error: `Course not found: ${courseId}` },
        { status: 404 }
      );
    }

    // Fetch weeks and lessons
    const weeks = db
      .prepare("SELECT * FROM weeks WHERE course_id = ? ORDER BY week_number ASC")
      .all(courseId) as any[];

    for (const week of weeks) {
      const lessons = db
        .prepare("SELECT * FROM lessons WHERE week_id = ? ORDER BY order_index ASC")
        .all(week.id) as any[];

      for (const l of lessons) {
        if (typeof l.supplementary_files === "string") {
          try {
            l.supplementary_files = JSON.parse(l.supplementary_files);
          } catch {
            l.supplementary_files = [];
          }
        }
      }
      week.lessons = lessons;

      // Load quiz for this week
      try {
        const quiz = db
          .prepare("SELECT * FROM week_quizzes WHERE week_id = ?")
          .get(week.id) as any;
        if (quiz) {
          if (typeof quiz.questions === "string") {
            try {
              quiz.questions = JSON.parse(quiz.questions);
            } catch {
              quiz.questions = [];
            }
          }
          week.quiz = quiz;
        } else {
          week.quiz = null;
        }
      } catch {
        week.quiz = null;
      }
    }

    const salesCount = (
      db
        .prepare("SELECT COUNT(*) as count FROM enrollments WHERE course_id = ?")
        .get(courseId) as any
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

    const grossCents = txStats?.gross_cents ?? 0;
    const netCents = txStats?.net_cents ?? Math.round(grossCents * 0.9);

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
    initDb();
    const db = getDb();
    const { id: courseId } = await params;

    const existingCourse = db
      .prepare("SELECT * FROM courses WHERE id = ?")
      .get(courseId) as any;
    if (!existingCourse) {
      return NextResponse.json(
        { success: false, error: `Course not found: ${courseId}` },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const now = new Date().toISOString();

    const updates: string[] = [];
    const values: any[] = [];

    if (body.title !== undefined && typeof body.title === "string") {
      if (body.title.trim().length < 3) {
        return NextResponse.json(
          { success: false, error: "Title must be at least 3 characters" },
          { status: 400 }
        );
      }
      updates.push("title = ?");
      values.push(body.title.trim());
    }

    if (body.description !== undefined) {
      updates.push("description = ?");
      values.push(String(body.description).trim());
    }

    if (body.category !== undefined) {
      let cat = String(body.category).toUpperCase().trim();
      if (cat === "DEVELOPMENT") cat = "SOFTWARE";
      updates.push("category = ?");
      values.push(cat);
    }

    if (body.price_cents !== undefined) {
      const pCents = Math.max(0, Math.round(Number(body.price_cents)));
      updates.push("price_cents = ?");
      values.push(pCents);
    } else if (body.price !== undefined) {
      const pCents = Math.max(0, Math.round(Number(body.price) * 100));
      updates.push("price_cents = ?");
      values.push(pCents);
    }

    if (body.thumbnail_url !== undefined) {
      updates.push("thumbnail_url = ?");
      values.push(body.thumbnail_url || null);
    }

    if (body.is_published !== undefined) {
      const isPub = body.is_published ? 1 : 0;
      updates.push("is_published = ?");
      values.push(isPub);
    }

    if (body.total_weeks !== undefined) {
      const tw = Math.max(1, Math.min(52, Number(body.total_weeks) || 1));
      updates.push("total_weeks = ?");
      values.push(tw);
    }

    if (updates.length > 0) {
      updates.push("updated_at = ?");
      values.push(now);
      values.push(courseId);

      const query = `UPDATE courses SET ${updates.join(", ")} WHERE id = ?`;
      db.prepare(query).run(...values);
    }

    const updatedCourse = db
      .prepare("SELECT * FROM courses WHERE id = ?")
      .get(courseId) as any;

    return NextResponse.json({
      success: true,
      course: {
        ...updatedCourse,
        price_dollars: Number((updatedCourse.price_cents / 100).toFixed(2)),
      },
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
    initDb();
    const db = getDb();
    const { id: courseId } = await params;

    const existingCourse = db
      .prepare("SELECT * FROM courses WHERE id = ?")
      .get(courseId) as any;
    if (!existingCourse) {
      return NextResponse.json(
        { success: false, error: `Course not found: ${courseId}` },
        { status: 404 }
      );
    }

    db.prepare("DELETE FROM courses WHERE id = ?").run(courseId);

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
