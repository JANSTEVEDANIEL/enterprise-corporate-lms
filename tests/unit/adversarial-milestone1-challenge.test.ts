import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { initDb } from "../../src/lib/db";
import {
  MARKETPLACE_PERSONAS,
  CORPORATE_PERSONAS,
  getMarketplacePersonas,
} from "../../src/lib/auth";
import HomePage from "../../src/app/page";
import MarketplacePage from "../../src/app/marketplace/page";

describe("Milestone 1 Adversarial Challenge: Layout Boundaries, Role Persona Integrity & Category Filters", () => {
  before(() => {
    initDb();
  });

  // ==========================================================================
  // SUITE 1: Layout Boundary Classification & Route Edge Cases
  // ==========================================================================
  describe("1. Layout Boundary Helper & Route Invariants", () => {
    // Pure oracle matching the logic implemented in src/components/layout/app-layout-shell.tsx
    function evaluateLayoutBoundary(pathname?: string | null): boolean {
      if (!pathname) return false;
      return (
        pathname === "/" ||
        pathname.startsWith("/marketplace") ||
        pathname.startsWith("/auth")
      );
    }

    it("1.1 Root route '/' is classified as public full-width", () => {
      assert.strictEqual(evaluateLayoutBoundary("/"), true);
    });

    it("1.2 Marketplace catalog and nested slug routes are classified as public full-width", () => {
      assert.strictEqual(evaluateLayoutBoundary("/marketplace"), true);
      assert.strictEqual(evaluateLayoutBoundary("/marketplace/"), true);
      assert.strictEqual(
        evaluateLayoutBoundary("/marketplace/cloud-native-architecture-distributed-systems"),
        true
      );
      assert.strictEqual(
        evaluateLayoutBoundary("/marketplace/ai-swarms-autonomous-agents/week-1"),
        true
      );
      assert.strictEqual(
        evaluateLayoutBoundary("/marketplace/a/b/c/d/e/deeply-nested"),
        true
      );
    });

    it("1.3 Auth routes are classified as public full-width", () => {
      assert.strictEqual(evaluateLayoutBoundary("/auth/login"), true);
      assert.strictEqual(evaluateLayoutBoundary("/auth/signup"), true);
      assert.strictEqual(evaluateLayoutBoundary("/auth/forgot-password"), true);
      assert.strictEqual(evaluateLayoutBoundary("/auth/callback"), true);
    });

    it("1.4 Portal routes strictly require contextual sidebar (not public)", () => {
      const portalRoutes = [
        "/dashboard",
        "/dashboard/courses",
        "/dashboard/courses/crs_cloud_arch_7w",
        "/studio",
        "/studio/courses/new",
        "/studio/courses/crs_cloud_arch_7w/edit",
        "/admin",
        "/admin/courses",
        "/admin/users",
        "/admin/reports",
        "/certificates",
        "/certificates/cert_12345",
      ];
      for (const route of portalRoutes) {
        assert.strictEqual(
          evaluateLayoutBoundary(route),
          false,
          `Portal route "${route}" must require sidebar layout (evaluateLayoutBoundary === false)`
        );
      }
    });

    it("1.5 Legacy corporate routes (if accessed) require sidebar layout", () => {
      const legacyRoutes = ["/compliance", "/audit", "/simulation", "/manager", "/courses"];
      for (const route of legacyRoutes) {
        assert.strictEqual(
          evaluateLayoutBoundary(route),
          false,
          `Legacy route "${route}" must not be treated as public full-width`
        );
      }
    });

    it("1.6 Boundary edge cases: falsy and empty inputs are handled safely", () => {
      assert.strictEqual(evaluateLayoutBoundary(null), false);
      assert.strictEqual(evaluateLayoutBoundary(undefined), false);
      assert.strictEqual(evaluateLayoutBoundary(""), false);
      assert.strictEqual(evaluateLayoutBoundary("   "), false);
    });

    it("1.7 Boundary probe: URL query parameters and fragments", () => {
      assert.strictEqual(evaluateLayoutBoundary("/marketplace?category=AI"), true);
      assert.strictEqual(evaluateLayoutBoundary("/auth/login?redirect=/dashboard"), true);
      assert.strictEqual(evaluateLayoutBoundary("/dashboard?tab=certificates"), false);
      assert.strictEqual(evaluateLayoutBoundary("/studio?sort=desc"), false);
      assert.strictEqual(evaluateLayoutBoundary("/admin#ledger"), false);
    });

    it("1.8 Static verification of src/components/layout/app-layout-shell.tsx", () => {
      const shellPath = path.join(process.cwd(), "src/components/layout/app-layout-shell.tsx");
      assert.ok(fs.existsSync(shellPath), "app-layout-shell.tsx must exist");
      const content = fs.readFileSync(shellPath, "utf-8");

      assert.ok(content.includes('"use client"'), "Must be a client component");
      assert.ok(content.includes('pathname === "/"'), "Must check root path '/'");
      assert.ok(content.includes('pathname?.startsWith("/marketplace")'), "Must check '/marketplace'");
      assert.ok(content.includes('pathname?.startsWith("/auth")'), "Must check '/auth'");
      assert.ok(content.includes("<Sidebar currentUser={currentUser} />"), "Must render Sidebar in portal branch");
      assert.ok(
        content.includes("<main className=\"flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50\">"),
        "Must render full-width main container in public branch"
      );
    });
  });

  // ==========================================================================
  // SUITE 2: Role Switcher Persona Integrity & Non-Exposure of Corporate Personas
  // ==========================================================================
  describe("2. Role Switcher Persona Integrity", () => {
    const roleSwitcherPath = path.join(process.cwd(), "src/components/layout/role-switcher.tsx");

    it("2.1 Static analysis: MARKETPLACE_ROLES contains exactly Sophia Chen, Dr. Aris Thorne, David Kim", () => {
      assert.ok(fs.existsSync(roleSwitcherPath), "role-switcher.tsx must exist");
      const content = fs.readFileSync(roleSwitcherPath, "utf-8");

      // Verify the 3 marketplace personas exist
      assert.ok(content.includes('id: "usr_sophia_chen"'), "Must define Sophia Chen");
      assert.ok(content.includes('name: "Sophia Chen"'), "Must have Sophia Chen name");
      assert.ok(content.includes('label: "Student"'), "Must label as Student");
      assert.ok(content.includes('subtitle: "$500 Wallet"'), "Must indicate $500 Wallet");

      assert.ok(content.includes('id: "usr_aris_thorne"'), "Must define Dr. Aris Thorne");
      assert.ok(content.includes('name: "Dr. Aris Thorne"'), "Must have Dr. Aris Thorne name");
      assert.ok(content.includes('label: "Co-Admin"'), "Must label as Co-Admin");
      assert.ok(content.includes('subtitle: "Creator (90% Cut)"'), "Must indicate Creator 90% Cut");

      assert.ok(content.includes('id: "usr_david_kim"'), "Must define David Kim");
      assert.ok(content.includes('name: "David Kim"'), "Must have David Kim name");
      assert.ok(content.includes('label: "Super Admin"'), "Must label as Super Admin");
      assert.ok(content.includes('subtitle: "Platform Operator"'), "Must indicate Platform Operator");
    });

    it("2.2 Static analysis: CORPORATE_ROLES and corporate personas are strictly eliminated from switcher UI", () => {
      const content = fs.readFileSync(roleSwitcherPath, "utf-8");

      assert.ok(!content.includes("CORPORATE_ROLES"), "CORPORATE_ROLES must not exist in role-switcher.tsx");
      assert.ok(!content.includes("Corporate Roles"), "Corporate Roles menu must not exist in role-switcher.tsx");
      assert.ok(!content.includes("usr_elena_rostova"), "Elena Rostova must not be in role-switcher.tsx");
      assert.ok(!content.includes("usr_sarah_jenkins"), "Sarah Jenkins must not be in role-switcher.tsx");
      assert.ok(!content.includes("usr_marcus_vance"), "Marcus Vance must not be in role-switcher.tsx");
      assert.ok(!content.includes("Compliance Officer"), "Compliance Officer role must not be exposed in switcher");
    });

    it("2.3 Default active role fallback is Sophia Chen (usr_sophia_chen / STUDENT)", () => {
      const content = fs.readFileSync(roleSwitcherPath, "utf-8");
      assert.ok(
        content.includes('currentUser?.id || "usr_sophia_chen"'),
        "Active persona ID fallback must be usr_sophia_chen"
      );
      assert.ok(
        content.includes('currentUser?.role || "STUDENT"'),
        "Active role fallback must be STUDENT"
      );
    });

    it("2.4 MARKETPLACE_PERSONAS in src/lib/auth contains exactly the 3 marketplace personas", () => {
      const personas = getMarketplacePersonas();
      assert.strictEqual(personas.length, 3, "getMarketplacePersonas must return exactly 3 personas");

      const ids = personas.map((p) => p.id);
      assert.ok(ids.includes("usr_sophia_chen"), "Must include usr_sophia_chen");
      assert.ok(ids.includes("usr_aris_thorne"), "Must include usr_aris_thorne");
      assert.ok(ids.includes("usr_david_kim"), "Must include usr_david_kim");

      assert.strictEqual(MARKETPLACE_PERSONAS.sophia_chen.role, "STUDENT");
      assert.strictEqual(MARKETPLACE_PERSONAS.aris_thorne.role, "CO_ADMIN");
      assert.strictEqual(MARKETPLACE_PERSONAS.david_kim.role, "SUPER_ADMIN");
    });

    it("2.5 Persona isolation: Corporate personas are not in MARKETPLACE_PERSONAS", () => {
      const marketplaceKeys = Object.keys(MARKETPLACE_PERSONAS);
      assert.strictEqual(marketplaceKeys.length, 3);
      assert.ok(!marketplaceKeys.includes("alex_rivera"));
      assert.ok(!marketplaceKeys.includes("elena_rostova"));
      assert.ok(!marketplaceKeys.includes("sarah_jenkins"));
      assert.ok(!marketplaceKeys.includes("marcus_vance"));
    });
  });

  // ==========================================================================
  // SUITE 3: Category Filtering Logic Across All 5 Categories & Corporate Block
  // ==========================================================================
  describe("3. Category Filtering Logic Across 5 Required Categories", () => {
    const CORPORATE_CATEGORIES = new Set(["ONBOARDING", "COMPLIANCE", "TECHNICAL_UPSKILLING"]);

    // Empirical simulation of the filtering logic in marketplace-catalog.tsx
    function matchesFilter(
      course: {
        category?: string | null;
        title?: string | null;
        description?: string | null;
        creator_name?: string | null;
        creator?: string | null;
        price_dollars?: number | null;
        price_cents?: number | null;
        price?: number | null;
      },
      selectedCategory: string,
      searchTerm = "",
      priceFilter: "ALL" | "FREE" | "PAID" = "ALL"
    ): boolean {
      // 0. Pre-filter corporate
      const cat = (course.category || "").toUpperCase();
      if (CORPORATE_CATEGORIES.has(cat)) return false;

      // 1. Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesTitle = course.title?.toLowerCase().includes(query);
        const matchesDesc = course.description?.toLowerCase().includes(query);
        const matchesCreator =
          course.creator_name?.toLowerCase().includes(query) ||
          course.creator?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc && !matchesCreator) {
          return false;
        }
      }

      // 2. Exact 5-Category matching
      if (selectedCategory !== "All Categories") {
        const catUpper = (course.category || "").toUpperCase();
        const titleUpper = (course.title || "").toUpperCase();
        const descUpper = (course.description || "").toUpperCase();

        if (selectedCategory === "AI & Data Science") {
          const matchesCat =
            catUpper === "DATA_SCIENCE" ||
            catUpper === "AI" ||
            catUpper.includes("AI") ||
            catUpper.includes("DATA");
          const matchesContent =
            titleUpper.includes("AI") ||
            titleUpper.includes("LLM") ||
            titleUpper.includes("DATA SCIENCE") ||
            titleUpper.includes("AGENTS") ||
            descUpper.includes("AI") ||
            descUpper.includes("LLM");
          if (!matchesCat && !matchesContent) return false;
        } else if (selectedCategory === "Cloud & Distributed Systems") {
          const matchesCat =
            catUpper === "CLOUD" ||
            catUpper === "DISTRIBUTED" ||
            catUpper === "SECURITY" ||
            catUpper.includes("CLOUD");
          const matchesContent =
            titleUpper.includes("CLOUD") ||
            titleUpper.includes("DISTRIBUTED") ||
            titleUpper.includes("SECURITY") ||
            titleUpper.includes("ZERO-TRUST") ||
            titleUpper.includes("DEVSECOPS") ||
            titleUpper.includes("KUBERNETES") ||
            descUpper.includes("CLOUD") ||
            descUpper.includes("DISTRIBUTED");
          if (!matchesCat && !matchesContent) return false;
        } else if (selectedCategory === "Software Engineering") {
          const matchesCat =
            catUpper === "SOFTWARE" ||
            catUpper.includes("SOFTWARE") ||
            catUpper.includes("ENGINEERING");
          const matchesContent =
            titleUpper.includes("SOFTWARE") ||
            titleUpper.includes("GIT") ||
            titleUpper.includes("ENGINEERING") ||
            titleUpper.includes("FULL-STACK") ||
            descUpper.includes("ENGINEERING");
          if (!matchesCat && !matchesContent) return false;
        } else if (selectedCategory === "UI/UX Design") {
          const matchesCat =
            catUpper === "DESIGN" ||
            catUpper === "UI_UX" ||
            catUpper.includes("DESIGN") ||
            catUpper.includes("UI");
          const matchesContent =
            titleUpper.includes("DESIGN") ||
            titleUpper.includes("UI") ||
            titleUpper.includes("UX") ||
            descUpper.includes("DESIGN");
          if (!matchesCat && !matchesContent) return false;
        } else if (selectedCategory === "Leadership") {
          const matchesCat =
            catUpper === "LEADERSHIP" ||
            catUpper === "BUSINESS" ||
            catUpper.includes("LEAD");
          const matchesContent =
            titleUpper.includes("LEADERSHIP") ||
            titleUpper.includes("MANAGEMENT") ||
            titleUpper.includes("STAFF") ||
            descUpper.includes("LEADERSHIP");
          if (!matchesCat && !matchesContent) return false;
        }
      }

      // 3. Price filter
      const price =
        course.price_dollars ??
        (course.price_cents ? course.price_cents / 100 : course.price ?? 0);
      if (priceFilter === "FREE" && price > 0) return false;
      if (priceFilter === "PAID" && price === 0) return false;

      return true;
    }

    const testCourses = [
      {
        id: "crs_ai_1",
        title: "Autonomous AI Agents & LLM Swarms",
        description: "Build production multi-agent systems with tool use",
        category: "DATA_SCIENCE",
        price_dollars: 149.0,
      },
      {
        id: "crs_cloud_1",
        title: "Cloud Native Architecture & Distributed Systems",
        description: "Zero-trust Kubernetes orchestration and service mesh",
        category: "SECURITY",
        price_dollars: 99.0,
      },
      {
        id: "crs_se_1",
        title: "Modern Full-Stack Rust & WebAssembly Engineering",
        description: "Build robust concurrent web platforms",
        category: "SOFTWARE",
        price_dollars: 89.0,
      },
      {
        id: "crs_uiux_1",
        title: "Design Systems & Figma UI/UX Mastery",
        description: "Create accessible enterprise component libraries",
        category: "DESIGN",
        price_dollars: 0.0,
      },
      {
        id: "crs_lead_1",
        title: "Engineering Leadership & Technical Strategy",
        description: "Staff+ management and high-output teams",
        category: "LEADERSHIP",
        price_dollars: 129.0,
      },
      // Corporate compliance courses (adversarial injection)
      {
        id: "crs_corp_soc2",
        title: "SOC 2 Information Security & Compliance 2026",
        description: "Mandatory corporate compliance",
        category: "COMPLIANCE",
        price_dollars: 0.0,
      },
      {
        id: "crs_corp_onboard",
        title: "Day-1 Enterprise Orientation",
        description: "Mandatory new hire onboarding",
        category: "ONBOARDING",
        price_dollars: 0.0,
      },
      {
        id: "crs_corp_tech",
        title: "Production Infrastructure Safety Standards",
        description: "Technical upskilling compliance",
        category: "TECHNICAL_UPSKILLING",
        price_dollars: 0.0,
      },
    ];

    it("3.1 'AI & Data Science' category accurately matches AI course and rejects corporate/unrelated", () => {
      const results = testCourses.filter((c) => matchesFilter(c, "AI & Data Science"));
      const ids = results.map((c) => c.id);
      assert.ok(ids.includes("crs_ai_1"), "Must include AI course");
      assert.ok(!ids.includes("crs_uiux_1"), "Must not include UI/UX course");
      assert.ok(!ids.includes("crs_lead_1"), "Must not include Leadership course");
      assert.ok(!ids.includes("crs_corp_soc2"), "Must not include SOC 2 compliance");
      assert.ok(!ids.includes("crs_corp_onboard"), "Must not include Onboarding");
    });

    it("3.2 'Cloud & Distributed Systems' category matches cloud course", () => {
      const results = testCourses.filter((c) => matchesFilter(c, "Cloud & Distributed Systems"));
      const ids = results.map((c) => c.id);
      assert.ok(ids.includes("crs_cloud_1"), "Must include Cloud course");
      assert.ok(!ids.includes("crs_uiux_1"), "Must not include UI/UX");
      assert.ok(!ids.includes("crs_corp_soc2"), "Must not include SOC 2");
    });

    it("3.3 'Software Engineering' category matches software course", () => {
      const results = testCourses.filter((c) => matchesFilter(c, "Software Engineering"));
      const ids = results.map((c) => c.id);
      assert.ok(ids.includes("crs_se_1"), "Must include Software Engineering course");
      assert.ok(!ids.includes("crs_uiux_1"), "Must not include UI/UX");
      assert.ok(!ids.includes("crs_corp_tech"), "Must not include Technical Upskilling");
    });

    it("3.4 'UI/UX Design' category matches design course", () => {
      const results = testCourses.filter((c) => matchesFilter(c, "UI/UX Design"));
      const ids = results.map((c) => c.id);
      assert.ok(ids.includes("crs_uiux_1"), "Must include UI/UX course");
      assert.ok(!ids.includes("crs_ai_1"), "Must not include AI course");
      assert.ok(!ids.includes("crs_lead_1"), "Must not include Leadership course");
    });

    it("3.5 'Leadership' category matches leadership course", () => {
      const results = testCourses.filter((c) => matchesFilter(c, "Leadership"));
      const ids = results.map((c) => c.id);
      assert.ok(ids.includes("crs_lead_1"), "Must include Leadership course");
      assert.ok(!ids.includes("crs_ai_1"), "Must not include AI course");
      assert.ok(!ids.includes("crs_se_1"), "Must not include Software Engineering course");
    });

    it("3.6 'All Categories' returns all valid marketplace courses and zero corporate compliance courses", () => {
      const results = testCourses.filter((c) => matchesFilter(c, "All Categories"));
      assert.strictEqual(results.length, 5, "Expected exactly 5 non-corporate courses");
      for (const course of results) {
        assert.ok(
          !CORPORATE_CATEGORIES.has((course.category || "").toUpperCase()),
          `Corporate course "${course.title}" must never leak into catalog`
        );
      }
    });

    it("3.7 Adversarial search input handling (regex chars, edge strings, null safety)", () => {
      // Regex special characters must not crash the search filter
      const regexTerms = ["[A-Z]*{}", "(?:test)", "^$", "+*?()", "\\d+"];
      for (const term of regexTerms) {
        assert.doesNotThrow(() => {
          testCourses.filter((c) => matchesFilter(c, "All Categories", term));
        }, `Search with regex string "${term}" must not throw`);
      }

      // Normal search query correctly matches
      const normalResults = testCourses.filter((c) =>
        matchesFilter(c, "All Categories", "agents")
      );
      assert.strictEqual(normalResults.length, 1);
      assert.strictEqual(normalResults[0].id, "crs_ai_1");

      // Adversarial probe: Search term with untrimmed whitespace
      // In marketplace-catalog.tsx:48, `const query = searchTerm.toLowerCase();` omits `.trim()`.
      // As an empirical challenger finding, verify this behavior is reproduced:
      const untrimmedResults = testCourses.filter((c) =>
        matchesFilter(c, "All Categories", "   agents   ")
      );
      assert.strictEqual(
        untrimmedResults.length,
        0,
        "Empirical finding: untrimmed query yields 0 matches because query is not trimmed in marketplace-catalog.tsx:48"
      );

      // Corrupt course objects must not throw
      const corruptCourses = [
        { title: null, description: null, category: null },
        { title: undefined, description: undefined, category: undefined },
        {},
      ];
      for (const c of corruptCourses) {
        assert.doesNotThrow(() => {
          matchesFilter(c as any, "AI & Data Science", "test");
        });
      }
    });

    it("3.8 Free vs Paid filter segmentation", () => {
      const freeCourses = testCourses.filter((c) =>
        matchesFilter(c, "All Categories", "", "FREE")
      );
      assert.strictEqual(freeCourses.length, 1);
      assert.strictEqual(freeCourses[0].id, "crs_uiux_1");

      const paidCourses = testCourses.filter((c) =>
        matchesFilter(c, "All Categories", "", "PAID")
      );
      assert.strictEqual(paidCourses.length, 4);
      for (const c of paidCourses) {
        assert.ok((c.price_dollars || 0) > 0);
      }
    });
  });

  // ==========================================================================
  // SUITE 4: Clean Navigation & Zero Corporate Compliance Leftovers in Layout
  // ==========================================================================
  describe("4. Navigation Header & Sidebar Cleanliness", () => {
    it("4.1 Navbar (src/components/layout/navbar.tsx) has brand linking to '/' and zero corporate menus", () => {
      const navPath = path.join(process.cwd(), "src/components/layout/navbar.tsx");
      const content = fs.readFileSync(navPath, "utf-8");

      assert.ok(content.includes('href="/"'), "Brand logo must link to root '/'");
      assert.ok(!content.includes("Enterprise Track"), "Must not contain 'Enterprise Track'");
      assert.ok(!content.includes("corporateLinks"), "Must not contain 'corporateLinks'");
      assert.ok(!content.includes("/compliance"), "Must not link to /compliance");
      assert.ok(!content.includes("/audit"), "Must not link to /audit");
      assert.ok(!content.includes("/simulation"), "Must not link to /simulation");
      assert.ok(!content.includes("/manager"), "Must not link to /manager");
    });

    it("4.2 Sidebar (src/components/layout/sidebar.tsx) contains only pure EdTech portals", () => {
      const sidebarPath = path.join(process.cwd(), "src/components/layout/sidebar.tsx");
      const content = fs.readFileSync(sidebarPath, "utf-8");

      assert.ok(content.includes('href="/marketplace"'), "Must link to /marketplace");
      assert.ok(content.includes('href="/dashboard"'), "Must link to /dashboard");
      assert.ok(content.includes('href="/studio"'), "Must link to /studio");
      assert.ok(content.includes('href="/admin"'), "Must link to /admin");

      assert.ok(!content.includes("Corporate Learner"), "Must not contain Corporate Learner section");
      assert.ok(!content.includes("Management & Team"), "Must not contain Management & Team section");
      assert.ok(!content.includes("Compliance & Legal"), "Must not contain Compliance & Legal section");
      assert.ok(!content.includes("Synthetic Simulation"), "Must not contain Synthetic Simulation section");
    });
  });

  // ==========================================================================
  // SUITE 5: HomePage & MarketplacePage Runtime Execution
  // ==========================================================================
  describe("5. HomePage and MarketplacePage Runtime Isolation", () => {
    it("5.1 HomePage executes without error and strictly isolates marketplace courses", async () => {
      const homeJsx = await HomePage();
      assert.ok(homeJsx, "HomePage must return JSX");
      assert.ok(Array.isArray(homeJsx.props.initialCourses), "initialCourses must be array");
      assert.ok(homeJsx.props.initialCourses.length >= 1, "Must return at least 1 course");

      for (const course of homeJsx.props.initialCourses) {
        const cat = (course.category || "").toUpperCase();
        assert.ok(
          !["ONBOARDING", "COMPLIANCE", "TECHNICAL_UPSKILLING"].includes(cat),
          `Corporate course "${course.title}" with category "${cat}" must not appear on root HomePage`
        );
        assert.ok(typeof course.is_enrolled === "boolean", "is_enrolled must be boolean");
        assert.ok(typeof course.price_dollars === "number", "price_dollars must be number");
      }
    });

    it("5.2 MarketplacePage executes without error and strictly isolates marketplace courses", async () => {
      const mktJsx = await MarketplacePage();
      assert.ok(mktJsx, "MarketplacePage must return JSX");
      assert.ok(Array.isArray(mktJsx.props.initialCourses), "initialCourses must be array");
      assert.ok(mktJsx.props.initialCourses.length >= 1, "Must return at least 1 course");

      for (const course of mktJsx.props.initialCourses) {
        const cat = (course.category || "").toUpperCase();
        assert.ok(
          !["ONBOARDING", "COMPLIANCE", "TECHNICAL_UPSKILLING"].includes(cat),
          `Corporate course "${course.title}" with category "${cat}" must not appear on /marketplace`
        );
        assert.ok(typeof course.is_enrolled === "boolean", "is_enrolled must be boolean");
        assert.ok(typeof course.price_dollars === "number", "price_dollars must be number");
      }
    });
  });
});
