"use client";
import React from "react";

interface ProgressBarProps {
  value: number; // 0 to 100
  size?: "xs" | "sm" | "md" | "lg";
  color?: "brand" | "emerald" | "amber" | "rose" | "purple" | "blue";
  showLabel?: boolean;
  className?: string;
  label?: string;
}

export function ProgressBar({
  value,
  size = "md",
  color = "brand",
  showLabel = false,
  className = "",
  label,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));

  const sizeClasses = {
    xs: "h-1.5",
    sm: "h-2",
    md: "h-2.5",
    lg: "h-3.5",
  }[size];

  const colorClasses = {
    brand: "bg-blue-600",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    purple: "bg-purple-600",
    blue: "bg-sky-500",
  }[color];

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
          <span>{label || "Progress"}</span>
          <span>{clamped}%</span>
        </div>
      )}
      <div
        className={`w-full bg-slate-100 rounded-full overflow-hidden ${sizeClasses}`}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`${sizeClasses} ${colorClasses} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
