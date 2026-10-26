import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { checkContentGate } from "@/lib/privacy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    initDb();
    const db = getDb();
    const currentUser = await getCurrentUser(request);
    const { lessonId } = await params;

    // Retrieve lesson
    const lessonStmt = db.prepare("SELECT * FROM lessons WHERE id = ?");
    let lesson = lessonStmt.get(lessonId) as any;
    let courseId = lesson ? lesson.course_id : null;

    if (!lesson) {
      const modStmt = db.prepare("SELECT * FROM modules WHERE id = ?");
      const mod = modStmt.get(lessonId) as any;
      if (mod) {
        lesson = {
          id: mod.id,
          course_id: mod.course_id,
          video_url: mod.type === "VIDEO_EMBED" ? mod.content : null,
          is_preview: false,
        };
        courseId = mod.course_id;
      }
    }

    if (!lesson) {
      return NextResponse.json(
        { success: false, error: "Lesson not found" },
        { status: 404 }
      );
    }

    // Lookup course creator
    const courseStmt = db.prepare("SELECT * FROM courses WHERE id = ?");
    const course = courseStmt.get(courseId) as any;
    const isAuthor = course ? course.creator_id === currentUser.id : false;

    // Check enrollment
    const enrollmentStmt = db.prepare(
      "SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?"
    );
    const enrollment = course ? (enrollmentStmt.get(currentUser.id, course.id) as any) : null;
    const isEnrolled = !!enrollment;

    // Enforce Content Gate: Super Admin strictly rejected with 403 FORBIDDEN_SUPER_ADMIN_CONTENT_GATE
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

    return NextResponse.json({
      success: true,
      lessonId: lesson.id,
      streamUrl: lesson.video_url || `/stream/${lesson.id}/manifest.m3u8`,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    });
  } catch (error: any) {
    console.error("Error streaming lesson:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
