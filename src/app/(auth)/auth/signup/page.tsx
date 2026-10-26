"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Sparkles,
  Lock,
  Mail,
  User,
  ArrowRight,
  Shield,
  Layers,
  CheckCircle2,
} from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<"STUDENT" | "CO_ADMIN">("STUDENT");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    try {
      const targetUserId = selectedRole === "STUDENT" ? "usr_sophia_chen" : "usr_aris_thorne";
      const targetPath = selectedRole === "STUDENT" ? "/dashboard" : "/studio";

      document.cookie = `lms_user_id=${targetUserId}; path=/; max-age=2592000; SameSite=Lax`;
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId }),
      });

      router.push(targetPath);
      router.refresh();
    } catch {
      setErrorMessage("Registration failed. Please try again or use 1-click demo access.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickOnboard = async (userId: string, targetPath: string) => {
    setIsLoading(true);
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
      console.error("Quick onboarding error", err);
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
            Create Your Account
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Join the EdTech Course Marketplace as a Student or Creator
          </p>
        </div>

        {/* 1-Click Instant Demo Onboard Card */}
        <div className="backdrop-blur-md bg-slate-900/60 border border-slate-700/50 rounded-2xl p-4 shadow-xl text-white">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-brand-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Instant 1-Click Persona Onboarding
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Instant Student */}
            <button
              type="button"
              onClick={() => handleQuickOnboard("usr_sophia_chen", "/dashboard")}
              disabled={isLoading}
              className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 hover:border-amber-500/50 transition-all text-left flex flex-col justify-between group"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold mb-2">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white group-hover:text-amber-300">
                  Join as Student
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">$500 Test Wallet</div>
              </div>
            </button>

            {/* Instant Creator */}
            <button
              type="button"
              onClick={() => handleQuickOnboard("usr_aris_thorne", "/studio")}
              disabled={isLoading}
              className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 hover:border-indigo-500/50 transition-all text-left flex flex-col justify-between group"
            >
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold mb-2">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white group-hover:text-indigo-300">
                  Join as Creator
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">90% Net Earnings</div>
              </div>
            </button>
          </div>
        </div>

        {/* Standard Signup Form */}
        <div className="backdrop-blur-md bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-xl">
          <form onSubmit={handleSignupSubmit} className="space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-700/50" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-slate-900 px-2 text-slate-400">
                  Or register with email
                </span>
              </div>
            </div>

            {errorMessage && (
              <div className="p-2.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                {errorMessage}
              </div>
            )}

            {/* Role Radio Picker */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                I want to:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRole("STUDENT")}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                    selectedRole === "STUDENT"
                      ? "border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300 font-semibold"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Learn (Student)</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                    $500 wallet included
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedRole("CO_ADMIN")}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                    selectedRole === "CO_ADMIN"
                      ? "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-semibold"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Teach (Creator)</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                    Keep 90% of sales
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sophia Chen"
                  className="w-full text-xs h-9 pl-9 pr-3 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>
            </div>

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
                <span>Creating Account...</span>
              ) : (
                <>
                  <span>Complete Registration</span>
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
            <Link href="/auth/login" className="text-brand-500 hover:text-brand-400 font-medium">
              Already have an account? Sign in →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
