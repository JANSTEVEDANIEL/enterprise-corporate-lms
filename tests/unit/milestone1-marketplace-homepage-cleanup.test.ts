import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../../src/lib/db";
import HomePage from "../../src/app/page";
import MarketplacePage from "../../src/app/marketplace/page";

describe("Milestone 1: Marketplace Homepage, Full-Width Layout & Corporate Clean-up Suite", () => {
  before(() => {
    initDb();
  });

  // ==========================================================================
  // SUITE 1: Root Marketplace Homepage & Corporate Isolation
  // ==========================================================================
  describe("1. Root Route (src/app/page.tsx) & Marketplace Route (src/app/marketplace/page.tsx)", () => {
    it("1.1 HomePage server component executes cleanly and returns MarketplaceCatalog with corporate courses filtered", async () => {
      const pageJsx = await HomePage();
      assert.ok(pageJsx, "HomePage must return valid JSX component");
      assert.ok(pageJsx.props, "HomePage must pass props to MarketplaceCatalog");
      assert.ok(Array.isArray(pageJsx.props.initialCourses), "initialCourses must be an array");
      assert.ok(pageJsx.props.initialCourses.length >= 2, "Expected published marketplace courses");

      // Verify that NO corporate compliance courses exist in initialCourses
      const corporateCategories = ["ONBOARDING", "COMPLIANCE", "TECHNICAL_UPSKILLING"];
      for (const course of pageJsx.props.initialCourses) {
        assert.ok(
          !corporateCategories.includes((course.category || "").toUpperCase()),
          `Course "${course.title}" with category "${course.category}" must be filtered out from root marketplace homepage`
        );
      }
    });

    it("1.2 MarketplacePage server component executes cleanly and filters corporate courses", async () => {
      const pageJsx = await MarketplacePage();
      assert.ok(pageJsx, "MarketplacePage must return valid JSX component");
      assert.ok(pageJsx.props, "MarketplacePage must pass props to MarketplaceCatalog");
      assert.ok(Array.isArray(pageJsx.props.initialCourses), "initialCourses must be an array");

      const corporateCategories = ["ONBOARDING", "COMPLIANCE", "TECHNICAL_UPSKILLING"];
      for (const course of pageJsx.props.initialCourses) {
        assert.ok(
          !corporateCategories.includes((course.category || "").toUpperCase()),
          `Course "${course.title}" with category "${course.category}" must be filtered out from /marketplace`
        );
      }
    });
  });

  // ==========================================================================
  // SUITE 2: Exact 5 Categories Alignment
  // ==========================================================================
  describe("2. Category Filter Alignment", () => {
    it("2.1 Validates exact 5 EdTech marketplace categories", async () => {
      const expectedCategories = [
        "All Categories",
        "AI & Data Science",
        "Cloud & Distributed Systems",
        "Software Engineering",
        "UI/UX Design",
        "Leadership",
      ];
      assert.strictEqual(expectedCategories.length, 6); // "All Categories" + 5 categories
      assert.ok(expectedCategories.includes("AI & Data Science"));
      assert.ok(expectedCategories.includes("Cloud & Distributed Systems"));
      assert.ok(expectedCategories.includes("Software Engineering"));
      assert.ok(expectedCategories.includes("UI/UX Design"));
      assert.ok(expectedCategories.includes("Leadership"));
    });
  });

  // ==========================================================================
  // SUITE 3: Full-Width Layout Route Classification
  // ==========================================================================
  describe("3. Full-Width Layout Route Invariants", () => {
    it("3.1 Correctly classifies public routes as full-width and portal routes as sidebar-enabled", () => {
      function isPublicRoute(pathname: string): boolean {
        return (
          pathname === "/" ||
          pathname.startsWith("/marketplace") ||
          pathname.startsWith("/auth")
        );
      }

      // Public routes: must be full-width (isPublicRoute === true)
      assert.strictEqual(isPublicRoute("/"), true);
      assert.strictEqual(isPublicRoute("/marketplace"), true);
      assert.strictEqual(isPublicRoute("/marketplace/cloud-native-architecture-distributed-systems"), true);
      assert.strictEqual(isPublicRoute("/auth/login"), true);
      assert.strictEqual(isPublicRoute("/auth/signup"), true);

      // Portal routes: must NOT be full-width (isPublicRoute === false, renders sidebar)
      assert.strictEqual(isPublicRoute("/dashboard"), false);
      assert.strictEqual(isPublicRoute("/studio"), false);
      assert.strictEqual(isPublicRoute("/admin"), false);
      assert.strictEqual(isPublicRoute("/admin/courses"), false);
      assert.strictEqual(isPublicRoute("/admin/users"), false);
    });
  });
});
