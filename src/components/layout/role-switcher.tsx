"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  GraduationCap,
  Sparkles,
  ShieldCheck,
  Wallet,
  Check,
  ChevronDown,
  Layers,
  Briefcase,
  UserCheck,
} from "lucide-react";
import type { Role, SessionUser } from "@/types";
import { ThemeToggle } from "./theme-toggle";

interface RoleSwitcherProps {
  initialUser?: SessionUser;
  walletBalance?: number;
}

const MARKETPLACE_ROLES = [
  {
    id: "usr_sophia_chen",
    name: "Sophia Chen",
    role: "STUDENT" as Role,
    label: "Student",
    subtitle: "$500 Wallet",
    icon: GraduationCap,
    defaultPath: "/dashboard",
    activeClass: "bg-amber-500/20 border-amber-500/50 text-amber-200 ring-1 ring-amber-400/40",
    badgeClass: "bg-amber-400/10 text-amber-300 border-amber-400/30",
  },
  {
    id: "usr_aris_thorne",
    name: "Dr. Aris Thorne",
    role: "CO_ADMIN" as Role,
    label: "Co-Admin",
    subtitle: "Creator (90% Cut)",
    icon: Sparkles,
    defaultPath: "/studio",
    activeClass: "bg-indigo-500/20 border-indigo-500/50 text-indigo-200 ring-1 ring-indigo-400/40",
    badgeClass: "bg-indigo-400/10 text-indigo-300 border-indigo-400/30",
  },
  {
    id: "usr_david_kim",
    name: "David Kim",
    role: "SUPER_ADMIN" as Role,
    label: "Super Admin",
    subtitle: "Platform Operator",
    icon: ShieldCheck,
    defaultPath: "/admin",
    activeClass: "bg-rose-500/20 border-rose-500/50 text-rose-200 ring-1 ring-rose-400/40",
    badgeClass: "bg-rose-400/10 text-rose-300 border-rose-400/30",
  },
];

const CORPORATE_ROLES = [
  { id: "usr_alex_rivera", name: "Alex Rivera", role: "EMPLOYEE", title: "Junior Engineer" },
  { id: "usr_elena_rostova", name: "Elena Rostova", role: "EMPLOYEE", title: "Security Engineer" },
  { id: "usr_sarah_jenkins", name: "Sarah Jenkins", role: "MANAGER", title: "Engineering Manager" },
  { id: "usr_marcus_vance", name: "Marcus Vance", role: "COMPLIANCE_OFFICER", title: "Compliance Officer" },
];

export function RoleSwitcher({ initialUser, walletBalance = 500.0 }: RoleSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<SessionUser | undefined>(initialUser);
  const [balance, setBalance] = useState<number>(walletBalance);
  const [isSwitching, setIsSwitching] = useState(false);
  const [corporateOpen, setCorporateOpen] = useState(false);
  const corporateRef = useRef<HTMLDivElement>(null);

  // Close corporate dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (corporateRef.current && !corporateRef.current.contains(e.target as Node)) {
        setCorporateOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Poll or sync session on initial load if not set
  useEffect(() => {
    async function syncSession() {
      try {
        const res = await fetch("/api/auth/session");
        const json = await res.json();
        if (json.success && json.data?.currentUser) {
          setCurrentUser(json.data.currentUser);
        }
      } catch {
        // ignore offline/build errors
      }
    }
    if (!currentUser) {
      syncSession();
    }
  }, [currentUser]);

  const handleRoleSwitch = async (userId: string, targetPath?: string) => {
    if (isSwitching) return;
    setIsSwitching(true);

    // Instant local cookie setting
    document.cookie = `lms_user_id=${userId}; path=/; max-age=2592000; SameSite=Lax`;

    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.success && data.data?.user) {
        setCurrentUser(data.data.user);
      }
    } catch (err) {
      console.error("Failed to switch persona", err);
    } finally {
      setIsSwitching(false);
      setCorporateOpen(false);
    }

    // Smooth page transition without broken reload
    if (targetPath && pathname !== targetPath) {
      router.push(targetPath);
    } else {
      router.refresh();
    }
  };

  const activeRoleId = currentUser?.id || "usr_alex_rivera";
  const activeRole = currentUser?.role || "EMPLOYEE";
  const isStudent = activeRole === "STUDENT" || activeRoleId === "usr_sophia_chen";

  return (
    <aside
      aria-label="Demo Role Switcher"
      className="sticky top-0 z-50 w-full backdrop-blur-md bg-slate-900/90 dark:bg-slate-950/90 border-b border-slate-700/60 text-slate-100 shadow-md transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Active Persona & Role Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-500/20 border border-brand-400/30 text-[10px] font-semibold tracking-wider text-brand-300 uppercase">
            <Layers className="w-3 h-3 text-brand-400 animate-pulse" />
            <span>1-Click Switcher</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white tracking-tight">
              {currentUser?.name || "Sophia Chen"}
            </span>

            {/* Active Role Badge */}
            <span
              className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                activeRole === "STUDENT"
                  ? "bg-amber-400/10 text-amber-300 border-amber-400/30"
                  : activeRole === "CO_ADMIN"
                  ? "bg-indigo-400/10 text-indigo-300 border-indigo-400/30"
                  : activeRole === "SUPER_ADMIN"
                  ? "bg-rose-400/10 text-rose-300 border-rose-400/30"
                  : "bg-blue-400/10 text-blue-300 border-blue-400/30"
              }`}
            >
              {activeRole === "CO_ADMIN"
                ? "Co-Admin (Creator)"
                : activeRole === "SUPER_ADMIN"
                ? "Super Admin"
                : activeRole === "STUDENT"
                ? "Student"
                : activeRole}
            </span>
          </div>

          {/* Student Pre-Funded Wallet Pill */}
          {isStudent && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 rounded-full text-xs font-medium"
              title="Simulated pre-funded wallet balance for test purchases"
            >
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Balance:</span>
              <span className="font-bold text-emerald-200">
                ${balance.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Right: 1-Click Role Switch Buttons & Theme Toggle */}
        <div className="flex items-center gap-2">
          {/* Marketplace Role Switch Buttons */}
          <div className="inline-flex items-center p-0.5 bg-slate-800/80 rounded-lg border border-slate-700/60">
            {MARKETPLACE_ROLES.map((r) => {
              const isActive = activeRoleId === r.id || (currentUser?.role === r.role && !currentUser?.id.startsWith("usr_alex"));
              const Icon = r.icon;

              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleRoleSwitch(r.id, r.defaultPath)}
                  disabled={isSwitching}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    isActive
                      ? r.activeClass
                      : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                  }`}
                  title={`Switch active persona to ${r.name} (${r.label})`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{r.label}</span>
                  {isActive && <Check className="w-3 h-3 text-emerald-400 ml-0.5" />}
                </button>
              );
            })}
          </div>

          {/* Corporate Roles Dropdown */}
          <div className="relative inline-block" ref={corporateRef}>
            <button
              type="button"
              onClick={() => setCorporateOpen(!corporateOpen)}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 rounded-md transition-colors"
              title="Corporate employee & compliance personas"
            >
              <Briefcase className="w-3 h-3 text-slate-400" />
              <span className="hidden sm:inline">Corporate</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {corporateOpen && (
              <div className="absolute right-0 mt-1 w-56 backdrop-blur-xl bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 border-b border-slate-800 text-[10px] uppercase font-semibold text-slate-400">
                  Corporate Personas
                </div>
                {CORPORATE_ROLES.map((c) => {
                  const isCur = activeRoleId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleRoleSwitch(c.id, "/courses")}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800/80 transition-colors ${
                        isCur ? "bg-slate-800 text-brand-300 font-semibold" : "text-slate-200"
                      }`}
                    >
                      <div>
                        <div className="text-white font-medium">{c.name}</div>
                        <div className="text-[10px] text-slate-400">{c.title}</div>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                        {c.role}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
