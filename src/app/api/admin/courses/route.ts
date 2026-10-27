import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { sanitizeCourseCatalogForRole } from "@/lib/privacy";
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

    const courses = await dbAdapter.getAdminCourses();
    const sanitizedCourses = sanitizeCourseCatalogForRole(courses, currentUser.role);

    return NextResponse.json({
      success: true,
      courses: sanitizedCourses,
      totalCount: sanitizedCourses.length,
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
    const currentUser = await getCurrentUser(request);

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

    let createdCourse: any;
    try {
      createdCourse = await dbAdapter.createAdminCourse({
        title,
        slug,
        description,
        category,
        targetRole,
        isMandatory,
        estimatedMinutes,
        renewalPeriodDays,
        passingScorePct,
        version,
        isPublished,
        creatorId: currentUser.id,
        modules,
      });
    } catch (err: any) {
      if (err.message?.includes("already exists")) {
        return NextResponse.json(
          { success: false, error: "A course with this slug already exists" },
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
        action: "COURSE_CREATED",
        targetType: "COURSE",
        targetId: createdCourse.id,
        courseId: createdCourse.id,
        details: {
          title,
          slug: createdCourse.slug,
          category,
          targetRole,
          isMandatory: Boolean(isMandatory),
          renewalPeriodDays,
          modulesCount: modules.length,
          authoredBy: currentUser.name,
        },
      });
    } catch (auditErr) {
      console.error("Audit log error:", auditErr);
    }

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
