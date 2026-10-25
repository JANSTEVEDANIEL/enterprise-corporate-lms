import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Enterprise Corporate LMS | Onboarding, Upskilling & Compliance",
  description:
    "Production-grade enterprise learning management system with role-based access control, tamper-evident audit logs, and employee onboarding.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentUser = await getCurrentUser();

  return (
    <html lang="en" className="h-full bg-slate-50">
      <body className="h-full flex flex-col font-sans antialiased text-slate-900">
        <Header />
        <div className="flex-1 flex overflow-hidden">
          <Sidebar currentUser={currentUser} />
          <main className="flex-1 overflow-y-auto bg-slate-50/50 p-6 md:p-8">
            <div className="max-w-7xl mx-auto">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
