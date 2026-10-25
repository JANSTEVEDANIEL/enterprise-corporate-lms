import React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  BookOpen,
  Award,
  Users,
  ShieldCheck,
  FileCheck2,
  FolderLock,
  PlaySquare,
  Sparkles,
} from "lucide-react";
import type { SessionUser } from "@/types";
import { hasPermission } from "@/lib/auth";

interface SidebarProps {
  currentUser: SessionUser;
}

export function Sidebar({ currentUser }: SidebarProps) {
  const role = currentUser.role;

  const isManager = hasPermission(role, "MANAGER");
  const isCompliance = hasPermission(role, "COMPLIANCE_OFFICER");
  const isAdmin = role === "SUPER_ADMIN";

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-200 min-h-[calc(100vh-4rem)] flex flex-col justify-between p-4">
      <div className="space-y-6">
        {/* LEARNER SECTION */}
        <div>
          <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Learner Workspace
          </div>
          <nav className="space-y-1">
            <Link
              href="/"
              className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-700 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <LayoutDashboard className="w-4 h-4 text-slate-500" />
              <span>Overview & Roadmap</span>
            </Link>
            <Link
              href="/courses"
              className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-700 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <BookOpen className="w-4 h-4 text-slate-500" />
              <span>Course Catalog</span>
            </Link>
            <Link
              href="/certificates"
              className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-700 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <Award className="w-4 h-4 text-slate-500" />
              <span>My Certificates</span>
            </Link>
          </nav>
        </div>

        {/* MANAGEMENT SECTION */}
        {isManager && (
          <div>
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Management & Team
            </div>
            <nav className="space-y-1">
              <Link
                href="/manager"
                className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-700 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <Users className="w-4 h-4 text-slate-500" />
                <span>Team Compliance</span>
              </Link>
            </nav>
          </div>
        )}

        {/* COMPLIANCE & AUDIT SECTION */}
        {isCompliance && (
          <div>
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Compliance & Legal
            </div>
            <nav className="space-y-1">
              <Link
                href="/compliance"
                className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-700 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-slate-500" />
                <span>Compliance Control</span>
              </Link>
              <Link
                href="/audit"
                className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-700 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <FileCheck2 className="w-4 h-4 text-slate-500" />
                <span>Audit Log Ledger</span>
              </Link>
            </nav>
          </div>
        )}

        {/* ADMINISTRATION SECTION */}
        {isAdmin && (
          <div>
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Administration
            </div>
            <nav className="space-y-1">
              <Link
                href="/admin/courses"
                className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-700 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <FolderLock className="w-4 h-4 text-slate-500" />
                <span>Course Authoring</span>
              </Link>
              <Link
                href="/admin/users"
                className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-700 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <Users className="w-4 h-4 text-slate-500" />
                <span>User Directory</span>
              </Link>
            </nav>
          </div>
        )}

        {/* SIMULATION SECTION */}
        <div>
          <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Synthetic Simulation
          </div>
          <nav className="space-y-1">
            <Link
              href="/simulation"
              className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-indigo-700 bg-indigo-50/60 rounded-lg hover:bg-indigo-100/80 transition-colors"
            >
              <PlaySquare className="w-4 h-4 text-indigo-600" />
              <span>Persona Runner UI</span>
            </Link>
          </nav>
        </div>
      </div>

      {/* FOOTER USER CARD */}
      <div className="pt-4 border-t border-slate-100">
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold text-slate-700">Active Identity</span>
          </div>
          <div className="text-xs font-bold text-slate-900 truncate">{currentUser.name}</div>
          <div className="text-[11px] text-slate-500 truncate">
            {currentUser.jobTitle}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            {currentUser.department} Dept
          </div>
        </div>
      </div>
    </aside>
  );
}
