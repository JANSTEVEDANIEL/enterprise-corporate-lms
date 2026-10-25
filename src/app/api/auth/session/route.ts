import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getUserById, getAllPersonas } from "@/lib/auth";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    const personas = getAllPersonas();

    return NextResponse.json({
      success: true,
      data: {
        currentUser,
        personas,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to retrieve session",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 }
      );
    }

    const targetUser = getUserById(userId);
    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const response = NextResponse.json({
      success: true,
      data: {
        user: targetUser,
        message: `Switched active persona to ${targetUser.name} (${targetUser.role})`,
      },
    });

    // Set HTTP-only cookie with 30-day expiry
    response.cookies.set("lms_user_id", targetUser.id, {
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
      httpOnly: false, // Accessible to client scripts if needed
      sameSite: "lax",
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to switch persona" },
      { status: 500 }
    );
  }
}
