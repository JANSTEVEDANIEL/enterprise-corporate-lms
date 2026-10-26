"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Globe,
  Lock,
  Layers,
  DollarSign,
  Users,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { CurriculumBuilder } from "@/components/studio/curriculum-builder";
import type { MarketplaceCourse, CurriculumWeek } from "@/types/marketplace";

export default function CourseEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: courseId } = use(params);
  const router = useRouter();

  const [course, setCourse] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingMeta, setSavingMeta] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("SOFTWARE");
  const [priceDollars, setPriceDollars] = useState("49.99");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    async function loadCourse() {
      try {
        const res = await fetch(`/api/studio/courses/${courseId}`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to load course");
        }
        setCourse(data.course);
        setTitle(data.course.title || "");
        setDescription(data.course.description || "");
        setCategory(data.course.category || "SOFTWARE");
        setPriceDollars(
          data.course.price_dollars !== undefined
            ? String(data.course.price_dollars)
            : (data.course.price_cents / 100).toFixed(2)
        );
        setThumbnailUrl(data.course.thumbnail_url || "");
        setIsPublished(Boolean(data.course.is_published));
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to fetch course details");
      } finally {
        setLoading(false);
      }
    }
    loadCourse();
  }, [courseId]);

  const showSuccess = (text: string) => {
    setSuccessMsg(text);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleInstantPublishToggle = async () => {
    const nextState = !isPublished;
    setIsPublished(nextState);
    try {
      const res = await fetch(`/api/studio/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: nextState }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setIsPublished(!nextState);
        throw new Error(data.error || "Failed to toggle publishing status");
      }
      showSuccess(
        nextState
          ? "Course published instantly to public marketplace!"
          : "Course reverted to draft mode."
      );
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update publish state");
    }
  };

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMeta(true);
    setErrorMsg(null);

    try {
      const priceVal = parseFloat(priceDollars);
      if (isNaN(priceVal) || priceVal < 0) {
        throw new Error("Price must be a valid non-negative amount");
      }

      const res = await fetch(`/api/studio/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          price_cents: Math.round(priceVal * 100),
          thumbnail_url: thumbnailUrl.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save course changes");
      }

      setCourse((prev: any) => ({ ...prev, ...data.course }));
      showSuccess("Course details updated successfully!");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save course changes");
    } finally {
      setSavingMeta(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <span>Loading Curriculum Studio...</span>
        </div>
      </div>
    );
  }

  if (!course && errorMsg) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-6 text-center text-rose-300">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-400 mb-2" />
          <h2 className="text-lg font-bold">Course Not Found</h2>
          <p className="text-sm mt-1">{errorMsg}</p>
          <Link
            href="/studio"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            <ArrowLeft className="h-4 w-4" /> Return to Studio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Top Navigation & Status Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-4">
            <Link
              href="/studio"
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Creator Studio</span>
            </Link>
            <div>
              <span className="text-xs uppercase tracking-wider text-slate-400">
                Course Editor & Curriculum Builder
              </span>
              <h1 className="text-2xl font-extrabold text-white truncate max-w-xl">
                {title || course?.title || "Untitled Course"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Instant Publish Toggle Button */}
            <button
              type="button"
              onClick={handleInstantPublishToggle}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all shadow-lg ${
                isPublished
                  ? "bg-emerald-600 text-white shadow-emerald-950/40 hover:bg-emerald-500"
                  : "border border-amber-500/40 bg-amber-950/30 text-amber-300 hover:bg-amber-950/50"
              }`}
            >
              {isPublished ? (
                <>
                  <Globe className="h-4 w-4" />
                  <span>Published (Live on Marketplace)</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Draft Mode (Click to Publish)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status Alerts */}
        {successMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/70 p-4 text-sm text-emerald-300 backdrop-blur-md">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-950/70 p-4 text-sm text-rose-300 backdrop-blur-md">
            <AlertCircle className="h-5 w-5 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Analytics Overview Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Listing Price</span>
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-slate-100">
              ${parseFloat(priceDollars || "0").toFixed(2)}
            </p>
            <p className="text-[11px] text-slate-500">90% Creator Revenue Share</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Enrolled Students</span>
              <Users className="h-4 w-4 text-indigo-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-slate-100">
              {course?.sales_count ?? 0}
            </p>
            <p className="text-[11px] text-slate-500">Direct active learners</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Gross Sales</span>
              <Sparkles className="h-4 w-4 text-amber-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-slate-100">
              ${((course?.gross_revenue_cents ?? 0) / 100).toFixed(2)}
            </p>
            <p className="text-[11px] text-slate-500">Total volume generated</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Net Earnings</span>
              <CheckCircle2 className="h-4 w-4 text-teal-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-teal-300">
              ${((course?.creator_earnings_cents ?? 0) / 100).toFixed(2)}
            </p>
            <p className="text-[11px] text-teal-500/80">90% net creator payout</p>
          </div>
        </div>

        {/* Section 1: Course Metadata Configuration */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Course Properties & Marketplace Listing</h2>
              <p className="text-xs text-slate-400">Configure title, pricing, category, and cover image</p>
            </div>
            <button
              type="button"
              onClick={handleSaveMetadata}
              disabled={savingMeta}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-500 transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{savingMeta ? "Saving..." : "Save Properties"}</span>
            </button>
          </div>

          <form onSubmit={handleSaveMetadata} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-slate-300">Course Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Cloud Native Architecture & Distributed Systems"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-slate-300">Course Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Comprehensive weekly roadmap and outcomes..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="SOFTWARE">Software & Engineering</option>
                  <option value="BUSINESS">Business & Product</option>
                  <option value="DESIGN">Design & UX</option>
                  <option value="MARKETING">Marketing & Growth</option>
                  <option value="DATA_SCIENCE">Data Science & AI</option>
                  <option value="SECURITY">Cybersecurity</option>
                  <option value="COMPLIANCE">Regulatory Compliance</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Price (USD)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceDollars}
                    onChange={(e) => setPriceDollars(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/80 pl-8 pr-3.5 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-slate-300">Thumbnail Cover Image URL</label>
                <input
                  type="url"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </form>
        </div>

        {/* Section 2: 1 to 7+ Week Curriculum Builder Engine */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-white">Curriculum & Weekly Milestones</h2>
              <p className="text-xs text-slate-400">
                Structure lessons into sequential weeks (Week 1 through Week 7+), attach videos, downloadable resources, and knowledge checks.
              </p>
            </div>
          </div>

          <CurriculumBuilder
            courseId={courseId}
            initialWeeks={course?.weeks || []}
            isPublished={isPublished}
            onCurriculumChange={(updatedWeeks) => {
              setCourse((prev: any) => ({ ...prev, weeks: updatedWeeks }));
            }}
          />
        </div>
      </div>
    </div>
  );
}
