export const SCHEMA_SQL = `
-- PRAGMAS
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;

-- 1. MIGRATIONS TABLE
CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  applied_at TEXT NOT NULL
);

-- 2. USERS
CREATE TABLE IF NOT EXISTS users (
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

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
CREATE INDEX IF NOT EXISTS idx_users_manager ON users(manager_id);

-- 3. COURSES
CREATE TABLE IF NOT EXISTS courses (
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

CREATE INDEX IF NOT EXISTS idx_courses_slug ON courses(slug);
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category);
CREATE INDEX IF NOT EXISTS idx_courses_mandatory ON courses(is_mandatory);

-- 4. MODULES
CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('RICH_MARKDOWN', 'VIDEO_EMBED', 'INTERACTIVE_QUIZ')),
  content TEXT NOT NULL,
  estimated_minutes INTEGER NOT NULL DEFAULT 10,
  version TEXT NOT NULL DEFAULT '1.0.0',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(course_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_modules_course ON modules(course_id);

-- 5. QUIZZES
CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  module_id TEXT UNIQUE NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  passing_score_pct INTEGER NOT NULL DEFAULT 80,
  time_limit_minutes INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE')),
  options TEXT NOT NULL,
  correct_answers TEXT NOT NULL,
  explanation TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(quiz_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions(quiz_id);

-- 6. ENROLLMENTS
CREATE TABLE IF NOT EXISTS enrollments (
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

CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_due_date ON enrollments(due_date);

-- 7. MODULE PROGRESS
CREATE TABLE IF NOT EXISTS module_progress (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
  completed_at TEXT,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  last_position_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(enrollment_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_module_progress_enrollment ON module_progress(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_module_progress_user ON module_progress(user_id);

-- 8. QUIZ SUBMISSIONS
CREATE TABLE IF NOT EXISTS quiz_submissions (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score REAL NOT NULL CHECK (score >= 0.0 AND score <= 100.0),
  passed INTEGER NOT NULL CHECK (passed IN (0, 1)),
  attempt_number INTEGER NOT NULL DEFAULT 1,
  answers_payload TEXT NOT NULL,
  feedback_payload TEXT NOT NULL,
  submitted_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_sub_enrollment ON quiz_submissions(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sub_user ON quiz_submissions(user_id);

-- 9. CERTIFICATES
CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  certificate_code TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrollment_id TEXT UNIQUE NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  course_title TEXT NOT NULL,
  course_version TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  score REAL NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT,
  verification_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_certificates_code ON certificates(certificate_code);
CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);

-- 10. AUDIT LOGS (IMMUTABLE)
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE NOT NULL,
  timestamp TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES users(id),
  actor_role TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  course_id TEXT,
  module_id TEXT,
  module_version TEXT,
  score REAL,
  metadata TEXT,
  prev_hash TEXT NOT NULL,
  record_hash TEXT NOT NULL,
  signature TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_course ON audit_logs(course_id);

-- ENGINE-LEVEL IMMUTABILITY TRIGGERS
CREATE TRIGGER IF NOT EXISTS prevent_audit_update 
BEFORE UPDATE ON audit_logs 
BEGIN 
  SELECT RAISE(ABORT, 'Audit log records are immutable and cannot be updated'); 
END;

CREATE TRIGGER IF NOT EXISTS prevent_audit_delete 
BEFORE DELETE ON audit_logs 
BEGIN 
  SELECT RAISE(ABORT, 'Audit log records are immutable and cannot be deleted'); 
END;

-- 11. WEEKS TABLE (Sequential 1 to 7+)
CREATE TABLE IF NOT EXISTS weeks (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL CHECK (week_number >= 1),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(course_id, week_number)
);

CREATE INDEX IF NOT EXISTS idx_weeks_course ON weeks(course_id);

-- 12. LESSONS TABLE (With video_url and supplementary_files)
CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  week_id TEXT NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL CHECK (order_index >= 1),
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  video_url TEXT,
  supplementary_files TEXT NOT NULL DEFAULT '[]',
  is_preview INTEGER NOT NULL DEFAULT 0 CHECK (is_preview IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(week_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_lessons_week ON lessons(week_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);

-- 12B. WEEK QUIZZES TABLE (Weekly knowledge checks)
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

-- 13. WALLETS TABLE ($500 pre-funded balance = 50000 cents)
CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 50000 CHECK (balance >= 0),
  balance_cents INTEGER NOT NULL DEFAULT 50000 CHECK (balance_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);

-- 14. TRANSACTIONS TABLE (10% platform, 90% creator cut)
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  platform_fee INTEGER NOT NULL CHECK (platform_fee >= 0),
  platform_fee_cents INTEGER NOT NULL CHECK (platform_fee_cents >= 0),
  creator_earnings INTEGER NOT NULL CHECK (creator_earnings >= 0),
  creator_payout_cents INTEGER NOT NULL CHECK (creator_payout_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'REFUNDED', 'FAILED')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_course ON transactions(course_id);
CREATE INDEX IF NOT EXISTS idx_transactions_student ON transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_transactions_creator ON transactions(creator_id);

-- 15. PAYOUTS TABLE (Simulated Request Payout Flow)
CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'REJECTED')),
  requested_at TEXT NOT NULL,
  processed_at TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_payouts_creator ON payouts(creator_id);

CREATE TABLE IF NOT EXISTS payout_requests (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'REJECTED')),
  created_at TEXT NOT NULL,
  requested_at TEXT,
  processed_at TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_payout_requests_creator ON payout_requests(creator_id);

-- 16. LESSON PROGRESS TABLE
CREATE TABLE IF NOT EXISTS lesson_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
  completed_at TEXT,
  last_position_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson ON lesson_progress(lesson_id);
`;
