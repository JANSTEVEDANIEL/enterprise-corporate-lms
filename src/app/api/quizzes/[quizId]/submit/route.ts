import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { submitQuizAttempt } from "@/lib/quiz";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const currentUser = await getCurrentUser(request);
    const { quizId } = await params;

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const { answers } = body;
    if (!answers || typeof answers !== "object") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid 'answers' object in request body" },
        { status: 400 }
      );
    }

    const clientIp = request.headers.get("x-forwarded-for") || "127.0.0.1";

    const result = submitQuizAttempt({
      userId: currentUser.id,
      quizId,
      answers,
      ipAddress: clientIp,
      actorRole: currentUser.role,
      actorName: currentUser.name,
    });

    return NextResponse.json({
      success: true,
      quizId,
      passed: result.passed,
      scorePct: result.scorePct,
      attemptNumber: result.attemptNumber,
      submissionId: result.submissionId,
      enrollmentProgressPct: result.enrollmentProgressPct,
      evaluation: result.evaluation,
      certificate: result.certificate || null,
    });
  } catch (error: any) {
    console.error("POST /api/quizzes/[quizId]/submit error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to evaluate quiz" },
      { status: 500 }
    );
  }
}
