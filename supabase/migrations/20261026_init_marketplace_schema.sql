-- ============================================================================
-- 20261026_init_marketplace_schema.sql
-- Production PostgreSQL Schema with TEXT PRIMARY KEY & Creator Privacy Shield
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing tables to recreate with TEXT PRIMARY KEY support
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP VIEW IF EXISTS public.profiles CASCADE;
DROP VIEW IF EXISTS public.super_admin_course_catalog CASCADE;
DROP TABLE IF EXISTS public.certificates CASCADE;
DROP TABLE IF EXISTS public.lesson_progress CASCADE;
DROP TABLE IF EXISTS public.payout_requests CASCADE;
DROP TABLE IF EXISTS public.payouts CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.wallets CASCADE;
DROP TABLE IF EXISTS public.enrollments CASCADE;
DROP TABLE IF EXISTS public.week_quizzes CASCADE;
DROP TABLE IF EXISTS public.lessons CASCADE;
DROP TABLE IF EXISTS public.weeks CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 2. USERS TABLE
CREATE TABLE public.users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('STUDENT', 'CO_ADMIN', 'SUPER_ADMIN', 'EMPLOYEE', 'MANAGER', 'COMPLIANCE_OFFICER')),
  department TEXT NOT NULL DEFAULT '',
  job_title TEXT NOT NULL DEFAULT '',
  manager_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);

-- View profiles aliased to users for full compatibility
CREATE OR REPLACE VIEW public.profiles AS SELECT * FROM public.users;

-- 3. COURSES TABLE
CREATE TABLE public.courses (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('SOFTWARE', 'BUSINESS', 'DESIGN', 'MARKETING', 'SECURITY', 'DATA_SCIENCE', 'COMPLIANCE', 'ONBOARDING', 'TECHNICAL_UPSKILLING', 'LEADERSHIP')),
  target_role TEXT NOT NULL DEFAULT 'ALL',
  is_mandatory INTEGER NOT NULL DEFAULT 0,
  estimated_minutes INTEGER NOT NULL DEFAULT 30,
  renewal_period_days INTEGER,
  passing_score_pct INTEGER NOT NULL DEFAULT 80,
  version TEXT NOT NULL DEFAULT '1.0.0',
  is_published BOOLEAN NOT NULL DEFAULT true,
  creator_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  thumbnail_url TEXT,
  total_weeks INTEGER NOT NULL DEFAULT 1 CHECK (total_weeks >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_courses_creator ON public.courses(creator_id);
CREATE INDEX idx_courses_slug ON public.courses(slug);
CREATE INDEX idx_courses_published ON public.courses(is_published);

-- 4. WEEKS TABLE (Sequential 1 to 7+)
CREATE TABLE public.weeks (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL CHECK (week_number >= 1),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, week_number)
);

CREATE INDEX idx_weeks_course ON public.weeks(course_id);

-- 5. LESSONS TABLE
CREATE TABLE public.lessons (
  id TEXT PRIMARY KEY,
  week_id TEXT NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL CHECK (order_index >= 1),
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  video_url TEXT,
  supplementary_files JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_preview BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(week_id, order_index)
);

CREATE INDEX idx_lessons_week ON public.lessons(week_id);
CREATE INDEX idx_lessons_course ON public.lessons(course_id);

-- 6. WEEK QUIZZES TABLE
CREATE TABLE public.week_quizzes (
  id TEXT PRIMARY KEY,
  week_id TEXT UNIQUE NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  passing_score_pct INTEGER NOT NULL DEFAULT 80,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_week_quizzes_week ON public.week_quizzes(week_id);
CREATE INDEX idx_week_quizzes_course ON public.week_quizzes(course_id);

-- 7. ENROLLMENTS TABLE
CREATE TABLE public.enrollments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'OVERDUE', 'ACTIVE')),
  progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  assigned_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);

CREATE INDEX idx_enrollments_user ON public.enrollments(user_id);
CREATE INDEX idx_enrollments_course ON public.enrollments(course_id);

-- 8. WALLETS TABLE ($500 = 50000 cents default)
CREATE TABLE public.wallets (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 50000 CHECK (balance >= 0),
  balance_cents INTEGER NOT NULL DEFAULT 50000 CHECK (balance_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wallets_user ON public.wallets(user_id);

-- 9. TRANSACTIONS TABLE (10% platform, 90% creator split)
CREATE TABLE public.transactions (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  platform_fee INTEGER NOT NULL CHECK (platform_fee >= 0),
  platform_fee_cents INTEGER NOT NULL CHECK (platform_fee_cents >= 0),
  creator_earnings INTEGER NOT NULL CHECK (creator_earnings >= 0),
  creator_payout_cents INTEGER NOT NULL CHECK (creator_payout_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'REFUNDED', 'FAILED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_course ON public.transactions(course_id);
CREATE INDEX idx_transactions_student ON public.transactions(student_id);
CREATE INDEX idx_transactions_creator ON public.transactions(creator_id);

-- 10. PAYOUTS TABLE (Simulated Creator Payout Flow)
CREATE TABLE public.payouts (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'REJECTED')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX idx_payouts_creator ON public.payouts(creator_id);

CREATE TABLE public.payout_requests (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  requested_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX idx_payout_requests_creator ON public.payout_requests(creator_id);

-- 11. LESSON PROGRESS TABLE
CREATE TABLE public.lesson_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
  completed_at TIMESTAMPTZ,
  last_position_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX idx_lesson_progress_user ON public.lesson_progress(user_id);
CREATE INDEX idx_lesson_progress_lesson ON public.lesson_progress(lesson_id);

-- 12. CERTIFICATES TABLE
CREATE TABLE public.certificates (
  id TEXT PRIMARY KEY,
  certificate_code TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  enrollment_id TEXT REFERENCES public.enrollments(id) ON DELETE SET NULL,
  course_title TEXT NOT NULL,
  course_version TEXT DEFAULT '1.0.0',
  student_name TEXT NOT NULL,
  user_name TEXT,
  user_email TEXT,
  score REAL DEFAULT 100,
  verification_badge_url TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  verification_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_certificates_code ON public.certificates(certificate_code);
CREATE INDEX idx_certificates_user ON public.certificates(user_id);

-- SUPER ADMIN PRIVACY VIEW: Masked Titles & Encrypted Indicators
CREATE OR REPLACE VIEW public.super_admin_course_catalog AS
SELECT 
  c.id,
  c.creator_id,
  CASE 
    WHEN length(c.title) > 6 THEN substr(c.title, 1, 6) || '... [Content Encrypted]'
    ELSE c.title || '... [Content Encrypted]'
  END AS title,
  c.slug,
  c.category,
  c.price_cents,
  round(c.price_cents / 100.0, 2) AS price_dollars,
  c.thumbnail_url,
  c.is_published,
  c.total_weeks,
  c.created_at,
  (SELECT count(*) FROM public.enrollments e WHERE e.course_id = c.id) AS sales_count,
  (SELECT coalesce(sum(t.amount_cents), 0) FROM public.transactions t WHERE t.course_id = c.id) AS gross_revenue_cents
FROM public.courses c;

-- STORAGE BUCKETS (course-materials public, lesson-videos private, course-media public)
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('course-materials', 'course-materials', true),
  ('lesson-videos', 'lesson-videos', false),
  ('course-media', 'course-media', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;
