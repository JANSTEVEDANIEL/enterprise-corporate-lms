"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  GraduationCap,
  Sparkles,
  ShieldAlert,
  Shield,
  Menu,
  X,
  LogIn,
  UserPlus,
} from "lucide-react";
import type { SessionUser } from "@/types";

interface NavbarProps {
  currentUser?: SessionUser;
}

export function Navbar({ currentUser }: NavbarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    {
      href: "/marketplace",
      label: "Marketplace",
      icon: Compass,
      badge: "Public",
      badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    },
    {
      href: "/dashboard",
      label: "Student Hub",
      icon: GraduationCap,
      badge: "Student",
      badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    },
    {
      href: "/studio",
      label: "Creator Studio",
      icon: Sparkles,
      badge: "Co-Admin",
      badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    },
    {
      href: "/admin",
      label: "Platform Admin",
      icon: ShieldAlert,
      badge: "Super Admin",
      badgeColor: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    },
  ];

  return (
    <nav className="w-full backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 sticky top-10 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Left: Brand Identity */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform">
                <Shield className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                    EdTech Core
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
                    MARKETPLACE
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                  Creators • Students • Super Admin
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
                const Icon = link.icon;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? "bg-slate-100 dark:bg-slate-800 text-brand-600 dark:text-brand-300 font-semibold shadow-sm"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{link.label}</span>
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-medium border hidden lg:inline ${link.badgeColor}`}
                    >
                      {link.badge}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right: Auth View Quick-Access Links & User Snippet */}
          <div className="flex items-center gap-2">
            <Link
              href="/auth/login"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-md transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign In</span>
            </Link>

            <Link
              href="/auth/signup"
              className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-brand-600 hover:bg-brand-500 text-white rounded-lg shadow-sm shadow-brand-500/20 transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Join Free</span>
            </Link>

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-4 pt-2 pb-4 space-y-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium ${
                  isActive
                    ? "bg-slate-100 dark:bg-slate-800 text-brand-600 dark:text-brand-300"
                    : "text-slate-700 dark:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium border ${link.badgeColor}`}>
                  {link.badge}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
