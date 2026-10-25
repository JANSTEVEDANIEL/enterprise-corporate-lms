# Workspace Architecture & Tech Stack Survey Report

**Explorer**: `explorer_survey_1`  
**Date**: 2026-10-25  
**Target Project**: Enterprise Corporate Learning Management System (LMS)  
**Root Path**: `/Users/janstevedaniel/Downloads/LMS FOR GAURAV`

---

## 1. Executive Summary

A comprehensive investigation of the workspace `/Users/janstevedaniel/Downloads/LMS FOR GAURAV` was conducted. The workspace is currently in a pristine **greenfield state**: no existing JavaScript/TypeScript code, package manifests, or configuration files are present beyond agent metadata and the original request document. 

Key technical discoveries in the execution environment include:
1. **Node.js v26.10.0** and **npm 11.19.1** are installed and functional.
2. **Node 26 native capabilities** unlock powerful zero-dependency advantages:
   - Built-in `node:sqlite` (SQLite 3.53.4 DatabaseSync engine) enables zero-compilation, zero-daemon, resilient relational data storage with instant migrations and zero native addon build friction.
   - Built-in `node:test` and native TypeScript execution support allow direct execution of unit and integration tests (`npm test`) without bulky test runners.
   - Built-in `node:crypto` provides SHA-256 primitives for tamper-evident hash chaining in compliance audit logs.
3. The recommended architecture implements **Next.js 15 (App Router)** with **React 19**, **TypeScript**, and **Tailwind CSS**, supplemented by **Lucide React** for enterprise iconography and a clean, accessible corporate design system.

---

## 2. Current Workspace Inventory

### 2.1 File Tree & Directory Contents
Direct inspection via `ls -la .` reveals:
```
/Users/janstevedaniel/Downloads/LMS FOR GAURAV/
├── .agents/
│   └── teamwork/
│       ├── ORIGINAL_REQUEST.md
│       ├── BRIEFING.md
│       ├── orchestrator_1/
│       ├── explorer_survey_1/
│       ├── explorer_survey_2/
│       └── spec_miner_survey_1/
├── .claude/
│   └── commands/
│       └── jury.md (unrelated command prompt template)
└── ORIGINAL_REQUEST.md (specifications and acceptance criteria)
```

### 2.2 Environment & Tooling Verification
- **Runtime Environment**:
  - `node -v` → `v26.10.0` (Darwin arm64/x64 macOS)
  - `npm -v` → `11.19.1`
  - `npx` → `/Users/janstevedaniel/.local/bin/npx` (available)
  - `pnpm`, `yarn`, `bun` → Not installed
  - Git repository → `fatal: not a git repository`. Workspace has not been initialized with `git init`.
- **Package Manifest**:
  - `package.json` is currently **absent**.
  - `node_modules/` is **absent** (`npm ls --depth=0` returns `(empty)`).
  - No build configs (`tsconfig.json`, `next.config.*`, `tailwind.config.*`, `postcss.config.*`) are present.

---

## 3. Runtime & Platform Discoveries

| Feature / Engine | Native Availability in Node 26 | Architectural Value for Corporate LMS |
| :--- | :--- | :--- |
| **`node:sqlite` (DatabaseSync)** | Verified working (`sqlite: 3.53.4`) | High-performance synchronous SQLite driver. Eliminates `better-sqlite3` native compilation issues, node-gyp C++ build errors, or Docker daemon requirements. |
| **Native TypeScript Execution** | Verified working | Node 26 parses and executes TypeScript syntax natively, enabling fast execution of seeding scripts and test suites without complex transpiler pipelines. |
| **`node:test` & `node:assert`** | Verified working (`pass 1 / fail 0`) | Built-in test runner for `npm test`. No Jest/Vitest configuration overhead or dependency drift. |
| **`node:crypto`** | Built-in | Used for cryptographic tamper-evident audit logging (SHA-256 chained hash integrity checks). |

---

## 4. Target Architecture & Tech Stack (R3 Specification)

### 4.1 Framework & Core Stack
- **Framework**: Next.js 15+ (App Router).
- **Frontend Engine**: React 19 (`react@^19.0.0`, `react-dom@^19.0.0`).
- **Language**: TypeScript (`typescript@^5.6.0`, strict mode enabled, no implicit `any`).
- **Styling**: Tailwind CSS (`tailwindcss`, `postcss`, `autoprefixer`) adhering to modern CSS standards.
- **Icons**: `lucide-react` for enterprise UI (ShieldCheck, Award, BookOpen, Clock, FileCheck, Users, BarChart3, ChevronRight, CheckCircle2, AlertTriangle, Download, RefreshCw).
- **Class Utilities**: `clsx`, `tailwind-merge` with a unified `cn()` utility.

### 4.2 Database & Data Access Layer
- **Engine**: SQLite via built-in `node:sqlite` (`DatabaseSync`) located at `.data/lms.db` (with WAL mode enabled for concurrent reader/writer safety).
- **Migration & Schema**: A declarative schema script (`src/lib/schema.ts`) that initializes tables on startup with foreign keys and indexes:
  1. `users` (id, email, name, role, department, avatar_url, created_at)
  2. `courses` (id, title, description, category, estimated_minutes, compliance_required, renewal_period_days, version, created_at)
  3. `modules` (id, course_id, title, order_index, content_type [markdown|video|quiz], content_payload, duration_minutes)
  4. `quizzes` (id, module_id, passing_score, questions_json)
  5. `enrollments` (id, user_id, course_id, status [enrolled|in_progress|completed|expired], progress_percent, started_at, completed_at, renewal_due_at)
  6. `module_progress` (id, enrollment_id, module_id, completed, score, completed_at)
  7. `quiz_submissions` (id, user_id, quiz_id, score, passed, answers_json, submitted_at)
  8. `certificates` (id, user_id, course_id, certificate_number, issued_at, expires_at, verification_hash)
  9. `audit_logs` (id, timestamp, actor_id, actor_role, action, target_type, target_id, details_json, prev_hash, current_hash)

### 4.3 Role-Based Access Control (RBAC) Architecture
Four cleanly separated enterprise roles:
1. **Employee (Learner)**: Access to personalized dashboard, assigned/mandatory courses, interactive module player, quiz submissions, certificate generation, personal learning history.
2. **Manager**: Access to direct-report team dashboard, team completion metrics, overdue reminders, department-level compliance reporting, CSV/JSON export.
3. **Compliance Officer**: Access to enterprise compliance ledger, audit log viewer with hash verification, audit export (CSV/JSON), renewal schedule configuration, regulatory proof certificates.
4. **Super Admin**: Full platform oversight, user provisioning, course authoring and versioning, system-wide settings, audit log integrity verification.

To simulate seamless testing and real-world evaluation, an enterprise **Persona / Role Switcher** component in the header allows instantaneous switching between personas (`New Hire Employee`, `Senior Engineer`, `Team Manager`, `Compliance Officer`, `Super Admin`) without complex auth barriers.

### 4.4 Tamper-Evident Immutable Audit Log Architecture
- Each audit log entry computes a cryptographic SHA-256 hash chaining back to the previous entry:
  $$\text{current\_hash} = \text{SHA256}(\text{prev\_hash} + \text{timestamp} + \text{actor\_id} + \text{action} + \text{target\_id} + \text{details\_json})$$
- The root record starts with a known genesis hash.
- A built-in verification endpoint and UI widget checks the entire chain sequentially and flags any manipulated or missing records with instant visual indication (Verified / Tampered).

---

## 5. Code Layout Conventions & Directory Structure

```
/Users/janstevedaniel/Downloads/LMS FOR GAURAV/
├── src/
│   ├── app/
│   │   ├── layout.tsx                     # Root layout with Enterprise Navigation, RoleSwitcher, Toaster
│   │   ├── page.tsx                       # Employee / Learner Dashboard (Active courses, deadlines, progress)
│   │   ├── globals.css                    # Tailwind imports and enterprise design tokens
│   │   ├── courses/
│   │   │   ├── page.tsx                   # Course Catalog with category filters & search
│   │   │   └── [courseId]/
│   │   │       ├── page.tsx               # Course syllabus & enrollment details
│   │   │       └── modules/[moduleId]/
│   │   │           └── page.tsx           # Course Viewer (Markdown, video, interactive quiz)
│   │   ├── compliance/
│   │   │   └── page.tsx                   # Compliance Manager Dashboard (team rates, renewal alerts)
│   │   ├── audit/
│   │   │   └── page.tsx                   # Immutable Audit Ledger & Hash Chain Verifier
│   │   ├── admin/
│   │   │   └── page.tsx                   # Admin Control Center & Course/User Management
│   │   ├── certificates/
│   │   │   └── [certificateId]/
│   │   │       └── page.tsx               # Verifiable Digital Completion Certificate
│   │   ├── simulation/
│   │   │   └── page.tsx                   # Persona Simulation Runner UI (New Hire, Engineer, Manager)
│   │   └── api/
│   │       ├── auth/
│   │       │   └── session/route.ts       # Active user session & role context
│   │       ├── courses/
│   │       │   ├── route.ts               # List & filter courses
│   │       │   └── [courseId]/route.ts    # Course details
│   │       ├── modules/
│   │       │   └── [moduleId]/
│   │       │       └── complete/route.ts  # Mark module complete & record progress
│   │       ├── quizzes/
│   │       │   └── [quizId]/
│   │       │       └── submit/route.ts    # Quiz grading logic, instant feedback & certificate issue
│   │       ├── compliance/
│   │       │   └── stats/route.ts         # Team-wide completion statistics & renewal tracking
│   │       ├── audit-logs/
│   │       │   ├── route.ts               # Fetch audit records & verify hash chain
│   │       │   └── export/route.ts        # CSV/JSON audit export endpoint
│   │       └── simulation/
│   │           └── run/route.ts           # Persona runner execution API
│   ├── components/
│   │   ├── ui/                            # Atomic UI primitives (Button, Card, Badge, ProgressBar, Modal, Table, Tabs)
│   │   ├── layout/                        # Enterprise Header, RoleSwitcher, SidebarNavigation, Breadcrumbs
│   │   ├── learner/                       # CourseCard, CoursePlayer, MarkdownViewer, QuizWidget, CertificateView
│   │   ├── manager/                       # TeamProgressChart, ComplianceTable, RenewalAlertBanner, ExportButton
│   │   └── audit/                         # AuditLedgerTable, IntegrityBadge, ChainVerificationModal
│   ├── lib/
│   │   ├── db.ts                          # node:sqlite DatabaseSync singleton with WAL mode
│   │   ├── schema.ts                      # Relational schema initialization & tables DDL
│   │   ├── seed.ts                        # Seed data (Users, corporate courses, modules, quizzes, compliance records)
│   │   ├── auth.ts                        # RBAC definitions, role hierarchy, permission checks
│   │   ├── audit.ts                       # SHA-256 tamper-evident log append & chain verification logic
│   │   ├── utils.ts                       # Classnames helper (cn), date formatting, CSV generator
│   │   └── simulation.ts                  # Multi-agent persona state machine runner
│   └── types/
│       └── index.ts                       # Strongly-typed models for User, Course, Module, Quiz, Enrollment, Audit
├── tests/
│   ├── api.test.ts                        # API validation, auth barrier, and completion tests
│   ├── rbac.test.ts                       # Role-based access control tests
│   ├── audit.test.ts                      # Cryptographic hash chain and tamper-detection tests
│   └── simulation.test.ts                 # Office persona lifecycle simulation tests
├── scripts/
│   ├── seed.ts                            # Standalone DB seed script
│   └── run-personas.ts                    # CLI persona simulation test runner
├── .gitignore
├── next.config.ts
├── package.json
├── postcss.config.js
├── tailwind.config.ts
└── tsconfig.json
```

---

## 6. Build Tooling, Scripts & Configuration

### 6.1 Package Configuration (`package.json`)
```json
{
  "name": "enterprise-corporate-lms",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "node --test tests/**/*.test.ts",
    "seed": "node --experimental-strip-types scripts/seed.ts",
    "simulate": "node --experimental-strip-types scripts/run-personas.ts"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "lucide-react": "^0.460.0",
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwind-merge": "^2.5.5"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.16",
    "typescript": "^5.7.2"
  }
}
```

### 6.2 TypeScript Configuration (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 6.3 Tailwind & PostCSS Configuration
- Standard Tailwind configuration with slate/navy primary, indigo accent, emerald compliance success, and rose renewal alerts.
- Configured for responsive enterprise dashboard layouts (compact tables, stat cards, clean progress bars).

---

## 7. Foundations & Step-by-Step Provisioning Plan

To implement the requirements outlined in `ORIGINAL_REQUEST.md`:

1. **Phase 1: Project Scaffolding & Core Foundation**
   - Initialize git repo (`git init`) and `.gitignore` (`node_modules`, `.next`, `.data`, `.env*`).
   - Create `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`.
   - Install dependencies via `npm install`.
   - Implement `src/lib/db.ts` and `src/lib/schema.ts` leveraging `node:sqlite`.
   - Seed database with realistic corporate users (New Hire, Engineer, Manager, Compliance Officer), compliance courses (Information Security 2026, Workplace Safety, Anti-Bribery & Corruption), modules, quizzes, and initial audit logs.

2. **Phase 2: Learner Experience & Course Modules (R1)**
   - Build Employee Dashboard (`src/app/page.tsx`): Active courses, deadlines, progress bar, instant resume.
   - Build Course Viewer (`src/app/courses/[courseId]/modules/[moduleId]/page.tsx`): Rich markdown content, video player embed, next/prev module navigation.
   - Build Interactive Quiz Widget (`src/components/learner/QuizWidget.tsx`): Instant feedback, passing score check, retake option.
   - Build Automated Completion Certificates (`src/app/certificates/[certificateId]/page.tsx`): Digital verifiable certificate with unique ID, hash verification, print/save layout.

3. **Phase 3: Management, Compliance & Audit Trail (R2)**
   - Build Compliance & Manager Control Center (`src/app/compliance/page.tsx`): Department compliance rate gauges, employee renewal status, overdue alerts.
   - Build Tamper-Evident Audit Ledger (`src/app/audit/page.tsx`): Sequential cryptographic hash chain, audit log search/filter, verification check.
   - Build CSV & JSON Export API (`src/app/api/audit-logs/export/route.ts`): Instant download for compliance officers and external regulators.
   - Implement Granular RBAC guards and session role simulation.

4. **Phase 4: Automated Persona Simulation & Multi-Agent Office Testing (R4)**
   - Implement Persona Runner (`src/lib/simulation.ts` & `scripts/run-personas.ts`):
     - *Persona A (Alex Rivera - New Hire)*: Onboards, takes Day-1 Orientation, completes quiz, achieves certificate.
     - *Persona B (Devon Chen - Senior Engineer)*: Completes mandatory Technical Safety module, scores 100%, generates audit log.
     - *Persona C (Morgan Vance - Compliance Manager)*: Reviews department completion rates, triggers renewal reminder, exports audit trail.
   - Build Simulation UI (`src/app/simulation/page.tsx`) displaying step-by-step persona execution with real-time state transitions and green status badges.
   - Write comprehensive automated tests (`tests/api.test.ts`, `tests/rbac.test.ts`, `tests/audit.test.ts`, `tests/simulation.test.ts`) validating all criteria via `npm test`.

5. **Phase 5: Production Verification & Build Hardening**
   - Execute `npm run build` to confirm 0 TypeScript errors and 0 route generation warnings.
   - Execute `npm test` to confirm 100% test pass rate.
   - Execute `npm run simulate` to confirm persona runner lifecycle execution.

---

## 8. Summary of Findings & Next Steps

| Area | Current Workspace Status | Required Action in M1 |
| :--- | :--- | :--- |
| **Workspace Code** | Greenfield (Empty) | Scaffold Next.js 15 + React 19 + TypeScript + Tailwind directory structure |
| **Dependencies** | None installed | Install `next`, `react`, `react-dom`, `lucide-react`, `tailwindcss`, etc. |
| **Database** | None | Implement `src/lib/db.ts` utilizing built-in `node:sqlite` (SQLite 3.53.4) with zero native compilation issues |
| **Audit Ledger** | None | Implement SHA-256 chained hash integrity logging in `src/lib/audit.ts` |
| **Testing** | None | Write unit, RBAC, and persona simulation test suites using built-in `node:test` |

This survey report provides the architectural foundation and execution blueprint for Worker and Orchestrator agents to build the enterprise LMS.
