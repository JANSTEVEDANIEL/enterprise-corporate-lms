import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { getEnrollmentComplianceStatus } from "@/lib/compliance";

export async function GET(request: NextRequest) {
  try {
    initDb();
    const db = getDb();
    const currentUser = await getCurrentUser();

    // Verify Manager, Compliance Officer, or Admin permission
    if (!hasPermission(currentUser.role, "MANAGER")) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Manager or administrator role required" },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const requestedManagerId = searchParams.get("managerId");

    // If caller is super admin or compliance officer and provided a managerId, filter by that.
    // Otherwise, default to currentUser.id.
    let targetManagerId = currentUser.id;
    if (requestedManagerId && (currentUser.role === "SUPER_ADMIN" || currentUser.role === "COMPLIANCE_OFFICER")) {
      targetManagerId = requestedManagerId;
    }

    // Get direct reports
    let reportsQuery = `
      SELECT id, name, email, role, department, job_title, avatar_url, is_active, created_at
      FROM users
      WHERE manager_id = ? AND is_active = 1
      ORDER BY name ASC
    `;
    let reports = db.prepare(reportsQuery).all(targetManagerId) as any[];

    // If user is super_admin or manager with 0 direct reports (e.g. testing), fall back to all employees who have a manager or active employees
    if (reports.length === 0 && (currentUser.role === "SUPER_ADMIN" || currentUser.role === "COMPLIANCE_OFFICER")) {
      reports = db.prepare(`
        SELECT id, name, email, role, department, job_title, avatar_url, is_active, created_at
        FROM users
        WHERE role != 'SUPER_ADMIN' AND id != ? AND is_active = 1
        ORDER BY name ASC
      `).all(currentUser.id) as any[];
    }

    const directReports = [];
    let totalAssignedCourses = 0;
    let totalCompletedCourses = 0;
    let compliantReportsCount = 0;
    let overdueReportsCount = 0;
    let inProgressReportsCount = 0;

    for (const report of reports) {
      // Get report's enrollments joined with course info
      const enrollmentsStmt = db.prepare(`
        SELECT 
          e.id as enrollment_id, e.status as enrollment_status, e.progress_pct,
          e.assigned_at, e.due_date, e.completed_at,
          c.id as course_id, c.title as course_title, c.category, c.renewal_period_days,
          c.is_mandatory, c.estimated_minutes,
          (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) as total_modules,
          (SELECT COUNT(*) FROM module_progress mp WHERE mp.enrollment_id = e.id AND mp.status = 'COMPLETED') as completed_modules
        FROM enrollments e
        JOIN courses c ON c.id = e.course_id
        WHERE e.user_id = ?
        ORDER BY c.is_mandatory DESC, e.due_date ASC
      `);
      const enrollments = enrollmentsStmt.all(report.id) as any[];

      // Recent quiz submissions for this user
      const quizSubmissionsStmt = db.prepare(`
        SELECT qs.id, qs.score, qs.passed, qs.attempt_number, qs.submitted_at,
               q.title as quiz_title, c.title as course_title
        FROM quiz_submissions qs
        JOIN modules m ON m.id = qs.module_id
        JOIN courses c ON c.id = m.course_id
        JOIN quizzes q ON q.module_id = m.id
        WHERE qs.user_id = ?
        ORDER BY qs.submitted_at DESC
        LIMIT 5
      `);
      const recentQuizzes = quizSubmissionsStmt.all(report.id) as any[];

      let reportHasOverdue = false;
      let reportTotalProgress = 0;
      let reportCompletedCount = 0;

      const formattedEnrollments = enrollments.map((enr) => {
        const evalResult = getEnrollmentComplianceStatus({
          status: enr.enrollment_status,
          completed_at: enr.completed_at,
          due_date: enr.due_date,
          renewal_period_days: enr.renewal_period_days,
        });

        if (evalResult.isOverdue) {
          reportHasOverdue = true;
        }

        reportTotalProgress += enr.progress_pct || 0;
        if (enr.enrollment_status === "COMPLETED") {
          reportCompletedCount++;
        }

        totalAssignedCourses++;
        if (enr.enrollment_status === "COMPLETED") {
          totalCompletedCourses++;
        }

        return {
          enrollmentId: enr.enrollment_id,
          courseId: enr.course_id,
          courseTitle: enr.course_title,
          category: enr.category,
          isMandatory: Boolean(enr.is_mandatory),
          status: enr.enrollment_status,
          complianceStatus: evalResult.status,
          isOverdue: evalResult.isOverdue,
          daysRemaining: evalResult.daysRemaining,
          progressPct: enr.progress_pct,
          completedModules: enr.completed_modules,
          totalModules: enr.total_modules,
          dueDate: enr.due_date,
          completedAt: enr.completed_at,
        };
      });

      const averageProgress = enrollments.length > 0
        ? Math.round(reportTotalProgress / enrollments.length)
        : 100;

      let employeeStatus: "COMPLIANT" | "IN_PROGRESS" | "OVERDUE" = "COMPLIANT";
      if (reportHasOverdue) {
        employeeStatus = "OVERDUE";
        overdueReportsCount++;
      } else if (reportCompletedCount < enrollments.length || averageProgress < 100) {
        employeeStatus = "IN_PROGRESS";
        inProgressReportsCount++;
      } else {
        employeeStatus = "COMPLIANT";
        compliantReportsCount++;
      }

      directReports.push({
        id: report.id,
        name: report.name,
        email: report.email,
        jobTitle: report.job_title,
        department: report.department,
        avatarUrl: report.avatar_url,
        status: employeeStatus,
        averageProgress,
        assignedCount: enrollments.length,
        completedCount: reportCompletedCount,
        hasOverdue: reportHasOverdue,
        enrollments: formattedEnrollments,
        recentQuizzes,
      });
    }

    const totalReports = directReports.length;
    const teamCompletionRate = totalAssignedCourses > 0
      ? Math.round((totalCompletedCourses / totalAssignedCourses) * 100)
      : 100;

    return NextResponse.json({
      success: true,
      manager: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        department: currentUser.department,
        role: currentUser.role,
      },
      stats: {
        totalReports,
        compliantReportsCount,
        inProgressReportsCount,
        overdueReportsCount,
        teamCompletionRate,
        totalAssignedCourses,
        totalCompletedCourses,
      },
      directReports,
    });
  } catch (error: any) {
    console.error("GET /api/manager/team error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load team data" },
      { status: 500 }
    );
  }
}
