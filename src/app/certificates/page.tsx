import React from "react";
import Link from "next/link";
import { getDb, initDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Award, ShieldCheck, Calendar, ArrowRight, ExternalLink } from "lucide-react";

export default async function CertificatesPage() {
  initDb();
  const db = getDb();
  const currentUser = await getCurrentUser();

  const certificates = db
    .prepare("SELECT * FROM certificates WHERE user_id = ? ORDER BY issued_at DESC")
    .all(currentUser.id) as any[];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 rounded-2xl p-6 md:p-8 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold backdrop-blur mb-2">
            <Award className="w-3.5 h-3.5 text-blue-400" />
            Official Compliance & Skills Ledger
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Your Earned Certificates & Credentials
          </h1>
          <p className="mt-2 text-slate-300 text-xs md:text-sm max-w-xl leading-relaxed">
            Every certificate issued is immutably anchored in our SQLite ledger with a unique SHA-256 cryptographic signature.
          </p>
        </div>

        <div className="bg-white/10 rounded-xl p-4 text-center shrink-0 border border-white/10">
          <div className="text-3xl font-extrabold text-white">{certificates.length}</div>
          <div className="text-xs text-slate-300 mt-0.5">Certificates Issued</div>
        </div>
      </div>

      {/* Certificates Grid */}
      {certificates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <Award className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-850">No certificates earned yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Complete assigned courses and achieve at least 80% on end-of-module knowledge checks to earn verifiable certifications.
          </p>
          <div className="pt-2">
            <Link
              href="/courses"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
            >
              Browse Course Catalog &rarr;
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                    {cert.certificate_code}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                    <ShieldCheck className="w-3 h-3" />
                    VERIFIED
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 leading-snug">
                  {cert.course_title}
                </h3>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <span>Version: v{cert.course_version}</span>
                  <span>•</span>
                  <span>Score: {cert.score}%</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Issued: {new Date(cert.issued_at).toLocaleDateString()}</span>
                </div>

                <Link
                  href={`/certificates/${cert.certificate_code}`}
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold"
                >
                  View Certificate <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
