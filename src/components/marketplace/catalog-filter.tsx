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
            className="w-full h-10 pl-10 pr-9 text-xs rounded-xl bg-[#0F172A] border border-[#1E293B] text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 shadow-sm transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Price Filter Segmented Button */}
        <div className="flex items-center gap-1 p-1 bg-[#0F172A] border border-[#1E293B] rounded-xl self-start sm:self-auto">
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
                    ? "bg-indigo-600 text-white shadow-sm font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {labels[filter]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Pills Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E293B] pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryChange(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold"
                    : "bg-[#0F172A] border border-[#1E293B] text-slate-400 hover:text-white hover:border-slate-700"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {totalResults !== undefined && (
          <div className="text-xs text-slate-400">
            Showing <span className="font-semibold text-white">{totalResults}</span> cohorts
          </div>
        )}
      </div>
    </div>
  );
}
