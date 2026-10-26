import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { dbAdapter } from "@/lib/supabase/adapter";
import { StudentLessonPlayer } from "@/components/player/student-lesson-player";
import { Lock, ShoppingCart, ArrowLeft } from "lucide-react";

interface CoursePlayerPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function StudentCoursePlayerPage({ params }: CoursePlayerPageProps) {
  const { id } = await params;
  const currentUser = await getCurrentUser();

  const curriculum = await dbAdapter.getCourseWithFullCurriculum(id, currentUser.id);
  if (!curriculum || !curriculum.course) {
    notFound();
  }

  const { course, weeks, progressPct, enrollment, certificate } = curriculum;

  const isEnrolled = !!enrollment;
  const isAuthor = course.creator_id === currentUser.id;

  if (!isEnrolled && !isAuthor) {
    return (
      <div className="max-w-2xl mx-auto my-16 p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-6 text-white shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Enrollment Required</h1>
          <p className="text-sm text-slate-400">
            You must be enrolled in <strong className="text-white">{course.title}</strong> to access the video player, curriculum drawer, and downloadable resources.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/marketplace"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition-all shadow-md"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Browse Marketplace</span>
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all border border-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <StudentLessonPlayer
      course={course}
      weeks={weeks}
      initialProgressPct={progressPct}
      initialCertificate={certificate}
      currentUser={{
        id: currentUser.id,
        name: currentUser.name,
        role: currentUser.role,
      }}
    />
  );
}
