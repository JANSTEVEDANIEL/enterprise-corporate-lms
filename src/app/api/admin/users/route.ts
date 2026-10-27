import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { dbAdapter } from "@/lib/supabase/adapter";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);

    if (!hasPermission(currentUser.role, "MANAGER")) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Privileged role required" },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const department = searchParams.get("department") || undefined;
    const roleFilter = searchParams.get("role") || undefined;

    const { users, managers } = await dbAdapter.getAdminUsers({
      department,
      role: roleFilter,
    });

    return NextResponse.json({
      success: true,
      users,
      managers,
      totalCount: users.length,
    });
  } catch (error: any) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load user directory" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);

    if (currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "Forbidden: Super Administrator role required to provision users" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, name, role = "EMPLOYEE", department, jobTitle, managerId } = body;

    if (!email || !name || !department || !jobTitle) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: email, name, department, jobTitle" },
        { status: 400 }
      );
    }

    let createdUser: any;
    try {
      createdUser = await dbAdapter.createAdminUser({
        email,
        name,
        role,
        department,
        jobTitle,
        managerId,
      });
    } catch (err: any) {
      if (err.code === "EMAIL_EXISTS" || err.message?.includes("already exists")) {
        return NextResponse.json(
          { success: false, error: "A user with this email address already exists" },
          { status: 409 }
        );
      }
      throw err;
    }

    try {
      recordAuditEvent({
        actorId: currentUser.id,
        actorRole: currentUser.role,
        actorName: currentUser.name,
        action: "USER_PROVISIONED",
        targetType: "USER",
        targetId: createdUser.id,
        details: {
          provisionedUserId: createdUser.id,
          email,
          name,
          role,
          department,
          jobTitle,
          managerId: managerId || null,
          provisionedBy: currentUser.name,
        },
      });
    } catch (auditErr) {
      console.error("Audit log error:", auditErr);
    }

    return NextResponse.json({
      success: true,
      message: `User ${name} provisioned successfully`,
      user: createdUser,
    }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/admin/users error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to provision user" },
      { status: 500 }
    );
  }
}
