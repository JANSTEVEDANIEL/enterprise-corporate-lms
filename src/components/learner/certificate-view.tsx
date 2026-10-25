"use client";
import React, { useState } from "react";
import Link from "next/link";
import {
  Award,
  ShieldCheck,
  Printer,
  Copy,
  Check,
  ExternalLink,
  CheckCircle2,
  Calendar,
  Lock,
} from "lucide-react";
import type { Certificate } from "@/types";

interface CertificateViewProps {
  certificate: Certificate;
  verificationUrl?: string;
}

export function CertificateView({ certificate, verificationUrl }: CertificateViewProps) {
  const [copied, setCopied] = useState(false);

  const certUrl =
    verificationUrl ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/certificates/${certificate.certificate_code}`
      : `/certificates/${certificate.certificate_code}`);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(certUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Action Header (hidden in print) */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-blue-600" />
          <span className="font-bold text-sm text-slate-900">
            Official Enterprise Completion Certificate
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Link Copied" : "Copy Verification Link"}
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Main Certificate Sheet */}
      <div className="relative bg-white border-8 border-double border-slate-800 rounded-3xl p-8 md:p-14 shadow-xl text-center overflow-hidden print:border-4 print:p-8">
        {/* Corner Ornaments */}
        <div className="absolute top-4 left-4 w-12 h-12 border-t-2 border-l-2 border-slate-700 pointer-events-none" />
        <div className="absolute top-4 right-4 w-12 h-12 border-t-2 border-r-2 border-slate-700 pointer-events-none" />
        <div className="absolute bottom-4 left-4 w-12 h-12 border-b-2 border-l-2 border-slate-700 pointer-events-none" />
        <div className="absolute bottom-4 right-4 w-12 h-12 border-b-2 border-r-2 border-slate-700 pointer-events-none" />

        {/* Ambient watermark seal */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
          <ShieldCheck className="w-96 h-96 text-slate-900" />
        </div>

        {/* Header Institution */}
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-black tracking-widest text-slate-500 uppercase">
            <ShieldCheck className="w-4 h-4 text-blue-700" />
            Enterprise Corporate Learning Management System
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-black tracking-tight text-slate-950 uppercase pt-2">
            Certificate of Completion
          </h1>
          <p className="text-xs md:text-sm font-sans text-slate-500 max-w-md mx-auto">
            This certifies that the recipient has satisfactorily satisfied all curriculum requirements, safety standards, and assessment criteria.
          </p>
        </div>

        {/* Recipient Details */}
        <div className="relative z-10 my-8 space-y-2">
          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
            Proudly Awarded To
          </div>
          <div className="text-2xl md:text-3xl font-serif font-extrabold text-blue-900 underline decoration-blue-200 underline-offset-8">
            {certificate.user_name}
          </div>
          <div className="text-xs text-slate-500 font-mono pt-1">
            {certificate.user_email}
          </div>
        </div>

        {/* Course Details */}
        <div className="relative z-10 my-6 space-y-2 max-w-xl mx-auto">
          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
            For Successfully Demonstrating Competency In
          </div>
          <div className="text-lg md:text-xl font-bold text-slate-900">
            {certificate.course_title}
          </div>
          <div className="inline-flex items-center gap-3 text-xs text-slate-600 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
            <span>Curriculum Version: <strong>v{certificate.course_version}</strong></span>
            <span>•</span>
            <span>Final Assessment Score: <strong>{certificate.score}%</strong></span>
          </div>
        </div>

        {/* Dates & Signatures Row */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 my-10 pt-6 border-t border-slate-200 text-left md:text-center text-xs">
          <div>
            <div className="text-slate-400 font-medium">Issue Date</div>
            <div className="font-bold text-slate-800 mt-1">
              {new Date(certificate.issued_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
            {certificate.expires_at && (
              <div className="text-[11px] text-amber-700 mt-0.5">
                Valid Until: {new Date(certificate.expires_at).toLocaleDateString()}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-full border-2 border-dashed border-blue-600/50 bg-blue-50/50 flex items-center justify-center text-blue-700 shadow-xs mb-1">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Verified Compliance
            </span>
          </div>

          <div>
            <div className="text-slate-400 font-medium">Unique Serial Code</div>
            <div className="font-mono font-bold text-slate-900 mt-1 tracking-wider">
              {certificate.certificate_code}
            </div>
            <div className="text-[10px] text-slate-400 font-mono truncate max-w-[200px] mx-auto mt-0.5">
              ID: {certificate.id}
            </div>
          </div>
        </div>

        {/* Cryptographic Ledger Proof Footer */}
        <div className="relative z-10 pt-4 border-t border-slate-100 bg-slate-50/80 -mx-8 -mb-8 md:-mx-14 md:-mb-14 p-4 text-[10px] text-slate-500 flex flex-col md:flex-row items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="font-mono truncate max-w-sm md:max-w-md">
              SHA-256 Ledger Hash: {certificate.verification_hash}
            </span>
          </div>

          <div className="font-mono text-[10px] text-blue-600 font-semibold">
            Immutable Verification Ledger • Intact Dual-Trigger Chain
          </div>
        </div>
      </div>
    </div>
  );
}
