import { runAllSimulations, runSingleSimulation, SIMULATION_PERSONAS, type PersonaKey } from "../src/simulation";
import { initDb, seedDb } from "../src/lib/db";

// ANSI color escape codes
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const CYAN = "\x1b[36m";
const MAGENTA = "\x1b[35m";

function printHeader() {
  console.log(`\n${CYAN}╔══════════════════════════════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${CYAN}║${BOLD}          ENTERPRISE CORPORATE LMS — OFFICE PERSONA SIMULATION SUITE             ${RESET}${CYAN}║${RESET}`);
  console.log(`${CYAN}║${DIM}      Simulating Realistic Multi-Role Lifecycles & Cryptographic Verification      ${RESET}${CYAN}║${RESET}`);
  console.log(`${CYAN}╚══════════════════════════════════════════════════════════════════════════════════╝${RESET}\n`);
}

function parseArgs(): { persona?: PersonaKey | "all" } {
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg.startsWith("--persona=")) {
      const val = arg.split("=")[1].toLowerCase();
      if (val === "alex" || val === "elena" || val === "marcus" || val === "all") {
        return { persona: val as PersonaKey | "all" };
      }
    }
    if (arg === "alex" || arg === "elena" || arg === "marcus" || arg === "all") {
      return { persona: arg as PersonaKey | "all" };
    }
  }
  return { persona: "all" };
}

async function main() {
  printHeader();

  // Ensure DB and seed data exist
  initDb();
  seedDb();

  const { persona } = parseArgs();

  console.log(`${BOLD}Target Configuration:${RESET}`);
  console.log(`  Target Scope: ${CYAN}${persona?.toUpperCase() || "ALL PERSONAS"}${RESET}`);
  console.log(`  Engine:       ${GREEN}Node 26 SQLite + Native SHA-256 Merkle Chain${RESET}`);
  console.log(`  Personas:     ${YELLOW}3 (Alex Rivera - New Hire, Elena Rostova - Sr. Engineer, Marcus Vance - Compliance)${RESET}\n`);

  if (persona && persona !== "all") {
    console.log(`${BOLD}Running Single Simulation: ${persona.toUpperCase()}...${RESET}\n`);
    const result = await runSingleSimulation(persona, {
      logProgress: false,
    });

    console.log(`\n${BOLD}Persona:${RESET} ${result.personaName} (${result.role})`);
    console.log(`${BOLD}Course:${RESET}  ${result.targetCourseTitle}`);
    console.log(`${BOLD}Status:${RESET}  ${result.status === "PASSED" ? `${GREEN}✔ PASSED${RESET}` : `${RED}✖ FAILED${RESET}`}`);
    console.log(`${BOLD}Time:${RESET}    ${result.totalDurationMs}ms\n`);

    console.log(`${BOLD}Execution Steps:${RESET}`);
    for (const step of result.steps) {
      const icon = step.status === "PASSED" ? `${GREEN}✔${RESET}` : `${RED}✖${RESET}`;
      console.log(`  ${icon} Step ${step.stepNumber}: ${BOLD}${step.name}${RESET} ${DIM}(${step.durationMs}ms)${RESET}`);
      console.log(`     ${DIM}${step.description}${RESET}`);
      if (step.stateTransition) {
        console.log(`     ${CYAN}↳ [State] ${step.stateTransition.entity}: ${step.stateTransition.from} → ${step.stateTransition.to}${RESET}`);
      }
    }

    if (result.artifacts && Object.keys(result.artifacts).length > 0) {
      console.log(`\n${BOLD}Generated Artifacts:${RESET}`);
      for (const [k, v] of Object.entries(result.artifacts)) {
        if (v !== undefined) {
          console.log(`  • ${MAGENTA}${k}:${RESET} ${v}`);
        }
      }
    }

    if (result.status !== "PASSED") {
      console.error(`\n${RED}Simulation failed: ${result.error}${RESET}\n`);
      process.exit(1);
    }

    console.log(`\n${GREEN}✔ Simulation completed successfully!${RESET}\n`);
    process.exit(0);
  }

  // Run all personas
  const summary = await runAllSimulations({
    logProgress: false,
  });

  console.log(`\n${BOLD}=========================== DETAILED EXECUTION LOG ===========================${RESET}\n`);

  for (const [key, res] of Object.entries(summary.results)) {
    const meta = SIMULATION_PERSONAS[key as PersonaKey];
    console.log(`${BOLD}${CYAN}▶ Persona: ${res.personaName}${RESET} [${YELLOW}${res.role}${RESET}] — ${meta.jobTitle}`);
    console.log(`  Target: ${res.targetCourseTitle}`);
    console.log(`  Status: ${res.status === "PASSED" ? `${GREEN}✔ PASSED${RESET}` : `${RED}✖ FAILED${RESET}`} (${res.totalDurationMs}ms)\n`);

    for (const step of res.steps) {
      const icon = step.status === "PASSED" ? `${GREEN}✔${RESET}` : `${RED}✖${RESET}`;
      console.log(`  ${icon} Step ${step.stepNumber}: ${BOLD}${step.name}${RESET} ${DIM}(${step.durationMs}ms)${RESET}`);
      console.log(`     ${DIM}${step.description}${RESET}`);
      if (step.stateTransition) {
        console.log(`     ${CYAN}↳ [Transition] ${step.stateTransition.entity}: ${step.stateTransition.from} → ${step.stateTransition.to}${RESET}`);
      }
    }

    if (res.artifacts) {
      console.log(`\n  ${BOLD}Artifacts:${RESET}`);
      if (res.artifacts.certificateCode) {
        console.log(`    • Certificate: ${MAGENTA}${res.artifacts.certificateCode}${RESET}`);
      }
      if (res.artifacts.certificateHash) {
        console.log(`    • Verification Hash: ${DIM}${res.artifacts.certificateHash}${RESET}`);
      }
      if (res.artifacts.csvExportBytes) {
        console.log(`    • CSV Export: ${res.artifacts.csvExportBytes} bytes`);
      }
      if (res.artifacts.jsonExportBytes) {
        console.log(`    • JSON Export: ${res.artifacts.jsonExportBytes} bytes`);
      }
    }
    console.log("\n" + "─".repeat(78) + "\n");
  }

  // Summary Matrix
  console.log(`${BOLD}============================== EXECUTION MATRIX ==============================${RESET}`);
  console.log(`┌──────────────────────┬──────────────────────┬──────────┬──────────────┬───────────┐`);
  console.log(`│ ${BOLD}Persona Name${RESET}         │ ${BOLD}Role${RESET}                 │ ${BOLD}Steps${RESET}    │ ${BOLD}Duration${RESET}     │ ${BOLD}Status${RESET}    │`);
  console.log(`├──────────────────────┼──────────────────────┼──────────┼──────────────┼───────────┤`);

  for (const res of Object.values(summary.results)) {
    const nameCol = res.personaName.padEnd(20);
    const roleCol = res.role.padEnd(20);
    const stepsCol = `${res.steps.filter((s) => s.status === "PASSED").length}/${res.steps.length}`.padEnd(8);
    const durCol = `${res.totalDurationMs}ms`.padEnd(12);
    const statusCol = res.status === "PASSED" ? `${GREEN}✔ PASS${RESET}    ` : `${RED}✖ FAIL${RESET}    `;
    console.log(`│ ${nameCol} │ ${roleCol} │ ${stepsCol} │ ${durCol} │ ${statusCol} │`);
  }

  console.log(`└──────────────────────┴──────────────────────┴──────────┴──────────────┴───────────┘`);

  console.log(`\n${BOLD}Cryptographic Verification Invariants:${RESET}`);
  console.log(
    `  • SHA-256 Merkle Chain Integrity: ${
      summary.auditVerification.isValid ? `${GREEN}✔ 100% VALID${RESET}` : `${RED}✖ COMPROMISED${RESET}`
    } (${summary.auditVerification.totalRecords} total records verified)`
  );
  if (summary.auditVerification.rootHash) {
    console.log(`  • Terminal Root Hash:            ${CYAN}${summary.auditVerification.rootHash}${RESET}`);
  }

  console.log(`\n${BOLD}Total Run Time:${RESET} ${summary.totalDurationMs}ms across ${summary.totalSteps} validated state steps.`);

  if (!summary.success) {
    console.error(`\n${RED}${BOLD}Simulation failed with errors.${RESET}\n`);
    process.exit(1);
  }

  console.log(`\n${GREEN}${BOLD}✔ ALL OFFICE EMPLOYEE PERSONA SIMULATIONS PASSED CLEANLY WITH ZERO ERRORS.${RESET}\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`\n${RED}Fatal error running simulation:${RESET}`, err);
  process.exit(1);
});
