"use client";

import React, { useState } from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Video,
  FileText,
  Clock,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Eye,
  GripVertical,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";
import type { CurriculumWeek, Lesson, FileAttachment, WeekQuiz } from "@/types/marketplace";
import {
  LessonVideoUploader,
  ResourceAttachmentUploader,
  WeeklyQuizBuilder,
} from "./media-uploader";

interface CurriculumBuilderProps {
  courseId: string;
  initialWeeks?: CurriculumWeek[];
  isPublished?: boolean;
  onCurriculumChange?: (weeks: CurriculumWeek[]) => void;
}

export function CurriculumBuilder({
  courseId,
  initialWeeks = [],
  isPublished = false,
  onCurriculumChange,
}: CurriculumBuilderProps) {
  const [weeks, setWeeks] = useState<CurriculumWeek[]>(initialWeeks);
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (initialWeeks.length > 0) {
      initial[initialWeeks[0].id] = true;
    }
    return initial;
  });
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);
  const [quizBuilderWeekId, setQuizBuilderWeekId] = useState<string | null>(null);
  const [isAddingWeek, setIsAddingWeek] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showNotification = (type: "success" | "error", text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const toggleWeekAccordion = (weekId: string) => {
    setExpandedWeeks((prev) => ({
      ...prev,
      [weekId]: !prev[weekId],
    }));
  };

  // 1. ADD NEXT WEEK
  const handleAddWeek = async () => {
    setIsAddingWeek(true);
    try {
      const nextNum = weeks.length + 1;
      const res = await fetch(`/api/studio/courses/${courseId}/weeks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_WEEK",
          title: `Week ${nextNum}: Module Milestone ${nextNum}`,
          description: `Comprehensive milestones and practical labs for week ${nextNum}.`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to add week");
      }

      const updated = [...weeks, data.week];
      setWeeks(updated);
      setExpandedWeeks((prev) => ({ ...prev, [data.week.id]: true }));
      onCurriculumChange?.(updated);
      showNotification("success", `Week ${nextNum} added successfully!`);
    } catch (err: any) {
      showNotification("error", err.message || "Failed to add week");
    } finally {
      setIsAddingWeek(false);
    }
  };

  // 2. DELETE WEEK
  const handleDeleteWeek = async (weekId: string, weekNum: number) => {
    if (!confirm(`Are you sure you want to delete Week ${weekNum}? All associated lessons will be removed.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/studio/courses/${courseId}/weeks`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DELETE_WEEK", week_id: weekId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete week");
      }

      // Re-fetch or re-index weeks locally
      const remaining = weeks
        .filter((w) => w.id !== weekId)
        .map((w, index) => ({
          ...w,
          week_number: index + 1,
        }));

      setWeeks(remaining);
      onCurriculumChange?.(remaining);
      showNotification("success", `Week ${weekNum} removed.`);
    } catch (err: any) {
      showNotification("error", err.message || "Failed to delete week");
    }
  };

  // 3. ADD LESSON TO WEEK
  const handleAddLesson = async (weekId: string, weekNum: number) => {
    try {
      const targetWeek = weeks.find((w) => w.id === weekId);
      const lessonCount = targetWeek?.lessons?.length || 0;
      const lessonOrder = lessonCount + 1;

      const res = await fetch(`/api/studio/courses/${courseId}/weeks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_LESSON",
          week_id: weekId,
          title: `Lesson ${weekNum}.${lessonOrder}: Core Concepts Part ${lessonOrder}`,
          duration_seconds: 900,
          is_preview: lessonOrder === 1, // first lesson preview default
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to add lesson");
      }

      const updated = weeks.map((w) => {
        if (w.id === weekId) {
          return {
            ...w,
            lessons: [...(w.lessons || []), data.lesson],
          };
        }
        return w;
      });

      setWeeks(updated);
      setExpandedLessonId(data.lesson.id);
      onCurriculumChange?.(updated);
      showNotification("success", `Lesson ${weekNum}.${lessonOrder} added!`);
    } catch (err: any) {
      showNotification("error", err.message || "Failed to add lesson");
    }
  };

  // 4. DELETE LESSON
  const handleDeleteLesson = async (lessonId: string, weekId: string) => {
    try {
      const res = await fetch(`/api/studio/courses/${courseId}/weeks`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DELETE_LESSON", lesson_id: lessonId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete lesson");
      }

      const updated = weeks.map((w) => {
        if (w.id === weekId) {
          const remainingLessons = (w.lessons || [])
            .filter((l) => l.id !== lessonId)
            .map((l, idx) => ({ ...l, order_index: idx + 1 }));
          return { ...w, lessons: remainingLessons };
        }
        return w;
      });

      setWeeks(updated);
      if (expandedLessonId === lessonId) setExpandedLessonId(null);
      onCurriculumChange?.(updated);
      showNotification("success", "Lesson removed.");
    } catch (err: any) {
      showNotification("error", err.message || "Failed to delete lesson");
    }
  };

  // 5. REORDER LESSON (MOVE UP / DOWN)
  const handleMoveLesson = async (weekId: string, lessonIndex: number, direction: "UP" | "DOWN") => {
    const targetWeek = weeks.find((w) => w.id === weekId);
    if (!targetWeek || !targetWeek.lessons) return;

    const lessons = [...targetWeek.lessons];
    const targetIndex = direction === "UP" ? lessonIndex - 1 : lessonIndex + 1;

    if (targetIndex < 0 || targetIndex >= lessons.length) return;

    // Swap elements
    const temp = lessons[lessonIndex];
    lessons[lessonIndex] = lessons[targetIndex];
    lessons[targetIndex] = temp;

    const lessonIds = lessons.map((l) => l.id);

    try {
      const res = await fetch(`/api/studio/courses/${courseId}/weeks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REORDER_LESSONS",
          week_id: weekId,
          lesson_ids: lessonIds,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to reorder lessons");
      }

      const updated = weeks.map((w) => {
        if (w.id === weekId) {
          return { ...w, lessons: data.lessons };
        }
        return w;
      });

      setWeeks(updated);
      onCurriculumChange?.(updated);
    } catch (err: any) {
      showNotification("error", err.message || "Failed to reorder lessons");
    }
  };

  // 6. UPDATE LESSON PROPERTIES (VIDEO / DURATION / FILES)
  const handleUpdateLesson = async (
    lessonId: string,
    weekId: string,
    updates: Partial<Lesson>
  ) => {
    try {
      const res = await fetch(`/api/studio/courses/${courseId}/weeks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_LESSON",
          lesson_id: lessonId,
          ...updates,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update lesson");
      }

      const updated = weeks.map((w) => {
        if (w.id === weekId) {
          return {
            ...w,
            lessons: (w.lessons || []).map((l) =>
              l.id === lessonId ? { ...l, ...data.lesson } : l
            ),
          };
        }
        return w;
      });

      setWeeks(updated);
      onCurriculumChange?.(updated);
    } catch (err: any) {
      showNotification("error", err.message || "Failed to update lesson");
    }
  };

  // 7. UPDATE WEEK TITLE / DESC
  const handleUpdateWeekMeta = async (weekId: string, title: string, description: string) => {
    try {
      await fetch(`/api/studio/courses/${courseId}/weeks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_WEEK",
          week_id: weekId,
          title,
          description,
        }),
      });

      const updated = weeks.map((w) =>
        w.id === weekId ? { ...w, title, description } : w
      );
      setWeeks(updated);
      onCurriculumChange?.(updated);
    } catch {}
  };

  const computeWeekDuration = (lessons: Lesson[] = []) => {
    const totalSec = lessons.reduce((acc, l) => acc + (l.duration_seconds || 0), 0);
    const mins = Math.round(totalSec / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {feedbackMsg && (
        <div
          className={`flex items-center gap-2 rounded-xl border p-4 text-sm backdrop-blur-md transition-all ${
            feedbackMsg.type === "success"
              ? "border-emerald-500/40 bg-emerald-950/70 text-emerald-300"
              : "border-rose-500/40 bg-rose-950/70 text-rose-300"
          }`}
        >
          {feedbackMsg.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-400" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Curriculum Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-emerald-500/20 border border-indigo-500/30 text-indigo-400">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              Sequential 1 to 7+ Week Curriculum Engine
              {isPublished && (
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
                  Published Live
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              {weeks.length} {weeks.length === 1 ? "Week" : "Weeks"} configured •{" "}
              {weeks.reduce((acc, w) => acc + (w.lessons?.length || 0), 0)} total video lessons •
              Sequential unlocked milestone progression
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAddWeek}
          disabled={isAddingWeek}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 hover:from-emerald-500 hover:to-teal-500 transition-all disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          <span>Add Week {weeks.length + 1}</span>
        </button>
      </div>

      {/* Weeks List */}
      <div className="space-y-4">
        {weeks.map((week, weekIndex) => {
          const isOpen = !!expandedWeeks[week.id];
          const lessonCount = week.lessons?.length || 0;
          const weekDuration = computeWeekDuration(week.lessons);
          const hasQuiz = !!week.quiz;

          return (
            <div
              key={week.id}
              className="overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/40 shadow-xl backdrop-blur-md transition-all hover:border-slate-600"
            >
              {/* Week Accordion Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-800/40 p-4 transition-colors">
                <div
                  className="flex flex-1 cursor-pointer items-center gap-3"
                  onClick={() => toggleWeekAccordion(week.id)}
                >
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                  >
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-xs font-bold text-emerald-400">
                      <Calendar className="h-3 w-3" />
                      Week {week.week_number}
                    </span>
                    <h4 className="text-base font-bold text-slate-100">
                      {week.title}
                    </h4>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                    {weekDuration} ({lessonCount} {lessonCount === 1 ? "lesson" : "lessons"})
                  </span>

                  {/* Quiz Toggle Button */}
                  <button
                    type="button"
                    onClick={() =>
                      setQuizBuilderWeekId(
                        quizBuilderWeekId === week.id ? null : week.id
                      )
                    }
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all border ${
                      hasQuiz
                        ? "border-indigo-500/40 bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/60"
                        : "border-slate-700 bg-slate-800/60 text-slate-400 hover:border-indigo-500/50 hover:text-indigo-300"
                    }`}
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    <span>{hasQuiz ? "Quiz Configured" : "Add Knowledge Check"}</span>
                  </button>

                  {/* Delete Week */}
                  {weeks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteWeek(week.id, week.week_number)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-950/40 hover:text-rose-400 transition-colors"
                      title="Delete Week"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Week Accordion Body */}
              {isOpen && (
                <div className="space-y-4 p-5">
                  {/* Inline Week Description & Title Edit */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-1 space-y-1">
                      <label className="text-xs font-medium text-slate-400">Week Title</label>
                      <input
                        type="text"
                        value={week.title}
                        onChange={(e) =>
                          handleUpdateWeekMeta(week.id, e.target.value, week.description)
                        }
                        className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-xs font-medium text-slate-400">Week Objective / Summary</label>
                      <input
                        type="text"
                        value={week.description}
                        onChange={(e) =>
                          handleUpdateWeekMeta(week.id, week.title, e.target.value)
                        }
                        className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Weekly Quiz Builder Section (if open for this week) */}
                  {quizBuilderWeekId === week.id && (
                    <WeeklyQuizBuilder
                      courseId={courseId}
                      weekId={week.id}
                      weekNumber={week.week_number}
                      initialQuiz={week.quiz}
                      onSaveSuccess={(quiz) => {
                        const updated = weeks.map((w) =>
                          w.id === week.id ? { ...w, quiz } : w
                        );
                        setWeeks(updated);
                        onCurriculumChange?.(updated);
                        showNotification("success", `Quiz saved for Week ${week.week_number}!`);
                      }}
                    />
                  )}

                  {/* Lessons List in Week */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Lessons for Week {week.week_number}
                      </h5>
                      <span className="text-[11px] text-slate-500">
                        Use arrows to reorder playback sequence
                      </span>
                    </div>

                    {(!week.lessons || week.lessons.length === 0) && (
                      <div className="rounded-xl border border-dashed border-slate-700/80 p-6 text-center text-xs text-slate-400">
                        No lessons added yet for Week {week.week_number}. Click below to add your first lesson.
                      </div>
                    )}

                    {(week.lessons || []).map((lesson, lessonIndex) => {
                      const isLessonOpen = expandedLessonId === lesson.id;
                      const hasVideo = !!lesson.video_url;
                      const filesCount = lesson.supplementary_files?.length || 0;

                      return (
                        <div
                          key={lesson.id}
                          className="rounded-xl border border-slate-700/70 bg-slate-800/50 shadow transition-all hover:border-slate-600"
                        >
                          {/* Lesson Summary Row */}
                          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5">
                            <div className="flex flex-1 items-center gap-3">
                              {/* Reorder Buttons */}
                              <div className="flex flex-col gap-0.5 text-slate-500">
                                <button
                                  type="button"
                                  disabled={lessonIndex === 0}
                                  onClick={() => handleMoveLesson(week.id, lessonIndex, "UP")}
                                  className="rounded hover:bg-slate-700 hover:text-slate-200 disabled:opacity-20 p-0.5"
                                  title="Move Up"
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={lessonIndex === (week.lessons?.length || 1) - 1}
                                  onClick={() => handleMoveLesson(week.id, lessonIndex, "DOWN")}
                                  className="rounded hover:bg-slate-700 hover:text-slate-200 disabled:opacity-20 p-0.5"
                                  title="Move Down"
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              <span className="rounded bg-slate-700/60 px-2 py-0.5 text-xs font-mono font-bold text-slate-300">
                                {week.week_number}.{lesson.order_index}
                              </span>

                              <div className="truncate">
                                <p className="truncate text-sm font-semibold text-slate-100">
                                  {lesson.title}
                                </p>
                                <div className="flex items-center gap-2 pt-0.5 text-[11px] text-slate-400">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {Math.round((lesson.duration_seconds || 0) / 60)} min
                                  </span>
                                  {lesson.is_preview ? (
                                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                                      Free Preview
                                    </span>
                                  ) : (
                                    <span className="text-slate-500">Protected</span>
                                  )}
                                  {hasVideo ? (
                                    <span className="flex items-center gap-1 text-emerald-400">
                                      <Video className="h-3 w-3" /> Video Attached
                                    </span>
                                  ) : (
                                    <span className="text-amber-400/80">No Video</span>
                                  )}
                                  {filesCount > 0 && (
                                    <span className="flex items-center gap-1 text-sky-400">
                                      <FileText className="h-3 w-3" /> {filesCount}{" "}
                                      {filesCount === 1 ? "file" : "files"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Lesson Actions */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedLessonId(isLessonOpen ? null : lesson.id)
                                }
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors border ${
                                  isLessonOpen
                                    ? "border-emerald-500 bg-emerald-600 text-white"
                                    : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500 hover:text-white"
                                }`}
                              >
                                {isLessonOpen ? "Done Editing" : "Configure Lesson"}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteLesson(lesson.id, week.id)}
                                className="rounded p-1 text-slate-500 hover:bg-rose-950/40 hover:text-rose-400 transition-colors"
                                title="Delete Lesson"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {/* Expanded Lesson Configuration Panel */}
                          {isLessonOpen && (
                            <div className="border-t border-slate-700/60 bg-slate-900/70 p-4 space-y-4">
                              {/* Lesson Title Input */}
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-300">
                                  Lesson Title
                                </label>
                                <input
                                  type="text"
                                  value={lesson.title}
                                  onChange={(e) =>
                                    handleUpdateLesson(lesson.id, week.id, {
                                      title: e.target.value,
                                    })
                                  }
                                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                                />
                              </div>

                              {/* Video Uploader Component */}
                              <LessonVideoUploader
                                videoUrl={lesson.video_url}
                                durationSeconds={lesson.duration_seconds || 0}
                                isPreview={!!lesson.is_preview}
                                onUpdate={(data) =>
                                  handleUpdateLesson(lesson.id, week.id, data)
                                }
                              />

                              {/* Resource Attachments Uploader Component */}
                              <ResourceAttachmentUploader
                                files={lesson.supplementary_files || []}
                                onUpdate={(files) =>
                                  handleUpdateLesson(lesson.id, week.id, {
                                    supplementary_files: files,
                                  })
                                }
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Add Lesson Button */}
                    <button
                      type="button"
                      onClick={() => handleAddLesson(week.id, week.week_number)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-800/30 py-3 text-xs font-semibold text-emerald-400 hover:border-emerald-500 hover:bg-emerald-950/20 transition-all"
                    >
                      <Plus className="h-4 w-4" />
                      Add Lesson to Week {week.week_number}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dynamic Add Next Week Footer Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleAddWeek}
          disabled={isAddingWeek}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-500/40 bg-emerald-950/20 py-4 text-sm font-bold text-emerald-300 hover:border-emerald-500 hover:bg-emerald-950/40 shadow-lg transition-all disabled:opacity-50"
        >
          <Sparkles className="h-5 w-5 text-emerald-400" />
          <span>Add Week {weeks.length + 1} Milestone</span>
        </button>
      </div>
    </div>
  );
}
