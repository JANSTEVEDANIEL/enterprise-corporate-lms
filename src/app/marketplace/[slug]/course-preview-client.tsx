"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  PlayCircle,
  Lock,
  CheckCircle2,
  Users,
  Star,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  FileText,
  HelpCircle,
  X,
  Wallet,
} from "lucide-react";
import { CheckoutModal } from "@/components/marketplace/checkout-modal";
import type { SessionUser } from "@/types";

export interface CoursePreviewClientProps {
  course: any;
  weeks: any[];
  currentUser?: SessionUser | null;
  isEnrolled: boolean;
  studentWalletBalance?: number;
}

export function CoursePreviewClient({
  course,
  weeks,
  currentUser,
  isEnrolled: initialIsEnrolled,
  studentWalletBalance = 500.0,
}: CoursePreviewClientProps) {
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(initialIsEnrolled);
  const [activePreviewLesson, setActivePreviewLesson] = useState<any | null>(null);

  const priceDollars =
    course.price_dollars !== undefined
      ? course.price_dollars
      : course.price_cents !== undefined
      ? course.price_cents / 100
      : course.price !== undefined
      ? course.price
      : 99.0;

  const isFree = priceDollars === 0;

  // Calculate total lessons and total minutes
  let totalLessonsCount = 0;
  let totalSeconds = 0;
  for (const w of weeks) {
    if (w.lessons && Array.isArray(w.lessons)) {
      totalLessonsCount += w.lessons.length;
      for (const l of w.lessons) {
        totalSeconds += l.duration_seconds || 0;
      }
    }
  }
  const totalHours = Math.max(1, Math.round(totalSeconds / 3600));

  function handleEnrollSuccess() {
    setIsEnrolled(true);
  }

  function formatDuration(seconds: number): string {
    if (!seconds) return "15 mins";
    const mins = Math.round(seconds / 60);
    return `${mins} mins`;
  }

  return (
    <div className="space-y-10 pb-20">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Link href="/marketplace" className="hover:text-brand-500 transition-colors">
          Marketplace
        </Link>
        <span>/</span>
        <span className="text-slate-700 dark:text-slate-300 font-medium">
          {course.category}
        </span>
        <span>/</span>
        <span className="text-slate-900 dark:text-white truncate max-w-xs">
          {course.title}
        </span>
      </div>

      {/* Hero Showcase Section */}
      <section className="relative overflow-hidden rounded-3xl backdrop-blur-xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-brand-950/80 border border-slate-700/60 p-8 sm:p-12 text-white shadow-2xl">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left Column: Metadata & Headline */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-brand-500/20 text-brand-300 border border-brand-400/30">
                {course.category}
              </span>
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/80">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{course.rating || 4.9}</span>
                <span className="text-slate-400 font-normal">
                  ({course.enrolled_count ?? 142} students enrolled)
                </span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              {course.title}
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
              {course.description}
            </p>

            {/* Quick Metrics Bar */}
            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">
                  {(course.creator_name || "Aris")[0]}
                </div>
                <span>Instructor: <strong className="text-white">{course.creator_name || "Dr. Aris Thorne"}</strong></span>
              </div>

              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-brand-400" />
                <span>{course.total_weeks || weeks.length} Sequential Weeks</span>
              </div>

              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-brand-400" />
                <span>{totalHours}+ Hours Video Instruction</span>
              </div>

              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Verified Certificate of Completion</span>
              </div>
            </div>
          </div>

          {/* Right Column: Sticky Enrollment Box */}
          <div className="w-full backdrop-blur-2xl bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                  Tuition
                </div>
                <div className="text-3xl font-extrabold text-white">
                  {isFree ? "FREE" : `$${priceDollars.toFixed(2)}`}
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] text-slate-400">Wallet Demo Balance</div>
                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1 justify-end">
                  <Wallet className="w-3.5 h-3.5" />
                  <span>${studentWalletBalance.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {isEnrolled ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>You are enrolled in this cohort!</span>
                </div>
                <Link
                  href="/dashboard"
                  className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-lg shadow-brand-500/30 transition-all flex items-center justify-center gap-2"
                >
                  <span>Go to Student Learning Hub</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setIsCheckoutOpen(true)}
                  className="w-full py-3.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm shadow-xl shadow-brand-500/30 transition-all flex items-center justify-center gap-2 group"
                >
                  <Sparkles className="w-4 h-4 text-brand-200 group-hover:rotate-12 transition-transform" />
                  <span>Enroll / Buy Now with Wallet</span>
                </button>

                <p className="text-[11px] text-center text-slate-400">
                  Instant simulated checkout • 10% platform / 90% creator split
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-slate-700/60 space-y-2 text-xs text-slate-300">
              <div className="font-semibold text-slate-200">This cohort includes:</div>
              <ul className="space-y-1.5 text-[11px] text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />
                  <span>{course.total_weeks || weeks.length} sequential milestone modules</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />
                  <span>{totalLessonsCount} high-definition video lessons</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />
                  <span>Downloadable PDF guides & code repositories</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />
                  <span>Weekly knowledge check quizzes with instant grading</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />
                  <span>Automated tamper-evident Certificate of Completion</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-brand-600/15 rounded-full blur-3xl pointer-events-none" />
      </section>

      {/* Complete Curriculum Outline: Week 1 Through Week 7+ */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-brand-500" />
              <span>Complete Curriculum Outline</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Structured sequential milestone roadmap from Week 1 through Week {course.total_weeks || weeks.length}+
            </p>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-white">{weeks.length}</span> Weeks •{" "}
            <span className="font-semibold text-slate-900 dark:text-white">{totalLessonsCount}</span> Lessons
          </div>
        </div>

        {/* Weeks Accordion / Stack */}
        <div className="space-y-4">
          {weeks.map((week) => {
            const hasQuiz = !!week.quiz;
            const weekLessons = week.lessons || [];

            return (
              <div
                key={week.id || week.week_number}
                className="backdrop-blur-md bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4"
              >
                {/* Week Header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 flex items-center justify-center font-bold text-xs shrink-0">
                      W{week.week_number}
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        {week.title}
                      </h3>
                      {week.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {week.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>{weekLessons.length} lessons</span>
                    {hasQuiz && (
                      <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[10px] font-semibold flex items-center gap-1">
                        <HelpCircle className="w-3 h-3" />
                        <span>Quiz</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Lessons List in This Week */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  {weekLessons.map((lesson: any) => {
                    const isPreview = lesson.is_preview === 1 || lesson.is_preview === true;
                    const canPlay = isPreview || isEnrolled;

                    return (
                      <div
                        key={lesson.id}
                        className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                          isPreview
                            ? "bg-brand-50/50 dark:bg-brand-950/20 border border-brand-200/50 dark:border-brand-900/40 hover:bg-brand-100/40 dark:hover:bg-brand-950/40"
                            : "bg-slate-50/60 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {canPlay ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (lesson.video_url) {
                                  setActivePreviewLesson(lesson);
                                }
                              }}
                              className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 hover:scale-105 transition-transform"
                              title={isPreview ? "Click to Watch Free Preview" : "Play Lesson"}
                            >
                              <PlayCircle className="w-4 h-4" />
                            </button>
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-400 flex items-center justify-center shrink-0">
                              <Lock className="w-4 h-4" />
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {lesson.title}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>{formatDuration(lesson.duration_seconds)}</span>
                              </span>
                              {lesson.supplementary_files && lesson.supplementary_files.length > 0 && (
                                <span className="flex items-center gap-1 text-slate-400">
                                  <FileText className="w-3 h-3" />
                                  <span>{lesson.supplementary_files.length} resource(s)</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 ml-3">
                          {isPreview ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (lesson.video_url) {
                                  setActivePreviewLesson(lesson);
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold tracking-wider uppercase hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
                            >
                              <PlayCircle className="w-3 h-3" />
                              <span>Free Preview</span>
                            </button>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800 text-slate-400 font-medium flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              <span className="hidden sm:inline">Requires Enrollment</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Free Video Preview Modal */}
      {activePreviewLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-3xl backdrop-blur-2xl bg-slate-900 border border-slate-700 rounded-3xl p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Sample Free Lecture
                </span>
                <h3 className="text-base font-bold text-white mt-1">
                  {activePreviewLesson.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setActivePreviewLesson(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Player */}
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-slate-800">
              <video
                src={activePreviewLesson.video_url}
                controls
                autoPlay
                className="w-full h-full object-contain"
              >
                Your browser does not support the video tag.
              </video>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">
                Enjoyed this preview? Enroll now with your simulated wallet to unlock all weeks.
              </span>
              {!isEnrolled && (
                <button
                  type="button"
                  onClick={() => {
                    setActivePreviewLesson(null);
                    setIsCheckoutOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md transition-all flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Enroll in Cohort</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <CheckoutModal
          course={course}
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          onSuccess={handleEnrollSuccess}
          studentId={currentUser?.role === "STUDENT" ? currentUser.id : "usr_sophia_chen"}
          defaultBalanceDollars={studentWalletBalance}
        />
      )}
    </div>
  );
}
