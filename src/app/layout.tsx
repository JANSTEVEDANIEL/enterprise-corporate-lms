import type { Metadata } from "next";
import "./globals.css";
import { RoleSwitcher } from "@/components/layout/role-switcher";
import { Navbar } from "@/components/layout/navbar";
import { AppLayoutShell } from "@/components/layout/app-layout-shell";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Multi-Sided EdTech Course Marketplace & LMS",
  description:
    "Production-grade EdTech course marketplace connecting creators and students with creator content privacy shield, multi-sided role switcher, and high-converting course cohorts.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentUser = await getCurrentUser();

  return (
    <html lang="en" className="h-full dark" suppressHydrationWarning>
      <body className="h-full flex flex-col font-sans antialiased bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
        <RoleSwitcher initialUser={currentUser} />
        <Navbar currentUser={currentUser} />
        <AppLayoutShell currentUser={currentUser}>
          {children}
        </AppLayoutShell>
      </body>
    </html>
  );
}
