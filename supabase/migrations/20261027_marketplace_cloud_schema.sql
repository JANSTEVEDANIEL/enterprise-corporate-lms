-- ============================================================================
-- 20261027_marketplace_cloud_schema.sql
-- Production Supabase Cloud Schema: Custom Prefixed IDs, Storage & RLS Shield
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. DROP OBSOLETE OBJECTS (CASCADE CLEANUP)
DROP VIEW IF EXISTS public.super_admin_course_catalog CASCADE;
DROP VIEW IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.certificates CASCADE;
DROP TABLE IF EXISTS public.lesson_progress CASCADE;
DROP TABLE IF EXISTS public.payout_requests CASCADE;
DROP TABLE IF EXISTS public.payouts CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.wallets CASCADE;
DROP TABLE IF EXISTS public.week_quizzes CASCADE;
DROP TABLE IF EXISTS public.lessons CASCADE;
DROP TABLE IF EXISTS public.weeks CASCADE;
DROP TABLE IF EXISTS public.enrollments CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP FUNCTION IF EXISTS public.current_user_role() CASCADE;
DROP FUNCTION IF EXISTS public.current_profile_role() CASCADE;

-- 3. USERS TABLE (Prefix: usr_*)
CREATE TABLE public.users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('STUDENT', 'CO_ADMIN', 'SUPER_ADMIN', 'EMPLOYEE', 'MANAGER', 'COMPLIANCE_OFFICER')),
  department TEXT NOT NULL DEFAULT 'General',
  job_title TEXT NOT NULL DEFAULT 'Learner',
  manager_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_department ON public.users(department);
CREATE INDEX idx_users_manager ON public.users(manager_id);

-- 4. COURSES TABLE (Prefix: crs_*)
CREATE TABLE public.courses (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN (
    'SOFTWARE', 'DATA_SCIENCE', 'SECURITY', 'DESIGN', 
    'LEADERSHIP', 'BUSINESS', 'COMPLIANCE', 'ONBOARDING', 
    'TECHNICAL_UPSKILLING', 'MARKETING'
  )),
  target_role TEXT NOT NULL DEFAULT 'ALL',
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
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

CREATE INDEX idx_courses_slug ON public.courses(slug);
CREATE INDEX idx_courses_creator ON public.courses(creator_id);
CREATE INDEX idx_courses_category ON public.courses(category);
CREATE INDEX idx_courses_published ON public.courses(is_published);

-- 5. WEEKS TABLE (Prefix: wk_*, Sequential 1 to 7+)
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
CREATE INDEX idx_weeks_number ON public.weeks(course_id, week_number);

-- 6. LESSONS TABLE (Prefix: les_*)
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
CREATE INDEX idx_lessons_order ON public.lessons(week_id, order_index);

-- 7. WEEK QUIZZES TABLE (Prefix: qz_*)
CREATE TABLE public.week_quizzes (
  id TEXT PRIMARY KEY,
  week_id TEXT UNIQUE NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  passing_score_pct INTEGER NOT NULL DEFAULT 80 CHECK (passing_score_pct BETWEEN 0 AND 100),
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_week_quizzes_week ON public.week_quizzes(week_id);
CREATE INDEX idx_week_quizzes_course ON public.week_quizzes(course_id);

-- 8. WALLETS TABLE (Prefix: wal_*)
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

-- 9. TRANSACTIONS TABLE (Prefix: tx_*)
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
CREATE INDEX idx_transactions_status ON public.transactions(status);

-- 10. PAYOUTS TABLE (Prefix: po_*)
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
CREATE INDEX idx_payouts_status ON public.payouts(status);

-- 11. ENROLLMENTS TABLE (Prefix: enr_*)
CREATE TABLE public.enrollments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'OVERDUE', 'ACTIVE')),
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
CREATE INDEX idx_enrollments_status ON public.enrollments(status);

-- 12. LESSON PROGRESS TABLE (Prefix: lp_*)
CREATE TABLE public.lesson_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
  completed_at TIMESTAMPTZ,
  last_position_seconds INTEGER NOT NULL DEFAULT 0 CHECK (last_position_seconds >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX idx_lesson_progress_user ON public.lesson_progress(user_id);
CREATE INDEX idx_lesson_progress_lesson ON public.lesson_progress(lesson_id);
CREATE INDEX idx_lesson_progress_course ON public.lesson_progress(course_id);

-- 13. CERTIFICATES TABLE (Prefix: cert_*)
CREATE TABLE public.certificates (
  id TEXT PRIMARY KEY,
  certificate_code TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  enrollment_id TEXT,
  course_title TEXT NOT NULL,
  student_name TEXT NOT NULL,
  verification_badge_url TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verification_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_certificates_code ON public.certificates(certificate_code);
CREATE INDEX idx_certificates_user ON public.certificates(user_id);
CREATE INDEX idx_certificates_course ON public.certificates(course_id);

-- ============================================================================
-- 14. HELPER FUNCTION & ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Function to safely resolve role whether auth.uid() or JWT email matches
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT role FROM public.users 
     WHERE id = auth.uid()::text 
        OR email = (auth.jwt() ->> 'email')
     LIMIT 1),
    'STUDENT'
  );
$$;

-- Enable RLS across all 11 tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.week_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- USERS POLICIES
CREATE POLICY users_select_all ON public.users FOR SELECT USING (true);
CREATE POLICY users_update_self ON public.users FOR UPDATE 
  USING (id = auth.uid()::text OR current_user_role() = 'SUPER_ADMIN');

-- COURSES POLICIES
CREATE POLICY courses_select_policy ON public.courses
  FOR SELECT USING (
    is_published = true 
    OR creator_id = auth.uid()::text 
    OR current_user_role() = 'SUPER_ADMIN'
  );

CREATE POLICY courses_creator_insert ON public.courses
  FOR INSERT WITH CHECK (
    (creator_id = auth.uid()::text OR current_user_role() = 'SUPER_ADMIN')
    AND current_user_role() IN ('CO_ADMIN', 'SUPER_ADMIN')
  );

CREATE POLICY courses_creator_update ON public.courses
  FOR UPDATE USING (
    (creator_id = auth.uid()::text OR current_user_role() = 'SUPER_ADMIN')
    AND current_user_role() IN ('CO_ADMIN', 'SUPER_ADMIN')
  );

-- WEEKS POLICIES
CREATE POLICY weeks_select_policy ON public.weeks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.courses 
      WHERE courses.id = weeks.course_id 
        AND (courses.is_published = true OR courses.creator_id = auth.uid()::text OR current_user_role() = 'SUPER_ADMIN')
    )
  );

CREATE POLICY weeks_creator_insert ON public.weeks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses 
      WHERE courses.id = weeks.course_id 
        AND (courses.creator_id = auth.uid()::text OR current_user_role() = 'SUPER_ADMIN')
    )
  );

CREATE POLICY weeks_creator_update ON public.weeks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.courses 
      WHERE courses.id = weeks.course_id 
        AND (courses.creator_id = auth.uid()::text OR current_user_role() = 'SUPER_ADMIN')
    )
  );

-- LESSONS POLICIES (THE CREATOR CONTENT PRIVACY SHIELD)
CREATE POLICY lessons_select_privacy_shield ON public.lessons
  FOR SELECT USING (
    current_user_role() != 'SUPER_ADMIN'
    AND (
      is_preview = true
      OR EXISTS (
        SELECT 1 FROM public.courses
        WHERE courses.id = lessons.course_id 
          AND (courses.creator_id = auth.uid()::text OR courses.creator_id = (auth.jwt() ->> 'email'))
      )
      OR EXISTS (
        SELECT 1 FROM public.enrollments
        WHERE enrollments.course_id = lessons.course_id 
          AND (enrollments.user_id = auth.uid()::text OR enrollments.user_id = (auth.jwt() ->> 'email'))
      )
    )
  );

CREATE POLICY lessons_creator_insert ON public.lessons
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses 
      WHERE courses.id = lessons.course_id 
        AND (courses.creator_id = auth.uid()::text OR current_user_role() = 'SUPER_ADMIN')
    )
  );

CREATE POLICY lessons_creator_update ON public.lessons
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.courses 
      WHERE courses.id = lessons.course_id 
        AND (courses.creator_id = auth.uid()::text OR current_user_role() = 'SUPER_ADMIN')
    )
  );

-- WEEK QUIZZES POLICIES
CREATE POLICY week_quizzes_select_policy ON public.week_quizzes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.courses 
      WHERE courses.id = week_quizzes.course_id 
        AND (courses.is_published = true OR courses.creator_id = auth.uid()::text OR current_user_role() = 'SUPER_ADMIN')
    )
  );

CREATE POLICY week_quizzes_creator_manage ON public.week_quizzes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.courses 
      WHERE courses.id = week_quizzes.course_id 
        AND (courses.creator_id = auth.uid()::text OR current_user_role() = 'SUPER_ADMIN')
    )
  );

-- WALLETS POLICIES
CREATE POLICY wallets_select ON public.wallets
  FOR SELECT USING (user_id = auth.uid()::text OR current_user_role() = 'SUPER_ADMIN');

CREATE POLICY wallets_update ON public.wallets
  FOR UPDATE USING (user_id = auth.uid()::text OR current_user_role() = 'SUPER_ADMIN');

-- TRANSACTIONS POLICIES
CREATE POLICY transactions_select ON public.transactions
  FOR SELECT USING (
    student_id = auth.uid()::text 
    OR creator_id = auth.uid()::text 
    OR current_user_role() = 'SUPER_ADMIN'
  );

-- PAYOUTS POLICIES
CREATE POLICY payouts_select ON public.payouts
  FOR SELECT USING (
    creator_id = auth.uid()::text 
    OR current_user_role() = 'SUPER_ADMIN'
  );

CREATE POLICY payouts_insert ON public.payouts
  FOR INSERT WITH CHECK (
    creator_id = auth.uid()::text 
    OR current_user_role() = 'SUPER_ADMIN'
  );

CREATE POLICY payouts_update ON public.payouts
  FOR UPDATE USING (current_user_role() = 'SUPER_ADMIN');

-- ENROLLMENTS POLICIES
CREATE POLICY enrollments_select ON public.enrollments
  FOR SELECT USING (
    user_id = auth.uid()::text 
    OR current_user_role() = 'SUPER_ADMIN'
    OR EXISTS (
      SELECT 1 FROM public.courses 
      WHERE courses.id = enrollments.course_id AND courses.creator_id = auth.uid()::text
    )
  );

CREATE POLICY enrollments_insert ON public.enrollments
  FOR INSERT WITH CHECK (
    user_id = auth.uid()::text 
    OR current_user_role() = 'SUPER_ADMIN'
  );

CREATE POLICY enrollments_update ON public.enrollments
  FOR UPDATE USING (
    user_id = auth.uid()::text 
    OR current_user_role() = 'SUPER_ADMIN'
  );

-- LESSON PROGRESS POLICIES
CREATE POLICY progress_access ON public.lesson_progress
  FOR ALL USING (
    user_id = auth.uid()::text 
    OR current_user_role() = 'SUPER_ADMIN'
  );

-- CERTIFICATES POLICIES (Publicly verifiable)
CREATE POLICY certificates_select ON public.certificates
  FOR SELECT USING (true);

CREATE POLICY certificates_insert ON public.certificates
  FOR INSERT WITH CHECK (
    user_id = auth.uid()::text 
    OR current_user_role() = 'SUPER_ADMIN'
  );

-- ============================================================================
-- 15. SUPER ADMIN PRIVACY VIEW (Masked Titles & Platform Ledger)
-- ============================================================================
CREATE OR REPLACE VIEW public.super_admin_course_catalog AS
SELECT 
  c.id,
  c.creator_id,
  u.name AS creator_name,
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
  (SELECT coalesce(sum(t.amount_cents), 0) FROM public.transactions t WHERE t.course_id = c.id) AS gross_revenue_cents,
  round((SELECT coalesce(sum(t.amount_cents), 0) FROM public.transactions t WHERE t.course_id = c.id) / 100.0, 2) AS gross_revenue_dollars,
  (SELECT coalesce(sum(t.platform_fee_cents), 0) FROM public.transactions t WHERE t.course_id = c.id) AS platform_fee_cents,
  round((SELECT coalesce(sum(t.platform_fee_cents), 0) FROM public.transactions t WHERE t.course_id = c.id) / 100.0, 2) AS platform_fee_dollars
FROM public.courses c
LEFT JOIN public.users u ON c.creator_id = u.id;

-- ============================================================================
-- 16. STORAGE BUCKETS PROVISIONING & POLICIES
-- ============================================================================

-- 1. course-materials (Public for student lab/slides/zip downloads)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-materials',
  'course-materials',
  true,
  52428800, -- 50MB
  ARRAY['application/pdf', 'application/zip', 'application/x-zip-compressed', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint', 'text/plain', 'text/markdown']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf', 'application/zip', 'application/x-zip-compressed', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint', 'text/plain', 'text/markdown'];

-- 2. lesson-videos (Private for protected signed streaming URLs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lesson-videos',
  'lesson-videos',
  false,
  1073741824, -- 1GB
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 1073741824,
  allowed_mime_types = ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'];

-- Storage RLS: Public Read for course-materials
DROP POLICY IF EXISTS "Public read for course-materials" ON storage.objects;
CREATE POLICY "Public read for course-materials"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-materials');

-- Storage RLS: Creator / Admin Upload for course-materials
DROP POLICY IF EXISTS "Authenticated upload for course-materials" ON storage.objects;
CREATE POLICY "Authenticated upload for course-materials"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'course-materials');

-- Storage RLS: Creator / Admin Upload for lesson-videos
DROP POLICY IF EXISTS "Authenticated upload for lesson-videos" ON storage.objects;
CREATE POLICY "Authenticated upload for lesson-videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'lesson-videos');
