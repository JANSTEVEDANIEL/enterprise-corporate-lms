import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { dbAdapter } from "@/lib/supabase/adapter";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);

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

    let result: any;
    try {
      result = await dbAdapter.assignCourse({
        userId,
        courseId,
        dueDate,
        assignedBy: currentUser.id,
      });
    } catch (err: any) {
      if (err.message === "USER_NOT_FOUND") {
        return NextResponse.json(
          { success: false, error: "User not found" },
          { status: 404 }
        );
      }
      if (err.message === "COURSE_NOT_FOUND") {
        return NextResponse.json(
          { success: false, error: "Course not found" },
          { status: 404 }
        );
      }
      throw err;
    }

    const { enrollment, user, course } = result;

    try {
      recordAuditEvent({
        actorId: currentUser.id,
        actorRole: currentUser.role,
        actorName: currentUser.name,
        action: "COURSE_ASSIGNED",
        targetType: "ENROLLMENT",
        targetId: enrollment.id,
        courseId,
        details: {
          assignedToUserId: userId,
          assignedToName: user.name,
          assignedByUserId: currentUser.id,
          assignedByName: currentUser.name,
          courseId,
          courseTitle: course.title,
          dueDate: enrollment.due_date,
        },
      });
    } catch (auditErr) {
      console.error("Audit log error:", auditErr);
    }

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
