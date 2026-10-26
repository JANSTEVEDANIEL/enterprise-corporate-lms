import React from "react";
import { notFound } from "next/navigation";
import { dbAdapter } from "@/lib/supabase/adapter";
import { getCurrentUser } from "@/lib/auth";
import { CoursePreviewClient } from "./course-preview-client";

interface MarketplaceCoursePreviewPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function MarketplaceCoursePreviewPage({
  params,
}: MarketplaceCoursePreviewPageProps) {
  const { slug } = await params;

  // Unauthenticated visitors have zero login barrier
  let currentUser = null;
  try {
    currentUser = await getCurrentUser();
  } catch {
    currentUser = null;
  }

  const course = await dbAdapter.getCourseBySlug(slug);
  if (!course) {
    notFound();
  }

  // Fetch complete curriculum (Week 1 through Week 7+)
  const weeks = await dbAdapter.getCurriculum(course.id);

  // Determine enrollment and wallet balance for the student
  let isEnrolled = false;
  let studentWalletBalance = 500.0;
  let studentId = currentUser?.id;
  if (currentUser?.role !== "STUDENT") {
    studentId = "usr_sophia_chen";
  }

  if (studentId) {
    try {
      isEnrolled = await dbAdapter.isUserEnrolled(studentId, course.id);
      const wallet = await dbAdapter.getWallet(studentId);
      if (wallet && typeof wallet.balance_dollars === "number") {
        studentWalletBalance = wallet.balance_dollars;
      }
    } catch {
      // fallback
    }
  }

  return (
    <CoursePreviewClient
      course={course}
      weeks={weeks}
      currentUser={currentUser}
      isEnrolled={isEnrolled}
      studentWalletBalance={studentWalletBalance}
    />
  );
}
