"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FolderLock,
  Plus,
  BookOpen,
  CheckCircle2,
  Clock,
  Sparkles,
  X,
  ExternalLink,
  Layers,
} from "lucide-react";
import type { CourseCategory } from "@/types";

interface CourseRecord {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: CourseCategory;
  target_role: string;
  is_mandatory: number;
  estimated_minutes: number;
  renewal_period_days: number | null;
  passing_score_pct: number;
  version: string;
  is_published: number;
  created_at: string;
  modules_count: number;
  enrollments_count: number;
  completed_count: number;
}

interface CourseAuthoringClientProps {
  initialCourses: CourseRecord[];
}

export function CourseAuthoringClient({ initialCourses }: CourseAuthoringClientProps) {
  const [courses, setCourses] = useState<CourseRecord[]>(initialCourses);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CourseCategory>("COMPLIANCE");
  const [targetRole, setTargetRole] = useState("ALL");
  const [isMandatory, setIsMandatory] = useState(true);
  const [estimatedMinutes, setEstimatedMinutes] = useState(45);
  const [renewalPeriodDays, setRenewalPeriodDays] = useState(365);
  const [passingScorePct, setPassingScorePct] = useState(80);
  const [initialModuleTitle, setInitialModuleTitle] = useState("Module 1: Foundation & Guidelines");
  const [initialModuleContent, setInitialModuleContent] = useState(
    "# Training Curriculum\n\nWelcome to this training module. Complete all required steps."
  );

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slug || slug === title.toLowerCase().replace(/[^a-z0-9]+/g, "-")) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug,
          description,
          category,
          targetRole,
          isMandatory,
          estimatedMinutes,
          renewalPeriodDays: Number(renewalPeriodDays) || null,
          passingScorePct: Number(passingScorePct),
          modules: [
            {
              title: initialModuleTitle,
              content: initialModuleContent,
              type: "RICH_MARKDOWN",
              estimatedMinutes: Math.min(estimatedMinutes, 30),
            },
          ],
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSuccessNote(`Course "${title}" created and published successfully!`);
        setCourses([
          {
            ...data.course,
            modules_count: 1,
            enrollments_count: 0,
            completed_count: 0,
          },
          ...courses,
        ]);
        setIsModalOpen(false);
        // Reset form
        setTitle("");
        setSlug("");
        setDescription("");
        setTimeout(() => setSuccessNote(null), 4000);
      } else {
        setError(data.error || "Failed to author course");
      }
    } catch (err: any) {
      setError(err.message || "Network error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {successNote && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successNote}</span>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">
          Showing <span className="font-bold text-slate-800">{courses.length}</span> published corporate curriculums
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition-colors cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Author New Course</span>
        </button>
      </div>

      {/* Courses List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((course) => (
          <div
            key={course.id}
            className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-3 hover:border-slate-300 transition-colors"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                  {course.category}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  v{course.version}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 line-clamp-1">{course.title}</h3>
                <p className="text-xs text-slate-500 line-clamp-2 mt-1">{course.description}</p>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px]">PASS THRESHOLD</span>
                  <span className="font-semibold text-slate-800">{course.passing_score_pct}%</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">RECERTIFICATION</span>
                  <span className="font-semibold text-slate-800">
                    {course.renewal_period_days ? `${course.renewal_period_days} Days` : "Permanent"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">CURRICULUM</span>
                  <span className="font-semibold text-slate-800">{course.modules_count} Modules</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">ENROLLMENTS</span>
                  <span className="font-semibold text-slate-800">
                    {course.completed_count}/{course.enrollments_count} Certified
                  </span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <Link
                  href={`/courses/${course.id}`}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1"
                >
                  <span>View Syllabus</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
                <span className="text-[10px] text-slate-400">Target: {course.target_role}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Authoring Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FolderLock className="w-5 h-5 text-brand-600" />
                <h4 className="text-sm font-bold text-slate-900">Author New Enterprise Course</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700">
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleCreateCourse} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Course Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. Advanced Cryptographic Key Management 2026"
                  className="w-full h-8 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Course Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as CourseCategory)}
                    className="w-full h-8 px-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                  >
                    <option value="COMPLIANCE">COMPLIANCE</option>
                    <option value="SECURITY">SECURITY</option>
                    <option value="ONBOARDING">ONBOARDING</option>
                    <option value="TECHNICAL_UPSKILLING">TECHNICAL_UPSKILLING</option>
                    <option value="LEADERSHIP">LEADERSHIP</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Target Audience *</label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="w-full h-8 px-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                  >
                    <option value="ALL">ALL (Company-wide)</option>
                    <option value="ENGINEERING">ENGINEERING</option>
                    <option value="SECURITY">SECURITY</option>
                    <option value="NEW_HIRE">NEW_HIRE</option>
                    <option value="OPERATIONS">OPERATIONS</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Description *</label>
                <textarea
                  required
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summary of course curriculum, learning objectives, and regulatory compliance scope..."
                  className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Pass Score (%) *</label>
                  <input
                    type="number"
                    min="50"
                    max="100"
                    required
                    value={passingScorePct}
                    onChange={(e) => setPassingScorePct(Number(e.target.value))}
                    className="w-full h-8 px-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Renewal (Days)</label>
                  <input
                    type="number"
                    min="0"
                    max="730"
                    value={renewalPeriodDays}
                    onChange={(e) => setRenewalPeriodDays(Number(e.target.value))}
                    placeholder="365"
                    className="w-full h-8 px-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Duration (Min)</label>
                  <input
                    type="number"
                    min="10"
                    max="480"
                    value={estimatedMinutes}
                    onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                    className="w-full h-8 px-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Initial Module Definition */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <span className="font-bold text-slate-700 block uppercase text-[10px] tracking-wider">
                  Initial Module Curriculum
                </span>
                <div>
                  <label className="text-[11px] text-slate-600 block mb-0.5">Module Title</label>
                  <input
                    type="text"
                    required
                    value={initialModuleTitle}
                    onChange={(e) => setInitialModuleTitle(e.target.value)}
                    className="w-full h-7 px-2 border border-slate-200 rounded bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-600 block mb-0.5">Markdown Content</label>
                  <textarea
                    rows={3}
                    required
                    value={initialModuleContent}
                    onChange={(e) => setInitialModuleContent(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded bg-white font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="mandatoryCheck"
                  checked={isMandatory}
                  onChange={(e) => setIsMandatory(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="mandatoryCheck" className="text-xs text-slate-700 font-medium">
                  Mandatory Compliance Course (Auto-enrolled across target audience)
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-brand-600 text-white font-semibold hover:bg-brand-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Creating Course..." : "Publish Course"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
