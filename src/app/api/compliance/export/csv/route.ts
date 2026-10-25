import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { generateAuditCsv } from "@/lib/compliance";
import type { AuditLogRecord } from "@/types";

export async function GET(request: NextRequest) {
  try {
    initDb();
    const db = getDb();
    const currentUser = await getCurrentUser();

    if (!hasPermission(currentUser.role, "MANAGER")) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Privileged role required to export audit logs" },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId") || searchParams.get("actorId");
    const courseId = searchParams.get("courseId");

    let sql = "SELECT * FROM audit_logs WHERE 1=1";
    const params: any[] = [];

    if (userId) {
      sql += " AND actor_id = ?";
      params.push(userId);
    }
    if (courseId) {
      sql += " AND course_id = ?";
      params.push(courseId);
    }

    sql += " ORDER BY id ASC";
    const records = db.prepare(sql).all(...params) as unknown as AuditLogRecord[];

    const csvContent = generateAuditCsv(records);
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `compliance-audit-log-${dateStr}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("GET /api/compliance/export/csv error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate CSV audit export" },
      { status: 500 }
    );
  }
}
