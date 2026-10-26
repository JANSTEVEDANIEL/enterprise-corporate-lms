import { getDb, initDb } from "@/lib/db";
import { getSupabaseServerClient } from "./server";
import { randomUUID } from "node:crypto";
import { generateCertificate } from "@/lib/certificates";

export function isOfflineMode(): boolean {
  if (process.env.LMS_FORCE_OFFLINE === "true") return true;
  if (process.env.NODE_ENV === "test") return true;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return true;
  return false;
}

export interface UnifiedDbAdapter {
  isOffline: boolean;
  getCourses(): Promise<any[]>;
  getCourseById(id: string): Promise<any | null>;
  getCourseBySlug(slug: string): Promise<any | null>;
  isUserEnrolled(userId: string, courseId: string): Promise<boolean>;
  getCurriculum(courseId: string): Promise<any[]>;
  getLesson(lessonId: string): Promise<any | null>;
  getWallet(userId: string): Promise<any | null>;
  recordTransaction(tx: any): Promise<any>;
  getPayouts(creatorId?: string): Promise<any[]>;
  createPayoutRequest(creatorId: string, amountCents: number, notes?: string): Promise<any>;
  getEnrolledCourses(userId: string): Promise<any[]>;
  getCourseWithFullCurriculum(courseId: string, userId?: string): Promise<any | null>;
  updateLessonProgress(
    userId: string,
    lessonId: string,
    courseId: string,
    status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED",
    lastPositionSeconds?: number
  ): Promise<any>;
  getCertificatesForUser(userId: string): Promise<any[]>;
  mintCertificateForCourse(userId: string, courseId: string): Promise<any>;
}

export class DbAdapter implements UnifiedDbAdapter {
  get isOffline(): boolean {
    return isOfflineMode();
  }

  async getCourses(): Promise<any[]> {
    if (this.isOffline) {
      initDb();
      const db = getDb();
      const courses = db
        .prepare(`
          SELECT c.*, 
                 COALESCE(u.name, 'Dr. Aris Thorne') as creator_name,
                 (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) as enrolled_count
          FROM courses c
          LEFT JOIN users u ON c.creator_id = u.id
          WHERE c.is_published = 1
          ORDER BY c.created_at DESC
        `)
        .all() as any[];

      return courses.map((c) => ({
        ...c,
        price_dollars: c.price_cents ? Number((c.price_cents / 100).toFixed(2)) : (c.price || 0),
        rating: 4.9,
      }));
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) return [];
    const { data } = await supabase.from("courses").select("*").eq("is_published", true);
    return data || [];
  }

  async getCourseById(id: string): Promise<any | null> {
    if (this.isOffline) {
      initDb();
      const db = getDb();
      const course = db
        .prepare(`
          SELECT c.*, 
                 COALESCE(u.name, 'Dr. Aris Thorne') as creator_name,
                 (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) as enrolled_count
          FROM courses c
          LEFT JOIN users u ON c.creator_id = u.id
          WHERE c.id = ?
        `)
        .get(id) as any;
      if (!course) return null;
      return {
        ...course,
        price_dollars: course.price_cents ? Number((course.price_cents / 100).toFixed(2)) : (course.price || 0),
        rating: 4.9,
      };
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) return null;
    const { data } = await supabase.from("courses").select("*").eq("id", id).maybeSingle();
    return data || null;
  }

  async getCourseBySlug(slug: string): Promise<any | null> {
    if (this.isOffline) {
      initDb();
      const db = getDb();
      const course = db
        .prepare(`
          SELECT c.*, 
                 COALESCE(u.name, 'Dr. Aris Thorne') as creator_name,
                 (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) as enrolled_count
          FROM courses c
          LEFT JOIN users u ON c.creator_id = u.id
          WHERE c.slug = ?
        `)
        .get(slug) as any;
      if (!course) return null;
      return {
        ...course,
        price_dollars: course.price_cents ? Number((course.price_cents / 100).toFixed(2)) : (course.price || 0),
        rating: 4.9,
      };
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) return null;
    const { data } = await supabase.from("courses").select("*").eq("slug", slug).maybeSingle();
    return data || null;
  }

  async isUserEnrolled(userId: string, courseId: string): Promise<boolean> {
    if (this.isOffline) {
      initDb();
      const db = getDb();
      const enr = db
        .prepare("SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?")
        .get(userId, courseId);
      return !!enr;
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) return false;
    const { data } = await supabase
      .from("enrollments")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle();
    return !!data;
  }

  async getCurriculum(courseId: string): Promise<any[]> {
    if (this.isOffline) {
      initDb();
      const db = getDb();
      const weeks = db.prepare("SELECT * FROM weeks WHERE course_id = ? ORDER BY week_number ASC").all(courseId) as any[];
      for (const week of weeks) {
        week.lessons = db.prepare("SELECT * FROM lessons WHERE week_id = ? ORDER BY order_index ASC").all(week.id);
        for (const l of week.lessons) {
          if (typeof l.supplementary_files === "string") {
            try {
              l.supplementary_files = JSON.parse(l.supplementary_files);
            } catch {
              l.supplementary_files = [];
            }
          }
        }
        try {
          const quiz = db.prepare("SELECT * FROM week_quizzes WHERE week_id = ?").get(week.id) as any;
          if (quiz) {
            if (typeof quiz.questions === "string") {
              try {
                quiz.questions = JSON.parse(quiz.questions);
              } catch {
                quiz.questions = [];
              }
            }
            week.quiz = quiz;
          } else {
            week.quiz = null;
          }
        } catch {
          week.quiz = null;
        }
      }
      return weeks;
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) return [];
    const { data } = await supabase
      .from("weeks")
      .select("*, lessons(*)")
      .eq("course_id", courseId)
      .order("week_number", { ascending: true });
    return data || [];
  }

  async getLesson(lessonId: string): Promise<any | null> {
    if (this.isOffline) {
      initDb();
      const db = getDb();
      const lesson = db.prepare("SELECT * FROM lessons WHERE id = ?").get(lessonId) as any;
      if (lesson && typeof lesson.supplementary_files === "string") {
        try {
          lesson.supplementary_files = JSON.parse(lesson.supplementary_files);
        } catch {
          lesson.supplementary_files = [];
        }
      }
      return lesson || null;
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) return null;
    const { data } = await supabase.from("lessons").select("*").eq("id", lessonId).maybeSingle();
    return data || null;
  }

  async getWallet(userId: string): Promise<any | null> {
    if (this.isOffline) {
      initDb();
      const db = getDb();
      let wallet = db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(userId) as any;
      if (!wallet) {
        // Auto-provision initial $500 simulated wallet (50000 cents)
        const now = new Date().toISOString();
        const id = `wal_${userId}`;
        db.prepare(
          "INSERT INTO wallets (id, user_id, balance, balance_cents, currency, created_at, updated_at) VALUES (?, ?, 50000, 50000, 'USD', ?, ?)"
        ).run(id, userId, now, now);
        wallet = db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(userId);
      }

      if (wallet) {
        return {
          ...wallet,
          balance_cents: wallet.balance_cents ?? wallet.balance ?? 0,
          balance_dollars: Number(((wallet.balance_cents ?? wallet.balance ?? 0) / 100).toFixed(2)),
        };
      }
      return wallet;
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) return null;
    const { data, error } = await supabase.from("wallets").select("*").eq("user_id", userId).maybeSingle();
    if (!data && !error) {
      // Auto-provision in Supabase
      const { data: newWallet } = await supabase
        .from("wallets")
        .insert({
          user_id: userId,
          balance: 50000,
          balance_cents: 50000,
          currency: "USD",
        })
        .select()
        .single();
      return newWallet;
    }
    return data || null;
  }

  async recordTransaction(tx: any): Promise<any> {
    const amount = tx.amount_cents ?? tx.amount ?? 0;
    const platformFee = tx.platform_fee_cents ?? tx.platform_fee ?? Math.round(amount * 0.1);
    const creatorEarnings = tx.creator_payout_cents ?? tx.creator_earnings ?? (amount - platformFee);
    const id = tx.id || `tx_${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    if (this.isOffline) {
      initDb();
      const db = getDb();
      db.prepare(`
        INSERT INTO transactions (
          id, course_id, student_id, creator_id,
          amount, amount_cents,
          platform_fee, platform_fee_cents,
          creator_earnings, creator_payout_cents,
          currency, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        tx.course_id,
        tx.student_id,
        tx.creator_id,
        amount,
        amount,
        platformFee,
        platformFee,
        creatorEarnings,
        creatorEarnings,
        tx.currency || "USD",
        tx.status || "COMPLETED",
        now
      );

      // Debit student wallet
      db.prepare("UPDATE wallets SET balance = balance - ?, balance_cents = balance_cents - ?, updated_at = ? WHERE user_id = ?").run(
        amount,
        amount,
        now,
        tx.student_id
      );

      // Credit creator wallet
      db.prepare(`
        INSERT INTO wallets (id, user_id, balance, balance_cents, currency, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'USD', ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET 
          balance = balance + excluded.balance,
          balance_cents = balance_cents + excluded.balance_cents,
          updated_at = excluded.updated_at
      `).run(`wal_${tx.creator_id}`, tx.creator_id, creatorEarnings, creatorEarnings, now, now);

      return {
        id,
        course_id: tx.course_id,
        student_id: tx.student_id,
        creator_id: tx.creator_id,
        amount,
        amount_cents: amount,
        platform_fee: platformFee,
        platform_fee_cents: platformFee,
        creator_earnings: creatorEarnings,
        creator_payout_cents: creatorEarnings,
        currency: tx.currency || "USD",
        status: tx.status || "COMPLETED",
        created_at: now,
      };
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) return null;
    const { data } = await supabase.from("transactions").insert({
      id,
      course_id: tx.course_id,
      student_id: tx.student_id,
      creator_id: tx.creator_id,
      amount,
      amount_cents: amount,
      platform_fee: platformFee,
      platform_fee_cents: platformFee,
      creator_earnings: creatorEarnings,
      creator_payout_cents: creatorEarnings,
      currency: tx.currency || "USD",
      status: tx.status || "COMPLETED",
    }).select().single();
    return data;
  }

  async getPayouts(creatorId?: string): Promise<any[]> {
    if (this.isOffline) {
      initDb();
      const db = getDb();
      if (creatorId) {
        return db.prepare("SELECT * FROM payouts WHERE creator_id = ? ORDER BY requested_at DESC").all(creatorId);
      }
      return db.prepare("SELECT * FROM payouts ORDER BY requested_at DESC").all();
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) return [];
    let query = supabase.from("payouts").select("*").order("requested_at", { ascending: false });
    if (creatorId) {
      query = query.eq("creator_id", creatorId);
    }
    const { data } = await query;
    return data || [];
  }

  async createPayoutRequest(creatorId: string, amountCents: number, notes?: string): Promise<any> {
    const id = `po_${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    if (this.isOffline) {
      initDb();
      const db = getDb();
      // Ensure sufficient wallet balance
      const wallet = await this.getWallet(creatorId);
      const balance = wallet ? (wallet.balance_cents ?? wallet.balance ?? 0) : 0;
      if (balance < amountCents) {
        throw new Error("INSUFFICIENT_FUNDS");
      }

      // Deduct from wallet
      db.prepare("UPDATE wallets SET balance = balance - ?, balance_cents = balance_cents - ?, updated_at = ? WHERE user_id = ?").run(
        amountCents,
        amountCents,
        now,
        creatorId
      );

      // Insert payout
      db.prepare(`
        INSERT INTO payouts (id, creator_id, amount, amount_cents, status, requested_at, notes)
        VALUES (?, ?, ?, ?, 'PENDING', ?, ?)
      `).run(id, creatorId, amountCents, amountCents, now, notes || null);

      return {
        id,
        creator_id: creatorId,
        amount: amountCents,
        amount_cents: amountCents,
        status: "PENDING",
        requested_at: now,
        notes: notes || null,
      };
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) return null;
    const { data } = await supabase.from("payouts").insert({
      id,
      creator_id: creatorId,
      amount: amountCents,
      amount_cents: amountCents,
      status: "PENDING",
      notes: notes || null,
    }).select().single();
    return data;
  }

  async getEnrolledCourses(userId: string): Promise<any[]> {
    if (this.isOffline) {
      initDb();
      const db = getDb();
      const enrollments = db
        .prepare(`
          SELECT e.*, c.title, c.slug, c.description, c.category, c.thumbnail_url, c.total_weeks,
                 COALESCE(u.name, 'Dr. Aris Thorne') as creator_name
          FROM enrollments e
          JOIN courses c ON e.course_id = c.id
          LEFT JOIN users u ON c.creator_id = u.id
          WHERE e.user_id = ?
          ORDER BY e.updated_at DESC
        `)
        .all(userId) as any[];

      const results = [];
      for (const enr of enrollments) {
        // Calculate total lessons in course
        const totalLessonsCount = (
          db.prepare(`
            SELECT COUNT(*) as count 
            FROM lessons l
            JOIN weeks w ON l.week_id = w.id
            WHERE w.course_id = ?
          `).get(enr.course_id) as any
        )?.count || 0;

        // Calculate completed lessons for this user
        const completedLessonsCount = (
          db.prepare(`
            SELECT COUNT(*) as count
            FROM lesson_progress
            WHERE user_id = ? AND course_id = ? AND status = 'COMPLETED'
          `).get(userId, enr.course_id) as any
        )?.count || 0;

        // Calculate progress percentage
        const progressPct = totalLessonsCount > 0
          ? Math.round((completedLessonsCount / totalLessonsCount) * 100)
          : (enr.progress_pct || 0);

        // Fetch certificate if exists
        const cert = db
          .prepare("SELECT * FROM certificates WHERE user_id = ? AND course_id = ?")
          .get(userId, enr.course_id) as any;

        // Find next or current lesson title
        const nextLesson = (
          db.prepare(`
            SELECT l.title 
            FROM lessons l
            JOIN weeks w ON l.week_id = w.id
            LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
            WHERE w.course_id = ? AND (lp.status IS NULL OR lp.status != 'COMPLETED')
            ORDER BY w.week_number ASC, l.order_index ASC
            LIMIT 1
          `).get(userId, enr.course_id) as any
        )?.title || (progressPct === 100 ? "Course Completed — Certificate Minted" : "Week 1: Introduction");

        results.push({
          ...enr,
          total_lessons: totalLessonsCount,
          completed_lessons: completedLessonsCount,
          progress_pct: progressPct,
          current_lesson: nextLesson,
          certificate: cert || null,
          certificateCode: cert?.certificate_code || null,
        });
      }
      return results;
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) return [];
    const { data } = await supabase
      .from("enrollments")
      .select("*, courses(*)")
      .eq("user_id", userId);
    return data || [];
  }

  async getCourseWithFullCurriculum(courseId: string, userId?: string): Promise<any | null> {
    const course = (await this.getCourseById(courseId)) || (await this.getCourseBySlug(courseId));
    if (!course) return null;

    if (this.isOffline) {
      initDb();
      const db = getDb();
      const weeks = db
        .prepare("SELECT * FROM weeks WHERE course_id = ? ORDER BY week_number ASC")
        .all(course.id) as any[];

      let totalLessons = 0;
      let completedLessons = 0;

      for (const week of weeks) {
        week.lessons = db
          .prepare("SELECT * FROM lessons WHERE week_id = ? ORDER BY order_index ASC")
          .all(week.id) as any[];

        for (const l of week.lessons) {
          totalLessons++;
          if (typeof l.supplementary_files === "string") {
            try {
              l.supplementary_files = JSON.parse(l.supplementary_files);
            } catch {
              l.supplementary_files = [];
            }
          }

          if (userId) {
            const prog = db
              .prepare("SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?")
              .get(userId, l.id) as any;
            if (prog) {
              l.progress_status = prog.status;
              l.last_position_seconds = prog.last_position_seconds;
              if (prog.status === "COMPLETED") completedLessons++;
            } else {
              l.progress_status = "NOT_STARTED";
              l.last_position_seconds = 0;
            }
          }
        }

        try {
          const quiz = db.prepare("SELECT * FROM week_quizzes WHERE week_id = ?").get(week.id) as any;
          if (quiz) {
            if (typeof quiz.questions === "string") {
              try {
                quiz.questions = JSON.parse(quiz.questions);
              } catch {
                quiz.questions = [];
              }
            }
            week.quiz = quiz;
          } else {
            week.quiz = null;
          }
        } catch {
          week.quiz = null;
        }
      }

      let enrollment = null;
      let certificate = null;
      if (userId) {
        enrollment = db.prepare("SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?").get(userId, course.id) as any;
        certificate = db.prepare("SELECT * FROM certificates WHERE user_id = ? AND course_id = ?").get(userId, course.id) as any;
      }

      const progressPct =
        totalLessons > 0
          ? Math.round((completedLessons / totalLessons) * 100)
          : (enrollment?.progress_pct || 0);

      return {
        course,
        weeks,
        totalLessons,
        completedLessons,
        progressPct,
        enrollment: enrollment || null,
        certificate: certificate || null,
      };
    }

    const weeks = await this.getCurriculum(course.id);
    return {
      course,
      weeks,
      totalLessons: 0,
      completedLessons: 0,
      progressPct: 0,
      enrollment: null,
      certificate: null,
    };
  }

  async updateLessonProgress(
    userId: string,
    lessonId: string,
    courseId: string,
    status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED",
    lastPositionSeconds: number = 0
  ): Promise<any> {
    if (this.isOffline) {
      initDb();
      const db = getDb();
      const now = new Date().toISOString();
      const id = `lp_${randomUUID().slice(0, 8)}`;
      const completedAt = status === "COMPLETED" ? now : null;

      // Upsert lesson_progress
      db.prepare(`
        INSERT INTO lesson_progress (
          id, user_id, lesson_id, course_id, status, completed_at, last_position_seconds, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, lesson_id) DO UPDATE SET
          status = excluded.status,
          completed_at = COALESCE(excluded.completed_at, lesson_progress.completed_at),
          last_position_seconds = excluded.last_position_seconds,
          updated_at = excluded.updated_at
      `).run(id, userId, lessonId, courseId, status, completedAt, lastPositionSeconds, now, now);

      // Count total lessons
      const totalLessons = (
        db.prepare(`
          SELECT COUNT(*) as count 
          FROM lessons l
          JOIN weeks w ON l.week_id = w.id
          WHERE w.course_id = ?
        `).get(courseId) as any
      )?.count || 1;

      // Count completed lessons
      const completedLessons = (
        db.prepare(`
          SELECT COUNT(*) as count
          FROM lesson_progress
          WHERE user_id = ? AND course_id = ? AND status = 'COMPLETED'
        `).get(userId, courseId) as any
      )?.count || 0;

      const progressPct = Math.round((completedLessons / totalLessons) * 100);
      const isCourseCompleted = progressPct === 100;

      // Update enrollment
      db.prepare(`
        UPDATE enrollments 
        SET progress_pct = ?,
            status = CASE WHEN ? = 1 THEN 'COMPLETED' ELSE 'IN_PROGRESS' END,
            completed_at = CASE WHEN ? = 1 THEN ? ELSE completed_at END,
            updated_at = ?
        WHERE user_id = ? AND course_id = ?
      `).run(
        progressPct,
        isCourseCompleted ? 1 : 0,
        isCourseCompleted ? 1 : 0,
        now,
        now,
        userId,
        courseId
      );

      // If 100% completed, auto-mint certificate if not already minted
      let certificate = db
        .prepare("SELECT * FROM certificates WHERE user_id = ? AND course_id = ?")
        .get(userId, courseId) as any;
      if (isCourseCompleted && !certificate) {
        try {
          const enrollment = db
            .prepare("SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?")
            .get(userId, courseId) as any;
          if (enrollment) {
            certificate = generateCertificate({
              userId,
              courseId,
              enrollmentId: enrollment.id,
              score: 100,
              codePrefix: "CERT-MKT",
              customDb: db,
            });
          }
        } catch (e) {
          console.error("Auto-mint certificate error:", e);
        }
      }

      return {
        lesson_id: lessonId,
        status,
        last_position_seconds: lastPositionSeconds,
        completed_lessons: completedLessons,
        total_lessons: totalLessons,
        progress_pct: progressPct,
        is_completed: isCourseCompleted,
        certificate: certificate || null,
      };
    }

    return null;
  }

  async getCertificatesForUser(userId: string): Promise<any[]> {
    if (this.isOffline) {
      initDb();
      const db = getDb();
      return db
        .prepare("SELECT * FROM certificates WHERE user_id = ? ORDER BY issued_at DESC")
        .all(userId) as any[];
    }
    const supabase = getSupabaseServerClient();
    if (!supabase) return [];
    const { data } = await supabase
      .from("certificates")
      .select("*")
      .eq("user_id", userId)
      .order("issued_at", { ascending: false });
    return data || [];
  }

  async mintCertificateForCourse(userId: string, courseId: string): Promise<any> {
    if (this.isOffline) {
      initDb();
      const db = getDb();
      const existing = db
        .prepare("SELECT * FROM certificates WHERE user_id = ? AND course_id = ?")
        .get(userId, courseId) as any;
      if (existing) return existing;

      const enrollment = db
        .prepare("SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?")
        .get(userId, courseId) as any;
      if (!enrollment) {
        throw new Error("USER_NOT_ENROLLED");
      }

      const totalLessons = (
        db.prepare(`
          SELECT COUNT(*) as count 
          FROM lessons l
          JOIN weeks w ON l.week_id = w.id
          WHERE w.course_id = ?
        `).get(courseId) as any
      )?.count || 1;

      const completedLessons = (
        db.prepare(`
          SELECT COUNT(*) as count
          FROM lesson_progress
          WHERE user_id = ? AND course_id = ? AND status = 'COMPLETED'
        `).get(userId, courseId) as any
      )?.count || 0;

      const is100 = totalLessons > 0 && completedLessons >= totalLessons;
      if (!is100 && (enrollment.progress_pct || 0) < 100) {
        throw new Error("COURSE_INCOMPLETE");
      }

      return generateCertificate({
        userId,
        courseId,
        enrollmentId: enrollment.id,
        score: 100,
        codePrefix: "CERT-MKT",
        customDb: db,
      });
    }

    return null;
  }
}

export const dbAdapter = new DbAdapter();
