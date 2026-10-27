"use client";

import React from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

export interface CatalogFilterProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  priceFilter: "ALL" | "FREE" | "PAID";
  onPriceFilterChange: (filter: "ALL" | "FREE" | "PAID") => void;
  categories?: string[];
  totalResults?: number;
}

const DEFAULT_CATEGORIES = [
  "All Categories",
  "AI & Data Science",
  "Cloud & Distributed Systems",
  "Software Engineering",
  "UI/UX Design",
  "Leadership",
];

export function CatalogFilter({
  searchTerm,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  priceFilter,
  onPriceFilterChange,
  categories = DEFAULT_CATEGORIES,
  totalResults,
}: CatalogFilterProps) {
  return (
    <div className="space-y-4">
      {/* Top Search & Price Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search Input Bar */}
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search distributed systems, AI swarms, zero-trust security..."
            className="w-full h-10 pl-10 pr-9 text-xs rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 backdrop-blur-md shadow-sm transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Price Filter Segmented Button */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-xl backdrop-blur-md self-start sm:self-auto">
          {(["ALL", "PAID", "FREE"] as const).map((filter) => {
            const isActive = priceFilter === filter;
            const labels: Record<string, string> = {
              ALL: "All Prices",
              PAID: "Paid Only",
              FREE: "Free Courses",
            };

            return (
              <button
                key={filter}
                type="button"
                onClick={() => onPriceFilterChange(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {labels[filter]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Pills Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryChange(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                    : "bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {totalResults !== undefined && (
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Showing <span className="font-semibold text-slate-900 dark:text-white">{totalResults}</span> cohorts
          </div>
        )}
      </div>
    </div>
  );
}
