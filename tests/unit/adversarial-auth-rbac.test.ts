import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  CORPORATE_PERSONAS,
  DEFAULT_USER,
  ROLE_HIERARCHY,
  hasPermission,
  requireRole,
  getUserById,
  getAllPersonas,
  getCurrentUserSync,
} from "../../src/lib/auth";
import { GET, POST } from "../../src/app/api/auth/session/route";
import type { Role, CorporateRole, SessionUser } from "../../src/types";

describe("Adversarial Empirical Challenge — Auth, Session & RBAC Barriers", () => {
  // ==========================================================================
  // SUITE 1: RBAC Hierarchy Matrix (16 Combinations & Boundary Cases)
  // ==========================================================================
  describe("Suite 1: RBAC Hierarchy Matrix & Downward/Upward Checks", () => {
    const roles: CorporateRole[] = ["EMPLOYEE", "MANAGER", "COMPLIANCE_OFFICER", "SUPER_ADMIN"];

    it("1.1 Confirms complete 4x4 permission matrix strictly matches corporate hierarchy", () => {
      // Expected hierarchy: EMPLOYEE(1) <= MANAGER(2) <= COMPLIANCE_OFFICER(3) <= SUPER_ADMIN(4)
      const expectedMatrix: Record<CorporateRole, Record<CorporateRole, boolean>> = {
        EMPLOYEE: {
          EMPLOYEE: true,
          MANAGER: false,
          COMPLIANCE_OFFICER: false,
          SUPER_ADMIN: false,
        },
        MANAGER: {
          EMPLOYEE: true,
          MANAGER: true,
          COMPLIANCE_OFFICER: false,
          SUPER_ADMIN: false,
        },
        COMPLIANCE_OFFICER: {
          EMPLOYEE: true,
          MANAGER: true,
          COMPLIANCE_OFFICER: true,
          SUPER_ADMIN: false,
        },
        SUPER_ADMIN: {
          EMPLOYEE: true,
          MANAGER: true,
          COMPLIANCE_OFFICER: true,
          SUPER_ADMIN: true,
        },
      };

      for (const callerRole of roles) {
        for (const targetRole of roles) {
          const actual = hasPermission(callerRole, targetRole);
          const expected = expectedMatrix[callerRole][targetRole];
          assert.strictEqual(
            actual,
            expected,
            `hasPermission(${callerRole}, ${targetRole}) expected ${expected} but received ${actual}`
          );
        }
      }
    });

    it("1.2 Adversarial inputs to hasPermission (null, undefined, invalid strings) fail closed (return false)", () => {
      // Unknown roles should fail closed
      assert.strictEqual(hasPermission("GUEST" as any, "EMPLOYEE"), false);
      assert.strictEqual(hasPermission("employee" as any, "EMPLOYEE"), false); // Lowercase check
      assert.strictEqual(hasPermission("" as any, "EMPLOYEE"), false);
      assert.strictEqual(hasPermission(null as any, "EMPLOYEE"), false);
      assert.strictEqual(hasPermission(undefined as any, "EMPLOYEE"), false);

      // Calling against unknown requiredRole
      assert.strictEqual(hasPermission("EMPLOYEE", "ROOT" as any), false);
      assert.strictEqual(hasPermission("SUPER_ADMIN", "ROOT" as any), true); // SUPER_ADMIN override
    });
  });

  // ==========================================================================
  // SUITE 2: requireRole 403 Forbidden Barrier Enforcement
  // ==========================================================================
  describe("Suite 2: requireRole 403 Forbidden Barrier Enforcement", () => {
    it("2.1 EMPLOYEE is blocked from MANAGER actions with HTTP 403 and descriptive message", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_alex_rivera"; // EMPLOYEE
      try {
        await assert.rejects(
          async () => {
            await requireRole(["MANAGER"]);
          },
          (err: any) => {
            assert.strictEqual(err.statusCode, 403, "Must return statusCode 403");
            assert.match(
              err.message,
              /Forbidden: Role EMPLOYEE is not permitted to perform this action/
            );
            return true;
          }
        );
      } finally {
        delete process.env.LMS_ACTIVE_USER_ID;
      }
    });

    it("2.2 EMPLOYEE is blocked from COMPLIANCE_OFFICER actions with HTTP 403", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_elena_rostova"; // EMPLOYEE
      try {
        await assert.rejects(
          async () => {
            await requireRole(["COMPLIANCE_OFFICER"]);
          },
          (err: any) => {
            assert.strictEqual(err.statusCode, 403);
            assert.match(err.message, /Forbidden: Role EMPLOYEE is not permitted/);
            return true;
          }
        );
      } finally {
        delete process.env.LMS_ACTIVE_USER_ID;
      }
    });

    it("2.3 EMPLOYEE is blocked from multi-role privileged gates (MANAGER + COMPLIANCE_OFFICER)", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_alex_rivera";
      try {
        await assert.rejects(
          async () => {
            await requireRole(["MANAGER", "COMPLIANCE_OFFICER"]);
          },
          (err: any) => {
            assert.strictEqual(err.statusCode, 403);
            return true;
          }
        );
      } finally {
        delete process.env.LMS_ACTIVE_USER_ID;
      }
    });

    it("2.4 MANAGER is blocked from COMPLIANCE_OFFICER actions with HTTP 403", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_sarah_jenkins"; // MANAGER
      try {
        await assert.rejects(
          async () => {
            await requireRole(["COMPLIANCE_OFFICER"]);
          },
          (err: any) => {
            assert.strictEqual(err.statusCode, 403);
            assert.match(err.message, /Forbidden: Role MANAGER is not permitted/);
            return true;
          }
        );
      } finally {
        delete process.env.LMS_ACTIVE_USER_ID;
      }
    });

    it("2.5 MANAGER is blocked from SUPER_ADMIN actions with HTTP 403", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_sarah_jenkins"; // MANAGER
      try {
        await assert.rejects(
          async () => {
            await requireRole(["SUPER_ADMIN"]);
          },
          (err: any) => {
            assert.strictEqual(err.statusCode, 403);
            assert.match(err.message, /Forbidden: Role MANAGER is not permitted/);
            return true;
          }
        );
      } finally {
        delete process.env.LMS_ACTIVE_USER_ID;
      }
    });

    it("2.6 COMPLIANCE_OFFICER is blocked from SUPER_ADMIN actions with HTTP 403", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_marcus_vance"; // COMPLIANCE_OFFICER
      try {
        await assert.rejects(
          async () => {
            await requireRole(["SUPER_ADMIN"]);
          },
          (err: any) => {
            assert.strictEqual(err.statusCode, 403);
            assert.match(err.message, /Forbidden: Role COMPLIANCE_OFFICER is not permitted/);
            return true;
          }
        );
      } finally {
        delete process.env.LMS_ACTIVE_USER_ID;
      }
    });

    it("2.7 SUPER_ADMIN universally passes all role requirements without 403", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_david_kim"; // SUPER_ADMIN
      try {
        const u1 = await requireRole(["EMPLOYEE"]);
        assert.strictEqual(u1.role, "SUPER_ADMIN");

        const u2 = await requireRole(["MANAGER"]);
        assert.strictEqual(u2.role, "SUPER_ADMIN");

        const u3 = await requireRole(["COMPLIANCE_OFFICER"]);
        assert.strictEqual(u3.role, "SUPER_ADMIN");

        const u4 = await requireRole(["SUPER_ADMIN"]);
        assert.strictEqual(u4.role, "SUPER_ADMIN");

        // Even with empty allowed roles array, SUPER_ADMIN bypasses
        const u5 = await requireRole([]);
        assert.strictEqual(u5.role, "SUPER_ADMIN");
      } finally {
        delete process.env.LMS_ACTIVE_USER_ID;
      }
    });

    it("2.8 Non-admin roles calling requireRole([]) are strictly rejected with 403", async () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_alex_rivera";
      try {
        await assert.rejects(
          async () => {
            await requireRole([]);
          },
          (err: any) => {
            assert.strictEqual(err.statusCode, 403);
            return true;
          }
        );
      } finally {
        delete process.env.LMS_ACTIVE_USER_ID;
      }
    });
  });

  // ==========================================================================
  // SUITE 3: User Lookup Invariants & Adversarial Injections (getUserById)
  // ==========================================================================
  describe("Suite 3: User Lookup & Adversarial Injection Resistance", () => {
    it("3.1 Resolves all 5 built-in personas deterministically", () => {
      const alex = getUserById("usr_alex_rivera");
      const elena = getUserById("usr_elena_rostova");
      const sarah = getUserById("usr_sarah_jenkins");
      const marcus = getUserById("usr_marcus_vance");
      const david = getUserById("usr_david_kim");

      assert.ok(alex && alex.role === "EMPLOYEE");
      assert.ok(elena && elena.role === "EMPLOYEE");
      assert.ok(sarah && sarah.role === "MANAGER");
      assert.ok(marcus && marcus.role === "COMPLIANCE_OFFICER");
      assert.ok(david && david.role === "SUPER_ADMIN");
    });

    it("3.2 Returns null safely for non-existent user IDs", () => {
      assert.strictEqual(getUserById("usr_does_not_exist"), null);
      assert.strictEqual(getUserById(""), null);
      assert.strictEqual(getUserById("   "), null);
    });

    it("3.3 Adversarial SQL injection attempts in userId fail safely to null", () => {
      const injectionPayloads = [
        "' OR '1'='1",
        "usr_alex_rivera' OR '1'='1' --",
        "'; DROP TABLE users; --",
        "usr_david_kim' UNION SELECT * FROM users --",
        "1' OR 1=1 UNION SELECT id, name, email, 'SUPER_ADMIN', department, job_title, NULL, NULL FROM users --",
        "../../etc/passwd",
        "<script>alert('xss')</script>",
        "\0nullbyte",
        "A".repeat(5000), // Buffer overflow attempt
      ];

      for (const payload of injectionPayloads) {
        const result = getUserById(payload);
        assert.strictEqual(
          result,
          null,
          `Payload "${payload.slice(0, 30)}..." should return null, not elevate or leak`
        );
      }
    });

    it("3.4 Case sensitivity check: uppercase persona IDs fail to resolve (enforces strict ID typing)", () => {
      assert.strictEqual(getUserById("USR_ALEX_RIVERA"), null);
      assert.strictEqual(getUserById("usr_Alex_Rivera"), null);
    });
  });

  // ==========================================================================
  // SUITE 4: Persona Switcher API Route (/api/auth/session)
  // ==========================================================================
  describe("Suite 4: Persona Switcher API Endpoint Verification", () => {
    it("4.1 GET /api/auth/session returns 200 with current user and 5 personas", async () => {
      const res = await GET();
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.data.currentUser);
      assert.strictEqual(json.data.currentUser.id, "usr_alex_rivera");
      assert.strictEqual(json.data.personas.length, 5);

      const rolesFound = json.data.personas.map((p: SessionUser) => p.role);
      assert.ok(rolesFound.includes("EMPLOYEE"));
      assert.ok(rolesFound.includes("MANAGER"));
      assert.ok(rolesFound.includes("COMPLIANCE_OFFICER"));
      assert.ok(rolesFound.includes("SUPER_ADMIN"));
    });

    it("4.2 POST /api/auth/session successfully switches to MANAGER and sets secure cookie", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "usr_sarah_jenkins" }),
      });

      const res = await POST(req);
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.user.id, "usr_sarah_jenkins");
      assert.strictEqual(json.data.user.role, "MANAGER");
      assert.match(json.data.message, /Switched active persona to Sarah Jenkins \(MANAGER\)/);

      // Verify cookie properties
      const cookie = res.cookies.get("lms_user_id");
      assert.ok(cookie, "Cookie lms_user_id must be set");
      assert.strictEqual(cookie.value, "usr_sarah_jenkins");
      assert.strictEqual(cookie.path, "/");
      assert.strictEqual(cookie.maxAge, 30 * 24 * 60 * 60); // 30 days
      assert.strictEqual(cookie.sameSite, "lax");
    });

    it("4.3 POST /api/auth/session successfully switches to COMPLIANCE_OFFICER", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "usr_marcus_vance" }),
      });

      const res = await POST(req);
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.user.id, "usr_marcus_vance");
      assert.strictEqual(json.data.user.role, "COMPLIANCE_OFFICER");

      const cookie = res.cookies.get("lms_user_id");
      assert.strictEqual(cookie?.value, "usr_marcus_vance");
    });

    it("4.4 POST /api/auth/session successfully switches to SUPER_ADMIN", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "usr_david_kim" }),
      });

      const res = await POST(req);
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.user.id, "usr_david_kim");
      assert.strictEqual(json.data.user.role, "SUPER_ADMIN");

      const cookie = res.cookies.get("lms_user_id");
      assert.strictEqual(cookie?.value, "usr_david_kim");
    });

    it("4.5 POST /api/auth/session rejects missing userId with 400 Bad Request", async () => {
      const reqEmpty = new NextRequest("http://localhost:3000/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const resEmpty = await POST(reqEmpty);
      assert.strictEqual(resEmpty.status, 400);
      const jsonEmpty = await resEmpty.json();
      assert.strictEqual(jsonEmpty.success, false);
      assert.strictEqual(jsonEmpty.error, "userId is required");

      const reqBlank = new NextRequest("http://localhost:3000/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "" }),
      });
      const resBlank = await POST(reqBlank);
      assert.strictEqual(resBlank.status, 400);
    });

    it("4.6 POST /api/auth/session rejects non-existent userId with 404 Not Found", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "usr_attacker_shadow_account" }),
      });

      const res = await POST(req);
      assert.strictEqual(res.status, 404);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error, "User not found");
    });

    it("4.7 POST /api/auth/session rejects SQL injection payload with 404 Not Found", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "usr_alex_rivera' OR 1=1 --" }),
      });

      const res = await POST(req);
      assert.strictEqual(res.status, 404);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error, "User not found");
    });

    it("4.8 POST /api/auth/session handles malformed JSON without server crash", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "BROKEN_JSON_STRING",
      });

      const res = await POST(req);
      assert.strictEqual(res.status, 500);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.ok(json.error);
    });
  });

  // ==========================================================================
  // SUITE 5: Session Resolution & Fallback Semantics
  // ==========================================================================
  describe("Suite 5: Session Resolution & Fallback Invariants", () => {
    it("5.1 getCurrentUserSync returns DEFAULT_USER when no environment variable is set", () => {
      delete process.env.LMS_ACTIVE_USER_ID;
      const user = getCurrentUserSync();
      assert.strictEqual(user.id, "usr_alex_rivera");
      assert.strictEqual(user.role, "EMPLOYEE");
    });

    it("5.2 getCurrentUserSync returns specified persona when LMS_ACTIVE_USER_ID is set", () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_sarah_jenkins";
      try {
        const user = getCurrentUserSync();
        assert.strictEqual(user.id, "usr_sarah_jenkins");
        assert.strictEqual(user.role, "MANAGER");
      } finally {
        delete process.env.LMS_ACTIVE_USER_ID;
      }
    });

    it("5.3 getCurrentUserSync falls back to DEFAULT_USER if LMS_ACTIVE_USER_ID is invalid", () => {
      process.env.LMS_ACTIVE_USER_ID = "usr_invalid_id_xyz";
      try {
        const user = getCurrentUserSync();
        assert.strictEqual(user.id, "usr_alex_rivera");
        assert.strictEqual(user.role, "EMPLOYEE");
      } finally {
        delete process.env.LMS_ACTIVE_USER_ID;
      }
    });
  });
});
