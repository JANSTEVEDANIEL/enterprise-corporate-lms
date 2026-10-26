"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Sparkles,
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  Shield,
  Layers,
  CheckCircle2,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [activePersona, setActivePersona] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    try {
      // Direct email lookup mapping or fallback demo login
      let userId = "usr_sophia_chen";
      let dest = "/dashboard";

      if (email.includes("aris") || email.includes("creator")) {
        userId = "usr_aris_thorne";
        dest = "/studio";
      } else if (email.includes("david") || email.includes("admin")) {
        userId = "usr_david_kim";
        dest = "/admin";
      } else if (email.includes("alex")) {
        userId = "usr_alex_rivera";
        dest = "/courses";
      }

      document.cookie = `lms_user_id=${userId}; path=/; max-age=2592000; SameSite=Lax`;
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      router.push(dest);
      router.refresh();
    } catch {
      setErrorMessage("Authentication failed. Please verify credentials or use 1-click demo access.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = async (userId: string, targetPath: string, roleName: string) => {
    setIsLoading(true);
    setActivePersona(roleName);
    document.cookie = `lms_user_id=${userId}; path=/; max-age=2592000; SameSite=Lax`;

    try {
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      router.push(targetPath);
      router.refresh();
    } catch (err) {
      console.error("Demo login error", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-10 px-4 sm:px-6">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-lg shadow-brand-500/25">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Welcome to EdTech Core
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sign in to access courses, Creator Studio, or Platform Admin
          </p>
        </div>

        {/* 1-Click Instant Demo Login Card */}
        <div className="backdrop-blur-md bg-slate-900/60 border border-slate-700/50 rounded-2xl p-4 shadow-xl text-white">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-brand-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              1-Click Instant Demo Login
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {/* Student Login */}
            <button
              type="button"
              onClick={() => handleQuickDemoLogin("usr_sophia_chen", "/dashboard", "Sophia Chen")}
              disabled={isLoading}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 hover:border-amber-500/40 transition-all text-left group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white group-hover:text-amber-300 flex items-center gap-1.5">
                    <span>Sophia Chen</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-medium">
                      Student
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">Pre-funded $500 Wallet • Enrolled Courses</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-300 group-hover:translate-x-0.5 transition-all" />
            </button>

            {/* Co-Admin Creator Login */}
            <button
              type="button"
              onClick={() => handleQuickDemoLogin("usr_aris_thorne", "/studio", "Dr. Aris Thorne")}
              disabled={isLoading}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 hover:border-indigo-500/40 transition-all text-left group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white group-hover:text-indigo-300 flex items-center gap-1.5">
                    <span>Dr. Aris Thorne</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-400/20 text-indigo-300 font-medium">
                      Co-Admin
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">Creator Studio • 1-7+ Weeks • 90% Net Cut</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-300 group-hover:translate-x-0.5 transition-all" />
            </button>

            {/* Super Admin Login */}
            <button
              type="button"
              onClick={() => handleQuickDemoLogin("usr_david_kim", "/admin", "David Kim")}
              disabled={isLoading}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 hover:border-rose-500/40 transition-all text-left group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-300 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white group-hover:text-rose-300 flex items-center gap-1.5">
                    <span>David Kim</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-400/20 text-rose-300 font-medium">
                      Super Admin
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">10% Platform Fee • Content Privacy Shield</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-rose-300 group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>
        </div>

        {/* Standard Email Login Form */}
        <div className="backdrop-blur-md bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-xl">
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-700/50" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-slate-900 px-2 text-slate-400">
                  Or sign in with email
                </span>
              </div>
            </div>

            {errorMessage && (
              <div className="p-2.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                {errorMessage}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sophia.chen@edtech.marketplace"
                  className="w-full text-xs h-9 pl-9 pr-3 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full text-xs h-9 pl-9 pr-3 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-9 flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md shadow-brand-500/20 transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            >
              {isLoading ? (
                <span>Signing In...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Links */}
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <Link href="/marketplace" className="hover:text-brand-400 transition-colors">
              ← Browse Marketplace
            </Link>
            <Link href="/auth/signup" className="text-brand-500 hover:text-brand-400 font-medium">
              Create an account →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
