import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { evaluateOrgCompliance } from "@/lib/compliance";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!hasPermission(currentUser.role, "MANAGER")) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Privileged compliance or management role required" },
        { status: 403 }
      );
    }

    const summary = evaluateOrgCompliance();

    return NextResponse.json({
      success: true,
      stats: summary,
    });
  } catch (error: any) {
    console.error("GET /api/compliance/stats error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load compliance stats" },
      { status: 500 }
    );
  }
}
