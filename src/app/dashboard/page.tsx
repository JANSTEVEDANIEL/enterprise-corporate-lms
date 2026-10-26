import React from "react";
import { getCurrentUser } from "@/lib/auth";
import { dbAdapter } from "@/lib/supabase/adapter";
import { StudentDashboardClient } from "./student-dashboard-client";

export default async function StudentDashboardPage() {
  const currentUser = await getCurrentUser();
  const courses = await dbAdapter.getEnrolledCourses(currentUser.id);
  const wallet = await dbAdapter.getWallet(currentUser.id);
  const certificates = await dbAdapter.getCertificatesForUser(currentUser.id);

  return (
    <StudentDashboardClient
      currentUser={currentUser}
      courses={courses}
      wallet={wallet}
      certificates={certificates}
    />
  );
}
