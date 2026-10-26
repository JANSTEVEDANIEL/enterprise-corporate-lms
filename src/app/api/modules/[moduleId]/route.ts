import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getQuizForModule } from "@/lib/quiz";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    initDb();
    const db = getDb();
    const currentUser = await getCurrentUser(request);
    const { moduleId } = await params;

    if (currentUser.role === "SUPER_ADMIN") {
      return NextResponse.json(
        {
          success: false,
          error: "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE",
          message: "Super Admin access to creator intellectual property and raw lesson content is strictly restricted.",
        },
        { status: 403 }
      );
    }

    const moduleStmt = db.prepare("SELECT * FROM modules WHERE id = ?");
    const moduleItem = moduleStmt.get(moduleId) as any;

    if (!moduleItem) {
      return NextResponse.json(
        { success: false, error: "Module not found" },
        { status: 404 }
      );
    }

    // Fetch course
    const courseStmt = db.prepare("SELECT * FROM courses WHERE id = ?");
    const course = courseStmt.get(moduleItem.course_id) as any;

    // Fetch all modules for this course to calculate chapter sequence & prev/next navigation
    const allModulesStmt = db.prepare(`
      SELECT id, title, order_index, type, estimated_minutes 
      FROM modules 
      WHERE course_id = ? 
      ORDER BY order_index ASC
    `);
    const allModules = allModulesStmt.all(moduleItem.course_id) as any[];

    const currentIndex = allModules.findIndex((m) => m.id === moduleId);
    const prevModule = currentIndex > 0 ? allModules[currentIndex - 1] : null;
    const nextModule = currentIndex < allModules.length - 1 ? allModules[currentIndex + 1] : null;

    // Fetch user enrollment
    const enrollmentStmt = db.prepare(`
      SELECT * FROM enrollments 
      WHERE user_id = ? AND course_id = ?
    `);
    const enrollment = enrollmentStmt.get(currentUser.id, moduleItem.course_id) as any;

    // Fetch user module progress
    let progress = null;
    if (enrollment) {
      const progressStmt = db.prepare(`
        SELECT * FROM module_progress 
        WHERE enrollment_id = ? AND module_id = ?
      `);
      progress = progressStmt.get(enrollment.id, moduleId) as any;
    }

    // If quiz, fetch sanitized quiz questions
    let quiz = null;
    let submissions: any[] = [];
    if (moduleItem.type === "INTERACTIVE_QUIZ") {
      quiz = getQuizForModule(moduleId, db);
      if (enrollment) {
        const subStmt = db.prepare(`
          SELECT id, score, passed, attempt_number, submitted_at, feedback_payload
          FROM quiz_submissions 
          WHERE enrollment_id = ? AND module_id = ?
          ORDER BY attempt_number DESC
        `);
        submissions = subStmt.all(enrollment.id, moduleId) as any[];
      }
    }

    return NextResponse.json({
      success: true,
      module: moduleItem,
      course,
      chapters: allModules,
      navigation: {
        currentIndex,
        totalChapters: allModules.length,
        prevModule,
        nextModule,
      },
      enrollment: enrollment || null,
      progress: progress || null,
      quiz,
      submissions,
    });
  } catch (error: any) {
    console.error("GET /api/modules/[moduleId] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load module" },
      { status: 500 }
    );
  }
}
