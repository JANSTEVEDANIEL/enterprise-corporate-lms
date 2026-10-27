import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { dbAdapter } from "@/lib/supabase/adapter";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN_SUPER_ADMIN_REQUIRED" },
        { status: 403 }
      );
    }

    const stats = await dbAdapter.getAdminStats();

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load admin stats" },
      { status: 500 }
    );
  }
}
