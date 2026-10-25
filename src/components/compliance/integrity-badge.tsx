"use client";

import React, { useState } from "react";
import { ShieldCheck, ShieldAlert, RefreshCw, CheckCircle2, Lock } from "lucide-react";

interface IntegrityBadgeProps {
  initialValid?: boolean;
  initialRecordsCount?: number;
  initialCheckedAt?: string;
  onVerifyComplete?: (result: any) => void;
}

export function IntegrityBadge({
  initialValid = true,
  initialRecordsCount = 0,
  initialCheckedAt,
  onVerifyComplete,
}: IntegrityBadgeProps) {
  const [isValid, setIsValid] = useState<boolean>(initialValid);
  const [recordsCount, setRecordsCount] = useState<number>(initialRecordsCount);
  const [lastChecked, setLastChecked] = useState<string | null>(initialCheckedAt || null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const handleVerify = async () => {
    setIsVerifying(true);
    setErrorDetails(null);
    try {
      const response = await fetch("/api/compliance/verify-audit", {
        method: "POST",
      });
      const data = await response.json();
      if (data.success) {
        setIsValid(data.isValid);
        setRecordsCount(data.totalRecords);
        setLastChecked(data.checkedAt);
        if (!data.isValid) {
          setErrorDetails(data.failureReason || "Chain inconsistency detected");
        }
        if (onVerifyComplete) {
          onVerifyComplete(data);
        }
      } else {
        setErrorDetails(data.error || "Verification failed");
      }
    } catch (err: any) {
      setErrorDetails(err.message || "Failed to contact verification endpoint");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl border border-slate-700 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`p-2 rounded-lg flex items-center justify-center ${
            isValid
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
          }`}
        >
          {isValid ? (
            <ShieldCheck className="w-5 h-5" />
          ) : (
            <ShieldAlert className="w-5 h-5" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-tight">
              Cryptographic SHA-256 Merkle Chain
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                isValid
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
              }`}
            >
              {isValid ? "LEDGER INTACT" : "TAMPER DETECTED"}
            </span>
          </div>
          <div className="text-[11px] text-slate-300 flex items-center gap-1.5 mt-0.5">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>
              {recordsCount > 0
                ? `${recordsCount} sequential audit records mathematically verified`
                : "Awaiting verification"}
            </span>
            {lastChecked && (
              <span className="text-slate-400 text-[10px]">
                • Checked {new Date(lastChecked).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        <button
          type="button"
          onClick={handleVerify}
          disabled={isVerifying}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/25 text-white border border-white/15 transition-all disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? "animate-spin" : ""}`} />
          <span>{isVerifying ? "Verifying Hashes..." : "Verify Chain"}</span>
        </button>
      </div>

      {errorDetails && (
        <div className="w-full text-xs text-rose-300 bg-rose-950/60 p-2 rounded border border-rose-800">
          ⚠️ {errorDetails}
        </div>
      )}
    </div>
  );
}
