"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PlayCircle,
  CheckCircle2,
  Circle,
  Lock,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  FileArchive,
  Award,
  ArrowLeft,
  ArrowRight,
  HelpCircle,
  Menu,
  X,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  BookOpen,
} from "lucide-react";
import { VideoPlayerControls } from "./video-player-controls";
import { CertificateModal, type CertificateRecord } from "./certificate-modal";
import type { FileAttachment } from "@/types/marketplace";

export interface StudentLessonPlayerProps {
  course: {
    id: string;
    title: string;
    slug: string;
    description: string;
    category: string;
    creator_name?: string;
    total_weeks: number;
    thumbnail_url?: string | null;
  };
  weeks: Array<{
    id: string;
    week_number: number;
    title: string;
    description: string;
    lessons: Array<{
      id: string;
      week_id: string;
      title: string;
      order_index: number;
      duration_seconds: number;
      video_url: string | null;
      supplementary_files: FileAttachment[];
      is_preview: boolean;
      progress_status?: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
      last_position_seconds?: number;
    }>;
    quiz?: {
      id: string;
      title: string;
      passing_score_pct: number;
      questions: Array<{
        id: string;
        prompt: string;
        options: string[];
        correct_index?: number;
        explanation?: string;
      }>;
    } | null;
  }>;
  initialProgressPct: number;
  initialCertificate?: CertificateRecord | null;
  currentUser?: {
    id: string;
    name: string;
    role: string;
  };
}

export function StudentLessonPlayer({
  course,
  weeks: initialWeeks,
  initialProgressPct = 0,
  initialCertificate = null,
  currentUser,
}: StudentLessonPlayerProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [weeks, setWeeks] = useState(initialWeeks);
  const [progressPct, setProgressPct] = useState(initialProgressPct);
  const [certificate, setCertificate] = useState<CertificateRecord | null>(initialCertificate);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);

  // Flatten all lessons across weeks to support sequential navigation
  const allLessons = weeks.flatMap((w) =>
    w.lessons.map((l) => ({ ...l, weekNumber: w.week_number, weekTitle: w.title }))
  );

  // Default active lesson: first non-completed lesson or first lesson
  const initialLesson =
    allLessons.find((l) => l.progress_status !== "COMPLETED") || allLessons[0] || null;

  const [activeLessonId, setActiveLessonId] = useState<string>(initialLesson?.id || "");
  const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>(() => {
    const acc: Record<number, boolean> = {};
    weeks.forEach((w) => {
      acc[w.week_number] = true;
    });
    return acc;
  });

  // Active quiz state (if taking a weekly knowledge check)
  const [activeQuizWeekNum, setActiveQuizWeekNum] = useState<number | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<any | null>(null);

  const activeLesson = allLessons.find((l) => l.id === activeLessonId) || allLessons[0] || null;
  const currentLessonIndex = allLessons.findIndex((l) => l.id === activeLessonId);
  const prevLesson = currentLessonIndex > 0 ? allLessons[currentLessonIndex - 1] : null;
  const nextLesson = currentLessonIndex < allLessons.length - 1 ? allLessons[currentLessonIndex + 1] : null;

  const activeWeek = weeks.find((w) =>
    w.lessons.some((l) => l.id === activeLessonId)
  ) || weeks[0];

  const toggleWeek = (num: number) => {
    setExpandedWeeks((prev) => ({ ...prev, [num]: !prev[num] }));
  };

  // Record lesson progress to API
  const handleRecordProgress = async (
    lessonId: string,
    status: "IN_PROGRESS" | "COMPLETED",
    playbackPercentage?: number,
    positionSeconds?: number
  ) => {
    try {
      const res = await fetch(`/api/courses/${course.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lesson_id: lessonId,
          status,
          playback_percentage: playbackPercentage,
          last_position_seconds: positionSeconds,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setProgressPct(data.progress_pct);

        // Update local lesson status in state
        setWeeks((prevWeeks) =>
          prevWeeks.map((w) => ({
            ...w,
            lessons: w.lessons.map((l) =>
              l.id === lessonId ? { ...l, progress_status: status } : l
            ),
          }))
        );

        if (data.is_completed && data.certificate) {
          setCertificate(data.certificate);
          setIsCertModalOpen(true);
        }
      }
    } catch (err) {
      console.error("Failed to record progress:", err);
    }
  };

  // Mark active lesson as completed
  const handleMarkCompleted = async () => {
    if (!activeLesson) return;
    await handleRecordProgress(activeLesson.id, "COMPLETED", 100);
  };

  // 90%+ Video auto-completion callback
  const handleAutoCompleted = async () => {
    if (!activeLesson) return;
    await handleRecordProgress(activeLesson.id, "COMPLETED", 95);
  };

  // Submit weekly knowledge check quiz
  const handleQuizSubmit = async (quizId: string) => {
    setQuizSubmitting(true);
    try {
      const res = await fetch(`/api/quizzes/${quizId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: quizAnswers }),
      });
      const data = await res.json();
      setQuizResult(data);
    } catch (err) {
      console.error("Quiz submission failed:", err);
    } finally {
      setQuizSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      {/* Top Learning Navigation Bar */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-slate-900/90 border-b border-slate-800 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Link>

          <div className="border-l border-slate-800 pl-3">
            <h1 className="text-sm sm:text-base font-bold text-white truncate max-w-md">
              {course.title}
            </h1>
            <p className="text-[11px] text-slate-400">
              Instructor: {course.creator_name || "Dr. Aris Thorne"} • {course.total_weeks} Weeks Self-Paced
            </p>
          </div>
        </div>

        {/* Progress & Certificate Trigger */}
        <div className="flex items-center gap-3">
          {/* Progress Tracker */}
          <div className="hidden sm:flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400">Curriculum Progress:</span>
              <span className="font-bold text-emerald-400">{progressPct}%</span>
            </div>
            <div className="w-32 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Certificate Button (Unlocks upon 100% Progress) */}
          {progressPct === 100 ? (
            <button
              type="button"
              onClick={() => setIsCertModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 text-xs font-extrabold shadow-md shadow-amber-500/20 hover:brightness-110 transition-all animate-pulse"
              data-testid="certificate-badge"
            >
              <Award className="w-4 h-4" />
              <span>Claim Certificate</span>
            </button>
          ) : (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-400 text-xs font-medium cursor-not-allowed"
              title="Complete all 1-7+ weeks to unlock Certificate of Completion"
            >
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>Cert Unlocks at 100%</span>
            </div>
          )}

          {/* Toggle Curriculum Drawer on mobile */}
          <button
            type="button"
            onClick={() => setDrawerOpen(!drawerOpen)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
            title="Toggle Curriculum Outline"
          >
            {drawerOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Learning Workspace Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left/Center: Video Player & Lesson Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto max-w-5xl">
          {/* Active Quiz View or Video Player View */}
          {activeQuizWeekNum !== null ? (
            /* Weekly Knowledge Check Interactive Quiz Component */
            <div className="backdrop-blur-xl bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-bold text-white">
                    Week {activeQuizWeekNum} Knowledge Check Quiz
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveQuizWeekNum(null);
                    setQuizResult(null);
                  }}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Return to Video Lesson
                </button>
              </div>

              {/* Quiz Questions */}
              {(() => {
                const weekObj = weeks.find((w) => w.week_number === activeQuizWeekNum);
                const quiz = weekObj?.quiz;
                if (!quiz || !quiz.questions || quiz.questions.length === 0) {
                  return (
                    <div className="text-slate-400 text-sm py-8 text-center">
                      No quiz questions configured for this milestone week.
                    </div>
                  );
                }

                return (
                  <div className="space-y-6">
                    <p className="text-xs text-slate-400">
                      Answer all multiple-choice questions below. Passing score required:{" "}
                      <strong className="text-white">{quiz.passing_score_pct}%</strong>.
                    </p>

                    {quiz.questions.map((q, idx) => (
                      <div
                        key={q.id}
                        className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-3"
                      >
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <p className="text-sm font-semibold text-white">{q.prompt}</p>
                        </div>

                        {/* Options */}
                        <div className="grid grid-cols-1 gap-2 pt-1 pl-9">
                          {q.options.map((opt, optIdx) => {
                            const isSelected = quizAnswers[q.id] === optIdx;
                            return (
                              <label
                                key={optIdx}
                                className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                                  isSelected
                                    ? "bg-indigo-600/20 border-indigo-500 text-white font-medium"
                                    : "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/60"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`question_${q.id}`}
                                  checked={isSelected}
                                  onChange={() =>
                                    setQuizAnswers((prev) => ({ ...prev, [q.id]: optIdx }))
                                  }
                                  className="accent-indigo-500"
                                />
                                <span>{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {/* Quiz Instant Scoring Feedback Result */}
                    {quizResult && (
                      <div
                        className={`p-5 rounded-2xl border ${
                          quizResult.passed
                            ? "bg-emerald-950/50 border-emerald-500/40 text-emerald-200"
                            : "bg-rose-950/50 border-rose-500/40 text-rose-200"
                        } space-y-2`}
                      >
                        <div className="flex items-center gap-2 font-bold text-sm">
                          {quizResult.passed ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <RotateCcw className="w-5 h-5 text-rose-400" />
                          )}
                          <span>
                            {quizResult.passed
                              ? `Passed! Score: ${quizResult.scorePct}%`
                              : `Failed. Score: ${quizResult.scorePct}% (Passing: ${quiz.passing_score_pct}%)`}
                          </span>
                        </div>
                        <p className="text-xs opacity-90">
                          {quizResult.passed
                            ? "Great job! You have satisfied the knowledge check requirement for this weekly module."
                            : "Review the lesson materials and retake the quiz to pass this week's requirement."}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        disabled={quizSubmitting}
                        onClick={() => handleQuizSubmit(quiz.id)}
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
                      >
                        {quizSubmitting ? "Evaluating..." : "Submit Answers for Instant Grading"}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* HTML5 Video Player View */
            <div className="space-y-6">
              <VideoPlayerControls
                videoRef={videoRef}
                videoUrl={activeLesson?.video_url}
                lessonTitle={activeLesson?.title || "Lesson"}
                durationSeconds={activeLesson?.duration_seconds || 600}
                initialPositionSeconds={activeLesson?.last_position_seconds || 0}
                isCompleted={activeLesson?.progress_status === "COMPLETED"}
                onAutoCompleted={handleAutoCompleted}
              />

              {/* Lesson Action Header */}
              <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-brand-400 tracking-wider">
                      Week {activeLesson?.weekNumber} Milestone Lesson
                    </span>
                    <h2 className="text-xl font-extrabold text-white pt-0.5">
                      {activeLesson?.title}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Duration: {Math.round((activeLesson?.duration_seconds || 0) / 60)} mins • Sequential Self-Paced Track
                    </p>
                  </div>

                  {/* Mark as Completed Button */}
                  <div className="flex items-center gap-3">
                    {activeLesson?.progress_status === "COMPLETED" ? (
                      <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Completed</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleMarkCompleted}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Mark as Completed</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Lesson Navigation (Previous / Next) */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs">
                  {prevLesson ? (
                    <button
                      type="button"
                      onClick={() => setActiveLessonId(prevLesson.id)}
                      className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Previous: {prevLesson.title}</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  {nextLesson ? (
                    <button
                      type="button"
                      onClick={() => setActiveLessonId(nextLesson.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
                    >
                      <span>Next: {nextLesson.title}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <div />
                  )}
                </div>
              </div>

              {/* Downloadable Supplementary Attachments (PDF/ZIP) */}
              <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-brand-400" />
                    <h3 className="text-sm font-bold text-white">
                      Supplementary Resources & Attachments
                    </h3>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Student Access Granted
                  </span>
                </div>

                {activeLesson?.supplementary_files && activeLesson.supplementary_files.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {activeLesson.supplementary_files.map((file, idx) => {
                      const isZip =
                        file.file_type === "ZIP" || (file.name && file.name.endsWith(".zip"));
                      const formattedSize = file.file_size_bytes
                        ? `${(file.file_size_bytes / (1024 * 1024)).toFixed(1)} MB`
                        : "Download Ready";

                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 text-slate-300">
                              {isZip ? (
                                <FileArchive className="w-5 h-5 text-amber-400" />
                              ) : (
                                <FileText className="w-5 h-5 text-rose-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">
                                {file.name}
                              </p>
                              <p className="text-[10px] text-slate-400">{formattedSize}</p>
                            </div>
                          </div>

                          <a
                            href={
                              file.file_url ||
                              `/api/courses/${course.id}/lessons/${activeLesson.id}/attachment?fileName=${encodeURIComponent(
                                file.name
                              )}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 text-xs font-semibold border border-brand-500/30 flex items-center gap-1 shrink-0 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </a>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    No downloadable files attached to this lesson.
                  </p>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Right Drawer: Sequential 1 to 7+ Week Curriculum Navigation */}
        <aside
          className={`lg:w-96 border-l border-slate-800 bg-slate-950/90 backdrop-blur-xl flex flex-col shrink-0 transition-all duration-300 ${
            drawerOpen ? "block" : "hidden lg:block"
          }`}
        >
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Curriculum Outline</h2>
              <p className="text-[11px] text-slate-400">
                Weeks 1 to {course.total_weeks} (Self-Paced Unlocked)
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-400">
              {allLessons.filter((l) => l.progress_status === "COMPLETED").length}/{allLessons.length} Done
            </span>
          </div>

          {/* Sequential Weeks List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {weeks.map((week) => {
              const isExpanded = !!expandedWeeks[week.week_number];
              const weekCompleted =
                week.lessons.length > 0 &&
                week.lessons.every((l) => l.progress_status === "COMPLETED");

              return (
                <div
                  key={week.id}
                  className="rounded-2xl border border-slate-800/80 bg-slate-900/50 overflow-hidden"
                >
                  {/* Week Accordion Header */}
                  <button
                    type="button"
                    onClick={() => toggleWeek(week.week_number)}
                    className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                          weekCompleted
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {week.week_number}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">
                          Week {week.week_number}: {week.title}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {week.lessons.length} Lessons • Self-Paced
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {weekCompleted && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      )}
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Week Lessons List */}
                  {isExpanded && (
                    <div className="px-2 pb-2 space-y-1 border-t border-slate-800/60 pt-1.5">
                      {week.lessons.map((lesson) => {
                        const isActive = lesson.id === activeLessonId && activeQuizWeekNum === null;
                        const isDone = lesson.progress_status === "COMPLETED";

                        return (
                          <button
                            key={lesson.id}
                            type="button"
                            onClick={() => {
                              setActiveQuizWeekNum(null);
                              setActiveLessonId(lesson.id);
                            }}
                            className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between gap-2.5 text-xs transition-all ${
                              isActive
                                ? "bg-brand-600 text-white font-semibold shadow-md"
                                : isDone
                                ? "bg-emerald-500/10 text-slate-200 hover:bg-emerald-500/15"
                                : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isDone ? (
                                <CheckCircle2
                                  className={`w-4 h-4 shrink-0 ${
                                    isActive ? "text-white" : "text-emerald-400"
                                  }`}
                                />
                              ) : isActive ? (
                                <PlayCircle className="w-4 h-4 text-white shrink-0" />
                              ) : (
                                <Circle className="w-4 h-4 text-slate-600 shrink-0" />
                              )}
                              <span className="truncate">{lesson.title}</span>
                            </div>

                            <span
                              className={`text-[10px] shrink-0 ${
                                isActive ? "text-blue-100" : "text-slate-400"
                              }`}
                            >
                              {Math.round(lesson.duration_seconds / 60)}m
                            </span>
                          </button>
                        );
                      })}

                      {/* Weekly Knowledge Check Button if configured */}
                      {week.quiz && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveQuizWeekNum(week.week_number);
                            setQuizResult(null);
                          }}
                          className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between gap-2 text-xs font-semibold border transition-all mt-1 ${
                            activeQuizWeekNum === week.week_number
                              ? "bg-indigo-600 text-white border-indigo-500"
                              : "bg-indigo-950/30 text-indigo-300 border-indigo-900/60 hover:bg-indigo-900/40"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <HelpCircle className="w-4 h-4 text-indigo-400" />
                            <span>Week {week.week_number} Knowledge Check</span>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-200">
                            Quiz
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {/* Certificate Modal */}
      <CertificateModal
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        certificate={
          certificate || {
            certificate_code: "CERT-MKT-2026-PENDING",
            user_name: currentUser?.name || "Sophia Chen",
            course_title: course.title,
            issued_at: new Date().toISOString(),
            verification_hash: "3b08e2bf5e156477d9c19d45e48ffad61517409c91b5c3ff018ff8eb4dd3f79d",
          }
        }
      />
    </div>
  );
}
