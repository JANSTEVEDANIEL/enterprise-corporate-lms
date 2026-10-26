"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  Layers,
  DollarSign,
  AlertCircle,
  PlusCircle,
} from "lucide-react";

export default function NewCoursePage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("SOFTWARE");
  const [priceDollars, setPriceDollars] = useState("49.99");
  const [thumbnailUrl, setThumbnailUrl] = useState(
    "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80"
  );
  const [totalWeeks, setTotalWeeks] = useState(4);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const priceVal = parseFloat(priceDollars);
      if (isNaN(priceVal) || priceVal < 0) {
        throw new Error("Price must be a valid non-negative number");
      }

      const res = await fetch("/api/studio/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          price_cents: Math.round(priceVal * 100),
          thumbnail_url: thumbnailUrl.trim() || null,
          total_weeks: Math.max(1, parseInt(String(totalWeeks)) || 1),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create course");
      }

      // Redirect directly to the course edit / curriculum builder page
      router.push(`/studio/courses/${data.course.id}/edit`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create course");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center gap-4 border-b border-slate-800 pb-5">
          <Link
            href="/studio"
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Cancel</span>
          </Link>
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-400">
              Co-Admin Creator Studio
            </span>
            <h1 className="text-2xl font-black text-white">Create New Course</h1>
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-950/70 p-4 text-sm text-rose-300 backdrop-blur-md">
            <AlertCircle className="h-5 w-5 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-200">
                Course Title <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Full-Stack Next.js 15 & System Architecture"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-200">
                Course Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Overview of curriculum, target audience, and key skills..."
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-200">Category</label>
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
                <label className="text-xs font-bold text-slate-200">Price (USD)</label>
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
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-200">
                  Initial Weekly Milestones
                </label>
                <select
                  value={totalWeeks}
                  onChange={(e) => setTotalWeeks(parseInt(e.target.value) || 1)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="1">1 Week (Crash Course)</option>
                  <option value="2">2 Weeks (Foundational)</option>
                  <option value="3">3 Weeks</option>
                  <option value="4">4 Weeks (Standard Sprint)</option>
                  <option value="5">5 Weeks</option>
                  <option value="6">6 Weeks</option>
                  <option value="7">7 Weeks (Comprehensive Bootcamp)</option>
                  <option value="8">8+ Weeks (Advanced Roadmap)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-200">Thumbnail Image URL</label>
                <input
                  type="url"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3.5 text-sm font-bold text-white shadow-xl shadow-emerald-950/50 hover:from-emerald-500 hover:to-teal-500 transition-all disabled:opacity-50"
          >
            <PlusCircle className="h-5 w-5" />
            <span>{isSubmitting ? "Creating Course..." : "Create Course & Open Curriculum Builder"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
