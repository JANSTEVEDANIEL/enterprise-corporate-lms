"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Lock,
  DollarSign,
  TrendingUp,
  Users,
  EyeOff,
  Receipt,
  CreditCard,
  CheckCircle2,
  Clock,
  Send,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { maskCourseTitle } from "@/lib/privacy";

interface AdminStats {
  gmv_cents: number;
  gmv_dollars: number;
  platform_fee_cents: number;
  platform_fee_dollars: number;
  completed_transactions: number;
  payouts_processed_cents: number;
  payouts_processed_dollars: number;
  payouts_processed_count: number;
  total_users: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats>({
    gmv_cents: 0,
    gmv_dollars: 0,
    platform_fee_cents: 0,
    platform_fee_dollars: 0,
    completed_transactions: 0,
    payouts_processed_cents: 0,
    payouts_processed_dollars: 0,
    payouts_processed_count: 0,
    total_users: 0,
  });
  const [payouts, setPayouts] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [payoutTab, setPayoutTab] = useState<"pending" | "all">("pending");
  const [processingPayoutId, setProcessingPayoutId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchAdminData = async () => {
    try {
      setLoading(true);

      // 1. Fetch platform economics stats
      const statsRes = await fetch("/api/admin/stats");
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.success && statsData.stats) {
          setStats(statsData.stats);
        }
      }

      // 2. Fetch all creator payouts
      const payoutsRes = await fetch("/api/studio/payouts");
      if (payoutsRes.ok) {
        const payoutsData = await payoutsRes.json();
        if (payoutsData.success && Array.isArray(payoutsData.payouts)) {
          setPayouts(payoutsData.payouts);
        }
      }

      // 3. Fetch courses for privacy-shielded catalog
      const coursesRes = await fetch("/api/courses");
      if (coursesRes.ok) {
        const coursesData = await coursesRes.json();
        if (coursesData.success && Array.isArray(coursesData.courses)) {
          setCourses(coursesData.courses);
        }
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleApprovePayout = async (payoutId: string) => {
    try {
      setProcessingPayoutId(payoutId);
      const res = await fetch("/api/studio/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payout_id: payoutId, status: "PROCESSED" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPayouts((prev) =>
          prev.map((p) =>
            p.id === payoutId
              ? {
                  ...p,
                  status: "PROCESSED",
                  processed_at: data.payout?.processed_at || new Date().toISOString(),
                }
              : p
          )
        );

        // Optimistically update stats
        const approvedPayout = payouts.find((p) => p.id === payoutId);
        if (approvedPayout) {
          const amtDollars =
            approvedPayout.amount_dollars ??
            (approvedPayout.amount_cents ? approvedPayout.amount_cents / 100 : 0);
          setStats((prev) => ({
            ...prev,
            payouts_processed_dollars: prev.payouts_processed_dollars + amtDollars,
            payouts_processed_count: prev.payouts_processed_count + 1,
          }));
        }

        showNotification("Creator payout successfully approved and marked PROCESSED!");
      } else {
        alert(data.error || "Failed to process payout");
      }
    } catch (err: any) {
      alert(err.message || "Failed to process payout");
    } finally {
      setProcessingPayoutId(null);
    }
  };

  const pendingPayouts = payouts.filter((p) => p.status === "PENDING");
  const displayedPayouts = payoutTab === "pending" ? pendingPayouts : payouts;

  return (
    <div className="space-y-8 pb-12">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-950/90 px-5 py-3 text-sm text-emerald-300 shadow-2xl backdrop-blur-xl animate-fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Super Admin Operator Header */}
      <section className="backdrop-blur-xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-rose-950/80 border border-slate-700/60 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 to-red-500 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-rose-600/20">
            DK
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                David Kim
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-rose-400/20 text-rose-300 border border-rose-400/30">
                Super Admin
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Platform Provider • 10% Fee Commission Ledger • Creator IP Content Privacy Shield
            </p>
          </div>
        </div>

        {/* Creator Content Privacy Shield Status */}
        <div className="backdrop-blur-md bg-slate-800/80 border border-rose-500/40 rounded-2xl p-4 flex items-center gap-3 shadow-inner">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              Creator Privacy Shield
            </div>
            <div className="text-xs font-bold text-rose-300 flex items-center gap-1.5 mt-0.5">
              <span>ACTIVE (403 Gated)</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* High-Level Platform Economics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Marketplace GMV */}
        <div className="backdrop-blur-md bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Total Marketplace GMV</span>
            <TrendingUp className="w-4 h-4 text-brand-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            ${stats.gmv_dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500">Gross transaction volume processed</div>
        </div>

        {/* 2. Retained 10% Platform Commission */}
        <div className="backdrop-blur-md bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Platform Fee Earnings (10%)</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
            +${stats.platform_fee_dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500">Retained 10% platform commission cut</div>
        </div>

        {/* 3. Total Completed Transactions Count */}
        <div className="backdrop-blur-md bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Completed Transactions</span>
            <Receipt className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {stats.completed_transactions}
          </div>
          <div className="text-[11px] text-slate-500">Successful student purchases</div>
        </div>

        {/* 4. Total Creator Payouts Processed */}
        <div className="backdrop-blur-md bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Creator Payouts Processed</span>
            <CreditCard className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            ${stats.payouts_processed_dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500">{stats.payouts_processed_count} disbursements processed</div>
        </div>
      </div>

      {/* Feature 16: Pending Creator Payouts Console */}
      <section className="backdrop-blur-md bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <CreditCard className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Pending Creator Payouts Console
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                {pendingPayouts.length} Pending
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Super Admin disbursement management center: review creator withdrawal requests and approve/process instant electronic transfers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs">
              <button
                type="button"
                onClick={() => setPayoutTab("pending")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  payoutTab === "pending"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Pending ({pendingPayouts.length})
              </button>
              <button
                type="button"
                onClick={() => setPayoutTab("all")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  payoutTab === "all"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                All Records ({payouts.length})
              </button>
            </div>

            <button
              type="button"
              onClick={fetchAdminData}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
              title="Refresh console"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Payouts Table */}
        {displayedPayouts.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {payoutTab === "pending"
                ? "All creator payouts have been processed"
                : "No payout requests recorded"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Zero pending disbursements awaiting platform approval.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                  <th className="pb-3">Payout ID</th>
                  <th className="pb-3">Creator / Instructor</th>
                  <th className="pb-3">Requested Date</th>
                  <th className="pb-3">Notes / Channel</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Amount</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {displayedPayouts.map((po) => {
                  const isPending = po.status === "PENDING";
                  const isProcessed = po.status === "PROCESSED";
                  const amountDollars =
                    po.amount_dollars ??
                    (po.amount_cents ? po.amount_cents / 100 : (po.amount ? po.amount / 100 : 0));

                  return (
                    <tr
                      key={po.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3.5 font-mono text-slate-500 dark:text-slate-400">
                        {po.id}
                      </td>
                      <td className="py-3.5">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {po.creator_name || po.creator_id || "Dr. Aris Thorne"}
                        </div>
                        {po.creator_email && (
                          <div className="text-[10px] text-slate-400">{po.creator_email}</div>
                        )}
                      </td>
                      <td className="py-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {po.requested_at
                          ? new Date(po.requested_at).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "Recent"}
                      </td>
                      <td className="py-3.5 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {po.notes || "Creator Studio Withdrawal Request"}
                      </td>
                      <td className="py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-flex items-center gap-1 ${
                            isProcessed
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                              : isPending
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {isProcessed && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                          {isPending && <Clock className="w-3 h-3 text-amber-500 animate-pulse" />}
                          <span>{po.status}</span>
                        </span>
                      </td>
                      <td className="py-3.5 text-right font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                        ${amountDollars.toFixed(2)} USD
                      </td>
                      <td className="py-3.5 text-right">
                        {isPending ? (
                          <button
                            type="button"
                            disabled={processingPayoutId === po.id}
                            onClick={() => handleApprovePayout(po.id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-sm disabled:opacity-50 inline-flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" />
                            <span>{processingPayoutId === po.id ? "Processing..." : "Approve & Disburse"}</span>
                          </button>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-400">
                            Processed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Creator Content Privacy Shield: Privacy-Shielded Marketplace Catalog */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Privacy-Shielded Marketplace Catalog
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span>Creator IP Protected</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              In strict accordance with the Creator Content Privacy Shield, titles are masked, covers blurred, and raw video streaming URLs/lesson files are blocked by HTTP 403 API gates.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/users"
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
            >
              User Management
            </Link>
            <Link
              href="/admin/courses"
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
            >
              Course Authoring
            </Link>
          </div>
        </div>

        {/* Privacy Shielded Courses List */}
        <div className="space-y-3">
          {courses.map((c) => {
            const maskedTitle = maskCourseTitle(c.title);
            const priceCents = c.price_cents ?? (c.price ? Math.round(c.price * 100) : 0);
            const priceDollars = Number((priceCents / 100).toFixed(2));
            const publishedDate = c.created_at
              ? new Date(c.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : "Active";

            return (
              <div
                key={c.id}
                className="backdrop-blur-md bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Blurred Cover Thumbnail with Lock Badge + Masked Title */}
                <div className="flex items-center gap-4 min-w-0">
                  <div className="relative w-20 h-16 rounded-xl bg-slate-950 border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                    {c.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.thumbnail_url}
                        alt="Content Protected Thumbnail"
                        className="w-full h-full object-cover filter blur-md opacity-75 scale-110"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-tr from-rose-950 via-slate-900 to-indigo-950 filter blur-md opacity-75" />
                    )}

                    {/* Central Content Encrypted Lock Badge */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-slate-950/40 p-1 text-center">
                      <Lock className="w-4 h-4 text-rose-400" />
                      <span className="text-[7px] font-bold text-rose-200 uppercase tracking-tighter leading-tight mt-0.5">
                        Encrypted
                      </span>
                    </div>
                  </div>

                  {/* Masked Title & High-Level Metadata */}
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-mono truncate">
                        {maskedTitle}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 whitespace-nowrap">
                        IP PROTECTED
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>
                        Creator: <strong className="text-slate-700 dark:text-slate-300">{c.creator_name || "Dr. Aris Thorne"}</strong>
                      </span>
                      <span>•</span>
                      <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300">
                        {c.category}
                      </span>
                      <span>•</span>
                      <span>
                        Tuition: <strong className="text-slate-700 dark:text-slate-300">${priceDollars.toFixed(2)}</strong>
                      </span>
                      <span>•</span>
                      <span>Published: {publishedDate}</span>
                    </div>
                  </div>
                </div>

                {/* Right: High-Level Sales Count & Blocked Content Gate Pill */}
                <div className="flex items-center justify-between md:justify-end gap-5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                  <div className="text-left md:text-right">
                    <div className="text-[10px] text-slate-400 uppercase font-medium">Sales Count</div>
                    <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {c.sales_count ?? 0} units
                    </div>
                  </div>

                  <div
                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 text-xs font-medium border border-slate-200 dark:border-slate-700/80 flex items-center gap-1.5 cursor-not-allowed select-none"
                    title="Super Admin is barred from streaming video content or downloading raw files (HTTP 403 Gate)"
                  >
                    <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                    <span>Raw Content Gated</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
