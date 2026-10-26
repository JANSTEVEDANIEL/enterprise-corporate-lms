import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    initDb();
    const db = getDb();
    const url = new URL(request.url);

    const category = url.searchParams.get("category");
    const search = url.searchParams.get("search") || url.searchParams.get("q");
    const priceType = url.searchParams.get("price_type") || url.searchParams.get("price"); // all, free, paid

    let sql = `
      SELECT c.*, 
             COALESCE(u.name, 'Dr. Aris Thorne') as creator_name,
             (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) as enrolled_count
      FROM courses c
      LEFT JOIN users u ON c.creator_id = u.id
      WHERE c.is_published = 1
    `;
    const params: any[] = [];

    if (category && category !== "ALL" && category !== "All Categories") {
      sql += " AND UPPER(c.category) = UPPER(?)";
      params.push(category);
    }

    if (priceType === "free") {
      sql += " AND c.price_cents = 0";
    } else if (priceType === "paid") {
      sql += " AND c.price_cents > 0";
    }

    if (search && search.trim().length > 0) {
      const term = `%${search.trim()}%`;
      sql += " AND (c.title LIKE ? OR c.description LIKE ? OR u.name LIKE ?)";
      params.push(term, term, term);
    }

    sql += " ORDER BY c.created_at DESC";

    const rows = db.prepare(sql).all(...params) as any[];

    const courses = rows.map((r) => ({
      ...r,
      price_dollars: Number((r.price_cents / 100).toFixed(2)),
      rating: 4.9,
    }));

    return NextResponse.json({
      success: true,
      count: courses.length,
      courses,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch marketplace courses" },
      { status: 500 }
    );
  }
}
