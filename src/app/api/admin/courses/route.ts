import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb, initDb } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    initDb();
    const db = getDb();
    const currentUser = await getCurrentUser();

    if (!hasPermission(currentUser.role, "MANAGER")) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Privileged role required" },
        { status: 403 }
      );
    }

    const coursesStmt = db.prepare(`
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) as modules_count,
        (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) as enrollments_count,
        (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status = 'COMPLETED') as completed_count
      FROM courses c
      ORDER BY c.created_at DESC
    `);
    const courses = coursesStmt.all();

    return NextResponse.json({
      success: true,
      courses,
      totalCount: courses.length,
    });
  } catch (error: any) {
    console.error("GET /api/admin/courses error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load courses" },
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
        { success: false, error: "Forbidden: Super Administrator role required to author courses" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      title,
      slug,
      description,
      category = "COMPLIANCE",
      targetRole = "ALL",
      isMandatory = 1,
      estimatedMinutes = 45,
      renewalPeriodDays = 365,
      passingScorePct = 80,
      version = "1.0.0",
      isPublished = 1,
      modules = [],
    } = body;

    if (!title || !description) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: title, description" },
        { status: 400 }
      );
    }

    const courseSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    // Check slug uniqueness
    const existing = db.prepare("SELECT id FROM courses WHERE slug = ?").get(courseSlug);
    if (existing) {
      return NextResponse.json(
        { success: false, error: "A course with this slug already exists" },
        { status: 409 }
      );
    }

    const courseId = `crs_${randomUUID().substring(0, 12)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO courses (
        id, slug, title, description, category, target_role, is_mandatory,
        estimated_minutes, renewal_period_days, passing_score_pct, version,
        is_published, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      courseId,
      courseSlug,
      title,
      description,
      category,
      targetRole,
      isMandatory ? 1 : 0,
      estimatedMinutes,
      renewalPeriodDays || null,
      passingScorePct,
      version,
      isPublished ? 1 : 0,
      now,
      now
    );

    // If modules were supplied, insert them
    if (Array.isArray(modules) && modules.length > 0) {
      const insertModStmt = db.prepare(`
        INSERT INTO modules (
          id, course_id, title, description, order_index, type, content,
          estimated_minutes, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      modules.forEach((mod: any, idx: number) => {
        const modId = mod.id || `mod_${randomUUID().substring(0, 10)}`;
        insertModStmt.run(
          modId,
          courseId,
          mod.title || `Module ${idx + 1}`,
          mod.description || "",
          idx,
          mod.type || "RICH_MARKDOWN",
          mod.content || "# Course Content\n\nWelcome to this training module.",
          mod.estimatedMinutes || 15,
          version,
          now,
          now
        );
      });
    }

    recordAuditEvent({
      actorId: currentUser.id,
      actorRole: currentUser.role,
      actorName: currentUser.name,
      action: "COURSE_CREATED",
      targetType: "COURSE",
      targetId: courseId,
      courseId,
      details: {
        title,
        slug: courseSlug,
        category,
        targetRole,
        isMandatory: Boolean(isMandatory),
        renewalPeriodDays,
        modulesCount: modules.length,
        authoredBy: currentUser.name,
      },
    });

    const createdCourse = db.prepare("SELECT * FROM courses WHERE id = ?").get(courseId);

    return NextResponse.json({
      success: true,
      message: `Course "${title}" created successfully`,
      course: createdCourse,
    }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/admin/courses error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create course" },
      { status: 500 }
    );
  }
}
