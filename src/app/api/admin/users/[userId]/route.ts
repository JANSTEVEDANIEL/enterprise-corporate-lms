import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    initDb();
    const db = getDb();
    const currentUser = await getCurrentUser();
    const { userId } = await context.params;

    if (currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "Forbidden: Super Administrator role required to update users" },
        { status: 403 }
      );
    }

    const userStmt = db.prepare("SELECT * FROM users WHERE id = ?");
    const existingUser = userStmt.get(userId) as any;
    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { role, department, jobTitle, managerId, isActive } = body;

    const newRole = role !== undefined ? role : existingUser.role;
    const newDepartment = department !== undefined ? department : existingUser.department;
    const newJobTitle = jobTitle !== undefined ? jobTitle : existingUser.job_title;
    const newManagerId = managerId !== undefined ? managerId : existingUser.manager_id;
    const newIsActive = isActive !== undefined ? (isActive ? 1 : 0) : existingUser.is_active;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE users
      SET role = ?, department = ?, job_title = ?, manager_id = ?, is_active = ?, updated_at = ?
      WHERE id = ?
    `).run(newRole, newDepartment, newJobTitle, newManagerId, newIsActive, now, userId);

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
          role: existingUser.role,
          department: existingUser.department,
          jobTitle: existingUser.job_title,
          managerId: existingUser.manager_id,
          isActive: existingUser.is_active,
        },
        newState: {
          role: newRole,
          department: newDepartment,
          jobTitle: newJobTitle,
          managerId: newManagerId,
          isActive: newIsActive,
        },
        updatedBy: currentUser.name,
      },
    });

    const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);

    return NextResponse.json({
      success: true,
      message: `User ${existingUser.name} updated successfully`,
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
