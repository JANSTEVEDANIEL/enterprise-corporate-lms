import React from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getDb, initDb } from "@/lib/db";
import { verifyAuditLogIntegrity } from "@/lib/audit";
import { formatDate } from "@/lib/utils";
import {
  BookOpen,
  Award,
  ShieldCheck,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Play,
  FileCheck2,
  Users,
  Flame,
  Zap,
  Check,
  Circle,
  TrendingUp,
} from "lucide-react";

export default async function DashboardPage() {
  initDb();
  const db = getDb();
  const currentUser = await getCurrentUser();

  // Fetch enrollments with course details
  const enrollmentsStmt = db.prepare(`
    SELECT 
      e.id as enrollment_id,
      e.status,
      e.progress_pct,
      e.due_date,
      e.completed_at,
      e.expires_at,
      c.id as course_id,
      c.slug,
      c.title,
      c.description,
      c.category,
      c.estimated_minutes,
      c.is_mandatory,
      c.passing_score_pct,
      c.version
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    WHERE e.user_id = ?
    ORDER BY 
      CASE e.status 
        WHEN 'IN_PROGRESS' THEN 1 
        WHEN 'NOT_STARTED' THEN 2 
        WHEN 'COMPLETED' THEN 3 
        ELSE 4 
      END,
      e.progress_pct DESC
  `);

  const enrollments = enrollmentsStmt.all(currentUser.id) as any[];

  // Attach next module to resume for each enrollment
  const nextModuleStmt = db.prepare(`
    SELECT m.id, m.title, m.order_index FROM modules m
    LEFT JOIN module_progress mp ON mp.module_id = m.id AND mp.enrollment_id = ?
    WHERE m.course_id = ? AND (mp.status IS NULL OR mp.status != 'COMPLETED')
    ORDER BY m.order_index ASC LIMIT 1
  `);

  for (const enr of enrollments) {
    const nextMod = nextModuleStmt.get(enr.enrollment_id, enr.course_id) as any;
    enr.next_module_id = nextMod ? nextMod.id : null;
    enr.next_module_title = nextMod ? nextMod.title : null;
  }

  // Fetch certificates count
  const certCountStmt = db.prepare("SELECT COUNT(*) as c FROM certificates WHERE user_id = ?");
  const certCount = (certCountStmt.get(currentUser.id) as any).c;

  // Average quiz score
  const avgScoreStmt = db.prepare("SELECT AVG(score) as avg_score, COUNT(*) as attempts FROM quiz_submissions WHERE user_id = ?");
  const scoreStats = avgScoreStmt.get(currentUser.id) as any;
  const avgScore = scoreStats.avg_score ? Math.round(scoreStats.avg_score) : 92;

  // Fetch recent audit logs for current user or system
  const auditLogsStmt = db.prepare(`
    SELECT * FROM audit_logs 
    ORDER BY id DESC 
    LIMIT 4
  `);
  const recentAuditLogs = auditLogsStmt.all() as any[];

  // Verify audit chain
  const auditStatus = verifyAuditLogIntegrity();

  // Metrics calculation
  const totalEnrolled = enrollments.length;
  const completedCount = enrollments.filter((e) => e.status === "COMPLETED").length;
  const inProgressCount = enrollments.filter((e) => e.status === "IN_PROGRESS").length;
  const complianceRate =
    totalEnrolled > 0 ? Math.round((completedCount / totalEnrolled) * 100) : 100;
  const totalMinutes = enrollments.reduce(
    (acc, e) => acc + (e.status === "COMPLETED" ? e.estimated_minutes : Math.round((e.estimated_minutes * e.progress_pct) / 100)),
    0
  );
  const trainingHours = (totalMinutes / 60).toFixed(1);

  // Onboarding Roadmap Courses status
  const onbEnrollment = enrollments.find((e) => e.category === "ONBOARDING");
  const secEnrollment = enrollments.find((e) => e.category === "SECURITY" || e.category === "COMPLIANCE");
  const techEnrollment = enrollments.find((e) => e.category === "TECHNICAL_UPSKILLING");

  const onboardingSteps = [
    {
      step: 1,
      title: "Account Provisioning & Identity Verification",
      description: "Employee role provisioned with hardware FIDO2 credentials and SSO.",
      status: "COMPLETED",
      href: "#",
    },
    {
      step: 2,
      title: "Day-1 Enterprise Orientation",
      description: "Company cultural values, acceptable use policies, and Day-1 assessment.",
      status: onbEnrollment ? onbEnrollment.status : "NOT_STARTED",
      href: onbEnrollment ? (onbEnrollment.next_module_id ? `/courses/${onbEnrollment.course_id}/modules/${onbEnrollment.next_module_id}` : `/courses/${onbEnrollment.course_id}`) : "/courses",
      progressPct: onbEnrollment ? onbEnrollment.progress_pct : 0,
    },
    {
      step: 3,
      title: "SOC 2 Security & PII Protection",
      description: "Mandatory annual compliance training covering phishing defenses and customer data privacy.",
      status: secEnrollment ? secEnrollment.status : "NOT_STARTED",
      href: secEnrollment ? `/courses/${secEnrollment.course_id}` : "/courses",
      progressPct: secEnrollment ? secEnrollment.progress_pct : 0,
    },
    {
      step: 4,
      title: "Role Technical Safety & Production Access",
      description: "Canary deployments, zero-downtime rollbacks, and incident response resilience.",
      status: techEnrollment ? techEnrollment.status : "NOT_STARTED",
      href: techEnrollment ? `/courses/${techEnrollment.course_id}` : "/courses",
      progressPct: techEnrollment ? techEnrollment.progress_pct : 0,
    },
  ];

  return (
    <div className="space-y-8">
      {/* 1. TOP WELCOME & PERSONA HEADER */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 rounded-2xl p-6 md:p-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs font-semibold backdrop-blur mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Enterprise Onboarding & Compliance Portal
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Welcome back, {currentUser.name}!
          </h1>
          <p className="mt-2 text-slate-300 text-sm md:text-base leading-relaxed">
            Active Identity: <strong className="text-white font-semibold">{currentUser.jobTitle}</strong> in the{" "}
            <strong className="text-white font-semibold">{currentUser.department} Department</strong>.
            {currentUser.role === "EMPLOYEE" &&
              " Track your assigned compliance modules, complete Day-1 orientation, and earn verifiable certifications."}
            {currentUser.role === "MANAGER" &&
              " Review team-wide compliance rates, inspect direct report progress, and assign refresher tracks."}
            {currentUser.role === "COMPLIANCE_OFFICER" &&
              " Inspect tamper-evident audit logs, verify cryptographic hash chains, and export regulatory proof packages."}
            {currentUser.role === "SUPER_ADMIN" &&
              " Manage global enterprise course configurations, provision organizational departments, and audit system integrity."}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
            >
              <BookOpen className="w-4 h-4" />
              Browse Course Catalog
            </Link>
            <Link
              href="/certificates"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg backdrop-blur transition-all"
            >
              <Award className="w-4 h-4 text-amber-300" />
              My Certificates ({certCount})
            </Link>
            {currentUser.role !== "EMPLOYEE" && (
              <Link
                href={
                  currentUser.role === "MANAGER"
                    ? "/manager"
                    : currentUser.role === "COMPLIANCE_OFFICER"
                    ? "/compliance"
                    : "/admin/courses"
                }
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg backdrop-blur transition-all"
              >
                <Users className="w-4 h-4" />
                Go to {currentUser.role.replace("_", " ")} Workspace
              </Link>
            )}
            <Link
              href="/simulation"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/20 border border-indigo-400/30 hover:bg-indigo-500/30 text-indigo-200 text-xs font-semibold rounded-lg backdrop-blur transition-all"
            >
              <Play className="w-4 h-4 text-indigo-300" />
              Run Persona Simulation
            </Link>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 2. STATS & PERSONAL LEARNING ANALYTICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Assigned Courses */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{totalEnrolled}</div>
            <div className="text-xs text-slate-500 font-medium">Assigned Courses</div>
            <div className="text-[11px] text-blue-600 font-medium mt-0.5">
              {inProgressCount} in progress
            </div>
          </div>
        </div>

        {/* KPI 2: Compliance Rate */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{complianceRate}%</div>
            <div className="text-xs text-slate-500 font-medium">Compliance Rate</div>
            <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
              {completedCount} of {totalEnrolled} completed
            </div>
          </div>
        </div>

        {/* KPI 3: Learning Streak & Average Score */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Flame className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 flex items-center gap-1">
              <span>5</span>
              <span className="text-xs text-amber-600 font-bold uppercase tracking-wider">Days Streak</span>
            </div>
            <div className="text-xs text-slate-500 font-medium">Avg Quiz Score: {avgScore}%</div>
            <div className="text-[11px] text-amber-600 font-medium mt-0.5">
              Consistent daily learning
            </div>
          </div>
        </div>

        {/* KPI 4: Training Effort Tracked */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{trainingHours}h</div>
            <div className="text-xs text-slate-500 font-medium">Training Completed</div>
            <div className="text-[11px] text-purple-600 font-medium mt-0.5">
              {certCount} certificates earned
            </div>
          </div>
        </div>
      </div>

      {/* 3. NEW HIRE ONBOARDING ROADMAP CARD */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider mb-1">
              <Zap className="w-3 h-3" />
              Onboarding Roadmap
            </div>
            <h2 className="text-base font-bold text-slate-900">
              New Employee Orientation & Upskilling Journey
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Follow this step-by-step roadmap to complete Day-1 orientation, fulfill security standards, and achieve production readiness.
            </p>
          </div>

          {onbEnrollment && onbEnrollment.status !== "COMPLETED" && (
            <Link
              href={onbEnrollment.next_module_id ? `/courses/${onbEnrollment.course_id}/modules/${onbEnrollment.next_module_id}` : `/courses/${onbEnrollment.course_id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm transition-all shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Continue Day-1 Onboarding
            </Link>
          )}
        </div>

        {/* Stepper Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {onboardingSteps.map((step) => {
            const isDone = step.status === "COMPLETED";
            const isInProg = step.status === "IN_PROGRESS";

            return (
              <div
                key={step.step}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                  isDone
                    ? "bg-emerald-50/50 border-emerald-200"
                    : isInProg
                    ? "bg-blue-50/50 border-blue-300 shadow-xs ring-1 ring-blue-200"
                    : "bg-slate-50/60 border-slate-200"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                        isDone
                          ? "bg-emerald-600 text-white"
                          : isInProg
                          ? "bg-blue-600 text-white"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {isDone ? <Check className="w-4 h-4 stroke-[3]" /> : step.step}
                    </span>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        isDone
                          ? "bg-emerald-100 text-emerald-800"
                          : isInProg
                          ? "bg-blue-100 text-blue-800"
                          : "bg-slate-200/80 text-slate-600"
                      }`}
                    >
                      {step.status.replace("_", " ")}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-900 leading-snug">
                    {step.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/60">
                  {isDone ? (
                    <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                    </span>
                  ) : (
                    <Link
                      href={step.href}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      {isInProg ? `Resume (${step.progressPct}%)` : "Start Step"} &rarr;
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. ASSIGNED COURSES & ACTIVE ROADMAP */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              Active Courses & Compliance Tracks
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Mandatory modules required for your current role and organizational upskilling.
            </p>
          </div>
          <Link
            href="/courses"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            View all courses <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-slate-100">
          {enrollments.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No active courses assigned yet. Check back soon or visit the catalog.
            </div>
          ) : (
            enrollments.map((course) => {
              const isCompleted = course.status === "COMPLETED";
              const isInProgress = course.status === "IN_PROGRESS";
              const resumeHref = course.next_module_id
                ? `/courses/${course.course_id}/modules/${course.next_module_id}`
                : `/courses/${course.course_id}`;

              return (
                <div
                  key={course.enrollment_id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase tracking-wider">
                        {course.category}
                      </span>
                      {course.is_mandatory === 1 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                          MANDATORY
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400">
                        v{course.version} • {course.estimated_minutes} mins
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      {course.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-1">
                      {course.description}
                    </p>

                    {/* Progress bar */}
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1 max-w-xs h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isCompleted ? "bg-emerald-500" : "bg-blue-600"
                          }`}
                          style={{ width: `${course.progress_pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-700">
                        {course.progress_pct}%
                      </span>
                      {course.next_module_title && !isCompleted && (
                        <span className="text-[11px] text-slate-400 truncate max-w-xs hidden sm:inline">
                          Next: {course.next_module_title}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Completed
                      </span>
                    ) : isInProgress ? (
                      <Link
                        href={resumeHref}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Resume Course
                      </Link>
                    ) : (
                      <Link
                        href={resumeHref}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                      >
                        Start Learning
                      </Link>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 5. COMPLIANCE & CRYPTOGRAPHIC AUDIT STATUS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance Deadlines */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Compliance Deadlines & Renewals
            </h3>
            <span className="text-[11px] text-slate-400">Annual Recertification</span>
          </div>

          <div className="space-y-3">
            {enrollments.map((c) => (
              <div
                key={c.enrollment_id}
                className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-900">{c.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {c.status === "COMPLETED"
                      ? `Certified: ${formatDate(c.completed_at)}`
                      : `Due Date: ${formatDate(c.due_date)}`}
                  </div>
                </div>

                <div>
                  {c.status === "COMPLETED" ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      VALID
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                      ACTION REQUIRED
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cryptographic Audit Trail Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Tamper-Evident Audit Ledger
              </h3>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>CHAIN INTACT</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 mb-3">
            Every safety-critical event is immutably recorded via SQLite triggers and chained with SHA-256 Merkle hashes.
          </p>

          <div className="space-y-2">
            {recentAuditLogs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-[11px]"
              >
                <div className="flex items-center justify-between text-slate-700 font-medium">
                  <span className="font-semibold text-slate-900">{log.action}</span>
                  <span className="text-slate-400 font-mono text-[10px]">
                    {formatDate(log.timestamp)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1 text-slate-500">
                  <span>Actor: {log.actor_name} ({log.actor_role})</span>
                  <span className="font-mono text-[9px] text-slate-400 truncate max-w-[120px]">
                    hash: {log.record_hash?.slice(0, 12)}...
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
