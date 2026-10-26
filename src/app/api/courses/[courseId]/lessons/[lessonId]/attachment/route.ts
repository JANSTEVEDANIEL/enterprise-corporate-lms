import { NextRequest, NextResponse } from "next/server";
import { resolveSessionUser } from "@/lib/auth";
import { dbAdapter } from "@/lib/supabase/adapter";
import { checkContentGate } from "@/lib/privacy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  try {
    const { courseId, lessonId } = await params;
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

    const lesson = await dbAdapter.getLesson(lessonId);
    if (!lesson) {
      return NextResponse.json(
        { success: false, error: "Lesson not found" },
        { status: 404 }
      );
    }

    const isAuthor = course.creator_id === currentUser.id;
    const isEnrolled = await dbAdapter.isUserEnrolled(currentUser.id, course.id);

    // Enforce Creator Content Privacy Shield (Super Admin strictly blocked from downloading raw resources)
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

    let files = lesson.supplementary_files || [];
    if (typeof files === "string") {
      try {
        files = JSON.parse(files);
      } catch {
        files = [];
      }
    }

    const fileId = request.nextUrl.searchParams.get("fileId");
    const fileName = request.nextUrl.searchParams.get("fileName");

    if (fileId || fileName) {
      const match = files.find(
        (f: any) =>
          (fileId && f.id === fileId) ||
          (fileName && (f.name === fileName || f.filename === fileName))
      );

      if (!match) {
        return NextResponse.json(
          { success: false, error: "Attachment file not found in lesson" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        file: match,
        download_url: match.file_url || match.url,
      });
    }

    return NextResponse.json({
      success: true,
      lesson_id: lesson.id,
      files,
    });
  } catch (error: any) {
    console.error("GET attachment error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to access attachment" },
      { status: 500 }
    );
  }
}
