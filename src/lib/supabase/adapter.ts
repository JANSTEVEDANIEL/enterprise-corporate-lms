import { getDb, initDb } from "@/lib/db";
import { getSupabaseAdminClient, getSupabaseServerClient } from "./server";
import { randomUUID, createHash } from "node:crypto";
import { generateCertificate } from "@/lib/certificates";
import { calculateRevenueSplitFromCents } from "@/lib/finance/split";
import { recordAuditEvent } from "@/lib/audit";
import type { SupabaseClient } from "@supabase/supabase-js";

export function isOfflineMode(): boolean {
  if (process.env.LMS_FORCE_OFFLINE === "true") return true;
  if (process.env.NODE_ENV === "test") return true;
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasKey = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  if (!hasUrl || !hasKey) return true;
  return false;
}

function getClient(): SupabaseClient | null {
  return getSupabaseAdminClient() || getSupabaseServerClient();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface UnifiedDbAdapter {
  isOffline: boolean;
  getCourses(filters?: {
    category?: string;
    search?: string;
    priceType?: "all" | "free" | "paid";
  }): Promise<any[]>;
  getCourseById(id: string): Promise<any | null>;
  getCourseBySlug(slug: string): Promise<any | null>;
  isUserEnrolled(userId: string, courseId: string): Promise<boolean>;
  getEnrolledCourseIds(userId: string): Promise<Set<string>>;
  getCurriculum(courseId: string): Promise<any[]>;
  getLesson(lessonId: string): Promise<any | null>;
  getWallet(userId: string): Promise<any | null>;
  recordTransaction(tx: any): Promise<any>;
  getTransactionsForUser(userId: string): Promise<any[]>;
  getPayouts(creatorId?: string): Promise<any[]>;
  createPayoutRequest(creatorId: string, amountCents: number, notes?: string): Promise<any>;
  processPayout(payoutId: string, status?: string): Promise<any>;
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
  getStudioCourses(creatorId: string): Promise<{ courses: any[]; analytics: any }>;
  createCourse(input: {
    title: string;
    description?: string;
    category?: string;
    price?: number;
    price_cents?: number;
    thumbnail_url?: string | null;
    total_weeks?: number;
    creator_id: string;
  }): Promise<any>;
  updateCourse(courseId: string, updates: any): Promise<any>;
  deleteCourse(courseId: string): Promise<boolean>;
  getAdminStats(): Promise<any>;
  executeCheckout(params: {
    studentId: string;
    courseId: string;
    buyerName?: string;
    buyerRole?: string;
  }): Promise<any>;
}

export class DbAdapter implements UnifiedDbAdapter {
  get isOffline(): boolean {
    return isOfflineMode();
  }

  async getCourses(filters?: {
    category?: string;
    search?: string;
    priceType?: "all" | "free" | "paid";
  }): Promise<any[]> {
    if (this.isOffline) {
      initDb();
      const db = getDb();
      let sql = `
        SELECT c.*, 
               COALESCE(u.name, 'Dr. Aris Thorne') as creator_name,
               (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) as enrolled_count
        FROM courses c
        LEFT JOIN users u ON c.creator_id = u.id
        WHERE c.is_published = 1
      `;
      const params: any[] = [];
      if (filters?.category && filters.category !== "ALL" && filters.category !== "All Categories") {
        sql += " AND UPPER(c.category) = UPPER(?)";
        params.push(filters.category);
      }
      if (filters?.priceType === "free") {
        sql += " AND c.price_cents = 0";
      } else if (filters?.priceType === "paid") {
        sql += " AND c.price_cents > 0";
      }
      if (filters?.search && filters.search.trim()) {
        const term = `%${filters.search.trim()}%`;
        sql += " AND (c.title LIKE ? OR c.description LIKE ? OR u.name LIKE ?)";
        params.push(term, term, term);
      }
      sql += " ORDER BY c.created_at DESC";
      const rows = db.prepare(sql).all(...params) as any[];
      return rows.map((c) => ({
        ...c,
        price_dollars: c.price_cents ? Number((c.price_cents / 100).toFixed(2)) : (c.price || 0),
        rating: 4.9,
      }));
    }

    const supabase = getClient();
    if (!supabase) return [];

    let query = supabase
      .from("courses")
      .select(`
        *,
        creator:users(name),
        enrollments(count)
      `)
      .eq("is_published", true);

    if (filters?.category && filters.category !== "ALL" && filters.category !== "All Categories") {
      query = query.ilike("category", filters.category);
    }
    if (filters?.priceType === "free") {
      query = query.eq("price_cents", 0);
    } else if (filters?.priceType === "paid") {
      query = query.gt("price_cents", 0);
    }
    if (filters?.search && filters.search.trim()) {
      const term = filters.search.trim();
      query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
    }

    query = query.order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error || !data) {
      console.error("Supabase getCourses error:", error);
      return [];
    }

    return data.map((c: any) => ({
      ...c,
      creator_name: c.creator?.name || "Dr. Aris Thorne",
      enrolled_count: c.enrollments?.[0]?.count ?? 0,
      price_dollars: c.price_cents ? Number((c.price_cents / 100).toFixed(2)) : (c.price || 0),
      rating: 4.9,
    }));
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

    const supabase = getClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("courses")
      .select(`
        *,
        creator:users(name),
        enrollments(count)
      `)
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return null;

    return {
      ...data,
      creator_name: data.creator?.name || "Dr. Aris Thorne",
      enrolled_count: data.enrollments?.[0]?.count ?? 0,
      price_dollars: data.price_cents ? Number((data.price_cents / 100).toFixed(2)) : (data.price || 0),
      rating: 4.9,
    };
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

    const supabase = getClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("courses")
      .select(`
        *,
        creator:users(name),
        enrollments(count)
      `)
      .eq("slug", slug)
      .maybeSingle();

    if (error || !data) return null;

    return {
      ...data,
      creator_name: data.creator?.name || "Dr. Aris Thorne",
      enrolled_count: data.enrollments?.[0]?.count ?? 0,
      price_dollars: data.price_cents ? Number((data.price_cents / 100).toFixed(2)) : (data.price || 0),
      rating: 4.9,
    };
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

    const supabase = getClient();
    if (!supabase) return false;
    const { data } = await supabase
      .from("enrollments")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle();
    return !!data;
  }

  async getEnrolledCourseIds(userId: string): Promise<Set<string>> {
    if (this.isOffline) {
      initDb();
      const db = getDb();
      const rows = db.prepare("SELECT course_id FROM enrollments WHERE user_id = ?").all(userId) as any[];
      return new Set(rows.map((r) => r.course_id));
    }

    const supabase = getClient();
    if (!supabase) return new Set();
    const { data } = await supabase.from("enrollments").select("course_id").eq("user_id", userId);
    return new Set((data || []).map((r: any) => r.course_id));
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

    const supabase = getClient();
    if (!supabase) return [];
    const [weeksRes, lessonsRes, quizzesRes] = await Promise.all([
      supabase.from("weeks").select("*").eq("course_id", courseId).order("week_number", { ascending: true }),
      supabase.from("lessons").select("*").eq("course_id", courseId).order("order_index", { ascending: true }),
      supabase.from("week_quizzes").select("*").eq("course_id", courseId),
    ]);

    const weeks = weeksRes.data || [];
    const lessons = lessonsRes.data || [];
    const quizzes = quizzesRes.data || [];

    const quizMap = new Map<string, any>();
    for (const q of quizzes) {
      quizMap.set(q.week_id, q);
    }

    return weeks.map((w: any) => {
      const weekLessons = lessons.filter((l: any) => l.week_id === w.id).map((l: any) => {
        let files = l.supplementary_files;
        if (typeof files === "string") {
          try { files = JSON.parse(files); } catch { files = []; }
        }
        return { ...l, supplementary_files: Array.isArray(files) ? files : [] };
      });

      const q = quizMap.get(w.id);
      let parsedQuiz = null;
      if (q) {
        let questions = q.questions;
        if (typeof questions === "string") {
          try { questions = JSON.parse(questions); } catch { questions = []; }
        }
        parsedQuiz = { ...q, questions: Array.isArray(questions) ? questions : [] };
      }

      return {
        ...w,
        lessons: weekLessons,
        quiz: parsedQuiz,
      };
    });
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

    const supabase = getClient();
    if (!supabase) return null;
    const { data } = await supabase.from("lessons").select("*").eq("id", lessonId).maybeSingle();
    if (data && typeof data.supplementary_files === "string") {
      try {
        data.supplementary_files = JSON.parse(data.supplementary_files);
      } catch {
        data.supplementary_files = [];
      }
    }
    return data || null;
  }

  async getWallet(userId: string): Promise<any | null> {
    if (this.isOffline) {
      initDb();
      const db = getDb();
      let wallet = db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(userId) as any;
      if (!wallet) {
        const now = new Date().toISOString();
        const id = `wal_${userId}`;
        db.prepare(
          "INSERT INTO wallets (id, user_id, balance, balance_cents, currency, created_at, updated_at) VALUES (?, ?, 50000, 50000, 'USD', ?, ?)"
        ).run(id, userId, now, now);
        wallet = db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(userId);
      }

      if (wallet) {
        const cents = wallet.balance_cents ?? wallet.balance ?? 50000;
        return {
          ...wallet,
          balance_cents: cents,
          balance_dollars: Number((cents / 100).toFixed(2)),
        };
      }
      return null;
    }

    const supabase = getClient();
    if (!supabase) return null;

    let { data: wallet, error } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!wallet && !error) {
      const walId = `wal_${userId}`;
      const now = new Date().toISOString();
      const { data: newWallet, error: insertError } = await supabase
        .from("wallets")
        .insert({
          id: walId,
          user_id: userId,
          balance: 50000,
          balance_cents: 50000,
          currency: "USD",
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (!insertError && newWallet) {
        wallet = newWallet;
      }
    }

    if (wallet) {
      const cents = wallet.balance_cents ?? wallet.balance ?? 50000;
      return {
        ...wallet,
        balance_cents: cents,
        balance_dollars: Number((cents / 100).toFixed(2)),
      };
    }

    return null;
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

    const supabase = getClient();
    if (!supabase) return null;

    const { data: txRecord, error: txError } = await supabase
      .from("transactions")
      .insert({
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
      })
      .select()
      .single();

    if (txError) {
      console.error("Supabase recordTransaction insert error:", txError);
    }

    // Debit student wallet
    const studentWallet = await this.getWallet(tx.student_id);
    if (studentWallet) {
      const updatedBalance = Math.max(0, studentWallet.balance_cents - amount);
      await supabase.from("wallets").update({
        balance: updatedBalance,
        balance_cents: updatedBalance,
        updated_at: now,
      }).eq("user_id", tx.student_id);
    }

    // Credit creator wallet
    const creatorWallet = await this.getWallet(tx.creator_id);
    if (creatorWallet) {
      const updatedBalance = creatorWallet.balance_cents + creatorEarnings;
      await supabase.from("wallets").update({
        balance: updatedBalance,
        balance_cents: updatedBalance,
        updated_at: now,
      }).eq("user_id", tx.creator_id);
    } else {
      await supabase.from("wallets").insert({
        id: `wal_${tx.creator_id}`,
        user_id: tx.creator_id,
        balance: creatorEarnings,
        balance_cents: creatorEarnings,
        currency: "USD",
        created_at: now,
        updated_at: now,
      });
    }

    // Credit super admin platform fee
    if (platformFee > 0) {
      const { data: adminUser } = await supabase
        .from("users")
        .select("id")
        .eq("role", "SUPER_ADMIN")
        .limit(1)
        .maybeSingle();
      const adminId = adminUser?.id || "usr_david_kim";
      const adminWallet = await this.getWallet(adminId);
      if (adminWallet) {
        const updatedBalance = adminWallet.balance_cents + platformFee;
        await supabase.from("wallets").update({
          balance: updatedBalance,
          balance_cents: updatedBalance,
          updated_at: now,
        }).eq("user_id", adminId);
      }
    }

    return txRecord || {
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

  async getTransactionsForUser(userId: string): Promise<any[]> {
    if (this.isOffline) {
      initDb();
      const db = getDb();
      const rows = db.prepare(`
        SELECT 
          t.id,
          t.course_id,
          COALESCE(c.title, 'Course Purchase') as course_title,
          COALESCE(t.amount_cents, t.amount, 0) as amount_cents,
          t.currency,
          t.status,
          t.created_at,
          'PURCHASE' as type
        FROM transactions t
        LEFT JOIN courses c ON t.course_id = c.id
        WHERE t.student_id = ?
        ORDER BY t.created_at DESC
      `).all(userId) as any[];

      return rows.map((r) => ({
        ...r,
        amount_dollars: Number((r.amount_cents / 100).toFixed(2)),
      }));
    }

    const supabase = getClient();
    if (!supabase) return [];
    const { data } = await supabase
      .from("transactions")
      .select("*, courses(title)")
      .eq("student_id", userId)
      .order("created_at", { ascending: false });

    return (data || []).map((t: any) => ({
      id: t.id,
      course_id: t.course_id,
      course_title: t.courses?.title || "Course Purchase",
      amount_cents: t.amount_cents ?? t.amount ?? 0,
      amount_dollars: Number(((t.amount_cents ?? t.amount ?? 0) / 100).toFixed(2)),
      currency: t.currency || "USD",
      status: t.status || "COMPLETED",
      type: "PURCHASE",
      created_at: t.created_at,
    }));
  }

  async getPayouts(creatorId?: string): Promise<any[]> {
    if (this.isOffline) {
      initDb();
      const db = getDb();
      let rows: any[];
      if (creatorId) {
        rows = db.prepare(`
          SELECT p.*, COALESCE(u.name, p.creator_id) as creator_name, u.email as creator_email
          FROM payouts p
          LEFT JOIN users u ON p.creator_id = u.id
          WHERE p.creator_id = ?
          ORDER BY p.requested_at DESC
        `).all(creatorId) as any[];
      } else {
        rows = db.prepare(`
          SELECT p.*, COALESCE(u.name, p.creator_id) as creator_name, u.email as creator_email
          FROM payouts p
          LEFT JOIN users u ON p.creator_id = u.id
          ORDER BY p.requested_at DESC
        `).all() as any[];
      }
      return rows.map((p) => ({
        ...p,
        amount_cents: p.amount_cents ?? p.amount ?? 0,
        amount_dollars: Number(((p.amount_cents ?? p.amount ?? 0) / 100).toFixed(2)),
      }));
    }

    const supabase = getClient();
    if (!supabase) return [];
    let query = supabase.from("payouts").select("*, creator:users(name, email)").order("requested_at", { ascending: false });
    if (creatorId) {
      query = query.eq("creator_id", creatorId);
    }
    const { data } = await query;
    return (data || []).map((p: any) => ({
      ...p,
      creator_name: p.creator?.name || p.creator_id,
      creator_email: p.creator?.email,
      amount_cents: p.amount_cents ?? p.amount ?? 0,
      amount_dollars: Number(((p.amount_cents ?? p.amount ?? 0) / 100).toFixed(2)),
    }));
  }

  async createPayoutRequest(creatorId: string, amountCents: number, notes?: string): Promise<any> {
    const id = `po_${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    if (this.isOffline) {
      initDb();
      const db = getDb();
      const wallet = await this.getWallet(creatorId);
      const balance = wallet ? (wallet.balance_cents ?? wallet.balance ?? 0) : 0;
      if (balance < amountCents) {
        throw new Error("INSUFFICIENT_FUNDS");
      }

      db.prepare("UPDATE wallets SET balance = balance - ?, balance_cents = balance_cents - ?, updated_at = ? WHERE user_id = ?").run(
        amountCents,
        amountCents,
        now,
        creatorId
      );

      db.prepare(`
        INSERT INTO payouts (id, creator_id, amount, amount_cents, status, requested_at, notes)
        VALUES (?, ?, ?, ?, 'PENDING', ?, ?)
      `).run(id, creatorId, amountCents, amountCents, now, notes || null);

      try {
        db.prepare(
          `INSERT INTO payout_requests (id, creator_id, amount, amount_cents, status, created_at, requested_at, processed_at, notes)
           VALUES (?, ?, ?, ?, 'PENDING', ?, ?, NULL, ?)`
        ).run(id, creatorId, amountCents, amountCents, now, now, notes || null);
      } catch {}

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

    const supabase = getClient();
    if (!supabase) return null;

    const wallet = await this.getWallet(creatorId);
    const currentBalance = wallet ? (wallet.balance_cents ?? 0) : 0;
    if (currentBalance < amountCents) {
      throw new Error("INSUFFICIENT_FUNDS");
    }

    const newBalance = currentBalance - amountCents;
    await supabase.from("wallets").update({
      balance: newBalance,
      balance_cents: newBalance,
      updated_at: now,
    }).eq("user_id", creatorId);

    const { data, error } = await supabase.from("payouts").insert({
      id,
      creator_id: creatorId,
      amount: amountCents,
      amount_cents: amountCents,
      status: "PENDING",
      requested_at: now,
      notes: notes || null,
    }).select().single();

    if (error) {
      console.error("Supabase createPayoutRequest error:", error);
      throw error;
    }
    return data;
  }

  async processPayout(payoutId: string, status: string = "PROCESSED"): Promise<any> {
    const now = new Date().toISOString();
    if (this.isOffline) {
      initDb();
      const db = getDb();
      db.prepare("UPDATE payouts SET status = ?, processed_at = ? WHERE id = ?").run(
        status,
        now,
        payoutId
      );
      try {
        db.prepare(
          "UPDATE payout_requests SET status = ?, processed_at = ? WHERE id = ?"
        ).run(status, now, payoutId);
      } catch {}

      const payout = db
        .prepare(`
          SELECT p.*, COALESCE(u.name, p.creator_id) as creator_name
          FROM payouts p
          LEFT JOIN users u ON p.creator_id = u.id
          WHERE p.id = ?
        `)
        .get(payoutId) as any;

      if (payout) {
        return {
          ...payout,
          amount_cents: payout.amount_cents ?? payout.amount ?? 0,
          amount_dollars: Number(((payout.amount_cents ?? payout.amount ?? 0) / 100).toFixed(2)),
          status,
          processed_at: now,
        };
      }
      return null;
    }

    const supabase = getClient();
    if (!supabase) return null;
    const { data } = await supabase
      .from("payouts")
      .update({ status, processed_at: now })
      .eq("id", payoutId)
      .select("*, creator:users(name)")
      .single();

    if (data) {
      return {
        ...data,
        creator_name: data.creator?.name || data.creator_id,
        amount_cents: data.amount_cents ?? data.amount ?? 0,
        amount_dollars: Number(((data.amount_cents ?? data.amount ?? 0) / 100).toFixed(2)),
      };
    }
    return null;
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
        const totalLessonsCount = (
          db.prepare(`
            SELECT COUNT(*) as count 
            FROM lessons l
            JOIN weeks w ON l.week_id = w.id
            WHERE w.course_id = ?
          `).get(enr.course_id) as any
        )?.count || 0;

        const completedLessonsCount = (
          db.prepare(`
            SELECT COUNT(*) as count
            FROM lesson_progress
            WHERE user_id = ? AND course_id = ? AND status = 'COMPLETED'
          `).get(userId, enr.course_id) as any
        )?.count || 0;

        const progressPct = totalLessonsCount > 0
          ? Math.round((completedLessonsCount / totalLessonsCount) * 100)
          : (enr.progress_pct || 0);

        const cert = db
          .prepare("SELECT * FROM certificates WHERE user_id = ? AND course_id = ?")
          .get(userId, enr.course_id) as any;

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

    const supabase = getClient();
    if (!supabase) return [];

    const { data: enrollments, error } = await supabase
      .from("enrollments")
      .select(`
        *,
        course:courses (
          id, slug, title, description, category, thumbnail_url, total_weeks,
          creator:users(name)
        )
      `)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error || !enrollments) return [];

    const results = [];
    for (const enr of enrollments) {
      const course = enr.course;
      if (!course) continue;

      const [lessonsCountRes, completedCountRes, certRes, lessonsRes] = await Promise.all([
        supabase.from("lessons").select("id", { count: "exact", head: true }).eq("course_id", enr.course_id),
        supabase.from("lesson_progress").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("course_id", enr.course_id).eq("status", "COMPLETED"),
        supabase.from("certificates").select("*").eq("user_id", userId).eq("course_id", enr.course_id).maybeSingle(),
        supabase.from("lessons").select("id, title, order_index, week_id").eq("course_id", enr.course_id).order("order_index", { ascending: true }),
      ]);

      const totalLessons = lessonsCountRes.count || 0;
      const completedLessons = completedCountRes.count || 0;
      const progressPct = totalLessons > 0
        ? Math.round((completedLessons / totalLessons) * 100)
        : (enr.progress_pct || 0);

      const cert = certRes.data || null;
      const nextLessonTitle = progressPct === 100
        ? "Course Completed — Certificate Minted"
        : (lessonsRes.data?.[0]?.title || "Week 1: Introduction");

      results.push({
        ...enr,
        title: course.title,
        slug: course.slug,
        description: course.description,
        category: course.category,
        thumbnail_url: course.thumbnail_url,
        total_weeks: course.total_weeks,
        creator_name: course.creator?.name || "Dr. Aris Thorne",
        total_lessons: totalLessons,
        completed_lessons: completedLessons,
        progress_pct: progressPct,
        current_lesson: nextLessonTitle,
        certificate: cert,
        certificateCode: cert?.certificate_code || null,
      });
    }
    return results;
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

    const supabase = getClient();
    if (!supabase) return null;

    const [weeksRes, lessonsRes, quizzesRes, progressRes, enrollmentRes, certRes] = await Promise.all([
      supabase.from("weeks").select("*").eq("course_id", course.id).order("week_number", { ascending: true }),
      supabase.from("lessons").select("*").eq("course_id", course.id).order("order_index", { ascending: true }),
      supabase.from("week_quizzes").select("*").eq("course_id", course.id),
      userId
        ? supabase.from("lesson_progress").select("*").eq("course_id", course.id).eq("user_id", userId)
        : Promise.resolve({ data: [] }),
      userId
        ? supabase.from("enrollments").select("*").eq("course_id", course.id).eq("user_id", userId).maybeSingle()
        : Promise.resolve({ data: null }),
      userId
        ? supabase.from("certificates").select("*").eq("course_id", course.id).eq("user_id", userId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const rawWeeks = weeksRes.data || [];
    const rawLessons = lessonsRes.data || [];
    const rawQuizzes = quizzesRes.data || [];
    const rawProgress = (progressRes as any).data || [];
    const enrollment = (enrollmentRes as any).data || null;
    const certificate = (certRes as any).data || null;

    const progressMap = new Map<string, any>();
    for (const p of rawProgress) {
      progressMap.set(p.lesson_id, p);
    }

    const quizMap = new Map<string, any>();
    for (const q of rawQuizzes) {
      quizMap.set(q.week_id, q);
    }

    let totalLessons = 0;
    let completedLessons = 0;

    const weeks = rawWeeks.map((week: any) => {
      const weekLessons = rawLessons
        .filter((l: any) => l.week_id === week.id)
        .map((l: any) => {
          totalLessons++;
          let files = l.supplementary_files;
          if (typeof files === "string") {
            try { files = JSON.parse(files); } catch { files = []; }
          }
          l.supplementary_files = Array.isArray(files) ? files : [];

          if (userId) {
            const prog = progressMap.get(l.id);
            if (prog) {
              l.progress_status = prog.status;
              l.last_position_seconds = prog.last_position_seconds || 0;
              if (prog.status === "COMPLETED") completedLessons++;
            } else {
              l.progress_status = "NOT_STARTED";
              l.last_position_seconds = 0;
            }
          }
          return l;
        });

      const quiz = quizMap.get(week.id);
      let parsedQuiz = null;
      if (quiz) {
        let questions = quiz.questions;
        if (typeof questions === "string") {
          try { questions = JSON.parse(questions); } catch { questions = []; }
        }
        parsedQuiz = { ...quiz, questions: Array.isArray(questions) ? questions : [] };
      }

      return {
        ...week,
        lessons: weekLessons,
        quiz: parsedQuiz,
      };
    });

    const progressPct = totalLessons > 0
      ? Math.round((completedLessons / totalLessons) * 100)
      : (enrollment?.progress_pct || 0);

    return {
      course,
      weeks,
      totalLessons,
      completedLessons,
      progressPct,
      enrollment,
      certificate,
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

      const progressPct = Math.round((completedLessons / totalLessons) * 100);
      const isCourseCompleted = progressPct === 100;

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

    const supabase = getClient();
    if (!supabase) return null;
    const now = new Date().toISOString();
    const completedAt = status === "COMPLETED" ? now : null;

    const { data: existingProg } = await supabase
      .from("lesson_progress")
      .select("id, completed_at")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId)
      .maybeSingle();

    if (existingProg) {
      await supabase.from("lesson_progress").update({
        status,
        completed_at: completedAt || existingProg.completed_at,
        last_position_seconds: lastPositionSeconds || 0,
        updated_at: now,
      }).eq("id", existingProg.id);
    } else {
      const id = `lp_${randomUUID().slice(0, 8)}`;
      await supabase.from("lesson_progress").insert({
        id,
        user_id: userId,
        lesson_id: lessonId,
        course_id: courseId,
        status,
        completed_at: completedAt,
        last_position_seconds: lastPositionSeconds || 0,
        created_at: now,
        updated_at: now,
      });
    }

    const [{ count: totalLessonsCount }, { count: completedLessonsCount }] = await Promise.all([
      supabase.from("lessons").select("id", { count: "exact", head: true }).eq("course_id", courseId),
      supabase.from("lesson_progress").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("course_id", courseId).eq("status", "COMPLETED"),
    ]);

    const totalLessons = totalLessonsCount || 1;
    const completedLessons = completedLessonsCount || 0;
    const progressPct = Math.round((completedLessons / totalLessons) * 100);
    const isCourseCompleted = progressPct === 100;

    await supabase.from("enrollments").update({
      progress_pct: progressPct,
      status: isCourseCompleted ? "COMPLETED" : "IN_PROGRESS",
      completed_at: isCourseCompleted ? now : null,
      updated_at: now,
    }).eq("user_id", userId).eq("course_id", courseId);

    let certificate = null;
    const { data: existingCert } = await supabase
      .from("certificates")
      .select("*")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (existingCert) {
      certificate = existingCert;
    } else if (isCourseCompleted) {
      try {
        certificate = await this.mintCertificateForCourse(userId, courseId);
      } catch (certErr) {
        console.error("Auto-mint certificate error:", certErr);
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
      certificate,
    };
  }

  async getCertificatesForUser(userId: string): Promise<any[]> {
    if (this.isOffline) {
      initDb();
      const db = getDb();
      return db
        .prepare("SELECT * FROM certificates WHERE user_id = ? ORDER BY issued_at DESC")
        .all(userId) as any[];
    }
    const supabase = getClient();
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

    const supabase = getClient();
    if (!supabase) return null;

    const { data: existing } = await supabase
      .from("certificates")
      .select("*")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (existing) return existing;

    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("*")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (!enrollment) {
      throw new Error("USER_NOT_ENROLLED");
    }

    const [{ count: totalLessonsCount }, { count: completedLessonsCount }] = await Promise.all([
      supabase.from("lessons").select("id", { count: "exact", head: true }).eq("course_id", courseId),
      supabase.from("lesson_progress").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("course_id", courseId).eq("status", "COMPLETED"),
    ]);

    const totalLessons = totalLessonsCount || 1;
    const completedLessons = completedLessonsCount || 0;
    const is100 = totalLessons > 0 && completedLessons >= totalLessons;

    if (!is100 && (enrollment.progress_pct || 0) < 100) {
      throw new Error("COURSE_INCOMPLETE");
    }

    const [userRes, courseRes] = await Promise.all([
      supabase.from("users").select("name, email").eq("id", userId).single(),
      supabase.from("courses").select("title, category, version").eq("id", courseId).single(),
    ]);

    const user = userRes.data;
    const course = courseRes.data;

    const year = new Date().getFullYear();
    const randomSerial = Math.floor(10000 + Math.random() * 90000);
    const certificateCode = `CERT-MKT-${year}-${randomSerial}`;
    const certId = `cert_${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    const verificationHash = createHash("sha256")
      .update(`${certificateCode}|${userId}|${courseId}|${enrollment.id}|${now}|100`)
      .digest("hex");

    const certData = {
      id: certId,
      certificate_code: certificateCode,
      user_id: userId,
      course_id: courseId,
      enrollment_id: enrollment.id,
      course_title: course?.title || "Marketplace Course",
      student_name: user?.name || "Student",
      verification_badge_url: `/api/certificates/${certId}/badge`,
      issued_at: now,
      verification_hash: verificationHash,
      created_at: now,
    };

    const { data: insertedCert, error: insertErr } = await supabase
      .from("certificates")
      .insert(certData)
      .select()
      .single();

    if (insertErr) {
      console.error("Supabase mintCertificate error:", insertErr);
      throw insertErr;
    }
    return insertedCert;
  }

  async getStudioCourses(creatorId: string): Promise<{ courses: any[]; analytics: any }> {
    if (this.isOffline) {
      initDb();
      const db = getDb();
      let courses = db
        .prepare("SELECT * FROM courses WHERE creator_id = ? ORDER BY created_at DESC")
        .all(creatorId) as any[];

      if (courses.length === 0) {
        courses = db
          .prepare("SELECT * FROM courses WHERE creator_id IS NOT NULL ORDER BY created_at DESC")
          .all() as any[];
      }

      let totalGrossCents = 0;
      let totalPlatformFeeCents = 0;
      let totalNetCents = 0;
      const allEnrolledStudents = new Set<string>();

      const enhancedCourses = courses.map((course) => {
        const salesCount = (
          db.prepare("SELECT COUNT(*) as count FROM enrollments WHERE course_id = ?").get(course.id) as any
        )?.count ?? 0;

        const txStats = db
          .prepare(
            `SELECT 
              COALESCE(SUM(amount_cents), 0) as gross_cents,
              COALESCE(SUM(platform_fee_cents), 0) as platform_fee_cents,
              COALESCE(SUM(creator_payout_cents), 0) as net_cents
            FROM transactions 
            WHERE course_id = ? AND status = 'COMPLETED'`
          )
          .get(course.id) as any;

        const grossCents = txStats?.gross_cents ?? 0;
        const feeCents = txStats?.platform_fee_cents ?? Math.round(grossCents * 0.1);
        const netCents = txStats?.net_cents ?? (grossCents - feeCents);

        totalGrossCents += grossCents;
        totalPlatformFeeCents += feeCents;
        totalNetCents += netCents;

        const enrolledUsers = db
          .prepare("SELECT user_id FROM enrollments WHERE course_id = ?")
          .all(course.id) as any[];
        for (const e of enrolledUsers) {
          allEnrolledStudents.add(e.user_id);
        }

        const weeksCount = (
          db.prepare("SELECT COUNT(*) as count FROM weeks WHERE course_id = ?").get(course.id) as any
        )?.count ?? course.total_weeks ?? 1;

        return {
          ...course,
          price_dollars: Number((course.price_cents / 100).toFixed(2)),
          sales_count: salesCount,
          gross_revenue_cents: grossCents,
          gross_revenue_dollars: Number((grossCents / 100).toFixed(2)),
          platform_fee_cents: feeCents,
          platform_fee_dollars: Number((feeCents / 100).toFixed(2)),
          creator_earnings_cents: netCents,
          creator_earnings_dollars: Number((netCents / 100).toFixed(2)),
          total_weeks: Math.max(weeksCount, course.total_weeks ?? 1),
        };
      });

      const wallet = db.prepare("SELECT balance_cents FROM wallets WHERE user_id = ?").get(creatorId) as any;
      const walletBalanceCents = wallet?.balance_cents ?? 0;

      return {
        courses: enhancedCourses,
        analytics: {
          total_gross_cents: totalGrossCents,
          total_gross_dollars: Number((totalGrossCents / 100).toFixed(2)),
          total_platform_fee_cents: totalPlatformFeeCents,
          total_platform_fee_dollars: Number((totalPlatformFeeCents / 100).toFixed(2)),
          total_net_cents: totalNetCents,
          total_net_dollars: Number((totalNetCents / 100).toFixed(2)),
          total_courses: enhancedCourses.length,
          total_enrolled_students: allEnrolledStudents.size,
          wallet_balance_cents: walletBalanceCents,
          wallet_balance_dollars: Number((walletBalanceCents / 100).toFixed(2)),
        },
      };
    }

    const supabase = getClient();
    if (!supabase) return { courses: [], analytics: {} };

    let { data: courses } = await supabase
      .from("courses")
      .select("*")
      .eq("creator_id", creatorId)
      .order("created_at", { ascending: false });

    if (!courses || courses.length === 0) {
      const { data: allCourses } = await supabase
        .from("courses")
        .select("*")
        .order("created_at", { ascending: false });
      courses = allCourses || [];
    }

    let totalGrossCents = 0;
    let totalPlatformFeeCents = 0;
    let totalNetCents = 0;
    const allEnrolledStudents = new Set<string>();

    const enhancedCourses = await Promise.all(
      courses.map(async (course: any) => {
        const [salesRes, txRes, enrolledRes, weeksRes] = await Promise.all([
          supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("course_id", course.id),
          supabase.from("transactions").select("amount_cents, platform_fee_cents, creator_payout_cents").eq("course_id", course.id).eq("status", "COMPLETED"),
          supabase.from("enrollments").select("user_id").eq("course_id", course.id),
          supabase.from("weeks").select("id", { count: "exact", head: true }).eq("course_id", course.id),
        ]);

        const salesCount = salesRes.count || 0;
        const txRows = txRes.data || [];
        let grossCents = 0;
        let feeCents = 0;
        let netCents = 0;

        for (const t of txRows) {
          grossCents += t.amount_cents || 0;
          feeCents += t.platform_fee_cents || 0;
          netCents += t.creator_payout_cents || 0;
        }

        totalGrossCents += grossCents;
        totalPlatformFeeCents += feeCents;
        totalNetCents += netCents;

        for (const e of enrolledRes.data || []) {
          allEnrolledStudents.add(e.user_id);
        }

        const weeksCount = weeksRes.count || course.total_weeks || 1;

        return {
          ...course,
          price_dollars: Number((course.price_cents / 100).toFixed(2)),
          sales_count: salesCount,
          gross_revenue_cents: grossCents,
          gross_revenue_dollars: Number((grossCents / 100).toFixed(2)),
          platform_fee_cents: feeCents,
          platform_fee_dollars: Number((feeCents / 100).toFixed(2)),
          creator_earnings_cents: netCents,
          creator_earnings_dollars: Number((netCents / 100).toFixed(2)),
          total_weeks: Math.max(weeksCount, course.total_weeks || 1),
        };
      })
    );

    const wallet = await this.getWallet(creatorId);
    const walletBalanceCents = wallet?.balance_cents || 0;

    return {
      courses: enhancedCourses,
      analytics: {
        total_gross_cents: totalGrossCents,
        total_gross_dollars: Number((totalGrossCents / 100).toFixed(2)),
        total_platform_fee_cents: totalPlatformFeeCents,
        total_platform_fee_dollars: Number((totalPlatformFeeCents / 100).toFixed(2)),
        total_net_cents: totalNetCents,
        total_net_dollars: Number((totalNetCents / 100).toFixed(2)),
        total_courses: enhancedCourses.length,
        total_enrolled_students: allEnrolledStudents.size,
        wallet_balance_cents: walletBalanceCents,
        wallet_balance_dollars: Number((walletBalanceCents / 100).toFixed(2)),
      },
    };
  }

  async createCourse(input: {
    title: string;
    description?: string;
    category?: string;
    price?: number;
    price_cents?: number;
    thumbnail_url?: string | null;
    total_weeks?: number;
    creator_id: string;
  }): Promise<any> {
    const calculatedPriceCents =
      input.price_cents !== undefined
        ? Math.max(0, Math.round(Number(input.price_cents)))
        : Math.max(0, Math.round(Number(input.price || 0) * 100));

    let sanitizedCategory = (input.category || "SOFTWARE").toUpperCase().trim();
    if (sanitizedCategory === "DEVELOPMENT") sanitizedCategory = "SOFTWARE";

    const courseId = `crs_${randomUUID().slice(0, 8)}`;
    const baseSlug = slugify(input.title);
    const now = new Date().toISOString();
    const weeksCount = Math.max(1, Math.min(52, Number(input.total_weeks) || 1));

    if (this.isOffline) {
      initDb();
      const db = getDb();
      let slug = baseSlug;
      let counter = 1;
      while (db.prepare("SELECT id FROM courses WHERE slug = ?").get(slug)) {
        slug = `${baseSlug}-${counter++}`;
      }

      db.prepare(
        `INSERT INTO courses (
          id, slug, title, description, category, target_role, is_mandatory,
          estimated_minutes, renewal_period_days, passing_score_pct, version,
          is_published, creator_id, price_cents, thumbnail_url, total_weeks,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, 'ALL', 0,
          ?, NULL, 80, '1.0.0',
          0, ?, ?, ?, ?,
          ?, ?
        )`
      ).run(
        courseId,
        slug,
        input.title.trim(),
        (input.description || "").trim(),
        sanitizedCategory,
        weeksCount * 60,
        input.creator_id,
        calculatedPriceCents,
        input.thumbnail_url || null,
        weeksCount,
        now,
        now
      );

      const insertWeek = db.prepare(
        `INSERT INTO weeks (id, course_id, week_number, title, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );

      for (let w = 1; w <= weeksCount; w++) {
        const weekId = `wk_${randomUUID().slice(0, 8)}`;
        const weekTitle =
          w === 1
            ? "Week 1: Core Architectural Foundations"
            : `Week ${w}: Module Milestone ${w}`;
        insertWeek.run(
          weekId,
          courseId,
          w,
          weekTitle,
          `Curriculum and milestones for week ${w}`,
          now,
          now
        );
      }

      const createdCourse = db.prepare("SELECT * FROM courses WHERE id = ?").get(courseId) as any;
      return {
        ...createdCourse,
        price_dollars: Number((createdCourse.price_cents / 100).toFixed(2)),
        sales_count: 0,
        gross_revenue_cents: 0,
        creator_earnings_cents: 0,
      };
    }

    const supabase = getClient();
    if (!supabase) return null;

    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const { data } = await supabase.from("courses").select("id").eq("slug", slug).maybeSingle();
      if (!data) break;
      slug = `${baseSlug}-${counter++}`;
    }

    const { data: createdCourse, error } = await supabase
      .from("courses")
      .insert({
        id: courseId,
        slug,
        title: input.title.trim(),
        description: (input.description || "").trim(),
        category: sanitizedCategory,
        target_role: "ALL",
        is_mandatory: false,
        estimated_minutes: weeksCount * 60,
        renewal_period_days: null,
        passing_score_pct: 80,
        version: "1.0.0",
        is_published: false,
        creator_id: input.creator_id,
        price_cents: calculatedPriceCents,
        thumbnail_url: input.thumbnail_url || null,
        total_weeks: weeksCount,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase createCourse error:", error);
      throw error;
    }

    const weeksPayload = [];
    for (let w = 1; w <= weeksCount; w++) {
      weeksPayload.push({
        id: `wk_${randomUUID().slice(0, 8)}`,
        course_id: courseId,
        week_number: w,
        title: w === 1 ? "Week 1: Core Architectural Foundations" : `Week ${w}: Module Milestone ${w}`,
        description: `Curriculum and milestones for week ${w}`,
        created_at: now,
        updated_at: now,
      });
    }

    await supabase.from("weeks").insert(weeksPayload);

    return {
      ...createdCourse,
      price_dollars: Number((createdCourse.price_cents / 100).toFixed(2)),
      sales_count: 0,
      gross_revenue_cents: 0,
      creator_earnings_cents: 0,
    };
  }

  async updateCourse(courseId: string, updates: any): Promise<any> {
    const now = new Date().toISOString();

    if (this.isOffline) {
      initDb();
      const db = getDb();
      const fields: string[] = [];
      const values: any[] = [];

      if (updates.title !== undefined) {
        fields.push("title = ?");
        values.push(updates.title.trim());
      }
      if (updates.description !== undefined) {
        fields.push("description = ?");
        values.push(String(updates.description).trim());
      }
      if (updates.category !== undefined) {
        let cat = String(updates.category).toUpperCase().trim();
        if (cat === "DEVELOPMENT") cat = "SOFTWARE";
        fields.push("category = ?");
        values.push(cat);
      }
      if (updates.price_cents !== undefined) {
        fields.push("price_cents = ?");
        values.push(Math.max(0, Math.round(Number(updates.price_cents))));
      } else if (updates.price !== undefined) {
        fields.push("price_cents = ?");
        values.push(Math.max(0, Math.round(Number(updates.price) * 100)));
      }
      if (updates.thumbnail_url !== undefined) {
        fields.push("thumbnail_url = ?");
        values.push(updates.thumbnail_url || null);
      }
      if (updates.is_published !== undefined) {
        fields.push("is_published = ?");
        values.push(updates.is_published ? 1 : 0);
      }
      if (updates.total_weeks !== undefined) {
        fields.push("total_weeks = ?");
        values.push(Math.max(1, Math.min(52, Number(updates.total_weeks) || 1)));
      }

      if (fields.length > 0) {
        fields.push("updated_at = ?");
        values.push(now);
        values.push(courseId);
        db.prepare(`UPDATE courses SET ${fields.join(", ")} WHERE id = ?`).run(...values);
      }

      const updated = db.prepare("SELECT * FROM courses WHERE id = ?").get(courseId) as any;
      return {
        ...updated,
        price_dollars: Number((updated.price_cents / 100).toFixed(2)),
      };
    }

    const supabase = getClient();
    if (!supabase) return null;

    const payload: any = { updated_at: now };
    if (updates.title !== undefined) payload.title = updates.title.trim();
    if (updates.description !== undefined) payload.description = String(updates.description).trim();
    if (updates.category !== undefined) {
      let cat = String(updates.category).toUpperCase().trim();
      if (cat === "DEVELOPMENT") cat = "SOFTWARE";
      payload.category = cat;
    }
    if (updates.price_cents !== undefined) payload.price_cents = Math.max(0, Math.round(Number(updates.price_cents)));
    else if (updates.price !== undefined) payload.price_cents = Math.max(0, Math.round(Number(updates.price) * 100));
    if (updates.thumbnail_url !== undefined) payload.thumbnail_url = updates.thumbnail_url || null;
    if (updates.is_published !== undefined) payload.is_published = Boolean(updates.is_published);
    if (updates.total_weeks !== undefined) payload.total_weeks = Math.max(1, Math.min(52, Number(updates.total_weeks) || 1));

    const { data, error } = await supabase
      .from("courses")
      .update(payload)
      .eq("id", courseId)
      .select()
      .single();

    if (error) {
      console.error("Supabase updateCourse error:", error);
      throw error;
    }

    return {
      ...data,
      price_dollars: Number((data.price_cents / 100).toFixed(2)),
    };
  }

  async deleteCourse(courseId: string): Promise<boolean> {
    if (this.isOffline) {
      initDb();
      const db = getDb();
      db.prepare("DELETE FROM courses WHERE id = ?").run(courseId);
      return true;
    }

    const supabase = getClient();
    if (!supabase) return false;
    const { error } = await supabase.from("courses").delete().eq("id", courseId);
    return !error;
  }

  async getAdminStats(): Promise<any> {
    if (this.isOffline) {
      initDb();
      const db = getDb();
      const txStats = db
        .prepare(`
          SELECT 
            COALESCE(SUM(amount_cents), 0) as gmv_cents,
            COALESCE(SUM(platform_fee_cents), 0) as platform_fee_cents,
            COALESCE(SUM(creator_payout_cents), 0) as creator_earnings_cents,
            COUNT(*) as completed_transactions
          FROM transactions 
          WHERE status = 'COMPLETED'
        `)
        .get() as any;

      const payoutStats = db
        .prepare(`
          SELECT 
            COALESCE(SUM(amount_cents), 0) as payouts_processed_cents,
            COUNT(*) as payouts_processed_count
          FROM payouts 
          WHERE status = 'PROCESSED'
        `)
        .get() as any;

      const userCount = (db.prepare("SELECT COUNT(*) as count FROM users").get() as any)?.count ?? 0;

      const gmvCents = txStats?.gmv_cents ?? 0;
      const platformFeeCents = txStats?.platform_fee_cents ?? 0;
      const payoutsProcessedCents = payoutStats?.payouts_processed_cents ?? 0;

      return {
        gmv_cents: gmvCents,
        gmv_dollars: Number((gmvCents / 100).toFixed(2)),
        platform_fee_cents: platformFeeCents,
        platform_fee_dollars: Number((platformFeeCents / 100).toFixed(2)),
        completed_transactions: txStats?.completed_transactions ?? 0,
        payouts_processed_cents: payoutsProcessedCents,
        payouts_processed_dollars: Number((payoutsProcessedCents / 100).toFixed(2)),
        payouts_processed_count: payoutStats?.payouts_processed_count ?? 0,
        total_users: userCount,
      };
    }

    const supabase = getClient();
    if (!supabase) return {};

    const [txRes, payoutRes, userCountRes] = await Promise.all([
      supabase.from("transactions").select("amount_cents, platform_fee_cents").eq("status", "COMPLETED"),
      supabase.from("payouts").select("amount_cents").eq("status", "PROCESSED"),
      supabase.from("users").select("id", { count: "exact", head: true }),
    ]);

    let gmvCents = 0;
    let platformFeeCents = 0;
    const completedTx = txRes.data?.length || 0;
    for (const tx of txRes.data || []) {
      gmvCents += tx.amount_cents || 0;
      platformFeeCents += tx.platform_fee_cents || 0;
    }

    let payoutsProcessedCents = 0;
    const payoutsProcessedCount = payoutRes.data?.length || 0;
    for (const po of payoutRes.data || []) {
      payoutsProcessedCents += po.amount_cents || 0;
    }

    const totalUsers = userCountRes.count || 0;

    return {
      gmv_cents: gmvCents,
      gmv_dollars: Number((gmvCents / 100).toFixed(2)),
      platform_fee_cents: platformFeeCents,
      platform_fee_dollars: Number((platformFeeCents / 100).toFixed(2)),
      completed_transactions: completedTx,
      payouts_processed_cents: payoutsProcessedCents,
      payouts_processed_dollars: Number((payoutsProcessedCents / 100).toFixed(2)),
      payouts_processed_count: payoutsProcessedCount,
      total_users: totalUsers,
    };
  }

  async executeCheckout(params: {
    studentId: string;
    courseId: string;
    buyerName?: string;
    buyerRole?: string;
  }): Promise<any> {
    const { studentId, courseId } = params;

    const course = (await this.getCourseById(courseId)) || (await this.getCourseBySlug(courseId));
    if (!course) {
      throw new Error("COURSE_NOT_FOUND");
    }

    const isPublished = Boolean(course.is_published);
    if (!isPublished) {
      throw new Error("COURSE_NOT_PUBLISHED");
    }

    const isEnrolled = await this.isUserEnrolled(studentId, course.id);
    if (isEnrolled) {
      throw new Error("ALREADY_ENROLLED");
    }

    const wallet = await this.getWallet(studentId);
    const balanceCents = wallet ? (wallet.balance_cents ?? 50000) : 50000;
    const priceCents = course.price_cents ?? 0;

    if (balanceCents < priceCents) {
      throw new Error("INSUFFICIENT_FUNDS");
    }

    const split = calculateRevenueSplitFromCents(priceCents);
    const transactionId = `tx_${randomUUID().slice(0, 8)}`;
    const enrollmentId = `enr_${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const creatorId = course.creator_id || "usr_aris_thorne";

    if (this.isOffline) {
      initDb();
      const db = getDb();
      const superAdmin = db.prepare("SELECT id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1").get() as any;
      const superAdminId = superAdmin?.id || "usr_david_kim";

      let txStarted = false;
      try {
        db.exec("BEGIN IMMEDIATE;");
        txStarted = true;
      } catch {}

      try {
        db.prepare(
          "UPDATE wallets SET balance = balance - ?, balance_cents = balance_cents - ?, updated_at = ? WHERE user_id = ?"
        ).run(priceCents, priceCents, now, studentId);

        db.prepare(`
          INSERT INTO wallets (id, user_id, balance, balance_cents, currency, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'USD', ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET 
            balance = balance + excluded.balance,
            balance_cents = balance_cents + excluded.balance_cents,
            updated_at = excluded.updated_at
        `).run(`wal_${creatorId}`, creatorId, split.creatorPayoutCents, split.creatorPayoutCents, now, now);

        if (split.platformFeeCents > 0) {
          db.prepare(`
            INSERT INTO wallets (id, user_id, balance, balance_cents, currency, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'USD', ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET 
              balance = balance + excluded.balance,
              balance_cents = balance_cents + excluded.balance_cents,
              updated_at = excluded.updated_at
          `).run(`wal_${superAdminId}`, superAdminId, split.platformFeeCents, split.platformFeeCents, now, now);
        }

        db.prepare(`
          INSERT INTO enrollments (
            id, user_id, course_id, status, progress_pct, assigned_by, assigned_at, due_date, completed_at, expires_at, created_at, updated_at
          ) VALUES (?, ?, ?, 'ACTIVE', 0, NULL, ?, NULL, NULL, NULL, ?, ?)
        `).run(enrollmentId, studentId, course.id, now, now, now);

        db.prepare(`
          INSERT INTO transactions (
            id, course_id, student_id, creator_id,
            amount, amount_cents,
            platform_fee, platform_fee_cents,
            creator_earnings, creator_payout_cents,
            currency, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'USD', 'COMPLETED', ?)
        `).run(
          transactionId,
          course.id,
          studentId,
          creatorId,
          split.amountCents,
          split.amountCents,
          split.platformFeeCents,
          split.platformFeeCents,
          split.creatorPayoutCents,
          split.creatorPayoutCents,
          now
        );

        if (txStarted) {
          db.exec("COMMIT;");
        }
      } catch (err) {
        if (txStarted) {
          try { db.exec("ROLLBACK;"); } catch {}
        }
        throw err;
      }
    } else {
      const supabase = getClient();
      if (!supabase) throw new Error("SUPABASE_NOT_INITIALIZED");

      // 1. Insert transaction
      await supabase.from("transactions").insert({
        id: transactionId,
        course_id: course.id,
        student_id: studentId,
        creator_id: creatorId,
        amount: split.amountCents,
        amount_cents: split.amountCents,
        platform_fee: split.platformFeeCents,
        platform_fee_cents: split.platformFeeCents,
        creator_earnings: split.creatorPayoutCents,
        creator_payout_cents: split.creatorPayoutCents,
        currency: "USD",
        status: "COMPLETED",
        created_at: now,
      });

      // 2. Insert enrollment
      await supabase.from("enrollments").insert({
        id: enrollmentId,
        user_id: studentId,
        course_id: course.id,
        status: "ACTIVE",
        progress_pct: 0,
        assigned_at: now,
        created_at: now,
        updated_at: now,
      });

      // 3. Debit student wallet
      const newBalanceCents = balanceCents - priceCents;
      await supabase.from("wallets").update({
        balance: newBalanceCents,
        balance_cents: newBalanceCents,
        updated_at: now,
      }).eq("user_id", studentId);

      // 4. Credit creator wallet
      const creatorWallet = await this.getWallet(creatorId);
      if (creatorWallet) {
        const updated = creatorWallet.balance_cents + split.creatorPayoutCents;
        await supabase.from("wallets").update({
          balance: updated,
          balance_cents: updated,
          updated_at: now,
        }).eq("user_id", creatorId);
      } else {
        await supabase.from("wallets").insert({
          id: `wal_${creatorId}`,
          user_id: creatorId,
          balance: split.creatorPayoutCents,
          balance_cents: split.creatorPayoutCents,
          currency: "USD",
          created_at: now,
          updated_at: now,
        });
      }

      // 5. Credit super admin wallet
      if (split.platformFeeCents > 0) {
        const { data: adminUser } = await supabase.from("users").select("id").eq("role", "SUPER_ADMIN").limit(1).maybeSingle();
        const superAdminId = adminUser?.id || "usr_david_kim";
        const adminWallet = await this.getWallet(superAdminId);
        if (adminWallet) {
          const updated = adminWallet.balance_cents + split.platformFeeCents;
          await supabase.from("wallets").update({
            balance: updated,
            balance_cents: updated,
            updated_at: now,
          }).eq("user_id", superAdminId);
        }
      }
    }

    try {
      recordAuditEvent({
        actorId: studentId,
        actorRole: (params.buyerRole || "STUDENT") as any,
        actorName: params.buyerName || "Student",
        action: "MARKETPLACE_CHECKOUT",
        targetType: "COURSE",
        targetId: course.id,
        courseId: course.id,
        details: {
          transaction_id: transactionId,
          enrollment_id: enrollmentId,
          course_title: course.title,
          amount_cents: split.amountCents,
          amount_dollars: split.amountCents / 100,
          platform_fee_cents: split.platformFeeCents,
          platform_fee_dollars: split.platformFeeDollars,
          creator_payout_cents: split.creatorPayoutCents,
          creator_payout_dollars: split.creatorPayoutDollars,
          status: "COMPLETED",
        },
      });
    } catch (auditErr) {
      console.error("Audit log error:", auditErr);
    }

    const updatedWallet = await this.getWallet(studentId);
    const newBalCents = updatedWallet?.balance_cents ?? (balanceCents - priceCents);
    const newBalDollars = Number((newBalCents / 100).toFixed(2));

    return {
      enrollment_id: enrollmentId,
      transaction_id: transactionId,
      new_balance: newBalDollars,
      new_balance_cents: newBalCents,
      split: {
        amount_cents: split.amountCents,
        platform_fee_cents: split.platformFeeCents,
        creator_earnings_cents: split.creatorPayoutCents,
        creator_payout_cents: split.creatorPayoutCents,
        platform_fee_dollars: split.platformFeeDollars,
        creator_payout_dollars: split.creatorPayoutDollars,
        amount_dollars: split.amountCents / 100,
      },
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        price_dollars: Number((priceCents / 100).toFixed(2)),
      },
    };
  }
}

export const dbAdapter = new DbAdapter();
