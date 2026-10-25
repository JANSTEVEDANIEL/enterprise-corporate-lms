import { NextRequest, NextResponse } from "next/server";
import {
  runAllSimulations,
  runSingleSimulation,
  SIMULATION_PERSONAS,
  type PersonaKey,
} from "@/simulation";
import { verifyAuditLogIntegrity } from "@/lib/audit";
import { initDb } from "@/lib/db";

export async function GET() {
  try {
    initDb();
    const auditStatus = verifyAuditLogIntegrity();

    return NextResponse.json({
      status: "ready",
      engine: "Office Employee Persona Simulation Suite",
      supportedPersonas: Object.values(SIMULATION_PERSONAS).map((p) => ({
        key: p.key,
        id: p.id,
        name: p.name,
        role: p.role,
        department: p.department,
        jobTitle: p.jobTitle,
        targetCourseId: p.targetCourseId,
        targetCourseTitle: p.targetCourseTitle,
        summary: p.summary,
        expectedSteps: p.expectedSteps,
      })),
      auditIntegrity: {
        isValid: auditStatus.isValid,
        totalRecords: auditStatus.totalRecords,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to retrieve simulation status" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    initDb();
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty or non-JSON body defaults to all
      body = { persona: "all" };
    }

    const requestedPersona = (body.persona || "all").toLowerCase();

    if (
      requestedPersona !== "all" &&
      requestedPersona !== "alex" &&
      requestedPersona !== "elena" &&
      requestedPersona !== "marcus"
    ) {
      return NextResponse.json(
        {
          error: `Invalid persona key '${requestedPersona}'. Must be one of: 'all', 'alex', 'elena', 'marcus'.`,
        },
        { status: 400 }
      );
    }

    if (requestedPersona === "all") {
      const summary = await runAllSimulations({ logProgress: false });
      return NextResponse.json({
        success: summary.success,
        type: "all",
        summary,
      });
    }

    const singleResult = await runSingleSimulation(requestedPersona as PersonaKey, {
      logProgress: false,
    });

    return NextResponse.json({
      success: singleResult.status === "PASSED",
      type: "single",
      result: singleResult,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Simulation execution failed",
      },
      { status: 500 }
    );
  }
}
