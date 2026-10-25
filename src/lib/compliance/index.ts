import { getDb, initDb } from "@/lib/db";
import { GENESIS_HASH, verifyAuditLogIntegrity } from "@/lib/audit";
import type { DatabaseSync } from "node:sqlite";
import type { AuditLogRecord, ComplianceRenewalStatus } from "@/types";

/**
 * Computes compliance status based on completion date and renewal period in days.
 * - NOT_STARTED: course has never been completed.
 * - VALID: completed and > 30 days remaining before renewal.
 * - EXPIRING_SOON: completed and <= 30 days remaining before renewal.
 * - EXPIRED: renewal deadline has passed (daysRemaining < 0).
 */
export function computeComplianceStatus(
  completedAt: string | null,
  renewalPeriodDays: number | null,
  referenceDate: Date = new Date()
): ComplianceRenewalStatus {
  if (!completedAt) {
    return "NOT_STARTED";
  }

  if (renewalPeriodDays === null || renewalPeriodDays <= 0) {
    return "VALID";
  }

  const completedTime = new Date(completedAt).getTime();
  const refTime = referenceDate.getTime();
  const diffDays = Math.floor((refTime - completedTime) / (1000 * 60 * 60 * 24));
  const daysRemaining = renewalPeriodDays - diffDays;

  if (daysRemaining < 0) {
    return "EXPIRED";
  }
  if (daysRemaining <= 30) {
    return "EXPIRING_SOON";
  }
  return "VALID";
}

export interface EnrollmentComplianceEvaluation {
  status: ComplianceRenewalStatus;
  isOverdue: boolean;
  daysRemaining: number | null;
  renewalPeriodDays: number | null;
}

/**
 * Evaluates an enrollment record's compliance status, overdue flag, and days remaining.
 */
export function getEnrollmentComplianceStatus(
  enrollment: {
    status?: string;
    completed_at?: string | null;
    due_date?: string | null;
    renewal_period_days?: number | null;
  },
  referenceDate: Date = new Date()
): EnrollmentComplianceEvaluation {
  const renewalPeriodDays = enrollment.renewal_period_days ?? null;

  if (enrollment.completed_at) {
    const status = computeComplianceStatus(enrollment.completed_at, renewalPeriodDays, referenceDate);
    let daysRemaining: number | null = null;
    if (renewalPeriodDays && renewalPeriodDays > 0) {
      const completedTime = new Date(enrollment.completed_at).getTime();
      const refTime = referenceDate.getTime();
      const diffDays = Math.floor((refTime - completedTime) / (1000 * 60 * 60 * 24));
      daysRemaining = renewalPeriodDays - diffDays;
    }
    return {
      status,
      isOverdue: status === "EXPIRED",
      daysRemaining,
      renewalPeriodDays,
    };
  }

  // Not yet completed
  let isOverdue = false;
  let daysRemaining: number | null = null;

  if (enrollment.status === "OVERDUE") {
    isOverdue = true;
  }

  if (enrollment.due_date) {
    const dueTime = new Date(enrollment.due_date).getTime();
    const refTime = referenceDate.getTime();
    daysRemaining = Math.ceil((dueTime - refTime) / (1000 * 60 * 60 * 24));
    if (daysRemaining < 0) {
      isOverdue = true;
    }
  }

  return {
    status: isOverdue ? "EXPIRED" : "NOT_STARTED",
    isOverdue,
    daysRemaining,
    renewalPeriodDays,
  };
}

export interface RegulationMetric {
  code: string;
  name: string;
  standard: string;
  category: string;
  total: number;
  compliant: number;
  overdue: number;
  expiringSoon: number;
  rate: number;
  status: "HEALTHY" | "WARNING" | "CRITICAL";
  description: string;
}

export interface OrgComplianceSummary {
  overallComplianceRate: number;
  totalEmployees: number;
  totalEnrollments: number;
  compliantCount: number;
  overdueCount: number;
  expiringSoonCount: number;
  certificatesIssued: number;
  auditLogsCount: number;
  regulations: Record<string, RegulationMetric>;
  evaluatedAt: string;
}

/**
 * Calculates organization-wide compliance KPIs and regulatory breakdowns from SQLite.
 */
export function evaluateOrgCompliance(
  dbOverride?: any,
  referenceDate: Date = new Date()
): OrgComplianceSummary {
  if (!dbOverride) {
    initDb();
  }
  const db = dbOverride || getDb();

  // 1. Employee headcount
  const empStmt = db.prepare("SELECT COUNT(*) as count FROM users WHERE is_active = 1 AND role != 'SUPER_ADMIN'");
  const totalEmployees = (empStmt.get() as { count: number })?.count || 0;

  // 2. Certificates issued
  const certStmt = db.prepare("SELECT COUNT(*) as count FROM certificates");
  const certificatesIssued = (certStmt.get() as { count: number })?.count || 0;

  // 3. Audit logs count
  const auditStmt = db.prepare("SELECT COUNT(*) as count FROM audit_logs");
  const auditLogsCount = (auditStmt.get() as { count: number })?.count || 0;

  // 4. Enrollments joined with courses
  const enrollmentsStmt = db.prepare(`
    SELECT 
      e.id, e.user_id, e.course_id, e.status as enrollment_status, e.progress_pct,
      e.due_date, e.completed_at,
      c.title as course_title, c.category, c.renewal_period_days, c.is_mandatory
    FROM enrollments e
    JOIN courses c ON c.id = e.course_id
    JOIN users u ON u.id = e.user_id
    WHERE u.is_active = 1
  `);
  const enrollments = enrollmentsStmt.all() as any[];

  let compliantCount = 0;
  let overdueCount = 0;
  let expiringSoonCount = 0;

  // Pre-seed regulations
  const regulations: Record<string, RegulationMetric> = {
    SOC2: {
      code: "SOC2",
      name: "SOC 2 Type II Security & Privacy",
      standard: "AICPA TSC CC6.1, CC6.6 & CC6.8",
      category: "SECURITY",
      total: 0,
      compliant: 0,
      overdue: 0,
      expiringSoon: 0,
      rate: 100,
      status: "HEALTHY",
      description: "Information security, credential hygiene, access controls, and customer data encryption.",
    },
    OSHA: {
      code: "OSHA",
      name: "OSHA Workplace Safety Standards",
      standard: "29 CFR 1910.1200 HazCom",
      category: "COMPLIANCE",
      total: 0,
      compliant: 0,
      overdue: 0,
      expiringSoon: 0,
      rate: 100,
      status: "HEALTHY",
      description: "Workplace hazard communication, emergency response, and physical site safety.",
    },
    HIPAA: {
      code: "HIPAA",
      name: "HIPAA Patient Data Protection",
      standard: "45 CFR § 164.308 Security Rule",
      category: "COMPLIANCE",
      total: 0,
      compliant: 0,
      overdue: 0,
      expiringSoon: 0,
      rate: 100,
      status: "HEALTHY",
      description: "Protected health information (PHI) confidentiality, transmission security, and privacy.",
    },
    ANTI_HARASSMENT: {
      code: "ANTI_HARASSMENT",
      name: "Anti-Harassment & Workplace Conduct",
      standard: "EEOC Title VII & Cal. Gov. Code § 12950.1",
      category: "COMPLIANCE",
      total: 0,
      compliant: 0,
      overdue: 0,
      expiringSoon: 0,
      rate: 100,
      status: "HEALTHY",
      description: "Mandatory corporate anti-harassment, bystander intervention, and non-discrimination.",
    },
  };

  for (const enr of enrollments) {
    const evaluation = getEnrollmentComplianceStatus(
      {
        status: enr.enrollment_status,
        completed_at: enr.completed_at,
        due_date: enr.due_date,
        renewal_period_days: enr.renewal_period_days,
      },
      referenceDate
    );

    if (evaluation.status === "VALID") {
      compliantCount++;
    } else if (evaluation.status === "EXPIRING_SOON") {
      compliantCount++; // still currently valid
      expiringSoonCount++;
    } else if (evaluation.isOverdue || evaluation.status === "EXPIRED") {
      overdueCount++;
    }

    // Match regulation
    const titleLower = (enr.course_title || "").toLowerCase();
    let regKey: string | null = null;
    if (titleLower.includes("soc2") || titleLower.includes("soc 2") || titleLower.includes("security")) {
      regKey = "SOC2";
    } else if (titleLower.includes("osha") || titleLower.includes("safety")) {
      regKey = "OSHA";
    } else if (titleLower.includes("hipaa") || titleLower.includes("health") || titleLower.includes("privacy")) {
      regKey = "HIPAA";
    } else if (titleLower.includes("harassment") || titleLower.includes("conduct") || titleLower.includes("orientation")) {
      regKey = "ANTI_HARASSMENT";
    }

    if (regKey && regulations[regKey]) {
      const reg = regulations[regKey];
      reg.total++;
      if (evaluation.status === "VALID" || evaluation.status === "EXPIRING_SOON") {
        reg.compliant++;
      }
      if (evaluation.status === "EXPIRING_SOON") {
        reg.expiringSoon++;
      }
      if (evaluation.isOverdue || evaluation.status === "EXPIRED") {
        reg.overdue++;
      }
    }
  }

  // Calculate percentages and statuses for regulations
  for (const key of Object.keys(regulations)) {
    const reg = regulations[key];
    if (reg.total > 0) {
      reg.rate = Math.round((reg.compliant / reg.total) * 100);
    } else {
      reg.rate = 100;
    }

    if (reg.rate >= 90) {
      reg.status = "HEALTHY";
    } else if (reg.rate >= 75) {
      reg.status = "WARNING";
    } else {
      reg.status = "CRITICAL";
    }
  }

  const totalEnrollments = enrollments.length;
  const overallComplianceRate = totalEnrollments > 0
    ? Math.round((compliantCount / totalEnrollments) * 100)
    : 100;

  return {
    overallComplianceRate,
    totalEmployees,
    totalEnrollments,
    compliantCount,
    overdueCount,
    expiringSoonCount,
    certificatesIssued,
    auditLogsCount,
    regulations,
    evaluatedAt: referenceDate.toISOString(),
  };
}

/**
 * Generates an RFC 4180 compliant CSV string of audit log records.
 */
export function generateAuditCsv(records: AuditLogRecord[]): string {
  const headers = [
    "AuditID",
    "Timestamp",
    "UserID",
    "EmployeeName",
    "Action",
    "CourseID",
    "TargetID",
    "ModuleVersion",
    "Score",
    "RecordHash",
  ];

  const escapeField = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  if (records.length === 0) {
    return headers.join(",");
  }

  const rows = records.map((r) => [
    escapeField(r.id),
    escapeField(r.timestamp),
    escapeField(r.actor_id),
    escapeField(r.actor_name),
    escapeField(r.action),
    escapeField(r.course_id || ""),
    escapeField(r.target_id || ""),
    escapeField(r.module_version || ""),
    escapeField(r.score !== null && r.score !== undefined ? r.score : ""),
    escapeField(r.record_hash),
  ]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
}

/**
 * Generates a structured JSON export of audit records with cryptographic Merkle proof metadata.
 */
export function generateAuditJson(records: AuditLogRecord[]): string {
  const rootHash = records.length > 0 ? records[records.length - 1].record_hash : GENESIS_HASH;
  const verification = verifyAuditLogIntegrity();

  const manifest = {
    exportMetadata: {
      exportedAt: new Date().toISOString(),
      standard: "ISO/IEC 27001 & SOC 2 Cryptographic Audit Standard",
      totalRecords: records.length,
      genesisHash: GENESIS_HASH,
      rootHash,
      isChainValid: verification.isValid,
      verificationSummary: {
        checkedRecords: verification.totalRecords,
        firstTimestamp: verification.firstTimestamp,
        lastTimestamp: verification.lastTimestamp,
      },
    },
    // Mirror top-level keys expected by tests
    totalRecords: records.length,
    genesisHash: GENESIS_HASH,
    rootHash,
    isChainValid: verification.isValid,
    records,
  };

  return JSON.stringify(manifest, null, 2);
}
