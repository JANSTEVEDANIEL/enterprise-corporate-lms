import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeComplianceStatus,
  getEnrollmentComplianceStatus,
  evaluateOrgCompliance,
  generateAuditCsv,
  generateAuditJson,
} from "../../src/lib/compliance";
import { GENESIS_HASH } from "../../src/lib/audit";
import type { AuditLogRecord } from "../../src/types";

describe("Unit Tests: Compliance Renewal Engine & Export Utilities", () => {
  // =========================================================================
  // 1. computeComplianceStatus State Transitions
  // =========================================================================
  describe("1. computeComplianceStatus", () => {
    it("1.1 Returns NOT_STARTED when completion timestamp is null or empty", () => {
      assert.strictEqual(computeComplianceStatus(null, 365), "NOT_STARTED");
      assert.strictEqual(computeComplianceStatus(null, null), "NOT_STARTED");
    });

    it("1.2 Returns VALID for non-expiring courses (renewalPeriodDays is null or 0)", () => {
      const pastDate = "2020-01-01T00:00:00Z";
      assert.strictEqual(computeComplianceStatus(pastDate, null), "VALID");
      assert.strictEqual(computeComplianceStatus(pastDate, 0), "VALID");
      assert.strictEqual(computeComplianceStatus(pastDate, -1), "VALID");
    });

    it("1.3 Returns VALID for newly completed compliance training (more than 30 days remaining)", () => {
      const refDate = new Date("2026-10-25T12:00:00Z");
      // Completed 100 days ago on a 365-day renewal policy -> 265 days remaining
      const completedDate = new Date(refDate.getTime() - 100 * 24 * 60 * 60 * 1000).toISOString();
      assert.strictEqual(computeComplianceStatus(completedDate, 365, refDate), "VALID");
    });

    it("1.4 Returns EXPIRING_SOON when exactly 30 days remain before renewal deadline", () => {
      const refDate = new Date("2026-10-25T12:00:00Z");
      // Completed 335 days ago on a 365-day renewal policy -> exactly 30 days remaining
      const completedDate = new Date(refDate.getTime() - 335 * 24 * 60 * 60 * 1000).toISOString();
      assert.strictEqual(computeComplianceStatus(completedDate, 365, refDate), "EXPIRING_SOON");
    });

    it("1.5 Returns EXPIRING_SOON when 1 day remains before renewal deadline", () => {
      const refDate = new Date("2026-10-25T12:00:00Z");
      // Completed 364 days ago on a 365-day renewal policy -> 1 day remaining
      const completedDate = new Date(refDate.getTime() - 364 * 24 * 60 * 60 * 1000).toISOString();
      assert.strictEqual(computeComplianceStatus(completedDate, 365, refDate), "EXPIRING_SOON");
    });

    it("1.6 Returns EXPIRING_SOON on day 0 of expiration (exact deadline date)", () => {
      const refDate = new Date("2026-10-25T12:00:00Z");
      // Completed 365 days ago on a 365-day renewal policy -> 0 days remaining
      const completedDate = new Date(refDate.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
      assert.strictEqual(computeComplianceStatus(completedDate, 365, refDate), "EXPIRING_SOON");
    });

    it("1.7 Returns EXPIRED when remaining validity is less than 0 (past deadline)", () => {
      const refDate = new Date("2026-10-25T12:00:00Z");
      // Completed 366 days ago on a 365-day renewal policy -> -1 days remaining
      const completedDate = new Date(refDate.getTime() - 366 * 24 * 60 * 60 * 1000).toISOString();
      assert.strictEqual(computeComplianceStatus(completedDate, 365, refDate), "EXPIRED");
    });
  });

  // =========================================================================
  // 2. getEnrollmentComplianceStatus
  // =========================================================================
  describe("2. getEnrollmentComplianceStatus", () => {
    it("2.1 Accurately evaluates uncompleted enrollment with future due date", () => {
      const refDate = new Date("2026-10-25T12:00:00Z");
      const dueDate = new Date(refDate.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString();

      const evaluation = getEnrollmentComplianceStatus(
        {
          status: "NOT_STARTED",
          completed_at: null,
          due_date: dueDate,
          renewal_period_days: 365,
        },
        refDate
      );

      assert.strictEqual(evaluation.status, "NOT_STARTED");
      assert.strictEqual(evaluation.isOverdue, false);
      assert.strictEqual(evaluation.daysRemaining, 15);
    });

    it("2.2 Flags uncompleted enrollment as overdue when due date has passed", () => {
      const refDate = new Date("2026-10-25T12:00:00Z");
      const pastDueDate = new Date(refDate.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();

      const evaluation = getEnrollmentComplianceStatus(
        {
          status: "IN_PROGRESS",
          completed_at: null,
          due_date: pastDueDate,
          renewal_period_days: 365,
        },
        refDate
      );

      assert.strictEqual(evaluation.status, "EXPIRED");
      assert.strictEqual(evaluation.isOverdue, true);
      assert.ok(evaluation.daysRemaining! < 0);
    });

    it("2.3 Flags enrollment with status='OVERDUE' explicitly as overdue", () => {
      const evaluation = getEnrollmentComplianceStatus({
        status: "OVERDUE",
        completed_at: null,
      });

      assert.strictEqual(evaluation.isOverdue, true);
    });
  });

  // =========================================================================
  // 3. RFC 4180 CSV Export Generation
  // =========================================================================
  describe("3. RFC 4180 CSV Export Generator", () => {
    it("3.1 Returns standard header row for empty record sets", () => {
      const csv = generateAuditCsv([]);
      assert.strictEqual(
        csv,
        "AuditID,Timestamp,UserID,EmployeeName,Action,CourseID,TargetID,ModuleVersion,Score,RecordHash"
      );
    });

    it("3.2 Generates valid rows and escapes special characters like commas, quotes, and newlines", () => {
      const records: AuditLogRecord[] = [
        {
          id: 1,
          uuid: "u-1",
          timestamp: "2026-10-25T12:00:00.000Z",
          actor_id: "usr_sarah_jenkins",
          actor_role: "MANAGER",
          actor_name: 'Jenkins, Sarah "Lead"',
          action: "NUDGE_SENT",
          target_type: "USER",
          target_id: "usr_alex_rivera",
          course_id: "crs_comp_osha",
          module_id: null,
          module_version: "1.0.0",
          score: null,
          metadata: '{"message":"Line 1\nLine 2"}',
          prev_hash: "0000000000000000000000000000000000000000000000000000000000000000",
          record_hash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        },
      ];

      const csv = generateAuditCsv(records);
      const lines = csv.split("\r\n");
      assert.strictEqual(lines.length, 2);

      // Verify header
      assert.strictEqual(lines[0].startsWith("AuditID,Timestamp,UserID"), true);

      // Verify escaping
      assert.ok(csv.includes('"Jenkins, Sarah ""Lead"""'), "Escapes internal quotes and handles comma");
      assert.ok(csv.includes("crs_comp_osha"));
      assert.ok(csv.includes("usr_alex_rivera"));
      assert.ok(csv.includes("abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"));
    });
  });

  // =========================================================================
  // 4. Structured JSON Export Generation
  // =========================================================================
  describe("4. Structured Cryptographic JSON Export Generator", () => {
    it("4.1 Generates JSON payload with rootHash and verification metadata", () => {
      const records: AuditLogRecord[] = [
        {
          id: 1,
          uuid: "u-1",
          timestamp: "2026-10-25T12:00:00.000Z",
          actor_id: "usr_david_kim",
          actor_role: "SUPER_ADMIN",
          actor_name: "David Kim",
          action: "SYSTEM_INITIALIZED",
          target_type: "SYSTEM",
          target_id: "lms_core",
          prev_hash: GENESIS_HASH,
          record_hash: "1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff",
        },
      ];

      const jsonStr = generateAuditJson(records);
      const parsed = JSON.parse(jsonStr);

      assert.strictEqual(parsed.totalRecords, 1);
      assert.strictEqual(parsed.genesisHash, GENESIS_HASH);
      assert.strictEqual(parsed.rootHash, "1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff");
      assert.strictEqual(parsed.records.length, 1);
      assert.ok(parsed.exportMetadata);
      assert.strictEqual(parsed.exportMetadata.totalRecords, 1);
    });
  });
});
