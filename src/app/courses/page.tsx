import React from "react";
import { getDb, initDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { CourseCard } from "@/components/learner/course-card";
import { BookOpen, Search, ShieldCheck, Filter, Award } from "lucide-react";
import Link from "next/link";

interface CoursesPageProps {
  searchParams: Promise<{
    category?: string;
    search?: string;
  }>;
}

export default async function CoursesCatalogPage({ searchParams }: CoursesPageProps) {
  initDb();
  const db = getDb();
  const currentUser = await getCurrentUser();
  const { category = "ALL", search = "" } = await searchParams;

  let querySql = `
    SELECT 
      c.*,
      (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) as modules_count,
      e.id as enrollment_id,
      e.status as enrollment_status,
      e.progress_pct,
      e.due_date,
      e.completed_at
    FROM courses c
    LEFT JOIN enrollments e ON e.course_id = c.id AND e.user_id = ?
    WHERE c.is_published = 1
  `;

  const params: any[] = [currentUser.id];

  if (category && category !== "ALL") {
    querySql += " AND c.category = ?";
    params.push(category);
  }

  if (search && search.trim() !== "") {
    querySql += " AND (c.title LIKE ? OR c.description LIKE ?)";
    const term = `%${search.trim()}%`;
    params.push(term, term);
  }

  querySql += " ORDER BY c.is_mandatory DESC, c.title ASC";

  const courses = db.prepare(querySql).all(...params) as any[];

  const categories = [
    { id: "ALL", label: "All Curriculums" },
    { id: "ONBOARDING", label: "Onboarding" },
    { id: "COMPLIANCE", label: "Compliance & Legal" },
    { id: "SECURITY", label: "Security & SOC 2" },
    { id: "TECHNICAL_UPSKILLING", label: "Technical Safety" },
    { id: "LEADERSHIP", label: "Leadership" },
  ];

  const totalCourses = courses.length;
  const mandatoryCount = courses.filter((c) => c.is_mandatory === 1).length;
  const enrolledCount = courses.filter((c) => !!c.enrollment_status).length;
  const completedCount = courses.filter((c) => c.enrollment_status === "COMPLETED").length;

  return (
    <div className="space-y-8">
      {/* 1. Header & Catalog Overview */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 rounded-2xl p-6 md:p-8 text-white shadow-sm relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold backdrop-blur mb-3">
            <BookOpen className="w-3.5 h-3.5 text-blue-400" />
            Corporate Curriculum & Skills Directory
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Course Catalog & Training Tracks
          </h1>
          <p className="mt-2 text-slate-300 text-xs md:text-sm leading-relaxed">
            Explore role-based upskilling, mandatory compliance roadmaps, and certified engineering resilience programs.
          </p>

          <div className="mt-5 flex items-center gap-4 text-xs font-semibold text-slate-300">
            <div>
              <strong className="text-white font-bold">{totalCourses}</strong> Courses Available
            </div>
            <span>•</span>
            <div>
              <strong className="text-rose-400 font-bold">{mandatoryCount}</strong> Mandatory
            </div>
            <span>•</span>
            <div>
              <strong className="text-emerald-400 font-bold">{completedCount}</strong> Completed by You
            </div>
          </div>
        </div>
      </div>

      {/* 2. Search & Category Filters */}
      <div className="space-y-4">
        {/* Search Bar */}
        <form method="GET" className="relative flex items-center max-w-md">
          <input type="hidden" name="category" value={category} />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Search courses, compliance topics, or technical skills..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-xs"
          />
        </form>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => {
            const isActive = category === cat.id;
            return (
              <Link
                key={cat.id}
                href={`/courses?category=${cat.id}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {cat.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* 3. Courses Grid */}
      {courses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No courses match your filter</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search terms or selecting a different category to view available training tracks.
          </p>
          <Link
            href="/courses"
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline pt-2"
          >
            Clear filters
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
