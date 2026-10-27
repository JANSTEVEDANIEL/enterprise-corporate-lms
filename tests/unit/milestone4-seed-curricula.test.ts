import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { getDb, initDb } from "../../src/lib/db";
import { ALL_MARKETPLACE_COURSES } from "../../src/lib/db/seed-curricula";
import { seedDb } from "../../src/lib/db/seed";

describe("Milestone 4: Multi-Week Authentic Curricula Seed Data Suite", () => {
  before(() => {
    initDb();
    seedDb();
  });

  const EXPECTED_COURSE_IDS = [
    "crs_cloud_arch_7w",
    "crs_fullstack_ai_8w",
    "crs_zerotrust_sec_6w",
    "crs_ai_agents_prod",
    "crs_git_free_1w",
    "crs_uiux_design_5w",
    "crs_leadership_eng_4w",
  ];

  // ==========================================================================
  // SUITE 1: Course Catalog Coverage & Category Distribution
  // ==========================================================================
  describe("1. Course Catalog Diversity & Category Distribution", () => {
    it("1.1 Exactly 7 distinct marketplace courses are authored in ALL_MARKETPLACE_COURSES", () => {
      assert.strictEqual(ALL_MARKETPLACE_COURSES.length, 7);
      const courseIds = ALL_MARKETPLACE_COURSES.map((c) => c.id);
      for (const expectedId of EXPECTED_COURSE_IDS) {
        assert.ok(courseIds.includes(expectedId), `Missing expected course ID: ${expectedId}`);
      }
    });

    it("1.2 Covers all 5 essential marketplace categories", () => {
      const categories = new Set(ALL_MARKETPLACE_COURSES.map((c) => c.category));
      assert.ok(categories.has("SOFTWARE"), "Must include SOFTWARE category");
      assert.ok(categories.has("DATA_SCIENCE"), "Must include DATA_SCIENCE category");
      assert.ok(categories.has("SECURITY"), "Must include SECURITY category");
      assert.ok(categories.has("DESIGN"), "Must include DESIGN category");
      assert.ok(categories.has("LEADERSHIP"), "Must include LEADERSHIP category");
    });

    it("1.3 Validates pricing diversity: Free tier ($0), mid-tier ($79-$99), and premium ($119-$149)", () => {
      const freeCourses = ALL_MARKETPLACE_COURSES.filter((c) => c.priceCents === 0);
      assert.strictEqual(freeCourses.length, 1, "Must have exactly 1 free course");
      assert.strictEqual(freeCourses[0].id, "crs_git_free_1w");

      const midTierCourses = ALL_MARKETPLACE_COURSES.filter((c) => c.priceCents >= 7000 && c.priceCents <= 9900);
      assert.ok(midTierCourses.length >= 2, "Expected at least 2 mid-tier courses");

      const premiumCourses = ALL_MARKETPLACE_COURSES.filter((c) => c.priceCents >= 10000);
      assert.ok(premiumCourses.length >= 2, "Expected at least 2 premium courses");
    });

    it("1.4 Includes both published courses and creator studio draft courses", () => {
      const published = ALL_MARKETPLACE_COURSES.filter((c) => c.isPublished === 1);
      const drafts = ALL_MARKETPLACE_COURSES.filter((c) => c.isPublished === 0);
      assert.strictEqual(published.length, 6, "Expected 6 published courses");
      assert.strictEqual(drafts.length, 1, "Expected 1 draft course (crs_ai_agents_prod)");
      assert.strictEqual(drafts[0].id, "crs_ai_agents_prod");
    });
  });

  // ==========================================================================
  // SUITE 2: Multi-Week Curricula Authenticity & Zero Generic Placeholders
  // ==========================================================================
  describe("2. Multi-Week Structure & Realistic Pedagogical Content", () => {
    it("2.1 Each course has the exact number of weeks specified by totalWeeks", () => {
      for (const course of ALL_MARKETPLACE_COURSES) {
        assert.strictEqual(
          course.weeks.length,
          course.totalWeeks,
          `Course ${course.id} totalWeeks mismatch: declared ${course.totalWeeks}, authored ${course.weeks.length}`
        );
      }
    });

    it("2.2 Total authored weeks across all courses equals 35 weeks", () => {
      const totalWeeks = ALL_MARKETPLACE_COURSES.reduce((acc, c) => acc + c.weeks.length, 0);
      assert.strictEqual(totalWeeks, 35, "Expected exactly 35 curriculum weeks across 7 courses");
    });

    it("2.3 Zero generic placeholder titles in week descriptions or titles", () => {
      const genericRegex = /milestone \d+/i;
      for (const course of ALL_MARKETPLACE_COURSES) {
        for (const week of course.weeks) {
          assert.strictEqual(
            genericRegex.test(week.title),
            false,
            `Week title has generic milestone placeholder in ${course.id}: "${week.title}"`
          );
          assert.strictEqual(
            genericRegex.test(week.desc),
            false,
            `Week description has generic milestone placeholder in ${course.id}: "${week.desc}"`
          );
          assert.ok(week.title.length >= 15, `Week title too brief in ${course.id}: "${week.title}"`);
          assert.ok(week.desc.length >= 30, `Week desc too brief in ${course.id}: "${week.desc}"`);
        }
      }
    });

    it("2.4 Week numbers strictly start at 1 and increment sequentially without gaps", () => {
      for (const course of ALL_MARKETPLACE_COURSES) {
        course.weeks.forEach((week, idx) => {
          assert.strictEqual(
            week.num,
            idx + 1,
            `Course ${course.id} week number out of sequence: expected ${idx + 1}, got ${week.num}`
          );
        });
      }
    });
  });

  // ==========================================================================
  // SUITE 3: Video Lessons & Realistic Video Durations
  // ==========================================================================
  describe("3. Video Lesson Durations & Previews", () => {
    it("3.1 Every lesson video duration is strictly within realistic range: 720s to 1800s (12 to 30 mins)", () => {
      let totalLessons = 0;
      for (const course of ALL_MARKETPLACE_COURSES) {
        for (const week of course.weeks) {
          for (const lesson of week.lessons) {
            totalLessons++;
            assert.ok(
              lesson.sec >= 720 && lesson.sec <= 1800,
              `Lesson duration out of bounds in ${course.id} (${lesson.title}): ${lesson.sec}s`
            );
            assert.ok(lesson.video.startsWith("https://"), `Lesson missing valid HTTPS video URL in ${lesson.title}`);
          }
        }
      }
      assert.ok(totalLessons >= 60, `Expected at least 60 authored lessons, got ${totalLessons}`);
    });

    it("3.2 Week 1 always includes at least one free preview lesson for prospective students", () => {
      for (const course of ALL_MARKETPLACE_COURSES) {
        const week1 = course.weeks.find((w) => w.num === 1);
        assert.ok(week1, `Course ${course.id} missing week 1`);
        const hasPreview = week1.lessons.some((l) => l.preview === 1);
        assert.strictEqual(
          hasPreview,
          true,
          `Course ${course.id} Week 1 must have at least one free preview lesson`
        );
      }
    });

    it("3.3 Lesson titles are authentic, technical, and non-repetitive", () => {
      const allLessonTitles = new Set<string>();
      for (const course of ALL_MARKETPLACE_COURSES) {
        for (const week of course.weeks) {
          for (const lesson of week.lessons) {
            assert.ok(lesson.title.length >= 20, `Lesson title too short: ${lesson.title}`);
            assert.ok(
              !lesson.title.includes("Part X") && !lesson.title.includes("Placeholder"),
              `Lesson title contains dummy markers: ${lesson.title}`
            );
            assert.strictEqual(
              allLessonTitles.has(lesson.title),
              false,
              `Duplicate lesson title detected: ${lesson.title}`
            );
            allLessonTitles.add(lesson.title);
          }
        }
      }
    });
  });

  // ==========================================================================
  // SUITE 4: Downloadable Lab Materials & Multi-Format Attachments
  // ==========================================================================
  describe("4. Downloadable Supplementary Lab Materials", () => {
    it("4.1 Contains over 90 authentic downloadable attachments across the catalog", () => {
      let totalAttachments = 0;
      const fileTypes = new Set<string>();

      for (const course of ALL_MARKETPLACE_COURSES) {
        for (const week of course.weeks) {
          for (const lesson of week.lessons) {
            for (const file of lesson.files) {
              totalAttachments++;
              fileTypes.add(file.file_type);
              assert.ok(file.name.length >= 8, `File name too short: ${file.name}`);
              const targetUrl = file.url || file.file_url || "";
              assert.ok(targetUrl.startsWith("https://storage.edtech.market/"), `Invalid file URL: ${targetUrl}`);
              assert.ok(file.file_size_bytes > 5000, `File size suspiciously small (<5KB): ${file.file_size_bytes}`);
            }
          }
        }
      }

      assert.ok(totalAttachments >= 90, `Expected >= 90 attachments, got ${totalAttachments}`);
      assert.ok(fileTypes.has("PDF"), "Must contain PDF guides and slide decks");
      assert.ok(fileTypes.has("ZIP"), "Must contain ZIP starter code repos and lab packs");
    });
  });

  // ==========================================================================
  // SUITE 5: Weekly Knowledge Checks & Pedagogical Rationales
  // ==========================================================================
  describe("5. Weekly Knowledge Checks & Explanatory Rationales", () => {
    it("5.1 Every week has a corresponding knowledge check quiz with passing score >= 75%", () => {
      let totalQuizzes = 0;
      for (const course of ALL_MARKETPLACE_COURSES) {
        for (const week of course.weeks) {
          totalQuizzes++;
          assert.ok(week.quizTitle.length >= 20, `Quiz title too brief in ${course.id}: "${week.quizTitle}"`);
          assert.ok(week.passingScore >= 75, `Passing score below standard threshold: ${week.passingScore}`);
          assert.ok(week.questions.length >= 2, `Expected >= 2 questions per week in ${course.id} Week ${week.num}`);
        }
      }
      assert.strictEqual(totalQuizzes, 35, "Expected 35 weekly knowledge check quizzes");
    });

    it("5.2 EVERY question has an authentic explanation rationale >= 25 characters", () => {
      let totalQuestions = 0;
      for (const course of ALL_MARKETPLACE_COURSES) {
        for (const week of course.weeks) {
          for (const q of week.questions) {
            totalQuestions++;
            assert.ok(q.prompt.length >= 25, `Question prompt too brief: ${q.prompt}`);
            assert.ok(q.options.length >= 3, `Expected at least 3 multiple-choice options for ${q.id}`);
            assert.ok(
              q.correct_index >= 0 && q.correct_index < q.options.length,
              `correct_index out of bounds for question ${q.id}`
            );
            assert.ok(q.explanation, `Question ${q.id} missing explanation rationale`);
            assert.ok(
              q.explanation.length >= 25,
              `Question ${q.id} explanation rationale too short: "${q.explanation}"`
            );
          }
        }
      }
      assert.ok(totalQuestions >= 70, `Expected at least 70 quiz questions across catalog, got ${totalQuestions}`);
    });
  });

  // ==========================================================================
  // SUITE 6: Database Seeding Parity
  // ==========================================================================
  describe("6. Database Seeding Parity & Integrity", () => {
    it("6.1 All 7 courses exist in SQLite courses table with accurate total_weeks", () => {
      const db = getDb();
      for (const course of ALL_MARKETPLACE_COURSES) {
        const row = db.prepare("SELECT * FROM courses WHERE id = ?").get(course.id) as any;
        assert.ok(row, `Course ${course.id} not found in database`);
        assert.strictEqual(row.total_weeks, course.totalWeeks);
        assert.strictEqual(row.price_cents, course.priceCents);
        assert.strictEqual(row.category, course.category);
        assert.strictEqual(row.is_published, course.isPublished);
      }
    });

    it("6.2 Weeks table contains all 35 marketplace weeks linked to courses", () => {
      const db = getDb();
      for (const course of ALL_MARKETPLACE_COURSES) {
        const weeks = db
          .prepare("SELECT * FROM weeks WHERE course_id = ? ORDER BY week_number ASC")
          .all(course.id) as any[];
        assert.strictEqual(weeks.length, course.totalWeeks, `Mismatch in seeded weeks for ${course.id}`);
      }
    });

    it("6.3 Lessons table contains all authored lessons with non-empty supplementary_files JSON", () => {
      const db = getDb();
      for (const course of ALL_MARKETPLACE_COURSES) {
        const lessons = db.prepare("SELECT * FROM lessons WHERE course_id = ?").all(course.id) as any[];
        assert.ok(lessons.length >= course.totalWeeks, `Insufficient lessons seeded for ${course.id}`);
        for (const les of lessons) {
          assert.doesNotThrow(() => {
            const parsed = JSON.parse(les.supplementary_files);
            assert.ok(Array.isArray(parsed));
          }, `Invalid supplementary_files JSON in lesson ${les.id}`);
        }
      }
    });

    it("6.4 Week quizzes table contains all 35 quizzes with valid JSON questions containing rationales", () => {
      const db = getDb();
      for (const course of ALL_MARKETPLACE_COURSES) {
        const quizzes = db.prepare("SELECT * FROM week_quizzes WHERE course_id = ?").all(course.id) as any[];
        assert.strictEqual(quizzes.length, course.totalWeeks, `Mismatch in week quizzes for ${course.id}`);
        for (const qz of quizzes) {
          const questions = JSON.parse(qz.questions);
          assert.ok(Array.isArray(questions));
          for (const q of questions) {
            assert.ok(q.explanation && q.explanation.length >= 25, `Database quiz question missing rationale in ${qz.id}`);
          }
        }
      }
    });
  });
});
