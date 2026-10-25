import React from "react";
import Link from "next/link";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { getDb, initDb } from "@/lib/db";
import { CourseAuthoringClient } from "./course-authoring-client";
import { FolderLock, Plus, ShieldAlert, ArrowRight } from "lucide-react";

export default async function AdminCoursesPage() {
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
          Course authoring and curriculum configuration is restricted to Super Administrators.
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

  const coursesStmt = db.prepare(`
    SELECT 
      c.*,
      (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) as modules_count,
      (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) as enrollments_count,
      (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status = 'COMPLETED') as completed_count
    FROM courses c
    ORDER BY c.created_at DESC
  `);
  const initialCourses = coursesStmt.all() as any[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Course Authoring & Curriculum Management
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
              ADMIN CONTROL
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Create new compliance curriculums, configure passing thresholds, set renewal schedules, and author modules.
          </p>
        </div>
      </div>

      <CourseAuthoringClient initialCourses={initialCourses} />
    </div>
  );
}
