import React from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  DollarSign,
  TrendingUp,
  BookOpen,
  Users,
  EyeOff,
  Layers,
  ArrowRight,
  Receipt,
  CreditCard,
} from "lucide-react";
import { getDb, initDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { maskCourseTitle } from "@/lib/privacy";

export default async function AdminDashboardPage() {
  initDb();
  const db = getDb();

  let currentUser = null;
  try {
    currentUser = await getCurrentUser();
  } catch {
    // demo fallback
  }

  // 1. Query real financial ledger metrics from transactions
  const txStats = db
    .prepare(`
      SELECT 
        COALESCE(SUM(amount_cents), 0) as total_amount_cents,
        COALESCE(SUM(platform_fee_cents), 0) as total_platform_cents,
        COALESCE(SUM(creator_payout_cents), 0) as total_creator_cents,
        COUNT(*) as total_tx_count
      FROM transactions 
      WHERE status = 'COMPLETED'
    `)
    .get() as any;

  // 2. Query processed creator payouts
  const payoutStats = db
    .prepare(`
      SELECT 
        COALESCE(SUM(amount_cents), 0) as total_processed_cents,
        COUNT(*) as total_processed_count
      FROM payouts 
      WHERE status = 'PROCESSED'
    `)
    .get() as any;

  // 3. Platform user count
  const userCount =
    (db.prepare("SELECT COUNT(*) as count FROM users").get() as any)?.count ?? 5;

  const totalGmvDollars = (txStats?.total_amount_cents ?? 0) / 100;
  const platformFeeCommissionDollars = (txStats?.total_platform_cents ?? 0) / 100;
  const totalCompletedTransactions = txStats?.total_tx_count ?? 0;
  const totalCreatorPayoutsProcessedDollars =
    (payoutStats?.total_processed_cents ?? 0) / 100;
  const totalCreatorPayoutsProcessedCount =
    payoutStats?.total_processed_count ?? 0;

  // 4. Query published courses for privacy-shielded catalog
  const rawCourses = db
    .prepare(`
      SELECT c.id, c.title, c.category, c.price_cents, c.thumbnail_url, c.created_at,
             COALESCE(u.name, 'Dr. Aris Thorne') as creator_name,
             (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) as sales_count
      FROM courses c
      LEFT JOIN users u ON c.creator_id = u.id
      WHERE c.is_published = 1
      ORDER BY c.created_at DESC
    `)
    .all() as any[];

  return (
    <div className="space-y-8 pb-12">
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
            ${totalGmvDollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500">Gross transaction value processed</div>
        </div>

        {/* 2. Accumulated 10% Platform Commission */}
        <div className="backdrop-blur-md bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Platform Fee Earnings (10%)</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
            +${platformFeeCommissionDollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            {totalCompletedTransactions}
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
            ${totalCreatorPayoutsProcessedDollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500">{totalCreatorPayoutsProcessedCount} disbursements processed</div>
        </div>
      </div>

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
          {rawCourses.map((c) => {
            const maskedTitle = maskCourseTitle(c.title);
            const priceDollars = Number((c.price_cents / 100).toFixed(2));
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
                  {/* Blurred cover preview with central lock badge */}
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
                      <span>Creator: <strong className="text-slate-700 dark:text-slate-300">{c.creator_name}</strong></span>
                      <span>•</span>
                      <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300">
                        {c.category}
                      </span>
                      <span>•</span>
                      <span>Tuition: <strong className="text-slate-700 dark:text-slate-300">${priceDollars.toFixed(2)}</strong></span>
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
                      {c.sales_count} units
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
