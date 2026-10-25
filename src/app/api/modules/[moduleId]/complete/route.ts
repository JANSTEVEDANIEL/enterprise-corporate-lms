import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb, initDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { generateCertificate } from "@/lib/certificates";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    initDb();
    const db = getDb();
    const currentUser = await getCurrentUser();
    const { moduleId } = await params;

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body optional
    }

    const timeSpentSeconds = Number(body.timeSpentSeconds) || 60;
    const lastPositionSeconds = Number(body.lastPositionSeconds) || timeSpentSeconds;

    const moduleStmt = db.prepare("SELECT * FROM modules WHERE id = ?");
    const moduleItem = moduleStmt.get(moduleId) as any;

    if (!moduleItem) {
      return NextResponse.json(
        { success: false, error: "Module not found" },
        { status: 404 }
      );
    }

    const courseId = moduleItem.course_id;

    // Fetch or create enrollment
    let enrollment = db.prepare(`
      SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?
    `).get(currentUser.id, courseId) as any;

    const now = new Date().toISOString();

    if (!enrollment) {
      const enrId = `enr_${randomUUID()}`;
      db.prepare(`
        INSERT INTO enrollments (
          id, user_id, course_id, status, progress_pct, assigned_at, created_at, updated_at
        ) VALUES (?, ?, ?, 'IN_PROGRESS', 0, ?, ?, ?)
      `).run(enrId, currentUser.id, courseId, now, now, now);

      enrollment = db.prepare("SELECT * FROM enrollments WHERE id = ?").get(enrId) as any;
    }

    // Upsert module_progress
    const mpExisting = db.prepare(`
      SELECT * FROM module_progress WHERE enrollment_id = ? AND module_id = ?
    `).get(enrollment.id, moduleId) as any;

    if (mpExisting) {
      db.prepare(`
        UPDATE module_progress 
        SET status = 'COMPLETED', completed_at = ?, time_spent_seconds = time_spent_seconds + ?,
            last_position_seconds = ?, updated_at = ?
        WHERE id = ?
      `).run(now, timeSpentSeconds, lastPositionSeconds, now, mpExisting.id);
    } else {
      const mpId = `mp_${randomUUID()}`;
      db.prepare(`
        INSERT INTO module_progress (
          id, enrollment_id, module_id, user_id, status, completed_at,
          time_spent_seconds, last_position_seconds, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?, ?)
      `).run(mpId, enrollment.id, moduleId, currentUser.id, now, timeSpentSeconds, lastPositionSeconds, now, now);
    }

    // Record audit event
    recordAuditEvent({
      actorId: currentUser.id,
      actorRole: currentUser.role,
      actorName: currentUser.name,
      action: "MODULE_COMPLETED",
      targetType: "MODULE",
      targetId: moduleId,
      courseId,
      moduleId,
      moduleVersion: moduleItem.version,
      details: {
        enrollmentId: enrollment.id,
        timeSpentSeconds,
      },
    });

    // Calculate updated course progress
    const allModulesStmt = db.prepare("SELECT id, order_index FROM modules WHERE course_id = ? ORDER BY order_index ASC");
    const allModules = allModulesStmt.all(courseId) as any[];
    const totalModules = allModules.length;

    const completedStmt = db.prepare(`
      SELECT COUNT(DISTINCT module_id) as count FROM module_progress 
      WHERE enrollment_id = ? AND status = 'COMPLETED'
    `);
    const completedCount = (completedStmt.get(enrollment.id) as any).count;

    const progressPct = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 100;
    const isCourseCompleted = progressPct === 100;

    db.prepare(`
      UPDATE enrollments 
      SET progress_pct = ?, status = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(
      progressPct,
      isCourseCompleted ? "COMPLETED" : "IN_PROGRESS",
      isCourseCompleted ? now : enrollment.completed_at,
      now,
      enrollment.id
    );

    // If 100% complete and no quiz or quiz was passed, issue certificate
    let certificate = null;
    if (isCourseCompleted) {
      certificate = generateCertificate({
        userId: currentUser.id,
        courseId,
        enrollmentId: enrollment.id,
        score: 100,
        actorRole: currentUser.role,
        actorName: currentUser.name,
      });
    }

    // Find next module
    const currentIndex = allModules.findIndex((m) => m.id === moduleId);
    const nextModule = currentIndex < allModules.length - 1 ? allModules[currentIndex + 1] : null;

    return NextResponse.json({
      success: true,
      message: "Module marked as completed",
      progressPct,
      isCourseCompleted,
      nextModuleId: nextModule ? nextModule.id : null,
      certificate,
    });
  } catch (error: any) {
    console.error("POST /api/modules/[moduleId]/complete error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to complete module" },
      { status: 500 }
    );
  }
}
