import React from "react";
import { LucideIcon } from "lucide-react";

interface ComplianceKpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  badge?: {
    text: string;
    variant?: "success" | "warning" | "danger" | "info";
  };
  trend?: {
    text: string;
    positive?: boolean;
  };
  progress?: number;
  colorTheme?: "blue" | "emerald" | "amber" | "rose" | "indigo";
}

export function ComplianceKpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  trend,
  progress,
  colorTheme = "blue",
}: ComplianceKpiCardProps) {
  const colorMap = {
    blue: {
      iconBg: "bg-blue-50 text-blue-600 border-blue-100",
      barBg: "bg-blue-600",
    },
    emerald: {
      iconBg: "bg-emerald-50 text-emerald-600 border-emerald-100",
      barBg: "bg-emerald-600",
    },
    amber: {
      iconBg: "bg-amber-50 text-amber-600 border-amber-100",
      barBg: "bg-amber-600",
    },
    rose: {
      iconBg: "bg-rose-50 text-rose-600 border-rose-100",
      barBg: "bg-rose-600",
    },
    indigo: {
      iconBg: "bg-indigo-50 text-indigo-600 border-indigo-100",
      barBg: "bg-indigo-600",
    },
  }[colorTheme];

  const badgeMap = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <div className="p-5 bg-white rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            {title}
          </span>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {value}
          </div>
        </div>
        <div className={`p-2.5 rounded-lg border ${colorMap.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {(subtitle || badge || trend) && (
        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
          {subtitle && <span className="text-slate-500 truncate">{subtitle}</span>}
          {badge && (
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                badgeMap[badge.variant || "info"]
              }`}
            >
              {badge.text}
            </span>
          )}
          {trend && (
            <span
              className={`font-medium ${
                trend.positive ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {trend.text}
            </span>
          )}
        </div>
      )}

      {progress !== undefined && (
        <div className="mt-3 space-y-1">
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${colorMap.barBg} transition-all duration-500`}
              style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
