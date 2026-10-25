"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  CheckCircle2,
  FileText,
  Video,
  HelpCircle,
  Award,
  Check,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { MarkdownRenderer } from "./markdown-renderer";
import { VideoPlayer } from "./video-player";
import { QuizRunner } from "@/components/quiz/quiz-runner";
import type { Course, Module, SanitizedQuiz, Certificate } from "@/types";

interface ChapterItem {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  type: string;
  estimated_minutes: number;
  progress_status?: string | null;
}

interface LessonPlayerProps {
  course: Course;
  module: Module;
  chapters: ChapterItem[];
  enrollment: any;
  progress: any;
  quiz?: any | null;
  submissions?: any[];
  certificate?: Certificate | null;
}

export function LessonPlayer({
  course,
  module,
  chapters,
  enrollment,
  progress,
  quiz,
  submissions = [],
  certificate: initialCertificate,
}: LessonPlayerProps) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(progress?.status === "COMPLETED");
  const [certificate, setCertificate] = useState<Certificate | null>(initialCertificate || null);

  const currentIndex = chapters.findIndex((c) => c.id === module.id);
  const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;

  const handleMarkComplete = async () => {
    setIsCompleting(true);
    try {
      const res = await fetch(`/api/modules/${module.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeSpentSeconds: 120 }),
      });
      const data = await res.json();
      if (data.success) {
        setIsCompleted(true);
        if (data.certificate) {
          setCertificate(data.certificate);
        }
        if (data.nextModuleId) {
          router.push(`/courses/${course.id}/modules/${data.nextModuleId}`);
        } else {
          router.push(`/courses/${course.id}`);
        }
      }
    } catch (err) {
      console.error("Failed to mark complete:", err);
    } finally {
      setIsCompleting(false);
    }
  };

  // Video embed config parser
  let videoConfig = null;
  if (module.type === "VIDEO_EMBED") {
    try {
      videoConfig = JSON.parse(module.content);
    } catch {
      videoConfig = {
        videoUrl: module.content,
        durationSeconds: 180,
      };
    }
  }

  const typeIcons: Record<string, any> = {
    RICH_MARKDOWN: <FileText className="w-4 h-4 text-blue-500" />,
    VIDEO_EMBED: <Video className="w-4 h-4 text-purple-500" />,
    INTERACTIVE_QUIZ: <HelpCircle className="w-4 h-4 text-amber-500" />,
  };

  return (
    <div className="min-h-[85vh] flex flex-col bg-slate-50/50 rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* 1. Player Top Header */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between gap-3 sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors"
            title={drawerOpen ? "Collapse curriculum drawer" : "Open curriculum drawer"}
          >
            {drawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="text-xs">
            <Link
              href={`/courses/${course.id}`}
              className="text-slate-500 hover:text-blue-600 font-medium transition-colors hidden sm:inline"
            >
              {course.title}
            </Link>
            <span className="text-slate-300 mx-2 hidden sm:inline">&rsaquo;</span>
            <span className="font-bold text-slate-900 truncate max-w-[200px] md:max-w-md inline-block align-bottom">
              {module.title}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {certificate ? (
            <Link
              href={`/certificates/${certificate.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold"
            >
              <Award className="w-3.5 h-3.5 text-emerald-600" />
              Certificate Ready
            </Link>
          ) : (
            <div className="text-xs font-semibold text-slate-600">
              Chapter {currentIndex + 1} of {chapters.length}
            </div>
          )}
        </div>
      </header>

      {/* 2. Main Content & Collapsible Drawer Grid */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Collapsible Drawer (Curriculum Sidebar) */}
        <aside
          className={`w-72 md:w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 transition-all duration-300 ease-in-out ${
            drawerOpen ? "translate-x-0" : "-translate-x-full md:-ml-80 absolute md:relative z-20 h-full"
          }`}
        >
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Course Curriculum
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
              {course.title}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
            {chapters.map((ch, idx) => {
              const isActive = ch.id === module.id;
              const isChCompleted = ch.progress_status === "COMPLETED";

              return (
                <Link
                  key={ch.id}
                  href={`/courses/${course.id}/modules/${ch.id}`}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-xs transition-all ${
                    isActive
                      ? "bg-blue-50 text-blue-900 font-bold border border-blue-200 shadow-xs"
                      : "hover:bg-slate-50 text-slate-700 font-medium"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold ${
                        isChCompleted
                          ? "bg-emerald-100 text-emerald-700"
                          : isActive
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {isChCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : idx + 1}
                    </div>
                    <span className="truncate">{ch.title}</span>
                  </div>

                  <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                    {ch.estimated_minutes}m
                  </span>
                </Link>
              );
            })}
          </div>
        </aside>

        {/* Lesson Body Viewport */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 max-w-4xl mx-auto w-full">
          {/* Header Title in Main Area */}
          <div className="mb-6 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-xs">
                {typeIcons[module.type]}
                {module.type.replace("_", " ")}
              </span>
              <span className="text-xs text-slate-400">
                Estimated: {module.estimated_minutes} minutes
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">
              {module.title}
            </h1>
            {module.description && (
              <p className="mt-2 text-slate-600 text-sm leading-relaxed">
                {module.description}
              </p>
            )}
          </div>

          {/* Module Type View */}
          {module.type === "RICH_MARKDOWN" && (
            <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
              <MarkdownRenderer content={module.content} />
            </div>
          )}

          {module.type === "VIDEO_EMBED" && videoConfig && (
            <div className="space-y-6">
              <VideoPlayer
                config={videoConfig}
                initialPositionSeconds={progress?.last_position_seconds || 0}
                isCompleted={isCompleted}
                onComplete={() => setIsCompleted(true)}
              />
            </div>
          )}

          {module.type === "INTERACTIVE_QUIZ" && quiz && (
            <QuizRunner
              quiz={quiz}
              courseId={course.id}
              moduleId={module.id}
              initialSubmissions={submissions}
              onQuizCompleted={(res, cert) => {
                if (res.passed) {
                  setIsCompleted(true);
                  if (cert) setCertificate(cert);
                }
              }}
            />
          )}

          {/* Bottom Lesson Navigation */}
          <div className="mt-10 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              {prevChapter ? (
                <Link
                  href={`/courses/${course.id}/modules/${prevChapter.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 hover:bg-white text-slate-700 text-xs font-semibold transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous: {prevChapter.title}
                </Link>
              ) : (
                <div />
              )}
            </div>

            <div className="flex items-center gap-3">
              {module.type !== "INTERACTIVE_QUIZ" && (
                <button
                  onClick={handleMarkComplete}
                  disabled={isCompleting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isCompleting
                    ? "Updating Progress..."
                    : nextChapter
                    ? "Complete & Next Lesson"
                    : "Complete Module"}
                </button>
              )}

              {nextChapter && module.type === "INTERACTIVE_QUIZ" && isCompleted && (
                <Link
                  href={`/courses/${course.id}/modules/${nextChapter.id}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all"
                >
                  Next Lesson <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
