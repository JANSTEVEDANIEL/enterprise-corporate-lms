import React from "react";
import Link from "next/link";
import { Shield, Bell, Search, Database, CheckCircle2 } from "lucide-react";
import { PersonaSwitcher } from "./persona-switcher";
import { getCurrentUser } from "@/lib/auth";

export async function Header() {
  const currentUser = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6">
        {/* Left: Brand & Title */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-brand-700 to-brand-500 flex items-center justify-center text-white shadow-sm shadow-brand-500/20 group-hover:scale-105 transition-transform">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <span>Enterprise Core LMS</span>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium border border-slate-200">
                  v1.0
                </span>
              </div>
              <div className="text-[11px] text-slate-500 leading-none">
                Compliance, Onboarding & Upskilling
              </div>
            </div>
          </Link>

          {/* Quick Search Bar */}
          <div className="hidden md:flex items-center ml-8">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search courses, compliance tracks, policies..."
                className="w-80 h-9 pl-9 pr-4 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white transition-all text-slate-800 placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Right: DB Status + Notifications + Persona Switcher */}
        <div className="flex items-center gap-3">
          {/* SQLite WAL Live Badge */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[11px] font-medium">
            <Database className="w-3.5 h-3.5" />
            <span>SQLite WAL (node:sqlite)</span>
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          </div>

          {/* Notifications Placeholder */}
          <button
            type="button"
            className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Notifications & Due Reminders"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-600 rounded-full" />
          </button>

          {/* Persona Switcher Component */}
          <PersonaSwitcher initialUser={currentUser} />
        </div>
      </div>
    </header>
  );
}
