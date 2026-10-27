import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { dbAdapter } from "@/lib/supabase/adapter";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser(request);
    if (currentUser.role === "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE", code: 403 },
        { status: 403 }
      );
    }
    const { id: courseId } = await params;

    const course = await dbAdapter.getCourseById(courseId);
    if (!course) {
      return NextResponse.json(
        { success: false, error: `Course not found: ${courseId}` },
        { status: 404 }
      );
    }

    const weeks = await dbAdapter.getCurriculum(courseId);

    return NextResponse.json({
      success: true,
      course_id: courseId,
      weeks,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch curriculum weeks" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser(request);
    if (currentUser.role === "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE", code: 403 },
        { status: 403 }
      );
    }
    const { id: courseId } = await params;

    const course = await dbAdapter.getCourseById(courseId);
    if (!course) {
      return NextResponse.json(
        { success: false, error: `Course not found: ${courseId}` },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action || "ADD_WEEK";
    const now = new Date().toISOString();

    if (dbAdapter.isOffline) {
      initDb();
      const db = getDb();

      // 1. ADD NEW WEEK
      if (action === "ADD_WEEK") {
        const maxWeek = (
          db
            .prepare("SELECT MAX(week_number) as max_num FROM weeks WHERE course_id = ?")
            .get(courseId) as any
        )?.max_num ?? 0;

        const nextWeekNumber = maxWeek + 1;
        const weekId = `wk_${randomUUID().slice(0, 8)}`;
        const title =
          body.title?.trim() ||
          (nextWeekNumber === 1
            ? "Week 1: Core Architectural Foundations"
            : `Week ${nextWeekNumber}: Module Milestone ${nextWeekNumber}`);
        const description = body.description?.trim() || `Milestone ${nextWeekNumber} content and exercises`;

        db.prepare(
          `INSERT INTO weeks (id, course_id, week_number, title, description, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(weekId, courseId, nextWeekNumber, title, description, now, now);

        db.prepare(
          `UPDATE courses SET total_weeks = MAX(total_weeks, ?), updated_at = ? WHERE id = ?`
        ).run(nextWeekNumber, now, courseId);

        const createdWeek = db.prepare("SELECT * FROM weeks WHERE id = ?").get(weekId) as any;
        createdWeek.lessons = [];
        createdWeek.quiz = null;

        return NextResponse.json({
          success: true,
          week: createdWeek,
        }, { status: 201 });
      }

      // 2. ADD LESSON TO A WEEK
      if (action === "ADD_LESSON") {
        const { week_id, title, duration_seconds = 0, video_url = null, supplementary_files = [], is_preview = false } = body;

        if (!week_id) {
          return NextResponse.json(
            { success: false, error: "Missing required parameter: week_id" },
            { status: 400 }
          );
        }

        if (!title || typeof title !== "string" || title.trim().length === 0) {
          return NextResponse.json(
            { success: false, error: "Lesson title cannot be empty" },
            { status: 400 }
          );
        }

        const week = db.prepare("SELECT * FROM weeks WHERE id = ? AND course_id = ?").get(week_id, courseId) as any;
        if (!week) {
          return NextResponse.json(
            { success: false, error: `Week ${week_id} not found in course ${courseId}` },
            { status: 404 }
          );
        }

        const maxOrder = (
          db
            .prepare("SELECT MAX(order_index) as max_ord FROM lessons WHERE week_id = ?")
            .get(week_id) as any
        )?.max_ord ?? 0;

        const nextOrder = maxOrder + 1;
        const lessonId = `les_${randomUUID().slice(0, 8)}`;
        const filesJson = JSON.stringify(Array.isArray(supplementary_files) ? supplementary_files : []);

        db.prepare(
          `INSERT INTO lessons (
            id, week_id, course_id, title, order_index, duration_seconds,
            video_url, supplementary_files, is_preview, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          lessonId,
          week_id,
          courseId,
          title.trim(),
          nextOrder,
          Math.max(0, Number(duration_seconds) || 0),
          video_url,
          filesJson,
          is_preview ? 1 : 0,
          now,
          now
        );

        const createdLesson = db.prepare("SELECT * FROM lessons WHERE id = ?").get(lessonId) as any;
        createdLesson.supplementary_files = JSON.parse(createdLesson.supplementary_files || "[]");

        return NextResponse.json({
          success: true,
          lesson: createdLesson,
        }, { status: 201 });
      }

      // 3. SET WEEKLY KNOWLEDGE CHECK / QUIZ
      if (action === "SET_QUIZ") {
        const { week_id, title = "Weekly Knowledge Check", passing_score_pct = 80, questions = [] } = body;

        if (!week_id) {
          return NextResponse.json(
            { success: false, error: "Missing required parameter: week_id" },
            { status: 400 }
          );
        }

        const week = db.prepare("SELECT * FROM weeks WHERE id = ? AND course_id = ?").get(week_id, courseId) as any;
        if (!week) {
          return NextResponse.json(
            { success: false, error: `Week ${week_id} not found in course ${courseId}` },
            { status: 404 }
          );
        }

        const quizId = `qz_${randomUUID().slice(0, 8)}`;
        const questionsJson = JSON.stringify(Array.isArray(questions) ? questions : []);

        db.prepare(
          `INSERT INTO week_quizzes (id, week_id, course_id, title, passing_score_pct, questions, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(week_id) DO UPDATE SET
             title = excluded.title,
             passing_score_pct = excluded.passing_score_pct,
             questions = excluded.questions,
             updated_at = excluded.updated_at`
        ).run(
          quizId,
          week_id,
          courseId,
          title.trim(),
          Math.max(0, Math.min(100, Number(passing_score_pct) || 80)),
          questionsJson,
          now,
          now
        );

        const savedQuiz = db.prepare("SELECT * FROM week_quizzes WHERE week_id = ?").get(week_id) as any;
        savedQuiz.questions = JSON.parse(savedQuiz.questions || "[]");

        return NextResponse.json({
          success: true,
          quiz: savedQuiz,
        });
      }
    } else {
      const supabase = getSupabaseAdminClient();
      if (!supabase) throw new Error("Supabase client not available");

      if (action === "ADD_WEEK") {
        const { data: existingWeeks } = await supabase
          .from("weeks")
          .select("week_number")
          .eq("course_id", courseId)
          .order("week_number", { ascending: false })
          .limit(1);

        const maxWeek = existingWeeks?.[0]?.week_number ?? 0;
        const nextWeekNumber = maxWeek + 1;
        const weekId = `wk_${randomUUID().slice(0, 8)}`;
        const title =
          body.title?.trim() ||
          (nextWeekNumber === 1
            ? "Week 1: Core Architectural Foundations"
            : `Week ${nextWeekNumber}: Module Milestone ${nextWeekNumber}`);
        const description = body.description?.trim() || `Milestone ${nextWeekNumber} content and exercises`;

        const { data: createdWeek, error: wErr } = await supabase
          .from("weeks")
          .insert({
            id: weekId,
            course_id: courseId,
            week_number: nextWeekNumber,
            title,
            description,
            created_at: now,
            updated_at: now,
          })
          .select()
          .single();

        if (wErr) throw wErr;

        await supabase.from("courses").update({
          total_weeks: Math.max(course.total_weeks || 1, nextWeekNumber),
          updated_at: now,
        }).eq("id", courseId);

        return NextResponse.json({
          success: true,
          week: { ...createdWeek, lessons: [], quiz: null },
        }, { status: 201 });
      }

      if (action === "ADD_LESSON") {
        const { week_id, title, duration_seconds = 0, video_url = null, supplementary_files = [], is_preview = false } = body;
        if (!week_id) {
          return NextResponse.json({ success: false, error: "Missing required parameter: week_id" }, { status: 400 });
        }
        if (!title || typeof title !== "string" || title.trim().length === 0) {
          return NextResponse.json({ success: false, error: "Lesson title cannot be empty" }, { status: 400 });
        }

        const { data: existingLessons } = await supabase
          .from("lessons")
          .select("order_index")
          .eq("week_id", week_id)
          .order("order_index", { ascending: false })
          .limit(1);

        const nextOrder = (existingLessons?.[0]?.order_index ?? 0) + 1;
        const lessonId = `les_${randomUUID().slice(0, 8)}`;

        const { data: createdLesson, error: lErr } = await supabase
          .from("lessons")
          .insert({
            id: lessonId,
            week_id,
            course_id: courseId,
            title: title.trim(),
            order_index: nextOrder,
            duration_seconds: Math.max(0, Number(duration_seconds) || 0),
            video_url,
            supplementary_files: Array.isArray(supplementary_files) ? supplementary_files : [],
            is_preview: Boolean(is_preview),
            created_at: now,
            updated_at: now,
          })
          .select()
          .single();

        if (lErr) throw lErr;

        return NextResponse.json({
          success: true,
          lesson: createdLesson,
        }, { status: 201 });
      }

      if (action === "SET_QUIZ") {
        const { week_id, title = "Weekly Knowledge Check", passing_score_pct = 80, questions = [] } = body;
        if (!week_id) {
          return NextResponse.json({ success: false, error: "Missing required parameter: week_id" }, { status: 400 });
        }

        const quizId = `qz_${randomUUID().slice(0, 8)}`;
        const { data: savedQuiz, error: qErr } = await supabase
          .from("week_quizzes")
          .upsert({
            id: quizId,
            week_id,
            course_id: courseId,
            title: title.trim(),
            passing_score_pct: Math.max(0, Math.min(100, Number(passing_score_pct) || 80)),
            questions: Array.isArray(questions) ? questions : [],
            created_at: now,
            updated_at: now,
          }, { onConflict: "week_id" })
          .select()
          .single();

        if (qErr) throw qErr;

        return NextResponse.json({
          success: true,
          quiz: savedQuiz,
        });
      }
    }

    return NextResponse.json(
      { success: false, error: `Unrecognized action: ${action}` },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process week operation" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser(request);
    if (currentUser.role === "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE", code: 403 },
        { status: 403 }
      );
    }
    const { id: courseId } = await params;

    const body = await request.json().catch(() => ({}));
    const action = body.action;
    const now = new Date().toISOString();

    if (dbAdapter.isOffline) {
      initDb();
      const db = getDb();

      // 1. UPDATE WEEK METADATA
      if (action === "UPDATE_WEEK") {
        const { week_id, title, description } = body;
        if (!week_id) {
          return NextResponse.json({ success: false, error: "Missing week_id" }, { status: 400 });
        }

        const updates: string[] = [];
        const values: any[] = [];
        if (title !== undefined) {
          updates.push("title = ?");
          values.push(title.trim());
        }
        if (description !== undefined) {
          updates.push("description = ?");
          values.push(description.trim());
        }

        if (updates.length > 0) {
          updates.push("updated_at = ?");
          values.push(now);
          values.push(week_id);
          values.push(courseId);
          db.prepare(`UPDATE weeks SET ${updates.join(", ")} WHERE id = ? AND course_id = ?`).run(...values);
        }

        const updatedWeek = db.prepare("SELECT * FROM weeks WHERE id = ?").get(week_id) as any;
        return NextResponse.json({ success: true, week: updatedWeek });
      }

      // 2. REORDER LESSONS
      if (action === "REORDER_LESSONS") {
        const { week_id, lesson_ids } = body;
        if (!week_id || !Array.isArray(lesson_ids)) {
          return NextResponse.json(
            { success: false, error: "Missing week_id or lesson_ids array" },
            { status: 400 }
          );
        }

        db.prepare("UPDATE lessons SET order_index = order_index + 10000 WHERE week_id = ?").run(week_id);

        const updateOrderStmt = db.prepare(
          "UPDATE lessons SET order_index = ?, updated_at = ? WHERE id = ? AND week_id = ?"
        );

        for (let i = 0; i < lesson_ids.length; i++) {
          updateOrderStmt.run(i + 1, now, lesson_ids[i], week_id);
        }

        const reorderedLessons = db
          .prepare("SELECT * FROM lessons WHERE week_id = ? ORDER BY order_index ASC")
          .all(week_id) as any[];

        for (const l of reorderedLessons) {
          if (typeof l.supplementary_files === "string") {
            try {
              l.supplementary_files = JSON.parse(l.supplementary_files);
            } catch {
              l.supplementary_files = [];
            }
          }
        }

        return NextResponse.json({
          success: true,
          week_id,
          lessons: reorderedLessons,
        });
      }

      // 3. UPDATE LESSON
      if (action === "UPDATE_LESSON") {
        const { lesson_id, title, duration_seconds, video_url, supplementary_files, is_preview } = body;
        if (!lesson_id) {
          return NextResponse.json({ success: false, error: "Missing lesson_id" }, { status: 400 });
        }

        const updates: string[] = [];
        const values: any[] = [];

        if (title !== undefined) {
          updates.push("title = ?");
          values.push(title.trim());
        }
        if (duration_seconds !== undefined) {
          updates.push("duration_seconds = ?");
          values.push(Math.max(0, Number(duration_seconds) || 0));
        }
        if (video_url !== undefined) {
          updates.push("video_url = ?");
          values.push(video_url || null);
        }
        if (supplementary_files !== undefined) {
          updates.push("supplementary_files = ?");
          values.push(JSON.stringify(Array.isArray(supplementary_files) ? supplementary_files : []));
        }
        if (is_preview !== undefined) {
          updates.push("is_preview = ?");
          values.push(is_preview ? 1 : 0);
        }

        if (updates.length > 0) {
          updates.push("updated_at = ?");
          values.push(now);
          values.push(lesson_id);
          values.push(courseId);
          db.prepare(`UPDATE lessons SET ${updates.join(", ")} WHERE id = ? AND course_id = ?`).run(...values);
        }

        const updatedLesson = db.prepare("SELECT * FROM lessons WHERE id = ?").get(lesson_id) as any;
        if (updatedLesson && typeof updatedLesson.supplementary_files === "string") {
          try {
            updatedLesson.supplementary_files = JSON.parse(updatedLesson.supplementary_files);
          } catch {
            updatedLesson.supplementary_files = [];
          }
        }

        return NextResponse.json({ success: true, lesson: updatedLesson });
      }
    } else {
      const supabase = getSupabaseAdminClient();
      if (!supabase) throw new Error("Supabase client not available");

      if (action === "UPDATE_WEEK") {
        const { week_id, title, description } = body;
        const updates: any = { updated_at: now };
        if (title !== undefined) updates.title = title.trim();
        if (description !== undefined) updates.description = description.trim();

        const { data: updatedWeek, error } = await supabase
          .from("weeks")
          .update(updates)
          .eq("id", week_id)
          .eq("course_id", courseId)
          .select()
          .single();

        if (error) throw error;
        return NextResponse.json({ success: true, week: updatedWeek });
      }

      if (action === "REORDER_LESSONS") {
        const { week_id, lesson_ids } = body;
        for (let i = 0; i < lesson_ids.length; i++) {
          await supabase.from("lessons").update({ order_index: i + 1, updated_at: now }).eq("id", lesson_ids[i]).eq("week_id", week_id);
        }
        const { data: reorderedLessons } = await supabase
          .from("lessons")
          .select("*")
          .eq("week_id", week_id)
          .order("order_index", { ascending: true });

        return NextResponse.json({ success: true, week_id, lessons: reorderedLessons || [] });
      }

      if (action === "UPDATE_LESSON") {
        const { lesson_id, title, duration_seconds, video_url, supplementary_files, is_preview } = body;
        const updates: any = { updated_at: now };
        if (title !== undefined) updates.title = title.trim();
        if (duration_seconds !== undefined) updates.duration_seconds = Math.max(0, Number(duration_seconds) || 0);
        if (video_url !== undefined) updates.video_url = video_url || null;
        if (supplementary_files !== undefined) updates.supplementary_files = Array.isArray(supplementary_files) ? supplementary_files : [];
        if (is_preview !== undefined) updates.is_preview = Boolean(is_preview);

        const { data: updatedLesson, error } = await supabase
          .from("lessons")
          .update(updates)
          .eq("id", lesson_id)
          .eq("course_id", courseId)
          .select()
          .single();

        if (error) throw error;
        return NextResponse.json({ success: true, lesson: updatedLesson });
      }
    }

    return NextResponse.json({ success: false, error: `Invalid action: ${action}` }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update week or lesson" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser(request);
    if (currentUser.role === "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE", code: 403 },
        { status: 403 }
      );
    }
    const { id: courseId } = await params;

    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const action = body.action || url.searchParams.get("action");
    const weekId = body.week_id || url.searchParams.get("week_id");
    const lessonId = body.lesson_id || url.searchParams.get("lesson_id");
    const now = new Date().toISOString();

    if (dbAdapter.isOffline) {
      initDb();
      const db = getDb();

      // DELETE LESSON
      if (action === "DELETE_LESSON" || lessonId) {
        const targetLessonId = lessonId || body.lesson_id;
        const lesson = db.prepare("SELECT * FROM lessons WHERE id = ? AND course_id = ?").get(targetLessonId, courseId) as any;
        if (!lesson) {
          return NextResponse.json({ success: false, error: "Lesson not found" }, { status: 404 });
        }

        db.prepare("DELETE FROM lessons WHERE id = ?").run(targetLessonId);

        const remainingLessons = db
          .prepare("SELECT id FROM lessons WHERE week_id = ? ORDER BY order_index ASC")
          .all(lesson.week_id) as any[];

        const updateOrder = db.prepare("UPDATE lessons SET order_index = ?, updated_at = ? WHERE id = ?");
        for (let i = 0; i < remainingLessons.length; i++) {
          updateOrder.run(i + 1, now, remainingLessons[i].id);
        }

        return NextResponse.json({
          success: true,
          message: `Lesson ${targetLessonId} deleted successfully`,
        });
      }

      // DELETE WEEK
      if (action === "DELETE_WEEK" || weekId) {
        const targetWeekId = weekId || body.week_id;
        const week = db.prepare("SELECT * FROM weeks WHERE id = ? AND course_id = ?").get(targetWeekId, courseId) as any;
        if (!week) {
          return NextResponse.json({ success: false, error: "Week not found" }, { status: 404 });
        }

        db.prepare("DELETE FROM weeks WHERE id = ?").run(targetWeekId);

        const remainingWeeks = db
          .prepare("SELECT id FROM weeks WHERE course_id = ? ORDER BY week_number ASC")
          .all(courseId) as any[];

        const updateWeekNum = db.prepare("UPDATE weeks SET week_number = ?, updated_at = ? WHERE id = ?");
        for (let i = 0; i < remainingWeeks.length; i++) {
          updateWeekNum.run(i + 1, now, remainingWeeks[i].id);
        }

        const newTotal = remainingWeeks.length;
        db.prepare("UPDATE courses SET total_weeks = ?, updated_at = ? WHERE id = ?").run(
          Math.max(1, newTotal),
          now,
          courseId
        );

        return NextResponse.json({
          success: true,
          message: `Week ${targetWeekId} deleted and weeks re-sequenced`,
          total_weeks: Math.max(1, newTotal),
        });
      }
    } else {
      const supabase = getSupabaseAdminClient();
      if (!supabase) throw new Error("Supabase client not available");

      if (action === "DELETE_LESSON" || lessonId) {
        const targetLessonId = lessonId || body.lesson_id;
        await supabase.from("lessons").delete().eq("id", targetLessonId);
        return NextResponse.json({
          success: true,
          message: `Lesson ${targetLessonId} deleted successfully`,
        });
      }

      if (action === "DELETE_WEEK" || weekId) {
        const targetWeekId = weekId || body.week_id;
        await supabase.from("weeks").delete().eq("id", targetWeekId);
        const { count } = await supabase.from("weeks").select("id", { count: "exact", head: true }).eq("course_id", courseId);
        const newTotal = count || 1;
        await supabase.from("courses").update({ total_weeks: newTotal, updated_at: now }).eq("id", courseId);

        return NextResponse.json({
          success: true,
          message: `Week ${targetWeekId} deleted and weeks re-sequenced`,
          total_weeks: newTotal,
        });
      }
    }

    return NextResponse.json(
      { success: false, error: "Specify week_id or lesson_id to delete" },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete curriculum item" },
      { status: 500 }
    );
  }
}
