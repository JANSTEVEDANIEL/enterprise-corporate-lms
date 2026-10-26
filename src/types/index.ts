export type CorporateRole = "EMPLOYEE" | "MANAGER" | "COMPLIANCE_OFFICER" | "SUPER_ADMIN";
export type MarketplaceRole = "STUDENT" | "CO_ADMIN" | "SUPER_ADMIN";
export type Role =
  | "EMPLOYEE"
  | "MANAGER"
  | "COMPLIANCE_OFFICER"
  | "SUPER_ADMIN"
  | "STUDENT"
  | "CO_ADMIN";

export type CourseCategory =
  | "ONBOARDING"
  | "COMPLIANCE"
  | "SECURITY"
  | "TECHNICAL_UPSKILLING"
  | "LEADERSHIP";

export type ModuleType = "RICH_MARKDOWN" | "VIDEO_EMBED" | "INTERACTIVE_QUIZ";

export type EnrollmentStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "EXPIRED"
  | "OVERDUE";

export type ModuleProgressStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";

export type ComplianceRenewalStatus =
  | "VALID"
  | "EXPIRING_SOON"
  | "EXPIRED"
  | "NOT_STARTED";

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
  role: Role;
  department: string;
  job_title: string;
  manager_id?: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  jobTitle: string;
  avatarUrl?: string;
  managerId?: string | null;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: CourseCategory;
  target_role: string;
  is_mandatory: number;
  estimated_minutes: number;
  renewal_period_days: number | null;
  passing_score_pct: number;
  version: string;
  is_published: number;
  created_at: string;
  updated_at: string;
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  description?: string | null;
  order_index: number;
  type: ModuleType;
  content: string;
  estimated_minutes: number;
  version: string;
  created_at: string;
  updated_at: string;
}

export interface Quiz {
  id: string;
  module_id: string;
  title: string;
  passing_score_pct: number;
  time_limit_minutes?: number | null;
  created_at: string;
  updated_at: string;
}

export interface QuizQuestionOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  order_index: number;
  prompt: string;
  question_type: QuestionType;
  options: string; // JSON string of QuizQuestionOption[]
  correct_answers: string; // JSON string of string[] (option IDs)
  explanation: string;
  created_at: string;
}

export interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  status: EnrollmentStatus;
  progress_pct: number;
  assigned_by?: string | null;
  assigned_at: string;
  due_date?: string | null;
  completed_at?: string | null;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ModuleProgress {
  id: string;
  enrollment_id: string;
  module_id: string;
  user_id: string;
  status: ModuleProgressStatus;
  completed_at?: string | null;
  time_spent_seconds: number;
  last_position_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface QuizSubmission {
  id: string;
  enrollment_id: string;
  module_id: string;
  user_id: string;
  score: number;
  passed: number;
  attempt_number: number;
  answers_payload: string; // JSON
  feedback_payload: string; // JSON
  submitted_at: string;
}

export interface Certificate {
  id: string;
  certificate_code: string;
  user_id: string;
  course_id: string;
  enrollment_id: string;
  course_title: string;
  course_version: string;
  user_name: string;
  user_email: string;
  score: number;
  issued_at: string;
  expires_at?: string | null;
  verification_hash: string;
  created_at: string;
}

export interface AuditLogRecord {
  id: number;
  uuid: string;
  timestamp: string;
  actor_id: string;
  actor_role: Role;
  actor_name: string;
  action: string;
  target_type: string;
  target_id: string;
  course_id?: string | null;
  module_id?: string | null;
  module_version?: string | null;
  score?: number | null;
  metadata?: string | null;
  prev_hash: string;
  record_hash: string;
  signature?: string | null;
}

export interface SanitizedQuestion {
  id: string;
  order_index: number;
  prompt: string;
  question_type: QuestionType;
  options: QuizQuestionOption[];
}

export interface SanitizedQuiz {
  id: string;
  module_id: string;
  title: string;
  passing_score_pct: number;
  time_limit_minutes: number | null;
  questions: SanitizedQuestion[];
}

export * from "./marketplace";
