import { NextRequest, NextResponse } from "next/server";
import { resolveSessionUser } from "@/lib/auth";
import { dbAdapter } from "@/lib/supabase/adapter";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const currentUser = await resolveSessionUser(request);

    const curriculum = await dbAdapter.getCourseWithFullCurriculum(courseId, currentUser.id);
    if (!curriculum) {
      return NextResponse.json(
        { success: false, error: "Course not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      course_id: curriculum.course.id,
      course_title: curriculum.course.title,
      total_lessons: curriculum.totalLessons,
      completed_lessons: curriculum.completedLessons,
      progress_pct: curriculum.progressPct,
      is_completed: curriculum.progressPct === 100,
      certificate: curriculum.certificate || null,
      enrollment: curriculum.enrollment || null,
    });
  } catch (error: any) {
    console.error("GET /api/courses/[courseId]/progress error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch course progress" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const currentUser = await resolveSessionUser(request);

    const course =
      (await dbAdapter.getCourseById(courseId)) ||
      (await dbAdapter.getCourseBySlug(courseId));

    if (!course) {
      return NextResponse.json(
        { success: false, error: "Course not found" },
        { status: 404 }
      );
    }

    const isEnrolled = await dbAdapter.isUserEnrolled(currentUser.id, course.id);
    const isAuthor = course.creator_id === currentUser.id;
    if (!isEnrolled && !isAuthor) {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN_UNENROLLED", message: "Enrollment required to record progress" },
        { status: 403 }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { lesson_id, last_position_seconds = 0, playback_percentage } = body;
    let status = body.status;

    if (!lesson_id) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: lesson_id" },
        { status: 400 }
      );
    }

    // Automatic completion upon reaching 90%+ video playback
    if (playback_percentage !== undefined && Number(playback_percentage) >= 90) {
      status = "COMPLETED";
    } else if (!status) {
      status = "IN_PROGRESS";
    }

    const result = await dbAdapter.updateLessonProgress(
      currentUser.id,
      lesson_id,
      course.id,
      status,
      Number(last_position_seconds) || 0
    );

    return NextResponse.json({
      success: true,
      course_id: course.id,
      ...result,
    });
  } catch (error: any) {
    console.error("POST /api/courses/[courseId]/progress error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update course progress" },
      { status: 500 }
    );
  }
}
