"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Wallet,
  PlayCircle,
  Award,
  CheckCircle2,
  Clock,
  ArrowRight,
  BookOpen,
  Calendar,
  Sparkles,
  ShieldCheck,
  ExternalLink,
  Layers,
  Receipt,
  RefreshCw,
} from "lucide-react";
import { CertificateModal, type CertificateRecord } from "@/components/player/certificate-modal";
import type { SessionUser } from "@/types";

interface EnrolledCourseItem {
  id: string;
  course_id: string;
  title: string;
  slug?: string;
  creator_name?: string;
  total_weeks: number;
  total_lessons: number;
  completed_lessons: number;
  progress_pct: number;
  current_lesson?: string;
  thumbnail_url?: string | null;
  certificate?: any;
  certificateCode?: string | null;
  updated_at?: string;
}

interface StudentDashboardClientProps {
  currentUser: SessionUser;
  courses: EnrolledCourseItem[];
  wallet: any;
  certificates: any[];
  transactions?: any[];
}

export function StudentDashboardClient({
  currentUser,
  courses,
  wallet,
  certificates,
  transactions = [],
}: StudentDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<"enrolled" | "certificates">("enrolled");
  const [selectedCert, setSelectedCert] = useState<CertificateRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactionList, setTransactionList] = useState<any[]>(transactions);
  const [isRefreshingTx, setIsRefreshingTx] = useState(false);

  const fetchTransactions = async () => {
    try {
      setIsRefreshingTx(true);
      const res = await fetch("/api/wallet");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.transactions)) {
        setTransactionList(data.transactions);
      }
    } catch {} finally {
      setIsRefreshingTx(false);
    }
  };

  useEffect(() => {
    if (Array.isArray(transactions) && transactions.length > 0) {
      setTransactionList(transactions);
    }
  }, [transactions]);

  const walletBalance = wallet ? wallet.balance_dollars : 500.0;
  const totalWeeksEnrolled = courses.reduce((acc, c) => acc + (c.total_weeks || 1), 0);
  const completedCoursesCount = courses.filter((c) => c.progress_pct === 100).length;

  const handleOpenCertificate = (cert: any) => {
    setSelectedCert({
      id: cert.id,
      certificate_code: cert.certificate_code,
      user_name: cert.user_name || currentUser.name,
      course_title: cert.course_title,
      issued_at: cert.issued_at || new Date().toISOString(),
      verification_hash: cert.verification_hash,
      score: cert.score,
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Profile & Wallet Card */}
      <section className="backdrop-blur-xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-700/60 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-amber-500/20">
            {currentUser?.name
              ? currentUser.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
              : "SC"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                {currentUser?.name || "Sophia Chen"}
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                Student Learner
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Self-paced weekly learning cohorts • 1-7+ Weeks Curriculum Player
            </p>
          </div>
        </div>

        {/* Pre-funded simulated wallet badge */}
        <div className="backdrop-blur-md bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex items-center gap-4 shadow-inner">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              Simulated Test Wallet
            </div>
            <div className="text-xl font-extrabold text-emerald-300">
              ${walletBalance.toFixed(2)} <span className="text-xs font-normal text-slate-400">USD</span>
            </div>
          </div>
          <Link
            href="/marketplace"
            className="ml-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all"
          >
            Buy Course
          </Link>
        </div>
      </section>

      {/* Interactive Student Wallet Transaction History Ledger */}
      <div className="backdrop-blur-md bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Transaction History Ledger
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {transactionList.length} Transactions
            </span>
          </div>
          <button
            type="button"
            onClick={fetchTransactions}
            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1.5 transition-colors font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingTx ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {transactionList.length === 0 ? (
          <div className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            No transactions recorded yet. Browse the course marketplace to purchase a course with your simulated wallet!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Course Name</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {transactionList.map((tx) => {
                  const amountDollars =
                    tx.amount_dollars ??
                    (tx.amount_cents ? tx.amount_cents / 100 : (tx.amount ? tx.amount / 100 : 0));
                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {tx.created_at
                          ? new Date(tx.created_at).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "Recent"}
                      </td>
                      <td className="py-2.5 font-medium text-slate-900 dark:text-white">
                        {tx.course_title || "Course Purchase"}
                      </td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          {tx.type || "PURCHASE"}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{tx.status || "COMPLETED"}</span>
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        -${amountDollars.toFixed(2)} USD
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="backdrop-blur-md bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Enrolled Courses</span>
            <BookOpen className="w-4 h-4 text-brand-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {courses.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {completedCoursesCount} completed • {courses.length - completedCoursesCount} in-progress
          </div>
        </div>

        <div className="backdrop-blur-md bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Curriculum Depth</span>
            <Layers className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {totalWeeksEnrolled} Weeks
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Sequential 1 to 7+ week curriculum tracks
          </div>
        </div>

        <div className="backdrop-blur-md bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Earned Certificates</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {certificates.length} Verified
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Cryptographic verification hash on ledger
          </div>
        </div>
      </div>

      {/* Tabs Header Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveTab("enrolled")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "enrolled"
                ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Enrolled Courses ({courses.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("certificates")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "certificates"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Earned Certificates ({certificates.length})</span>
          </button>
        </div>

        <Link
          href="/marketplace"
          className="text-xs text-brand-500 hover:text-brand-400 font-semibold flex items-center gap-1"
        >
          <span>Marketplace</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Tab 1: Enrolled Courses */}
      {activeTab === "enrolled" && (
        <div className="space-y-4">
          {courses.length === 0 ? (
            <div className="backdrop-blur-md bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-500/10 text-brand-500 flex items-center justify-center mx-auto">
                <BookOpen className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                No Enrolled Courses Yet
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Explore our catalog to find top-tier 1 to 7+ week curriculum courses. Your pre-funded simulated wallet ($500.00) is ready to use!
              </p>
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md transition-all"
              >
                <span>Browse Course Marketplace</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            courses.map((cohort) => (
              <div
                key={cohort.id || cohort.course_id}
                className="backdrop-blur-md bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {cohort.title}
                    </h3>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Instructor:{" "}
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {cohort.creator_name || "Dr. Aris Thorne"}
                      </span>{" "}
                      • {cohort.total_weeks} Weeks Total
                    </div>
                  </div>

                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                      cohort.progress_pct === 100
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        : "bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/30"
                    }`}
                  >
                    {cohort.progress_pct === 100
                      ? "100% Completed"
                      : `${cohort.progress_pct}% In Progress`}
                  </span>
                </div>

                {/* Live Weekly Progress Bars & Multi-Week Milestones */}
                {(() => {
                  const totalWeeks = Math.max(1, cohort.total_weeks || 1);
                  const completedWeeks =
                    cohort.progress_pct === 100
                      ? totalWeeks
                      : Math.min(totalWeeks, Math.floor((cohort.progress_pct / 100) * totalWeeks));

                  return (
                    <div className="space-y-2.5">
                      {/* Weekly Progress Milestone Header */}
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Live Weekly Progress: {completedWeeks} of {totalWeeks} Weeks Completed
                        </span>
                        <span>
                          {cohort.completed_lessons || 0}/{cohort.total_lessons || totalWeeks} Lessons ({cohort.progress_pct}%)
                        </span>
                      </div>

                      {/* Multi-Week Milestone Segmented Progress Bars */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
                        {Array.from({ length: totalWeeks }).map((_, wIdx) => {
                          const weekNum = wIdx + 1;
                          const isWeekDone = weekNum <= completedWeeks;
                          const isWeekActive = weekNum === completedWeeks + 1 && cohort.progress_pct < 100;

                          return (
                            <div
                              key={weekNum}
                              className={`rounded-lg p-2 border text-[11px] flex flex-col justify-between transition-all ${
                                isWeekDone
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                  : isWeekActive
                                  ? "bg-brand-500/15 border-brand-500/40 text-brand-300 ring-1 ring-brand-500/30"
                                  : "bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold">W{weekNum}</span>
                                {isWeekDone ? (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                ) : isWeekActive ? (
                                  <Clock className="w-3 h-3 text-brand-400 animate-pulse" />
                                ) : (
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                                )}
                              </div>
                              <span className="text-[9px] font-medium mt-1 truncate">
                                {isWeekDone ? "Completed" : isWeekActive ? "Active" : "Upcoming"}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Continuous Progress Bar */}
                      <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            cohort.progress_pct === 100 ? "bg-emerald-500" : "bg-brand-600"
                          }`}
                          style={{ width: `${cohort.progress_pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="text-xs text-slate-400">
                    Self-Paced Track • All Weeks Unlocked
                  </div>

                  <div className="flex items-center gap-2">
                    {cohort.certificate && (
                      <button
                        type="button"
                        onClick={() => handleOpenCertificate(cohort.certificate)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>View Certificate</span>
                      </button>
                    )}

                    <Link
                      href={`/dashboard/courses/${cohort.course_id || cohort.id}`}
                      className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      <span>
                        {cohort.progress_pct === 100 ? "Review Material" : "Resume Learning"}
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Earned Certificates */}
      {activeTab === "certificates" && (
        <div className="space-y-4">
          {certificates.length === 0 ? (
            <div className="backdrop-blur-md bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                <Award className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                No Certificates Earned Yet
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Complete all 1 to 7+ weekly modules of any enrolled course (100% curriculum progress) to automatically unlock and mint an authentic, cryptographically verified Certificate of Completion.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {certificates.map((cert) => (
                <div
                  key={cert.id || cert.certificate_code}
                  className="backdrop-blur-md bg-white dark:bg-slate-900/70 border border-amber-500/30 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider flex items-center gap-1">
                        <Award className="w-3.5 h-3.5" />
                        <span>Verified Credential</span>
                      </span>
                      <span className="font-mono text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                        {cert.certificate_code}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">
                        {cert.course_title}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Awarded to: <strong className="text-slate-800 dark:text-slate-200">{cert.user_name || currentUser.name}</strong>
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 font-mono text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5 truncate">
                      <div className="flex items-center justify-between text-[9px] uppercase font-sans font-semibold text-slate-400">
                        <span>Ledger Hash:</span>
                        <span className="text-emerald-500 flex items-center gap-0.5">
                          <ShieldCheck className="w-3 h-3" /> Signed
                        </span>
                      </div>
                      <div className="truncate">{cert.verification_hash}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] text-slate-400">
                      Issued: {new Date(cert.issued_at).toLocaleDateString()}
                    </span>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/certificates/${cert.certificate_code}`}
                        target="_blank"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Open Verification Link"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleOpenCertificate(cert)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-sm transition-all"
                      >
                        View Certificate
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Certificate Modal View */}
      <CertificateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        certificate={selectedCert}
      />
    </div>
  );
}
