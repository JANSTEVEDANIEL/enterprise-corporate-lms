"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import type { SessionUser } from "@/types";

interface AppLayoutShellProps {
  children: React.ReactNode;
  currentUser: SessionUser;
}

export function AppLayoutShell({ children, currentUser }: AppLayoutShellProps) {
  const pathname = usePathname();

  // Public routes render a clean, full-width consumer layout without the left sidebar
  const isPublicRoute =
    pathname === "/" ||
    pathname?.startsWith("/marketplace") ||
    pathname?.startsWith("/auth");

  if (isPublicRoute) {
    return (
      <main className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    );
  }

  // Portal routes (/dashboard, /studio, /admin, etc.) render contextual sidebar layout
  return (
    <div className="flex-1 flex min-h-[calc(100vh-8rem)]">
      <Sidebar currentUser={currentUser} />
      <main className="flex-1 bg-[#090D16] p-6 md:p-8">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}

