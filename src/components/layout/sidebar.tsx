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
    <aside className="w-64 shrink-0 bg-[#0B101D] border-r border-slate-800/80 min-h-[calc(100vh-4rem)] flex flex-col justify-between p-4 transition-colors">
      <div className="space-y-6">
        {/* MARKETPLACE PORTALS */}
        <div>
          <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            EdTech Portals
          </div>
          <nav className="space-y-1">
            <Link
              href="/marketplace"
              className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-300 rounded-lg hover:bg-[#0F172A] hover:text-white transition-colors"
            >
              <Compass className="w-4 h-4 text-emerald-400" />
              <span>Course Catalog</span>
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-300 rounded-lg hover:bg-[#0F172A] hover:text-white transition-colors"
            >
              <GraduationCap className="w-4 h-4 text-amber-400" />
              <span>Student Hub ($500)</span>
            </Link>
            <Link
              href="/studio"
              className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-300 rounded-lg hover:bg-[#0F172A] hover:text-white transition-colors"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Creator Studio (90%)</span>
            </Link>
            <Link
              href="/admin"
              className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-300 rounded-lg hover:bg-[#0F172A] hover:text-white transition-colors"
            >
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Platform Admin (10%)</span>
            </Link>
          </nav>
        </div>
      </div>

      {/* FOOTER USER CARD */}
      <div className="pt-4 border-t border-slate-800">
        <div className="p-3 bg-[#0F172A] rounded-xl border border-slate-800">
          <div className="flex items-center gap-2 mb-1.5">
            <User className="w-3.5 h-3.5 text-brand-400" />
            <span className="text-[11px] font-semibold text-slate-300">Active Persona</span>
          </div>
          <div className="text-xs font-bold text-white truncate">{currentUser.name}</div>
          <div className="text-[11px] text-slate-400 truncate">
            {roleLabel}
          </div>
          {currentUser.email && (
            <div className="text-[10px] text-slate-500 mt-0.5 truncate">
              {currentUser.email}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

