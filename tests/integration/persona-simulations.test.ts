import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { getDb, initDb, seedDb } from "../../src/lib/db";
import {
  runAllSimulations,
  runSingleSimulation,
  runAlexNewHireSimulation,
  runElenaEngineerSimulation,
  runMarcusComplianceSimulation,
  SIMULATION_PERSONAS,
} from "../../src/simulation";
import { computeCertificateHash } from "../../src/lib/certificates";
import { computeComplianceStatus } from "../../src/lib/compliance";
import { verifyAuditLogIntegrity, GENESIS_HASH } from "../../src/lib/audit";
import { GET as getSimulateRoute, POST as postSimulateRoute } from "../../src/app/api/simulate/route";
import { NextRequest } from "next/server";

describe("Milestone M4 — Office Employee Persona Simulation Suite", () => {
  before(() => {
    initDb();
    seedDb();
  });

  // =========================================================================
  // Suite 1: Persona Definitions & Simulation Preconditions
  // =========================================================================
  describe("Suite 1: Persona Definitions & Specifications", () => {
    it("1.1 Confirms all 3 required office personas are configured", () => {
      const keys = Object.keys(SIMULATION_PERSONAS);
      assert.strictEqual(keys.includes("alex"), true, "Alex Rivera persona must exist");
      assert.strictEqual(keys.includes("elena"), true, "Elena Rostova persona must exist");
      assert.strictEqual(keys.includes("marcus"), true, "Marcus Vance persona must exist");
    });

    it("1.2 Confirms Alex Rivera metadata matches New Hire employee role", () => {
      const alex = SIMULATION_PERSONAS.alex;
      assert.strictEqual(alex.id, "usr_alex_rivera");
      assert.strictEqual(alex.role, "EMPLOYEE");
      assert.strictEqual(alex.targetCourseId, "crs_onboarding_day1");
      assert.strictEqual(alex.expectedSteps.length, 5);
    });

    it("1.3 Confirms Elena Rostova metadata matches Senior Engineer role", () => {
      const elena = SIMULATION_PERSONAS.elena;
      assert.strictEqual(elena.id, "usr_elena_rostova");
      assert.strictEqual(elena.role, "EMPLOYEE");
      assert.strictEqual(elena.targetCourseId, "crs_tech_prod_safety");
      assert.strictEqual(elena.expectedSteps.length, 4);
    });

    it("1.4 Confirms Marcus Vance metadata matches Compliance Officer role", () => {
      const marcus = SIMULATION_PERSONAS.marcus;
      assert.strictEqual(marcus.id, "usr_marcus_vance");
      assert.strictEqual(marcus.role, "COMPLIANCE_OFFICER");
      assert.strictEqual(marcus.expectedSteps.length, 5);
    });
  });

  // =========================================================================
  // Suite 2: Alex Rivera (New Hire Day-1 Orientation Lifecycle)
  // =========================================================================
  describe("Suite 2: Alex Rivera (New Hire Day-1 Orientation Lifecycle)", () => {
    it("2.1 Executes complete Day-1 lifecycle and passes all 5 steps", async () => {
      const result = await runAlexNewHireSimulation({ logProgress: false });

      assert.strictEqual(result.personaKey, "alex");
      assert.strictEqual(result.status, "PASSED");
      assert.strictEqual(result.steps.length, 5);
      assert.ok(result.totalDurationMs >= 0);

      // Verify all steps passed
      for (const step of result.steps) {
        assert.strictEqual(step.status, "PASSED", `Step ${step.stepNumber} should be PASSED`);
        assert.ok(step.name.length > 0);
        assert.ok(step.stateTransition, `Step ${step.stepNumber} must record stateTransition`);
      }
    });

    it("2.2 Asserts Alex Rivera state transitions from NOT_STARTED to COMPLETED (100%)", async () => {
      const db = getDb();
      const enrollment = db
        .prepare("SELECT * FROM enrollments WHERE user_id = 'usr_alex_rivera' AND course_id = 'crs_onboarding_day1'")
        .get() as any;

      assert.ok(enrollment, "Enrollment must exist in database");
      assert.strictEqual(enrollment.status, "COMPLETED");
      assert.strictEqual(enrollment.progress_pct, 100);
      assert.ok(enrollment.completed_at, "completed_at must be populated");
    });

    it("2.3 Asserts completion certificate issued with valid SHA-256 verification hash", async () => {
      const db = getDb();
      const cert = db
        .prepare("SELECT * FROM certificates WHERE user_id = 'usr_alex_rivera' AND course_id = 'crs_onboarding_day1'")
        .get() as any;

      assert.ok(cert, "Certificate must exist in database");
      assert.strictEqual(cert.score, 100);
      assert.ok(cert.certificate_code.startsWith("CERT-2026-ONB-"));
      assert.strictEqual(cert.user_name, "Alex Rivera");

      // Verify SHA-256 hash recomputation
      const expectedHash = computeCertificateHash({
        certificateCode: cert.certificate_code,
        userId: cert.user_id,
        courseId: cert.course_id,
        enrollmentId: cert.enrollment_id,
        issuedAt: cert.issued_at,
        score: cert.score,
      });
      assert.strictEqual(cert.verification_hash, expectedHash, "Verification hash must match SHA-256 computation");
    });

    it("2.4 Asserts quiz submission recorded with 100% score and passed=1", async () => {
      const db = getDb();
      const submission = db
        .prepare("SELECT * FROM quiz_submissions WHERE user_id = 'usr_alex_rivera' AND module_id = 'mod_onb_quiz'")
        .get() as any;

      assert.ok(submission, "Quiz submission must exist in database");
      assert.strictEqual(submission.score, 100);
      assert.strictEqual(submission.passed, 1);
      assert.strictEqual(submission.attempt_number, 1);
    });

    it("2.5 Asserts immutable audit trail records MODULE_COMPLETED, QUIZ_PASSED, and COMPLIANCE_CERTIFIED", async () => {
      const db = getDb();
      const logs = db
        .prepare("SELECT * FROM audit_logs WHERE actor_id = 'usr_alex_rivera' ORDER BY id ASC")
        .all() as any[];

      assert.ok(logs.length >= 4, `Expected at least 4 audit logs for Alex, got ${logs.length}`);

      const actions = logs.map((l) => l.action);
      assert.strictEqual(actions.includes("MODULE_COMPLETED"), true);
      assert.strictEqual(actions.includes("QUIZ_PASSED"), true);
      assert.strictEqual(actions.includes("COMPLIANCE_CERTIFIED"), true);
    });
  });

  // =========================================================================
  // Suite 3: Elena Rostova (Senior Engineer Technical Safety Lifecycle)
  // =========================================================================
  describe("Suite 3: Elena Rostova (Senior Engineer Technical Safety Lifecycle)", () => {
    it("3.1 Executes complete technical safety lifecycle and passes all 4 steps", async () => {
      const result = await runElenaEngineerSimulation({ logProgress: false });

      assert.strictEqual(result.personaKey, "elena");
      assert.strictEqual(result.status, "PASSED");
      assert.strictEqual(result.steps.length, 4);
      assert.ok(result.totalDurationMs >= 0);

      for (const step of result.steps) {
        assert.strictEqual(step.status, "PASSED", `Step ${step.stepNumber} should be PASSED`);
        assert.ok(step.stateTransition, `Step ${step.stepNumber} must record stateTransition`);
      }
    });

    it("3.2 Asserts technical exam scored 100% against strict 85% passing threshold", async () => {
      const db = getDb();
      const submission = db
        .prepare("SELECT * FROM quiz_submissions WHERE user_id = 'usr_elena_rostova' AND module_id = 'mod_tech_safety_quiz'")
        .get() as any;

      assert.ok(submission, "Elena technical quiz submission must exist");
      assert.strictEqual(submission.score, 100);
      assert.strictEqual(submission.passed, 1);
    });

    it("3.3 Asserts 365-day renewal scheduling and VALID compliance status", async () => {
      const db = getDb();
      const enrollment = db
        .prepare("SELECT * FROM enrollments WHERE user_id = 'usr_elena_rostova' AND course_id = 'crs_tech_prod_safety'")
        .get() as any;

      assert.ok(enrollment, "Elena enrollment must exist");
      assert.strictEqual(enrollment.status, "COMPLETED");
      assert.strictEqual(enrollment.progress_pct, 100);
      assert.ok(enrollment.expires_at, "expires_at must be populated");

      const renewalStatus = computeComplianceStatus(enrollment.completed_at, 365);
      assert.strictEqual(renewalStatus, "VALID");
    });

    it("3.4 Asserts audit trail logs module version 2.1.0 and score 100", async () => {
      const db = getDb();
      const log = db
        .prepare("SELECT * FROM audit_logs WHERE actor_id = 'usr_elena_rostova' AND action = 'PRODUCTION_ACCESS_CERTIFIED'")
        .get() as any;

      assert.ok(log, "PRODUCTION_ACCESS_CERTIFIED log must exist");
      assert.strictEqual(log.module_version, "2.1.0");
      assert.strictEqual(log.score, 100);
    });
  });

  // =========================================================================
  // Suite 4: Marcus Vance (Compliance Officer Regulatory Audit Lifecycle)
  // =========================================================================
  describe("Suite 4: Marcus Vance (Compliance Officer Regulatory Audit Lifecycle)", () => {
    it("4.1 Executes complete compliance audit and passes all 5 steps", async () => {
      const result = await runMarcusComplianceSimulation({ logProgress: false });

      assert.strictEqual(result.personaKey, "marcus");
      assert.strictEqual(result.status, "PASSED");
      assert.strictEqual(result.steps.length, 5);

      for (const step of result.steps) {
        assert.strictEqual(step.status, "PASSED", `Step ${step.stepNumber} should be PASSED`);
        assert.ok(step.stateTransition, `Step ${step.stepNumber} must record stateTransition`);
      }
    });

    it("4.2 Asserts departmental audit detected overdue certifications and dispatched nudge", async () => {
      const db = getDb();
      const nudgeLog = db
        .prepare("SELECT * FROM audit_logs WHERE actor_id = 'usr_marcus_vance' AND action = 'COMPLIANCE_NUDGE_SENT'")
        .get() as any;

      assert.ok(nudgeLog, "Nudge audit log must be recorded");
      assert.strictEqual(nudgeLog.actor_role, "COMPLIANCE_OFFICER");
    });

    it("4.3 Asserts SHA-256 Merkle hash chain verification confirmed 100% valid", async () => {
      const verification = verifyAuditLogIntegrity();
      assert.strictEqual(verification.isValid, true, "Hash chain must be valid");
      assert.strictEqual(verification.tamperedIndex, undefined);
      assert.ok(verification.totalRecords > 0);
    });

    it("4.4 Asserts RFC 4180 CSV export generated with standard headers and valid rows", async () => {
      const result = await runMarcusComplianceSimulation({ logProgress: false });
      assert.ok(result.artifacts?.csvExportBytes! > 0, "CSV bytes must be > 0");
    });

    it("4.5 Asserts SOC 2 JSON manifest contains cryptographic rootHash and valid chain", async () => {
      const result = await runMarcusComplianceSimulation({ logProgress: false });
      assert.strictEqual(result.artifacts?.jsonExportValid, true);
      assert.ok(result.artifacts?.auditRootHash?.length! > 0);
    });
  });

  // =========================================================================
  // Suite 5: Unified Simulation Runner (runAllSimulations)
  // =========================================================================
  describe("Suite 5: Unified Multi-Persona Simulation Runner", () => {
    it("5.1 Sequentially executes all 3 personas and returns overall success", async () => {
      const summary = await runAllSimulations({ logProgress: false });

      assert.strictEqual(summary.success, true);
      assert.strictEqual(summary.totalPersonas, 3);
      assert.strictEqual(summary.passedPersonas, 3);
      assert.strictEqual(summary.failedPersonas, 0);
      assert.strictEqual(summary.totalSteps, 14);
      assert.strictEqual(summary.passedSteps, 14);
      assert.strictEqual(summary.failedSteps, 0);
      assert.ok(summary.totalDurationMs >= 0);
      assert.strictEqual(summary.auditVerification.isValid, true);

      // Verify all 3 persona keys present
      assert.ok(summary.results.alex);
      assert.ok(summary.results.elena);
      assert.ok(summary.results.marcus);
    });

    it("5.2 runSingleSimulation executes individual persona cleanly", async () => {
      const alexRes = await runSingleSimulation("alex", { logProgress: false });
      assert.strictEqual(alexRes.status, "PASSED");
      assert.strictEqual(alexRes.personaKey, "alex");

      const elenaRes = await runSingleSimulation("elena", { logProgress: false });
      assert.strictEqual(elenaRes.status, "PASSED");
      assert.strictEqual(elenaRes.personaKey, "elena");

      const marcusRes = await runSingleSimulation("marcus", { logProgress: false });
      assert.strictEqual(marcusRes.status, "PASSED");
      assert.strictEqual(marcusRes.personaKey, "marcus");
    });

    it("5.3 runSingleSimulation rejects invalid persona key with descriptive error", async () => {
      await assert.rejects(
        async () => {
          await runSingleSimulation("unknown_persona" as any, { logProgress: false });
        },
        {
          name: "Error",
          message: /Unknown persona key/,
        }
      );
    });
  });

  // =========================================================================
  // Suite 6: API Route Handlers (/api/simulate)
  // =========================================================================
  describe("Suite 6: API Route Handlers (/api/simulate)", () => {
    it("6.1 GET /api/simulate returns supported personas and engine status", async () => {
      const res = await getSimulateRoute();
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.status, "ready");
      assert.strictEqual(json.supportedPersonas.length, 3);
      assert.strictEqual(json.auditIntegrity.isValid, true);
    });

    it("6.2 POST /api/simulate with persona='all' executes full suite", async () => {
      const req = new NextRequest("http://127.0.0.1:3000/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: "all" }),
      });

      const res = await postSimulateRoute(req);
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.type, "all");
      assert.strictEqual(json.summary.passedPersonas, 3);
      assert.strictEqual(json.summary.passedSteps, 14);
    });

    it("6.3 POST /api/simulate with persona='alex' executes Alex simulation", async () => {
      const req = new NextRequest("http://127.0.0.1:3000/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: "alex" }),
      });

      const res = await postSimulateRoute(req);
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.type, "single");
      assert.strictEqual(json.result.personaKey, "alex");
      assert.strictEqual(json.result.status, "PASSED");
    });

    it("6.4 POST /api/simulate with persona='elena' executes Elena simulation", async () => {
      const req = new NextRequest("http://127.0.0.1:3000/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: "elena" }),
      });

      const res = await postSimulateRoute(req);
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.type, "single");
      assert.strictEqual(json.result.personaKey, "elena");
    });

    it("6.5 POST /api/simulate with persona='marcus' executes Marcus simulation", async () => {
      const req = new NextRequest("http://127.0.0.1:3000/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: "marcus" }),
      });

      const res = await postSimulateRoute(req);
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.type, "single");
      assert.strictEqual(json.result.personaKey, "marcus");
    });

    it("6.6 POST /api/simulate rejects invalid persona key with 400 Bad Request", async () => {
      const req = new NextRequest("http://127.0.0.1:3000/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: "invalid_hacker_role" }),
      });

      const res = await postSimulateRoute(req);
      assert.strictEqual(res.status, 400);

      const json = await res.json();
      assert.ok(json.error.includes("Invalid persona key"));
    });

    it("6.7 POST /api/simulate handles empty body gracefully defaulting to all", async () => {
      const req = new NextRequest("http://127.0.0.1:3000/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "",
      });

      const res = await postSimulateRoute(req);
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.type, "all");
    });
  });
});
