# Dispatch to worker_m1: Milestone M1 (Foundation & Core Architecture)

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Context & Inputs
- Original Request: `/Users/janstevedaniel/Downloads/LMS FOR GAURAV/.agents/teamwork/ORIGINAL_REQUEST.md`
- Project Scope: `/Users/janstevedaniel/Downloads/LMS FOR GAURAV/PROJECT.md`
- Architecture Survey: `/Users/janstevedaniel/Downloads/LMS FOR GAURAV/.agents/teamwork/explorer_survey_1/survey_report.md`
- Data Model Survey: `/Users/janstevedaniel/Downloads/LMS FOR GAURAV/.agents/teamwork/explorer_survey_2/survey_report.md`

## Scope of Work (Milestone M1)
Implement the complete full-stack foundation for the Enterprise Corporate LMS:
1. **Tooling & Configurations**:
   - `package.json` with scripts: `dev`, `build`, `start`, `test`, `db:seed`, `simulate`.
   - Dependencies: `next@^15.0.0` or latest compatible, `react@^19.0.0`, `react-dom@^19.0.0`, `typescript`, `tailwindcss`, `postcss`, `autoprefixer`, `lucide-react`, `clsx`, `tailwind-merge`.
   - `tsconfig.json` with strict mode, `@/*` path alias.
   - `tailwind.config.js`, `postcss.config.js`, `next.config.ts`.
2. **Database Engine & Schema (`src/lib/db/`)**:
   - Zero-compilation native `node:sqlite` (`DatabaseSync`) storage at `.data/lms.db`.
   - `schema.ts`: DDL for `users`, `courses`, `modules`, `quizzes`, `quiz_questions`, `enrollments`, `module_progress`, `quiz_submissions`, `certificates`, `audit_logs` with WAL mode, foreign keys, and indexes.
   - Database triggers preventing `UPDATE` and `DELETE` on `audit_logs`.
   - `seed.ts` and `npm run db:seed`: Idempotent seeder populating realistic enterprise departments (Engineering, Security, People Ops, Operations) and multi-role personas (Alex Rivera - New Hire, Elena Rostova - Senior Engineer, Sarah Jenkins - Manager, Marcus Vance - Compliance Officer, David Kim - Super Admin) and introductory courses.
3. **Auth & RBAC Layer (`src/lib/auth/index.ts`)**:
   - Granular RBAC roles (`EMPLOYEE`, `MANAGER`, `COMPLIANCE_OFFICER`, `SUPER_ADMIN`).
   - Session context helper `getCurrentUser()`, `requireRole()`.
   - Instant Persona / Role Switcher component in `src/components/layout/persona-switcher.tsx`.
4. **Layout & UI Shell (`src/app/`, `src/components/layout/`)**:
   - Sleek enterprise navigation: `header.tsx`, `sidebar.tsx`, `layout.tsx`, `globals.css` with clean corporate theme.
   - Working landing/dashboard routing with active persona indicator.
5. **Verification**:
   - Execute `npm install` and verify zero errors.
   - Execute `npm run db:seed` and verify database tables and seed records are created.
   - Execute `npm run build` to verify compilation.

## Output
Write report to `/Users/janstevedaniel/Downloads/LMS FOR GAURAV/.agents/teamwork/worker_m1/handoff.md`.
Communicate back to orchestrator (`63cc1ecb-221c-430c-8bd9-507d14db22d3`) via send_message when complete.


## 2026-10-25T11:55:36Z
[Message] sender=63cc1ecb-221c-430c-8bd9-507d14db22d3
Implement Milestone M1 (Foundation & Core Architecture): Next.js 15, React 19, TypeScript, Tailwind CSS, Lucide icons, SQLite schema and migrations using built-in node:sqlite (DatabaseSync) at .data/lms.db, audit log immutability triggers, seed script with corporate personas and courses, RBAC auth session helper, and layout shell with persona switcher.
Run npm install, npm run db:seed, and verify build. Write handoff.md in your working directory.
Communicate back to orchestrator (63cc1ecb-221c-430c-8bd9-507d14db22d3) via send_message when complete.
