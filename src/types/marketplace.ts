import type { Role } from "./index";

export type MarketplaceRole = "STUDENT" | "CO_ADMIN" | "SUPER_ADMIN";

export type MarketplaceCategory =
  | "SOFTWARE"
  | "BUSINESS"
  | "DESIGN"
  | "MARKETING"
  | "SECURITY"
  | "DATA_SCIENCE"
  | "COMPLIANCE";

export interface FileAttachment {
  id: string;
  name: string;
  file_url: string;
  url?: string;
  file_size_bytes: number;
  size_bytes?: number;
  file_type: "PDF" | "ZIP" | "DOCUMENT" | "OTHER";
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correct_index: number;
  explanation?: string;
}

export interface WeekQuiz {
  id: string;
  week_id: string;
  course_id: string;
  title: string;
  passing_score_pct: number;
  questions: QuizQuestion[];
  created_at?: string;
  updated_at?: string;
}

export interface Lesson {
  id: string;
  week_id: string;
  course_id: string;
  title: string;
  order_index: number;
  duration_seconds: number;
  video_url: string | null;
  supplementary_files: FileAttachment[];
  is_preview: boolean;
  created_at: string;
  updated_at: string;
}

export interface CurriculumWeek {
  id: string;
  course_id: string;
  week_number: number;
  title: string;
  description: string;
  lessons: Lesson[];
  quiz?: WeekQuiz | null;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceCourse {
  id: string;
  creator_id: string;
  creator_name?: string;
  title: string;
  slug: string;
  description: string;
  category: MarketplaceCategory;
  price_cents: number;
  price_dollars: number;
  thumbnail_url: string | null;
  is_published: boolean;
  total_weeks: number;
  weeks?: CurriculumWeek[];
  enrolled_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance_cents: number;
  balance_dollars: number;
  currency: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  course_id: string;
  student_id: string;
  creator_id: string;
  amount_cents: number;
  platform_fee_cents: number;
  creator_payout_cents: number;
  currency: string;
  status: "COMPLETED" | "REFUNDED" | "FAILED";
  created_at: string;
}

export interface PayoutRequest {
  id: string;
  creator_id: string;
  amount_cents: number;
  status: "PENDING" | "PROCESSED" | "REJECTED";
  requested_at: string;
  processed_at: string | null;
  notes?: string | null;
}

export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  course_id: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  completed_at: string | null;
  last_position_seconds: number;
}

export interface CourseCertificate {
  id: string;
  certificate_code: string;
  user_id: string;
  course_id: string;
  course_title: string;
  student_name: string;
  verification_badge_url: string;
  issued_at: string;
  verification_hash: string;
}

export interface ContentGateResult {
  allowed: boolean;
  status?: number;
  error?: string;
}

export interface RevenueSplitResult {
  amountCents: number;
  platformFeeCents: number;
  creatorPayoutCents: number;
  platformFeeDollars: number;
  creatorPayoutDollars: number;
}
