import React from "react";
import { getCurrentUser } from "@/lib/auth";
import { dbAdapter } from "@/lib/supabase/adapter";
import { MarketplaceCatalog } from "@/components/marketplace/marketplace-catalog";

export default async function MarketplacePage() {
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

  const enhancedCourses = await Promise.all(
    rawCourses.map(async (course) => {
      let isEnrolled = false;
      if (studentId) {
        try {
          isEnrolled = await dbAdapter.isUserEnrolled(studentId, course.id);
        } catch {
          isEnrolled = false;
        }
      }

      return {
        ...course,
        price_dollars:
          course.price_dollars !== undefined
            ? course.price_dollars
            : course.price_cents
            ? Number((course.price_cents / 100).toFixed(2))
            : course.price ?? 0,
        is_enrolled: isEnrolled,
      };
    })
  );

  return (
    <MarketplaceCatalog
      initialCourses={enhancedCourses}
      currentUser={currentUser}
    />
  );
}
