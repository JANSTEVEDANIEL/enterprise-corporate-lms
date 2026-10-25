import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb, initDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    initDb();
    const db = getDb();
    const currentUser = await getCurrentUser();

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get("category");
    const query = searchParams.get("query") || searchParams.get("search");

    let sql = `
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) as modules_count,
        e.id as enrollment_id,
        e.status as enrollment_status,
        e.progress_pct as progress_pct,
        e.due_date,
        e.completed_at
      FROM courses c
      LEFT JOIN enrollments e ON e.course_id = c.id AND e.user_id = ?
      WHERE c.is_published = 1
    `;

    const params: any[] = [currentUser.id];

    if (category && category !== "ALL") {
      sql += " AND c.category = ?";
      params.push(category);
    }

    if (query && query.trim() !== "") {
      sql += " AND (c.title LIKE ? OR c.description LIKE ?)";
      const pattern = `%${query.trim()}%`;
      params.push(pattern, pattern);
    }

    sql += " ORDER BY c.is_mandatory DESC, c.title ASC";

    const stmt = db.prepare(sql);
    const courses = stmt.all(...params);

    return NextResponse.json({
      success: true,
      courses,
      count: courses.length,
    });
  } catch (error: any) {
    console.error("GET /api/courses error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch courses" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    initDb();
    const db = getDb();
    const currentUser = await getCurrentUser();

    const body = await request.json();
    const { courseId } = body;

    if (!courseId) {
      return NextResponse.json(
        { success: false, error: "courseId is required" },
        { status: 400 }
      );
    }

    const courseStmt = db.prepare("SELECT * FROM courses WHERE id = ?");
    const course = courseStmt.get(courseId) as any;
    if (!course) {
      return NextResponse.json(
        { success: false, error: "Course not found" },
        { status: 404 }
      );
    }

    // Check existing enrollment
    const existingStmt = db.prepare("SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?");
    const existing = existingStmt.get(currentUser.id, courseId) as any;

    if (existing) {
      return NextResponse.json({
        success: true,
        enrolled: true,
        message: "Already enrolled in this course",
        enrollment: existing,
      });
    }

    const enrollmentId = `enr_${randomUUID()}`;
    const now = new Date().toISOString();
    let dueDate: string | null = null;
    if (course.renewal_period_days) {
      dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    }

    db.prepare(`
      INSERT INTO enrollments (
        id, user_id, course_id, status, progress_pct, assigned_at, due_date, created_at, updated_at
      ) VALUES (?, ?, ?, 'NOT_STARTED', 0, ?, ?, ?, ?)
    `).run(enrollmentId, currentUser.id, courseId, now, dueDate, now, now);

    recordAuditEvent({
      actorId: currentUser.id,
      actorRole: currentUser.role,
      actorName: currentUser.name,
      action: "COURSE_ENROLLED",
      targetType: "COURSE",
      targetId: courseId,
      courseId,
      details: {
        enrollmentId,
        courseTitle: course.title,
      },
    });

    const newEnrollment = db.prepare("SELECT * FROM enrollments WHERE id = ?").get(enrollmentId);

    return NextResponse.json({
      success: true,
      enrolled: true,
      message: "Successfully enrolled in course",
      enrollment: newEnrollment,
    }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/courses error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to enroll in course" },
      { status: 500 }
    );
  }
}
