# Dispatch to worker_m4: Milestone M4 (Office Employee Persona Simulation Suite)

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Context & Inputs
- Original Request: `/Users/janstevedaniel/Downloads/LMS FOR GAURAV/.agents/teamwork/ORIGINAL_REQUEST.md`
- Project Scope: `/Users/janstevedaniel/Downloads/LMS FOR GAURAV/PROJECT.md`
- Specification & Persona Matrix: `/Users/janstevedaniel/Downloads/LMS FOR GAURAV/.agents/teamwork/spec_miner_survey_1/survey_report.md`
- Test Ready Report: `/Users/janstevedaniel/Downloads/LMS FOR GAURAV/TEST_READY.md`
- M1, M2, and M3 Handoff Reports

## Scope of Work (Milestone M4)
Implement the automated office employee persona simulation suite and complete persona verification:
1. **Persona Simulation Engine (`src/simulation/`)**:
   - `src/simulation/personas.ts`: Persona definitions for at least 3 distinct roles:
     - Persona 1: Alex Rivera (New Hire Employee, Business Analyst)
     - Persona 2: Elena Rostova (Senior Engineer, Security Champion)
     - Persona 3: Marcus Vance (Compliance Officer)
   - `src/simulation/persona-alex-newhire.ts`: Simulates Day-1 orientation lifecycle:
     - Login / session assumption
     - View personalized dashboard & onboarding roadmap
     - Complete "Corporate Information Security & Workplace Safety" module
     - Answer quiz questions and pass with score >= 80%
     - Verify completion certificate generated with serial ID & SHA-256 verification hash
     - Verify immutable audit log recorded
   - `src/simulation/persona-elena-engineer.ts`: Simulates Senior Engineer technical safety:
     - Traverses technical security & secure code training
     - Video module progression & markdown documentation review
     - Passes edge-case quiz with 100% score
     - Verifies score, attempt history, and cryptographic audit log entry
   - `src/simulation/persona-marcus-compliance.ts`: Simulates Compliance Officer audit review:
     - Review company-wide compliance posture & regulation metrics
     - Detect overdue certifications / expiring credentials
     - Execute one-click reminder alerts / nudges
     - Generate and verify CSV and JSON audit export files
     - Run cryptographic SHA-256 Merkle hash chain verification
   - `src/simulation/runner.ts`: Unified runner executing all 3 persona simulations with step-by-step progress logging, state transition assertions, and execution summary.
2. **CLI & Web Simulation Endpoints**:
   - `scripts/simulate.ts` / `npm run simulate`: Standalone CLI runner with formatted terminal output.
   - `/api/simulate`: API endpoint allowing execution of individual or all persona simulations from the UI (`/simulation`).
   - `src/app/simulation/page.tsx`: Interactive Persona Simulation Console in the UI allowing human observers to trigger single or full persona runs and watch live state transitions and audit hashes.
3. **Automated Persona Test Suite (`tests/integration/persona-simulations.test.ts` or `tests/e2e/`)**:
   - Comprehensive programmatic tests verifying all state transitions, database invariants, and certificate generation under `npm test`.
4. **Verification**:
   - Run `npm test` and ensure all tests pass (215+ tests).
   - Run `npm run simulate` and ensure all 3 personas execute and pass.
   - Run `npm run build` and ensure production build succeeds with 0 errors.

## Output
Write report to `/Users/janstevedaniel/Downloads/LMS FOR GAURAV/.agents/teamwork/worker_m4/handoff.md`.
Communicate back to orchestrator (`63cc1ecb-221c-430c-8bd9-507d14db22d3`) via send_message when complete.


## 2026-10-25T14:01:43Z
[Message] timestamp=2026-10-25T14:01:43Z sender=63cc1ecb-221c-430c-8bd9-507d14db22d3 priority=MESSAGE_PRIORITY_HIGH content=You are worker_m4. Your working directory is /Users/janstevedaniel/Downloads/LMS FOR GAURAV/.agents/teamwork/worker_m4.
Read /Users/janstevedaniel/Downloads/LMS FOR GAURAV/.agents/teamwork/worker_m4/DISPATCH.md, /Users/janstevedaniel/Downloads/LMS FOR GAURAV/.agents/teamwork/ORIGINAL_REQUEST.md, and /Users/janstevedaniel/Downloads/LMS FOR GAURAV/PROJECT.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implement Milestone M4 (Office Employee Persona Simulation Suite):
1. Complete persona simulation engines in src/simulation/ for 3 distinct roles:
   - Alex Rivera (New Hire): Day-1 orientation, module traversal, quiz passing, certificate issuance, audit trail
   - Elena Rostova (Senior Engineer): Technical safety training, video/markdown review, edge-case quiz, score logging
   - Marcus Vance (Compliance Officer): Departmental audit, overdue detection, reminder nudge, CSV/JSON export verification, SHA-256 Merkle chain check
2. CLI simulation runner (npm run simulate) and Web Simulation Console (/simulation) with live state transition logs
3. Full automated integration tests validating state transitions under npm test
4. Verify npm test, npm run simulate, and npm run build all succeed cleanly with 0 errors
Write handoff.md in your working directory and notify orchestrator (63cc1ecb-221c-430c-8bd9-507d14db22d3) via send_message when complete.
