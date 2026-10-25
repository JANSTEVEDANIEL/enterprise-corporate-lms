import { NextRequest, NextResponse } from "next/server";
import { verifyCertificate } from "@/lib/certificates";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ certId: string }> }
) {
  try {
    const { certId } = await params;

    if (!certId) {
      return NextResponse.json(
        { success: false, error: "certId parameter is required" },
        { status: 400 }
      );
    }

    const result = verifyCertificate(certId);

    if (!result.certificate) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: "Certificate not found",
          message: result.message,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      valid: result.valid,
      message: result.message,
      certificate: result.certificate,
    });
  } catch (error: any) {
    console.error("GET /api/certificates/[certId] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to verify certificate" },
      { status: 500 }
    );
  }
}
