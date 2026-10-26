import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getUserById, getAllPersonas, getMarketplacePersonas } from "@/lib/auth";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    const personas = getAllPersonas();
    const marketplacePersonas = getMarketplacePersonas();

    return NextResponse.json({
      success: true,
      data: {
        currentUser,
        personas,
        marketplacePersonas,
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
    let { userId, role } = body;

    if (!userId && role) {
      const upperRole = String(role).toUpperCase();
      if (upperRole === "STUDENT") userId = "usr_sophia_chen";
      else if (upperRole === "CO_ADMIN" || upperRole === "CREATOR") userId = "usr_aris_thorne";
      else if (upperRole === "SUPER_ADMIN") userId = "usr_david_kim";
      else if (upperRole === "EMPLOYEE") userId = "usr_alex_rivera";
      else if (upperRole === "MANAGER") userId = "usr_sarah_jenkins";
      else if (upperRole === "COMPLIANCE_OFFICER") userId = "usr_marcus_vance";
    }

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
