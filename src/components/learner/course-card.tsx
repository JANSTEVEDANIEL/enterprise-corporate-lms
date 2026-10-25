"use client";
import React from "react";
import Link from "next/link";
import { BookOpen, Clock, ShieldCheck, CheckCircle2, Play, Award } from "lucide-react";
import { ProgressBar } from "./progress-bar";

export interface CourseCardData {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  is_mandatory: number;
  estimated_minutes: number;
  passing_score_pct: number;
  version: string;
  modules_count?: number;
  enrollment_id?: string | null;
  enrollment_status?: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | null;
  progress_pct?: number | null;
}

interface CourseCardProps {
  course: CourseCardData;
  onEnroll?: (courseId: string) => void;
  isEnrolling?: boolean;
}

export function CourseCard({ course, onEnroll, isEnrolling }: CourseCardProps) {
  const isEnrolled = !!course.enrollment_status;
  const isCompleted = course.enrollment_status === "COMPLETED";
  const isInProgress = course.enrollment_status === "IN_PROGRESS";
  const progressPct = course.progress_pct ?? 0;

  const categoryStyles: Record<string, { bg: string; text: string; border: string }> = {
    ONBOARDING: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    COMPLIANCE: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    SECURITY: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
    TECHNICAL_UPSKILLING: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
    LEADERSHIP: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  };

  const catStyle = categoryStyles[course.category] || {
    bg: "bg-slate-50",
    text: "text-slate-700",
    border: "border-slate-200",
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group">
      <div className="p-5">
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${catStyle.bg} ${catStyle.text} ${catStyle.border} uppercase tracking-wider`}
          >
            {course.category.replace("_", " ")}
          </span>

          <div className="flex items-center gap-1.5">
            {course.is_mandatory === 1 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                MANDATORY
              </span>
            )}
            <span className="text-[11px] text-slate-400 font-medium">v{course.version}</span>
          </div>
        </div>

        {/* Title & Description */}
        <Link href={`/courses/${course.id}`}>
          <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2">
            {course.title}
          </h3>
        </Link>
        <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed">
          {course.description}
        </p>

        {/* Metadata info */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{course.estimated_minutes} mins</span>
          </div>

          {course.modules_count !== undefined && (
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-slate-400" />
              <span>{course.modules_count} modules</span>
            </div>
          )}

          <div className="flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-slate-400" />
            <span>Pass: {course.passing_score_pct}%</span>
          </div>
        </div>

        {/* Progress Bar if enrolled */}
        {isEnrolled && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
              <span className="text-slate-500 font-normal">Progress</span>
              <span>{progressPct}%</span>
            </div>
            <ProgressBar
              value={progressPct}
              size="sm"
              color={isCompleted ? "emerald" : "brand"}
            />
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
        {isCompleted ? (
          <div className="flex items-center justify-between w-full">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Completed
            </span>
            <Link
              href={`/courses/${course.id}`}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors"
            >
              Review Course &rarr;
            </Link>
          </div>
        ) : isInProgress ? (
          <Link
            href={`/courses/${course.id}`}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
          >
            <Play className="w-3.5 h-3.5" />
            Resume ({progressPct}%)
          </Link>
        ) : isEnrolled ? (
          <Link
            href={`/courses/${course.id}`}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
          >
            <Play className="w-3.5 h-3.5" />
            Start Course
          </Link>
        ) : onEnroll ? (
          <button
            onClick={() => onEnroll(course.id)}
            disabled={isEnrolling}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
          >
            {isEnrolling ? "Enrolling..." : "Enroll Now"}
          </button>
        ) : (
          <Link
            href={`/courses/${course.id}`}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
          >
            Explore Course
          </Link>
        )}
      </div>
    </div>
  );
}
