import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { randomUUID } from "node:crypto";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const ALLOWED_CATEGORIES = [
  "SOFTWARE",
  "BUSINESS",
  "DESIGN",
  "MARKETING",
  "SECURITY",
  "DATA_SCIENCE",
  "COMPLIANCE",
  "TECHNICAL_UPSKILLING",
  "ONBOARDING",
  "LEADERSHIP",
];

export async function GET(request: NextRequest) {
  try {
    initDb();
    const db = getDb();
    const user = await getCurrentUser(request);

    // In demo mode, if the user is not CO_ADMIN, fallback to usr_aris_thorne or first co-admin
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

    // Query creator's courses
    let courses = db
      .prepare(
        `SELECT * FROM courses WHERE creator_id = ? ORDER BY created_at DESC`
      )
      .all(creatorId) as any[];

    // If no courses found for this specific creator, include all courses created by any co-admin or all published courses
    if (courses.length === 0) {
      courses = db
        .prepare(`SELECT * FROM courses WHERE creator_id IS NOT NULL ORDER BY created_at DESC`)
        .all() as any[];
    }

    // Enhance each course with sales count, gross revenue, and weeks count
    let totalGrossCents = 0;
    let totalNetCents = 0;
    const allEnrolledStudents = new Set<string>();

    const enhancedCourses = courses.map((course) => {
      const salesCount = (
        db
          .prepare("SELECT COUNT(*) as count FROM enrollments WHERE course_id = ?")
          .get(course.id) as any
      )?.count ?? 0;

      const txStats = db
        .prepare(
          `SELECT 
            COALESCE(SUM(amount_cents), 0) as gross_cents,
            COALESCE(SUM(creator_payout_cents), 0) as net_cents
          FROM transactions 
          WHERE course_id = ? AND status = 'COMPLETED'`
        )
        .get(course.id) as any;

      const grossCents = txStats?.gross_cents ?? 0;
      const netCents = txStats?.net_cents ?? Math.round(grossCents * 0.9);

      totalGrossCents += grossCents;
      totalNetCents += netCents;

      const enrolledUsers = db
        .prepare("SELECT user_id FROM enrollments WHERE course_id = ?")
        .all(course.id) as any[];
      for (const e of enrolledUsers) {
        allEnrolledStudents.add(e.user_id);
      }

      const weeksCount = (
        db
          .prepare("SELECT COUNT(*) as count FROM weeks WHERE course_id = ?")
          .get(course.id) as any
      )?.count ?? course.total_weeks ?? 1;

      return {
        ...course,
        price_dollars: Number((course.price_cents / 100).toFixed(2)),
        sales_count: salesCount,
        gross_revenue_cents: grossCents,
        gross_revenue_dollars: Number((grossCents / 100).toFixed(2)),
        creator_earnings_cents: netCents,
        creator_earnings_dollars: Number((netCents / 100).toFixed(2)),
        total_weeks: Math.max(weeksCount, course.total_weeks ?? 1),
      };
    });

    // Query creator wallet balance
    const wallet = db
      .prepare("SELECT balance_cents FROM wallets WHERE user_id = ?")
      .get(creatorId) as any;
    const walletBalanceCents = wallet?.balance_cents ?? 0;

    return NextResponse.json({
      success: true,
      creator_id: creatorId,
      courses: enhancedCourses,
      analytics: {
        total_gross_cents: totalGrossCents,
        total_gross_dollars: Number((totalGrossCents / 100).toFixed(2)),
        total_net_cents: totalNetCents,
        total_net_dollars: Number((totalNetCents / 100).toFixed(2)),
        total_courses: enhancedCourses.length,
        total_enrolled_students: allEnrolledStudents.size,
        wallet_balance_cents: walletBalanceCents,
        wallet_balance_dollars: Number((walletBalanceCents / 100).toFixed(2)),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch studio courses" },
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
    if (user.role !== "CO_ADMIN" && user.role !== "SUPER_ADMIN") {
      const coAdmin = db.prepare("SELECT id FROM users WHERE role = 'CO_ADMIN' LIMIT 1").get() as any;
      if (coAdmin) {
        creatorId = coAdmin.id;
      }
    }

    const body = await request.json().catch(() => ({}));
    const {
      title,
      description = "",
      category = "SOFTWARE",
      price = 0,
      price_cents,
      thumbnail_url = null,
      total_weeks = 1,
    } = body;

    if (!title || typeof title !== "string" || title.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: "Course title must be at least 3 characters long" },
        { status: 400 }
      );
    }

    const calculatedPriceCents =
      price_cents !== undefined
        ? Math.max(0, Math.round(Number(price_cents)))
        : Math.max(0, Math.round(Number(price) * 100));

    let sanitizedCategory = category.toUpperCase().trim();
    if (sanitizedCategory === "DEVELOPMENT") sanitizedCategory = "SOFTWARE";
    if (!ALLOWED_CATEGORIES.includes(sanitizedCategory)) {
      sanitizedCategory = "SOFTWARE";
    }

    const courseId = `crs_${randomUUID().slice(0, 8)}`;
    const baseSlug = slugify(title);
    let slug = baseSlug;
    let counter = 1;
    while (db.prepare("SELECT id FROM courses WHERE slug = ?").get(slug)) {
      slug = `${baseSlug}-${counter++}`;
    }

    const now = new Date().toISOString();
    const weeksCount = Math.max(1, Math.min(52, Number(total_weeks) || 1));

    // Insert course
    db.prepare(
      `INSERT INTO courses (
        id, slug, title, description, category, target_role, is_mandatory,
        estimated_minutes, renewal_period_days, passing_score_pct, version,
        is_published, creator_id, price_cents, thumbnail_url, total_weeks,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, 'ALL', 0,
        ?, NULL, 80, '1.0.0',
        0, ?, ?, ?, ?,
        ?, ?
      )`
    ).run(
      courseId,
      slug,
      title.trim(),
      description.trim(),
      sanitizedCategory,
      weeksCount * 60,
      creatorId,
      calculatedPriceCents,
      thumbnail_url,
      weeksCount,
      now,
      now
    );

    // Create initial weekly milestones (Week 1 through Week N)
    const insertWeek = db.prepare(
      `INSERT INTO weeks (id, course_id, week_number, title, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    for (let w = 1; w <= weeksCount; w++) {
      const weekId = `wk_${randomUUID().slice(0, 8)}`;
      const weekTitle =
        w === 1
          ? "Week 1: Core Architectural Foundations"
          : `Week ${w}: Module Milestone ${w}`;
      insertWeek.run(
        weekId,
        courseId,
        w,
        weekTitle,
        `Curriculum and milestones for week ${w}`,
        now,
        now
      );
    }

    const createdCourse = db.prepare("SELECT * FROM courses WHERE id = ?").get(courseId) as any;

    return NextResponse.json(
      {
        success: true,
        course: {
          ...createdCourse,
          price_dollars: Number((createdCourse.price_cents / 100).toFixed(2)),
          sales_count: 0,
          gross_revenue_cents: 0,
          creator_earnings_cents: 0,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create course" },
      { status: 500 }
    );
  }
}
