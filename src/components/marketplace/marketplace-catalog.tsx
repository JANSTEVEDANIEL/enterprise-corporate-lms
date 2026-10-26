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

export function MarketplaceCatalog({ initialCourses, currentUser }: MarketplaceCatalogProps) {
  const [courses, setCourses] = useState<any[]>(initialCourses);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [priceFilter, setPriceFilter] = useState<"ALL" | "FREE" | "PAID">("ALL");
  const [selectedCourseForCheckout, setSelectedCourseForCheckout] = useState<any | null>(null);

  // Extract unique category names
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const c of courses) {
      if (c.category) {
        set.add(c.category);
      }
    }
    const catList = Array.from(set).map((cat) => {
      if (cat === "SOFTWARE") return "Software Engineering";
      if (cat === "DATA_SCIENCE") return "AI & Data Science";
      if (cat === "SECURITY") return "Cloud Security";
      if (cat === "BUSINESS") return "Business & Leadership";
      if (cat === "DESIGN") return "Design";
      return cat.replace(/_/g, " ");
    });
    return ["All Categories", ...catList];
  }, [courses]);

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

      // 2. Category
      if (selectedCategory !== "All Categories") {
        const catUpper = c.category?.toUpperCase() || "";
        const selUpper = selectedCategory.toUpperCase();
        if (selUpper.includes("SOFTWARE") && !catUpper.includes("SOFTWARE")) return false;
        if (selUpper.includes("AI") && !catUpper.includes("DATA_SCIENCE")) return false;
        if (selUpper.includes("SECURITY") && !catUpper.includes("SECURITY")) return false;
        if (selUpper.includes("BUSINESS") && !catUpper.includes("BUSINESS") && !catUpper.includes("LEADERSHIP")) return false;
        if (selUpper.includes("DESIGN") && !catUpper.includes("DESIGN")) return false;
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
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl backdrop-blur-xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-brand-950/70 border border-slate-700/60 p-8 sm:p-12 text-white shadow-2xl">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-xs font-semibold text-brand-300">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            <span>Public EdTech Marketplace Catalog</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Level Up Your Engineering Career with Deep-Dive Weekly Cohorts
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
            Multi-week structured curriculums (1 to 7+ weeks) taught by leading domain creators.
            Video lectures, downloadable architectures, interactive quizzes, and verified certificates.
          </p>

          {/* Quick Stats Pill */}
          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-slate-300">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Zero-Barrier Public Browsing</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 backdrop-blur-md">
              <span className="font-semibold text-white">100% Creator IP Protected</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 backdrop-blur-md">
              <span className="font-semibold text-white">$500.00 Pre-Funded Demo Wallet</span>
            </div>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-brand-600/15 rounded-full blur-3xl pointer-events-none" />
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
