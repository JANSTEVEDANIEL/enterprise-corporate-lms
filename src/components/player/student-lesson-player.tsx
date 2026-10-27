"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PlayCircle,
  CheckCircle2,
  XCircle,
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
  Presentation,
  Check,
  Layers,
  Code,
  AlertCircle,
} from "lucide-react";
import { VideoPlayerControls } from "./video-player-controls";
import { CertificateModal, type CertificateRecord } from "./certificate-modal";
import type { FileAttachment } from "@/types/marketplace";

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface LessonItem {
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
  description?: string;
  key_concepts?: string[];
  learning_outcomes?: string[];
  technical_takeaways?: Array<{ title: string; detail: string }>;
}

export interface QuizQuestionItem {
  id: string;
  prompt: string;
  options: string[];
  correct_index?: number;
  explanation?: string;
}

export interface WeekQuizItem {
  id: string;
  title: string;
  passing_score_pct: number;
  questions: QuizQuestionItem[];
}

export interface WeekItem {
  id: string;
  week_number: number;
  title: string;
  description: string;
  lessons: LessonItem[];
  quiz?: WeekQuizItem | null;
}

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
  weeks: WeekItem[];
  initialProgressPct: number;
  initialCertificate?: CertificateRecord | null;
  currentUser?: {
    id: string;
    name: string;
    role: string;
  };
  initialActiveTab?: "overview" | "materials" | "quiz";
  initialQuizAnswers?: Record<string, number>;
  initialQuizResult?: any;
}

export interface CategorizedMaterials {
  slideDecks: FileAttachment[];
  referenceGuides: FileAttachment[];
  starterCodes: FileAttachment[];
}

export interface StructuredLessonOverview {
  title: string;
  description: string;
  keyConcepts: string[];
  learningOutcomes: string[];
  technicalTakeaways: Array<{ title: string; detail: string }>;
}

// ============================================================================
// Helper Functions (Exported for Unit Testing)
// ============================================================================

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "Download Ready";
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

export function categorizeLessonMaterials(files: FileAttachment[] = []): CategorizedMaterials {
  const slideDecks: FileAttachment[] = [];
  const referenceGuides: FileAttachment[] = [];
  const starterCodes: FileAttachment[] = [];

  for (const file of files) {
    const nameLower = (file.name || "").toLowerCase();
    const typeUpper = (file.file_type || "").toUpperCase();

    const isZip =
      typeUpper === "ZIP" ||
      typeUpper === "CODE" ||
      nameLower.endsWith(".zip") ||
      nameLower.endsWith(".tar.gz") ||
      nameLower.endsWith(".tar") ||
      nameLower.endsWith(".sql") ||
      nameLower.endsWith(".json") ||
      nameLower.endsWith(".yaml") ||
      nameLower.endsWith(".yml");

    const isPptx =
      typeUpper === "PPTX" ||
      typeUpper === "SLIDE" ||
      nameLower.endsWith(".pptx") ||
      nameLower.endsWith(".ppt");

    const isSlidePdf =
      nameLower.includes("slide") ||
      nameLower.includes("presentation") ||
      nameLower.includes("deck");

    if (isPptx || isSlidePdf) {
      slideDecks.push(file);
    } else if (isZip) {
      starterCodes.push(file);
    } else {
      referenceGuides.push(file);
    }
  }

  return { slideDecks, referenceGuides, starterCodes };
}

export function getStructuredLessonOverview(
  lesson: any,
  week?: any,
  course?: any
): StructuredLessonOverview {
  const title = lesson?.title || "Lesson Overview";
  const titleLower = title.toLowerCase();

  const description =
    lesson?.description ||
    `This milestone lesson covers critical implementation patterns, architectural foundations, and operational workflows for ${title}. Designed for production engineering environments, it equips learners with concrete patterns and failure-resilient techniques.`;

  // Domain-aware key concepts with graceful fallback for dynamically created courses
  let keyConcepts: string[] = [];
  if (Array.isArray(lesson?.key_concepts) && lesson.key_concepts.length > 0) {
    keyConcepts = lesson.key_concepts;
  } else if (titleLower.includes("raft") || titleLower.includes("consensus")) {
    keyConcepts = ["Distributed Consensus", "Leader Election", "Log Replication", "Split-Brain Safety"];
  } else if (titleLower.includes("kafka") || titleLower.includes("event") || titleLower.includes("stream")) {
    keyConcepts = ["Event-Driven Architecture", "Partition Rebalancing", "Consumer Groups", "Idempotent Publishing"];
  } else if (titleLower.includes("zero-trust") || titleLower.includes("security") || titleLower.includes("auth")) {
    keyConcepts = ["Identity Verification", "Least Privilege RBAC", "mTLS Encryption", "Tamper-Evident Audit Chains"];
  } else if (titleLower.includes("gateway") || titleLower.includes("microservice") || titleLower.includes("mesh")) {
    keyConcepts = ["API Gateway Pattern", "Circuit Breaking", "Service Discovery", "Distributed Tracing"];
  } else if (titleLower.includes("git") || titleLower.includes("github")) {
    keyConcepts = ["DAG Commit Graphs", "Atomic Commits", "Rebase vs Merge", "Branch Protection Rules"];
  } else if (titleLower.includes("agent") || titleLower.includes("llm") || titleLower.includes("prompt")) {
    keyConcepts = ["ReAct Reasoning Loop", "Vector Embeddings & RAG", "Tool Calling Sandboxes", "Context Window Management"];
  } else if (titleLower.includes("cache") || titleLower.includes("redis")) {
    keyConcepts = ["Cache Invalidation", "Write-Through Strategy", "Thundering Herd Prevention", "Cluster Sharding"];
  } else if (titleLower.includes("database") || titleLower.includes("sql") || titleLower.includes("outbox")) {
    keyConcepts = ["Transactional Outbox", "ACID Isolation Levels", "Optimistic Locking", "Connection Pooling"];
  } else {
    keyConcepts = ["Architecture Principles", "Fault Tolerance & HA", "Production Best Practices", "Scalability Optimization"];
  }

  // Learning Outcomes checklist
  const learningOutcomes =
    Array.isArray(lesson?.learning_outcomes) && lesson.learning_outcomes.length > 0
      ? lesson.learning_outcomes
      : [
          `Master the core architectural mechanics and runtime lifecycle of ${title}.`,
          "Analyze failure modes, network partitions, and mitigation strategies under high concurrency.",
          "Implement production-grade configurations, logging conventions, and error boundaries.",
          "Apply end-to-end verification methods to validate system invariants and performance.",
        ];

  // Technical Takeaways & Architecture Principles
  const technicalTakeaways =
    Array.isArray(lesson?.technical_takeaways) && lesson.technical_takeaways.length > 0
      ? lesson.technical_takeaways
      : [
          {
            title: "Operational Decoupling & Isolation",
            detail: "Ensures downstream component failures do not cascade through bounded execution queues and backpressure controls.",
          },
          {
            title: "Idempotent Mutation Execution",
            detail: "Protects critical business mutations and financial transactions against duplicate delivery across distributed networks.",
          },
          {
            title: "Real-Time Observability & Telemetry",
            detail: "Exposes structured audit events, latency percentiles, and health checkpoints for deterministic monitoring.",
          },
          {
            title: "Graceful Degradation & Resilience",
            detail: "Maintains uninterrupted core capability even during transient third-party infrastructure outages.",
          },
        ];

  return {
    title,
    description,
    keyConcepts,
    learningOutcomes,
    technicalTakeaways,
  };
}

export function getQuestionFeedback(quizResult: any, questionId: string) {
  if (!quizResult) return null;
  const list = quizResult.evaluation?.results || quizResult.results || [];
  return list.find((item: any) => item.questionId === questionId) || null;
}

// ============================================================================
// Main Component: StudentLessonPlayer
// ============================================================================

export function StudentLessonPlayer({
  course,
  weeks: initialWeeks,
  initialProgressPct = 0,
  initialCertificate = null,
  currentUser,
  initialActiveTab = "overview",
  initialQuizAnswers = {},
  initialQuizResult = null,
}: StudentLessonPlayerProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [weeks, setWeeks] = useState<WeekItem[]>(initialWeeks);
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

  // 3-Tabbed Resource Panel state: 'overview' | 'materials' | 'quiz'
  const [activeTab, setActiveTab] = useState<"overview" | "materials" | "quiz">(initialActiveTab);

  // Selected week for Weekly Knowledge Check tab
  const activeLesson = allLessons.find((l) => l.id === activeLessonId) || allLessons[0] || null;
  const activeWeek =
    weeks.find((w) => w.lessons.some((l) => l.id === activeLessonId)) || weeks[0];

  const [selectedQuizWeek, setSelectedQuizWeek] = useState<number>(
    activeWeek?.week_number || 1
  );

  // Sync selected quiz week when lesson changes if user is not taking another week's quiz
  useEffect(() => {
    if (activeLesson) {
      const parentWeek = weeks.find((w) => w.lessons.some((l) => l.id === activeLesson.id));
      if (parentWeek) {
        setSelectedQuizWeek(parentWeek.week_number);
      }
    }
  }, [activeLessonId, weeks]);

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>(initialQuizAnswers);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<any | null>(initialQuizResult);

  const currentLessonIndex = allLessons.findIndex((l) => l.id === activeLessonId);
  const prevLesson = currentLessonIndex > 0 ? allLessons[currentLessonIndex - 1] : null;
  const nextLesson =
    currentLessonIndex < allLessons.length - 1 ? allLessons[currentLessonIndex + 1] : null;

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

      if (data.success && data.certificate) {
        setCertificate(data.certificate);
        if (data.enrollmentProgressPct === 100) {
          setProgressPct(100);
          setIsCertModalOpen(true);
        }
      }
    } catch (err) {
      console.error("Quiz submission failed:", err);
    } finally {
      setQuizSubmitting(false);
    }
  };

  const handleRetakeQuiz = () => {
    setQuizAnswers({});
    setQuizResult(null);
  };

  // Structured overview for active lesson
  const overview = getStructuredLessonOverview(activeLesson, activeWeek, course);

  // Categorized materials for active lesson
  const categorized = categorizeLessonMaterials(activeLesson?.supplementary_files || []);
  const totalMaterialsCount =
    categorized.slideDecks.length +
    categorized.referenceGuides.length +
    categorized.starterCodes.length;

  // Selected week's quiz object
  const selectedWeekObj = weeks.find((w) => w.week_number === selectedQuizWeek) || activeWeek;
  const currentWeekQuiz = selectedWeekObj?.quiz;

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      {/* Top Learning Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#0B101D] border-b border-slate-800 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
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
              <span className="font-bold text-emerald-400" data-testid="curriculum-progress-pct">
                {progressPct}%
              </span>
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
              data-testid="claim-certificate-button"
            >
              <Award className="w-4 h-4" />
              <span>Claim Certificate</span>
            </button>
          ) : (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-400 text-xs font-medium cursor-not-allowed"
              title="Complete all 1-7+ weeks to unlock Certificate of Completion"
              data-testid="certificate-locked-badge"
            >
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>Cert Unlocks at 100%</span>
            </div>
          )}

          {/* Toggle Curriculum Drawer on mobile */}
          <button
            type="button"
            onClick={() => setDrawerOpen(!drawerOpen)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 cursor-pointer"
            title="Toggle Curriculum Outline"
            data-testid="toggle-curriculum-drawer"
          >
            {drawerOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Learning Workspace Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left/Center: Video Player & 3-Tabbed Resource Panel */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto max-w-5xl">
          {/* ================================================================ */}
          {/* PERSISTENT VIDEO PLAYER: Always mounted and visible at all times */}
          {/* ================================================================ */}
          <div className="space-y-4" data-testid="persistent-video-player-container">
            <VideoPlayerControls
              videoRef={videoRef}
              videoUrl={activeLesson?.video_url}
              lessonTitle={activeLesson?.title || "Lesson"}
              durationSeconds={activeLesson?.duration_seconds || 600}
              initialPositionSeconds={activeLesson?.last_position_seconds || 0}
              isCompleted={activeLesson?.progress_status === "COMPLETED"}
              onAutoCompleted={handleAutoCompleted}
            />

            {/* Lesson Action Header Bar */}
            <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-brand-400 tracking-wider">
                      Week {activeLesson?.weekNumber} Milestone Lesson
                    </span>
                    {activeLesson?.is_preview && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        Free Preview
                      </span>
                    )}
                  </div>
                  <h2
                    className="text-xl font-extrabold text-white pt-0.5"
                    data-testid="active-lesson-title"
                  >
                    {activeLesson?.title}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Duration: {Math.round((activeLesson?.duration_seconds || 0) / 60)} mins • Sequential Self-Paced Track
                  </p>
                </div>

                {/* Mark as Completed Button */}
                <div className="flex items-center gap-3">
                  {activeLesson?.progress_status === "COMPLETED" ? (
                    <div
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold"
                      data-testid="lesson-completed-badge"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Completed</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleMarkCompleted}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                      data-testid="mark-completed-button"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Mark as Completed</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Lesson Navigation (Previous / Next) */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
                {prevLesson ? (
                  <button
                    type="button"
                    onClick={() => setActiveLessonId(prevLesson.id)}
                    className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    data-testid="prev-lesson-button"
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors cursor-pointer"
                    data-testid="next-lesson-button"
                  >
                    <span>Next: {nextLesson.title}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <div />
                )}
              </div>
            </div>
          </div>

          {/* ================================================================ */}
          {/* 3-TABBED RESOURCE CONTAINER (Below Persistent Video Player)       */}
          {/* ================================================================ */}
          <div
            className="bg-[#0F172A] border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-lg space-y-6"
            data-testid="resource-tabs-container"
          >
            {/* Tabs Navigation Header */}
            <div
              className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto"
              role="tablist"
              data-testid="player-tab-list"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "overview"}
                onClick={() => setActiveTab("overview")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "overview"
                    ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
                data-testid="tab-button-overview"
              >
                <BookOpen className="w-4 h-4" />
                <span>Lesson Overview</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "materials"}
                onClick={() => setActiveTab("materials")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "materials"
                    ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
                data-testid="tab-button-materials"
              >
                <Download className="w-4 h-4" />
                <span>Lesson Materials</span>
                {totalMaterialsCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-brand-300 font-semibold border border-brand-500/20">
                    {totalMaterialsCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "quiz"}
                onClick={() => setActiveTab("quiz")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "quiz"
                    ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
                data-testid="tab-button-quiz"
              >
                <HelpCircle className="w-4 h-4" />
                <span>Weekly Knowledge Check</span>
                {currentWeekQuiz && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                    Week {selectedQuizWeek}
                  </span>
                )}
              </button>
            </div>

            {/* TAB 1: LESSON OVERVIEW */}
            {activeTab === "overview" && (
              <div className="space-y-6 animate-in fade-in duration-200" data-testid="tab-content-overview">
                {/* Description Banner */}
                <div className="space-y-2">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Curriculum Context & Architectural Scope</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed" data-testid="overview-description">
                    {overview.description}
                  </p>
                </div>

                {/* Key Concepts Badges/Cards */}
                <div className="space-y-3" data-testid="key-concepts-section">
                  <h4 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-brand-400" />
                    <span>Key Concepts & Core Patterns</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {overview.keyConcepts.map((concept, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-brand-500/30 transition-all flex items-center gap-2"
                        data-testid="key-concept-card"
                      >
                        <div className="w-2 h-2 rounded-full bg-brand-400 shrink-0" />
                        <span className="text-xs font-semibold text-slate-200 truncate">{concept}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Learning Outcomes Checklist with Check Icons */}
                <div className="space-y-3" data-testid="learning-outcomes-section">
                  <h4 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Learning Outcomes & Technical Competencies</span>
                  </h4>
                  <div className="space-y-2">
                    {overview.learningOutcomes.map((outcome, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/40 border border-slate-800/60"
                        data-testid="learning-outcome-item"
                      >
                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="text-xs text-slate-300 leading-normal">{outcome}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Technical Takeaways & Architecture Principles */}
                <div className="space-y-3" data-testid="technical-takeaways-section">
                  <h4 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Technical Takeaways & Architecture Principles</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {overview.technicalTakeaways.map((takeaway, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1.5 hover:border-slate-700 transition-all"
                        data-testid="technical-takeaway-card"
                      >
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-brand-400 shrink-0" />
                          <h5 className="text-xs font-bold text-white">{takeaway.title}</h5>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed pl-6">
                          {takeaway.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: LESSON MATERIALS */}
            {activeTab === "materials" && (
              <div className="space-y-6 animate-in fade-in duration-200" data-testid="tab-content-materials">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Download className="w-4 h-4 text-brand-400" />
                      <span>Downloadable Supplementary Materials</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      All downloadable files for {activeLesson?.title} organized by resource category.
                    </p>
                  </div>
                  <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Student Verified Access
                  </span>
                </div>

                {totalMaterialsCount === 0 ? (
                  <div
                    className="p-8 rounded-2xl bg-slate-950/40 border border-slate-800 text-center space-y-2"
                    data-testid="materials-empty-state"
                  >
                    <FileText className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400">
                      No downloadable files attached directly to this lesson.
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Check subsequent milestone lessons or lab weeks for presentation slides, cheat sheets, and starter ZIP codebases.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Category 1: Slide Decks & Presentation Slides */}
                    {categorized.slideDecks.length > 0 && (
                      <div className="space-y-2.5" data-testid="category-slide-decks">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                          <Presentation className="w-4 h-4 text-amber-400" />
                          <span>Slide Decks & Presentation Slides (.pdf, .pptx)</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {categorized.slideDecks.map((file, idx) => {
                            const ext = (file.name.split(".").pop() || "PDF").toUpperCase();
                            return (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all gap-3"
                                data-testid="material-card-slide-deck"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                                    <Presentation className="w-5 h-5" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-white truncate">{file.name}</p>
                                    <div className="flex items-center gap-2 pt-0.5">
                                      <span
                                        className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                        data-testid="file-format-pill"
                                      >
                                        {ext}
                                      </span>
                                      <span
                                        className="text-[10px] text-slate-400 font-mono"
                                        data-testid="file-size-badge"
                                      >
                                        {formatFileSize(file.file_size_bytes)}
                                      </span>
                                    </div>
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
                                  className="px-3 py-1.5 rounded-lg bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 text-xs font-semibold border border-brand-500/30 flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                                  data-testid="download-attachment-button"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Download</span>
                                </a>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Category 2: Reference Guides & Cheat Sheets */}
                    {categorized.referenceGuides.length > 0 && (
                      <div className="space-y-2.5" data-testid="category-reference-guides">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                          <BookOpen className="w-4 h-4 text-rose-400" />
                          <span>Reference Guides & Cheat Sheets (.pdf)</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {categorized.referenceGuides.map((file, idx) => {
                            const ext = (file.name.split(".").pop() || "PDF").toUpperCase();
                            return (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all gap-3"
                                data-testid="material-card-reference-guide"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
                                    <FileText className="w-5 h-5" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-white truncate">{file.name}</p>
                                    <div className="flex items-center gap-2 pt-0.5">
                                      <span
                                        className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                        data-testid="file-format-pill"
                                      >
                                        {ext}
                                      </span>
                                      <span
                                        className="text-[10px] text-slate-400 font-mono"
                                        data-testid="file-size-badge"
                                      >
                                        {formatFileSize(file.file_size_bytes)}
                                      </span>
                                    </div>
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
                                  className="px-3 py-1.5 rounded-lg bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 text-xs font-semibold border border-brand-500/30 flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                                  data-testid="download-attachment-button"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Download</span>
                                </a>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Category 3: Starter Code & Project ZIPs */}
                    {categorized.starterCodes.length > 0 && (
                      <div className="space-y-2.5" data-testid="category-starter-code">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                          <FileArchive className="w-4 h-4 text-blue-400" />
                          <span>Starter Code & Project ZIPs (.zip)</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {categorized.starterCodes.map((file, idx) => {
                            const ext = (file.name.split(".").pop() || "ZIP").toUpperCase();
                            return (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all gap-3"
                                data-testid="material-card-starter-code"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                                    <FileArchive className="w-5 h-5" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-white truncate">{file.name}</p>
                                    <div className="flex items-center gap-2 pt-0.5">
                                      <span
                                        className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                        data-testid="file-format-pill"
                                      >
                                        {ext}
                                      </span>
                                      <span
                                        className="text-[10px] text-slate-400 font-mono"
                                        data-testid="file-size-badge"
                                      >
                                        {formatFileSize(file.file_size_bytes)}
                                      </span>
                                    </div>
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
                                  className="px-3 py-1.5 rounded-lg bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 text-xs font-semibold border border-brand-500/30 flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                                  data-testid="download-attachment-button"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Download</span>
                                </a>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: WEEKLY KNOWLEDGE CHECK */}
            {activeTab === "quiz" && (
              <div className="space-y-6 animate-in fade-in duration-200" data-testid="tab-content-quiz">
                {/* Week Selector Pills (Allows testing knowledge across any unlocked week) */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1" data-testid="quiz-week-selector">
                  <span className="text-[11px] font-bold text-slate-400 shrink-0">Select Week:</span>
                  {weeks.map((w) => {
                    const hasQuiz = !!w.quiz;
                    const isSelected = selectedQuizWeek === w.week_number;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => {
                          setSelectedQuizWeek(w.week_number);
                          setQuizResult(null);
                          setQuizAnswers({});
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                          isSelected
                            ? "bg-indigo-600 text-white shadow-sm"
                            : hasQuiz
                            ? "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                            : "bg-slate-900/40 text-slate-600 cursor-not-allowed"
                        }`}
                        data-testid={`select-quiz-week-${w.week_number}`}
                      >
                        Week {w.week_number}
                        {hasQuiz && <span className="ml-1 text-[10px] text-indigo-300">•</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Quiz Content Container */}
                {!currentWeekQuiz || !currentWeekQuiz.questions || currentWeekQuiz.questions.length === 0 ? (
                  <div
                    className="p-8 rounded-2xl bg-slate-950/40 border border-slate-800 text-center space-y-2"
                    data-testid="quiz-empty-state"
                  >
                    <HelpCircle className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400">
                      No knowledge check quiz configured for Week {selectedQuizWeek}.
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Select another milestone week from above or continue your video lessons.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6" data-testid="interactive-quiz-container">
                    {/* Quiz Header & Progression Bar */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <HelpCircle className="w-5 h-5 text-indigo-400" />
                          <h4 className="text-sm sm:text-base font-bold text-white" data-testid="quiz-title">
                            Week {selectedQuizWeek} Knowledge Check: {currentWeekQuiz.title}
                          </h4>
                        </div>
                        <span
                          className="text-xs px-2.5 py-1 rounded-full font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                          data-testid="quiz-passing-requirement"
                        >
                          Passing Score: {currentWeekQuiz.passing_score_pct}%
                        </span>
                      </div>

                      {/* Question Progression Tracker */}
                      {(() => {
                        const totalQuestions = currentWeekQuiz.questions.length;
                        const answeredCount = currentWeekQuiz.questions.filter(
                          (q) => quizAnswers[q.id] !== undefined
                        ).length;
                        const answeredPct = Math.round((answeredCount / totalQuestions) * 100);

                        return (
                          <div className="space-y-1.5 pt-1" data-testid="quiz-progression-tracker">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-400" data-testid="progression-text">
                                Progression: {answeredCount} of {totalQuestions} Questions Answered
                              </span>
                              <span className="font-bold text-indigo-300">{answeredPct}%</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                                style={{ width: `${answeredPct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Immediate Grading Result Banner (After Submission) */}
                    {quizResult && (
                      <div
                        className={`p-5 rounded-2xl border ${
                          quizResult.passed
                            ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-200"
                            : "bg-rose-950/60 border-rose-500/40 text-rose-200"
                        } space-y-3 shadow-lg animate-in fade-in`}
                        data-testid="quiz-grading-result"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2.5 font-extrabold text-sm sm:text-base">
                            {quizResult.passed ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <XCircle className="w-5 h-5 text-rose-400" />
                            )}
                            <span data-testid="quiz-score-message">
                              {quizResult.passed
                                ? `${quizResult.scorePct}% - Passed`
                                : `${quizResult.scorePct}% - Failed (Passing: ${currentWeekQuiz.passing_score_pct}%)`}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={handleRetakeQuiz}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-xs font-bold border border-slate-700/80 transition-colors cursor-pointer"
                            data-testid="retake-quiz-button"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Retake Quiz</span>
                          </button>
                        </div>

                        <p className="text-xs leading-relaxed opacity-90">
                          {quizResult.passed
                            ? "Excellent work! You have satisfied the knowledge check requirement for this milestone. Review the detailed rationales below for complete architectural comprehension."
                            : "Some answers require review. Inspect the question rationales and architecture insights highlighted below, consult the lesson materials, and retake the quiz."}
                        </p>
                      </div>
                    )}

                    {/* Interactive Questions List */}
                    <div className="space-y-5" data-testid="quiz-questions-list">
                      {currentWeekQuiz.questions.map((q, idx) => {
                        const feedback = getQuestionFeedback(quizResult, q.id);
                        const isGraded = quizResult !== null;
                        const isCorrect = feedback ? feedback.isCorrect : false;

                        return (
                          <div
                            key={q.id}
                            className={`p-5 rounded-2xl bg-slate-950/70 border transition-all space-y-4 ${
                              isGraded
                                ? isCorrect
                                  ? "border-emerald-500/40 bg-emerald-950/10"
                                  : "border-rose-500/40 bg-rose-950/10"
                                : "border-slate-800/80"
                            }`}
                            data-testid={`quiz-question-item-${idx + 1}`}
                          >
                            {/* Question Header & Per-Question Correctness Badge */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <span
                                  className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5"
                                  data-testid="question-number-pill"
                                >
                                  {idx + 1}
                                </span>
                                <div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block pb-0.5">
                                    Question {idx + 1} of {currentWeekQuiz.questions.length}
                                  </span>
                                  <p className="text-sm font-semibold text-white leading-snug">{q.prompt}</p>
                                </div>
                              </div>

                              {/* Per-Question Correctness Breakdown */}
                              {isGraded && (
                                <div data-testid={`question-badge-${q.id}`}>
                                  {isCorrect ? (
                                    <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1.5 shrink-0">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Correct</span>
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1.5 shrink-0">
                                      <XCircle className="w-3.5 h-3.5" />
                                      <span>Incorrect</span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Options List */}
                            <div className="grid grid-cols-1 gap-2 pt-1 pl-9">
                              {q.options.map((opt, optIdx) => {
                                const isSelected = quizAnswers[q.id] === optIdx;

                                let optionStyle =
                                  "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/60";

                                if (isGraded) {
                                  if (isSelected && isCorrect) {
                                    optionStyle =
                                      "bg-emerald-950/40 border-emerald-500 text-emerald-200 font-semibold";
                                  } else if (isSelected && !isCorrect) {
                                    optionStyle =
                                      "bg-rose-950/40 border-rose-500 text-rose-200 font-semibold";
                                  } else if (!isSelected && optIdx === q.correct_index) {
                                    optionStyle =
                                      "bg-emerald-950/20 border-emerald-500/50 text-emerald-300/80";
                                  }
                                } else if (isSelected) {
                                  optionStyle =
                                    "bg-indigo-600/20 border-indigo-500 text-white font-medium shadow-sm";
                                }

                                return (
                                  <label
                                    key={optIdx}
                                    className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all ${optionStyle}`}
                                  >
                                    <input
                                      type="radio"
                                      name={`question_${q.id}`}
                                      disabled={quizSubmitting || isGraded}
                                      checked={isSelected}
                                      onChange={() =>
                                        setQuizAnswers((prev) => ({ ...prev, [q.id]: optIdx }))
                                      }
                                      className="accent-indigo-500 cursor-pointer"
                                    />
                                    <span>{opt}</span>
                                  </label>
                                );
                              })}
                            </div>

                            {/* CRUCIAL: Question Rationale & Explanation (Rendered for EVERY question) */}
                            {isGraded && (
                              <div
                                className="mt-3 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/90 space-y-1.5 ml-9 text-xs animate-in fade-in"
                                data-testid={`rationale-${q.id}`}
                              >
                                <div className="flex items-center gap-1.5 font-bold text-indigo-300">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Question Rationale & Technical Explanation:</span>
                                </div>
                                <p className="text-slate-300 leading-relaxed pl-5" data-testid="rationale-text">
                                  {feedback?.explanation ||
                                    q.explanation ||
                                    "This option reflects canonical system invariants and operational tradeoffs tested in enterprise production architectures."}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Quiz Submit Button */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        disabled={
                          quizSubmitting ||
                          Object.keys(quizAnswers).length < currentWeekQuiz.questions.length
                        }
                        onClick={() => handleQuizSubmit(currentWeekQuiz.id)}
                        className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        data-testid="submit-quiz-button"
                      >
                        {quizSubmitting ? "Evaluating Server-Side..." : "Submit Answers for Instant Grading"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Right Drawer: Sequential 1 to 7+ Week Curriculum Navigation */}
        <aside
          className={`lg:w-96 border-l border-slate-800 bg-[#0B101D] flex flex-col shrink-0 transition-all duration-300 ${
            drawerOpen ? "block" : "hidden lg:block"
          }`}
          data-testid="curriculum-drawer"
        >
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Curriculum Outline</h2>
              <p className="text-[11px] text-slate-400">
                Weeks 1 to {course.total_weeks} (Self-Paced Unlocked)
              </p>
            </div>
            <span
              className="text-xs font-bold text-emerald-400"
              data-testid="curriculum-completion-counter"
            >
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
                  data-testid={`drawer-week-${week.week_number}`}
                >
                  {/* Week Accordion Header */}
                  <button
                    type="button"
                    onClick={() => toggleWeek(week.week_number)}
                    className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors cursor-pointer"
                    data-testid={`drawer-week-toggle-${week.week_number}`}
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
                        const isActive = lesson.id === activeLessonId;
                        const isDone = lesson.progress_status === "COMPLETED";

                        return (
                          <button
                            key={lesson.id}
                            type="button"
                            onClick={() => {
                              setActiveLessonId(lesson.id);
                            }}
                            className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between gap-2.5 text-xs transition-all cursor-pointer ${
                              isActive
                                ? "bg-brand-600 text-white font-semibold shadow-md"
                                : isDone
                                ? "bg-emerald-500/10 text-slate-200 hover:bg-emerald-500/15"
                                : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                            }`}
                            data-testid={`drawer-lesson-${lesson.id}`}
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

                      {/* Weekly Knowledge Check Button in Drawer (Switches to Tab 3 without hiding video) */}
                      {week.quiz && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedQuizWeek(week.week_number);
                            setActiveTab("quiz");
                            setQuizResult(null);
                          }}
                          className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between gap-2 text-xs font-semibold border transition-all mt-1 cursor-pointer ${
                            activeTab === "quiz" && selectedQuizWeek === week.week_number
                              ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                              : "bg-indigo-950/30 text-indigo-300 border-indigo-900/60 hover:bg-indigo-900/40"
                          }`}
                          data-testid={`drawer-quiz-button-${week.week_number}`}
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

      {/* Verifiable Certificate Modal upon 100% Course Completion */}
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
