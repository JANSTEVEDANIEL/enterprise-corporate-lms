import React from "react";
import { getCurrentUser } from "@/lib/auth";
import { dbAdapter } from "@/lib/supabase/adapter";
import { MarketplaceCatalog } from "@/components/marketplace/marketplace-catalog";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let currentUser = null;
  try {
    currentUser = await getCurrentUser();
  } catch {
    // Unauthenticated visitors have zero login barrier
  }

  // Fetch real published courses from Unified Database Adapter
  const rawCourses = await dbAdapter.getCourses();

  // If user is logged in as student, check which courses they are already enrolled in
  let studentId = currentUser?.id;
  if (currentUser?.role !== "STUDENT") {
    studentId = "usr_sophia_chen";
  }

  // Strictly filter out legacy corporate compliance & onboarding courses
  const corporateCategories = new Set(["ONBOARDING", "COMPLIANCE", "TECHNICAL_UPSKILLING"]);
  const marketplaceCourses = rawCourses.filter((course) => {
    const cat = (course.category || "").toUpperCase();
    return !corporateCategories.has(cat);
  });

  const enrolledSet = studentId ? await dbAdapter.getEnrolledCourseIds(studentId) : new Set<string>();

  const enhancedCourses = marketplaceCourses.map((course) => ({
    ...course,
    price_dollars:
      course.price_dollars !== undefined
        ? course.price_dollars
        : course.price_cents
        ? Number((course.price_cents / 100).toFixed(2))
        : course.price ?? 0,
    is_enrolled: enrolledSet.has(course.id),
  }));

  return (
    <MarketplaceCatalog
      initialCourses={enhancedCourses}
      currentUser={currentUser}
    />
  );
}
