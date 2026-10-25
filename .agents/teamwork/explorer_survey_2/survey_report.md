# Technical Survey & Architecture Report: Enterprise LMS Data, RBAC, Audit Logging & API Layer

**Author**: `explorer_survey_2`  
**Timestamp**: 2026-10-25T11:55:00Z  
**Target System**: Enterprise Corporate Learning Management System (LMS)  
**Integrity Mode**: Development / Production Architecture  
**Working Directory**: `/Users/janstevedaniel/Downloads/LMS FOR GAURAV`

---

## 1. Executive Summary

This survey provides the foundational technical architecture and implementation specifications for the backend, database storage, access control, audit verification, and API surface of the Enterprise Corporate Learning Management System. 

The design is tailored for **corporate employee onboarding, role-based upskilling, and mandatory compliance tracking**. It incorporates:
1. **High-Performance SQLite Storage Engine**: Leveraging Node.js 26 built-in `node:sqlite` (`DatabaseSync`) with zero native build dependencies, deterministic SQL migrations, and strict relational integrity.
2. **Comprehensive Relational Schema**: Normalized tables for `users`, `courses`, `modules`, `quizzes`, `quiz_questions`, `enrollments`, `module_progress`, `quiz_submissions`, `certificates`, `audit_logs`, and `_migrations`.
3. **Four-Tier Role-Based Access Control (RBAC)**: Distinct permissions for `EMPLOYEE`, `MANAGER`, `COMPLIANCE_OFFICER`, and `SUPER_ADMIN` with authenticated session contexts and seamless persona switching for simulations.
4. **Cryptographic Tamper-Evident Audit Logging**: A cryptographic hash-chain (SHA-256 Merkle chain with genesis block and canonical JSON serialization) coupled with SQLite engine triggers that physically reject `UPDATE` and `DELETE` operations.
5. **Full REST API Surface**: Type-safe Next.js App Router API endpoints with input validation, instant quiz feedback, compliance renewal calculation, and CSV/JSON reporting.

---

## 2. Relational Database Schema & SQLite Storage Architecture

### 2.1 SQLite Storage Driver Comparison & Recommendation

The environment is running **Node.js v26.10.0**. On Node 26, choosing the SQLite interface requires evaluating dependency stability:

| Storage Interface | Native Addon / Dependencies | Node 26 Compatibility | Performance | Migration & Tooling Overhead | Recommendation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`node:sqlite` (`DatabaseSync`)** | **Zero dependencies** (Built-in standard library in Node 22.5+) | **Native (100% verified)** | Synchronous C-level SQLite speed (~100k ops/sec) | Minimal; zero-dependency migration runner | **Recommended Primary Driver** |
| **`better-sqlite3`** | Native C++ addon (`node-gyp`) | Risk of ABI mismatch / build failures on fresh Node 26 | Synchronous, high throughput | Requires build tools (python, make, gcc) | Secondary fallback |
| **`prisma`** | Rust engine binaries (`prisma-engines`) | High binary footprint | Added latency on cold starts | Heavy migration tooling; triggers can conflict | Not recommended for lean builds |
| **`drizzle-orm`** | TypeScript wrapper over driver | 100% compatible | Zero runtime overhead | Supports `node:sqlite` or typed custom repository | Recommended ORM layer |

**Selected Strategy**: Use `node:sqlite` (`DatabaseSync`) directly through a type-safe database wrapper layer (`src/lib/db/index.ts`). This guarantees zero build-step failures during `npm run build` or CI container deployment, while delivering sub-millisecond synchronous query performance.

---

### 2.2 Complete Relational Schema (DDL)

```sql
-- PRAGMAS FOR INTEGRITY AND SPEED
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;

-- ============================================================================
-- 1. SCHEMA MIGRATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  applied_at TEXT NOT NULL
);

-- ============================================================================
-- 2. USERS & ORGANIZATIONAL HIERARCHY
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                       -- e.g. 'usr_alex_turner' or UUIDv7
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('EMPLOYEE', 'MANAGER', 'COMPLIANCE_OFFICER', 'SUPER_ADMIN')),
  department TEXT NOT NULL,                  -- 'Engineering', 'Legal', 'Sales', 'People Ops', 'Operations'
  job_title TEXT NOT NULL,
  manager_id TEXT REFERENCES users(id) ON DELETE SET NULL, -- Self-referential reporting line
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,                  -- ISO-8601 UTC
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
CREATE INDEX IF NOT EXISTS idx_users_manager ON users(manager_id);

-- ============================================================================
-- 3. COURSES (TRAINING & COMPLIANCE CATALOG)
-- ============================================================================
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,                       -- e.g. 'crs_sec_2026'
  slug TEXT UNIQUE NOT NULL,                 -- e.g. 'security-and-data-privacy-2026'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('ONBOARDING', 'COMPLIANCE', 'SECURITY', 'TECHNICAL_UPSKILLING', 'LEADERSHIP')),
  target_role TEXT NOT NULL DEFAULT 'ALL',   -- 'ALL', 'ENGINEERING', 'MANAGER', 'NEW_HIRE'
  is_mandatory INTEGER NOT NULL DEFAULT 0 CHECK (is_mandatory IN (0, 1)),
  estimated_minutes INTEGER NOT NULL DEFAULT 30,
  renewal_period_days INTEGER,               -- e.g. 365 for annual mandatory compliance, NULL for one-time
  passing_score_pct INTEGER NOT NULL DEFAULT 80,
  version TEXT NOT NULL DEFAULT '1.0.0',     -- Version tracking for legal compliance
  is_published INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_courses_slug ON courses(slug);
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category);
CREATE INDEX IF NOT EXISTS idx_courses_mandatory ON courses(is_mandatory);

-- ============================================================================
-- 4. COURSE MODULES & LESSONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,                       -- e.g. 'mod_day1_it_setup'
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL,              -- 0-indexed display sequence
  type TEXT NOT NULL CHECK (type IN ('RICH_MARKDOWN', 'VIDEO_EMBED', 'INTERACTIVE_QUIZ')),
  content TEXT NOT NULL,                     -- Markdown text, video embed config JSON, or quiz overview
  estimated_minutes INTEGER NOT NULL DEFAULT 10,
  version TEXT NOT NULL DEFAULT '1.0.0',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(course_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_modules_course ON modules(course_id);

-- ============================================================================
-- 5. QUIZZES & QUESTION BANK
-- ============================================================================
CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  module_id TEXT UNIQUE NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  passing_score_pct INTEGER NOT NULL DEFAULT 80,
  time_limit_minutes INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE')),
  options TEXT NOT NULL,                     -- JSON array of { id, text }
  correct_answers TEXT NOT NULL,             -- JSON array of correct option IDs (hidden from client)
  explanation TEXT NOT NULL,                 -- Instant pedagogical feedback explanation
  created_at TEXT NOT NULL,
  UNIQUE(quiz_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions(quiz_id);

-- ============================================================================
-- 6. ENROLLMENTS & COMPLIANCE LIFECYCLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,                       -- e.g. 'enr_alex_sec2026'
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'OVERDUE')),
  progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  assigned_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TEXT NOT NULL,
  due_date TEXT,                             -- ISO-8601 date string
  completed_at TEXT,                         -- Timestamp when 100% finished
  expires_at TEXT,                           -- Calculated based on renewal_period_days from completed_at
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_due_date ON enrollments(due_date);

-- ============================================================================
-- 7. MODULE-LEVEL PROGRESS TRACKING
-- ============================================================================
CREATE TABLE IF NOT EXISTS module_progress (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
  completed_at TEXT,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  last_position_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(enrollment_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_module_progress_enrollment ON module_progress(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_module_progress_user ON module_progress(user_id);

-- ============================================================================
-- 8. QUIZ SUBMISSIONS & AUDIT EVIDENCE
-- ============================================================================
CREATE TABLE IF NOT EXISTS quiz_submissions (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score REAL NOT NULL CHECK (score >= 0.0 AND score <= 100.0),
  passed INTEGER NOT NULL CHECK (passed IN (0, 1)),
  attempt_number INTEGER NOT NULL DEFAULT 1,
  answers_payload TEXT NOT NULL,             -- JSON string of user choices
  feedback_payload TEXT NOT NULL,            -- JSON string of graded results & explanations
  submitted_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_sub_enrollment ON quiz_submissions(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sub_user ON quiz_submissions(user_id);

-- ============================================================================
-- 9. CERTIFICATES OF COMPLETION
-- ============================================================================
CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  certificate_code TEXT UNIQUE NOT NULL,     -- e.g. 'CERT-2026-ENG-84920'
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrollment_id TEXT UNIQUE NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  course_title TEXT NOT NULL,
  course_version TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  score REAL NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT,
  verification_hash TEXT NOT NULL,           -- SHA-256 for public verification
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_certificates_code ON certificates(certificate_code);
CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);

-- ============================================================================
-- 10. TAMPER-EVIDENT IMMUTABLE AUDIT LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,      -- Strictly monotonic sequence number
  uuid TEXT UNIQUE NOT NULL,
  timestamp TEXT NOT NULL,                   -- ISO-8601 UTC
  actor_id TEXT NOT NULL REFERENCES users(id),
  actor_role TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,                      -- 'COURSE_ASSIGNED', 'MODULE_COMPLETED', 'QUIZ_SUBMITTED', 'COMPLIANCE_CERTIFIED', 'ROLE_CHANGED'
  target_type TEXT NOT NULL,                 -- 'COURSE', 'MODULE', 'USER', 'ENROLLMENT', 'CERTIFICATE'
  target_id TEXT NOT NULL,
  course_id TEXT,
  module_id TEXT,
  module_version TEXT,                       -- Version of module when action occurred
  score REAL,                                -- Numeric quiz score if applicable
  metadata TEXT,                             -- JSON string (IP, user agent, verification reason)
  prev_hash TEXT NOT NULL,                   -- SHA-256 of the previous audit_log entry
  record_hash TEXT NOT NULL,                 -- SHA-256(canonical_json(record) + prev_hash)
  signature TEXT                             -- Optional HMAC signature
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_course ON audit_logs(course_id);

-- SQLite Engine-Level Immutability Triggers
CREATE TRIGGER IF NOT EXISTS prevent_audit_update 
BEFORE UPDATE ON audit_logs 
BEGIN 
  SELECT RAISE(ABORT, 'Audit log records are immutable and cannot be updated'); 
END;

CREATE TRIGGER IF NOT EXISTS prevent_audit_delete 
BEFORE DELETE ON audit_logs 
BEGIN 
  SELECT RAISE(ABORT, 'Audit log records are immutable and cannot be deleted'); 
END;
```

---

### 2.3 Migration Runner Design

To maintain deterministic execution across development and production environments, the migration system is designed as a standalone TypeScript module (`src/lib/db/migrate.ts`):
1. **Migrations Directory**: `src/lib/db/migrations/` containing ordered `.sql` files:
   - `001_initial_schema.sql` (Creates all 10 tables, indexes, and triggers)
   - `002_seed_data.sql` (Inserts initial seed roles, users, courses, modules, quizzes)
2. **Transaction Safety**: The runner wraps each migration in a dedicated `BEGIN TRANSACTION ... COMMIT` block.
3. **Tracking**: Queries the `_migrations` table. If a migration is recorded, it is skipped; otherwise, it executes and records its timestamp.
4. **CLI Command**: Can be triggered via `npm run db:migrate` and automatically called during server bootstrap or synthetic testing reset.

---

## 3. Role-Based Access Control (RBAC) & Session Architecture

### 3.1 Role Hierarchy & Personas

The system enforces 4 enterprise roles:

```
[ SUPER_ADMIN ]
      │
      ├──> [ COMPLIANCE_OFFICER ]
      │           │
      ├──> [ MANAGER ]
      │           │
      └──> [ EMPLOYEE ]
```

#### Pre-Configured Persona Roster
1. **Alex Turner** (`usr_alex_turner`)
   - Role: `EMPLOYEE`
   - Department: `Engineering`
   - Job Title: `Junior Software Engineer`
   - Manager: `Marcus Vance`
   - Use Case: New Hire navigating Day-1 Orientation, taking interactive IT and Security modules, receiving instant quiz feedback, earning first completion certificate.
2. **Sarah Chen** (`usr_sarah_chen`)
   - Role: `EMPLOYEE`
   - Department: `Engineering`
   - Job Title: `Staff Security Engineer`
   - Manager: `Marcus Vance`
   - Use Case: Senior engineer completing high-stakes Technical Safety & Secure Infrastructure refresher; testing renewal deadline alerts and recertification.
3. **Marcus Vance** (`usr_marcus_vance`)
   - Role: `MANAGER`
   - Department: `Engineering`
   - Job Title: `Director of Engineering`
   - Use Case: Managing team compliance, inspecting individual progress of direct reports (Alex, Sarah, David), assigning remediation courses, exporting team CSV reports.
4. **Elena Rostova** (`usr_elena_rostova`)
   - Role: `COMPLIANCE_OFFICER`
   - Department: `Legal & Risk Management`
   - Job Title: `Chief Compliance Officer`
   - Use Case: Enterprise-wide compliance health oversight, inspecting the tamper-evident audit log trail, verifying cryptographic hash chains for SOC 2 / OSHA audits, exporting signed compliance packages.
5. **Arthur Pendelton** (`usr_admin`)
   - Role: `SUPER_ADMIN`
   - Department: `IT Operations`
   - Job Title: `Head of Enterprise IT Systems`
   - Use Case: Full system administration, course authoring, system-wide configuration, and persona impersonation.

---

### 3.2 Granular RBAC Permission Matrix

| Operation / Capability | EMPLOYEE | MANAGER | COMPLIANCE_OFFICER | SUPER_ADMIN |
| :--- | :---: | :---: | :---: | :---: |
| **Learner Dashboard & Own Courses** |  |  |  |  |
| **Take Lessons & Submit Quizzes** |  |  |  |  |
| **Download Own Certificates** |  |  |  |  |
| **View Own Personal Analytics** |  |  |  |  |
| **View Team Dashboard (Direct Reports)** | ❌ |  |  (All Depts) |  |
| **Assign Courses to Team Members** | ❌ |  |  |  |
| **Export Team Completion Report (CSV/JSON)** | ❌ |  |  |  |
| **Global Enterprise Compliance Dashboard** | ❌ | ❌ |  |  |
| **Inspect Tamper-Evident Audit Logs** | ❌ | ❌ |  |  |
| **Run Cryptographic Audit Chain Verification**| ❌ | ❌ |  |  |
| **Export Official Audit Proof Packages** | ❌ | ❌ |  |  |
| **Manage Mandatory Compliance Cycles & Due Dates**| ❌ | ❌ |  |  |
| **Author / Edit Courses & Question Bank** | ❌ | ❌ | ❌ |  |
| **User & Role Administration** | ❌ | ❌ | ❌ |  |
| **Persona Switching for Synthetic Tests** | ❌ | ❌ | ❌ |  (Dev/Demo) |

---

### 3.3 Auth & Session Management

- **Session Context**: Supported via HTTP-only cookie (`lms_session`) or Bearer token header (`Authorization: Bearer <token>`).
- **Token Payload**:
  ```typescript
  interface SessionPayload {
    userId: string;
    email: string;
    name: string;
    role: 'EMPLOYEE' | 'MANAGER' | 'COMPLIANCE_OFFICER' | 'SUPER_ADMIN';
    department: string;
    iat: number;
    exp: number;
  }
  ```
- **Persona Switcher API** (`POST /api/auth/switch-persona`):
  Allows zero-friction switching between the 5 personas in development/simulation mode, setting the proper session cookie and immediately updating UI and API permissions.
- **Middleware Guard (`src/lib/auth/guard.ts`)**:
  ```typescript
  export function requireAuth(req: Request, allowedRoles?: Role[]): SessionPayload {
    const session = getSession(req);
    if (!session) throw new HttpError(401, 'Unauthorized');
    if (allowedRoles && !allowedRoles.includes(session.role)) {
      throw new HttpError(403, 'Forbidden: Insufficient permissions for this role');
    }
    return session;
  }
  ```

---

## 4. Tamper-Evident Immutable Audit Logging Architecture

### 4.1 Cryptographic Hash Chain Specification

To provide irrefutable proof for legal and regulatory compliance (e.g. OSHA safety, SOC 2, HIPAA, ISO 27001), the LMS implements a **sequential cryptographic Merkle hash-chain**:

```
[ Genesis Block ] ──(Hash_0)──> [ Record 1: Course Assigned ]
                                         │
                                      (Hash_1)
                                         ▼
                                [ Record 2: Module Completed ]
                                         │
                                      (Hash_2)
                                         ▼
                                [ Record 3: Quiz Submitted ]
                                         │
                                      (Hash_3)
                                         ▼
                                [ Record 4: Compliance Certified ]
```

#### Hash Calculation Formula
1. **Genesis Hash**:
   $$\text{Hash}_0 = \text{"0000000000000000000000000000000000000000000000000000000000000000"}$$
2. **Canonical JSON Serialization**:
   All fields contributing to the audit proof must be serialized with sorted keys to avoid encoding differences across environments:
   $$\text{Payload}_i = \text{CanonicalJSON}(\{id, \text{timestamp}, \text{actor\_id}, \text{actor\_role}, \text{action}, \text{target\_type}, \text{target\_id}, \text{module\_version}, \text{score}, \text{prev\_hash}\})$$
3. **Current Record Hash**:
   $$\text{Hash}_i = \text{SHA-256}(\text{Payload}_i)$$
4. **HMAC Signature (Optional Server Proof)**:
   $$\text{Signature}_i = \text{HMAC-SHA256}(\text{Hash}_i, \text{SECRET\_KEY})$$

#### What Information is Immutably Captured?
Every safety-critical event records:
- `timestamp`: UTC ISO-8601 when the action occurred.
- `actor_id` & `actor_role`: Who executed the action.
- `action`: `COURSE_ASSIGNED`, `MODULE_COMPLETED`, `QUIZ_SUBMITTED`, `COMPLIANCE_CERTIFIED`, `ROLE_CHANGED`.
- `course_id` & `module_id`: Target entities.
- `module_version`: The exact content version completed (prevents claiming an employee passed an older/different training module).
- `score`: The verified score achieved.
- `prev_hash` & `record_hash`: Cryptographic proof links.

---

### 4.2 Engine-Level Immutability (SQLite Triggers)

Even if application code suffers a bug or an attacker attempts an SQL injection, SQLite enforces physical immutability through database engine triggers:

```sql
CREATE TRIGGER prevent_audit_update 
BEFORE UPDATE ON audit_logs 
BEGIN 
  SELECT RAISE(ABORT, 'Audit log records are immutable and cannot be updated'); 
END;

CREATE TRIGGER prevent_audit_delete 
BEFORE DELETE ON audit_logs 
BEGIN 
  SELECT RAISE(ABORT, 'Audit log records are immutable and cannot be deleted'); 
END;
```
*Validation result: Node.js testing verified that both `UPDATE` and `DELETE` queries are immediately aborted with SQLite error code 1.*

---

### 4.3 Cryptographic Verification Function (`verifyAuditChain`)

The audit verification routine iterates through all historical records in sequence:
1. Re-derives the canonical JSON for each row.
2. Asserts that row $i$'s `prev_hash` equals row $i-1$'s `record_hash`.
3. Re-computes $\text{SHA-256}(\text{Payload}_i)$ and asserts it matches row $i$'s stored `record_hash`.
4. If any row was modified or deleted, the verification immediately identifies the exact damaged record index:

```typescript
export interface AuditVerificationResult {
  status: 'VERIFIED_VALID' | 'COMPROMISED';
  totalRecords: number;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  latestRootHash: string | null;
  isChainIntact: boolean;
  compromisedRecordIndex: number | null;
  failureReason?: string;
}
```

This verification is exposed via `GET /api/compliance/audit/verify` and callable via test runners.

---

## 5. API Route Architecture & Validation

The API is structured under Next.js App Router (`src/app/api/...`) with standardized JSON envelopes and Zod validation:

```typescript
// Standardized API Envelope
type ApiResponse<T> = 
  | { success: true; data: T; timestamp: string }
  | { success: false; error: { code: string; message: string; details?: unknown }; timestamp: string };
```

### 5.1 Route Catalog

#### Authentication & Personas
- `GET /api/auth/me`: Returns active session, user profile, role, and department.
- `POST /api/auth/login`: Authenticates user or selects persona.
- `POST /api/auth/switch-persona`: Instant persona switching (`{ persona: 'NEW_HIRE' | 'STAFF_ENGINEER' | 'MANAGER' | 'COMPLIANCE_OFFICER' | 'SUPER_ADMIN' }`).
- `POST /api/auth/logout`: Clears session.

#### Learner Experience (R1)
- `GET /api/learner/dashboard`:
  - Returns summary stats (total assigned, completed, in progress, overdue, compliance percentage, total hours).
  - Returns active course cards with progress bars and next module links.
  - Returns upcoming mandatory compliance deadlines.
- `GET /api/learner/courses`: Catalog of courses with user-specific enrollment state.
- `GET /api/learner/courses/[courseId]`: Detailed course breakdown with module list, completion status, quiz scores, and certificate status.
- `GET /api/learner/modules/[moduleId]`: Module content (Markdown text, video URL/metadata, or quiz questions). Note: Quiz answers are strictly stripped out on read.
- `POST /api/learner/modules/[moduleId]/progress`:
  - Payload: `{ timeSpentSeconds: number, lastPositionSeconds?: number, markCompleted?: boolean }`
  - Records time, updates `module_progress`, recalculates overall enrollment percentage.
- `POST /api/learner/modules/[moduleId]/quiz-submit`:
  - Payload: `{ answers: Record<string, string | string[]> }`
  - Grades submission server-side.
  - Calculates score %, compares against `passing_score_pct`.
  - Generates instant feedback itemizing question prompt, user choice, correct choice, and pedagogical explanation.
  - Inserts `quiz_submissions`.
  - Appends `QUIZ_SUBMITTED` entry into `audit_logs` with SHA-256 hash chaining.
  - If course modules are 100% complete and quiz is passed:
    - Marks enrollment `COMPLETED` and sets `completed_at`.
    - Generates and signs completion `certificate`.
    - Appends `COMPLIANCE_CERTIFIED` into `audit_logs`.
- `GET /api/learner/certificates`: List of user's issued certificates.
- `GET /api/learner/certificates/[code]`: Single certificate details with cryptographic verification token.

#### Management & Team Oversight (R2)
- `GET /api/manager/team`:
  - Role: `MANAGER`, `COMPLIANCE_OFFICER`, `SUPER_ADMIN`.
  - Returns department/team members, overall compliance score, overdue count, and individual employee course status matrix.
- `POST /api/manager/assign`:
  - Role: `MANAGER`, `COMPLIANCE_OFFICER`, `SUPER_ADMIN`.
  - Payload: `{ courseId: string, userIds: string[], dueDate?: string }`.
  - Creates enrollments and logs `COURSE_ASSIGNED` in audit logs for each target user.
- `GET /api/manager/reports/export`:
  - Query: `?format=csv|json`.
  - Streams CSV or JSON file containing team progress, completion dates, and compliance percentages.

#### Compliance & Audit Center (R2)
- `GET /api/compliance/dashboard`:
  - Role: `COMPLIANCE_OFFICER`, `SUPER_ADMIN`.
  - Enterprise metrics: global completion rate, department breakdown, overdue count, renewal forecast (30/60/90 days).
- `GET /api/compliance/audit-logs`:
  - Role: `COMPLIANCE_OFFICER`, `SUPER_ADMIN`.
  - Paginated audit log search with filters (`action`, `actorId`, `courseId`, `dateRange`).
- `GET /api/compliance/audit/verify`:
  - Role: `COMPLIANCE_OFFICER`, `SUPER_ADMIN`.
  - Runs cryptographic hash-chain verification across all records and returns validity status.
- `GET /api/compliance/reports/export`:
  - Role: `COMPLIANCE_OFFICER`, `SUPER_ADMIN`.
  - Query: `?format=csv|json&department=...`.
  - Exports regulatory audit package including cryptographic hash receipts.
- `POST /api/compliance/renewals/check`:
  - Automated check that flags enrollments as `EXPIRED` or `OVERDUE` when `expires_at < now()`, creating audit alerts.

#### Office Persona Simulation & Automated Testing (R4)
- `POST /api/simulation/run`:
  - Payload: `{ persona: 'NEW_HIRE' | 'STAFF_ENGINEER' | 'MANAGER' | 'ALL', resetFirst?: boolean }`.
  - Executes full programmatic workflow simulation:
    - New Hire: starts Day-1 onboarding, completes lessons, passes quiz, verifies certificate creation.
    - Staff Engineer: takes advanced safety module, verifies score and renewal dates.
    - Manager: assigns remediation course to direct report, exports compliance report.
  - Returns detailed assertion log and execution metrics.
- `POST /api/simulation/reset`: Re-initializes database to pristine seed state.

---

### 5.2 Input Validation Schemas (Zod)

```typescript
import { z } from 'zod';

export const QuizSubmissionSchema = z.object({
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
});

export const ModuleProgressSchema = z.object({
  timeSpentSeconds: z.number().int().min(0),
  lastPositionSeconds: z.number().int().min(0).optional(),
  markCompleted: z.boolean().optional(),
});

export const CourseAssignmentSchema = z.object({
  courseId: z.string().min(1),
  userIds: z.array(z.string().min(1)).min(1),
  dueDate: z.string().datetime().optional(),
});

export const PersonaSwitchSchema = z.object({
  persona: z.enum(['NEW_HIRE', 'STAFF_ENGINEER', 'MANAGER', 'COMPLIANCE_OFFICER', 'SUPER_ADMIN']),
});

export const AuditFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  actorId: z.string().optional(),
  action: z.string().optional(),
  courseId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});
```

---

## 6. Persona Simulation Runner Architecture (R4)

To satisfy Requirement R4 ("Automated Office Employee Persona Simulation & Testing"), the test suite runs programmatic simulations against the database and API layers:

```
┌─────────────────────────────────────────────────────────────┐
│                 OFFICE PERSONA RUNNER                       │
├─────────────────────────────────────────────────────────────┤
│ 1. New Hire Persona (Alex Turner):                          │
│    - Authenticate as Alex                                   │
│    - Verify Day-1 course is assigned & status is NOT_STARTED│
│    - Mark Lesson 1 & Lesson 2 complete                      │
│    - Submit Quiz with 100% score                            │
│    - Assert enrollment status -> COMPLETED                  │
│    - Assert Certificate generated with valid SHA-256 hash   │
│    - Assert Audit Log contains QUIZ_SUBMITTED &             │
│      COMPLIANCE_CERTIFIED linked in hash-chain              │
├─────────────────────────────────────────────────────────────┤
│ 2. Senior Engineer Persona (Sarah Chen):                    │
│    - Authenticate as Sarah                                  │
│    - Complete Technical Safety course                       │
│    - Check renewal period (365 days) sets expires_at correctly│
├─────────────────────────────────────────────────────────────┤
│ 3. Manager Persona (Marcus Vance):                          │
│    - Authenticate as Marcus                                 │
│    - View team dashboard -> verify Alex & Sarah's progress  │
│    - Assign newly published course to Alex                  │
│    - Export team report as CSV                              │
│    - Assert CSV contains all direct reports and percentages │
├─────────────────────────────────────────────────────────────┤
│ 4. Compliance Officer Persona (Elena Rostova):              │
│    - Authenticate as Elena                                  │
│    - Inspect audit logs                                     │
│    - Run verifyAuditChain() -> assert status: VERIFIED_VALID│
│    - Test deliberate tamper simulation -> verify detection  │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Synthesis & Architectural Blueprint for Implementation

| Subsystem | Recommended Technology & Pattern | Key File Paths |
| :--- | :--- | :--- |
| **Database Engine** | Built-in `node:sqlite` (`DatabaseSync`) | `src/lib/db/index.ts`, `src/lib/db/schema.ts` |
| **Migrations** | Sequential transactional runner | `src/lib/db/migrate.ts`, `src/lib/db/migrations/` |
| **Seed Data** | Multi-persona corporate dataset | `src/lib/db/seed.ts` |
| **Audit Chaining** | SHA-256 canonical Merkle chain + triggers | `src/lib/audit/index.ts`, `src/lib/audit/verify.ts` |
| **Access Control** | Typed RBAC session context + guards | `src/lib/auth/roles.ts`, `src/lib/auth/guard.ts` |
| **Validation** | Zod schemas | `src/lib/validation/schemas.ts` |
| **API Endpoints** | Next.js App Router route handlers | `src/app/api/...` |
| **Simulation Test** | Multi-persona synthetic runner | `src/lib/simulation/runner.ts`, `tests/simulation.test.ts` |

This architecture provides 100% coverage of user requirements R1, R2, R3, R4, ensuring bulletproof data integrity, audit readiness, and seamless multi-persona execution.
