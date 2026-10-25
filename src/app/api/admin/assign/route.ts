import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb, initDb } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    initDb();
    const db = getDb();
    const currentUser = await getCurrentUser();

    if (!hasPermission(currentUser.role, "MANAGER")) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Manager or administrator role required to assign courses" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, courseId, dueDate } = body;

    if (!userId || !courseId) {
      return NextResponse.json(
        { success: false, error: "userId and courseId are required" },
        { status: 400 }
      );
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const course = db.prepare("SELECT * FROM courses WHERE id = ?").get(courseId) as any;
    if (!course) {
      return NextResponse.json(
        { success: false, error: "Course not found" },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    let calculatedDueDate = dueDate;
    if (!calculatedDueDate) {
      calculatedDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    // Check if already enrolled
    const existing = db.prepare("SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?").get(userId, courseId) as any;

    let enrollmentId: string;
    if (existing) {
      enrollmentId = existing.id;
      db.prepare(`
        UPDATE enrollments
        SET due_date = ?, assigned_by = ?, updated_at = ?
        WHERE id = ?
      `).run(calculatedDueDate, currentUser.id, now, enrollmentId);
    } else {
      enrollmentId = `enr_${randomUUID().substring(0, 12)}`;
      db.prepare(`
        INSERT INTO enrollments (
          id, user_id, course_id, status, progress_pct, assigned_by, assigned_at, due_date, created_at, updated_at
        ) VALUES (?, ?, ?, 'NOT_STARTED', 0, ?, ?, ?, ?, ?)
      `).run(enrollmentId, userId, courseId, currentUser.id, now, calculatedDueDate, now, now);
    }

    recordAuditEvent({
      actorId: currentUser.id,
      actorRole: currentUser.role,
      actorName: currentUser.name,
      action: "COURSE_ASSIGNED",
      targetType: "ENROLLMENT",
      targetId: enrollmentId,
      courseId,
      details: {
        assignedToUserId: userId,
        assignedToName: user.name,
        assignedByUserId: currentUser.id,
        assignedByName: currentUser.name,
        courseId,
        courseTitle: course.title,
        dueDate: calculatedDueDate,
      },
    });

    const enrollment = db.prepare("SELECT * FROM enrollments WHERE id = ?").get(enrollmentId);

    return NextResponse.json({
      success: true,
      message: `Course "${course.title}" successfully assigned to ${user.name}`,
      enrollment,
    }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/admin/assign error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to assign course" },
      { status: 500 }
    );
  }
}
