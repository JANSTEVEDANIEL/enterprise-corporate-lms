# Test Infrastructure & Verification Architecture (TEST_INFRA.md)

## 1. Overview & Verification Philosophy

The Enterprise Corporate Learning Management System (LMS) test infrastructure is engineered to enforce uncompromising software quality, regulatory audit readiness, and cryptographic data integrity. The system utilizes an **opaque-box, multi-tier testing strategy** implemented using the modern Node.js v26 standard testing library (`node:test` and `node:assert/strict`) with TypeScript type stripping via `tsx` or native Node 26 loaders.

### Core Testing Tenets:
1. **Opaque-Box Verification**: Tests interact strictly through public interfaces, standard HTTP/API boundaries, domain service functions, and deterministic database queries. No internal private state hacking.
2. **Zero Facade / Anti-Cheat Guarantee**: All tests execute genuine domain logic, calculate mathematical SHA-256 hashes, evaluate answer keys against server-side schemas, and verify SQLite engine triggers. No hardcoded return values or hollow mocks.
3. **Progressive Testability & Isolation**: Tests run deterministically against isolated in-memory or dedicated test SQLite databases (`node:sqlite`). Each test suite creates its own pristine state, prevents cross-test pollution, and cleans up after execution.
4. **Authoritative Expected Output Derivation**: Every test assertion is derived from formal mathematical algorithms, cryptographic standards (SHA-256), regulatory compliance rules (OSHA / SOC 2 / HIPAA), or documented interface contracts in `PROJECT.md`.

---

## 2. Directory Layout & Test Suite Hierarchy

```
tests/
├── e2e/
│   ├── tier1-feature-coverage.test.ts   # Tier 1: Systematic feature coverage (>= 5 tests/feature)
│   ├── tier2-boundary-cases.test.ts     # Tier 2: Negative inputs, boundary thresholds, RBAC barriers
│   ├── tier3-cross-feature.test.ts      # Tier 3: Pairwise & multi-feature causal integration chains
│   └── tier4-real-world-scenarios.test.ts# Tier 4: Office employee persona simulations (Alex, Elena, Marcus)
├── integration/                         # Integration route & persistence tests
└── unit/                                # Micro-benchmarks for audit hashing, grading, RBAC guards
```

---

## 3. Test Runner & Execution Commands

### Prerequisites
- Runtime: Node.js `>= 22.5.0` (Environment: Node `v26.10.0`)
- TypeScript execution: `tsx` runner or Node.js native `--experimental-strip-types`

### Execution Matrix

| Test Suite / Scope | Command | Description |
| :--- | :--- | :--- |
| **All E2E Test Suites (Tiers 1-4)** | `npm test` or `npx tsx --test tests/e2e/*.test.ts` | Runs complete end-to-end test battery across all 4 tiers |
| **Tier 1: Feature Coverage** | `npx tsx --test tests/e2e/tier1-feature-coverage.test.ts` | Exercises 10 primary features with >= 5 tests per feature (50+ tests) |
| **Tier 2: Boundary & Corner Cases** | `npx tsx --test tests/e2e/tier2-boundary-cases.test.ts` | Negative inputs, pass/fail thresholds, RBAC 403 barriers, tamper detection |
| **Tier 3: Cross-Feature Chains** | `npx tsx --test tests/e2e/tier3-cross-feature.test.ts` | Multi-step lifecycle: Quiz -> Cert -> Audit -> Export; Expiry -> Dashboard |
| **Tier 4: Office Persona Flows** | `npx tsx --test tests/e2e/tier4-real-world-scenarios.test.ts` | End-to-end simulations for Alex Rivera, Elena Rostova, Marcus Vance |
| **Persona Simulation CLI** | `npm run simulate` | Standalone persona runner outputting formatted transition summaries |

---

## 4. Test Tiers Specification

### Tier 1: Feature Coverage (>= 5 Tests Per Feature)
Tests every primary feature listed in `PROJECT.md § Feature Inventory` with at least 5 distinct test cases:
1. **Auth & RBAC**: Session extraction, role hierarchy, employee restrictions, manager privileges, admin elevation.
2. **Single-Click Onboarding**: Welcome banner resolution, default enrollment generation, onboarding progress init at 0%, mandatory flag preservation, roadmaps.
3. **Clutter-Free Dashboard**: Active course listing, due date formatting, progress calculation, quick resume next-module resolution, zero-enrollment empty state handling.
4. **Bite-Sized Modular Lesson Player**: Chapter navigation order, breadcrumb generation, markdown formatting, video playback progress tracking, module completion transitions.
5. **Interactive Quizzes & Grading**: Answer key matching, pass mark calculation (>= 80%), instant feedback explanation generation, question option validation, score percentages.
6. **Quiz Retakes & Attempt History**: Chronological attempt recording, score updating on subsequent passes, failure preservation, attempt counter increments, cooldown limits.
7. **Automated Certificate Generation**: Unique serial ID formatting (`CERT-YYYY-...`), issuance upon 100% course completion + passing quiz, cryptographic verification token generation, public verification lookup, invalid token rejection.
8. **Compliance Renewal Engine**: Status calculation for `VALID`, `EXPIRING_SOON` (<= 30 days), `EXPIRED` (> renewalPeriodDays), `NOT_STARTED`, and renewal policy override.
9. **Tamper-Evident SHA-256 Hash Chaining**: Genesis hash linkage, consecutive record chaining, canonical JSON digest, SQLite engine trigger blocking `UPDATE`, engine trigger blocking `DELETE`.
10. **Compliance CSV & JSON Exports**: RFC 4180 CSV formatting, header presence, quotation/comma escaping, JSON manifest structure, department and date range filtering.

### Tier 2: Boundary Cases, Negative Inputs & Security Barriers
Exercises error handling, edge conditions, and security invariants:
- **Unanswered Quiz Questions**: Incomplete answer maps rejected with validation errors without consuming quiz attempts.
- **Empty / Malformed Payloads**: Blank answers, null fields, invalid option IDs safely rejected.
- **Passing Score Threshold Boundary**: Exactly 79% evaluates to `FAILED` (certificate blocked); exactly 80% evaluates to `PASSED` (certificate unlocked).
- **RBAC 403 Forbidden Barriers**: Employee attempts to access `/api/manager/team`, `/api/compliance/audit-logs`, or export routes receive strict HTTP 403 responses.
- **Compliance Date Boundaries**: Course completed 365 days ago vs 366 days ago; completed 334 days ago (31 days left = `VALID`) vs 335 days ago (30 days left = `EXPIRING_SOON`).
- **Tamper Detection Invariants**: Direct SQLite database modifications or severed previous hash links fail integrity verification and pinpoint the exact damaged row index.
- **Division-by-Zero Safety**: Users with zero enrollments or courses with zero completed modules render clean 0% percentages without runtime errors.
- **Input Sanitization**: Malicious script tags or SQL injection payloads in user fields or notes do not trigger execution or schema corruption.

### Tier 3: Cross-Feature Causal Chains
Validates multi-step, multi-subsystem integrations across the corporate lifecycle:
- **Chain 1: Quiz Pass -> Course Completion -> Certificate -> Audit Log -> Compliance Export**:
  Learner passes final quiz -> triggers course progress 100% -> auto-generates certificate -> writes chained SHA-256 audit record -> verifies record appears in exported CSV and JSON audit packages.
- **Chain 2: Failed Quiz -> Retake Recovery -> Certificate Unlock -> Dual Audit Entries**:
  Learner fails quiz (60%) -> progress blocked at incomplete -> cert blocked -> retake passes (100%) -> completion unlocked -> cert issued -> audit log stores both attempts in sequence with unbroken hash chain.
- **Chain 3: Compliance Expiry -> Status Transition -> Manager Dashboard Alert -> Notification Nudge**:
  Completed course crosses expiration threshold -> status transitions from `VALID` to `EXPIRED` -> manager dashboard flags employee as overdue -> manager triggers reminder nudge alert.
- **Chain 4: Manager Assignment -> Learner Dashboard -> Completion -> Manager KPI Update**:
  Manager assigns mandatory compliance track -> course card immediately surfaces on learner dashboard -> learner completes course -> manager dashboard reflects updated team completion percentage.

### Tier 4: Real-World Office Employee Persona Simulations
End-to-end synthetic flows simulating authentic enterprise users:
- **Persona 1: Alex Rivera (New Hire)**: Day-1 orientation journey, company policy markdown review, remote work video acknowledgment, 100% quiz completion, first verifiable certificate issuance.
- **Persona 2: Elena Rostova (Senior Engineer)**: High-velocity technical safety & secure coding module review, scenario-based quiz passing (90%), versioned audit logging (`v2.4`), 365-day compliance renewal scheduling.
- **Persona 3: Marcus Vance (Compliance Officer)**: Regulatory oversight inspection, department-level compliance heatmaps, cryptographic SHA-256 audit chain verification, RFC 4180 CSV export generation, and JSON audit proof generation for SOC 2 / OSHA auditing.

---

## 5. Authoritative Expected Output Specifications

### 5.1 Score & Grading Formula
$$\text{scorePct} = \left(\frac{\text{correctCount}}{\text{totalQuestions}}\right) \times 100$$
$$\text{passed} = \text{scorePct} \ge \text{passingScorePct (default 80\%)}$$

### 5.2 Cryptographic SHA-256 Audit Hash Chain Formula
$$\text{Genesis Hash} = \text{"0000000000000000000000000000000000000000000000000000000000000000"}$$
$$\text{Payload}_i = \text{CanonicalJSON}(\{id, \text{timestamp}, \text{actor\_id}, \text{actor\_role}, \text{action}, \text{target\_type}, \text{target\_id}, \text{module\_version}, \text{score}, \text{prev\_hash}\})$$
$$\text{RecordHash}_i = \text{SHA-256}(\text{Payload}_i)$$

### 5.3 Compliance Renewal Expiration Status Formula
$$\Delta_{\text{days}} = \left\lfloor \frac{\text{Now} - \text{CompletedAt}}{86400000} \right\rfloor$$
$$\text{DaysRemaining} = \text{RenewalPeriodDays} - \Delta_{\text{days}}$$
$$\text{Status} = \begin{cases}
\text{'NOT\_STARTED'}, & \text{if CompletedAt is null} \\
\text{'VALID'}, & \text{if RenewalPeriodDays is null} \\
\text{'EXPIRED'}, & \text{if DaysRemaining} < 0 \\
\text{'EXPIRING\_SOON'}, & \text{if } 0 \le \text{DaysRemaining} \le 30 \\
\text{'VALID'}, & \text{if DaysRemaining} > 30
\end{cases}$$

### 5.4 RFC 4180 CSV Export Specification
- Standard Header: `AuditID,Timestamp,UserID,EmployeeName,CourseID,CourseTitle,ModuleVersion,Score,Status,RecordHash`
- Character encoding: UTF-8
- Line endings: CRLF (`\r\n`) or LF (`\n`)
- Quoting: Fields containing commas, quotation marks, or line breaks must be enclosed in double quotes; existing double quotes escaped as `""`.

---

## 6. Independence & Isolation Architecture

To ensure tests are completely isolated and independent of file execution order:
1. Every test suite provisions a dedicated SQLite database instance using `createTestDb()` or isolated path (`.data/test-<timestamp>-<random>.db` or `:memory:`).
2. Tables, schemas, foreign keys, and WAL pragmas are instantiated fresh for the test run.
3. The deterministic test seeder populates standard enterprise personas (Alex, Elena, Sarah, Marcus, Admin) and baseline course fixtures.
4. Database connections are closed and temporary test database files are deleted in `after()` lifecycle hooks.
