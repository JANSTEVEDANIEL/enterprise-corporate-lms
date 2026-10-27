"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Wallet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  X,
  Loader2,
  Sparkles,
  BookOpen,
} from "lucide-react";

export interface CheckoutModalProps {
  course: {
    id: string;
    title: string;
    slug: string;
    creator_name?: string;
    creator?: string;
    price_cents?: number;
    price_dollars?: number;
    price?: number;
    total_weeks?: number;
  };
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: any) => void;
  studentId?: string;
  defaultBalanceDollars?: number;
}

export function CheckoutModal({
  course,
  isOpen,
  onClose,
  onSuccess,
  studentId,
  defaultBalanceDollars = 500.0,
}: CheckoutModalProps) {
  const [walletBalance, setWalletBalance] = useState<number>(defaultBalanceDollars);
  const [isLoadingWallet, setIsLoadingWallet] = useState<boolean>(true);
  const [isPurchasing, setIsPurchasing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any | null>(null);

  const priceDollars =
    course.price_dollars !== undefined
      ? course.price_dollars
      : course.price_cents !== undefined
      ? course.price_cents / 100
      : course.price !== undefined
      ? course.price
      : 99.0;

  const remainingBalance = Math.max(0, walletBalance - priceDollars);
  const isInsufficient = walletBalance < priceDollars;

  // Fetch current user wallet balance when modal opens
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setSuccessData(null);
      return;
    }

    let isMounted = true;
    setIsLoadingWallet(true);
    setError(null);

    const queryUrl = studentId
      ? `/api/marketplace/checkout?student_id=${studentId}&course_id=${course.id}`
      : `/api/marketplace/checkout?course_id=${course.id}`;

    fetch(queryUrl)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && typeof data.wallet_balance_dollars === "number") {
          setWalletBalance(data.wallet_balance_dollars);
          if (data.is_enrolled) {
            setError("You are already enrolled in this course.");
          }
        } else {
          setWalletBalance(defaultBalanceDollars);
        }
      })
      .catch(() => {
        if (isMounted) setWalletBalance(defaultBalanceDollars);
      })
      .finally(() => {
        if (isMounted) setIsLoadingWallet(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, course.id, studentId, defaultBalanceDollars]);

  if (!isOpen) return null;

  async function handleImmediatePurchase() {
    if (isInsufficient || isPurchasing) return;
    setIsPurchasing(true);
    setError(null);

    try {
      const res = await fetch("/api/marketplace/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: course.id,
          student_id: studentId,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || data.error || "Failed to complete checkout.");
        return;
      }

      setSuccessData(data);
      if (typeof data.new_balance === "number") {
        setWalletBalance(data.new_balance);
      }
      if (onSuccess) {
        onSuccess(data);
      }
    } catch (err: any) {
      setError(err.message || "Network error during checkout.");
    } finally {
      setIsPurchasing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0F172A] border border-slate-700/80 rounded-3xl p-6 sm:p-8 text-white shadow-2xl overflow-hidden space-y-6">
        {/* Glow decoration */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center border border-brand-500/30">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Simulated Wallet Checkout
              </h2>
              <p className="text-xs text-slate-400">
                Pre-funded $500 test wallet • 10/90 ledger split
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success View */}
        {successData ? (
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-white">
                Enrollment & Purchase Confirmed!
              </h3>
              <p className="text-xs text-slate-300 max-w-sm mx-auto">
                You have officially enrolled in <span className="font-semibold text-white">{course.title}</span>.
                All weekly milestones and lessons are now unlocked in your learning portal.
              </p>
            </div>

            {/* Split Audit Breakdown */}
            <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 text-left space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Transaction Reference:</span>
                <span className="font-mono text-brand-300 font-semibold">{successData.transaction_id}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Enrollment Record:</span>
                <span className="font-mono text-slate-200">{successData.enrollment_id}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Creator Net Earning (90%):</span>
                <span className="text-indigo-300 font-medium">+${successData.split?.creator_payout_dollars?.toFixed(2) || (priceDollars * 0.9).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Platform Commission (10%):</span>
                <span className="text-emerald-300 font-medium">+${successData.split?.platform_fee_dollars?.toFixed(2) || (priceDollars * 0.1).toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-slate-700/60 flex justify-between font-bold text-white">
                <span>Updated Wallet Balance:</span>
                <span className="text-emerald-400">${Number(walletBalance).toFixed(2)}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <Link
                href="/dashboard"
                className="flex-1 py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs transition-all shadow-md shadow-brand-500/25 flex items-center justify-center gap-1.5"
              >
                <span>Go to Student Learning Hub</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Checkout Preparation View */
          <div className="space-y-5">
            {/* Course Summary Card */}
            <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-brand-400" />
                  <span>Selected Cohort</span>
                </span>
                <span className="font-semibold text-brand-300">
                  {course.total_weeks || 7} Weeks
                </span>
              </div>

              <div className="text-sm font-bold text-white leading-tight">
                {course.title}
              </div>

              <div className="text-xs text-slate-400">
                Instructor: <span className="text-slate-200">{course.creator_name || course.creator || "Dr. Aris Thorne"}</span>
              </div>
            </div>

            {/* Wallet Balance & Financial Ledger Calculation */}
            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Student Wallet Balance (Sophia Chen):</span>
                {isLoadingWallet ? (
                  <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                ) : (
                  <span className="font-bold text-emerald-400">${walletBalance.toFixed(2)}</span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Course Tuition:</span>
                <span className="font-bold text-rose-400">-${priceDollars.toFixed(2)}</span>
              </div>

              <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-200">Post-Purchase Balance:</span>
                <span className={isInsufficient ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                  ${remainingBalance.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Error / Insufficient Funds Notification */}
            {isInsufficient && (
              <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Insufficient Wallet Funds</div>
                  <div className="text-[11px] text-rose-300/90 mt-0.5">
                    Your current balance is ${walletBalance.toFixed(2)}, which is insufficient to purchase this course (${priceDollars.toFixed(2)}).
                  </div>
                </div>
              </div>
            )}

            {error && !isInsufficient && (
              <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs">{error}</div>
              </div>
            )}

            {/* Guarantee Badge */}
            <div className="flex items-center gap-2 text-[11px] text-slate-400 justify-center">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Simulated Instant Settlement • Verified SHA-256 Audit Log</span>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isPurchasing}
                className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleImmediatePurchase}
                disabled={isInsufficient || isPurchasing || isLoadingWallet}
                className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-lg shadow-brand-500/25 transition-all flex items-center gap-2"
              >
                {isPurchasing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Split...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Confirm & Buy Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
