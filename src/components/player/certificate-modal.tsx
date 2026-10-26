"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Award,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  X,
  Printer,
  Sparkles,
} from "lucide-react";

export interface CertificateRecord {
  id?: string;
  certificate_code: string;
  user_name: string;
  course_title: string;
  issued_at: string;
  verification_hash: string;
  score?: number;
  user_email?: string;
}

export interface CertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  certificate: CertificateRecord | null;
}

export function CertificateModal({ isOpen, onClose, certificate }: CertificateModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !certificate) return null;

  const handleCopyCode = () => {
    if (certificate?.certificate_code) {
      navigator.clipboard.writeText(certificate.certificate_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(certificate.issued_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-amber-500/30 rounded-3xl p-6 sm:p-10 shadow-2xl text-white space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors border border-slate-700/60"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Certificate Frame */}
        <div className="relative border-2 border-dashed border-amber-500/40 rounded-2xl p-6 sm:p-8 bg-slate-950/50 space-y-6 text-center">
          {/* Header Badge */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Award className="w-9 h-9" />
            </div>
            <div className="text-xs uppercase tracking-widest font-black text-amber-400">
              Official Certificate of Completion
            </div>
            <div className="text-[11px] text-slate-400">
              Verified Marketplace Credential • 100% Curriculum Completion
            </div>
          </div>

          {/* Recipient and Title */}
          <div className="space-y-1">
            <p className="text-xs text-slate-400">This certifies that</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {certificate.user_name}
            </h2>
            <p className="text-xs text-slate-400 pt-1">
              has successfully completed all milestones and weekly modules of
            </p>
            <h3 className="text-base sm:text-lg font-bold text-amber-300 max-w-lg mx-auto pt-1">
              {certificate.course_title}
            </h3>
          </div>

          {/* Credentials Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-800 text-left text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Unique Cert ID</span>
              <div className="font-mono font-bold text-amber-300 text-xs sm:text-sm">
                {certificate.certificate_code}
              </div>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Issue Date</span>
              <div className="font-medium text-slate-200">{formattedDate}</div>
            </div>

            <div className="col-span-2 sm:col-span-1 space-y-0.5">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Status</span>
              <div className="flex items-center gap-1 text-emerald-400 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified</span>
              </div>
            </div>
          </div>

          {/* Cryptographic Ledger Hash */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-left space-y-1">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span className="font-mono">SHA-256 Cryptographic Verification Hash:</span>
              <span className="text-emerald-400 font-bold">Ledger Signed</span>
            </div>
            <div className="font-mono text-[10px] text-slate-300 truncate selection:bg-amber-500/30">
              {certificate.verification_hash}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? "Copied ID!" : "Copy Serial ID"}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print / PDF</span>
            </button>

            <Link
              href={`/certificates/${certificate.certificate_code}`}
              target="_blank"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Verify on Registry</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
