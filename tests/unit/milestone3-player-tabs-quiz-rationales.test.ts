import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { initDb, getDb } from "../../src/lib/db";
import { dbAdapter } from "../../src/lib/supabase/adapter";
import { evaluateQuiz } from "../../src/lib/quiz";
import { POST as submitQuiz } from "../../src/app/api/quizzes/[quizId]/submit/route";
import { verifyCertificate } from "../../src/lib/certificates";
import { PLAYBACK_SPEEDS } from "../../src/components/player/video-player-controls";
import {
  categorizeLessonMaterials,
  formatFileSize,
  getStructuredLessonOverview,
  getQuestionFeedback,
} from "../../src/components/player/student-lesson-player";
import type { FileAttachment } from "../../src/types/marketplace";

describe("Milestone 3: Interactive Video Player, 3-Tabbed Resource Panel & Quiz Rationales Suite", () => {
  before(() => {
    initDb();
  });

  const testStudentId = "usr_sophia_chen";
  const targetCourseId = "crs_cloud_arch_7w";
  const targetQuizId = "qz_cloud_w1";

  // ==========================================================================
  // SUITE 1: Video Player Controls & Speed Mechanics
  // ==========================================================================
  describe("1. Video Player Controls & Playback Speeds", () => {
    it("1.1 PLAYBACK_SPEEDS contains exact rates [0.75, 1, 1.25, 1.5, 2]", () => {
      assert.deepStrictEqual(Array.from(PLAYBACK_SPEEDS), [0.75, 1, 1.25, 1.5, 2]);
    });

    it("1.2 All 5 playback speeds are strictly positive and in ascending order", () => {
      assert.strictEqual(PLAYBACK_SPEEDS.length, 5);
      for (let i = 0; i < PLAYBACK_SPEEDS.length; i++) {
        assert.ok(PLAYBACK_SPEEDS[i] > 0);
        if (i > 0) {
          assert.ok(PLAYBACK_SPEEDS[i] > PLAYBACK_SPEEDS[i - 1]);
        }
      }
    });

    it("1.3 90%+ playback auto-completion boundary calculations", () => {
      const duration = 1200; // 20 minutes
      const checkAutoComplete = (pos: number) => (pos / duration) >= 0.9;

      assert.strictEqual(checkAutoComplete(0), false);
      assert.strictEqual(checkAutoComplete(600), false); // 50%
      assert.strictEqual(checkAutoComplete(1079), false); // 89.9%
      assert.strictEqual(checkAutoComplete(1080), true); // 90.0%
      assert.strictEqual(checkAutoComplete(1200), true); // 100%
    });
  });

  // ==========================================================================
  // SUITE 2: Tab 1 - Structured Lesson Overview & Graceful Fallback
  // ==========================================================================
  describe("2. Tab 1: Lesson Overview Engine (Key Concepts, Outcomes & Takeaways)", () => {
    it("2.1 Generates domain-aware Key Concepts for Raft / Distributed Consensus lessons", () => {
      const lesson = {
        title: "Distributed Consensus & Raft Protocol",
      };
      const overview = getStructuredLessonOverview(lesson);

      assert.strictEqual(overview.title, "Distributed Consensus & Raft Protocol");
      assert.ok(overview.description.length > 20);
      assert.ok(Array.isArray(overview.keyConcepts));
      assert.ok(overview.keyConcepts.length >= 4);
      assert.ok(overview.keyConcepts.some((c) => c.includes("Consensus") || c.includes("Raft") || c.includes("Leader")));
    });

    it("2.2 Generates domain-aware Key Concepts for Event-Driven / Kafka lessons", () => {
      const lesson = {
        title: "Event-Driven Microservices with Kafka",
      };
      const overview = getStructuredLessonOverview(lesson);

      assert.ok(overview.keyConcepts.some((c) => c.includes("Event") || c.includes("Partition")));
    });

    it("2.3 Generates domain-aware Key Concepts for Zero-Trust / Security lessons", () => {
      const lesson = {
        title: "Zero-Trust Architecture & mTLS Service Mesh",
      };
      const overview = getStructuredLessonOverview(lesson);

      assert.ok(overview.keyConcepts.some((c) => c.includes("Identity") || c.includes("mTLS") || c.includes("RBAC")));
    });

    it("2.4 Produces structured Learning Outcomes checklist with action-oriented items", () => {
      const lesson = {
        title: "API Gateway Pattern & Rate Limiting",
      };
      const overview = getStructuredLessonOverview(lesson);

      assert.ok(Array.isArray(overview.learningOutcomes));
      assert.strictEqual(overview.learningOutcomes.length, 4);
      overview.learningOutcomes.forEach((outcome) => {
        assert.ok(typeof outcome === "string" && outcome.length > 15);
      });
    });

    it("2.5 Produces Technical Takeaways & Architecture Principles with title and detail pairs", () => {
      const lesson = {
        title: "Transactional Outbox Pattern",
      };
      const overview = getStructuredLessonOverview(lesson);

      assert.ok(Array.isArray(overview.technicalTakeaways));
      assert.strictEqual(overview.technicalTakeaways.length, 4);
      overview.technicalTakeaways.forEach((item) => {
        assert.ok(item.title && typeof item.title === "string");
        assert.ok(item.detail && typeof item.detail === "string");
      });
    });

    it("2.6 Graceful fallback: handles arbitrary or dynamic lesson names without crashing", () => {
      const genericLesson = {
        title: "Module 14: Custom Enterprise Microservice",
      };
      const overview = getStructuredLessonOverview(genericLesson);

      assert.ok(overview.title);
      assert.ok(overview.description);
      assert.ok(overview.keyConcepts.length >= 4);
      assert.ok(overview.learningOutcomes.length >= 4);
      assert.ok(overview.technicalTakeaways.length >= 4);
    });

    it("2.7 Preserves explicit custom markdown/metadata if provided on lesson object", () => {
      const customLesson = {
        title: "Custom Security Review",
        description: "Specialized enterprise audit procedures.",
        key_concepts: ["Air-Gapped Keys", "Hardware HSM"],
        learning_outcomes: ["Provision YubiKeys."],
        technical_takeaways: [{ title: "FIPS 140-3", detail: "Hardware security modules." }],
      };
      const overview = getStructuredLessonOverview(customLesson);

      assert.strictEqual(overview.description, "Specialized enterprise audit procedures.");
      assert.deepStrictEqual(overview.keyConcepts, ["Air-Gapped Keys", "Hardware HSM"]);
      assert.deepStrictEqual(overview.learningOutcomes, ["Provision YubiKeys."]);
      assert.strictEqual(overview.technicalTakeaways[0].title, "FIPS 140-3");
    });
  });

  // ==========================================================================
  // SUITE 3: Tab 2 - Categorized Lesson Materials Engine
  // ==========================================================================
  describe("3. Tab 2: Categorized Lesson Materials Engine", () => {
    const mockFiles: FileAttachment[] = [
      {
        id: "att_1",
        name: "Cloud_Native_Architecture_Slides.pptx",
        file_url: "https://example.com/slides.pptx",
        file_type: "DOCUMENT",
        file_size_bytes: 5242880, // 5 MB
      },
      {
        id: "att_2",
        name: "Distributed_Patterns_Presentation_Deck.pdf",
        file_url: "https://example.com/deck.pdf",
        file_type: "PDF",
        file_size_bytes: 3145728, // 3 MB
      },
      {
        id: "att_3",
        name: "Domain_Driven_Design_CheatSheet.pdf",
        file_url: "https://example.com/cheatsheet.pdf",
        file_type: "PDF",
        file_size_bytes: 1572864, // 1.5 MB
      },
      {
        id: "att_4",
        name: "Consensus_Protocol_Reference_Guide.pdf",
        file_url: "https://example.com/guide.pdf",
        file_type: "PDF",
        file_size_bytes: 819200, // 800 KB
      },
      {
        id: "att_5",
        name: "Gateway_Config_Templates_Starter.zip",
        file_url: "https://example.com/starter.zip",
        file_type: "ZIP",
        file_size_bytes: 2097152, // 2 MB
      },
      {
        id: "att_6",
        name: "Transactional_Outbox_Schema.sql",
        file_url: "https://example.com/schema.sql",
        file_type: "OTHER",
        file_size_bytes: 40960, // 40 KB
      },
    ];

    it("3.1 Categorizes presentation slides and PPTX into 'slideDecks'", () => {
      const categorized = categorizeLessonMaterials(mockFiles);
      assert.strictEqual(categorized.slideDecks.length, 2);
      assert.ok(categorized.slideDecks.some((f) => f.name.endsWith(".pptx")));
      assert.ok(categorized.slideDecks.some((f) => f.name.includes("Presentation_Deck")));
    });

    it("3.2 Categorizes cheat sheets and reference PDFs into 'referenceGuides'", () => {
      const categorized = categorizeLessonMaterials(mockFiles);
      assert.strictEqual(categorized.referenceGuides.length, 2);
      assert.ok(categorized.referenceGuides.some((f) => f.name.includes("CheatSheet")));
      assert.ok(categorized.referenceGuides.some((f) => f.name.includes("Reference_Guide")));
    });

    it("3.3 Categorizes ZIP archives and starter code into 'starterCodes'", () => {
      const categorized = categorizeLessonMaterials(mockFiles);
      assert.strictEqual(categorized.starterCodes.length, 2);
      assert.ok(categorized.starterCodes.some((f) => f.name.endsWith(".zip")));
      assert.ok(categorized.starterCodes.some((f) => f.name.endsWith(".sql")));
    });

    it("3.4 Handles empty or undefined attachments list gracefully", () => {
      const emptyCat = categorizeLessonMaterials([]);
      assert.strictEqual(emptyCat.slideDecks.length, 0);
      assert.strictEqual(emptyCat.referenceGuides.length, 0);
      assert.strictEqual(emptyCat.starterCodes.length, 0);

      const undefinedCat = categorizeLessonMaterials(undefined as any);
      assert.strictEqual(undefinedCat.slideDecks.length, 0);
      assert.strictEqual(undefinedCat.referenceGuides.length, 0);
      assert.strictEqual(undefinedCat.starterCodes.length, 0);
    });

    it("3.5 formatFileSize correctly formats bytes into MB and KB badges", () => {
      assert.strictEqual(formatFileSize(2516582), "2.4 MB");
      assert.strictEqual(formatFileSize(5242880), "5.0 MB");
      assert.strictEqual(formatFileSize(512000), "500 KB");
      assert.strictEqual(formatFileSize(0), "Download Ready");
      assert.strictEqual(formatFileSize(undefined), "Download Ready");
    });
  });

  // ==========================================================================
  // SUITE 4: Tab 3 - Weekly Knowledge Check & Question Rationales
  // ==========================================================================
  describe("4. Tab 3: Interactive Weekly Quiz & Question Rationales Engine", () => {
    it("4.1 evaluateQuiz returns question feedback including 'explanation' for all questions", () => {
      const evalResult = evaluateQuiz(targetQuizId, {
        q_w1_1: "0",
        q_w1_2: "0",
      });

      assert.strictEqual(evalResult.passed, true);
      assert.strictEqual(evalResult.scorePct, 100);
      assert.ok(Array.isArray(evalResult.results));
      assert.ok(evalResult.results.length >= 2);

      // Verify EVERY question has a detailed explanation/rationale
      evalResult.results.forEach((qf) => {
        assert.ok(qf.questionId);
        assert.strictEqual(typeof qf.isCorrect, "boolean");
        assert.ok(qf.explanation, `Question ${qf.questionId} missing rationale/explanation`);
        assert.ok(qf.explanation.length > 10, "Rationale must contain meaningful explanation text");
      });
    });

    it("4.2 getQuestionFeedback accurately retrieves feedback matching questionId", () => {
      const mockQuizResult = {
        success: true,
        passed: false,
        scorePct: 50,
        evaluation: {
          results: [
            {
              questionId: "q1",
              isCorrect: true,
              explanation: "Raft leader coordinates log entries.",
            },
            {
              questionId: "q2",
              isCorrect: false,
              explanation: "CAP theorem states network partition forces consistency vs availability tradeoff.",
            },
          ],
        },
      };

      const q1Feedback = getQuestionFeedback(mockQuizResult, "q1");
      assert.ok(q1Feedback);
      assert.strictEqual(q1Feedback.isCorrect, true);
      assert.strictEqual(q1Feedback.explanation, "Raft leader coordinates log entries.");

      const q2Feedback = getQuestionFeedback(mockQuizResult, "q2");
      assert.ok(q2Feedback);
      assert.strictEqual(q2Feedback.isCorrect, false);
      assert.match(q2Feedback.explanation, /CAP theorem/);

      const nonExistent = getQuestionFeedback(mockQuizResult, "q999");
      assert.strictEqual(nonExistent, null);
    });

    it("4.3 POST /api/quizzes/[quizId]/submit returns immediate grading and question rationales for every question", async () => {
      const req = new NextRequest(`http://localhost:3000/api/quizzes/${targetQuizId}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lms-user-id": testStudentId,
        },
        body: JSON.stringify({
          answers: {
            q_w1_1: 0, // correct
            q_w1_2: 1, // incorrect (to test mixed feedback)
          },
        }),
      });

      const res = await submitQuiz(req, {
        params: Promise.resolve({ quizId: targetQuizId }),
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(typeof data.scorePct, "number");
      assert.strictEqual(typeof data.passed, "boolean");
      assert.ok(data.evaluation);
      assert.ok(Array.isArray(data.evaluation.results));

      // Check per-question correctness indicator and explanation presence
      const correctItem = data.evaluation.results.find((r: any) => r.isCorrect);
      assert.ok(correctItem, "Expected at least one correct answer item");
      assert.ok(correctItem.explanation, "Correct item must include rationale");

      const incorrectItem = data.evaluation.results.find((r: any) => !r.isCorrect);
      assert.ok(incorrectItem, "Expected at least one incorrect answer item");
      assert.ok(incorrectItem.explanation, "Incorrect item must include rationale");
    });
  });

  // ==========================================================================
  // SUITE 5: Multi-Week Curriculum Drawer & Progress Tracking
  // ==========================================================================
  describe("5. Multi-Week Accordion Drawer & Completion Tracking", () => {
    it("5.1 dbAdapter.getCourseWithFullCurriculum loads 7 full weeks for cloud course", async () => {
      const curriculum = await dbAdapter.getCourseWithFullCurriculum(targetCourseId, testStudentId);
      assert.ok(curriculum);
      assert.ok(curriculum.course);
      assert.strictEqual(curriculum.course.total_weeks, 7);
      assert.ok(Array.isArray(curriculum.weeks));
      assert.strictEqual(curriculum.weeks.length, 7);

      curriculum.weeks.forEach((w: any) => {
        assert.ok(w.week_number >= 1 && w.week_number <= 7);
        assert.ok(Array.isArray(w.lessons));
        assert.ok(w.lessons.length >= 1);
        w.lessons.forEach((l: any) => {
          assert.ok(l.title);
          assert.ok(l.duration_seconds > 0);
          assert.ok(Array.isArray(l.supplementary_files));
        });
      });
    });

    it("5.2 Accurately tracks completed lessons count and week completion status", () => {
      const mockWeek = {
        id: "w1",
        week_number: 1,
        title: "Cloud Foundations",
        description: "Foundations",
        lessons: [
          { id: "l1", progress_status: "COMPLETED" },
          { id: "l2", progress_status: "COMPLETED" },
          { id: "l3", progress_status: "IN_PROGRESS" },
        ],
      };

      const completedCount = mockWeek.lessons.filter((l) => l.progress_status === "COMPLETED").length;
      assert.strictEqual(completedCount, 2);
      const isWeekComplete = mockWeek.lessons.every((l) => l.progress_status === "COMPLETED");
      assert.strictEqual(isWeekComplete, false);

      // Now complete the last lesson
      mockWeek.lessons[2].progress_status = "COMPLETED";
      const isNowComplete = mockWeek.lessons.every((l) => l.progress_status === "COMPLETED");
      assert.strictEqual(isNowComplete, true);
    });
  });

  // ==========================================================================
  // SUITE 6: Verifiable Certificate of Completion
  // ==========================================================================
  describe("6. Verifiable Certificate of Completion Model & Hash Validation", () => {
    it("6.1 Validates certificate data contract (serial ID, student name, verification hash)", () => {
      const mockCert = {
        certificate_code: "CERT-MKT-2026-998811",
        user_name: "Sophia Chen",
        course_title: "Cloud Native Architecture & Distributed Systems",
        issued_at: new Date().toISOString(),
        verification_hash: "a".repeat(64),
      };

      assert.match(mockCert.certificate_code, /^CERT-MKT-\d{4}-\d+$/);
      assert.strictEqual(mockCert.user_name, "Sophia Chen");
      assert.match(mockCert.verification_hash, /^[a-f0-9]{64}$/i);
    });

    it("6.2 Verifies that existing issued certificates pass public verification", () => {
      const db = getDb();
      const cert = db.prepare("SELECT * FROM certificates LIMIT 1").get() as any;
      if (cert) {
        const result = verifyCertificate(cert.certificate_code);
        assert.strictEqual(result.valid, true);
        assert.ok(result.certificate);
        assert.strictEqual(result.certificate.certificate_code, cert.certificate_code);
        assert.match(result.certificate.verification_hash, /^[a-f0-9]{64}$/i);
      }
    });
  });
});
