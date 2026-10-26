import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  MARKETPLACE_PERSONAS,
  CORPORATE_PERSONAS,
  getMarketplacePersonas,
  getAllPersonas,
  getAllActivePersonas,
  getUserById,
  resolveSessionUser,
  hasPermission,
} from "../../src/lib/auth";
import { GET, POST } from "../../src/app/api/auth/session/route";

describe("Milestone 2: Role Switcher, Session Integration & Decoupled Routing Suite", () => {
  // ==========================================================================
  // SUITE 1: Marketplace Personas Configuration & Invariants
  // ==========================================================================
  describe("1. Marketplace Personas Configuration", () => {
    it("1.1 Confirms Sophia Chen is configured as first-class STUDENT persona", () => {
      const sophia = MARKETPLACE_PERSONAS.sophia_chen;
      assert.ok(sophia, "Sophia Chen must be defined in MARKETPLACE_PERSONAS");
      assert.strictEqual(sophia.id, "usr_sophia_chen");
      assert.strictEqual(sophia.name, "Sophia Chen");
      assert.strictEqual(sophia.role, "STUDENT");
      assert.strictEqual(sophia.email, "sophia.chen@edtech.marketplace");
    });

    it("1.2 Confirms Dr. Aris Thorne is configured as first-class CO_ADMIN creator persona", () => {
      const aris = MARKETPLACE_PERSONAS.aris_thorne;
      assert.ok(aris, "Dr. Aris Thorne must be defined in MARKETPLACE_PERSONAS");
      assert.strictEqual(aris.id, "usr_aris_thorne");
      assert.strictEqual(aris.name, "Dr. Aris Thorne");
      assert.strictEqual(aris.role, "CO_ADMIN");
      assert.strictEqual(aris.email, "aris.thorne@edtech.marketplace");
    });

    it("1.3 Confirms David Kim is configured as first-class SUPER_ADMIN platform operator", () => {
      const david = MARKETPLACE_PERSONAS.david_kim;
      assert.ok(david, "David Kim must be defined in MARKETPLACE_PERSONAS");
      assert.strictEqual(david.id, "usr_david_kim");
      assert.strictEqual(david.name, "David Kim");
      assert.strictEqual(david.role, "SUPER_ADMIN");
    });

    it("1.4 getMarketplacePersonas returns exactly 3 marketplace personas", () => {
      const list = getMarketplacePersonas();
      assert.strictEqual(list.length, 3);
      const ids = list.map((p) => p.id);
      assert.ok(ids.includes("usr_sophia_chen"));
      assert.ok(ids.includes("usr_aris_thorne"));
      assert.ok(ids.includes("usr_david_kim"));
    });

    it("1.5 Preserves backward compatibility: getAllPersonas returns exactly 5 corporate personas", () => {
      const list = getAllPersonas();
      assert.strictEqual(list.length, 5);
      const ids = list.map((p) => p.id);
      assert.ok(ids.includes("usr_alex_rivera"));
      assert.ok(ids.includes("usr_elena_rostova"));
      assert.ok(ids.includes("usr_sarah_jenkins"));
      assert.ok(ids.includes("usr_marcus_vance"));
      assert.ok(ids.includes("usr_david_kim"));
    });

    it("1.6 getAllActivePersonas returns all unique corporate and marketplace personas", () => {
      const all = getAllActivePersonas();
      assert.strictEqual(all.length, 7); // 5 corporate + 2 new marketplace (David Kim is in both)
    });
  });

  // ==========================================================================
  // SUITE 2: User Lookup (getUserById)
  // ==========================================================================
  describe("2. User Lookup Resolution (getUserById)", () => {
    it("2.1 Resolves Sophia Chen by user ID", () => {
      const user = getUserById("usr_sophia_chen");
      assert.ok(user);
      assert.strictEqual(user?.id, "usr_sophia_chen");
      assert.strictEqual(user?.role, "STUDENT");
      assert.strictEqual(user?.name, "Sophia Chen");
    });

    it("2.2 Resolves Dr. Aris Thorne by user ID", () => {
      const user = getUserById("usr_aris_thorne");
      assert.ok(user);
      assert.strictEqual(user?.id, "usr_aris_thorne");
      assert.strictEqual(user?.role, "CO_ADMIN");
      assert.strictEqual(user?.name, "Dr. Aris Thorne");
    });

    it("2.3 Resolves David Kim by user ID", () => {
      const user = getUserById("usr_david_kim");
      assert.ok(user);
      assert.strictEqual(user?.id, "usr_david_kim");
      assert.strictEqual(user?.role, "SUPER_ADMIN");
    });

    it("2.4 Resolves legacy corporate user Alex Rivera by user ID", () => {
      const user = getUserById("usr_alex_rivera");
      assert.ok(user);
      assert.strictEqual(user?.id, "usr_alex_rivera");
      assert.strictEqual(user?.role, "EMPLOYEE");
    });
  });

  // ==========================================================================
  // SUITE 3: Multi-Source Session Resolution (resolveSessionUser)
  // ==========================================================================
  describe("3. Multi-Source Session Resolution (resolveSessionUser)", () => {
    it("3.1 Resolves persona from request query parameter ?userId=usr_sophia_chen", async () => {
      const req = new NextRequest("http://localhost:3000/marketplace?userId=usr_sophia_chen");
      const user = await resolveSessionUser(req);
      assert.strictEqual(user.id, "usr_sophia_chen");
      assert.strictEqual(user.role, "STUDENT");
    });

    it("3.2 Resolves persona from request query parameter ?role=CO_ADMIN", async () => {
      const req = new NextRequest("http://localhost:3000/studio?role=CO_ADMIN");
      const user = await resolveSessionUser(req);
      assert.strictEqual(user.id, "usr_aris_thorne");
      assert.strictEqual(user.role, "CO_ADMIN");
    });

    it("3.3 Resolves persona from request query parameter ?as=student", async () => {
      const req = new NextRequest("http://localhost:3000/dashboard?as=student");
      const user = await resolveSessionUser(req);
      assert.strictEqual(user.id, "usr_sophia_chen");
      assert.strictEqual(user.role, "STUDENT");
    });

    it("3.4 Resolves persona from request header x-lms-user-id: usr_aris_thorne", async () => {
      const req = new NextRequest("http://localhost:3000/api/courses", {
        headers: { "x-lms-user-id": "usr_aris_thorne" },
      });
      const user = await resolveSessionUser(req);
      assert.strictEqual(user.id, "usr_aris_thorne");
      assert.strictEqual(user.role, "CO_ADMIN");
    });

    it("3.5 Resolves persona from request header x-lms-role: STUDENT", async () => {
      const req = new NextRequest("http://localhost:3000/api/courses", {
        headers: { "x-lms-role": "STUDENT" },
      });
      const user = await resolveSessionUser(req);
      assert.strictEqual(user.id, "usr_sophia_chen");
      assert.strictEqual(user.role, "STUDENT");
    });

    it("3.6 Resolves persona from request cookie lms_user_id=usr_sophia_chen", async () => {
      const req = new NextRequest("http://localhost:3000/dashboard", {
        headers: { cookie: "lms_user_id=usr_sophia_chen" },
      });
      const user = await resolveSessionUser(req);
      assert.strictEqual(user.id, "usr_sophia_chen");
      assert.strictEqual(user.role, "STUDENT");
    });

    it("3.7 Falls back gracefully to default persona when no session context is provided", async () => {
      const user = await resolveSessionUser();
      assert.ok(user);
      assert.strictEqual(user.id, "usr_alex_rivera");
    });
  });

  // ==========================================================================
  // SUITE 4: Session Switcher API Integration (/api/auth/session)
  // ==========================================================================
  describe("4. Session Switcher API Integration", () => {
    it("4.1 GET /api/auth/session returns marketplacePersonas array", async () => {
      const res = await GET();
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.data.marketplacePersonas);
      assert.strictEqual(json.data.marketplacePersonas.length, 3);
      assert.strictEqual(json.data.personas.length, 5); // Corporate backward compatibility
    });

    it("4.2 POST /api/auth/session successfully switches to STUDENT (Sophia Chen)", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "usr_sophia_chen" }),
      });
      const res = await POST(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.user.id, "usr_sophia_chen");
      assert.strictEqual(json.data.user.role, "STUDENT");

      const cookieHeader = res.headers.get("set-cookie");
      assert.ok(cookieHeader && cookieHeader.includes("usr_sophia_chen"));
    });

    it("4.3 POST /api/auth/session successfully switches to CO_ADMIN (Dr. Aris Thorne)", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "usr_aris_thorne" }),
      });
      const res = await POST(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.user.id, "usr_aris_thorne");
      assert.strictEqual(json.data.user.role, "CO_ADMIN");

      const cookieHeader = res.headers.get("set-cookie");
      assert.ok(cookieHeader && cookieHeader.includes("usr_aris_thorne"));
    });

    it("4.4 POST /api/auth/session switches via role: 'STUDENT'", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "STUDENT" }),
      });
      const res = await POST(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.user.id, "usr_sophia_chen");
    });

    it("4.5 POST /api/auth/session switches via role: 'CO_ADMIN'", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "CO_ADMIN" }),
      });
      const res = await POST(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.user.id, "usr_aris_thorne");
    });
  });

  // ==========================================================================
  // SUITE 5: Role Hierarchy & Permissions for Marketplace Roles
  // ==========================================================================
  describe("5. Role Hierarchy & Permissions Enforcement", () => {
    it("5.1 STUDENT has permission for STUDENT role only", () => {
      assert.strictEqual(hasPermission("STUDENT", "STUDENT"), true);
      assert.strictEqual(hasPermission("STUDENT", "CO_ADMIN"), false);
      assert.strictEqual(hasPermission("STUDENT", "SUPER_ADMIN"), false);
    });

    it("5.2 CO_ADMIN has permission for STUDENT and CO_ADMIN roles", () => {
      assert.strictEqual(hasPermission("CO_ADMIN", "STUDENT"), true);
      assert.strictEqual(hasPermission("CO_ADMIN", "CO_ADMIN"), true);
      assert.strictEqual(hasPermission("CO_ADMIN", "SUPER_ADMIN"), false);
    });

    it("5.3 SUPER_ADMIN has universal permission across all roles", () => {
      assert.strictEqual(hasPermission("SUPER_ADMIN", "STUDENT"), true);
      assert.strictEqual(hasPermission("SUPER_ADMIN", "CO_ADMIN"), true);
      assert.strictEqual(hasPermission("SUPER_ADMIN", "SUPER_ADMIN"), true);
    });
  });
});
