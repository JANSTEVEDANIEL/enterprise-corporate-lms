import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import type { AuditLogRecord } from "@/types";

export async function GET(request: NextRequest) {
  try {
    initDb();
    const db = getDb();
    const currentUser = await getCurrentUser();

    if (!hasPermission(currentUser.role, "COMPLIANCE_OFFICER")) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Compliance Officer or Administrator role required" },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 500);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);
    const actionFilter = searchParams.get("action");
    const search = searchParams.get("search");

    let sql = "SELECT * FROM audit_logs WHERE 1=1";
    let countSql = "SELECT COUNT(*) as count FROM audit_logs WHERE 1=1";
    const params: any[] = [];
    const countParams: any[] = [];

    if (actionFilter && actionFilter.trim() !== "" && actionFilter !== "ALL") {
      sql += " AND action = ?";
      countSql += " AND action = ?";
      params.push(actionFilter.trim());
      countParams.push(actionFilter.trim());
    }

    if (search && search.trim() !== "") {
      const term = `%${search.trim()}%`;
      const searchClause = " AND (actor_name LIKE ? OR actor_id LIKE ? OR action LIKE ? OR target_id LIKE ? OR record_hash LIKE ?)";
      sql += searchClause;
      countSql += searchClause;
      params.push(term, term, term, term, term);
      countParams.push(term, term, term, term, term);
    }

    sql += " ORDER BY id DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const records = db.prepare(sql).all(...params) as unknown as AuditLogRecord[];
    const totalCount = (db.prepare(countSql).get(...countParams) as { count: number }).count;

    return NextResponse.json({
      success: true,
      records,
      totalCount,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("GET /api/compliance/audit-logs error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load audit logs" },
      { status: 500 }
    );
  }
}
