import { cookies, headers } from "next/headers";
import type { Role, SessionUser } from "@/types";
import { getDb, initDb } from "@/lib/db";

export type { Role, SessionUser };

export const CORPORATE_PERSONAS: Record<string, SessionUser> = {
  alex_rivera: {
    id: "usr_alex_rivera",
    name: "Alex Rivera",
    email: "alex.rivera@enterprise.corp",
    role: "EMPLOYEE",
    department: "Engineering",
    jobTitle: "Junior Software Engineer",
    avatarUrl: "/avatars/alex.jpg",
    managerId: "usr_sarah_jenkins",
  },
  elena_rostova: {
    id: "usr_elena_rostova",
    name: "Elena Rostova",
    email: "elena.rostova@enterprise.corp",
    role: "EMPLOYEE",
    department: "Security",
    jobTitle: "Senior Security Engineer",
    avatarUrl: "/avatars/elena.jpg",
    managerId: "usr_sarah_jenkins",
  },
  sarah_jenkins: {
    id: "usr_sarah_jenkins",
    name: "Sarah Jenkins",
    email: "sarah.jenkins@enterprise.corp",
    role: "MANAGER",
    department: "Engineering",
    jobTitle: "Engineering Manager",
    avatarUrl: "/avatars/sarah.jpg",
    managerId: "usr_david_kim",
  },
  marcus_vance: {
    id: "usr_marcus_vance",
    name: "Marcus Vance",
    email: "marcus.vance@enterprise.corp",
    role: "COMPLIANCE_OFFICER",
    department: "People Ops",
    jobTitle: "Head of Corporate Compliance",
    avatarUrl: "/avatars/marcus.jpg",
    managerId: "usr_david_kim",
  },
  david_kim: {
    id: "usr_david_kim",
    name: "David Kim",
    email: "david.kim@enterprise.corp",
    role: "SUPER_ADMIN",
    department: "Operations",
    jobTitle: "VP of Operations & Super Admin",
    avatarUrl: "/avatars/david.jpg",
    managerId: null,
  },
};

export const MARKETPLACE_PERSONAS: Record<string, SessionUser> = {
  sophia_chen: {
    id: "usr_sophia_chen",
    name: "Sophia Chen",
    email: "sophia.chen@edtech.marketplace",
    role: "STUDENT",
    department: "Student Learner Hub",
    jobTitle: "Enrolled Student ($500.00 Wallet)",
    avatarUrl: "/avatars/sophia.jpg",
    managerId: null,
  },
  aris_thorne: {
    id: "usr_aris_thorne",
    name: "Dr. Aris Thorne",
    email: "aris.thorne@edtech.marketplace",
    role: "CO_ADMIN",
    department: "Creator Studio",
    jobTitle: "Lead AI & Distributed Systems Instructor",
    avatarUrl: "/avatars/aris.jpg",
    managerId: null,
  },
  david_kim: {
    id: "usr_david_kim",
    name: "David Kim",
    email: "david.kim@enterprise.corp",
    role: "SUPER_ADMIN",
    department: "Platform Operations",
    jobTitle: "Platform Operator & Super Admin",
    avatarUrl: "/avatars/david.jpg",
    managerId: null,
  },
};

export const DEFAULT_USER = CORPORATE_PERSONAS.alex_rivera;

export const ROLE_HIERARCHY: Record<Role, number> = {
  EMPLOYEE: 1,
  STUDENT: 1,
  MANAGER: 2,
  CO_ADMIN: 3,
  COMPLIANCE_OFFICER: 3,
  SUPER_ADMIN: 4,
};

export function hasPermission(userRole: Role, requiredRole: Role): boolean {
  if (userRole === "SUPER_ADMIN") return true;
  if (userRole === requiredRole) return true;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function getUserById(userId: string): SessionUser | null {
  if (!userId || typeof userId !== "string") return null;

  for (const persona of Object.values(CORPORATE_PERSONAS)) {
    if (persona.id === userId) {
      return persona;
    }
  }

  for (const persona of Object.values(MARKETPLACE_PERSONAS)) {
    if (persona.id === userId) {
      return persona;
    }
  }

  try {
    initDb();
    const db = getDb();
    const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
    const user = stmt.get(userId) as any;
    if (user) {
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as Role,
        department: user.department,
        jobTitle: user.job_title,
        avatarUrl: user.avatar_url || undefined,
        managerId: user.manager_id,
      };
    }
  } catch {
    // database not available or not initialized
  }

  return null;
}

/**
 * Returns corporate personas for corporate evaluation and existing test invariants (5 personas).
 */
export function getAllPersonas(): SessionUser[] {
  return Object.values(CORPORATE_PERSONAS);
}

/**
 * Returns marketplace personas for the multi-sided EdTech course marketplace (Sophia, Aris, David).
 */
export function getMarketplacePersonas(): SessionUser[] {
  return Object.values(MARKETPLACE_PERSONAS);
}

/**
 * Returns all active personas across both corporate and marketplace domains.
 */
export function getAllActivePersonas(): SessionUser[] {
  const map = new Map<string, SessionUser>();
  for (const p of Object.values(CORPORATE_PERSONAS)) map.set(p.id, p);
  for (const p of Object.values(MARKETPLACE_PERSONAS)) map.set(p.id, p);
  return Array.from(map.values());
}

/**
 * Resolves current user synchronously from environment or fallback.
 */
export function getCurrentUserSync(): SessionUser {
  const envUserId = process.env.LMS_ACTIVE_USER_ID;
  if (envUserId) {
    const user = getUserById(envUserId);
    if (user) return user;
  }
  return DEFAULT_USER;
}

/**
 * Helper to match role string to persona.
 */
function getPersonaByRoleKeyword(keyword: string): SessionUser | null {
  const upper = keyword.trim().toUpperCase();
  if (upper === "STUDENT") return MARKETPLACE_PERSONAS.sophia_chen;
  if (upper === "CO_ADMIN" || upper === "CREATOR" || upper === "INSTRUCTOR") return MARKETPLACE_PERSONAS.aris_thorne;
  if (upper === "SUPER_ADMIN" || upper === "ADMIN") return MARKETPLACE_PERSONAS.david_kim;
  if (upper === "EMPLOYEE") return CORPORATE_PERSONAS.alex_rivera;
  if (upper === "MANAGER") return CORPORATE_PERSONAS.sarah_jenkins;
  if (upper === "COMPLIANCE_OFFICER") return CORPORATE_PERSONAS.marcus_vance;
  return null;
}

/**
 * Resolves active session user from request query params, cookies, or headers,
 * smoothly supporting both marketplace personas and legacy corporate personas.
 */
export async function resolveSessionUser(request?: any): Promise<SessionUser> {
  // 1. Direct request parameter / headers / cookies parsing
  if (request) {
    // A. Query parameters (e.g. ?userId=usr_sophia_chen or ?role=STUDENT)
    try {
      let searchParams: URLSearchParams | null = null;
      if (request.nextUrl && request.nextUrl.searchParams) {
        searchParams = request.nextUrl.searchParams;
      } else if (typeof request.url === "string") {
        const parsed = new URL(request.url, "http://localhost");
        searchParams = parsed.searchParams;
      } else if (request.searchParams instanceof URLSearchParams) {
        searchParams = request.searchParams;
      }

      if (searchParams) {
        const queryUserId = searchParams.get("userId") || searchParams.get("lms_user_id") || searchParams.get("user");
        if (queryUserId) {
          const u = getUserById(queryUserId);
          if (u) return u;
        }

        const queryRole = searchParams.get("role") || searchParams.get("as");
        if (queryRole) {
          const matched = getPersonaByRoleKeyword(queryRole);
          if (matched) return matched;
        }
      }
    } catch {
      // Ignore URL parse exceptions
    }

    // B. Direct request headers
    if (request.headers && typeof request.headers.get === "function") {
      const headerUserId = request.headers.get("x-lms-user-id");
      if (headerUserId) {
        const u = getUserById(headerUserId);
        if (u) return u;
      }
      const headerRole = request.headers.get("x-lms-role");
      if (headerRole) {
        const matched = getPersonaByRoleKeyword(headerRole);
        if (matched) return matched;
      }
    }

    // C. Direct request cookies
    if (request.cookies && typeof request.cookies.get === "function") {
      const cookieVal = request.cookies.get("lms_user_id");
      const cookieUserId = typeof cookieVal === "string" ? cookieVal : cookieVal?.value;
      if (cookieUserId) {
        const u = getUserById(cookieUserId);
        if (u) return u;
      }
    }
  }

  // 2. Next.js server context (headers() and cookies())
  try {
    const headerStore = await headers();
    const headerUserId = headerStore.get("x-lms-user-id");
    if (headerUserId) {
      const u = getUserById(headerUserId);
      if (u) return u;
    }
    const headerRole = headerStore.get("x-lms-role");
    if (headerRole) {
      const matched = getPersonaByRoleKeyword(headerRole);
      if (matched) return matched;
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("lms_user_id");
    if (sessionCookie?.value) {
      const u = getUserById(sessionCookie.value);
      if (u) return u;
    }
  } catch {
    // Outside request context (e.g. CLI script or unit test)
  }

  // 3. Fallback to synchronous environment or default user
  return getCurrentUserSync();
}

/**
 * Resolves active user from Next.js session cookie or header, falling back to default persona.
 * Kept for full backwards-compatibility.
 */
export async function getCurrentUser(request?: any): Promise<SessionUser> {
  return resolveSessionUser(request);
}

/**
 * Asserts that the current user has one of the allowed roles.
 * Throws an Error with 403 status if unauthorized.
 */
export async function requireRole(allowedRoles: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!allowedRoles.includes(user.role) && user.role !== "SUPER_ADMIN") {
    const err = new Error(`Forbidden: Role ${user.role} is not permitted to perform this action`);
    (err as any).statusCode = 403;
    throw err;
  }
  return user;
}
