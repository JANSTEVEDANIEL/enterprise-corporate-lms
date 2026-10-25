import React from "react";
import Link from "next/link";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { getDb, initDb } from "@/lib/db";
import { getEnrollmentComplianceStatus } from "@/lib/compliance";
import { ComplianceKpiCard } from "@/components/compliance/compliance-kpi-card";
import { TeamProgressTable, type DirectReport } from "@/components/compliance/team-progress-table";
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  FileCheck,
} from "lucide-react";

export default async function ManagerDashboardPage() {
  initDb();
  const db = getDb();
  const currentUser = await getCurrentUser();

  const isManager = hasPermission(currentUser.role, "MANAGER");

  if (!isManager) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Manager Role Required</h2>
        <p className="text-xs text-slate-600">
          The Team Compliance Dashboard is restricted to Managers and Corporate Administrators.
          Your current identity is <span className="font-semibold">{currentUser.name}</span> ({currentUser.role}).
        </p>
        <div className="pt-2">
          <p className="text-xs text-slate-500 mb-3">
            Use the Persona Switcher in the top navigation bar to assume the identity of{" "}
            <strong>Sarah Jenkins (Engineering Manager)</strong> or <strong>David Kim (VP of Operations)</strong>.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors"
          >
            <span>Return to Learner Overview</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // Fetch reports for current manager (or all if super admin and no direct reports)
  let reports = db.prepare(`
    SELECT id, name, email, role, department, job_title, avatar_url
    FROM users
    WHERE manager_id = ? AND is_active = 1
    ORDER BY name ASC
  `).all(currentUser.id) as any[];

  if (reports.length === 0 && currentUser.role === "SUPER_ADMIN") {
    reports = db.prepare(`
      SELECT id, name, email, role, department, job_title, avatar_url
      FROM users
      WHERE role != 'SUPER_ADMIN' AND id != ? AND is_active = 1
      ORDER BY name ASC
    `).all(currentUser.id) as any[];
  }

  const directReports: DirectReport[] = [];
  let totalAssigned = 0;
  let totalCompleted = 0;
  let overdueReportsCount = 0;
  let compliantReportsCount = 0;
  let inProgressReportsCount = 0;

  const overdueList: Array<{
    employeeName: string;
    employeeId: string;
    courseTitle: string;
    courseId: string;
    daysOverdue: number;
  }> = [];

  for (const report of reports) {
    const enrollments = db.prepare(`
      SELECT 
        e.id as enrollment_id, e.status as enrollment_status, e.progress_pct,
        e.assigned_at, e.due_date, e.completed_at,
        c.id as course_id, c.title as course_title, c.category, c.renewal_period_days,
        c.is_mandatory, c.estimated_minutes,
        (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) as total_modules,
        (SELECT COUNT(*) FROM module_progress mp WHERE mp.enrollment_id = e.id AND mp.status = 'COMPLETED') as completed_modules
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      WHERE e.user_id = ?
      ORDER BY c.is_mandatory DESC, e.due_date ASC
    `).all(report.id) as any[];

    const recentQuizzes = db.prepare(`
      SELECT qs.id, qs.score, qs.passed, qs.attempt_number, qs.submitted_at,
             q.title as quiz_title, c.title as course_title
      FROM quiz_submissions qs
      JOIN modules m ON m.id = qs.module_id
      JOIN courses c ON c.id = m.course_id
      JOIN quizzes q ON q.module_id = m.id
      WHERE qs.user_id = ?
      ORDER BY qs.submitted_at DESC
      LIMIT 3
    `).all(report.id) as any[];

    let reportHasOverdue = false;
    let reportProgressSum = 0;
    let reportCompletedCourses = 0;

    const formattedEnrollments = enrollments.map((enr) => {
      const evalResult = getEnrollmentComplianceStatus({
        status: enr.enrollment_status,
        completed_at: enr.completed_at,
        due_date: enr.due_date,
        renewal_period_days: enr.renewal_period_days,
      });

      if (evalResult.isOverdue) {
        reportHasOverdue = true;
        const daysPast = evalResult.daysRemaining !== null ? Math.abs(evalResult.daysRemaining) : 7;
        overdueList.push({
          employeeName: report.name,
          employeeId: report.id,
          courseTitle: enr.course_title,
          courseId: enr.course_id,
          daysOverdue: daysPast,
        });
      }

      reportProgressSum += enr.progress_pct || 0;
      if (enr.enrollment_status === "COMPLETED") {
        reportCompletedCourses++;
      }

      totalAssigned++;
      if (enr.enrollment_status === "COMPLETED") {
        totalCompleted++;
      }

      return {
        enrollmentId: enr.enrollment_id,
        courseId: enr.course_id,
        courseTitle: enr.course_title,
        category: enr.category,
        isMandatory: Boolean(enr.is_mandatory),
        status: enr.enrollment_status,
        complianceStatus: evalResult.status,
        isOverdue: evalResult.isOverdue,
        daysRemaining: evalResult.daysRemaining,
        progressPct: enr.progress_pct,
        completedModules: enr.completed_modules,
        totalModules: enr.total_modules,
        dueDate: enr.due_date,
        completedAt: enr.completed_at,
      };
    });

    const averageProgress = enrollments.length > 0
      ? Math.round(reportProgressSum / enrollments.length)
      : 100;

    let employeeStatus: "COMPLIANT" | "IN_PROGRESS" | "OVERDUE" = "COMPLIANT";
    if (reportHasOverdue) {
      employeeStatus = "OVERDUE";
      overdueReportsCount++;
    } else if (reportCompletedCourses < enrollments.length || averageProgress < 100) {
      employeeStatus = "IN_PROGRESS";
      inProgressReportsCount++;
    } else {
      employeeStatus = "COMPLIANT";
      compliantReportsCount++;
    }

    directReports.push({
      id: report.id,
      name: report.name,
      email: report.email,
      jobTitle: report.job_title,
      department: report.department,
      avatarUrl: report.avatar_url,
      status: employeeStatus,
      averageProgress,
      assignedCount: enrollments.length,
      completedCount: reportCompletedCourses,
      hasOverdue: reportHasOverdue,
      enrollments: formattedEnrollments,
      recentQuizzes,
    });
  }

  const teamCompletionRate = totalAssigned > 0
    ? Math.round((totalCompleted / totalAssigned) * 100)
    : 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Manager Team Compliance Dashboard
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-200">
              {currentUser.department} Team
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Overview of department training posture, direct report progress metrics, and compliance deadlines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/courses"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <FileCheck className="w-3.5 h-3.5 text-slate-500" />
            <span>Browse Catalog</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ComplianceKpiCard
          title="Team Completion Rate"
          value={`${teamCompletionRate}%`}
          subtitle="All assigned courses"
          icon={TrendingUp}
          progress={teamCompletionRate}
          badge={{
            text: teamCompletionRate >= 80 ? "On Target" : "Attention Needed",
            variant: teamCompletionRate >= 80 ? "success" : "warning",
          }}
          colorTheme="blue"
        />

        <ComplianceKpiCard
          title="Direct Reports"
          value={directReports.length}
          subtitle={`Department: ${currentUser.department}`}
          icon={Users}
          colorTheme="indigo"
        />

        <ComplianceKpiCard
          title="Fully Compliant"
          value={compliantReportsCount}
          subtitle="All certifications valid"
          icon={CheckCircle2}
          badge={{ text: "100% Up-to-date", variant: "success" }}
          colorTheme="emerald"
        />

        <ComplianceKpiCard
          title="Overdue Risk Flags"
          value={overdueReportsCount}
          subtitle={overdueReportsCount > 0 ? "Requires manager intervention" : "Zero overdue training"}
          icon={AlertTriangle}
          badge={{
            text: overdueReportsCount > 0 ? "Action Required" : "Clean",
            variant: overdueReportsCount > 0 ? "danger" : "success",
          }}
          colorTheme={overdueReportsCount > 0 ? "rose" : "emerald"}
        />
      </div>

      {/* Overdue Risk Alert Box (if any) */}
      {overdueList.length > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Overdue Training Notice ({overdueList.length} items requiring immediate action)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {overdueList.map((item, idx) => (
              <div
                key={idx}
                className="p-3 bg-white rounded-lg border border-rose-100 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-800">{item.employeeName}</div>
                  <div className="text-[11px] text-slate-500">{item.courseTitle}</div>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                    {item.daysOverdue}d overdue
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Direct Reports Progress Table */}
      <TeamProgressTable reports={directReports} />
    </div>
  );
}
