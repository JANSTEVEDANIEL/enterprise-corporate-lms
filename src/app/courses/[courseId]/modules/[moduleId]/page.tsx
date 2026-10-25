import React from "react";
import { notFound } from "next/navigation";
import { getDb, initDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getQuizForModule } from "@/lib/quiz";
import { LessonPlayer } from "@/components/learner/lesson-player";

interface ModulePageProps {
  params: Promise<{
    courseId: string;
    moduleId: string;
  }>;
}

export default async function ModulePlayerPage({ params }: ModulePageProps) {
  initDb();
  const db = getDb();
  const currentUser = await getCurrentUser();
  const { courseId, moduleId } = await params;

  // Fetch module
  const moduleItem = db.prepare("SELECT * FROM modules WHERE id = ?").get(moduleId) as any;
  if (!moduleItem) {
    notFound();
  }

  // Fetch course
  const course = db.prepare("SELECT * FROM courses WHERE id = ? OR slug = ?").get(courseId, courseId) as any;
  if (!course) {
    notFound();
  }

  // Fetch enrollment
  const enrollment = db
    .prepare("SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?")
    .get(currentUser.id, course.id) as any;

  // Fetch chapters (all modules in course with progress)
  const chapters = db
    .prepare(`
      SELECT 
        m.id,
        m.course_id,
        m.title,
        m.order_index,
        m.type,
        m.estimated_minutes,
        mp.status as progress_status
      FROM modules m
      LEFT JOIN module_progress mp ON mp.module_id = m.id AND mp.enrollment_id = ?
      WHERE m.course_id = ?
      ORDER BY m.order_index ASC
    `)
    .all(enrollment?.id || null, course.id) as any[];

  // Fetch current module progress
  let progress = null;
  if (enrollment) {
    progress = db
      .prepare("SELECT * FROM module_progress WHERE enrollment_id = ? AND module_id = ?")
      .get(enrollment.id, moduleId) as any;
  }

  // If interactive quiz, fetch quiz data & user attempt history
  let quiz = null;
  let submissions: any[] = [];
  if (moduleItem.type === "INTERACTIVE_QUIZ") {
    quiz = getQuizForModule(moduleId, db);
    if (enrollment) {
      submissions = db
        .prepare(`
          SELECT * FROM quiz_submissions 
          WHERE enrollment_id = ? AND module_id = ? 
          ORDER BY attempt_number DESC
        `)
        .all(enrollment.id, moduleId) as any[];
    }
  }

  // Fetch certificate if completed
  let certificate = null;
  if (enrollment && enrollment.status === "COMPLETED") {
    certificate = db
      .prepare("SELECT * FROM certificates WHERE enrollment_id = ?")
      .get(enrollment.id) as any;
  }

  return (
    <LessonPlayer
      course={course}
      module={moduleItem}
      chapters={chapters}
      enrollment={enrollment}
      progress={progress}
      quiz={quiz}
      submissions={submissions}
      certificate={certificate}
    />
  );
}
