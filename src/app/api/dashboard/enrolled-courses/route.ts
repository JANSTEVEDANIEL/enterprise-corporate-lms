import { NextRequest, NextResponse } from "next/server";
import { resolveSessionUser } from "@/lib/auth";
import { dbAdapter } from "@/lib/supabase/adapter";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await resolveSessionUser(request);
    const courses = await dbAdapter.getEnrolledCourses(currentUser.id);
    const wallet = await dbAdapter.getWallet(currentUser.id);
    const certificates = await dbAdapter.getCertificatesForUser(currentUser.id);

    return NextResponse.json({
      success: true,
      user: currentUser,
      courses,
      wallet,
      certificates,
      total_enrolled: courses.length,
      completed_count: courses.filter((c: any) => c.progress_pct === 100).length,
    });
  } catch (error: any) {
    console.error("GET /api/dashboard/enrolled-courses error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch enrolled courses" },
      { status: 500 }
    );
  }
}
