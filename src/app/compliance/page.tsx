import React from "react";
import Link from "next/link";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { getDb, initDb } from "@/lib/db";
import { evaluateOrgCompliance } from "@/lib/compliance";
import { verifyAuditLogIntegrity } from "@/lib/audit";
import { ComplianceKpiCard } from "@/components/compliance/compliance-kpi-card";
import { IntegrityBadge } from "@/components/compliance/integrity-badge";
import { AuditLogTable } from "@/components/compliance/audit-log-table";
import type { AuditLogRecord } from "@/types";
import {
  ShieldCheck,
  ShieldAlert,
  Download,
  Award,
  AlertTriangle,
  FileCheck2,
  Lock,
  Layers,
  ArrowRight,
} from "lucide-react";

export default async function CompliancePage() {
  initDb();
  const db = getDb();
  const currentUser = await getCurrentUser();

  const isPrivileged = hasPermission(currentUser.role, "MANAGER");

  if (!isPrivileged) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Compliance Access Restricted</h2>
        <p className="text-xs text-slate-600">
          The Compliance & Audit Control Center is restricted to Compliance Officers and Corporate Administrators.
          Your current identity is <span className="font-semibold">{currentUser.name}</span> ({currentUser.role}).
        </p>
        <div className="pt-2">
          <p className="text-xs text-slate-500 mb-3">
            Use the Persona Switcher in the top navigation bar to assume the identity of{" "}
            <strong>Marcus Vance (Head of Corporate Compliance)</strong> or <strong>David Kim (VP of Operations)</strong>.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors"
          >
            <span>Return to Learner Overview</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // 1. Evaluate organization compliance metrics
  const summary = evaluateOrgCompliance(db);

  // 2. Initial Merkle chain verification
  const verification = verifyAuditLogIntegrity();

  // 3. Fetch initial audit logs
  const initialLogs = db.prepare(`
    SELECT * FROM audit_logs
    ORDER BY id DESC
    LIMIT 15
  `).all() as unknown as AuditLogRecord[];

  const regulationsList = Object.values(summary.regulations);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Compliance Officer Control Center
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              AUDIT READY
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Enterprise regulatory compliance posture, framework breakdowns, and cryptographically verifiable audit trail.
          </p>
        </div>

        {/* Quick Regulatory Export Actions */}
        <div className="flex items-center gap-2">
          <a
            href="/api/compliance/export/csv"
            download
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </a>
          <a
            href="/api/compliance/export/json"
            download
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export JSON</span>
          </a>
        </div>
      </div>

      {/* Live Cryptographic Hash Chain Verification Badge */}
      <IntegrityBadge
        initialValid={verification.isValid}
        initialRecordsCount={verification.totalRecords}
        initialCheckedAt={new Date().toISOString()}
      />

      {/* Org-Wide KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ComplianceKpiCard
          title="Overall Compliance Rate"
          value={`${summary.overallComplianceRate}%`}
          subtitle={`${summary.compliantCount} of ${summary.totalEnrollments} active enrollments`}
          icon={ShieldCheck}
          progress={summary.overallComplianceRate}
          badge={{
            text: summary.overallComplianceRate >= 80 ? "Audit Ready" : "Remediation Required",
            variant: summary.overallComplianceRate >= 80 ? "success" : "warning",
          }}
          colorTheme="emerald"
        />

        <ComplianceKpiCard
          title="Overdue Headcount"
          value={summary.overdueCount}
          subtitle="Non-compliant employees"
          icon={AlertTriangle}
          badge={{
            text: summary.overdueCount > 0 ? "Requires Follow-up" : "Zero Overdue",
            variant: summary.overdueCount > 0 ? "danger" : "success",
          }}
          colorTheme={summary.overdueCount > 0 ? "rose" : "emerald"}
        />

        <ComplianceKpiCard
          title="Certificates Issued"
          value={summary.certificatesIssued}
          subtitle="Digitally signed credentials"
          icon={Award}
          colorTheme="indigo"
        />

        <ComplianceKpiCard
          title="Immutable Audit Ledger"
          value={summary.auditLogsCount}
          subtitle="SHA-256 chained events"
          icon={Lock}
          badge={{ text: "WAL SQLite", variant: "info" }}
          colorTheme="blue"
        />
      </div>

      {/* Regulation Breakdown Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">
              Regulatory Framework Breakdown
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            Automated compliance renewal engine tracking 365-day recertification windows
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {regulationsList.map((reg) => {
            const statusConfig = {
              HEALTHY: {
                badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
                bar: "bg-emerald-500",
                label: "Healthy",
              },
              WARNING: {
                badge: "bg-amber-50 text-amber-700 border-amber-200",
                bar: "bg-amber-500",
                label: "Action Needed",
              },
              CRITICAL: {
                badge: "bg-rose-50 text-rose-700 border-rose-200",
                bar: "bg-rose-500",
                label: "Critical Risk",
              },
            }[reg.status];

            return (
              <div
                key={reg.code}
                className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-xs font-bold text-slate-900 line-clamp-1">
                      {reg.name}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border shrink-0 ${statusConfig.badge}`}
                    >
                      {statusConfig.label}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {reg.standard}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>{reg.compliant} / {reg.total} Compliant</span>
                    <span>{reg.rate}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${statusConfig.bar} transition-all duration-300`}
                      style={{ width: `${reg.rate}%` }}
                    />
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 line-clamp-2 pt-1 border-t border-slate-100">
                  {reg.description}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Audit Log Table */}
      <AuditLogTable initialLogs={initialLogs} totalCount={summary.auditLogsCount} />
    </div>
  );
}
