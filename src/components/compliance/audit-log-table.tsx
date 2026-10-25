"use client";

import React, { useState } from "react";
import {
  FileText,
  Search,
  Filter,
  Download,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
} from "lucide-react";
import type { AuditLogRecord } from "@/types";

interface AuditLogTableProps {
  initialLogs: AuditLogRecord[];
  totalCount: number;
}

export function AuditLogTable({ initialLogs, totalCount }: AuditLogTableProps) {
  const [logs, setLogs] = useState<AuditLogRecord[]>(initialLogs);
  const [count, setCount] = useState<number>(totalCount);
  const [search, setSearch] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<AuditLogRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const pageSize = 15;

  const fetchLogs = async (page: number, searchVal: string, actionVal: string) => {
    setIsLoading(true);
    try {
      const offset = (page - 1) * pageSize;
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
      });
      if (searchVal.trim()) params.append("search", searchVal.trim());
      if (actionVal && actionVal !== "ALL") params.append("action", actionVal);

      const res = await fetch(`/api/compliance/audit-logs?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.records);
        setCount(data.totalCount);
        setCurrentPage(page);
      }
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(1, search, actionFilter);
  };

  const handleActionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setActionFilter(val);
    fetchLogs(1, search, val);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const totalPages = Math.max(Math.ceil(count / pageSize), 1);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Header and Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">Live Regulatory Audit Trail Ledger</h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
              IMMUTABLE
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Cryptographically chained event ledger recorded in strict SQLite append-only storage.
          </p>
        </div>

        {/* Action Export Buttons */}
        <div className="flex items-center gap-2">
          <a
            href="/api/compliance/export/csv"
            download
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </a>
          <a
            href="/api/compliance/export/json"
            download
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export JSON</span>
          </a>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-slate-50/70 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearch} className="flex-1 w-full sm:max-w-md relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by actor, action, target, or hash..."
            className="w-full h-8.5 pl-9 pr-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={actionFilter}
            onChange={handleActionChange}
            className="h-8.5 text-xs bg-white border border-slate-200 rounded-lg px-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="ALL">All Actions ({count})</option>
            <option value="COMPLIANCE_CERTIFIED">COMPLIANCE_CERTIFIED</option>
            <option value="COURSE_ENROLLED">COURSE_ENROLLED</option>
            <option value="COURSE_ASSIGNED">COURSE_ASSIGNED</option>
            <option value="QUIZ_SUBMITTED">QUIZ_SUBMITTED</option>
            <option value="NUDGE_SENT">NUDGE_SENT</option>
            <option value="USER_PROVISIONED">USER_PROVISIONED</option>
            <option value="SYSTEM_INITIALIZED">SYSTEM_INITIALIZED</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
              <th className="py-2.5 px-4"># ID</th>
              <th className="py-2.5 px-4">Timestamp</th>
              <th className="py-2.5 px-4">Actor</th>
              <th className="py-2.5 px-4">Action</th>
              <th className="py-2.5 px-4">Target</th>
              <th className="py-2.5 px-4">Score</th>
              <th className="py-2.5 px-4">Record Hash</th>
              <th className="py-2.5 px-4 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-xs text-slate-500">
                  Loading ledger entries...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-xs text-slate-500">
                  No audit log records match the current filter.
                </td>
              </tr>
            ) : (
              logs.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2.5 px-4 font-mono text-slate-400 text-[11px]">
                    {record.id}
                  </td>
                  <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                    {new Date(record.timestamp).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="font-semibold text-slate-900">{record.actor_name}</div>
                    <div className="text-[10px] text-slate-400">{record.actor_role}</div>
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                      {record.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="font-mono text-slate-700 text-[11px] truncate max-w-[120px] inline-block">
                      {record.target_id || record.target_type}
                    </span>
                  </td>
                  <td className="py-2.5 px-4">
                    {record.score !== null && record.score !== undefined ? (
                      <span className="font-semibold text-slate-800">{record.score}%</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate max-w-[90px]">
                        {record.record_hash.substring(0, 8)}...
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(record.record_hash)}
                        className="text-slate-400 hover:text-slate-600 p-0.5"
                        title="Copy full 64-char SHA-256 hash"
                      >
                        {copiedHash === record.record_hash ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedRecord(record)}
                      className="p-1 text-slate-400 hover:text-brand-600 transition-colors"
                      title="Inspect record details & hash link"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div>
          Showing {(currentPage - 1) * pageSize + 1} to{" "}
          {Math.min(currentPage * pageSize, count)} of {count} entries
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1 || isLoading}
            onClick={() => fetchLogs(currentPage - 1, search, actionFilter)}
            className="p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2 text-xs font-semibold text-slate-700">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages || isLoading}
            onClick={() => fetchLogs(currentPage + 1, search, actionFilter)}
            className="p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Detail Inspection Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full max-h-[85vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-brand-600" />
                <h4 className="text-sm font-bold text-slate-900">
                  Audit Record #{selectedRecord.id} Details
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-lg">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Timestamp</span>
                  <div className="font-semibold text-slate-800">{selectedRecord.timestamp}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Action</span>
                  <div className="font-semibold text-slate-800">{selectedRecord.action}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Actor</span>
                  <div className="font-semibold text-slate-800">
                    {selectedRecord.actor_name} ({selectedRecord.actor_role})
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Target</span>
                  <div className="font-semibold text-slate-800 font-mono">
                    {selectedRecord.target_type}: {selectedRecord.target_id}
                  </div>
                </div>
              </div>

              {/* Hash Chain Links */}
              <div className="space-y-1.5 p-2.5 bg-slate-900 text-slate-200 rounded-lg font-mono text-[10px]">
                <div className="text-slate-400 font-sans text-[10px] font-bold uppercase tracking-wider">
                  Cryptographic Merkle Links
                </div>
                <div>
                  <span className="text-slate-400">Previous Hash:</span>
                  <div className="text-amber-400 break-all">{selectedRecord.prev_hash}</div>
                </div>
                <div className="pt-1">
                  <span className="text-slate-400">Record Hash (SHA-256):</span>
                  <div className="text-emerald-400 break-all">{selectedRecord.record_hash}</div>
                </div>
              </div>

              {/* Metadata Payload */}
              {selectedRecord.metadata && (
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                    Canonical Metadata Payload
                  </span>
                  <pre className="p-2.5 bg-slate-100 rounded text-[11px] font-mono text-slate-800 overflow-x-auto max-h-40">
                    {JSON.stringify(JSON.parse(selectedRecord.metadata), null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
