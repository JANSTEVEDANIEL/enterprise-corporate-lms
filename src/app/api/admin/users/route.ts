import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb, initDb } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import type { Role } from "@/types";

export async function GET(request: NextRequest) {
  try {
    initDb();
    const db = getDb();
    const currentUser = await getCurrentUser();

    // Check manager or admin permissions
    if (!hasPermission(currentUser.role, "MANAGER")) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Privileged role required" },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const department = searchParams.get("department");
    const roleFilter = searchParams.get("role");

    let sql = `
      SELECT 
        u.*,
        m.name as manager_name,
        (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id) as enrollments_count,
        (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id AND e.status = 'COMPLETED') as completed_count,
        (SELECT COUNT(*) FROM certificates c WHERE c.user_id = u.id) as certificates_count
      FROM users u
      LEFT JOIN users m ON m.id = u.manager_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (department && department !== "ALL") {
      sql += " AND u.department = ?";
      params.push(department);
    }

    if (roleFilter && roleFilter !== "ALL") {
      sql += " AND u.role = ?";
      params.push(roleFilter);
    }

    sql += " ORDER BY u.role DESC, u.name ASC";

    const users = db.prepare(sql).all(...params);

    // Also get managers list for dropdown selection
    const managers = db.prepare(`
      SELECT id, name, email, department, role
      FROM users
      WHERE role IN ('MANAGER', 'COMPLIANCE_OFFICER', 'SUPER_ADMIN') AND is_active = 1
      ORDER BY name ASC
    `).all();

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
    initDb();
    const db = getDb();
    const currentUser = await getCurrentUser();

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

    // Check email uniqueness
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return NextResponse.json(
        { success: false, error: "A user with this email address already exists" },
        { status: 409 }
      );
    }

    const newUserId = `usr_${randomUUID().substring(0, 12)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (
        id, email, name, role, department, job_title, manager_id, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(newUserId, email, name, role, department, jobTitle, managerId || null, now, now);

    recordAuditEvent({
      actorId: currentUser.id,
      actorRole: currentUser.role,
      actorName: currentUser.name,
      action: "USER_PROVISIONED",
      targetType: "USER",
      targetId: newUserId,
      details: {
        provisionedUserId: newUserId,
        email,
        name,
        role,
        department,
        jobTitle,
        managerId: managerId || null,
        provisionedBy: currentUser.name,
      },
    });

    const createdUser = db.prepare("SELECT * FROM users WHERE id = ?").get(newUserId);

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
