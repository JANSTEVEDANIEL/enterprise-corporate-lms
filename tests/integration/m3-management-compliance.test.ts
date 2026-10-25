import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { getDb, initDb, seedDb } from "../../src/lib/db";
import { verifyAuditLogIntegrity } from "../../src/lib/audit";
import { GET as getTeamRoute } from "../../src/app/api/manager/team/route";
import { POST as postNudgeRoute } from "../../src/app/api/manager/nudge/route";
import { GET as getComplianceStatsRoute } from "../../src/app/api/compliance/stats/route";
import { GET as getAuditLogsRoute } from "../../src/app/api/compliance/audit-logs/route";
import { POST as verifyAuditRoute } from "../../src/app/api/compliance/verify-audit/route";
import { GET as exportCsvRoute } from "../../src/app/api/compliance/export/csv/route";
import { GET as exportJsonRoute } from "../../src/app/api/compliance/export/json/route";
import { GET as getAdminUsersRoute, POST as postAdminUserRoute } from "../../src/app/api/admin/users/route";
import { PATCH as patchAdminUserRoute } from "../../src/app/api/admin/users/[userId]/route";
import { POST as postAdminCourseRoute } from "../../src/app/api/admin/courses/route";
import { POST as postAdminAssignRoute } from "../../src/app/api/admin/assign/route";

describe("Milestone M3 — Management, Compliance, Audit Trail & Administration Integration", () => {
  before(() => {
    initDb();
    seedDb();
  });

  after(() => {
    delete process.env.LMS_ACTIVE_USER_ID;
  });

  // =========================================================================
  // 1. Manager Team Compliance Dashboard API
  // =========================================================================
  describe("1. Manager Team Dashboard API (GET /api/manager/team)", () => {
    it("1.1 Sarah Jenkins (MANAGER) retrieves direct reports roster with completion metrics", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_sarah_jenkins";
      const req = new NextRequest("http://localhost:3000/api/manager/team");
      const res = await getTeamRoute(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.manager.id, "usr_sarah_jenkins");
      assert.strictEqual(data.stats.totalReports, 2); // Alex Rivera & Elena Rostova

      const reportNames = data.directReports.map((r: any) => r.name);
      assert.ok(reportNames.includes("Alex Rivera"));
      assert.ok(reportNames.includes("Elena Rostova"));

      // Alex Rivera has overdue training on OSHA
      const alex = data.directReports.find((r: any) => r.id === "usr_alex_rivera");
      assert.ok(alex, "Alex Rivera must be in direct reports");
      assert.strictEqual(alex.hasOverdue, true);
      assert.strictEqual(alex.status, "OVERDUE");

      // Elena Rostova has 100% completion
      const elena = data.directReports.find((r: any) => r.id === "usr_elena_rostova");
      assert.ok(elena, "Elena Rostova must be in direct reports");
      assert.strictEqual(elena.hasOverdue, false);
      assert.strictEqual(elena.status, "COMPLIANT");
    });

    it("1.2 Blocks EMPLOYEE (Alex Rivera) from accessing manager team API with 403 Forbidden", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_alex_rivera";
      const req = new NextRequest("http://localhost:3000/api/manager/team");
      const res = await getTeamRoute(req);
      assert.strictEqual(res.status, 403);

      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error, /Forbidden/);
    });
  });

  // =========================================================================
  // 2. Manager Nudge / Reminder API
  // =========================================================================
  describe("2. Manager Nudge API (POST /api/manager/nudge)", () => {
    it("2.1 Rejects missing employeeId with 400 Bad Request", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_sarah_jenkins";
      const req = new NextRequest("http://localhost:3000/api/manager/nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res = await postNudgeRoute(req);
      assert.strictEqual(res.status, 400);

      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error, /employeeId is required/);
    });

    it("2.2 Rejects non-existent employeeId with 404 Not Found", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_sarah_jenkins";
      const req = new NextRequest("http://localhost:3000/api/manager/nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: "usr_non_existent_999" }),
      });
      const res = await postNudgeRoute(req);
      assert.strictEqual(res.status, 404);

      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error, /Employee not found/);
    });

    it("2.3 Sarah Jenkins successfully triggers a reminder nudge to Alex Rivera on overdue course", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_sarah_jenkins";
      const req = new NextRequest("http://localhost:3000/api/manager/nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: "usr_alex_rivera",
          courseId: "crs_comp_osha",
          message: "Please complete mandatory OSHA safety training immediately.",
        }),
      });
      const res = await postNudgeRoute(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.match(data.message, /Nudge reminder successfully sent/);
      assert.ok(data.auditLogId);
      assert.ok(data.recordHash);
      assert.strictEqual(data.recordHash.length, 64);

      // Verify audit log record exists in database
      const db = getDb();
      const audit = db.prepare("SELECT * FROM audit_logs WHERE id = ?").get(data.auditLogId) as any;
      assert.ok(audit);
      assert.strictEqual(audit.action, "NUDGE_SENT");
      assert.strictEqual(audit.actor_id, "usr_sarah_jenkins");
      assert.strictEqual(audit.target_id, "usr_alex_rivera");
    });

    it("2.4 Blocks non-manager EMPLOYEE from triggering nudges with 403 Forbidden", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_alex_rivera";
      const req = new NextRequest("http://localhost:3000/api/manager/nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: "usr_elena_rostova" }),
      });
      const res = await postNudgeRoute(req);
      assert.strictEqual(res.status, 403);
    });
  });

  // =========================================================================
  // 3. Compliance Control Center API & Regulation Breakdown
  // =========================================================================
  describe("3. Compliance Stats & Regulation Breakdown (GET /api/compliance/stats)", () => {
    it("3.1 Marcus Vance (COMPLIANCE_OFFICER) retrieves org-wide compliance KPIs and regulations", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_marcus_vance";
      const req = new NextRequest("http://localhost:3000/api/compliance/stats");
      const res = await getComplianceStatsRoute(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.stats);
      assert.ok(typeof data.stats.overallComplianceRate === "number");
      assert.ok(data.stats.totalEnrollments >= 6);
      assert.ok(data.stats.certificatesIssued >= 2);
      assert.ok(data.stats.auditLogsCount >= 10);

      // Check regulation breakdown
      const regs = data.stats.regulations;
      assert.ok(regs.SOC2, "SOC2 regulation must be present");
      assert.ok(regs.OSHA, "OSHA regulation must be present");
      assert.ok(regs.HIPAA, "HIPAA regulation must be present");
      assert.ok(regs.ANTI_HARASSMENT, "ANTI_HARASSMENT regulation must be present");

      assert.ok(typeof regs.SOC2.rate === "number");
      assert.ok(["HEALTHY", "WARNING"].includes(regs.SOC2.status));
    });

    it("3.2 Blocks EMPLOYEE from compliance stats endpoint with 403 Forbidden", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_alex_rivera";
      const req = new NextRequest("http://localhost:3000/api/compliance/stats");
      const res = await getComplianceStatsRoute(req);
      assert.strictEqual(res.status, 403);
    });
  });

  // =========================================================================
  // 4. Live Audit Logs API
  // =========================================================================
  describe("4. Live Audit Logs API (GET /api/compliance/audit-logs)", () => {
    it("4.1 Marcus Vance retrieves paginated audit logs with total count", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_marcus_vance";
      const req = new NextRequest("http://localhost:3000/api/compliance/audit-logs?limit=10&offset=0");
      const res = await getAuditLogsRoute(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.records.length > 0);
      assert.ok(data.totalCount >= data.records.length);

      const first = data.records[0];
      assert.ok(first.record_hash);
      assert.strictEqual(first.record_hash.length, 64);
      assert.ok(first.prev_hash);
      assert.strictEqual(first.prev_hash.length, 64);
    });

    it("4.2 Filters audit logs by action", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_marcus_vance";
      const req = new NextRequest("http://localhost:3000/api/compliance/audit-logs?action=NUDGE_SENT");
      const res = await getAuditLogsRoute(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      for (const rec of data.records) {
        assert.strictEqual(rec.action, "NUDGE_SENT");
      }
    });

    it("4.3 Blocks EMPLOYEE from viewing audit logs with 403 Forbidden", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_alex_rivera";
      const req = new NextRequest("http://localhost:3000/api/compliance/audit-logs");
      const res = await getAuditLogsRoute(req);
      assert.strictEqual(res.status, 403);
    });
  });

  // =========================================================================
  // 5. Cryptographic Merkle Chain Verification API
  // =========================================================================
  describe("5. Cryptographic Merkle Chain Verification API (POST /api/compliance/verify-audit)", () => {
    it("5.1 Executes live SHA-256 Merkle chain verification returning intact status", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_marcus_vance";
      const req = new NextRequest("http://localhost:3000/api/compliance/verify-audit", { method: "POST" });
      const res = await verifyAuditRoute(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.isValid, true);
      assert.strictEqual(data.chainStatus, "INTACT");
      assert.ok(data.totalRecords >= 10);
      assert.ok(data.firstTimestamp);
      assert.ok(data.lastTimestamp);
      assert.strictEqual(data.verifiedBy, "Marcus Vance");
    });
  });

  // =========================================================================
  // 6. Regulatory CSV & JSON Export APIs
  // =========================================================================
  describe("6. Regulatory CSV & JSON Export APIs", () => {
    it("6.1 GET /api/compliance/export/csv returns RFC 4180 CSV attachment", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_marcus_vance";
      const req = new NextRequest("http://localhost:3000/api/compliance/export/csv");
      const res = await exportCsvRoute(req);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get("Content-Type"), "text/csv; charset=utf-8");
      assert.ok(res.headers.get("Content-Disposition")?.includes("attachment; filename="));

      const csvText = await res.text();
      assert.ok(csvText.startsWith("AuditID,Timestamp,UserID,EmployeeName,Action,CourseID,TargetID,ModuleVersion,Score,RecordHash"));
      const lines = csvText.split("\r\n");
      assert.ok(lines.length >= 10);
    });

    it("6.2 GET /api/compliance/export/json returns structured cryptographic JSON attachment", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_marcus_vance";
      const req = new NextRequest("http://localhost:3000/api/compliance/export/json");
      const res = await exportJsonRoute(req);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get("Content-Type"), "application/json; charset=utf-8");

      const jsonText = await res.text();
      const parsed = JSON.parse(jsonText);
      assert.strictEqual(parsed.isChainValid, true);
      assert.ok(parsed.totalRecords >= 10);
      assert.ok(parsed.rootHash);
      assert.strictEqual(parsed.rootHash.length, 64);
      assert.ok(parsed.records.length >= 10);
    });
  });

  // =========================================================================
  // 7. Admin User Administration & Role Updates
  // =========================================================================
  describe("7. Admin User Administration & Role Updates", () => {
    let testProvisionedUserId: string;

    it("7.1 David Kim (SUPER_ADMIN) retrieves all users with manager names and metrics", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_david_kim";
      const req = new NextRequest("http://localhost:3000/api/admin/users");
      const res = await getAdminUsersRoute(req);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.users.length >= 5);
      assert.ok(data.managers.length >= 3);
    });

    it("7.2 Super Admin provisions a new corporate employee and records USER_PROVISIONED audit log", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_david_kim";
      const newEmail = `dev.tester.${Date.now()}@enterprise.corp`;
      const req = new NextRequest("http://localhost:3000/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Devon Clark",
          email: newEmail,
          role: "EMPLOYEE",
          department: "Security",
          jobTitle: "Security Analyst",
          managerId: "usr_marcus_vance",
        }),
      });
      const res = await postAdminUserRoute(req);
      assert.strictEqual(res.status, 201);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.user.name, "Devon Clark");
      assert.strictEqual(data.user.email, newEmail);
      testProvisionedUserId = data.user.id;

      // Verify audit log
      const db = getDb();
      const audit = db.prepare("SELECT * FROM audit_logs WHERE action = 'USER_PROVISIONED' AND target_id = ?").get(testProvisionedUserId) as any;
      assert.ok(audit, "Must record USER_PROVISIONED audit log");
      assert.strictEqual(audit.actor_id, "usr_david_kim");
    });

    it("7.3 Rejects duplicate email address with 409 Conflict", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_david_kim";
      const req = new NextRequest("http://localhost:3000/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Duplicate Test",
          email: "alex.rivera@enterprise.corp", // existing email
          role: "EMPLOYEE",
          department: "Engineering",
          jobTitle: "Software Engineer",
        }),
      });
      const res = await postAdminUserRoute(req);
      assert.strictEqual(res.status, 409);
    });

    it("7.4 Super Admin updates employee role and department via PATCH /api/admin/users/[userId]", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_david_kim";
      const req = new NextRequest(`http://localhost:3000/api/admin/users/${testProvisionedUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "MANAGER",
          department: "Security Operations",
          jobTitle: "Senior Security Lead",
        }),
      });
      const res = await patchAdminUserRoute(req, {
        params: Promise.resolve({ userId: testProvisionedUserId }),
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.user.role, "MANAGER");
      assert.strictEqual(data.user.department, "Security Operations");

      // Verify audit log
      const db = getDb();
      const audit = db.prepare("SELECT * FROM audit_logs WHERE action = 'USER_UPDATED' AND target_id = ?").get(testProvisionedUserId) as any;
      assert.ok(audit, "Must record USER_UPDATED audit log");
    });

    it("7.5 Blocks non-admin (Sarah Jenkins - MANAGER) from provisioning users with 403 Forbidden", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_sarah_jenkins";
      const req = new NextRequest("http://localhost:3000/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Unauthorized User",
          email: "unauth@enterprise.corp",
          role: "EMPLOYEE",
          department: "Engineering",
          jobTitle: "Engineer",
        }),
      });
      const res = await postAdminUserRoute(req);
      assert.strictEqual(res.status, 403);
    });
  });

  // =========================================================================
  // 8. Admin Course Authoring & Assignment
  // =========================================================================
  describe("8. Admin Course Authoring & Assignment", () => {
    let authoredCourseId: string;

    it("8.1 Super Admin authors new course via POST /api/admin/courses and records audit log", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_david_kim";
      const uniqueSlug = `crypto-mgmt-${Date.now()}`;
      const req = new NextRequest("http://localhost:3000/api/admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Cryptographic Key Management & HSM Operations",
          slug: uniqueSlug,
          description: "Protocols for managing hardware security modules and root keys.",
          category: "SECURITY",
          targetRole: "SECURITY",
          isMandatory: 1,
          estimatedMinutes: 60,
          renewalPeriodDays: 180,
          passingScorePct: 90,
          modules: [
            {
              title: "Module 1: HSM Architecture",
              content: "# HSM Setup\n\nHardware security modules isolate key material.",
              estimatedMinutes: 30,
            },
          ],
        }),
      });
      const res = await postAdminCourseRoute(req);
      assert.strictEqual(res.status, 201);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.course.slug, uniqueSlug);
      authoredCourseId = data.course.id;

      // Verify audit log
      const db = getDb();
      const audit = db.prepare("SELECT * FROM audit_logs WHERE action = 'COURSE_CREATED' AND target_id = ?").get(authoredCourseId) as any;
      assert.ok(audit, "Must record COURSE_CREATED audit log");
      assert.strictEqual(audit.actor_id, "usr_david_kim");
    });

    it("8.2 Manager assigns course to employee via POST /api/admin/assign and records audit log", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_sarah_jenkins";
      const req = new NextRequest("http://localhost:3000/api/admin/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "usr_alex_rivera",
          courseId: authoredCourseId,
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      });
      const res = await postAdminAssignRoute(req);
      assert.strictEqual(res.status, 201);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.enrollment);
      assert.strictEqual(data.enrollment.user_id, "usr_alex_rivera");
      assert.strictEqual(data.enrollment.course_id, authoredCourseId);

      // Verify audit log
      const db = getDb();
      const audit = db.prepare("SELECT * FROM audit_logs WHERE action = 'COURSE_ASSIGNED' AND course_id = ?").get(authoredCourseId) as any;
      assert.ok(audit, "Must record COURSE_ASSIGNED audit log");
      assert.strictEqual(audit.actor_id, "usr_sarah_jenkins");
    });

    it("8.3 Final cryptographic integrity check confirms hash chain is unbroken after all operations", () => {
      const result = verifyAuditLogIntegrity();
      assert.strictEqual(result.isValid, true, "Hash chain must remain valid after all M3 actions");
      assert.strictEqual(result.failureReason, undefined);
      assert.ok(result.totalRecords >= 5, `Expected >= 5 audit records, found ${result.totalRecords}`);
    });
  });
});
