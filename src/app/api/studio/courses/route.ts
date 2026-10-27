import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { dbAdapter } from "@/lib/supabase/adapter";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    let creatorId = user.id;
    const url = new URL(request.url);
    const queryCreatorId = url.searchParams.get("creator_id");

    if (queryCreatorId) {
      creatorId = queryCreatorId;
    } else if (user.role !== "CO_ADMIN" && user.role !== "SUPER_ADMIN") {
      creatorId = "usr_aris_thorne";
    }

    const { courses, analytics } = await dbAdapter.getStudioCourses(creatorId);

    return NextResponse.json({
      success: true,
      creator_id: creatorId,
      courses,
      analytics,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch studio courses" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    let creatorId = user.id;
    if (user.role !== "CO_ADMIN" && user.role !== "SUPER_ADMIN") {
      creatorId = "usr_aris_thorne";
    }

    const body = await request.json().catch(() => ({}));
    const {
      title,
      description = "",
      category = "SOFTWARE",
      price = 0,
      price_cents,
      thumbnail_url = null,
      total_weeks = 1,
    } = body;

    if (!title || typeof title !== "string" || title.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: "Course title must be at least 3 characters long" },
        { status: 400 }
      );
    }

    const course = await dbAdapter.createCourse({
      title,
      description,
      category,
      price,
      price_cents,
      thumbnail_url,
      total_weeks,
      creator_id: creatorId,
    });

    return NextResponse.json(
      {
        success: true,
        course,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create course" },
      { status: 500 }
    );
  }
}
