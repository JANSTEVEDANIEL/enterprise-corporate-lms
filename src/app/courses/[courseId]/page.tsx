import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, initDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ProgressBar } from "@/components/learner/progress-bar";
import {
  BookOpen,
  Clock,
  Award,
  ShieldCheck,
  CheckCircle2,
  Play,
  FileText,
  Video,
  HelpCircle,
  ArrowRight,
  ChevronRight,
} from "lucide-react";

interface CourseDetailPageProps {
  params: Promise<{
    courseId: string;
  }>;
}

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  initDb();
  const db = getDb();
  const currentUser = await getCurrentUser();
  const { courseId } = await params;

  // Fetch course
  const course = db
    .prepare("SELECT * FROM courses WHERE id = ? OR slug = ?")
    .get(courseId, courseId) as any;

  if (!course) {
    notFound();
  }

  // Fetch enrollment
  const enrollment = db
    .prepare("SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?")
    .get(currentUser.id, course.id) as any;

  // Fetch modules with user's progress
  const modules = db
    .prepare(`
      SELECT 
        m.*,
        mp.status as progress_status,
        mp.completed_at,
        mp.time_spent_seconds,
        q.id as quiz_id,
        q.passing_score_pct as quiz_passing_score
      FROM modules m
      LEFT JOIN module_progress mp ON mp.module_id = m.id AND mp.enrollment_id = ?
      LEFT JOIN quizzes q ON q.module_id = m.id
      WHERE m.course_id = ?
      ORDER BY m.order_index ASC
    `)
    .all(enrollment?.id || null, course.id) as any[];

  // Fetch certificate if completed
  let certificate = null;
  if (enrollment && enrollment.status === "COMPLETED") {
    certificate = db
      .prepare("SELECT * FROM certificates WHERE enrollment_id = ?")
      .get(enrollment.id) as any;
  }

  // Identify next module to resume
  const nextIncompleteModule =
    modules.find((m) => m.progress_status !== "COMPLETED") || modules[0];

  const isEnrolled = !!enrollment;
  const isCompleted = enrollment?.status === "COMPLETED";
  const progressPct = enrollment?.progress_pct ?? 0;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* 1. Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Link href="/courses" className="hover:text-blue-600 transition-colors">
          Course Catalog
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-900 font-semibold truncate max-w-sm">
          {course.title}
        </span>
      </nav>

      {/* 2. Course Header Hero */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
              {course.category.replace("_", " ")}
            </span>
            {course.is_mandatory === 1 && (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                MANDATORY
              </span>
            )}
            <span className="text-xs text-slate-400 font-medium">v{course.version}</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>{course.estimated_minutes} Minutes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-slate-400" />
              <span>Pass: {course.passing_score_pct}%</span>
            </div>
          </div>
        </div>

        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">
            {course.title}
          </h1>
          <p className="mt-3 text-slate-600 text-sm md:text-base leading-relaxed max-w-3xl">
            {course.description}
          </p>
        </div>

        {/* Enrollment & Action Bar */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          {isEnrolled ? (
            <div className="w-full sm:w-auto flex-1 max-w-md">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                <span className="text-slate-500 font-normal">Your Course Progress</span>
                <span>{progressPct}% Completed</span>
              </div>
              <ProgressBar
                value={progressPct}
                size="md"
                color={isCompleted ? "emerald" : "brand"}
              />
            </div>
          ) : (
            <div className="text-xs text-slate-500">
              Target Audience: <strong className="text-slate-800">{course.target_role}</strong>
            </div>
          )}

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {isCompleted ? (
              <>
                {certificate && (
                  <Link
                    href={`/certificates/${certificate.id}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 text-xs font-bold transition-all"
                  >
                    <Award className="w-4 h-4 text-emerald-600" />
                    View Certificate
                  </Link>
                )}
                {nextIncompleteModule && (
                  <Link
                    href={`/courses/${course.id}/modules/${nextIncompleteModule.id}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all"
                  >
                    Review Course
                  </Link>
                )}
              </>
            ) : nextIncompleteModule ? (
              <Link
                href={`/courses/${course.id}/modules/${nextIncompleteModule.id}`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition-all"
              >
                <Play className="w-4 h-4 fill-current" />
                {progressPct > 0 ? "Resume Learning" : "Start Course"}
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {/* 3. Curriculum Syllabus */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              Modular Curriculum Syllabus ({modules.length} Lessons)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Structured progressive modules designed for self-paced corporate learning.
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {modules.map((mod, index) => {
            const isModCompleted = mod.progress_status === "COMPLETED";
            const isModInProgress = mod.progress_status === "IN_PROGRESS";

            const typeIcons: Record<string, any> = {
              RICH_MARKDOWN: <FileText className="w-4 h-4 text-blue-500" />,
              VIDEO_EMBED: <Video className="w-4 h-4 text-purple-500" />,
              INTERACTIVE_QUIZ: <HelpCircle className="w-4 h-4 text-amber-500" />,
            };

            const typeLabels: Record<string, string> = {
              RICH_MARKDOWN: "Document / Manual",
              VIDEO_EMBED: "Video Walkthrough",
              INTERACTIVE_QUIZ: "Knowledge Check Exam",
            };

            return (
              <Link
                key={mod.id}
                href={`/courses/${course.id}/modules/${mod.id}`}
                className="p-5 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors group"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                      isModCompleted
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : isModInProgress
                        ? "bg-blue-50 border-blue-200 text-blue-700"
                        : "bg-slate-50 border-slate-200 text-slate-500 group-hover:border-blue-300"
                    }`}
                  >
                    {isModCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <span className="font-bold text-xs">{index + 1}</span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                        {typeIcons[mod.type]}
                        {typeLabels[mod.type] || mod.type}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-[11px] text-slate-400">
                        {mod.estimated_minutes} mins
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {mod.title}
                    </h3>
                    {mod.description && (
                      <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                        {mod.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {isModCompleted ? (
                    <span className="text-xs font-semibold text-emerald-600">Completed</span>
                  ) : (
                    <span className="text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Start <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
