import React from "react";
import Link from "next/link";
import { CORPORATE_PERSONAS } from "@/lib/auth";
import { PlaySquare, Users, Shield, ArrowRight, CheckCircle2 } from "lucide-react";

export default function SimulationPage() {
  const personas = Object.values(CORPORATE_PERSONAS);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Synthetic Office Persona Simulation
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              SIMULATION ENGINE
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Simulate realistic corporate employee lifecycles from Day-1 onboarding to regulatory compliance audits.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {personas.map((persona) => (
          <div
            key={persona.id}
            className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs space-y-3"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{persona.name}</h3>
                <p className="text-xs text-slate-500">{persona.jobTitle}</p>
                <p className="text-[11px] text-slate-400">{persona.department} Department</p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                {persona.role}
              </span>
            </div>

            <div className="text-xs text-slate-600 pt-2 border-t border-slate-100">
              <span className="font-semibold text-slate-700">Email:</span> {persona.email}
            </div>

            <div className="pt-1">
              <span className="text-[11px] text-indigo-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Configured for automated simulation runs</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-slate-100/70 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between">
        <div>
          <span className="font-semibold text-slate-800">CLI Simulation Command:</span>{" "}
          <code className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
            npm run simulate
          </code>
        </div>
        <Link
          href="/"
          className="text-brand-600 hover:text-brand-800 font-semibold flex items-center gap-1"
        >
          <span>Return to Dashboard</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
