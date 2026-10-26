import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { checkContentGate } from "@/lib/privacy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  try {
    initDb();
    const db = getDb();
    const currentUser = await getCurrentUser(request);
    const { courseId, lessonId } = await params;

    // Support lookup by ID or slug
    const courseStmt = db.prepare("SELECT * FROM courses WHERE id = ? OR slug = ?");
    const course = courseStmt.get(courseId, courseId) as any;
    if (!course) {
      return NextResponse.json(
        { success: false, error: "Course not found" },
        { status: 404 }
      );
    }

    // Lookup lesson
    const lessonStmt = db.prepare("SELECT * FROM lessons WHERE id = ?");
    let lesson = lessonStmt.get(lessonId) as any;
    if (!lesson) {
      const modStmt = db.prepare("SELECT * FROM modules WHERE id = ?");
      const mod = modStmt.get(lessonId) as any;
      if (mod) {
        lesson = {
          id: mod.id,
          course_id: mod.course_id,
          week_id: "week_default",
          title: mod.title,
          order_index: mod.order_index,
          duration_seconds: mod.estimated_minutes * 60,
          video_url: mod.type === "VIDEO_EMBED" ? mod.content : null,
          supplementary_files: [],
          is_preview: false,
          created_at: mod.created_at,
          updated_at: mod.updated_at,
        };
      }
    }

    if (!lesson) {
      return NextResponse.json(
        { success: false, error: "Lesson not found" },
        { status: 404 }
      );
    }

    const isAuthor = course.creator_id === currentUser.id;
    const enrollmentStmt = db.prepare(
      "SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?"
    );
    const enrollment = enrollmentStmt.get(currentUser.id, course.id) as any;
    const isEnrolled = !!enrollment;

    // Gate verification (Super Admin gets 403 FORBIDDEN_SUPER_ADMIN_CONTENT_GATE)
    const gate = checkContentGate(currentUser.role, isAuthor, isEnrolled || Boolean(lesson.is_preview));
    if (!gate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: gate.errorCode,
          message: gate.message,
        },
        { status: gate.status }
      );
    }

    if (typeof lesson.supplementary_files === "string") {
      try {
        lesson.supplementary_files = JSON.parse(lesson.supplementary_files);
      } catch {
        lesson.supplementary_files = [];
      }
    }

    return NextResponse.json({
      success: true,
      lesson,
    });
  } catch (error: any) {
    console.error("Error fetching lesson:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
