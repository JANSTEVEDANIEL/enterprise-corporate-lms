import { getDb, initDb } from "@/lib/db";
import { verifyAuditLogIntegrity } from "@/lib/audit";
import { runAlexNewHireSimulation } from "./persona-alex-newhire";
import { runElenaEngineerSimulation } from "./persona-elena-engineer";
import { runMarcusComplianceSimulation } from "./persona-marcus-compliance";
import {
  type PersonaKey,
  type PersonaSimulationResult,
  type OverallSimulationSummary,
  type SimulationOptions,
  SIMULATION_PERSONAS,
} from "./personas";

export {
  runAlexNewHireSimulation,
  runElenaEngineerSimulation,
  runMarcusComplianceSimulation,
  SIMULATION_PERSONAS,
};
export type {
  PersonaKey,
  PersonaDefinition,
  PersonaSimulationResult,
  OverallSimulationSummary,
  SimulationStepResult,
  SimulationOptions,
  StateTransition,
} from "./personas";

export async function runSingleSimulation(
  personaKey: PersonaKey,
  options?: SimulationOptions
): Promise<PersonaSimulationResult> {
  switch (personaKey) {
    case "alex":
      return await runAlexNewHireSimulation(options);
    case "elena":
      return await runElenaEngineerSimulation(options);
    case "marcus":
      return await runMarcusComplianceSimulation(options);
    default:
      throw new Error(`Unknown persona key: '${personaKey}'. Valid keys are 'alex', 'elena', 'marcus'.`);
  }
}

export async function runAllSimulations(
  options?: SimulationOptions
): Promise<OverallSimulationSummary> {
  const overallStart = Date.now();
  if (!options?.db) {
    initDb();
  }
  const db = options?.db || getDb();
  const log = options?.logger || (options?.logProgress ? console.log : () => {});

  log("===============================================================================");
  log("        ENTERPRISE LMS — MULTI-PERSONA OFFICE SIMULATION SUITE");
  log("===============================================================================");

  // 1. Alex Rivera (New Hire)
  log("\n>>> Executing Persona 1/3: Alex Rivera (New Hire Onboarding Lifecycle)...");
  const alexResult = await runAlexNewHireSimulation({ ...options, db });

  // 2. Elena Rostova (Senior Engineer)
  log("\n>>> Executing Persona 2/3: Elena Rostova (Senior Engineer Technical Safety)...");
  const elenaResult = await runElenaEngineerSimulation({ ...options, db });

  // 3. Marcus Vance (Compliance Officer)
  log("\n>>> Executing Persona 3/3: Marcus Vance (Compliance Officer Regulatory Audit)...");
  const marcusResult = await runMarcusComplianceSimulation({ ...options, db });

  const results: Record<PersonaKey, PersonaSimulationResult> = {
    alex: alexResult,
    elena: elenaResult,
    marcus: marcusResult,
  };

  const personasList = [alexResult, elenaResult, marcusResult];
  const passedPersonas = personasList.filter((p) => p.status === "PASSED").length;
  const failedPersonas = personasList.filter((p) => p.status === "FAILED").length;

  let totalSteps = 0;
  let passedSteps = 0;
  let failedSteps = 0;

  for (const p of personasList) {
    totalSteps += p.steps.length;
    passedSteps += p.steps.filter((s) => s.status === "PASSED").length;
    failedSteps += p.steps.filter((s) => s.status === "FAILED").length;
  }

  // Cryptographic audit chain verification across all operations
  const auditVerification = verifyAuditLogIntegrity(db);

  const totalDurationMs = Date.now() - overallStart;
  const allPassed = passedPersonas === 3 && failedPersonas === 0 && auditVerification.isValid;

  log("\n===============================================================================");
  log(`  SIMULATION SUMMARY: ${allPassed ? "✅ ALL PERSONAS PASSED" : "❌ FAILURES DETECTED"}`);
  log(`  Personas: ${passedPersonas}/${personasList.length} Passed | Steps: ${passedSteps}/${totalSteps} Passed | Time: ${totalDurationMs}ms`);
  log(`  Cryptographic SHA-256 Audit Chain: ${auditVerification.isValid ? "✅ VALID" : "❌ COMPROMISED"} (${auditVerification.totalRecords} total records)`);
  log("===============================================================================\n");

  return {
    success: allPassed,
    totalPersonas: personasList.length,
    passedPersonas,
    failedPersonas,
    totalSteps,
    passedSteps,
    failedSteps,
    totalDurationMs,
    executedAt: new Date().toISOString(),
    results,
    auditVerification: {
      isValid: auditVerification.isValid,
      totalRecords: auditVerification.totalRecords,
      rootHash: auditVerification.actualHash,
    },
  };
}
