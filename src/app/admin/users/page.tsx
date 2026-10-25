import React from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getDb, initDb } from "@/lib/db";
import { UserManagementClient } from "./user-management-client";
import { Users, ShieldAlert, ArrowRight } from "lucide-react";

export default async function AdminUsersPage() {
  initDb();
  const db = getDb();
  const currentUser = await getCurrentUser();

  const isAdmin = currentUser.role === "SUPER_ADMIN";

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Administrator Role Required</h2>
        <p className="text-xs text-slate-600">
          User directory management and employee provisioning is restricted to Super Administrators.
          Your current identity is <span className="font-semibold">{currentUser.name}</span> ({currentUser.role}).
        </p>
        <div className="pt-2">
          <p className="text-xs text-slate-500 mb-3">
            Use the Persona Switcher in the top navigation bar to assume the identity of{" "}
            <strong>David Kim (VP of Operations & Super Admin)</strong>.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors"
          >
            <span>Return to Learner Overview</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // Fetch users with managers
  const usersStmt = db.prepare(`
    SELECT 
      u.*,
      m.name as manager_name,
      (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id) as enrollments_count,
      (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id AND e.status = 'COMPLETED') as completed_count,
      (SELECT COUNT(*) FROM certificates c WHERE c.user_id = u.id) as certificates_count
    FROM users u
    LEFT JOIN users m ON m.id = u.manager_id
    ORDER BY u.role DESC, u.name ASC
  `);
  const initialUsers = usersStmt.all() as any[];

  // Fetch managers for assignment dropdown
  const managers = db.prepare(`
    SELECT id, name, email, department, role
    FROM users
    WHERE role IN ('MANAGER', 'COMPLIANCE_OFFICER', 'SUPER_ADMIN') AND is_active = 1
    ORDER BY name ASC
  `).all() as any[];

  // Fetch courses for assignment modal
  const courses = db.prepare(`
    SELECT id, title, category, renewal_period_days, passing_score_pct
    FROM courses
    WHERE is_published = 1
    ORDER BY title ASC
  `).all() as any[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              User Directory & Employee Provisioning
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              RBAC DIRECTORY
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Provision enterprise personnel, assign managerial hierarchies, update role permissions, and direct-assign compliance tracks.
          </p>
        </div>
      </div>

      <UserManagementClient
        initialUsers={initialUsers}
        managers={managers}
        courses={courses}
      />
    </div>
  );
}
