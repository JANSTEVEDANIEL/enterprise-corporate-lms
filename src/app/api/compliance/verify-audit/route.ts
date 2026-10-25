import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { verifyAuditLogIntegrity } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    // Verify privilege (Manager, Compliance Officer, or Admin)
    if (!hasPermission(currentUser.role, "MANAGER")) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Privileged role required to verify audit chain" },
        { status: 403 }
      );
    }

    const verification = verifyAuditLogIntegrity();
    const checkedAt = new Date().toISOString();

    return NextResponse.json({
      success: true,
      isValid: verification.isValid,
      chainStatus: verification.isValid ? "INTACT" : "COMPROMISED",
      totalRecords: verification.totalRecords,
      firstTimestamp: verification.firstTimestamp,
      lastTimestamp: verification.lastTimestamp,
      tamperedIndex: verification.tamperedIndex,
      expectedHash: verification.expectedHash,
      actualHash: verification.actualHash,
      failureReason: verification.failureReason,
      checkedAt,
      verifiedBy: currentUser.name,
      verification,
    });
  } catch (error: any) {
    console.error("POST /api/compliance/verify-audit error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to verify audit log integrity" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Support GET as well for convenience
  return POST(request);
}
