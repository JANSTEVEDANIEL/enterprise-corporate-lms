import React from "react";
import Link from "next/link";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { getDb, initDb } from "@/lib/db";
import { verifyAuditLogIntegrity } from "@/lib/audit";
import { IntegrityBadge } from "@/components/compliance/integrity-badge";
import { AuditLogTable } from "@/components/compliance/audit-log-table";
import type { AuditLogRecord } from "@/types";
import { ShieldCheck, ShieldAlert, ArrowRight, Download } from "lucide-react";

export default async function AuditLedgerPage() {
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
        <h2 className="text-lg font-bold text-slate-900">Audit Ledger Restricted</h2>
        <p className="text-xs text-slate-600">
          The Audit Log Ledger is restricted to Compliance Officers and Corporate Administrators.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors"
        >
          <span>Return to Learner Overview</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  const verification = verifyAuditLogIntegrity();
  const totalCount = (db.prepare("SELECT COUNT(*) as count FROM audit_logs").get() as { count: number }).count;
  const initialLogs = db.prepare(`
    SELECT * FROM audit_logs
    ORDER BY id DESC
    LIMIT 15
  `).all() as unknown as AuditLogRecord[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Cryptographic Audit Log Ledger
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-emerald-400 border border-slate-700 font-mono">
              SHA-256 CHAIN
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Tamper-evident record of all corporate learning events, certifications, nudges, and administrative changes.
          </p>
        </div>

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

      <IntegrityBadge
        initialValid={verification.isValid}
        initialRecordsCount={verification.totalRecords}
        initialCheckedAt={new Date().toISOString()}
      />

      <AuditLogTable initialLogs={initialLogs} totalCount={totalCount} />
    </div>
  );
}
