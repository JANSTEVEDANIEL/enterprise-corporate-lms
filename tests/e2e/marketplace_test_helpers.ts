import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";

export interface MarketplaceTestDatabaseContext {
  db: DatabaseSync;
  dbPath: string;
  cleanup: () => void;
}

export const MARKETPLACE_SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS marketplace_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('STUDENT', 'CO_ADMIN', 'SUPER_ADMIN')),
  avatar_url TEXT,
  bio TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS marketplace_courses (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES marketplace_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('DEVELOPMENT', 'BUSINESS', 'DESIGN', 'MARKETING', 'SECURITY', 'DATA_SCIENCE', 'GENERAL')),
  price REAL NOT NULL DEFAULT 0.0 CHECK (price >= 0),
  thumbnail_url TEXT,
  is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
  total_weeks INTEGER NOT NULL DEFAULT 1 CHECK (total_weeks >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS marketplace_weeks (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES marketplace_courses(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL CHECK (week_number >= 1),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(course_id, week_number)
);

CREATE TABLE IF NOT EXISTS marketplace_lessons (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES marketplace_courses(id) ON DELETE CASCADE,
  week_id TEXT NOT NULL REFERENCES marketplace_weeks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 1,
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  video_url TEXT NOT NULL,
  resources TEXT NOT NULL DEFAULT '[]',
  is_preview INTEGER NOT NULL DEFAULT 0 CHECK (is_preview IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(week_id, order_index)
);

CREATE TABLE IF NOT EXISTS marketplace_wallets (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL REFERENCES marketplace_users(id) ON DELETE CASCADE,
  balance REAL NOT NULL DEFAULT 0.0 CHECK (balance >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS marketplace_enrollments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES marketplace_users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES marketplace_courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED')),
  progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  certificate_id TEXT,
  enrolled_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(user_id, course_id)
);

CREATE TABLE IF NOT EXISTS marketplace_lesson_progress (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES marketplace_enrollments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES marketplace_users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES marketplace_courses(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES marketplace_lessons(id) ON DELETE CASCADE,
  is_completed INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1)),
  playback_seconds INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(enrollment_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS marketplace_transactions (
  id TEXT PRIMARY KEY,
  buyer_id TEXT NOT NULL REFERENCES marketplace_users(id),
  course_id TEXT NOT NULL REFERENCES marketplace_courses(id),
  creator_id TEXT NOT NULL REFERENCES marketplace_users(id),
  amount REAL NOT NULL CHECK (amount >= 0),
  platform_fee REAL NOT NULL CHECK (platform_fee >= 0),
  creator_payout REAL NOT NULL CHECK (creator_payout >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'SETTLED' CHECK (status IN ('SETTLED', 'PENDING', 'REFUNDED')),
  created_at TEXT NOT NULL,
  metadata TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS marketplace_payout_requests (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES marketplace_users(id) ON DELETE CASCADE,
  amount REAL NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'REJECTED')),
  requested_at TEXT NOT NULL,
  processed_at TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS marketplace_certificates (
  id TEXT PRIMARY KEY,
  certificate_code TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL REFERENCES marketplace_users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES marketplace_courses(id) ON DELETE CASCADE,
  enrollment_id TEXT UNIQUE NOT NULL REFERENCES marketplace_enrollments(id) ON DELETE CASCADE,
  course_title TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 100.0,
  issued_at TEXT NOT NULL,
  verification_hash TEXT NOT NULL
);
`;

export interface MarketplacePersona {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "CO_ADMIN" | "SUPER_ADMIN";
  avatarUrl: string;
  bio: string;
  initialWalletBalance: number;
}

export const MARKETPLACE_PERSONAS: Record<string, MarketplacePersona> = {
  alex_student: {
    id: "usr_student_alex",
    name: "Alex Rivera",
    email: "alex.student@edtech.market",
    role: "STUDENT",
    avatarUrl: "/avatars/alex.jpg",
    bio: "Lifelong learner and full-stack software engineer.",
    initialWalletBalance: 1000.0,
  },
  elena_creator: {
    id: "usr_creator_elena",
    name: "Elena Rostova",
    email: "elena.creator@edtech.market",
    role: "CO_ADMIN",
    avatarUrl: "/avatars/elena.jpg",
    bio: "Senior Cloud Architect & EdTech Top Instructor.",
    initialWalletBalance: 0.0,
  },
  david_super_admin: {
    id: "usr_super_david",
    name: "David Kim",
    email: "david.superadmin@edtech.market",
    role: "SUPER_ADMIN",
    avatarUrl: "/avatars/david.jpg",
    bio: "Platform Operator & Global EdTech Marketplace Administrator.",
    initialWalletBalance: 0.0,
  },
  marcus_student: {
    id: "usr_student_marcus",
    name: "Marcus Vance",
    email: "marcus.student@edtech.market",
    role: "STUDENT",
    avatarUrl: "/avatars/marcus.jpg",
    bio: "Cybersecurity enthusiast exploring cloud engineering.",
    initialWalletBalance: 500.0,
  },
  jordan_creator: {
    id: "usr_creator_jordan",
    name: "Jordan Hayes",
    email: "jordan.creator@edtech.market",
    role: "CO_ADMIN",
    avatarUrl: "/avatars/jordan.jpg",
    bio: "AI Researcher and Full-Stack Next.js Evangelist.",
    initialWalletBalance: 0.0,
  },
};

export function createIsolatedMarketplaceDb(prefix: string = "mkt_test"): MarketplaceTestDatabaseContext {
  const dataDir = path.join(process.cwd(), ".data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const randSuffix = Math.random().toString(36).substring(2, 9);
  const dbPath = path.join(dataDir, `${prefix}_${Date.now()}_${randSuffix}.db`);

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA synchronous = NORMAL;");

  db.exec(MARKETPLACE_SCHEMA_SQL);

  const cleanup = () => {
    try {
      db.close();
    } catch {
      // ignore
    }
    for (const ext of ["", "-wal", "-shm"]) {
      const p = `${dbPath}${ext}`;
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch {
          // ignore
        }
      }
    }
  };

  return { db, dbPath, cleanup };
}

export function seedMarketplaceTestDb(db: DatabaseSync): void {
  const now = new Date().toISOString();

  // 1. Seed Personas and Wallets
  const insertUser = db.prepare(`
    INSERT INTO marketplace_users (id, email, name, role, avatar_url, bio, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertWallet = db.prepare(`
    INSERT INTO marketplace_wallets (id, user_id, balance, currency, updated_at)
    VALUES (?, ?, ?, 'USD', ?)
  `);

  for (const p of Object.values(MARKETPLACE_PERSONAS)) {
    insertUser.run(p.id, p.email, p.name, p.role, p.avatarUrl, p.bio, now, now);
    insertWallet.run(`wal_${p.id}`, p.id, p.initialWalletBalance, now);
  }

  // 2. Seed a flagship 7-Week Published Course by Elena
  const insertCourse = db.prepare(`
    INSERT INTO marketplace_courses (
      id, creator_id, title, slug, description, category, price, thumbnail_url, is_published, total_weeks, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const flagshipCourseId = "crs_cloud_arch_7w";
  insertCourse.run(
    flagshipCourseId,
    MARKETPLACE_PERSONAS.elena_creator.id,
    "Mastering Enterprise Cloud Architecture (7-Week Intensive)",
    "mastering-enterprise-cloud-architecture-7-week",
    "Comprehensive 7-week curriculum covering production cloud topologies, Kubernetes, and Zero Trust.",
    "DEVELOPMENT",
    99.99,
    "https://storage.edtech.market/thumbnails/cloud-arch.jpg",
    1, // is_published
    7, // total_weeks
    now,
    now
  );

  const insertWeek = db.prepare(`
    INSERT INTO marketplace_weeks (id, course_id, week_number, title, description, order_index, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertLesson = db.prepare(`
    INSERT INTO marketplace_lessons (
      id, course_id, week_id, title, description, order_index, duration_seconds, video_url, resources, is_preview, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Populate 7 weeks with lessons
  for (let w = 1; w <= 7; w++) {
    const weekId = `wk_cloud_${w}`;
    insertWeek.run(
      weekId,
      flagshipCourseId,
      w,
      `Week ${w}: Architecture Milestone & Lab ${w}`,
      `Sequential milestone for week ${w}`,
      w,
      now,
      now
    );

    // 2 lessons per week: lesson 1 is preview if week 1, otherwise protected
    insertLesson.run(
      `les_cloud_w${w}_1`,
      flagshipCourseId,
      weekId,
      `Lesson ${w}.1: Core Architectural Foundations`,
      `In-depth video lecture for week ${w}`,
      1,
      1200, // 20 mins
      `https://storage.edtech.market/videos/cloud-w${w}-1.mp4`,
      JSON.stringify([{ name: `Week${w}_Handout.pdf`, url: `https://storage.edtech.market/files/w${w}-handout.pdf`, size_bytes: 1048576 }]),
      w === 1 ? 1 : 0, // preview only on week 1 lesson 1
      now,
      now
    );

    insertLesson.run(
      `les_cloud_w${w}_2`,
      flagshipCourseId,
      weekId,
      `Lesson ${w}.2: Practical Implementation Lab`,
      `Hands-on lab walkthrough for week ${w}`,
      2,
      1800, // 30 mins
      `https://storage.edtech.market/videos/cloud-w${w}-2.mp4`,
      JSON.stringify([{ name: `Week${w}_Lab_Source.zip`, url: `https://storage.edtech.market/files/w${w}-lab.zip`, size_bytes: 4194304 }]),
      0, // strictly protected
      now,
      now
    );
  }

  // 3. Seed a second course: Free introductory course ($0.00)
  const freeCourseId = "crs_git_free_1w";
  insertCourse.run(
    freeCourseId,
    MARKETPLACE_PERSONAS.elena_creator.id,
    "Git & GitHub Essentials for Team Engineering",
    "git-github-essentials-free",
    "Zero-cost introductory course on version control.",
    "DEVELOPMENT",
    0.00,
    "https://storage.edtech.market/thumbnails/git-free.jpg",
    1,
    1,
    now,
    now
  );

  insertWeek.run(`wk_git_1`, freeCourseId, 1, "Week 1: Git Essentials", "Foundational git commands", 1, now, now);
  insertLesson.run(
    `les_git_1_1`,
    freeCourseId,
    `wk_git_1`,
    "Lesson 1.1: Git Workflow Overview",
    "Video overview",
    1,
    600,
    "https://storage.edtech.market/videos/git-intro.mp4",
    "[]",
    1,
    now,
    now
  );

  // 4. Seed a Draft (Unpublished) Course
  const draftCourseId = "crs_draft_ai_agent";
  insertCourse.run(
    draftCourseId,
    MARKETPLACE_PERSONAS.jordan_creator.id,
    "Autonomous AI Agents in Production",
    "autonomous-ai-agents-production",
    "Under construction curriculum.",
    "DATA_SCIENCE",
    149.99,
    "https://storage.edtech.market/thumbnails/ai-draft.jpg",
    0, // DRAFT
    3,
    now,
    now
  );
  insertWeek.run(`wk_ai_1`, draftCourseId, 1, "Week 1: Agent Foundations", "Draft week", 1, now, now);
  insertLesson.run(
    `les_ai_1_1`,
    draftCourseId,
    `wk_ai_1`,
    "Lesson 1.1: ReAct Loops",
    "Draft lesson",
    1,
    900,
    "https://storage.edtech.market/videos/ai-react.mp4",
    "[]",
    0,
    now,
    now
  );
}

// ============================================================================
// Core Domain Functions & Contract Implementations
// ============================================================================

export interface RevenueSplitResult {
  amountCents: number;
  platformFeeCents: number;
  creatorPayoutCents: number;
  platformFeeDollars: number;
  creatorPayoutDollars: number;
  amountDollars: number;
}

/**
 * Exact integer-cents revenue split:
 * Platform fee = exactly 10%
 * Creator payout = exactly 90%
 * Invariant: platformFeeCents + creatorPayoutCents === amountCents
 */
export function calculateRevenueSplit(priceDollars: number): RevenueSplitResult {
  if (priceDollars < 0) {
    throw new Error("Course price cannot be negative");
  }

  const amountCents = Math.round(priceDollars * 100);
  const platformFeeCents = Math.round(amountCents * 0.10);
  const creatorPayoutCents = amountCents - platformFeeCents;

  if (platformFeeCents + creatorPayoutCents !== amountCents) {
    throw new Error(`Arithmetic Invariant Violation: ${platformFeeCents} + ${creatorPayoutCents} !== ${amountCents}`);
  }

  return {
    amountCents,
    platformFeeCents,
    creatorPayoutCents,
    platformFeeDollars: Number((platformFeeCents / 100).toFixed(2)),
    creatorPayoutDollars: Number((creatorPayoutCents / 100).toFixed(2)),
    amountDollars: Number((amountCents / 100).toFixed(2)),
  };
}

/**
 * Creator Content Privacy Shield: Course Title Masking Formula
 * Form: title.slice(0, 6) + '... [Content Encrypted]'
 */
export function maskCourseTitle(
  title: string,
  userRole?: string,
  isAuthor: boolean = false,
  isEnrolled: boolean = false
): string {
  if (isAuthor || isEnrolled) {
    return title;
  }

  if (userRole === "SUPER_ADMIN") {
    const prefix = title.length > 6 ? title.slice(0, 6) : title;
    return `${prefix}... [Content Encrypted]`;
  }

  return title;
}

/**
 * Creator Content Privacy Shield: Content Gate Authorization Guard
 * Super Admin is strictly prohibited from viewing/streaming raw lesson videos and resources.
 */
export function checkContentGate(
  userRole: string,
  isAuthor: boolean,
  isEnrolled: boolean,
  isPreview: boolean = false
): { allowed: boolean; status?: number; error?: string; message?: string } {
  // 1. Strict Super Admin Gate: Blocked unconditionally
  if (userRole === "SUPER_ADMIN") {
    return {
      allowed: false,
      status: 403,
      error: "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE",
      message: "Access Denied: Super Admin is strictly prohibited from accessing raw creator lesson content.",
    };
  }

  // 2. Free preview allowed
  if (isPreview) {
    return { allowed: true };
  }

  // 3. Author or enrolled student allowed
  if (isAuthor || isEnrolled) {
    return { allowed: true };
  }

  // 4. Unenrolled rejected
  return {
    allowed: false,
    status: 403,
    error: "FORBIDDEN_UNENROLLED",
    message: "Purchase required to stream full video content",
  };
}

export interface CheckoutResult {
  success: boolean;
  transactionId?: string;
  enrollmentId?: string;
  error?: string;
  split?: RevenueSplitResult;
  newBalance?: number;
}

/**
 * Atomic simulated wallet checkout flow:
 * - Checks published status
 * - Checks duplicate enrollment
 * - Validates wallet balance >= price
 * - Debits student wallet
 * - Credits creator wallet (90%)
 * - Records platform fee in ledger (10%)
 * - Provisions enrollment
 * - Records immutable transaction row
 */
export function executeMarketplaceCheckout(
  db: DatabaseSync,
  buyerId: string,
  courseId: string
): CheckoutResult {
  const now = new Date().toISOString();

  // 1. Course lookup
  const courseStmt = db.prepare("SELECT * FROM marketplace_courses WHERE id = ?");
  const course = courseStmt.get(courseId) as any;
  if (!course) {
    return { success: false, error: "COURSE_NOT_FOUND" };
  }

  if (course.is_published !== 1) {
    return { success: false, error: "COURSE_NOT_PUBLISHED" };
  }

  // 2. Check if already enrolled
  const enrCheckStmt = db.prepare("SELECT id FROM marketplace_enrollments WHERE user_id = ? AND course_id = ?");
  const existingEnr = enrCheckStmt.get(buyerId, courseId);
  if (existingEnr) {
    return { success: false, error: "ALREADY_ENROLLED" };
  }

  // 3. Check wallet balance
  const walletStmt = db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?");
  const wallet = walletStmt.get(buyerId) as any;
  if (!wallet) {
    return { success: false, error: "WALLET_NOT_FOUND" };
  }

  const price = course.price;
  if (wallet.balance < price) {
    return {
      success: false,
      error: `INSUFFICIENT_FUNDS: Available $${wallet.balance.toFixed(2)}, Required $${price.toFixed(2)}`,
    };
  }

  // 4. Calculate split
  const split = calculateRevenueSplit(price);

  const transactionId = `tx_${randomUUID().substring(0, 8)}`;
  const enrollmentId = `enr_${randomUUID().substring(0, 8)}`;

  // 5. Atomic mutations:
  // Debit buyer
  const debitBuyerStmt = db.prepare(`
    UPDATE marketplace_wallets 
    SET balance = balance - ?, updated_at = ? 
    WHERE user_id = ?
  `);
  debitBuyerStmt.run(price, now, buyerId);

  // Credit creator (90%)
  const creditCreatorStmt = db.prepare(`
    UPDATE marketplace_wallets 
    SET balance = balance + ?, updated_at = ? 
    WHERE user_id = ?
  `);
  creditCreatorStmt.run(split.creatorPayoutDollars, now, course.creator_id);

  // Credit Super Admin (10%)
  const superAdmin = db.prepare("SELECT id FROM marketplace_users WHERE role = 'SUPER_ADMIN' LIMIT 1").get() as any;
  if (superAdmin && split.platformFeeDollars > 0) {
    creditCreatorStmt.run(split.platformFeeDollars, now, superAdmin.id);
  }

  // Insert Enrollment
  const insertEnrStmt = db.prepare(`
    INSERT INTO marketplace_enrollments (id, user_id, course_id, status, progress_pct, enrolled_at)
    VALUES (?, ?, ?, 'ACTIVE', 0, ?)
  `);
  insertEnrStmt.run(enrollmentId, buyerId, courseId, now);

  // Record Transaction
  const insertTxStmt = db.prepare(`
    INSERT INTO marketplace_transactions (
      id, buyer_id, course_id, creator_id, amount, platform_fee, creator_payout, currency, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'USD', 'SETTLED', ?)
  `);
  insertTxStmt.run(
    transactionId,
    buyerId,
    courseId,
    course.creator_id,
    split.amountDollars,
    split.platformFeeDollars,
    split.creatorPayoutDollars,
    now
  );

  const updatedWallet = walletStmt.get(buyerId) as any;

  return {
    success: true,
    transactionId,
    enrollmentId,
    split,
    newBalance: updatedWallet.balance,
  };
}

/**
 * Lesson playback tracking and automated certification upon 100% completion
 */
export function updateLessonProgressAndCheckCompletion(
  db: DatabaseSync,
  enrollmentId: string,
  lessonId: string,
  isCompleted: boolean,
  playbackSeconds: number
): { progressPct: number; isCourseCompleted: boolean; certificateCode?: string } {
  const now = new Date().toISOString();

  // 1. Get enrollment & course info
  const enrStmt = db.prepare(`
    SELECT e.*, c.title as course_title, u.name as user_name, u.email as user_email
    FROM marketplace_enrollments e
    JOIN marketplace_courses c ON e.course_id = c.id
    JOIN marketplace_users u ON e.user_id = u.id
    WHERE e.id = ?
  `);
  const enr = enrStmt.get(enrollmentId) as any;
  if (!enr) {
    throw new Error(`Enrollment ${enrollmentId} not found`);
  }

  // 2. Upsert lesson progress
  const progressCheckStmt = db.prepare(
    "SELECT id FROM marketplace_lesson_progress WHERE enrollment_id = ? AND lesson_id = ?"
  );
  const existingProg = progressCheckStmt.get(enrollmentId, lessonId) as any;

  if (existingProg) {
    const updateProgStmt = db.prepare(`
      UPDATE marketplace_lesson_progress 
      SET is_completed = ?, playback_seconds = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `);
    updateProgStmt.run(
      isCompleted ? 1 : 0,
      playbackSeconds,
      isCompleted ? now : null,
      now,
      existingProg.id
    );
  } else {
    const progId = `prog_${randomUUID().substring(0, 8)}`;
    const insertProgStmt = db.prepare(`
      INSERT INTO marketplace_lesson_progress (
        id, enrollment_id, user_id, course_id, lesson_id, is_completed, playback_seconds, completed_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertProgStmt.run(
      progId,
      enrollmentId,
      enr.user_id,
      enr.course_id,
      lessonId,
      isCompleted ? 1 : 0,
      playbackSeconds,
      isCompleted ? now : null,
      now
    );
  }

  // 3. Compute overall course progress
  const totalLessonsStmt = db.prepare("SELECT COUNT(*) as count FROM marketplace_lessons WHERE course_id = ?");
  const totalLessons = (totalLessonsStmt.get(enr.course_id) as any).count;

  const completedLessonsStmt = db.prepare(
    "SELECT COUNT(*) as count FROM marketplace_lesson_progress WHERE enrollment_id = ? AND is_completed = 1"
  );
  const completedLessons = (completedLessonsStmt.get(enrollmentId) as any).count;

  const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const isCourseCompleted = progressPct === 100;

  let certificateCode: string | undefined;

  if (isCourseCompleted) {
    // Check if certificate already exists
    const certCheckStmt = db.prepare("SELECT certificate_code FROM marketplace_certificates WHERE enrollment_id = ?");
    const existingCert = certCheckStmt.get(enrollmentId) as any;

    if (existingCert) {
      certificateCode = existingCert.certificate_code;
    } else {
      certificateCode = `CERT-MKT-${new Date().getFullYear()}-${randomUUID().substring(0, 8).toUpperCase()}`;
      const certId = `cert_${randomUUID().substring(0, 8)}`;
      const verificationHash = createHash("sha256")
        .update(`${certificateCode}:${enr.user_id}:${enr.course_id}:${now}`)
        .digest("hex");

      const insertCertStmt = db.prepare(`
        INSERT INTO marketplace_certificates (
          id, certificate_code, user_id, course_id, enrollment_id, course_title, user_name, user_email, score, issued_at, verification_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 100.0, ?, ?)
      `);
      insertCertStmt.run(
        certId,
        certificateCode,
        enr.user_id,
        enr.course_id,
        enrollmentId,
        enr.course_title,
        enr.user_name,
        enr.user_email,
        now,
        verificationHash
      );
    }

    // Update enrollment status
    const updateEnrStmt = db.prepare(`
      UPDATE marketplace_enrollments 
      SET status = 'COMPLETED', progress_pct = 100, certificate_id = ?, completed_at = ?
      WHERE id = ?
    `);
    updateEnrStmt.run(certificateCode || null, now, enrollmentId);
  } else {
    const updateEnrStmt = db.prepare(`
      UPDATE marketplace_enrollments 
      SET progress_pct = ? 
      WHERE id = ?
    `);
    updateEnrStmt.run(progressPct, enrollmentId);
  }

  return { progressPct, isCourseCompleted, certificateCode };
}

/**
 * Co-Admin Payout Request & Processing workflow
 */
export function createPayoutRequest(
  db: DatabaseSync,
  creatorId: string,
  amount: number
): { success: boolean; payoutId?: string; error?: string } {
  if (amount <= 0) {
    return { success: false, error: "AMOUNT_MUST_BE_POSITIVE" };
  }

  const walletStmt = db.prepare("SELECT balance FROM marketplace_wallets WHERE user_id = ?");
  const wallet = walletStmt.get(creatorId) as any;
  if (!wallet || wallet.balance < amount) {
    return {
      success: false,
      error: `INSUFFICIENT_CREATOR_BALANCE: Available $${wallet?.balance.toFixed(2) ?? 0.00}, Requested $${amount.toFixed(2)}`,
    };
  }

  const payoutId = `pay_${randomUUID().substring(0, 8)}`;
  const now = new Date().toISOString();

  const insertStmt = db.prepare(`
    INSERT INTO marketplace_payout_requests (id, creator_id, amount, status, requested_at)
    VALUES (?, ?, ?, 'PENDING', ?)
  `);
  insertStmt.run(payoutId, creatorId, amount, now);

  return { success: true, payoutId };
}

export function processPayoutRequest(
  db: DatabaseSync,
  payoutId: string
): { success: boolean; error?: string } {
  const now = new Date().toISOString();

  const payoutStmt = db.prepare("SELECT * FROM marketplace_payout_requests WHERE id = ?");
  const payout = payoutStmt.get(payoutId) as any;
  if (!payout) {
    return { success: false, error: "PAYOUT_NOT_FOUND" };
  }

  if (payout.status !== "PENDING") {
    return { success: false, error: `PAYOUT_ALREADY_${payout.status}` };
  }

  // Deduct from creator wallet
  const debitStmt = db.prepare(`
    UPDATE marketplace_wallets 
    SET balance = balance - ?, updated_at = ? 
    WHERE user_id = ?
  `);
  debitStmt.run(payout.amount, now, payout.creator_id);

  // Update payout status to PROCESSED
  const updateStmt = db.prepare(`
    UPDATE marketplace_payout_requests 
    SET status = 'PROCESSED', processed_at = ? 
    WHERE id = ?
  `);
  updateStmt.run(now, payoutId);

  return { success: true };
}

/**
 * Get sanitized preview for user respecting Creator Privacy Shield
 */
export function getCoursePreviewForUser(
  db: DatabaseSync,
  courseId: string,
  userRole?: string,
  userId?: string
) {
  const courseStmt = db.prepare(`
    SELECT c.*, u.name as creator_name 
    FROM marketplace_courses c
    JOIN marketplace_users u ON c.creator_id = u.id
    WHERE c.id = ?
  `);
  const course = courseStmt.get(courseId) as any;
  if (!course) return null;

  const isAuthor = userId === course.creator_id;
  let isEnrolled = false;
  if (userId) {
    const enr = db.prepare("SELECT id FROM marketplace_enrollments WHERE user_id = ? AND course_id = ?").get(userId, courseId);
    isEnrolled = Boolean(enr);
  }

  const isSuperAdmin = userRole === "SUPER_ADMIN";
  const displayTitle = maskCourseTitle(course.title, userRole, isAuthor, isEnrolled);

  // Fetch weeks and lessons
  const weeks = db.prepare("SELECT * FROM marketplace_weeks WHERE course_id = ? ORDER BY week_number ASC").all(courseId) as any[];
  const weeksWithLessons = weeks.map((w) => {
    const lessons = db.prepare("SELECT * FROM marketplace_lessons WHERE week_id = ? ORDER BY order_index ASC").all(w.id) as any[];
    const sanitizedLessons = lessons.map((l) => {
      const gate = checkContentGate(userRole || "STUDENT", isAuthor, isEnrolled, l.is_preview === 1);
      return {
        id: l.id,
        title: l.title,
        order_index: l.order_index,
        duration_seconds: l.duration_seconds,
        is_preview: l.is_preview === 1,
        video_url: gate.allowed ? l.video_url : null,
        resources: gate.allowed ? JSON.parse(l.resources) : [],
        content_shield_active: !gate.allowed,
      };
    });
    return { ...w, lessons: sanitizedLessons };
  });

  return {
    id: course.id,
    title: displayTitle,
    raw_title: isAuthor || isEnrolled ? course.title : undefined,
    slug: course.slug,
    description: course.description,
    category: course.category,
    price: course.price,
    thumbnail_url: course.thumbnail_url,
    is_blur_applied: isSuperAdmin,
    is_published: course.is_published === 1,
    total_weeks: course.total_weeks,
    creator_name: course.creator_name,
    weeks: weeksWithLessons,
  };
}
