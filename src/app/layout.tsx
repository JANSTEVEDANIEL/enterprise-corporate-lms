import type { Metadata } from "next";
import "./globals.css";
import { RoleSwitcher } from "@/components/layout/role-switcher";
import { Navbar } from "@/components/layout/navbar";
import { Sidebar } from "@/components/layout/sidebar";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Multi-Sided EdTech Course Marketplace & LMS",
  description:
    "Production-grade EdTech course marketplace connecting creators and students with creator content privacy shield, multi-sided role switcher, and corporate compliance tracking.",
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
        <div className="flex-1 flex overflow-hidden">
          <Sidebar currentUser={currentUser} />
          <main className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50 p-6 md:p-8">
            <div className="max-w-7xl mx-auto">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
