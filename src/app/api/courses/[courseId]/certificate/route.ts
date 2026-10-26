import { NextRequest, NextResponse } from "next/server";
import { resolveSessionUser } from "@/lib/auth";
import { dbAdapter } from "@/lib/supabase/adapter";
import { getDb, initDb } from "@/lib/db";

export async function GET(
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

    initDb();
    const db = getDb();
    const cert = db
      .prepare("SELECT * FROM certificates WHERE user_id = ? AND course_id = ?")
      .get(currentUser.id, course.id) as any;

    if (!cert) {
      return NextResponse.json(
        {
          success: false,
          error: "CERTIFICATE_NOT_FOUND",
          message: "Certificate has not been minted yet for this course",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      certificate: cert,
      verification_url: `/certificates/${cert.certificate_code}`,
    });
  } catch (error: any) {
    console.error("GET /api/courses/[courseId]/certificate error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve certificate" },
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

    const cert = await dbAdapter.mintCertificateForCourse(currentUser.id, course.id);

    return NextResponse.json(
      {
        success: true,
        message: "Certificate of Completion issued successfully",
        certificate: cert,
        verification_url: `/certificates/${cert.certificate_code}`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.message === "USER_NOT_ENROLLED") {
      return NextResponse.json(
        {
          success: false,
          error: "FORBIDDEN_UNENROLLED",
          message: "Student must be enrolled in course to mint certificate",
        },
        { status: 403 }
      );
    }

    if (error.message === "COURSE_INCOMPLETE") {
      return NextResponse.json(
        {
          success: false,
          error: "COURSE_INCOMPLETE",
          message:
            "All lessons across all 1 to 7+ weeks must be completed (100% progress) to unlock and mint Certificate of Completion",
        },
        { status: 400 }
      );
    }

    console.error("POST /api/courses/[courseId]/certificate error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to mint certificate" },
      { status: 500 }
    );
  }
}
