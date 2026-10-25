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

export const DEFAULT_USER = CORPORATE_PERSONAS.alex_rivera;

export const ROLE_HIERARCHY: Record<Role, number> = {
  EMPLOYEE: 1,
  MANAGER: 2,
  COMPLIANCE_OFFICER: 3,
  SUPER_ADMIN: 4,
};

export function hasPermission(userRole: Role, requiredRole: Role): boolean {
  if (userRole === "SUPER_ADMIN") return true;
  if (userRole === requiredRole) return true;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function getUserById(userId: string): SessionUser | null {
  for (const persona of Object.values(CORPORATE_PERSONAS)) {
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

export function getAllPersonas(): SessionUser[] {
  return Object.values(CORPORATE_PERSONAS);
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
 * Resolves active user from Next.js session cookie or header, falling back to default persona.
 */
export async function getCurrentUser(): Promise<SessionUser> {
  try {
    // Check Next.js request headers
    const headerStore = await headers();
    const headerUserId = headerStore.get("x-lms-user-id");
    if (headerUserId) {
      const u = getUserById(headerUserId);
      if (u) return u;
    }

    // Check cookies
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("lms_user_id");
    if (sessionCookie?.value) {
      const u = getUserById(sessionCookie.value);
      if (u) return u;
    }
  } catch {
    // Outside request context (e.g. CLI script or unit test)
  }

  return getCurrentUserSync();
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
