import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { SCHEMA_SQL } from "./schema";

let dbInstance: DatabaseSync | null = null;

export function getDbPath(): string {
  if (process.env.LMS_DB_PATH) {
    return process.env.LMS_DB_PATH;
  }
  return path.join(process.cwd(), ".data", "lms.db");
}

export function getDb(): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  dbInstance = new DatabaseSync(dbPath);
  dbInstance.exec("PRAGMA journal_mode = WAL;");
  dbInstance.exec("PRAGMA foreign_keys = ON;");
  dbInstance.exec("PRAGMA synchronous = NORMAL;");
  dbInstance.exec("PRAGMA busy_timeout = 5000;");

  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore
    }
    dbInstance = null;
  }
}

export function initDb(): void {
  const db = getDb();
  db.exec(SCHEMA_SQL);
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS prevent_audit_replace 
    BEFORE INSERT ON audit_logs 
    WHEN (SELECT 1 FROM audit_logs WHERE id = NEW.id OR uuid = NEW.uuid) IS NOT NULL
    BEGIN 
      SELECT RAISE(ABORT, 'Audit log records are immutable and cannot be replaced or overwritten'); 
    END;
  `);

  // Idempotent column and constraint migrations for existing SQLite databases
  try {
    const userTableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get() as any;
    if (userTableInfo && !userTableInfo.sql.includes("STUDENT")) {
      db.exec("PRAGMA foreign_keys = OFF;");
      db.exec(`
        CREATE TABLE users_new (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          avatar_url TEXT,
          role TEXT NOT NULL CHECK (role IN ('EMPLOYEE', 'MANAGER', 'COMPLIANCE_OFFICER', 'SUPER_ADMIN', 'STUDENT', 'CO_ADMIN')),
          department TEXT NOT NULL,
          job_title TEXT NOT NULL,
          manager_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        INSERT INTO users_new SELECT * FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
        CREATE INDEX IF NOT EXISTS idx_users_manager ON users(manager_id);
      `);
      db.exec("PRAGMA foreign_keys = ON;");
    }
  } catch {}

  try {
    const coursesTableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='courses'").get() as any;
    if (coursesTableInfo && !coursesTableInfo.sql.includes("SOFTWARE")) {
      db.exec("PRAGMA foreign_keys = OFF;");
      db.exec(`
        CREATE TABLE courses_new (
          id TEXT PRIMARY KEY,
          slug TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          category TEXT NOT NULL CHECK (category IN ('ONBOARDING', 'COMPLIANCE', 'SECURITY', 'TECHNICAL_UPSKILLING', 'LEADERSHIP', 'SOFTWARE', 'BUSINESS', 'DESIGN', 'MARKETING', 'DATA_SCIENCE')),
          target_role TEXT NOT NULL DEFAULT 'ALL',
          is_mandatory INTEGER NOT NULL DEFAULT 0 CHECK (is_mandatory IN (0, 1)),
          estimated_minutes INTEGER NOT NULL DEFAULT 30,
          renewal_period_days INTEGER,
          passing_score_pct INTEGER NOT NULL DEFAULT 80,
          version TEXT NOT NULL DEFAULT '1.0.0',
          is_published INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0, 1)),
          creator_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
          thumbnail_url TEXT,
          total_weeks INTEGER NOT NULL DEFAULT 1 CHECK (total_weeks >= 1),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        INSERT INTO courses_new (
          id, slug, title, description, category, target_role, is_mandatory,
          estimated_minutes, renewal_period_days, passing_score_pct, version,
          is_published, created_at, updated_at
        ) SELECT 
          id, slug, title, description, category, target_role, is_mandatory,
          estimated_minutes, renewal_period_days, passing_score_pct, version,
          is_published, created_at, updated_at
        FROM courses;
        DROP TABLE courses;
        ALTER TABLE courses_new RENAME TO courses;
        CREATE INDEX IF NOT EXISTS idx_courses_slug ON courses(slug);
        CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category);
        CREATE INDEX IF NOT EXISTS idx_courses_mandatory ON courses(is_mandatory);
      `);
      db.exec("PRAGMA foreign_keys = ON;");
    }
  } catch {}

  try { db.exec("ALTER TABLE courses ADD COLUMN creator_id TEXT REFERENCES users(id) ON DELETE SET NULL;"); } catch {}
  try { db.exec("ALTER TABLE courses ADD COLUMN price_cents INTEGER NOT NULL DEFAULT 0;"); } catch {}
  try { db.exec("ALTER TABLE courses ADD COLUMN thumbnail_url TEXT;"); } catch {}
  try { db.exec("ALTER TABLE courses ADD COLUMN total_weeks INTEGER NOT NULL DEFAULT 1;"); } catch {}
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS week_quizzes (
        id TEXT PRIMARY KEY,
        week_id TEXT UNIQUE NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
        course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        passing_score_pct INTEGER NOT NULL DEFAULT 80,
        questions TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_week_quizzes_week ON week_quizzes(week_id);
      CREATE INDEX IF NOT EXISTS idx_week_quizzes_course ON week_quizzes(course_id);
    `);
  } catch {}
  try {
    const enrInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='enrollments'").get() as any;
    if (enrInfo && !enrInfo.sql.includes("ACTIVE")) {
      db.exec("PRAGMA foreign_keys = OFF;");
      db.exec(`
        CREATE TABLE enrollments_new (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
          status TEXT NOT NULL CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'OVERDUE', 'ACTIVE')),
          progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
          assigned_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          assigned_at TEXT,
          due_date TEXT,
          completed_at TEXT,
          expires_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(user_id, course_id)
        );
        INSERT INTO enrollments_new SELECT * FROM enrollments;
        DROP TABLE enrollments;
        ALTER TABLE enrollments_new RENAME TO enrollments;
        CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id);
        CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
        CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);
        CREATE INDEX IF NOT EXISTS idx_enrollments_due_date ON enrollments(due_date);
      `);
      db.exec("PRAGMA foreign_keys = ON;");
    }
  } catch {}
}

// Re-export seedDb from seed.ts
export { seedDb } from "./seed";
