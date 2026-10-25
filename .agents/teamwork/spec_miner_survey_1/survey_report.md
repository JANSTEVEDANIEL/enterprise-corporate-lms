# Enterprise Corporate Learning Management System (LMS)
## Comprehensive Functional Specification, Feature Inventory & User Journey Survey Report

- **Author**: `spec_miner_survey_1` (Specification Miner)
- **Date**: 2026-10-25
- **Specification Sources**:
  - `/Users/janstevedaniel/Downloads/LMS FOR GAURAV/.agents/teamwork/ORIGINAL_REQUEST.md`
  - Requirements R1 (Learner Experience & Course Modules)
  - Requirements R2 (Management, Compliance & Audit Trail)
  - Requirements R3 (Modern Production Full-Stack Architecture)
  - Requirements R4 (Automated Office Employee Persona Simulation & Testing)
  - Corporate LMS Enterprise Domain Best Practices & Industry Standards (OSHA/SOC2/ISO27001 compliance tracking, immutable audit trails, SCORM/microlearning modern paradigms)

---

## Executive Summary & System Scope

The Enterprise Corporate Learning Management System (LMS) is a dedicated, production-grade enterprise platform engineered specifically for corporate employee onboarding, mandatory regulatory compliance tracking, and role-based continuous upskilling. Unlike legacy academic LMS platforms (such as Moodle or Blackboard) burdened with semester grades, assignment dropboxes, and academic syllabi, this system delivers:

1. **Consumer-Grade Learner Experience (R1)**: Modern, distraction-free corporate UX with instant single-click onboarding, bite-sized interactive micro-learning modules (rich GitHub-flavored markdown, responsive video embeds, interactive knowledge checks), instant quiz evaluation, personal streak/progress analytics, and cryptographically verifiable PDF/SVG completion certificates.
2. **Enterprise Governance, Compliance & Tamper-Evident Audit Trail (R2)**: Granular Role-Based Access Control (RBAC: `EMPLOYEE`, `MANAGER`, `COMPLIANCE_OFFICER`, `SUPER_ADMIN`), automated recurring compliance renewal engine (e.g., 365-day SOC2/Security refresher cycles with `VALID`, `EXPIRING_SOON`, and `EXPIRED` state transitions), tamper-evident SHA-256 cryptographic audit logs, real-time team compliance heatmaps, and one-click regulatory CSV/JSON audit export.
3. **Robust Full-Stack Production Architecture (R3)**: Next.js (App Router, React 19) with TypeScript, Tailwind CSS, SQLite/Better-SQLite3 relational database engine with Prisma/Drizzle ORM schema and seeders, strict Zod API schema validation, and zero-defect build verification (`npm run build`).
4. **Automated Multi-Persona Office Employee Simulation & End-to-End Testing (R4)**: An automated synthetic office persona simulator executing real-world corporate employee journeys:
   - **Persona 1: Alex Rivera (New Hire)** — Day-1 security & company culture orientation, policy acknowledgment, interactive quiz completion, first certificate issuance.
   - **Persona 2: Elena Rostova (Senior Engineer)** — High-velocity technical safety & secure code training, video module completion, edge-case quiz passing, score logging.
   - **Persona 3: Marcus Vance (Compliance Manager)** — Departmental compliance audit, detecting overdue certifications, automated reminder triggers, and tamper-evident audit export.
   - **Programmatic Test Suite (`npm test`)** — 100% automated verification covering authentication barriers, API contract validation, quiz grading logic, and state transition integrity.

---

## Features Discovered

The following feature inventory breaks down every discrete capability across all enterprise LMS subsystems:

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Auth & RBAC | Role-Based Access Control Engine | Enforces granular roles (`EMPLOYEE`, `MANAGER`, `COMPLIANCE_OFFICER`, `SUPER_ADMIN`) across UI routes, server components, and API handlers. | Session context, User ID, target route/endpoint | Authorized view or API payload | 401 Unauthorized for unauthenticated; 403 Forbidden with security audit log for role mismatch | R2, Original Request § R2, Acceptance Criteria § Core Functionality |
| 2 | Auth & RBAC | Instant Persona/Role Switcher | Quick-switch bar in development/demo mode allowing instant assumption of persona identities (Alex Rivera, Elena Rostova, Marcus Vance, Super Admin) for testing and evaluation. | Selected Persona ID or Role enum | Active session update, refreshed UI context | 400 Bad Request if invalid persona ID | R4 Persona Simulation & Testing |
| 3 | Learner Experience | Single-Click Employee Onboarding | Friction-free welcome walkthrough for newly provisioned employees; initializes required onboarding tracks, displays pending compliance items with clear due dates. | User ID, Department ID | Provisioned enrollments, onboarding roadmap UI | Fallback to default General Employee curriculum if department has no custom track | R1 Learner Experience |
| 4 | Learner Experience | Clutter-Free Employee Dashboard | Focused learner overview showing: active course cards, overdue warnings, progress percentages, total learning hours, and quick-resume buttons. | User ID | Personalized dashboard component, progress metrics | Graceful empty state ("All caught up! No pending courses.") if zero enrollments | R1, Acceptance Criteria § Core Functionality |
| 5 | Learner Experience | Course Catalog & Track Explorer | Directory of available corporate training tracks (Mandatory Compliance, Departmental Skills, Leadership, Electives) with search, filter, and estimated duration. | Search query, category filter, role filter | Filtered course card grid with enrollment status badges | Empty search result view with reset filter action | R1 Learner Experience |
| 6 | Course Viewer | Bite-Sized Modular Lesson Player | Distraction-free course viewer with collapsible chapter drawer, breadcrumbs, previous/next lesson navigation, and markdown content renderer. | Course ID, Module ID | Rendered lesson view, reading progress indicator | 404 Not Found if module does not belong to course | R1, Acceptance Criteria § Course Viewer |
| 7 | Course Viewer | Rich Markdown Content Engine | Formatted rendering of technical documentation, policy manuals, checklists, tables, code blocks with syntax highlighting, and alert callouts. | Raw Markdown string from database | Sanitized HTML DOM elements | Sanitization of unsafe tags (prevents XSS); fallback to plaintext error if parser fails | R1 Learner Experience |
| 8 | Course Viewer | Responsive Video Embed Module | Embedded instructional video player (HTML5/iframe/embed) with playback tracking, automatic timestamp progress saving, and completion trigger. | Video URL, user playback events | Video viewport, watched percentage status update | Graceful fallback link if video host is unreachable; marks complete only after minimum watch threshold | R1 Learner Experience |
| 9 | Assessment | Interactive Knowledge Check & Quiz Engine | In-lesson and end-of-module quizzes with single-choice, multiple-choice, and scenario-based questions; randomized question order support. | Module ID, User answer map `{ [questionId]: optionId }` | Instant score calculation, correct answer explanations, pass/fail status | 400 Bad Request for missing question answers; reject submission if module locked | R1, Acceptance Criteria § Core Functionality |
| 10 | Assessment | Quiz Grading & Instant Feedback | Evaluates quiz submissions against server-side answer keys, calculates percentage, verifies against course pass threshold (e.g. 80%), and awards credit. | Quiz submission payload | Score, Pass/Fail flag, breakdown of correct/incorrect questions | Reject grading if answer payload is tampered; log attempt in `QuizSubmissions` table | R1, Acceptance Criteria § Multi-Agent Verification |
| 11 | Assessment | Quiz Retake & Attempt Limits | Handles retake logic for failed quizzes with configurable cooldown or attempt counter, preserving full attempt history for audit. | Retake request, Quiz ID, User ID | Reset active quiz state, create new attempt row | Block attempt if max retries exceeded; notify manager if configured | R1 Learner Experience |
| 12 | Certification | Automated Certificate Generation | Generates a tamper-verifiable completion certificate upon 100% course completion and quiz pass, featuring certificate serial ID, employee name, course title, and issue date. | Enrollment ID, User ID, Course ID | Printable/Downloadable Certificate UI, unique verification URL / hash | Block certificate generation if module progress < 100% or quiz failed | R1, Acceptance Criteria § Core Functionality |
| 13 | Certification | Certificate Verification Public Endpoint | Publicly accessible or internal verification route allowing auditors or managers to validate certificate authenticity via serial code. | Certificate UUID / Verification code | Verification view: Course, Learner, Completion Date, Issuing Authority, Hash | 404 Invalid or Unrecognized Certificate | R1 Learner Experience, R2 Audit Trail |
| 14 | Analytics | Personal Learner Analytics & History | Individual learning profile displaying completed courses, total training hours, quiz score averages, streak counter, and downloadable transcript. | User ID | Personal stats charts, completed certificates list | Empty history banner if new hire | R1 Learner Experience |
| 15 | Management | Manager Team Compliance Dashboard | Overview for department heads showing direct reports, aggregate completion percentage, pending deadlines, and overdue compliance flags. | Manager User ID, Department ID | Team member roster table, compliance rate gauge, overdue risk list | 403 Forbidden if user is not MANAGER or above; empty list if manager has no reports | R2 Management & Compliance |
| 16 | Management | Direct Report Detail & Assignment Drilldown | Detailed view of a specific team member's learning roadmap, module-by-module progress, quiz attempts, and manual enrollment assignment. | Employee User ID, Manager User ID | Comprehensive employee progress breakdown modal/page | 403 Forbidden if employee is outside manager's departmental boundary | R2 Management |
| 17 | Management | One-Click Nudge / Reminder Notification | Manager trigger to send automated reminder notifications or alerts to employees with impending or overdue mandatory training. | Target Employee ID, Course ID | Notification record created, status timestamp updated | 400 Bad Request if course is already completed | R2 Management |
| 18 | Compliance | Compliance Officer Control Center | Executive and regulatory view of organization-wide compliance posture, breakdown by regulation (SOC2, HIPAA, OSHA, Anti-Harassment), and risk heatmaps. | Compliance Officer Session | Organization-wide compliance KPI cards, department ranking, overdue registry | 403 Forbidden for non-compliance officer/admin users | R2 Management, Compliance & Audit Trail |
| 19 | Compliance | Automated Compliance Renewal Engine | Tracks credential expiration dates (e.g., 365 days from completion); computes state (`VALID`, `EXPIRING_SOON` [<=30 days], `EXPIRED`); triggers recertification enrollment. | Scheduled trigger / on-read evaluation, Enrollment completion timestamp | Updated compliance status, renewed enrollment row if expired | Status gracefully transitions without corrupting prior historical certificate records | R2, Acceptance Criteria § Compliance & Verification |
| 20 | Compliance | Regulatory Audit Log Generator | Automatic, non-bypassable logging for all security and compliance events (course enrollment, lesson access, quiz submission, score, certificate issue, role change). | Event type, Actor ID, Target ID, Payload metadata | Appended row in `AuditLogs` table with timestamp, user ID, module version, score | Failure to write audit log aborts sensitive state transition (fail-closed integrity) | R2, Acceptance Criteria § Compliance & Verification |
| 21 | Compliance | Tamper-Evident Hash Chain / Verification | Each audit log entry includes a SHA-256 cryptographic digest of its contents and previous record hash, enabling mathematical verification of log immutability. | Current log data, previous log hash | Stored `record_hash` in database; verification utility function | Audit integrity verification check fails and flags tampered record if payload was modified | R2 Management, Compliance & Audit Trail |
| 22 | Compliance | Compliance Audit CSV Export | Downloads complete compliance records or filtered team audit trails in RFC 4180 compliant CSV format for external regulatory auditors. | Filter parameters (Department, Course, Date Range) | Streaming CSV download (`Content-Type: text/csv`) with headers | Returns empty CSV with header row if no records match | R2, Acceptance Criteria § Compliance & Verification |
| 23 | Compliance | Compliance Audit JSON Export | Machine-readable JSON export of compliance logs with cryptographic proof metadata, schema versioning, and export timestamp. | Filter parameters (Date Range, Regulation ID) | JSON file download (`Content-Type: application/json`) | 400 Bad Request on invalid date format; 403 Forbidden for unauthorized roles | R2, Acceptance Criteria § Compliance & Verification |
| 24 | Administration | Course & Curriculum Editor | Administrative interface to author courses, configure modules, reorder lessons, embed media links, and set passing thresholds. | Course metadata, module list, quiz configuration | Persisted Course, Module, and Question records | 400 Validation error on empty title, negative duration, or quiz without correct answer | R2 Management & Admin Control Center |
| 25 | Administration | User & Department Administration | Management interface to provision employees, assign departments, assign managers, and update RBAC roles. | User payload (name, email, role, department) | Updated User entity, audit log entry | 400 Validation error on duplicate email or invalid role enum | R2 Management & RBAC |
| 26 | Data & DB | Relational Database Schema & Migrations | SQLite/Better-SQLite3 relational database schema with tables for `Users`, `Roles`, `Courses`, `Modules`, `Enrollments`, `QuizSubmissions`, `Certificates`, and `AuditLogs`. | Database migration scripts / Prisma/Drizzle schema | Fully migrated database file (`dev.db`) | Migration rollback / startup error if schema violates constraints | R3 Production Architecture, Acceptance Criteria § Architecture |
| 27 | Data & DB | Seed Data Provisioner | Deterministic database seeder providing realistic corporate data: departments, multi-role users, compliance courses, modules, quizzes, and audit records. | Seed command (`npm run db:seed`) | Populated SQLite database with personas (Alex, Elena, Marcus, Admin) | Idempotent upsert logic prevents primary key collision on re-seed | R3, R4 Office Employee Persona Simulation |
| 28 | Simulation | Persona Runner: New Hire (Alex Rivera) | Automated synthetic test executing Day-1 Orientation: login, dashboard inspection, navigation through company culture & security modules, quiz submission, certificate verification. | Simulation runner invocation | Step-by-step console execution log, verified DB state transitions | Test failure if any step fails or certificate is not awarded | R4 Persona Simulation, Acceptance Criteria § Multi-Agent Verification |
| 29 | Simulation | Persona Runner: Senior Engineer (Elena) | Automated synthetic test executing Technical Safety & Code Compliance: technical module traversal, markdown parsing verification, 100% quiz pass, audit log verification. | Simulation runner invocation | Step-by-step console log, verified quiz score >= 80%, audit row check | Test failure if grading logic calculates wrong percentage or audit missing | R4 Persona Simulation, Acceptance Criteria § Multi-Agent Verification |
| 30 | Simulation | Persona Runner: Compliance Manager (Marcus) | Automated synthetic test executing Regulatory Audit: compliance dashboard load, department filter, overdue detection, CSV/JSON export generation, audit hash verification. | Simulation runner invocation | Step-by-step console log, verified export payload, verified tamper hash | Test failure if CSV output is empty or hash chain mismatch detected | R4 Persona Simulation, Acceptance Criteria § Multi-Agent Verification |
| 31 | Simulation | Persona Simulation Orchestrator CLI | Unified CLI/script runner (`npm run simulate` or `npm test`) executing all 3 persona simulations in sequence and outputting clean summary matrix. | Terminal command | Formatted test summary output (Passed/Failed counts, execution time) | Exit code 1 on any simulation failure; exit code 0 on complete pass | R4 Persona Simulation & Testing |
| 32 | Testing | Comprehensive Test Suite (`npm test`) | Full automated test suite (Vitest or Jest) executing unit and integration tests: API endpoints, RBAC middleware, quiz grading math, and database integrity. | Terminal command (`npm test`) | Test runner reporting all green test suites | Exit code 1 on test assertion failures | R4, Acceptance Criteria § Architecture & Quality |
| 33 | Build & Infra | Production Build Pipeline (`npm run build`) | Next.js production compilation ensuring zero TypeScript compilation errors, valid route handlers, and optimized server/client bundles. | Terminal command (`npm run build`) | Production `.next` artifact | Non-zero exit code if type error or broken import exists | R3, Acceptance Criteria § Architecture & Quality |

---

## Edge Cases & Boundary Conditions

| # | Feature | Input / Condition | Observed / Required Behavior |
|---|---------|-------------------|-----------------------------|
| 1 | Quiz Submission | Quiz submitted with unanswered questions | Rejection with HTTP 400 and validation error pointing to missing question IDs; submission is not graded and attempt is not consumed. |
| 2 | Quiz Grading | Learner submits score below passing threshold (e.g. 60% with 80% passing requirement) | State set to `FAILED`; score and submission recorded in `QuizSubmissions` and `AuditLogs`; course progress remains incomplete; certificate generation is blocked; retry option displayed. |
| 3 | Quiz Retake | Learner retakes quiz after initial failure and achieves 100% | State transitions from `FAILED` to `PASSED`; new record created in `QuizSubmissions`; enrollment progress updates to 100%; certificate is unlocked; audit log records both attempts chronologically. |
| 4 | RBAC Protection | Employee attempts direct HTTP GET to `/api/admin/audit-logs` or visits `/admin` | Middleware blocks request; returns HTTP 403 Forbidden with `{ error: "Insufficient permissions" }`; UI redirects to `/dashboard` or renders access denied notice; security audit log recorded. |
| 5 | Compliance Expiry | Course completed 366 days ago with 365-day renewal policy | System computes status as `EXPIRED`; dashboard flags course with red "Renewal Required" badge; overall compliance rate decreases; automated renewal enrollment created. |
| 6 | Compliance Renewal | Course completed 345 days ago with 365-day renewal policy (20 days remaining) | System computes status as `EXPIRING_SOON`; dashboard displays yellow "Expires in 20 days" alert with prominent "Start Recertification" button. |
| 7 | Audit Log Integrity | Malicious database modification directly alters score or user ID in `AuditLogs` | Tamper verification utility recomputes SHA-256 hash chain and detects mismatch between expected hash and calculated record hash; alerts system of integrity violation. |
| 8 | Markdown Rendering | Markdown content contains malicious script tags `<script>alert('xss')</script>` or invalid HTML | HTML sanitizer (or React Markdown AST parser) strips dangerous script tags and event handlers; renders safe markdown without executing arbitrary JavaScript. |
| 9 | Large Audit Export | Compliance officer requests audit export with 10,000+ log records | API streams or buffers CSV/JSON cleanly without Node.js out-of-memory crash; includes standard CSV headers and escaping for fields containing commas or quotes. |
| 10 | Zero Enrollments | Newly provisioned employee with no enrolled courses logs in | Dashboard displays clean, inviting welcome state with "Get Started" onboarding guide and course catalog link; no divide-by-zero errors in progress calculation (0% displayed safely). |
| 11 | Concurrent Quiz Submissions | Rapid duplicate clicks on "Submit Quiz" button | Client-side button disables immediately upon submission; server-side idempotency check prevents duplicate submission records for the same attempt timestamp. |
| 12 | Video Progress Edge Case | User navigates away before completing video lesson | Current playback position is saved; status remains `IN_PROGRESS`; next lesson remains locked if sequence enforcement is enabled. |
| 13 | Certificate Serial Collision | Two certificates generated simultaneously | Certificate UUID is generated via cryptographically secure random UUIDv4 / nanoid ensuring absolute uniqueness across the database. |
| 14 | Persona Simulation Reset | Running persona simulation multiple times consecutively | Simulation runner uses transactional rollback or idempotent test fixtures so that repeated runs start from a known deterministic state and pass cleanly every time. |

---

## Detailed User Journeys

### User Journey 1: New Hire Day-1 Orientation (Alex Rivera)
- **Persona Context**: Alex Rivera has just joined the company as a Junior Business Analyst. Today is Day 1.
- **Starting State**: User record exists in DB with role `EMPLOYEE`; assigned mandatory course: "Corporate Information Security & Workplace Safety" (Course ID: `course-sec-101`); enrollment state: `NOT_STARTED`.
- **Step-by-step Journey**:
  1. **Authentication & Welcome**: Alex logs into the LMS (or is selected via the Persona Switcher). The system immediately displays the Employee Dashboard with a prominent "Welcome to the Team, Alex! Complete your Day-1 Orientation" hero banner.
  2. **Dashboard Review**: Alex views the course card showing "Corporate Information Security & Workplace Safety", marked `MANDATORY`, due in 7 days, progress `0%`, with an estimated completion time of 15 minutes.
  3. **Module 1 - Company Security Policy (Markdown)**: Alex clicks "Start Course". The Course Viewer loads Chapter 1: "Acceptable Use & Phishing Awareness". Alex reads the formatted markdown containing bullet points, callout warning boxes, and an embedded password hygiene checklist. Alex marks Chapter 1 as complete; progress bar updates to 33%.
  4. **Module 2 - Data Protection & Device Safety (Video & Policy)**: Alex navigates to Chapter 2. A responsive instructional video on physical security and badge policies is displayed. Alex watches the video and acknowledges the remote work policy checkbox. Progress updates to 66%.
  5. **Module 3 - Mandatory Knowledge Check (Interactive Quiz)**: Alex advances to the final module: a 5-question interactive quiz. Alex selects answers for questions on reporting lost laptops, recognizing phishing emails, and multi-factor authentication.
  6. **Instant Grading & Feedback**: Alex clicks "Submit Quiz". The system instantly grades the submission: 5/5 (100%). Green badges appear next to each correct answer with instructional rationales.
  7. **State Transition**: The server records the submission in `QuizSubmissions`, updates the `Enrollments` record to `COMPLETED` with `completed_at` timestamp, and appends a tamper-evident entry to `AuditLogs`.
  8. **Certificate Generation**: A congratulatory modal pops up with a button to "View Completion Certificate". Alex clicks it and views a certificate with Alex's full name, course title, completion date, and unique verification serial number (`CERT-SEC-XXXX`).
  9. **Dashboard Reflection**: Alex returns to the dashboard; the course card now shows a green `COMPLETED` badge and 100% progress. Total training hours update from 0 to 0.5 hours.

### User Journey 2: Senior Engineer Upskilling & Technical Safety (Elena Rostova)
- **Persona Context**: Elena Rostova is a Staff Software Engineer required to complete the annual "Advanced Production Infrastructure Safety & Incident Response" module.
- **Starting State**: User record exists with role `EMPLOYEE`, Department `Engineering`. Course status: `IN_PROGRESS` (previously completed Module 1).
- **Step-by-step Journey**:
  1. **Quick Resume**: Elena accesses the dashboard. The "Advanced Production Infrastructure Safety" course is displayed with a "Resume Lesson" button pointing directly to Module 2.
  2. **Technical Markdown Review**: Elena enters Module 2: "Production Access Controls & Secret Management". The markdown viewer displays syntax-highlighted Bash scripts, infrastructure diagrams, and IAM privilege rules.
  3. **Technical Knowledge Check**: Elena proceeds to the technical quiz containing complex scenarios (e.g., handling production credential rotation, mitigating zero-day CVEs).
  4. **Grading & Scoring**: Elena submits the answers. Score: 90% (exceeding the strict 80% passing threshold).
  5. **Immutable Audit Verification**: The server records the quiz submission, computes the cryptographic SHA-256 hash linking the previous audit log entry, and writes the audit record with module version `v2.4` and score `90%`.
  6. **Completion Analytics**: Elena's personal analytics page updates to reflect 100% engineering compliance and 4.5 total certified hours.

### User Journey 3: Compliance Officer Audit & Regulatory Oversight (Marcus Vance)
- **Persona Context**: Marcus Vance is the Corporate Compliance Officer responsible for SOC2 and OSHA annual audit readiness.
- **Starting State**: User record has role `COMPLIANCE_OFFICER`. All employee completion records are stored in the database.
- **Step-by-step Journey**:
  1. **Executive Overview**: Marcus logs in. The system routes him to the Compliance Command Center.
  2. **Metric Assessment**: Marcus reviews the top-level KPIs: Organization-Wide Compliance Rate (e.g. 94%), Total Active Employees (45), Certified Courses (120), and Overdue Violations (2).
  3. **Department Breakdown**: Marcus inspects the departmental breakdown table. Engineering is at 98%, Sales at 85%. Marcus filters by "Sales" to view the overdue employee records.
  4. **Audit Log Inspection**: Marcus opens the Audit Trail tab. A chronological, tamper-evident log displays recent employee completions, module versions, timestamps, and cryptographic integrity checkmarks.
  5. **Tamper Integrity Verification**: Marcus triggers the "Verify Log Integrity" function. The system re-hashes all audit records sequentially and confirms 100% hash chain validity.
  6. **Regulatory Export**: Marcus clicks "Export Compliance Audit". He selects CSV format for the external auditor. The system instantly downloads `compliance-audit-2026-10-25.csv` containing columns: `AuditID`, `Timestamp`, `UserID`, `EmployeeName`, `CourseID`, `CourseTitle`, `ModuleVersion`, `Score`, `Status`, `RecordHash`.
  7. **JSON Proof Export**: Marcus also downloads the cryptographic JSON export containing full signature manifests for SOC2 archival.

### User Journey 4: Department Manager Team Progress Tracking (Sarah Jenkins)
- **Persona Context**: Sarah Jenkins is the Director of Operations managing a team of 8 employees.
- **Starting State**: User record has role `MANAGER`, overseeing Department `Operations`.
- **Step-by-step Journey**:
  1. **Manager Portal Access**: Sarah logs in and navigates to "Team Management".
  2. **Direct Report Roster**: The dashboard lists all 8 direct reports with their individual progress bars, assigned courses, and completion dates.
  3. **Overdue Alert**: Sarah notices that one team member is at 0% for a mandatory Harassment Prevention course expiring in 3 days.
  4. **Nudge Action**: Sarah clicks the "Send Reminder" button next to the employee's name, recording a reminder timestamp and queuing a notification.

### User Journey 5: Super Admin Curriculum Management (David Kim)
- **Persona Context**: David Kim is the LMS Super Administrator.
- **Starting State**: User record has role `SUPER_ADMIN`.
- **Step-by-step Journey**:
  1. **Course Creation**: David navigates to `/admin/courses` and clicks "Create New Course".
  2. **Curriculum Structuring**: David enters course metadata: title, description, category, mandatory toggle, and estimated duration.
  3. **Module & Quiz Authoring**: David adds two modules: Module 1 with markdown policy text, Module 2 with a 3-question quiz specifying options, correct answer indices, and 80% passing threshold.
  4. **Publishing**: David clicks "Publish Course". The course is immediately enrolled for all targeted employees according to role rules.

---

## Office Persona Simulation Matrix (R4 Specification)

The automated simulation suite (`npm run simulate` and within `npm test`) must programmatically instantiate and execute the three core personas, asserting exact database states at each stage:

| Persona Attribute | Persona 1: New Hire (Alex Rivera) | Persona 2: Senior Engineer (Elena Rostova) | Persona 3: Compliance Manager (Marcus Vance) |
|---|---|---|---|
| **Role** | `EMPLOYEE` | `EMPLOYEE` | `COMPLIANCE_OFFICER` |
| **Department** | Operations / Business Analysis | Engineering | Legal & Compliance |
| **Target Course** | Information Security & Workplace Safety (`course-sec-101`) | Production Safety & Secure Architecture (`course-eng-201`) | Organization-wide Compliance Audit (`all`) |
| **Initial State** | Enrollment: `NOT_STARTED`, Completed Modules: 0, Certificates: 0 | Enrollment: `IN_PROGRESS`, Completed Modules: 1, Certificates: 0 | Total Audited Records: > 10, Unverified: 0 |
| **Simulated Action 1** | Session initialization & dashboard query | Resume course viewer at Module 2 | Query compliance overview KPIs & department stats |
| **Simulated Action 2** | Read Module 1 markdown & advance | Review technical markdown & code snippets | Filter audit trail by department and status |
| **Simulated Action 3** | Watch Module 2 video & acknowledge policy | Submit technical quiz with 90% score | Run cryptographic SHA-256 integrity verification |
| **Simulated Action 4** | Submit 5-question quiz with 100% score | Verify passing status and audit log insertion | Generate CSV and JSON compliance audit exports |
| **Terminal State** | Enrollment: `COMPLETED`, QuizScore: 100%, Certificate Issued | Enrollment: `COMPLETED`, QuizScore: 90%, Audit Log Created | Exports successfully generated, Hash chain verified valid |
| **Invariants Asserted** | `enrollment.status === 'COMPLETED'`, `certificate.user_id === alex.id`, `audit_log.action === 'COURSE_COMPLETED'` | `quiz_submission.score >= 80`, `audit_log.module_version === 'v2.4'`, `audit_log.record_hash` valid | `export.rows.length > 0`, `hash_chain.isValid === true`, `tamper_check === PASS` |

---

## Acceptance Criteria & Verification Mapping

| Req ID | Requirement Area | Authoritative Acceptance Criteria (from ORIGINAL_REQUEST.md) | Concrete Verification Method |
|---|---|---|---|
| **AC-1** | Learner Dashboard | "Employee dashboard renders personalized active courses, deadlines, and progress with zero clutter." | Verify via UI inspection & automated component/route tests: dashboard renders active course cards, completion percentage bars, deadlines, and no extraneous legacy academic clutter. |
| **AC-2** | Course Viewer & Quizzes | "Course viewer supports interactive lessons, modular navigation, knowledge checks/quizzes, and instant feedback." | Verify course viewer loads markdown, handles video embeds, navigates between modules, and submits quiz answers with instant pass/fail feedback and score breakdown. |
| **AC-3** | Role-Based Access Control | "Role-Based Access Control cleanly separates Learner views from Admin/Manager dashboards." | Verify middleware & route guards: `EMPLOYEE` cannot access `/admin` or `/compliance` (returns 403 Forbidden); `COMPLIANCE_OFFICER` and `SUPER_ADMIN` have privileged access. |
| **AC-4** | Immutable Audit Logs | "Immutable completion audit logs record timestamp, user ID, module version, and score." | Query `AuditLogs` table after quiz completion: verify non-null `timestamp`, `user_id`, `module_version`, `score`, and cryptographic `record_hash`. |
| **AC-5** | Compliance Reporting & Export | "Compliance manager dashboard displays team-wide completion rates with CSV/JSON audit export." | Verify `/api/compliance/export?format=csv` and `?format=json` return valid RFC 4180 CSV with correct headers and JSON payload with audit records. |
| **AC-6** | Production Build Quality | "Production build (`npm run build`) compiles with zero TypeScript errors or broken routes." | Execute `npm run build` in working directory; verify exit code is 0 and no TypeScript/ESLint fatal errors occur. |
| **AC-7** | Relational Database Schema | "Database schema includes relations for Users, Roles, Courses, Modules, Enrollments, QuizSubmissions, and AuditLogs." | Inspect SQLite database schema / Prisma/Drizzle schema; verify tables, foreign keys, and relations for all 7 required entities + Certificates. |
| **AC-8** | Persona Simulation Runner | "Automated persona runner executes simulations for at least 3 distinct roles (New Hire, Engineer, Compliance Manager) and verifies state transitions." | Execute simulation runner (`npm run simulate` or test suite); assert all 3 persona simulation workflows complete green and output state transition logs. |
| **AC-9** | Automated Test Suite | "Test suite executes successfully (`npm test`) validating API endpoints, auth permissions, and quiz grading logic." | Run `npm test`; verify 100% passing tests for API endpoints, auth barriers, and grading algorithms. |

---

## Technical & Schema Interface Contracts

### 1. Database Entity Relationship Model (SQLite)
The following tables and relations are strictly required:

```
+--------------------+       +--------------------+
|       Users        |       |       Roles        |
+--------------------+       +--------------------+
| id (PK, TEXT/UUID) |<----->| id (PK, TEXT)      |
| email (UNIQUE)     |       | name (ENUM)        |
| name (TEXT)        |       | permissions (JSON) |
| role_id (FK)       |       +--------------------+
| department_id (FK) |
| created_at (DATETIME)
+--------------------+
        |
        +----------------------------------------+
        |                                        |
        v                                        v
+--------------------+                  +--------------------+
|    Enrollments     |                  |  QuizSubmissions   |
+--------------------+                  +--------------------+
| id (PK, TEXT/UUID) |                  | id (PK, TEXT/UUID) |
| user_id (FK)       |                  | user_id (FK)       |
| course_id (FK)     |                  | quiz_id (FK)       |
| status (ENUM)      |                  | module_id (FK)     |
| progress_pct (INT) |                  | score (INT)        |
| enrolled_at        |                  | passed (BOOLEAN)   |
| completed_at       |                  | answers (JSON)     |
| expires_at         |                  | submitted_at       |
+--------------------+                  +--------------------+
        |
        v
+--------------------+                  +--------------------+
|    Certificates    |                  |     AuditLogs      |
+--------------------+                  +--------------------+
| id (PK, TEXT/UUID) |                  | id (PK, TEXT/UUID) |
| certificate_num    |                  | timestamp          |
| enrollment_id (FK) |                  | user_id (FK)       |
| user_id (FK)       |                  | action (TEXT)      |
| course_id (FK)     |                  | module_version     |
| issued_at          |                  | score (INT, NULL)  |
| verification_hash  |                  | payload (JSON)     |
+--------------------+                  | prev_hash (TEXT)   |
                                        | record_hash (TEXT) |
                                        +--------------------+

+--------------------+       +--------------------+
|      Courses       |       |      Modules       |
+--------------------+       +--------------------+
| id (PK, TEXT/UUID) |<----->| id (PK, TEXT/UUID) |
| title (TEXT)       |       | course_id (FK)     |
| description (TEXT) |       | title (TEXT)       |
| category (TEXT)    |       | order_index (INT)  |
| is_mandatory (BOOL)|       | type (MARKDOWN/    |
| validity_days (INT)|       |       VIDEO/QUIZ)  |
| created_at         |       | content (TEXT/JSON)|
+--------------------+       | duration_mins (INT)|
                             +--------------------+
```

### 2. Core API Endpoint Signatures
- `GET /api/courses` — List courses available for current user.
- `GET /api/courses/[id]` — Retrieve course details with module outline and user enrollment status.
- `GET /api/courses/[id]/modules/[moduleId]` — Retrieve lesson content, markdown body, or quiz questions.
- `POST /api/courses/[id]/modules/[moduleId]/quiz` — Submit quiz answers; returns `{ score, passed, correctCount, totalCount, explanations }`.
- `GET /api/certificates/[id]` — Retrieve verifiable certificate details.
- `GET /api/compliance/stats` — Retrieve compliance rates, department breakdown, and overdue metrics (Manager / Compliance Officer / Super Admin).
- `GET /api/compliance/audit-logs` — Query audit logs with pagination and filters.
- `GET /api/compliance/export?format=csv|json` — Download audit data file.
- `POST /api/simulation/run` — Run persona simulation engine programmatically.

---

## Conclusion & Next Phase Integration

This survey report provides the complete, authoritative specification baseline extracted directly from `ORIGINAL_REQUEST.md` and enterprise LMS standards. It defines:
- 33 discrete features across 7 categories
- 14 distinct boundary conditions and edge cases
- 5 comprehensive user journeys with minute-by-minute step flows
- 3 office employee persona specifications with exact state invariant checks
- Database schema requirements and API signatures

This document serves as the direct reference specification for populating `PROJECT.md § Feature Inventory` and guiding Milestone M1 through M5 implementation and testing.
