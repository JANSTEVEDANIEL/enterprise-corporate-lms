"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  Layers,
  DollarSign,
  Users,
  Plus,
  ArrowUpRight,
  Globe,
  Lock,
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  X,
  Send,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import type { MarketplaceCourse } from "@/types/marketplace";

export default function CreatorStudioPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>({
    total_gross_dollars: 0,
    total_net_dollars: 0,
    total_courses: 0,
    total_enrolled_students: 0,
    wallet_balance_dollars: 0,
    wallet_balance_cents: 0,
  });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Payout Modal state
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [payoutHistory, setPayoutHistory] = useState<any[]>([]);
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false);
  const [payoutFeedback, setPayoutFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchStudioData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch("/api/studio/courses");
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load studio data");
      }
      setCourses(data.courses || []);
      setAnalytics(data.analytics || {});
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to fetch studio courses");
    } finally {
      setLoading(false);
    }
  };

  const fetchPayoutHistory = async () => {
    try {
      const res = await fetch("/api/studio/payouts");
      const data = await res.json();
      if (res.ok && data.success) {
        setPayoutHistory(data.payouts || []);
      }
    } catch {}
  };

  useEffect(() => {
    fetchStudioData();
    fetchPayoutHistory();
  }, []);

  const showNotification = (text: string) => {
    setSuccessMsg(text);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // Instant Publish Toggle
  const handleTogglePublish = async (courseId: string, currentState: boolean) => {
    const nextState = !currentState;
    try {
      // Optimistic update
      setCourses((prev) =>
        prev.map((c) =>
          c.id === courseId ? { ...c, is_published: nextState ? 1 : 0 } : c
        )
      );

      const res = await fetch(`/api/studio/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: nextState }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        // Rollback
        setCourses((prev) =>
          prev.map((c) =>
            c.id === courseId ? { ...c, is_published: currentState ? 1 : 0 } : c
          )
        );
        throw new Error(data.error || "Failed to update publish state");
      }

      showNotification(
        nextState
          ? "Course instantly published to the marketplace!"
          : "Course reverted to draft."
      );
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to toggle publishing");
    }
  };

  // Request Payout Submit
  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingPayout(true);
    setPayoutFeedback(null);

    try {
      const amountVal = parseFloat(payoutAmount);
      if (isNaN(amountVal) || amountVal <= 0) {
        throw new Error("Withdrawal amount must be greater than $0.00");
      }

      const res = await fetch("/api/studio/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountVal,
          notes: payoutNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Payout request failed");
      }

      setPayoutFeedback({
        type: "success",
        text: `Withdrawal request for $${amountVal.toFixed(2)} submitted successfully! Status: PENDING`,
      });
      setPayoutAmount("");
      setPayoutNotes("");
      fetchStudioData();
      fetchPayoutHistory();
    } catch (err: any) {
      setPayoutFeedback({
        type: "error",
        text: err.message || "Failed to process withdrawal",
      });
    } finally {
      setIsSubmittingPayout(false);
    }
  };

  const setPercentPayout = (percent: number) => {
    const balance = analytics.wallet_balance_dollars || 0;
    if (balance <= 0) return;
    const computed = ((balance * percent) / 100).toFixed(2);
    setPayoutAmount(computed);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                Co-Admin Role
              </span>
              <span className="text-xs text-slate-400">Content Privacy Shield Protected</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              Creator Studio & Curriculum Hub
            </h1>
            <p className="text-sm text-slate-400">
              Manage multi-week courses, upload video modules & resources, configure quizzes, and track 90% creator earnings.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setIsPayoutModalOpen(true);
                fetchPayoutHistory();
              }}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-xs font-bold text-slate-200 shadow-md hover:border-emerald-500 hover:text-emerald-400 transition-all"
            >
              <Wallet className="h-4 w-4 text-emerald-400" />
              <span>Request Payout / Withdraw</span>
            </button>

            <Link
              href="/studio/courses/new"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-950/40 hover:from-emerald-500 hover:to-teal-500 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Create New Course</span>
            </Link>
          </div>
        </div>

        {/* Status Alerts */}
        {successMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/70 p-4 text-sm text-emerald-300 backdrop-blur-md">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-950/70 p-4 text-sm text-rose-300 backdrop-blur-md">
            <AlertCircle className="h-5 w-5 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Creator Analytics Metrics Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Card 1: Total Gross Sales */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Total Gross Sales</span>
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-slate-100">
              ${(analytics.total_gross_dollars || 0).toFixed(2)}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Total course volume</p>
          </div>

          {/* Card 2: 90% Net Creator Revenue */}
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
              <span>90% Net Revenue</span>
              <Sparkles className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-300">
              ${(analytics.total_net_dollars || 0).toFixed(2)}
            </p>
            <p className="text-[11px] text-emerald-500/80 mt-0.5">Zero penny leakage split</p>
          </div>

          {/* Card 3: Total Enrolled Students */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Total Enrolled</span>
              <Users className="h-4 w-4 text-indigo-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-slate-100">
              {analytics.total_enrolled_students || 0}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Unique paying students</p>
          </div>

          {/* Card 4: Total Courses */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Total Courses</span>
              <Layers className="h-4 w-4 text-teal-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-slate-100">
              {analytics.total_courses || courses.length}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {courses.filter((c) => c.is_published).length} Published •{" "}
              {courses.filter((c) => !c.is_published).length} Draft
            </p>
          </div>

          {/* Card 5: Available Wallet Balance */}
          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-5 shadow-xl backdrop-blur-md sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-400">
              <span>Available Wallet</span>
              <Wallet className="h-4 w-4 text-indigo-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-indigo-200">
              ${(analytics.wallet_balance_dollars || 0).toFixed(2)}
            </p>
            <button
              type="button"
              onClick={() => setIsPayoutModalOpen(true)}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-0.5 font-semibold"
            >
              Withdraw Funds <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Course Catalog List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Your Courses & Curriculums</h2>
              <p className="text-xs text-slate-400">
                Manage 1 to 7+ week structures, lessons, instant publishing, and sales.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchStudioData}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              title="Refresh Catalog"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40">
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
                <span>Loading creator courses...</span>
              </div>
            </div>
          ) : courses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-12 text-center space-y-3">
              <Layers className="mx-auto h-10 w-10 text-slate-500" />
              <h3 className="text-base font-bold text-slate-200">No courses created yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Begin by creating your first course and structuring sequential 1 to 7+ weekly milestones.
              </p>
              <Link
                href="/studio/courses/new"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500"
              >
                <Plus className="h-4 w-4" />
                Create First Course
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5">
              {courses.map((course) => {
                const isPub = Boolean(course.is_published);
                const sales = course.sales_count ?? 0;
                const gross = (course.gross_revenue_cents ?? 0) / 100;
                const net = (course.creator_earnings_cents ?? 0) / 100;
                const weeks = course.total_weeks ?? 1;

                return (
                  <div
                    key={course.id}
                    className="overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5 shadow-xl backdrop-blur-md transition-all hover:border-slate-600"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      {/* Left: Course Info */}
                      <div className="flex items-start gap-4">
                        {course.thumbnail_url ? (
                          <img
                            src={course.thumbnail_url}
                            alt={course.title}
                            className="h-20 w-28 rounded-xl object-cover border border-slate-700"
                          />
                        ) : (
                          <div className="flex h-20 w-28 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-500">
                            <Layers className="h-8 w-8" />
                          </div>
                        )}

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-300">
                              {course.category}
                            </span>
                            <span className="rounded-md bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[11px] font-bold text-indigo-400">
                              {weeks} {weeks === 1 ? "Week" : "Weeks"}
                            </span>
                            {isPub ? (
                              <span className="flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
                                <Globe className="h-3 w-3" /> Live Published
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 rounded-md bg-slate-800 border border-slate-700 px-2 py-0.5 text-[11px] font-bold text-slate-400">
                                <Lock className="h-3 w-3" /> Draft Mode
                              </span>
                            )}
                          </div>

                          <h3 className="text-lg font-bold text-white hover:text-emerald-400 transition-colors">
                            <Link href={`/studio/courses/${course.id}/edit`}>
                              {course.title}
                            </Link>
                          </h3>

                          <p className="line-clamp-2 text-xs text-slate-400 max-w-2xl">
                            {course.description}
                          </p>
                        </div>
                      </div>

                      {/* Right: Revenue Stats & Actions */}
                      <div className="flex flex-wrap items-center gap-4 lg:flex-nowrap">
                        <div className="flex items-center gap-5 border-l border-slate-800 pl-4 pr-2">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-500">Price</span>
                            <p className="text-base font-black text-slate-200">
                              ${(course.price_dollars ?? course.price_cents / 100).toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-500">Sales</span>
                            <p className="text-base font-black text-indigo-300">
                              {sales} {sales === 1 ? "student" : "students"}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-500">Net Earned</span>
                            <p className="text-base font-black text-emerald-400">
                              ${net.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {/* Instant Publish Toggle Switch */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleTogglePublish(course.id, isPub)}
                            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all border ${
                              isPub
                                ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-950/50"
                                : "border-slate-700 bg-slate-800 text-slate-300 hover:border-emerald-500 hover:text-emerald-400"
                            }`}
                            title="Toggle instant publishing to marketplace"
                          >
                            {isPub ? (
                              <>
                                <Globe className="h-3.5 w-3.5 text-emerald-400" />
                                <span>Published</span>
                              </>
                            ) : (
                              <>
                                <Lock className="h-3.5 w-3.5 text-slate-400" />
                                <span>Publish</span>
                              </>
                            )}
                          </button>

                          {/* Edit Button */}
                          <Link
                            href={`/studio/courses/${course.id}/edit`}
                            className="flex items-center gap-1.5 rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
                          >
                            <span>Edit Curriculum</span>
                            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Payout / Withdrawal Modal */}
        {isPayoutModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-emerald-400" />
                  <h3 className="text-lg font-bold text-white">
                    Request Payout / Withdraw Earnings
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPayoutModalOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {payoutFeedback && (
                <div
                  className={`flex items-center gap-2 rounded-xl border p-3 text-xs ${
                    payoutFeedback.type === "success"
                      ? "border-emerald-500/40 bg-emerald-950/60 text-emerald-300"
                      : "border-rose-500/40 bg-rose-950/60 text-rose-300"
                  }`}
                >
                  {payoutFeedback.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <span>{payoutFeedback.text}</span>
                </div>
              )}

              {/* Wallet Summary */}
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-indigo-300">Available Wallet Balance</span>
                  <p className="text-2xl font-black text-indigo-100">
                    ${(analytics.wallet_balance_dollars || 0).toFixed(2)}
                  </p>
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  <p>90% Net Creator Share</p>
                  <p className="text-emerald-400 font-semibold">Immediate Processing</p>
                </div>
              </div>

              {/* Payout Form */}
              <form onSubmit={handleRequestPayout} className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-slate-200">Withdrawal Amount (USD)</label>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPercentPayout(25)}
                        className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700"
                      >
                        25%
                      </button>
                      <button
                        type="button"
                        onClick={() => setPercentPayout(50)}
                        className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700"
                      >
                        50%
                      </button>
                      <button
                        type="button"
                        onClick={() => setPercentPayout(100)}
                        className="rounded bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold"
                      >
                        100%
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2 text-sm text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      max={analytics.wallet_balance_dollars || 10000}
                      required
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 pl-8 pr-3.5 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-200">
                    Withdrawal Notes / Payment Method
                  </label>
                  <input
                    type="text"
                    value={payoutNotes}
                    onChange={(e) => setPayoutNotes(e.target.value)}
                    placeholder="e.g. ACH Direct Deposit / Creator Payout"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={
                    isSubmittingPayout ||
                    !payoutAmount ||
                    parseFloat(payoutAmount) <= 0 ||
                    parseFloat(payoutAmount) > (analytics.wallet_balance_dollars || 0)
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-xs font-bold text-white shadow-lg hover:from-emerald-500 hover:to-teal-500 transition-all disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                  <span>{isSubmittingPayout ? "Submitting..." : "Submit Payout Request"}</span>
                </button>
              </form>

              {/* Payout History List */}
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Withdrawal History & Status
                </span>
                {payoutHistory.length === 0 ? (
                  <p className="text-xs text-slate-500">No previous payout requests.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                    {payoutHistory.map((po) => {
                      const isProcessed = po.status === "PROCESSED";
                      const isPending = po.status === "PENDING";

                      return (
                        <div
                          key={po.id}
                          className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/40 p-2.5 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-200">
                                ${(po.amount_dollars ?? (po.amount_cents ?? po.amount) / 100).toFixed(2)}
                              </span>
                              <span
                                className={`rounded px-1.5 py-0.2 text-[10px] font-bold border ${
                                  isProcessed
                                    ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-400"
                                    : isPending
                                    ? "border-amber-500/40 bg-amber-950/40 text-amber-400"
                                    : "border-rose-500/40 bg-rose-950/40 text-rose-400"
                                }`}
                              >
                                {po.status}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Requested {new Date(po.requested_at).toLocaleDateString()}
                              {po.notes ? ` • ${po.notes}` : ""}
                            </p>
                          </div>
                          {isProcessed && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          )}
                          {isPending && (
                            <Clock className="h-4 w-4 text-amber-400 animate-pulse" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
