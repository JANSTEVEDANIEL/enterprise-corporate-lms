"use client";

import React, { useState } from "react";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Award,
  Send,
  UserCheck,
} from "lucide-react";

export interface DirectReportEnrollment {
  enrollmentId: string;
  courseId: string;
  courseTitle: string;
  category: string;
  isMandatory: boolean;
  status: string;
  complianceStatus: string;
  isOverdue: boolean;
  daysRemaining: number | null;
  progressPct: number;
  completedModules: number;
  totalModules: number;
  dueDate?: string | null;
  completedAt?: string | null;
}

export interface DirectReportQuiz {
  id: string;
  score: number;
  passed: number;
  attempt_number: number;
  submitted_at: string;
  quiz_title: string;
  course_title: string;
}

export interface DirectReport {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  department: string;
  avatarUrl?: string | null;
  status: "COMPLIANT" | "IN_PROGRESS" | "OVERDUE";
  averageProgress: number;
  assignedCount: number;
  completedCount: number;
  hasOverdue: boolean;
  enrollments: DirectReportEnrollment[];
  recentQuizzes?: DirectReportQuiz[];
}

interface TeamProgressTableProps {
  reports: DirectReport[];
  onNudgeSuccess?: (message: string) => void;
}

export function TeamProgressTable({ reports, onNudgeSuccess }: TeamProgressTableProps) {
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [nudgingId, setNudgingId] = useState<string | null>(null);
  const [nudgeMessage, setNudgeMessage] = useState<{ [id: string]: string }>({});

  const toggleExpand = (reportId: string) => {
    setExpandedReportId(expandedReportId === reportId ? null : reportId);
  };

  const handleNudge = async (employeeId: string, courseId?: string, employeeName?: string) => {
    setNudgingId(employeeId);
    try {
      const response = await fetch("/api/manager/nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          courseId,
          message: "Please complete your mandatory training requirements.",
        }),
      });
      const data = await response.json();
      if (data.success) {
        setNudgeMessage((prev) => ({
          ...prev,
          [employeeId]: `Nudge delivered to ${employeeName || "employee"}!`,
        }));
        if (onNudgeSuccess) {
          onNudgeSuccess(data.message);
        }
        setTimeout(() => {
          setNudgeMessage((prev) => {
            const next = { ...prev };
            delete next[employeeId];
            return next;
          });
        }, 4000);
      }
    } catch (err) {
      console.error("Nudge error:", err);
    } finally {
      setNudgingId(null);
    }
  };

  const statusBadges = {
    COMPLIANT: {
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: CheckCircle2,
      label: "Compliant",
    },
    IN_PROGRESS: {
      bg: "bg-blue-50 text-blue-700 border-blue-200",
      icon: Clock,
      label: "In Progress",
    },
    OVERDUE: {
      bg: "bg-rose-50 text-rose-700 border-rose-200",
      icon: AlertTriangle,
      label: "Overdue Risk",
    },
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Direct Reports Roster</h3>
          <p className="text-xs text-slate-500">
            Monitor real-time course completions, overdue deadlines, and issue training alerts.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{reports.length}</span> Direct Reports
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {reports.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No direct reports assigned to this account.
          </div>
        ) : (
          reports.map((report) => {
            const isExpanded = expandedReportId === report.id;
            const badge = statusBadges[report.status];
            const BadgeIcon = badge.icon;
            const successNote = nudgeMessage[report.id];

            return (
              <div key={report.id} className="transition-colors hover:bg-slate-50/50">
                {/* Main Row */}
                <div className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left: User Info + Expander */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleExpand(report.id)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                      title={isExpanded ? "Collapse drilldown" : "Expand curriculum drilldown"}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-600" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs uppercase border border-slate-300">
                      {report.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{report.name}</span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.bg}`}
                        >
                          <BadgeIcon className="w-3 h-3" />
                          <span>{badge.label}</span>
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {report.jobTitle} • {report.department}
                      </div>
                    </div>
                  </div>

                  {/* Middle: Progress Bar */}
                  <div className="w-full sm:w-48 space-y-1">
                    <div className="flex justify-between text-[11px] font-medium text-slate-600">
                      <span>Curriculum Progress</span>
                      <span>{report.averageProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          report.status === "OVERDUE"
                            ? "bg-rose-500"
                            : report.averageProgress === 100
                            ? "bg-emerald-500"
                            : "bg-brand-600"
                        }`}
                        style={{ width: `${report.averageProgress}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {report.completedCount} of {report.assignedCount} courses certified
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {successNote ? (
                      <span className="text-xs text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{successNote}</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleNudge(report.id, undefined, report.name)}
                        disabled={nudgingId === report.id}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                          report.status === "OVERDUE"
                            ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <Bell className={`w-3.5 h-3.5 ${nudgingId === report.id ? "animate-spin" : ""}`} />
                        <span>{nudgingId === report.id ? "Nudging..." : "Send Nudge"}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Drilldown Section */}
                {isExpanded && (
                  <div className="bg-slate-50/70 p-4 sm:px-12 border-t border-slate-100 space-y-3">
                    <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                      <span>Assigned Modules & Compliance Status</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {report.enrollments.map((enr) => (
                        <div
                          key={enr.enrollmentId}
                          className="p-3 bg-white rounded-lg border border-slate-200/90 text-xs space-y-2 shadow-2xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-semibold text-slate-800 line-clamp-1">
                                {enr.courseTitle}
                              </div>
                              <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">
                                {enr.category} • {enr.isMandatory ? "Mandatory" : "Optional"}
                              </div>
                            </div>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                enr.isOverdue
                                  ? "bg-rose-100 text-rose-800"
                                  : enr.status === "COMPLETED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {enr.isOverdue ? "OVERDUE" : enr.status}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-slate-500">
                              <span>Progress ({enr.completedModules}/{enr.totalModules} modules)</span>
                              <span>{enr.progressPct}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  enr.isOverdue
                                    ? "bg-rose-500"
                                    : enr.progressPct === 100
                                    ? "bg-emerald-500"
                                    : "bg-brand-500"
                                }`}
                                style={{ width: `${enr.progressPct}%` }}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-500">
                            <span>
                              {enr.dueDate
                                ? `Due: ${new Date(enr.dueDate).toLocaleDateString()}`
                                : "No hard deadline"}
                            </span>
                            {enr.isOverdue && (
                              <button
                                type="button"
                                onClick={() => handleNudge(report.id, enr.courseId, report.name)}
                                className="text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <Send className="w-2.5 h-2.5" />
                                <span>Urgent Nudge</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {report.recentQuizzes && report.recentQuizzes.length > 0 && (
                      <div className="pt-2">
                        <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                          <Award className="w-3.5 h-3.5 text-slate-400" />
                          <span>Recent Quiz Attempts</span>
                        </div>
                        <div className="space-y-1">
                          {report.recentQuizzes.map((quiz) => (
                            <div
                              key={quiz.id}
                              className="flex items-center justify-between text-xs py-1 px-2.5 bg-white rounded border border-slate-200/80"
                            >
                              <span className="text-slate-700 truncate">{quiz.quiz_title}</span>
                              <span
                                className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                                  quiz.passed
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-rose-50 text-rose-700"
                                }`}
                              >
                                {quiz.score}% ({quiz.passed ? "PASSED" : "FAILED"}, Attempt #{quiz.attempt_number})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
