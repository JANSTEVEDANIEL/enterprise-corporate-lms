import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { dbAdapter } from "@/lib/supabase/adapter";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const currentUser = await getCurrentUser(request);
    const { userId } = await context.params;

    if (currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "Forbidden: Super Administrator role required to update users" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { role, department, jobTitle, managerId, isActive } = body;

    let result: any;
    try {
      result = await dbAdapter.updateAdminUser(userId, {
        role,
        department,
        jobTitle,
        managerId,
        isActive,
      });
    } catch (err: any) {
      if (err.message === "USER_NOT_FOUND") {
        return NextResponse.json(
          { success: false, error: "User not found" },
          { status: 404 }
        );
      }
      throw err;
    }

    const { updatedUser, previousUser } = result;

    try {
      recordAuditEvent({
        actorId: currentUser.id,
        actorRole: currentUser.role,
        actorName: currentUser.name,
        action: "USER_UPDATED",
        targetType: "USER",
        targetId: userId,
        details: {
          updatedUserId: userId,
          previousState: {
            role: previousUser.role,
            department: previousUser.department,
            jobTitle: previousUser.job_title,
            managerId: previousUser.manager_id,
            isActive: previousUser.is_active,
          },
          newState: {
            role: updatedUser.role,
            department: updatedUser.department,
            jobTitle: updatedUser.job_title,
            managerId: updatedUser.manager_id,
            isActive: updatedUser.is_active,
          },
          updatedBy: currentUser.name,
        },
      });
    } catch (auditErr) {
      console.error("Audit log error:", auditErr);
    }

    return NextResponse.json({
      success: true,
      message: `User ${updatedUser.name} updated successfully`,
      user: updatedUser,
    });
  } catch (error: any) {
    console.error("PATCH /api/admin/users/[userId] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update user" },
      { status: 500 }
    );
  }
}
