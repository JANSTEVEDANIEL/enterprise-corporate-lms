"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  GraduationCap,
  Star,
  Users,
  ArrowRight,
  BookOpen,
  Sparkles,
} from "lucide-react";

export interface CourseCardProps {
  course: {
    id: string;
    title: string;
    slug: string;
    description?: string;
    creator_name?: string;
    creator?: string;
    category?: string;
    price_cents?: number;
    price_dollars?: number;
    price?: number;
    thumbnail_url?: string | null;
    total_weeks?: number;
    rating?: number;
    enrolled_count?: number;
    sales_count?: number;
    level?: string;
    is_enrolled?: boolean;
  };
  onQuickEnroll?: (course: any) => void;
}

export function CourseCard({ course, onQuickEnroll }: CourseCardProps) {
  const [imgError, setImgError] = useState(false);

  const creator = course.creator_name || course.creator || "Dr. Aris Thorne";
  const category = course.category || "SOFTWARE";
  const totalWeeks = course.total_weeks || 7;
  const rating = course.rating || 4.9;
  const enrollments = course.enrolled_count ?? course.sales_count ?? 142;

  const priceDollars =
    course.price_dollars !== undefined
      ? course.price_dollars
      : course.price_cents !== undefined
      ? course.price_cents / 100
      : course.price !== undefined
      ? course.price
      : 99.0;

  const isFree = priceDollars === 0;

  const categoryBadgeColors: Record<string, string> = {
    SOFTWARE: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    DATA_SCIENCE: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    SECURITY: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    BUSINESS: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    DESIGN: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
    TECHNICAL_UPSKILLING: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  };

  const badgeClass =
    categoryBadgeColors[category.toUpperCase()] ||
    "bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20";

  return (
    <div className="group relative bg-[#0F172A] border border-[#1E293B] hover:border-indigo-500/50 rounded-2xl overflow-hidden shadow-lg hover:shadow-[0_0_25px_-5px_rgba(99,102,241,0.25)] transition-all duration-200 flex flex-col justify-between">
      {/* Top Media / Thumbnail */}
      <div className="relative h-44 w-full overflow-hidden bg-slate-950">
        {course.thumbnail_url && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.thumbnail_url}
            alt={course.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-tr from-slate-950 via-indigo-950/60 to-slate-900 flex items-center justify-center p-6 text-center">
            <div className="space-y-1">
              <BookOpen className="w-8 h-8 text-brand-400 mx-auto opacity-70" />
              <div className="text-xs font-semibold text-slate-300 line-clamp-1">
                {course.title}
              </div>
            </div>
          </div>
        )}

        {/* Total Weeks Overlay Badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/85 border border-slate-700/80 text-white text-[11px] font-semibold shadow-md">
          <Calendar className="w-3 h-3 text-brand-400" />
          <span>{totalWeeks} Weeks Cohort</span>
        </div>

        {/* Rating & Enrollments Pill */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/85 border border-slate-700/80 text-white text-[11px] font-semibold shadow-md">
          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
          <span>{rating.toFixed(1)}</span>
          <span className="text-slate-400 text-[10px]">({enrollments})</span>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          {/* Category & Level */}
          <div className="flex items-center justify-between gap-2">
            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${badgeClass}`}>
              {category.replace(/_/g, " ")}
            </span>
            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
              <Users className="w-3 h-3 text-slate-500" />
              <span>{enrollments} enrolled</span>
            </span>
          </div>

          {/* Title */}
          <Link href={`/marketplace/${course.slug}`}>
            <h3 className="text-base font-bold text-white group-hover:text-brand-300 transition-colors line-clamp-2 leading-snug">
              {course.title}
            </h3>
          </Link>

          {/* Description */}
          {course.description && (
            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
              {course.description}
            </p>
          )}

          {/* Creator Profile */}
          <div className="flex items-center justify-between pt-2.5 border-t border-slate-800 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shadow-sm">
                {creator[0]}
              </div>
              <span className="font-medium text-slate-200">{creator}</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>Verified Creator</span>
            </span>
          </div>
        </div>

        {/* Footer: Price & Actions */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider font-mono">
              Tuition
            </div>
            <div className="text-lg font-extrabold text-white flex items-baseline gap-1 font-mono">
              {isFree ? (
                <span className="text-emerald-400">FREE</span>
              ) : (
                <span>${priceDollars.toFixed(2)}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/marketplace/${course.slug}`}
              className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-all"
            >
              Syllabus
            </Link>

            {course.is_enrolled ? (
              <Link
                href="/dashboard"
                className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <span>Enrolled</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : onQuickEnroll ? (
              <button
                type="button"
                onClick={() => onQuickEnroll(course)}
                className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md shadow-brand-500/25 transition-all flex items-center gap-1.5"
              >
                <span>Enroll</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <Link
                href={`/marketplace/${course.slug}`}
                className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md shadow-brand-500/25 transition-all flex items-center gap-1.5"
              >
                <span>Preview</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

