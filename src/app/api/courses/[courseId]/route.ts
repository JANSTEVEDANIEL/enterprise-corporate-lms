import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb, initDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    initDb();
    const db = getDb();
    const currentUser = await getCurrentUser();
    const { courseId } = await params;

    // Support lookup by ID or slug
    const courseStmt = db.prepare(`
      SELECT * FROM courses 
      WHERE id = ? OR slug = ?
    `);
    const course = courseStmt.get(courseId, courseId) as any;

    if (!course) {
      return NextResponse.json(
        { success: false, error: "Course not found" },
        { status: 404 }
      );
    }

    // Fetch user enrollment
    const enrollmentStmt = db.prepare(`
      SELECT * FROM enrollments 
      WHERE user_id = ? AND course_id = ?
    `);
    const enrollment = enrollmentStmt.get(currentUser.id, course.id) as any;

    // Fetch modules with progress
    const modulesStmt = db.prepare(`
      SELECT 
        m.id,
        m.course_id,
        m.title,
        m.description,
        m.order_index,
        m.type,
        m.estimated_minutes,
        m.version,
        mp.id as progress_id,
        mp.status as progress_status,
        mp.completed_at,
        mp.time_spent_seconds,
        q.id as quiz_id,
        q.passing_score_pct as quiz_passing_score
      FROM modules m
      LEFT JOIN module_progress mp ON mp.module_id = m.id AND mp.enrollment_id = ?
      LEFT JOIN quizzes q ON q.module_id = m.id
      WHERE m.course_id = ?
      ORDER BY m.order_index ASC
    `);

    const modules = modulesStmt.all(enrollment?.id || null, course.id);

    // Fetch certificate if completed
    let certificate = null;
    if (enrollment && enrollment.status === "COMPLETED") {
      const certStmt = db.prepare("SELECT * FROM certificates WHERE enrollment_id = ?");
      certificate = certStmt.get(enrollment.id) as any;
    }

    return NextResponse.json({
      success: true,
      course,
      modules,
      enrollment: enrollment || null,
      certificate: certificate || null,
    });
  } catch (error: any) {
    console.error("GET /api/courses/[courseId] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch course details" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    initDb();
    const db = getDb();
    const currentUser = await getCurrentUser();
    const { courseId } = await params;

    const courseStmt = db.prepare("SELECT * FROM courses WHERE id = ? OR slug = ?");
    const course = courseStmt.get(courseId, courseId) as any;

    if (!course) {
      return NextResponse.json(
        { success: false, error: "Course not found" },
        { status: 404 }
      );
    }

    const existingStmt = db.prepare("SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?");
    const existing = existingStmt.get(currentUser.id, course.id) as any;

    if (existing) {
      return NextResponse.json({
        success: true,
        enrolled: true,
        message: "Already enrolled",
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
    `).run(enrollmentId, currentUser.id, course.id, now, dueDate, now, now);

    recordAuditEvent({
      actorId: currentUser.id,
      actorRole: currentUser.role,
      actorName: currentUser.name,
      action: "COURSE_ENROLLED",
      targetType: "COURSE",
      targetId: course.id,
      courseId: course.id,
      details: {
        enrollmentId,
        courseTitle: course.title,
      },
    });

    const newEnrollment = db.prepare("SELECT * FROM enrollments WHERE id = ?").get(enrollmentId);

    return NextResponse.json({
      success: true,
      enrolled: true,
      message: "Enrolled successfully",
      enrollment: newEnrollment,
    }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/courses/[courseId] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to enroll" },
      { status: 500 }
    );
  }
}
