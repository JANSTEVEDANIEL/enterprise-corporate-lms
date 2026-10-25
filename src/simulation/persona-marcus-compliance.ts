import { getDb, initDb } from "@/lib/db";
import {
  evaluateOrgCompliance,
  generateAuditCsv,
  generateAuditJson,
  getEnrollmentComplianceStatus,
} from "@/lib/compliance";
import { recordAuditEvent, verifyAuditLogIntegrity, GENESIS_HASH } from "@/lib/audit";
import type { AuditLogRecord } from "@/types";
import {
  SIMULATION_PERSONAS,
  type PersonaSimulationResult,
  type SimulationOptions,
  type SimulationStepResult,
} from "./personas";

export async function runMarcusComplianceSimulation(
  options?: SimulationOptions
): Promise<PersonaSimulationResult> {
  const startTime = Date.now();
  if (!options?.db) {
    initDb();
  }
  const db = options?.db || getDb();
  const persona = SIMULATION_PERSONAS.marcus;
  const steps: SimulationStepResult[] = [];
  const log = options?.logger || (options?.logProgress ? console.log : () => {});

  const marcusId = persona.id;
  let csvExportBytes = 0;
  let jsonExportBytes = 0;
  let rootHash: string | undefined;

  try {
    // ========================================================================
    // Step 1: Session Init as Compliance Officer & Executive KPI Assessment
    // ========================================================================
    const s1Start = Date.now();
    log(`[Marcus Vance] Step 1: Initializing Compliance Officer session & evaluating organization KPIs...`);

    const marcus = db.prepare("SELECT * FROM users WHERE id = ?").get(marcusId) as any;
    if (!marcus) {
      throw new Error(`User '${marcusId}' not found in database`);
    }
    if (marcus.role !== "COMPLIANCE_OFFICER") {
      throw new Error(`Expected role COMPLIANCE_OFFICER for Marcus Vance, got '${marcus.role}'`);
    }

    const orgSummary = evaluateOrgCompliance(db);
    if (orgSummary.totalEmployees <= 0) {
      throw new Error("Expected active employee headcount > 0");
    }

    steps.push({
      stepNumber: 1,
      name: "Session Init as Compliance Officer & Executive KPI Assessment",
      description: `Authenticated Marcus Vance (COMPLIANCE_OFFICER); assessed organization compliance rate: ${orgSummary.overallComplianceRate}% across ${orgSummary.totalEmployees} employees`,
      status: "PASSED",
      durationMs: Date.now() - s1Start,
      stateTransition: {
        entity: "Marcus Vance Session",
        from: "Unauthenticated",
        to: "Authenticated (COMPLIANCE_OFFICER)",
        metadata: {
          overallComplianceRate: orgSummary.overallComplianceRate,
          totalEmployees: orgSummary.totalEmployees,
          certificatesIssued: orgSummary.certificatesIssued,
        },
      },
      details: {
        userId: marcusId,
        userName: marcus.name,
        role: marcus.role,
        department: marcus.department,
        overallRate: orgSummary.overallComplianceRate,
        totalEmployees: orgSummary.totalEmployees,
        certificatesIssued: orgSummary.certificatesIssued,
        totalEnrollments: orgSummary.totalEnrollments,
      },
    });

    // ========================================================================
    // Step 2: Department Breakdown Analysis & Overdue Credential Detection
    // ========================================================================
    const s2Start = Date.now();
    log(`[Marcus Vance] Step 2: Auditing department breakdown and scanning for overdue credentials...`);

    const enrollments = db.prepare(`
      SELECT e.*, c.title as course_title, c.renewal_period_days, u.name as employee_name, u.department
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      JOIN users u ON u.id = e.user_id
    `).all() as any[];

    const departmentStats: Record<string, { total: number; compliant: number; overdue: number }> = {};
    const overdueList: Array<{ employeeId: string; employeeName: string; courseTitle: string; daysRemaining: number | null }> = [];

    for (const enr of enrollments) {
      const dept = enr.department || "General";
      if (!departmentStats[dept]) {
        departmentStats[dept] = { total: 0, compliant: 0, overdue: 0 };
      }
      departmentStats[dept].total++;

      const evalStatus = getEnrollmentComplianceStatus(enr);
      if (evalStatus.status === "VALID" || evalStatus.status === "EXPIRING_SOON") {
        departmentStats[dept].compliant++;
      }
      if (evalStatus.isOverdue || evalStatus.status === "EXPIRED") {
        departmentStats[dept].overdue++;
        overdueList.push({
          employeeId: enr.user_id,
          employeeName: enr.employee_name,
          courseTitle: enr.course_title,
          daysRemaining: evalStatus.daysRemaining,
        });
      }
    }

    steps.push({
      stepNumber: 2,
      name: "Department Breakdown Analysis & Overdue Credential Detection",
      description: `Scanned ${enrollments.length} enrollments across ${Object.keys(departmentStats).length} departments; detected ${overdueList.length} overdue/expiring certifications`,
      status: "PASSED",
      durationMs: Date.now() - s2Start,
      stateTransition: {
        entity: "Department Compliance Audit",
        from: "UNAUDITED",
        to: "AUDITED",
        metadata: {
          departmentsAudited: Object.keys(departmentStats).length,
          overdueCount: overdueList.length,
        },
      },
      details: {
        departmentStats,
        overdueCount: overdueList.length,
        sampleOverdue: overdueList.slice(0, 3),
      },
    });

    // ========================================================================
    // Step 3: One-Click Automated Reminder Nudge Dispatch
    // ========================================================================
    const s3Start = Date.now();
    log(`[Marcus Vance] Step 3: Dispatching automated reminder alert nudges to pending employees...`);

    const targetEmployeeId = overdueList.length > 0 ? overdueList[0].employeeId : "usr_alex_rivera";
    const targetCourse = overdueList.length > 0 ? overdueList[0].courseTitle : "SOC 2 Security";

    const nudgeLog = recordAuditEvent(
      {
        actorId: marcusId,
        actorRole: "COMPLIANCE_OFFICER",
        actorName: persona.name,
        action: "COMPLIANCE_NUDGE_SENT",
        targetType: "USER",
        targetId: targetEmployeeId,
        details: {
          recipientId: targetEmployeeId,
          courseTitle: targetCourse,
          nudgeType: "OVERDUE_RENEWAL_ALERT",
          dispatchMethod: "SYSTEM_NOTIFICATION",
        },
      },
      db
    );

    steps.push({
      stepNumber: 3,
      name: "One-Click Automated Reminder Nudge Dispatch",
      description: `Dispatched automated compliance reminder notification to employee '${targetEmployeeId}' for '${targetCourse}'; logged in audit trail`,
      status: "PASSED",
      durationMs: Date.now() - s3Start,
      stateTransition: {
        entity: "Compliance Nudge Engine",
        from: "IDLE",
        to: "DISPATCHED",
        metadata: {
          recipientId: targetEmployeeId,
          auditLogId: nudgeLog.id,
        },
      },
      details: {
        targetEmployeeId,
        targetCourse,
        auditLogId: nudgeLog.id,
        auditAction: nudgeLog.action,
      },
    });

    // ========================================================================
    // Step 4: Cryptographic SHA-256 Merkle Hash Chain Verification
    // ========================================================================
    const s4Start = Date.now();
    log(`[Marcus Vance] Step 4: Verifying sequential SHA-256 Merkle hash chain integrity...`);

    const allLogs = db.prepare("SELECT * FROM audit_logs ORDER BY id ASC").all() as unknown as AuditLogRecord[];
    if (allLogs.length === 0) {
      throw new Error("Audit log table is empty; cannot verify hash chain");
    }

    const verification = verifyAuditLogIntegrity(db);
    if (!verification.isValid) {
      throw new Error(`Audit log chain verification failed at index ${verification.tamperedIndex}: ${verification.failureReason}`);
    }

    rootHash = allLogs[allLogs.length - 1].record_hash;

    steps.push({
      stepNumber: 4,
      name: "Cryptographic SHA-256 Merkle Hash Chain Verification",
      description: `Validated cryptographic integrity across all ${allLogs.length} audit records; 100% match from genesis hash to root hash ${rootHash.substring(0, 16)}...`,
      status: "PASSED",
      durationMs: Date.now() - s4Start,
      stateTransition: {
        entity: "Cryptographic Audit Trail",
        from: "PENDING_VERIFICATION",
        to: "VERIFIED_VALID (100% SHA-256 Integrity)",
        metadata: {
          totalRecords: allLogs.length,
          genesisHash: GENESIS_HASH,
          rootHash,
        },
      },
      details: {
        totalVerifiedRecords: allLogs.length,
        isChainValid: true,
        genesisHash: GENESIS_HASH,
        rootHash,
        firstTimestamp: verification.firstTimestamp,
        lastTimestamp: verification.lastTimestamp,
      },
    });

    // ========================================================================
    // Step 5: Regulatory Audit Export Generation (RFC 4180 CSV & SOC 2 JSON)
    // ========================================================================
    const s5Start = Date.now();
    log(`[Marcus Vance] Step 5: Generating RFC 4180 CSV and SOC 2 JSON compliance audit packages...`);

    const csvData = generateAuditCsv(allLogs);
    csvExportBytes = Buffer.byteLength(csvData, "utf8");

    // Assert CSV format
    if (!csvData.startsWith("AuditID,Timestamp,UserID,EmployeeName,Action,CourseID,TargetID,ModuleVersion,Score,RecordHash")) {
      throw new Error("CSV export missing required RFC 4180 compliance audit header row");
    }
    const csvLines = csvData.split("\r\n");
    if (csvLines.length !== allLogs.length + 1) {
      throw new Error(`Expected ${allLogs.length + 1} CSV lines, got ${csvLines.length}`);
    }

    const jsonData = generateAuditJson(allLogs);
    jsonExportBytes = Buffer.byteLength(jsonData, "utf8");
    const jsonManifest = JSON.parse(jsonData);

    if (!jsonManifest.isChainValid) {
      throw new Error("JSON export manifest failed cryptographic validation flag");
    }
    if (jsonManifest.totalRecords !== allLogs.length) {
      throw new Error(`JSON manifest record count mismatch: expected ${allLogs.length}, got ${jsonManifest.totalRecords}`);
    }
    if (jsonManifest.rootHash !== rootHash) {
      throw new Error("JSON manifest rootHash mismatch");
    }

    steps.push({
      stepNumber: 5,
      name: "Regulatory Audit Export Generation (RFC 4180 CSV & SOC 2 JSON Manifest)",
      description: `Generated RFC 4180 CSV package (${csvExportBytes} bytes, ${csvLines.length - 1} rows) and SOC 2 JSON proof manifest (${jsonExportBytes} bytes) for regulatory submission`,
      status: "PASSED",
      durationMs: Date.now() - s5Start,
      stateTransition: {
        entity: "Audit Package Exporter",
        from: "UNGENERATED",
        to: "GENERATED (CSV + SOC 2 JSON)",
        metadata: {
          csvBytes: csvExportBytes,
          jsonBytes: jsonExportBytes,
          totalRecords: allLogs.length,
        },
      },
      details: {
        csvBytes: csvExportBytes,
        csvRowCount: csvLines.length - 1,
        jsonBytes: jsonExportBytes,
        manifestStandard: jsonManifest.exportMetadata?.standard || "ISO/IEC 27001 & SOC 2",
        rootHash,
      },
    });

    log(`[Marcus Vance] ✅ Compliance Officer Audit Simulation Completed Successfully in ${Date.now() - startTime}ms`);

    return {
      personaKey: "marcus",
      personaId: marcusId,
      personaName: persona.name,
      role: persona.role,
      targetCourseId: "all",
      targetCourseTitle: persona.targetCourseTitle,
      status: "PASSED",
      totalDurationMs: Date.now() - startTime,
      steps,
      artifacts: {
        auditLogsGenerated: 1,
        auditRootHash: rootHash,
        csvExportBytes,
        jsonExportBytes,
        jsonExportValid: true,
      },
    };
  } catch (err: any) {
    const failedDuration = Date.now() - startTime;
    log(`[Marcus Vance] ❌ Simulation failed: ${err.message}`);
    return {
      personaKey: "marcus",
      personaId: marcusId,
      personaName: persona.name,
      role: persona.role,
      targetCourseId: "all",
      targetCourseTitle: persona.targetCourseTitle,
      status: "FAILED",
      totalDurationMs: failedDuration,
      steps,
      error: err.message,
    };
  }
}
