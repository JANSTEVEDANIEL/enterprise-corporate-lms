import React from "react";
import Link from "next/link";
import { getCertificateByIdOrCode, verifyCertificate } from "@/lib/certificates";
import { CertificateView } from "@/components/learner/certificate-view";
import { ShieldAlert, ShieldCheck, ArrowLeft, Home, Search } from "lucide-react";

interface CertificatePageProps {
  params: Promise<{
    certId: string;
  }>;
}

export default async function CertificateVerificationPage({ params }: CertificatePageProps) {
  const { certId } = await params;
  const verification = verifyCertificate(certId);

  if (!verification.certificate) {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-white rounded-3xl border border-slate-200 p-8 md:p-12 text-center shadow-lg space-y-6">
        <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold text-rose-600 uppercase tracking-widest bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
            Certificate Not Found
          </span>
          <h1 className="text-2xl font-black text-slate-900 pt-2">
            Verification Query Unsuccessful
          </h1>
          <p className="text-xs md:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            The serial identifier <strong className="font-mono text-slate-800">{certId}</strong> does not correspond to any valid, recorded certificate in the enterprise compliance registry.
          </p>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 text-left space-y-2 font-mono">
          <div className="font-bold text-slate-800 font-sans">Diagnostic Information:</div>
          <div>• Query ID: {certId}</div>
          <div>• Registry Status: UNRESOLVED / INVALID_SERIAL</div>
          <div>• Hash Verification: ABORTED (No matching ledger block)</div>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/courses"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition-all"
          >
            <Search className="w-4 h-4" />
            Explore Courses
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all"
          >
            <Home className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      {/* Verification status header */}
      <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-slate-500 print:hidden">
        <Link
          href="/certificates"
          className="inline-flex items-center gap-1.5 hover:text-blue-600 font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to My Certificates
        </Link>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Ledger Validated: {verification.certificate.certificate_code}</span>
        </div>
      </div>

      <CertificateView certificate={verification.certificate} />
    </div>
  );
}
