# BRIEFING — 2026-10-25T14:02:00Z

## Mission
Implement Milestone M4: Complete Office Employee Persona Simulation Suite (Alex Rivera, Elena Rostova, Marcus Vance), CLI simulation runner (`npm run simulate`), Web Simulation Console (`/simulation`), and programmatic integration test suite under `npm test`.

## 🔒 My Identity
- Archetype: implementer
- Roles: implementer, qa, specialist
- Working directory: /Users/janstevedaniel/Downloads/LMS FOR GAURAV/.agents/teamwork/worker_m4
- Original parent: 63cc1ecb-221c-430c-8bd9-507d14db22d3
- Milestone: M4

## 🔒 Key Constraints
- DO NOT CHEAT: Genuine logic only. No hardcoded test results, facade implementations, or circumventing tasks.
- Persona simulations must maintain real state and execute real transitions against database and APIs.
- Must support 3 distinct roles:
  1. Alex Rivera (New Hire): Day-1 orientation, module traversal, quiz passing, certificate issuance, audit trail
  2. Elena Rostova (Senior Engineer): Technical safety training, video/markdown review, edge-case quiz, score logging
  3. Marcus Vance (Compliance Officer): Departmental audit, overdue detection, reminder nudge, CSV/JSON export verification, SHA-256 Merkle chain check
- Provide CLI runner (`scripts/simulate.ts` / `npm run simulate`) with formatted terminal output.
- Provide Web Simulation Console (`/simulation` and `/api/simulate`) with live state transition logs.
- Automated integration tests under `npm test` verifying all state transitions.
- Verify `npm test`, `npm run simulate`, and `npm run build` all succeed cleanly with 0 errors.

## Current Parent
- Conversation ID: 63cc1ecb-221c-430c-8bd9-507d14db22d3
- Updated: 2026-10-25T14:02:00Z

## Task Summary
- **What to build**: Persona Simulation Engine (`src/simulation/`): `personas.ts`, `persona-alex-newhire.ts`, `persona-elena-engineer.ts`, `persona-marcus-compliance.ts`, `runner.ts`; CLI script `scripts/simulate.ts`; API route `/api/simulate`; Web console `/simulation`; integration tests `tests/integration/persona-simulations.test.ts`.
- **Success criteria**: Genuine state transitions, database verified, certificates and audit chain verified, CLI formatted output, Web UI live viewer, `npm test` passing, `npm run simulate` passing, `npm run build` passing.
- **Interface contracts**: PROJECT.md § Interface Contracts
- **Code layout**: PROJECT.md § Code Layout

## Change Tracker
- **Files modified**: None yet
- **Build status**: Pending baseline check
- **Pending issues**: None

## Quality Status
- **Build/test result**: Pending
- **Lint status**: Clean
- **Tests added/modified**: Pending

## Loaded Skills
- None explicitly loaded

## Key Decisions Made
- [2026-10-25] Initialized M4 work.
