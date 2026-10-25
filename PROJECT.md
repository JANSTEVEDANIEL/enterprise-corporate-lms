# Project: Enterprise Corporate Learning Management System (LMS)

## Architecture
- **Framework & Runtime**: Next.js 15+ (App Router), React 19, TypeScript (strict mode), Node.js v26.10.0 runtime.
- **Styling & UI**: Tailwind CSS, Lucide React icons, mobile-responsive enterprise dashboard with light/dark corporate theme, zero-clutter learner experience.
- **Database & Persistence**: SQLite relational database via Node 26 built-in `node:sqlite` (`DatabaseSync`), WAL journal mode, strict foreign keys, transactional migrations, zero external native compilation dependencies.
- **Security & RBAC**: Granular Role-Based Access Control (`EMPLOYEE`, `MANAGER`, `COMPLIANCE_OFFICER`, `SUPER_ADMIN`), session context, client-side role guards, server-side API authorization, dev/demo Persona Switcher.
- **Compliance & Tamper-Evident Audit Trail**: Dual-layer audit protection: SQLite engine triggers blocking `UPDATE`/`DELETE` on `audit_logs`, and SHA-256 Merkle hash-chaining linking every log entry to its predecessor.
- **Simulation & Testing Engine**: Automated synthetic office persona runner (Alex Rivera - New Hire, Elena Rostova - Senior Engineer, Marcus Vance - Compliance Officer) validating real-world state transitions, alongside comprehensive `npm test` and production `npm run build`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Role-Based Access Control Engine | Granular permissions (`EMPLOYEE`, `MANAGER`, `COMPLIANCE_OFFICER`, `SUPER_ADMIN`) across routes and APIs | M1 | survey |
| 2 | Instant Persona/Role Switcher | Quick-switch bar to assume identities (Alex, Elena, Sarah, Marcus, Admin) in dev/demo mode | M1 | survey |
| 3 | Single-Click Employee Onboarding | Friction-free onboarding roadmap, welcome banner, and auto-enrollment in mandatory tracks | M2 | survey |
| 4 | Clutter-Free Employee Dashboard | Personalized learner overview: active courses, due dates, progress percentage, quick resume | M2 | survey |
| 5 | Course Catalog & Track Explorer | Directory of corporate courses with search, filters (Compliance, Security, Skills), estimated duration | M2 | survey |
| 6 | Bite-Sized Modular Lesson Player | Focused course viewer with collapsible chapter drawer, breadcrumbs, previous/next lesson navigation | M2 | survey |
| 7 | Rich Markdown Content Engine | Formatted rendering of technical documentation, policy manuals, checklists, tables, code blocks | M2 | survey |
| 8 | Responsive Video Embed Module | Embedded instructional video player with playback tracking, time markers, and completion trigger | M2 | survey |
| 9 | Interactive Knowledge Check & Quiz | In-lesson and end-of-module quizzes with single-choice, multiple-choice, scenario-based questions | M2 | survey |
| 10 | Quiz Grading & Instant Feedback | Server-side evaluation against answer keys, pass threshold check (>=80%), explanations | M2 | survey |
| 11 | Quiz Retake & Attempt History | Retake logic for failed quizzes preserving complete chronological attempt history | M2 | survey |
| 12 | Automated Certificate Generation | Verifiable completion certificate upon 100% course completion and quiz pass with unique serial ID | M2 | survey |
| 13 | Certificate Verification Public Endpoint | Public verification route to validate certificate authenticity via serial code | M2 | survey |
| 14 | Personal Learner Analytics & History | Individual learning profile displaying completed courses, training hours, quiz averages, transcript | M2 | survey |
| 15 | Manager Team Compliance Dashboard | Overview for managers showing direct reports, aggregate completion %, overdue compliance flags | M3 | survey |
| 16 | Direct Report Detail & Assignment Drilldown | Detailed view of direct report roadmap, module-by-module progress, manual course assignment | M3 | survey |
| 17 | One-Click Nudge / Reminder Notification | Trigger automated reminder alerts for employees with impending or overdue mandatory training | M3 | survey |
| 18 | Compliance Officer Control Center | Executive view of organization-wide compliance posture, breakdown by regulation (SOC2, OSHA, HIPAA) | M3 | survey |
| 19 | Automated Compliance Renewal Engine | Tracks credential expiration dates (e.g. 365 days); states: VALID, EXPIRING_SOON, EXPIRED | M3 | survey |
| 20 | Regulatory Audit Log Generator | Automatic logging for enrollments, lesson completion, quiz score, certificate issue, role changes | M3 | survey |
| 21 | Tamper-Evident SHA-256 Hash Chaining | Cryptographic hash chaining (prev_hash -> current_hash) enabling mathematical proof of log integrity | M3 | survey |
| 22 | Compliance Audit CSV Export | RFC 4180 compliant CSV export with headers for regulatory audit review | M3 | survey |
| 23 | Compliance Audit JSON Export | Machine-readable JSON export of compliance logs with cryptographic proof metadata | M3 | survey |
| 24 | Course & Curriculum Editor | Administrative interface to author courses, configure modules, reorder lessons, set passing score | M3 | survey |
| 25 | User & Department Administration | Admin interface to provision employees, assign departments, assign managers, update roles | M3 | survey |
| 26 | Relational SQLite Schema & Migrations | Complete normalized relational schema with WAL mode, foreign keys, and migration runner | M1 | survey |
| 27 | Seed Data Provisioner | Deterministic seeder with realistic departments, multi-role users, compliance courses, quizzes | M1 | survey |
| 28 | Persona Runner: New Hire (Alex Rivera) | Synthetic test executing Day-1 Orientation: login, modules, quiz submission, certificate check | M4 | survey |
| 29 | Persona Runner: Senior Engineer (Elena) | Synthetic test executing Technical Safety: technical modules, 100% quiz pass, score audit check | M4 | survey |
| 30 | Persona Runner: Compliance Manager (Marcus)| Synthetic test executing Compliance Audit: department filter, overdue check, CSV/JSON export, hash check | M4 | survey |
| 31 | Persona Simulation Orchestrator CLI | Unified runner (`npm run simulate` or `npm test`) executing all personas with summary matrix | M4 | survey |
| 32 | Comprehensive Automated Test Suite | Test suite (`npm test`) validating API endpoints, auth barriers, quiz grading, and DB integrity | M4 | survey |
| 33 | Production Build Pipeline (`npm run build`)| Clean production Next.js build with zero TypeScript compilation errors and valid route handlers | M5 | survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Foundation & Core Full-Stack Architecture | Next.js 15, React 19, TypeScript, Tailwind CSS, SQLite schema, Seed data, RBAC session context, Persona Switcher | none | DONE (Gate PASSED: 163 tests, CLEAN audit) |
| M2 | Learner Experience & Course Modules | Employee dashboard, Course catalog, Modular lesson player (markdown/video), Quiz engine & grading, Certificates, Analytics | M1 | DONE (worker_m2 completed: 180 tests pass) |
| M3 | Management, Compliance & Audit Trail | Manager team dashboard, Compliance control center, Renewal engine, Tamper-evident SHA-256 audit logs, CSV/JSON exports, Admin UI | M1 | IN_PROGRESS (conv: 38ab5d9b) |
| M4 | Office Employee Persona Simulation & Automated Tests | Automated persona runners (Alex, Elena, Marcus), state transition assertions, `npm test` test suite | M2, M3 | PLANNED |
| M5 | Final Acceptance, Dual-Track E2E Hardening & Production Build | Pass 100% of E2E Test Suite (Tiers 1-4), Adversarial hardening (Tier 5), `npm run build` zero-error compilation, Sentinel handoff | M4 | PLANNED |

## Interface Contracts

### 1. Database Layer ↔ API Layer (`src/lib/db/index.ts`)
- `getDb(): DatabaseSync`: Returns singleton SQLite database connection with WAL mode and foreign keys enabled.
- `initDb(): void`: Runs migrations, creates tables, indexes, and immutability triggers.
- `seedDb(): void`: Seeds idempotent corporate dataset if database is empty.

### 2. Auth & RBAC Layer (`src/lib/auth/index.ts`)
- `type Role = 'EMPLOYEE' | 'MANAGER' | 'COMPLIANCE_OFFICER' | 'SUPER_ADMIN'`
- `interface SessionUser { id: string; name: string; email: string; role: Role; department: string; jobTitle: string; avatarUrl?: string; managerId?: string | null }`
- `getCurrentUser(): SessionUser`: Resolves active user from session cookie or dev persona header.
- `requireRole(allowedRoles: Role[]): SessionUser`: Throws 403 HTTP error if current user does not have permission.

### 3. Audit Logging Layer (`src/lib/audit/index.ts`)
- `recordAuditEvent(event: { actorId: string; actorRole: Role; action: string; targetType: string; targetId: string; details?: Record<string, any>; ipAddress?: string }): AuditLogRecord`
- `verifyAuditLogIntegrity(): { isValid: boolean; totalRecords: number; tamperedIndex?: number; expectedHash?: string; actualHash?: string }`
- Each audit log row hashes `(id + prev_hash + timestamp + actor_id + action + target_type + target_id + JSON.stringify(details))` with SHA-256.

### 4. Quiz & Grading Engine (`src/lib/quiz/index.ts`)
- `evaluateQuiz(quizId: string, answers: Record<string, string>): { scorePct: number; passed: boolean; correctCount: number; totalCount: number; results: QuestionFeedback[] }`
- Instant feedback calculations with tamper-proof server-side answer keys.

### 5. Compliance Renewal Engine (`src/lib/compliance/index.ts`)
- `computeComplianceStatus(completedAt: string | null, renewalPeriodDays: number | null): 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'NOT_STARTED'`
- Days remaining threshold for `EXPIRING_SOON`: <= 30 days.

## Code Layout
```
/Users/janstevedaniel/Downloads/LMS FOR GAURAV
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx               # Learner dashboard
│   │   │   ├── courses/
│   │   │   │   ├── page.tsx           # Course catalog
│   │   │   │   └── [courseId]/
│   │   │   │       ├── page.tsx       # Course overview
│   │   │   │       └── modules/[moduleId]/page.tsx # Modular lesson viewer
│   │   │   ├── certificates/
│   │   │   │   ├── page.tsx           # Learner certificates
│   │   │   │   └── [certId]/page.tsx  # Verifiable certificate view
│   │   │   ├── manager/
│   │   │   │   └── page.tsx           # Manager team compliance
│   │   │   ├── compliance/
│   │   │   │   └── page.tsx           # Compliance officer audit center
│   │   │   └── admin/
│   │   │       ├── courses/page.tsx   # Admin course authoring
│   │   │       └── users/page.tsx     # Admin user management
│   │   ├── api/
│   │   │   ├── auth/session/route.ts
│   │   │   ├── courses/route.ts
│   │   │   ├── modules/[moduleId]/route.ts
│   │   │   ├── quizzes/[quizId]/submit/route.ts
│   │   │   ├── certificates/[certId]/route.ts
│   │   │   ├── manager/team/route.ts
│   │   │   ├── compliance/stats/route.ts
│   │   │   ├── compliance/audit-logs/route.ts
│   │   │   ├── compliance/export/csv/route.ts
│   │   │   ├── compliance/export/json/route.ts
│   │   │   ├── compliance/verify-audit/route.ts
│   │   │   └── simulate/route.ts
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── layout/
│   │   │   ├── header.tsx
│   │   │   ├── sidebar.tsx
│   │   │   └── persona-switcher.tsx
│   │   ├── learner/
│   │   │   ├── course-card.tsx
│   │   │   ├── progress-bar.tsx
│   │   │   ├── markdown-renderer.tsx
│   │   │   ├── video-player.tsx
│   │   │   └── certificate-view.tsx
│   │   ├── quiz/
│   │   │   ├── quiz-runner.tsx
│   │   │   └── question-card.tsx
│   │   └── compliance/
│   │       ├── compliance-kpi-card.tsx
│   │       ├── audit-log-table.tsx
│   │       ├── team-progress-table.tsx
│   │       └── integrity-badge.tsx
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts
│   │   │   ├── schema.ts
│   │   │   └── seed.ts
│   │   ├── auth/
│   │   │   └── index.ts
│   │   ├── audit/
│   │   │   └── index.ts
│   │   ├── quiz/
│   │   │   └── index.ts
│   │   ├── compliance/
│   │   │   └── index.ts
│   │   └── utils.ts
│   └── simulation/
│       ├── personas.ts
│       ├── runner.ts
│       ├── persona-alex-newhire.ts
│       ├── persona-elena-engineer.ts
│       └── persona-marcus-compliance.ts
├── tests/
│   ├── unit/
│   │   ├── audit-integrity.test.ts
│   │   ├── quiz-grading.test.ts
│   │   ├── rbac-permissions.test.ts
│   │   └── compliance-renewal.test.ts
│   ├── integration/
│   │   ├── api-routes.test.ts
│   │   └── data-persistence.test.ts
│   └── e2e/
│       ├── tier1-feature-coverage.test.ts
│       ├── tier2-boundary-cases.test.ts
│       ├── tier3-cross-feature.test.ts
│       └── tier4-real-world-scenarios.test.ts
├── scripts/
│   ├── seed.ts
│   └── simulate.ts
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── next.config.ts
```
