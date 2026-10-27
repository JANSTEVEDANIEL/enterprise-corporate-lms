"use client";

import React, { useState, useMemo } from "react";
import { Sparkles, Compass, BookOpen } from "lucide-react";
import { CourseCard } from "./course-card";
import { CatalogFilter } from "./catalog-filter";
import { CheckoutModal } from "./checkout-modal";
import type { SessionUser } from "@/types";

export interface MarketplaceCatalogProps {
  initialCourses: any[];
  currentUser?: SessionUser | null;
}

const CORPORATE_CATEGORIES = new Set(["ONBOARDING", "COMPLIANCE", "TECHNICAL_UPSKILLING"]);

const EXACT_MARKETPLACE_CATEGORIES = [
  "All Categories",
  "AI & Data Science",
  "Cloud & Distributed Systems",
  "Software Engineering",
  "UI/UX Design",
  "Leadership",
];

export function MarketplaceCatalog({ initialCourses, currentUser }: MarketplaceCatalogProps) {
  const sanitizedCourses = useMemo(() => {
    return (initialCourses || []).filter((c) => {
      const cat = (c.category || "").toUpperCase();
      return !CORPORATE_CATEGORIES.has(cat);
    });
  }, [initialCourses]);

  const [courses, setCourses] = useState<any[]>(sanitizedCourses);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [priceFilter, setPriceFilter] = useState<"ALL" | "FREE" | "PAID">("ALL");
  const [selectedCourseForCheckout, setSelectedCourseForCheckout] = useState<any | null>(null);

  // Exact 5 marketplace category pills
  const categories = EXACT_MARKETPLACE_CATEGORIES;

  // Filter courses based on search, category, and price
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      // 1. Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesTitle = c.title?.toLowerCase().includes(query);
        const matchesDesc = c.description?.toLowerCase().includes(query);
        const matchesCreator =
          c.creator_name?.toLowerCase().includes(query) ||
          c.creator?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc && !matchesCreator) {
          return false;
        }
      }

      // 2. Exact 5-Category matching
      if (selectedCategory !== "All Categories") {
        const catUpper = (c.category || "").toUpperCase();
        const titleUpper = (c.title || "").toUpperCase();
        const descUpper = (c.description || "").toUpperCase();

        if (selectedCategory === "AI & Data Science") {
          const matchesCat =
            catUpper === "DATA_SCIENCE" ||
            catUpper === "AI" ||
            catUpper.includes("AI") ||
            catUpper.includes("DATA");
          const matchesContent =
            titleUpper.includes("AI") ||
            titleUpper.includes("LLM") ||
            titleUpper.includes("DATA SCIENCE") ||
            titleUpper.includes("AGENTS") ||
            descUpper.includes("AI") ||
            descUpper.includes("LLM");
          if (!matchesCat && !matchesContent) return false;
        } else if (selectedCategory === "Cloud & Distributed Systems") {
          const matchesCat =
            catUpper === "CLOUD" ||
            catUpper === "DISTRIBUTED" ||
            catUpper === "SECURITY" ||
            catUpper.includes("CLOUD");
          const matchesContent =
            titleUpper.includes("CLOUD") ||
            titleUpper.includes("DISTRIBUTED") ||
            titleUpper.includes("SECURITY") ||
            titleUpper.includes("ZERO-TRUST") ||
            titleUpper.includes("DEVSECOPS") ||
            titleUpper.includes("KUBERNETES") ||
            descUpper.includes("CLOUD") ||
            descUpper.includes("DISTRIBUTED");
          if (!matchesCat && !matchesContent) return false;
        } else if (selectedCategory === "Software Engineering") {
          const matchesCat =
            catUpper === "SOFTWARE" ||
            catUpper.includes("SOFTWARE") ||
            catUpper.includes("ENGINEERING");
          const matchesContent =
            titleUpper.includes("SOFTWARE") ||
            titleUpper.includes("GIT") ||
            titleUpper.includes("ENGINEERING") ||
            titleUpper.includes("FULL-STACK") ||
            descUpper.includes("ENGINEERING");
          if (!matchesCat && !matchesContent) return false;
        } else if (selectedCategory === "UI/UX Design") {
          const matchesCat =
            catUpper === "DESIGN" ||
            catUpper === "UI_UX" ||
            catUpper.includes("DESIGN") ||
            catUpper.includes("UI");
          const matchesContent =
            titleUpper.includes("DESIGN") ||
            titleUpper.includes("UI") ||
            titleUpper.includes("UX") ||
            descUpper.includes("DESIGN");
          if (!matchesCat && !matchesContent) return false;
        } else if (selectedCategory === "Leadership") {
          const matchesCat =
            catUpper === "LEADERSHIP" ||
            catUpper === "BUSINESS" ||
            catUpper.includes("LEAD");
          const matchesContent =
            titleUpper.includes("LEADERSHIP") ||
            titleUpper.includes("MANAGEMENT") ||
            titleUpper.includes("STAFF") ||
            descUpper.includes("LEADERSHIP");
          if (!matchesCat && !matchesContent) return false;
        }
      }

      // 3. Price filter
      const price = c.price_dollars ?? (c.price_cents ? c.price_cents / 100 : c.price ?? 0);
      if (priceFilter === "FREE" && price > 0) return false;
      if (priceFilter === "PAID" && price === 0) return false;

      return true;
    });
  }, [courses, searchTerm, selectedCategory, priceFilter]);

  function handleEnrollSuccess(result: any) {
    // Mark course as enrolled locally
    if (result && result.course) {
      setCourses((prev) =>
        prev.map((c) => (c.id === result.course.id ? { ...c, is_enrolled: true } : c))
      );
    }
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Executive Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-[#0F172A] border border-[#1E293B] p-8 sm:p-12 text-white shadow-2xl">
        <div className="relative z-10 max-w-4xl space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-xs font-semibold text-indigo-400">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Executive EdTech Course Marketplace</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Master Advanced Systems Engineering with Intensive Cohorts
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
            Multi-week structured curriculums (1 to 7+ weeks) led by verified domain architects.
            Master full-stack distributed systems, AI agent swarms, zero-trust cloud security, and UI design systems.
          </p>

          {/* Key Value Metrics Grid */}
          <div className="pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="flex flex-col p-3 rounded-xl bg-[#090D16] border border-[#1E293B]">
              <span className="text-lg font-bold text-white">7 Cohorts</span>
              <span className="text-[11px] text-slate-400 mt-0.5">1-7+ Week Tracks</span>
            </div>
            <div className="flex flex-col p-3 rounded-xl bg-[#090D16] border border-[#1E293B]">
              <span className="text-lg font-bold text-emerald-400">10 / 90 Split</span>
              <span className="text-[11px] text-slate-400 mt-0.5">Instant Creator Payout</span>
            </div>
            <div className="flex flex-col p-3 rounded-xl bg-[#090D16] border border-[#1E293B]">
              <span className="text-lg font-bold text-indigo-400">100% Shield</span>
              <span className="text-[11px] text-slate-400 mt-0.5">Creator IP Protection</span>
            </div>
            <div className="flex flex-col p-3 rounded-xl bg-[#090D16] border border-[#1E293B]">
              <span className="text-lg font-bold text-amber-400">$500.00 USD</span>
              <span className="text-[11px] text-slate-400 mt-0.5">Pre-Funded Wallet</span>
            </div>
          </div>
        </div>
      </section>

      {/* Catalog Filters Bar */}
      <CatalogFilter
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        priceFilter={priceFilter}
        onPriceFilterChange={setPriceFilter}
        categories={categories}
        totalResults={filteredCourses.length}
      />

      {/* Course Cards Grid */}
      {filteredCourses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onQuickEnroll={(c) => setSelectedCourseForCheckout(c)}
            />
          ))}
        </div>
      ) : (
        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 space-y-3">
          <BookOpen className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">
            No courses found matching your filter
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search keyword, resetting category filters, or selecting &quot;All Prices&quot;.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setSelectedCategory("All Categories");
              setPriceFilter("ALL");
            }}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md transition-all"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Checkout Modal */}
      {selectedCourseForCheckout && (
        <CheckoutModal
          course={selectedCourseForCheckout}
          isOpen={!!selectedCourseForCheckout}
          onClose={() => setSelectedCourseForCheckout(null)}
          onSuccess={handleEnrollSuccess}
          studentId={currentUser?.role === "STUDENT" ? currentUser.id : "usr_sophia_chen"}
        />
      )}
    </div>
  );
}
