import { NextRequest, NextResponse } from "next/server";
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
        { success: false, error: "Forbidden: Manager or administrator role required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { employeeId, courseId, message } = body;

    if (!employeeId) {
      return NextResponse.json(
        { success: false, error: "employeeId is required" },
        { status: 400 }
      );
    }

    const userStmt = db.prepare("SELECT * FROM users WHERE id = ?");
    const employee = userStmt.get(employeeId) as any;
    if (!employee) {
      return NextResponse.json(
        { success: false, error: "Employee not found" },
        { status: 404 }
      );
    }

    let courseTitle: string | null = null;
    if (courseId) {
      const courseStmt = db.prepare("SELECT title FROM courses WHERE id = ?");
      const course = courseStmt.get(courseId) as any;
      if (course) {
        courseTitle = course.title;
      }
    }

    const defaultMessage = courseTitle
      ? `Action Required: Please complete mandatory training for "${courseTitle}".`
      : "Action Required: Please review and complete your pending mandatory compliance trainings.";

    const auditEvent = recordAuditEvent({
      actorId: currentUser.id,
      actorRole: currentUser.role,
      actorName: currentUser.name,
      action: "NUDGE_SENT",
      targetType: "USER",
      targetId: employeeId,
      courseId: courseId || null,
      details: {
        recipientId: employee.id,
        recipientName: employee.name,
        recipientEmail: employee.email,
        courseId: courseId || null,
        courseTitle,
        nudgeMessage: message || defaultMessage,
        triggeredBy: currentUser.name,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Nudge reminder successfully sent to ${employee.name}`,
      timestamp: auditEvent.timestamp,
      auditLogId: auditEvent.id,
      recordHash: auditEvent.record_hash,
      nudge: {
        recipientId: employee.id,
        recipientName: employee.name,
        courseTitle,
        sentAt: auditEvent.timestamp,
      },
    });
  } catch (error: any) {
    console.error("POST /api/manager/nudge error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send nudge" },
      { status: 500 }
    );
  }
}
