import React from "react";
import Link from "next/link";
import {
  Compass,
  GraduationCap,
  Sparkles,
  ShieldAlert,
  User,
} from "lucide-react";
import type { SessionUser } from "@/types";

interface SidebarProps {
  currentUser: SessionUser;
}

export function Sidebar({ currentUser }: SidebarProps) {
  const role = currentUser.role;

  const roleLabel =
    role === "STUDENT"
      ? "Student Learner"
      : role === "CO_ADMIN"
      ? "Course Creator (Co-Admin)"
      : role === "SUPER_ADMIN"
      ? "Platform Super Admin"
      : role;

  return (
    <aside className="w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 min-h-[calc(100vh-4rem)] flex flex-col justify-between p-4 transition-colors">
      <div className="space-y-6">
        {/* MARKETPLACE PORTALS */}
        <div>
          <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            EdTech Portals
          </div>
          <nav className="space-y-1">
            <Link
              href="/marketplace"
              className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Compass className="w-4 h-4 text-emerald-500" />
              <span>Course Catalog</span>
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <GraduationCap className="w-4 h-4 text-amber-500" />
              <span>Student Hub ($500)</span>
            </Link>
            <Link
              href="/studio"
              className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>Creator Studio (90%)</span>
            </Link>
            <Link
              href="/admin"
              className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <span>Platform Admin (10%)</span>
            </Link>
          </nav>
        </div>
      </div>

      {/* FOOTER USER CARD */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
          <div className="flex items-center gap-2 mb-1.5">
            <User className="w-3.5 h-3.5 text-brand-500" />
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Active Persona</span>
          </div>
          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser.name}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {roleLabel}
          </div>
          {currentUser.email && (
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
              {currentUser.email}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
