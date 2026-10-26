import type { Role } from "@/types";

export interface ContentGateResult {
  allowed: boolean;
  status: 200 | 403;
  errorCode?: "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE" | "FORBIDDEN_UNENROLLED";
  error?: "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE" | "FORBIDDEN_UNENROLLED";
  message?: string;
}

export const PRIVACY_SHIELD_CONSTANTS = {
  ERROR_CODE_SUPER_ADMIN: "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE" as const,
  ERROR_CODE_UNENROLLED: "FORBIDDEN_UNENROLLED" as const,
  HTTP_FORBIDDEN: 403,
  ENCRYPTION_SUFFIX: "... [Content Encrypted]" as const,
  BLUR_CSS_CLASSES: "filter blur-md opacity-75 scale-105" as const,
};

/**
 * Masks a course title for Super Admin views:
 * Title prefix (up to 6 chars) + '... [Content Encrypted]'
 * Examples:
 * - "Advanced Next.js Mastery" -> "Advanc... [Content Encrypted]"
 * - "Python" -> "Python... [Content Encrypted]"
 * - "Go" -> "Go... [Content Encrypted]"
 * - "" -> "[Content Encrypted]"
 */
export function maskCourseTitle(title: string | null | undefined): string {
  if (!title || typeof title !== "string") {
    return "[Content Encrypted]";
  }
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return "[Content Encrypted]";
  }
  const prefix = trimmed.length > 6 ? trimmed.slice(0, 6) : trimmed;
  return `${prefix}... [Content Encrypted]`;
}

/**
 * Determines whether a title is encrypted/masked.
 */
export function isTitleMasked(title: string | null | undefined): boolean {
  return typeof title === "string" && title.includes("[Content Encrypted]");
}

/**
 * Content gate security check enforcing Creator IP Privacy:
 * - SUPER_ADMIN is strictly blocked (returns 403 FORBIDDEN_SUPER_ADMIN_CONTENT_GATE).
 * - Author (Co-Admin) and enrolled students are permitted.
 * - All other users are rejected with 403 FORBIDDEN_UNENROLLED.
 */
export function checkContentGate(
  userRole: Role | string,
  isAuthor: boolean,
  isEnrolled: boolean
): ContentGateResult {
  // Gate 1: Strict rejection for Super Admin
  if (userRole === "SUPER_ADMIN") {
    return {
      allowed: false,
      status: 403,
      errorCode: PRIVACY_SHIELD_CONSTANTS.ERROR_CODE_SUPER_ADMIN,
      error: PRIVACY_SHIELD_CONSTANTS.ERROR_CODE_SUPER_ADMIN,
      message: "Super Admin access to creator intellectual property and raw lesson content is strictly restricted.",
    };
  }

  // Gate 2: Authorized Creator or Enrolled Student
  if (isAuthor || isEnrolled) {
    return {
      allowed: true,
      status: 200,
    };
  }

  // Gate 3: Unenrolled access denied
  return {
    allowed: false,
    status: 403,
    errorCode: PRIVACY_SHIELD_CONSTANTS.ERROR_CODE_UNENROLLED,
    error: PRIVACY_SHIELD_CONSTANTS.ERROR_CODE_UNENROLLED,
    message: "You must be enrolled in this course to access lesson content.",
  };
}

/**
 * Throws a 403 error if the user is not permitted to access raw content.
 */
export function assertContentAccess(
  userRole: Role | string,
  isAuthor: boolean,
  isEnrolled: boolean
): void {
  const gate = checkContentGate(userRole, isAuthor, isEnrolled);
  if (!gate.allowed) {
    const error: any = new Error(gate.message || "Access denied");
    error.status = gate.status;
    error.statusCode = gate.status;
    error.code = gate.errorCode;
    throw error;
  }
}

/**
 * Sanitizes a course entity for a given role:
 * Masks title and injects encryption flags if the viewer is SUPER_ADMIN.
 */
export function sanitizeCourseForRole<T extends Record<string, any>>(
  course: T,
  userRole: Role | string
): T & { is_content_encrypted: boolean; thumbnail_blurred: boolean } {
  if (userRole === "SUPER_ADMIN") {
    return {
      ...course,
      title: maskCourseTitle(course.title),
      is_content_encrypted: true,
      thumbnail_blurred: true,
    };
  }
  return {
    ...course,
    is_content_encrypted: false,
    thumbnail_blurred: false,
  };
}

/**
 * Sanitizes an array of courses for a given role.
 */
export function sanitizeCourseCatalogForRole<T extends Record<string, any>>(
  courses: T[],
  userRole: Role | string
): Array<T & { is_content_encrypted: boolean; thumbnail_blurred: boolean }> {
  return courses.map((c) => sanitizeCourseForRole(c, userRole));
}

/**
 * Data Access Layer guard for lesson entities:
 * Redacts video_url, supplementary_files, and raw body for Super Admins or unenrolled users.
 */
export function sanitizeLessonForRole<
  T extends {
    video_url?: string | null;
    content?: string;
    supplementary_files?: any[];
    [key: string]: any;
  }
>(
  lesson: T,
  userRole: Role | string,
  isAuthor: boolean,
  isEnrolled: boolean
): T & { is_content_encrypted: boolean } {
  const gate = checkContentGate(userRole, isAuthor, isEnrolled);

  if (!gate.allowed) {
    return {
      ...lesson,
      video_url: null,
      content: userRole === "SUPER_ADMIN" ? "[Content Encrypted]" : "[Enrolled Content Only]",
      supplementary_files: [],
      is_content_encrypted: true,
    };
  }

  return {
    ...lesson,
    is_content_encrypted: false,
  };
}

/**
 * Returns Tailwind classes and lock badge configuration for cover images
 */
export function getCoverPrivacyStyles(isSuperAdmin: boolean): {
  imageClasses: string;
  isEncrypted: boolean;
  badgeLabel: string;
} {
  if (isSuperAdmin) {
    return {
      imageClasses: "filter blur-md opacity-75 grayscale select-none pointer-events-none",
      isEncrypted: true,
      badgeLabel: "Content Encrypted",
    };
  }
  return {
    imageClasses: "",
    isEncrypted: false,
    badgeLabel: "",
  };
}
