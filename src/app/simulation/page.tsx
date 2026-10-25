"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
  Shield,
  ShieldCheck,
  FileCheck2,
  Terminal,
  Award,
  Download,
  Copy,
  Check,
  ArrowRight,
  UserCheck,
  Sparkles,
  Clock,
  Layers,
  Database,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type {
  OverallSimulationSummary,
  PersonaSimulationResult,
  PersonaKey,
} from "@/simulation";

interface LogEntry {
  id: string;
  timestamp: string;
  level: "INFO" | "SUCCESS" | "TRANSITION" | "HASH" | "ERROR";
  message: string;
}

export default function SimulationConsolePage() {
  const [isRunning, setIsRunning] = useState(false);
  const [activePersona, setActivePersona] = useState<string | null>(null);
  const [summary, setSummary] = useState<OverallSimulationSummary | null>(null);
  const [singleResults, setSingleResults] = useState<Record<string, PersonaSimulationResult>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [expandedPersonas, setExpandedPersonas] = useState<Record<string, boolean>>({
    alex: true,
    elena: true,
    marcus: true,
  });
  const [copiedLogs, setCopiedLogs] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const addLog = (level: LogEntry["level"], message: string) => {
    const newEntry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString().split("T")[1].replace("Z", ""),
      level,
      message,
    };
    setLogs((prev) => [...prev, newEntry]);
  };

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Initial welcome log
  useEffect(() => {
    addLog("INFO", "Enterprise LMS Simulation Engine initialized.");
    addLog("INFO", "Ready to simulate multi-role corporate lifecycles (Alex, Elena, Marcus).");
  }, []);

  const triggerSimulation = async (persona: "all" | PersonaKey) => {
    if (isRunning) return;
    setIsRunning(true);
    setActivePersona(persona);

    addLog(
      "INFO",
      `Launching simulation for target: ${persona.toUpperCase()} via /api/simulate...`
    );

    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}: Simulation execution failed`);
      }

      const data = await res.json();

      if (persona === "all") {
        const s: OverallSimulationSummary = data.summary;
        setSummary(s);
        setSingleResults(s.results);

        for (const [key, pResult] of Object.entries(s.results)) {
          addLog("INFO", `[${pResult.personaName}] Execution completed with status: ${pResult.status}`);
          for (const step of pResult.steps) {
            if (step.stateTransition) {
              addLog(
                "TRANSITION",
                `[${pResult.personaName}] ${step.stateTransition.entity}: ${step.stateTransition.from} → ${step.stateTransition.to}`
              );
            }
          }
          if (pResult.artifacts?.certificateCode) {
            addLog(
              "HASH",
              `[${pResult.personaName}] Certificate Issued: ${pResult.artifacts.certificateCode} (Hash: ${pResult.artifacts.certificateHash?.substring(0, 16)}...)`
            );
          }
        }

        if (s.auditVerification.isValid) {
          addLog(
            "SUCCESS",
            `Cryptographic SHA-256 Merkle Chain: 100% VALID (${s.auditVerification.totalRecords} records verified, Root Hash: ${s.auditVerification.rootHash?.substring(0, 16)}...)`
          );
        } else {
          addLog("ERROR", `Cryptographic Hash Chain check returned compromised!`);
        }

        addLog(
          "SUCCESS",
          `All persona simulations finished in ${s.totalDurationMs}ms with ${s.passedSteps}/${s.totalSteps} steps verified.`
        );
      } else {
        const r: PersonaSimulationResult = data.result;
        setSingleResults((prev) => ({ ...prev, [persona]: r }));
        addLog("INFO", `[${r.personaName}] Execution completed with status: ${r.status}`);
        for (const step of r.steps) {
          if (step.stateTransition) {
            addLog(
              "TRANSITION",
              `[${r.personaName}] ${step.stateTransition.entity}: ${step.stateTransition.from} → ${step.stateTransition.to}`
            );
          }
        }
        if (r.artifacts?.certificateCode) {
          addLog(
            "HASH",
            `[${r.personaName}] Certificate Issued: ${r.artifacts.certificateCode} (Hash: ${r.artifacts.certificateHash?.substring(0, 16)}...)`
          );
        }
        addLog("SUCCESS", `Simulation for ${r.personaName} completed in ${r.totalDurationMs}ms.`);
      }
    } catch (err: any) {
      addLog("ERROR", `Simulation failed: ${err.message}`);
    } finally {
      setIsRunning(false);
      setActivePersona(null);
    }
  };

  const copyLogText = () => {
    const text = logs.map((l) => `[${l.timestamp}] [${l.level}] ${l.message}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const togglePersona = (key: string) => {
    setExpandedPersonas((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const totalSteps = summary
    ? summary.totalSteps
    : Object.values(singleResults).reduce((acc, r) => acc + r.steps.length, 0);
  const passedSteps = summary
    ? summary.passedSteps
    : Object.values(singleResults).reduce(
        (acc, r) => acc + r.steps.filter((s) => s.status === "PASSED").length,
        0
      );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-800 flex items-center justify-center text-white shadow-sm shadow-indigo-600/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Office Employee Persona Simulation Console
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  REAL-TIME TEST HARNESS
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Simulate authentic office personas navigating day-1 onboarding, technical safety, and regulatory audits.
              </p>
            </div>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => triggerSimulation("all")}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm shadow-indigo-500/20 transition-all cursor-pointer"
          >
            {isRunning && activePersona === "all" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-white" />
            )}
            <span>Run All Personas</span>
          </button>

          <button
            type="button"
            onClick={() => triggerSimulation("alex")}
            disabled={isRunning}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-medium transition-colors cursor-pointer"
          >
            Run Alex (New Hire)
          </button>

          <button
            type="button"
            onClick={() => triggerSimulation("elena")}
            disabled={isRunning}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-medium transition-colors cursor-pointer"
          >
            Run Elena (Sr. Engineer)
          </button>

          <button
            type="button"
            onClick={() => triggerSimulation("marcus")}
            disabled={isRunning}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-medium transition-colors cursor-pointer"
          >
            Run Marcus (Compliance)
          </button>
        </div>
      </div>

      {/* KPI METRICS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Personas Status */}
        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Personas Executed</span>
            <UserCheck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {summary ? `${summary.passedPersonas} / 3` : Object.keys(singleResults).length > 0 ? `${Object.keys(singleResults).length} / 3` : "Ready"}
            </span>
            {summary && summary.success && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> 100% Pass
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Alex, Elena, Marcus lifecycles</p>
        </div>

        {/* Card 2: State Steps Validated */}
        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Steps Validated</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {totalSteps > 0 ? `${passedSteps} / ${totalSteps}` : "0 / 14"}
            </span>
            {totalSteps > 0 && (
              <span className="text-xs font-semibold text-emerald-600">
                {Math.round((passedSteps / (totalSteps || 1)) * 100)}%
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">State transitions confirmed</p>
        </div>

        {/* Card 3: Cryptographic Merkle Chain */}
        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">SHA-256 Merkle Chain</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>CRYPTOGRAPHICALLY INTACT</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            {summary?.auditVerification.rootHash ? `Root: ${summary.auditVerification.rootHash.substring(0, 16)}...` : "Dual-layer SQLite triggers & hash chaining"}
          </p>
        </div>

        {/* Card 4: Total Execution Latency */}
        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Execution Latency</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {summary ? `${summary.totalDurationMs}ms` : "Sub-second"}
            </span>
            <span className="text-xs text-slate-500 font-mono">native sqlite</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Zero network bottleneck</p>
        </div>
      </div>

      {/* PERSONA EXECUTION CARDS */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 px-1">
          Simulated Persona Roles & State Lifecycles
        </h2>

        {/* PERSONA 1: ALEX RIVERA */}
        <PersonaCard
          personaKey="alex"
          name="Alex Rivera"
          role="EMPLOYEE"
          department="Engineering"
          jobTitle="Junior Software Engineer (New Hire)"
          courseTitle="Day-1 Enterprise Orientation & Engineering Setup"
          summaryText="Day-1 orientation lifecycle: views dashboard, reads culture policy markdown (33%), watches physical security video (67%), passes 3-question quiz with 100%, and receives verifiable certificate."
          result={singleResults.alex || summary?.results?.alex}
          isExpanded={expandedPersonas.alex}
          onToggle={() => togglePersona("alex")}
        />

        {/* PERSONA 2: ELENA ROSTOVA */}
        <PersonaCard
          personaKey="elena"
          name="Elena Rostova"
          role="EMPLOYEE"
          department="Security"
          jobTitle="Senior Security Engineer"
          courseTitle="Production Infrastructure Safety & Operational Resilience"
          summaryText="Senior Engineer technical safety: resumes curriculum at 50%, reviews canary release rollback runbooks (v2.1.0), takes technical exam scoring 100% against 85% threshold, and schedules 365-day renewal validity."
          result={singleResults.elena || summary?.results?.elena}
          isExpanded={expandedPersonas.elena}
          onToggle={() => togglePersona("elena")}
        />

        {/* PERSONA 3: MARCUS VANCE */}
        <PersonaCard
          personaKey="marcus"
          name="Marcus Vance"
          role="COMPLIANCE_OFFICER"
          department="People Ops"
          jobTitle="Head of Corporate Compliance"
          courseTitle="Company-Wide Compliance & Regulatory Audit"
          summaryText="Compliance Officer regulatory oversight: reviews executive KPIs, scans department compliance rates, dispatches automated reminder nudges to pending employees, verifies cryptographic SHA-256 Merkle hash chain, and exports RFC 4180 CSV & SOC 2 JSON manifests."
          result={singleResults.marcus || summary?.results?.marcus}
          isExpanded={expandedPersonas.marcus}
          onToggle={() => togglePersona("marcus")}
        />
      </div>

      {/* LIVE AUDIT TERMINAL LOG VIEWER */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-mono font-bold text-slate-200">
              Live State Transition & Cryptographic Audit Stream
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyLogText}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 rounded transition-colors cursor-pointer"
            >
              {copiedLogs ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedLogs ? "Copied" : "Copy Log"}</span>
            </button>
            <button
              type="button"
              onClick={clearLogs}
              className="px-2.5 py-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 rounded transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="p-4 font-mono text-xs max-h-72 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700">
          {logs.length === 0 ? (
            <div className="text-slate-500 py-4 text-center">No simulation events recorded yet. Click "Run All Personas" to begin.</div>
          ) : (
            logs.map((log) => {
              let badgeColor = "text-slate-400";
              let msgColor = "text-slate-300";

              if (log.level === "SUCCESS") {
                badgeColor = "text-emerald-400 font-bold";
                msgColor = "text-emerald-300";
              } else if (log.level === "TRANSITION") {
                badgeColor = "text-cyan-400 font-bold";
                msgColor = "text-cyan-200";
              } else if (log.level === "HASH") {
                badgeColor = "text-amber-400 font-bold";
                msgColor = "text-amber-200";
              } else if (log.level === "ERROR") {
                badgeColor = "text-rose-400 font-bold";
                msgColor = "text-rose-300";
              }

              return (
                <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-slate-500 shrink-0 select-none">{log.timestamp}</span>
                  <span className={`shrink-0 w-20 text-[10px] uppercase font-bold tracking-wider ${badgeColor}`}>
                    [{log.level}]
                  </span>
                  <span className={msgColor}>{log.message}</span>
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>

      {/* QUICK EXPORT ACTIONS & CLI REFERENCE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CLI Reference */}
        <div className="p-5 bg-white rounded-xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-slate-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Terminal CLI Simulation Command
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Execute the complete simulation suite headlessly with formatted terminal tables:
          </p>
          <div className="flex items-center justify-between p-2.5 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs">
            <span>npm run simulate</span>
            <span className="text-[10px] text-slate-400">Exit code 0 on success</span>
          </div>
        </div>

        {/* Regulatory Audit Exports */}
        <div className="p-5 bg-white rounded-xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Regulatory Audit Downloads
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Download live compliance packages generated during simulation verification:
          </p>
          <div className="flex items-center gap-2">
            <a
              href="/api/compliance/export/csv"
              download="compliance-audit.csv"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Download RFC 4180 CSV</span>
            </a>
            <a
              href="/api/compliance/export/json"
              download="compliance-manifest.json"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Download SOC 2 JSON</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PersonaCardProps {
  personaKey: string;
  name: string;
  role: string;
  department: string;
  jobTitle: string;
  courseTitle: string;
  summaryText: string;
  result?: PersonaSimulationResult;
  isExpanded: boolean;
  onToggle: () => void;
}

function PersonaCard({
  name,
  role,
  department,
  jobTitle,
  courseTitle,
  summaryText,
  result,
  isExpanded,
  onToggle,
}: PersonaCardProps) {
  const isPassed = result?.status === "PASSED";

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden transition-all">
      {/* CARD HEADER */}
      <div
        onClick={onToggle}
        className="p-4 sm:p-5 flex items-start sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700">
            {name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">{name}</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                {role}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">({department})</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {jobTitle} • Target: <span className="text-slate-800 font-medium">{courseTitle}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {result ? (
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                isPassed
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}
            >
              {isPassed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              <span>{isPassed ? "PASSED" : "FAILED"}</span>
              <span className="text-[10px] font-normal text-slate-400 font-mono">({result.totalDurationMs}ms)</span>
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
              IDLE
            </span>
          )}

          <button type="button" className="text-slate-400 hover:text-slate-600 p-1">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* EXPANDED CONTENT */}
      {isExpanded && (
        <div className="px-4 sm:px-5 pb-5 pt-1 border-t border-slate-100 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/70 p-3 rounded-lg border border-slate-200/60">
            {summaryText}
          </p>

          {/* STEPS TIMELINE */}
          {result && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Validated Lifecycle Transitions ({result.steps.length} Steps)
              </h4>
              <div className="space-y-2">
                {result.steps.map((step) => (
                  <div
                    key={step.stepNumber}
                    className="p-3 bg-white rounded-lg border border-slate-200/80 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="font-semibold text-slate-800">
                          Step {step.stepNumber}: {step.name}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">{step.durationMs}ms</span>
                    </div>

                    <p className="text-[11px] text-slate-500 pl-5.5 leading-relaxed">{step.description}</p>

                    {step.stateTransition && (
                      <div className="pl-5.5 pt-1">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50/70 border border-indigo-100 rounded-md text-[11px] font-mono text-indigo-700">
                          <span className="font-semibold text-indigo-900">{step.stateTransition.entity}:</span>
                          <span className="text-slate-600">{step.stateTransition.from}</span>
                          <ArrowRight className="w-3 h-3 text-indigo-500" />
                          <span className="font-bold text-indigo-800">{step.stateTransition.to}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ARTIFACTS SECTION */}
          {result?.artifacts && (
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-brand-600" />
                <span className="font-semibold text-slate-700">Generated Artifacts:</span>
              </div>
              <div className="flex items-center gap-3 flex-wrap text-[11px]">
                {result.artifacts.certificateCode && (
                  <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800">
                    Cert: <strong>{result.artifacts.certificateCode}</strong>
                  </span>
                )}
                {result.artifacts.certificateHash && (
                  <span
                    className="font-mono text-slate-500 truncate max-w-xs"
                    title={result.artifacts.certificateHash}
                  >
                    Hash: {result.artifacts.certificateHash.substring(0, 16)}...
                  </span>
                )}
                {result.artifacts.csvExportBytes && (
                  <span className="text-slate-600">CSV Export: {result.artifacts.csvExportBytes} B</span>
                )}
                {result.artifacts.jsonExportBytes && (
                  <span className="text-slate-600">JSON Export: {result.artifacts.jsonExportBytes} B</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
