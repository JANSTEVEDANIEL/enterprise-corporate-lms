-- ============================================================================
-- 20261026_init_marketplace_schema.sql
-- Production PostgreSQL Schema & Creator Content Privacy Shield RLS Policies
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('STUDENT', 'CO_ADMIN', 'SUPER_ADMIN', 'EMPLOYEE', 'MANAGER', 'COMPLIANCE_OFFICER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pg_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_pg_profiles_role ON public.profiles(role);

-- 3. COURSES TABLE
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('SOFTWARE', 'BUSINESS', 'DESIGN', 'MARKETING', 'SECURITY', 'DATA_SCIENCE', 'COMPLIANCE', 'ONBOARDING', 'TECHNICAL_UPSKILLING', 'LEADERSHIP')),
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  thumbnail_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  total_weeks INTEGER NOT NULL DEFAULT 1 CHECK (total_weeks >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pg_courses_creator ON public.courses(creator_id);
CREATE INDEX IF NOT EXISTS idx_pg_courses_slug ON public.courses(slug);
CREATE INDEX IF NOT EXISTS idx_pg_courses_published ON public.courses(is_published);

-- 4. WEEKS TABLE (Sequential 1 to 7+)
CREATE TABLE IF NOT EXISTS public.weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL CHECK (week_number >= 1),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, week_number)
);

CREATE INDEX IF NOT EXISTS idx_pg_weeks_course ON public.weeks(course_id);

-- 5. LESSONS TABLE
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id UUID NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_pg_lessons_week ON public.lessons(week_id);
CREATE INDEX IF NOT EXISTS idx_pg_lessons_course ON public.lessons(course_id);

-- 6. ENROLLMENTS TABLE
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'OVERDUE')),
  progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_pg_enrollments_user ON public.enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_pg_enrollments_course ON public.enrollments(course_id);

-- 7. WALLETS TABLE (Default $500 = 50000 cents for simulated purchasing)
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 50000 CHECK (balance >= 0),
  balance_cents INTEGER NOT NULL DEFAULT 50000 CHECK (balance_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pg_wallets_user ON public.wallets(user_id);

-- 8. TRANSACTIONS TABLE (10% platform, 90% creator split)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_pg_transactions_course ON public.transactions(course_id);
CREATE INDEX IF NOT EXISTS idx_pg_transactions_student ON public.transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_pg_transactions_creator ON public.transactions(creator_id);

-- 9. PAYOUTS TABLE (Simulated Request Payout Flow)
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'REJECTED')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_pg_payouts_creator ON public.payouts(creator_id);

CREATE TABLE IF NOT EXISTS public.payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  requested_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_pg_payout_requests_creator ON public.payout_requests(creator_id);

-- 10. LESSON PROGRESS TABLE
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
  completed_at TIMESTAMPTZ,
  last_position_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_pg_lesson_progress_user ON public.lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_pg_lesson_progress_lesson ON public.lesson_progress(lesson_id);

-- 11. CERTIFICATES TABLE
CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_code TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  course_title TEXT NOT NULL,
  student_name TEXT NOT NULL,
  verification_badge_url TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verification_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pg_certificates_code ON public.certificates(certificate_code);
CREATE INDEX IF NOT EXISTS idx_pg_certificates_user ON public.certificates(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES & CREATOR CONTENT PRIVACY SHIELD
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- Helper function to resolve role of authenticated user
CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid()),
    'STUDENT'
  );
$$;

-- PROFILES POLICIES
DROP POLICY IF EXISTS profiles_read_all ON public.profiles;
CREATE POLICY profiles_read_all ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE USING (id = auth.uid());

-- COURSES POLICIES
DROP POLICY IF EXISTS courses_select_policy ON public.courses;
CREATE POLICY courses_select_policy ON public.courses
  FOR SELECT USING (is_published = true OR creator_id = auth.uid() OR current_profile_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS courses_creator_insert ON public.courses;
CREATE POLICY courses_creator_insert ON public.courses
  FOR INSERT WITH CHECK (creator_id = auth.uid() AND current_profile_role() IN ('CO_ADMIN', 'SUPER_ADMIN'));

DROP POLICY IF EXISTS courses_creator_update ON public.courses;
CREATE POLICY courses_creator_update ON public.courses
  FOR UPDATE USING (creator_id = auth.uid() AND current_profile_role() IN ('CO_ADMIN', 'SUPER_ADMIN'));

-- WEEKS POLICIES
DROP POLICY IF EXISTS weeks_select_policy ON public.weeks;
CREATE POLICY weeks_select_policy ON public.weeks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courses WHERE courses.id = weeks.course_id AND (courses.is_published = true OR courses.creator_id = auth.uid()))
  );

DROP POLICY IF EXISTS weeks_creator_insert ON public.weeks;
CREATE POLICY weeks_creator_insert ON public.weeks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.courses WHERE courses.id = weeks.course_id AND courses.creator_id = auth.uid())
  );

DROP POLICY IF EXISTS weeks_creator_update ON public.weeks;
CREATE POLICY weeks_creator_update ON public.weeks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.courses WHERE courses.id = weeks.course_id AND courses.creator_id = auth.uid())
  );

-- LESSONS POLICIES (THE CREATOR CONTENT PRIVACY SHIELD)
-- 1. SUPER_ADMIN is explicitly DENIED from viewing full lesson video links and files.
-- 2. Only authoring Co-Admin or paying Enrolled Student can query lesson records.
-- 3. Free preview lessons (is_preview = true) are visible if not Super Admin.
DROP POLICY IF EXISTS lessons_select_privacy_shield ON public.lessons;
CREATE POLICY lessons_select_privacy_shield ON public.lessons
  FOR SELECT USING (
    -- Super Admin role is strictly shielded from raw lesson content
    current_profile_role() != 'SUPER_ADMIN'
    AND (
      is_preview = true
      OR EXISTS (
        SELECT 1 FROM public.courses
        WHERE courses.id = lessons.course_id AND courses.creator_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.enrollments
        WHERE enrollments.course_id = lessons.course_id AND enrollments.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS lessons_creator_insert ON public.lessons;
CREATE POLICY lessons_creator_insert ON public.lessons
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.courses WHERE courses.id = lessons.course_id AND courses.creator_id = auth.uid())
  );

DROP POLICY IF EXISTS lessons_creator_update ON public.lessons;
CREATE POLICY lessons_creator_update ON public.lessons
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.courses WHERE courses.id = lessons.course_id AND courses.creator_id = auth.uid())
  );

-- WALLETS POLICIES
DROP POLICY IF EXISTS wallets_user_select ON public.wallets;
CREATE POLICY wallets_user_select ON public.wallets FOR SELECT USING (user_id = auth.uid() OR current_profile_role() = 'SUPER_ADMIN');

-- TRANSACTIONS POLICIES
DROP POLICY IF EXISTS transactions_select_parties ON public.transactions;
CREATE POLICY transactions_select_parties ON public.transactions
  FOR SELECT USING (student_id = auth.uid() OR creator_id = auth.uid() OR current_profile_role() = 'SUPER_ADMIN');

-- PAYOUTS POLICIES
DROP POLICY IF EXISTS payouts_select_parties ON public.payouts;
CREATE POLICY payouts_select_parties ON public.payouts
  FOR SELECT USING (creator_id = auth.uid() OR current_profile_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS payout_requests_select_parties ON public.payout_requests;
CREATE POLICY payout_requests_select_parties ON public.payout_requests
  FOR SELECT USING (creator_id = auth.uid() OR current_profile_role() = 'SUPER_ADMIN');

-- LESSON PROGRESS POLICIES
DROP POLICY IF EXISTS progress_user_access ON public.lesson_progress;
CREATE POLICY progress_user_access ON public.lesson_progress
  FOR ALL USING (user_id = auth.uid());

-- CERTIFICATES POLICIES
DROP POLICY IF EXISTS certificates_select_public ON public.certificates;
CREATE POLICY certificates_select_public ON public.certificates FOR SELECT USING (true);

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

-- STORAGE BUCKET PROVISIONING (course-media)
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-media', 'course-media', false)
ON CONFLICT (id) DO NOTHING;
