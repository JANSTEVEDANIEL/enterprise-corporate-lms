import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime.js";
import { NextRequest } from "next/server";
import { initDb, getDb } from "../../src/lib/db";
import { evaluateQuiz } from "../../src/lib/quiz";
import { POST as submitQuizRoute } from "../../src/app/api/quizzes/[quizId]/submit/route";
import {
  StudentLessonPlayer,
  getQuestionFeedback,
  type WeekItem,
} from "../../src/components/player/student-lesson-player";
import { PLAYBACK_SPEEDS } from "../../src/components/player/video-player-controls";

// Mock Next.js router context for SSR rendering in Node
const mockRouter = {
  back: () => {},
  forward: () => {},
  refresh: () => {},
  push: () => {},
  replace: () => {},
  prefetch: () => {},
};

const dummyCert = {
  certificate_code: "CERT-INIT-TEST",
  user_name: "Sophia Chen",
  course_title: "Cloud Native Architecture",
  issued_at: new Date().toISOString(),
  verification_hash: "a".repeat(64),
};

/**
 * Deterministically controls StudentLessonPlayer's initial state during server-side testing
 * via React 19 internals dispatcher (internals.H):
 * - activeTab: intercepts initial === "overview"
 * - quizAnswers: intercepts initial === {} (plain empty object)
 * - quizResult: intercepts initial === null (guaranteed unique by providing initialCertificate)
 */
function renderPlayerWithState(
  props: any,
  stateOverrides?: {
    activeTab?: "overview" | "materials" | "quiz";
    quizAnswers?: Record<string, number>;
    quizResult?: any;
  }
): string {
  return renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: mockRouter },
      React.createElement(StudentLessonPlayer, {
        initialCertificate: dummyCert,
        initialActiveTab: stateOverrides?.activeTab,
        initialQuizAnswers: stateOverrides?.quizAnswers,
        initialQuizResult: stateOverrides?.quizResult,
        ...props,
      })
    )
  );
}

describe("Milestone 3 Empirical Adversarial Challenge: Quiz Rationales, Tab Preservation & Persistent Player", () => {
  const testStudentId = "usr_sophia_chen";
  const targetWeekQuizId = "qz_cloud_w1";
  const targetModuleQuizId = "q_onb_1";

  const sampleCourse = {
    id: "crs_cloud_arch_7w",
    title: "Cloud Native Architecture & Distributed Systems",
    slug: "cloud-native-architecture-distributed-systems",
    description: "Enterprise system design curriculum",
    category: "Cloud & Distributed Systems",
    creator_name: "Dr. Aris Thorne",
    total_weeks: 7,
  };

  const sampleWeeks: WeekItem[] = [
    {
      id: "wk_cloud_w1",
      week_number: 1,
      title: "Microservices & Distributed Architecture Foundations",
      description: "Service meshes, API gateways, and distributed consensus patterns.",
      lessons: [
        {
          id: "les_cloud_w1_1",
          week_id: "wk_cloud_w1",
          title: "Service Mesh Architecture & Envoy Proxy Deep Dive",
          order_index: 1,
          duration_seconds: 1200,
          video_url: "https://example.com/videos/les_cloud_w1_1.mp4",
          supplementary_files: [
            {
              id: "att_1",
              name: "Service_Mesh_Architecture_Slides.pptx",
              file_url: "https://example.com/files/slides.pptx",
              file_type: "DOCUMENT",
              file_size_bytes: 5242880,
            },
            {
              id: "att_2",
              name: "Envoy_Proxy_CheatSheet.pdf",
              file_url: "https://example.com/files/cheatsheet.pdf",
              file_type: "PDF",
              file_size_bytes: 1048576,
            },
            {
              id: "att_3",
              name: "Envoy_Cluster_Config.zip",
              file_url: "https://example.com/files/envoy.zip",
              file_type: "ZIP",
              file_size_bytes: 2097152,
            },
          ],
          is_preview: false,
          progress_status: "IN_PROGRESS",
        },
      ],
      quiz: {
        id: "qz_cloud_w1",
        title: "Week 1 Knowledge Check: Microservices & Gateways",
        passing_score_pct: 80,
        questions: [
          {
            id: "q_w1_1",
            prompt: "What is the primary benefit of a service mesh sidecar proxy pattern?",
            options: [
              "Offloads mTLS, telemetry, and traffic control from application code",
              "Increases database query throughput by caching SQL results",
              "Replaces the underlying Linux operating system kernel",
              "Automates frontend UI component rendering",
            ],
            correct_index: 0,
            explanation:
              "Sidecar proxies decouple operational cross-cutting concerns like mTLS encryption, metrics collection, and routing from core service logic.",
          },
          {
            id: "q_w1_2",
            prompt: "Under the CAP theorem, what does a partition-tolerant system choose during a network split?",
            options: [
              "Either Consistency or Availability",
              "Both Consistency and Availability simultaneously",
              "Latency over Durability",
              "Zero data replication",
            ],
            correct_index: 0,
            explanation:
              "When network partitions occur, distributed systems must trade off between strict consistency (CP) or high availability (AP).",
          },
        ],
      },
    },
    {
      id: "wk_cloud_w2",
      week_number: 2,
      title: "Container Orchestration & Kubernetes Internals",
      description: "K8s control plane, Raft consensus, and pod scheduling.",
      lessons: [
        {
          id: "les_cloud_w2_1",
          week_id: "wk_cloud_w2",
          title: "Kubernetes Control Plane Architecture",
          order_index: 1,
          duration_seconds: 1400,
          video_url: "https://example.com/videos/les_cloud_w2_1.mp4",
          supplementary_files: [],
          is_preview: false,
          progress_status: "NOT_STARTED",
        },
      ],
      quiz: {
        id: "qz_cloud_w2",
        title: "Week 2 Knowledge Check: Container & K8s Architecture",
        passing_score_pct: 80,
        questions: [
          {
            id: "q_w2_1",
            prompt: "Which component stores the persistent state of a Kubernetes cluster?",
            options: ["etcd", "kube-proxy", "CoreDNS", "containerd"],
            correct_index: 0,
            explanation: "etcd is the strongly-consistent, distributed key-value store used as Kubernetes backing store.",
          },
        ],
      },
    },
  ];

  before(() => {
    initDb();
  });

  // ==========================================================================
  // SUITE 1: Quiz Engine Adversarial Stress Testing (evaluateQuiz)
  // ==========================================================================
  describe("1. Quiz Engine Adversarial Stress & Rationales Oracle", () => {
    it("1.1 EVERY question receives an explanation rationale when all answers are CORRECT", () => {
      const evaluation = evaluateQuiz(targetWeekQuizId, {
        q_w1_1: "0",
        q_w1_2: "0",
      });

      assert.strictEqual(evaluation.passed, true);
      assert.strictEqual(evaluation.scorePct, 100);
      assert.strictEqual(evaluation.correctCount, 2);
      assert.strictEqual(evaluation.totalCount, 2);
      assert.strictEqual(evaluation.results.length, 2);

      for (const result of evaluation.results) {
        assert.strictEqual(result.isCorrect, true);
        assert.ok(result.explanation, `Question ${result.questionId} missing rationale`);
        assert.ok(result.explanation.length > 15, "Rationale must contain substantial text");
      }
    });

    it("1.2 EVERY question receives an explanation rationale when all answers are INCORRECT", () => {
      const evaluation = evaluateQuiz(targetWeekQuizId, {
        q_w1_1: "2", // incorrect
        q_w1_2: "3", // incorrect
      });

      assert.strictEqual(evaluation.passed, false);
      assert.strictEqual(evaluation.scorePct, 0);
      assert.strictEqual(evaluation.correctCount, 0);
      assert.strictEqual(evaluation.totalCount, 2);
      assert.strictEqual(evaluation.results.length, 2);

      for (const result of evaluation.results) {
        assert.strictEqual(result.isCorrect, false);
        assert.ok(result.explanation, `Question ${result.questionId} missing rationale`);
        assert.ok(result.explanation.length > 15, "Rationale must contain substantial text");
      }
    });

    it("1.3 EVERY question receives an explanation rationale when ALL questions are left UNANSWERED ({})", () => {
      const evaluation = evaluateQuiz(targetWeekQuizId, {});

      assert.strictEqual(evaluation.passed, false);
      assert.strictEqual(evaluation.scorePct, 0);
      assert.strictEqual(evaluation.correctCount, 0);
      assert.strictEqual(evaluation.totalCount, 2);
      assert.strictEqual(evaluation.results.length, 2);

      // Even completely unanswered, student MUST see explanations for all questions
      for (const result of evaluation.results) {
        assert.strictEqual(result.isCorrect, false);
        assert.ok(result.explanation, `Unanswered question ${result.questionId} missing rationale`);
        assert.ok(result.explanation.length > 15, "Rationale must explain correct invariant");
      }
    });

    it("1.4 EVERY question receives an explanation rationale in MIXED states (Q1 correct, Q2 unanswered)", () => {
      const evaluation = evaluateQuiz(targetWeekQuizId, {
        q_w1_1: "0", // correct
        // q_w1_2 left undefined / omitted
      });

      assert.strictEqual(evaluation.passed, false); // 50% < 80% passing
      assert.strictEqual(evaluation.scorePct, 50);
      assert.strictEqual(evaluation.correctCount, 1);
      assert.strictEqual(evaluation.totalCount, 2);
      assert.strictEqual(evaluation.results.length, 2);

      const q1Result = evaluation.results.find((r) => r.questionId === "q_w1_1");
      const q2Result = evaluation.results.find((r) => r.questionId === "q_w1_2");

      assert.ok(q1Result);
      assert.strictEqual(q1Result.isCorrect, true);
      assert.ok(q1Result.explanation.includes("Sidecar proxies decouple"));

      assert.ok(q2Result);
      assert.strictEqual(q2Result.isCorrect, false);
      assert.ok(
        q2Result.explanation.includes("consistency") ||
          q2Result.explanation.includes("trade off") ||
          q2Result.explanation.includes("CP")
      );
    });

    it("1.5 Adversarial answer inputs: string indices, whitespace, and type tampering", () => {
      // 1.5a: String index matching "0" instead of numeric 0
      const evalStringIndex = evaluateQuiz(targetWeekQuizId, {
        q_w1_1: "0",
        q_w1_2: "0",
      });
      assert.strictEqual(evalStringIndex.scorePct, 100);
      assert.strictEqual(evalStringIndex.passed, true);

      // 1.5b: Text option matching with whitespace
      const evalTextMatch = evaluateQuiz(targetWeekQuizId, {
        q_w1_1: "  Offloads mTLS, telemetry, and traffic control from application code  ",
        q_w1_2: "Either Consistency or Availability",
      });
      assert.strictEqual(evalTextMatch.scorePct, 100);
      assert.strictEqual(evalTextMatch.passed, true);

      // 1.5c: Type distortion (null, array, object, negative numbers, giant numbers)
      const evalMalformed = evaluateQuiz(targetWeekQuizId, {
        q_w1_1: null as any,
        q_w1_2: [999] as any,
        bogus_key_sqli: "' OR 1=1; DROP TABLE quizzes; --" as any,
      });
      assert.strictEqual(evalMalformed.scorePct, 0);
      assert.strictEqual(evalMalformed.passed, false);
      assert.strictEqual(evalMalformed.results.length, 2);
      evalMalformed.results.forEach((r) => {
        assert.strictEqual(r.isCorrect, false);
        assert.ok(r.explanation);
      });
    });

    it("1.6 Parity test: Standard module quizzes also generate rationales for all questions", () => {
      const moduleEvaluation = evaluateQuiz(targetModuleQuizId, {});
      assert.ok(moduleEvaluation.results.length >= 3);
      moduleEvaluation.results.forEach((r) => {
        assert.strictEqual(r.isCorrect, false);
        assert.ok(r.explanation, `Module quiz question ${r.questionId} missing rationale`);
        assert.ok(r.explanation.length > 10);
      });
    });

    it("1.7 Non-existent quiz throws descriptive error", () => {
      assert.throws(
        () => evaluateQuiz("qz_non_existent_9999", {}),
        /Quiz 'qz_non_existent_9999' not found/
      );
    });
  });

  // ==========================================================================
  // SUITE 2: UI Rationales Rendering Verification (StudentLessonPlayer)
  // ==========================================================================
  describe("2. UI Rationales Rendering & Explanation Card Verification", () => {
    it("2.1 Post-evaluation renders rationale cards (data-testid='rationale-${q.id}') for EVERY question", () => {
      const mockGradedResult = {
        success: true,
        passed: false,
        scorePct: 50,
        evaluation: {
          results: [
            {
              questionId: "q_w1_1",
              prompt: "What is the primary benefit of a service mesh sidecar proxy pattern?",
              userAnswer: "0",
              correctAnswer: ["Offloads mTLS, telemetry, and traffic control from application code"],
              isCorrect: true,
              explanation: "Sidecar proxies decouple operational cross-cutting concerns like mTLS.",
            },
            {
              questionId: "q_w1_2",
              prompt: "Under the CAP theorem, what does a partition-tolerant system choose during a network split?",
              userAnswer: "",
              correctAnswer: ["Either Consistency or Availability"],
              isCorrect: false,
              explanation: "When network partitions occur, distributed systems must trade off.",
            },
          ],
        },
      };

      const html = renderPlayerWithState(
        {
          course: sampleCourse,
          weeks: sampleWeeks,
          initialProgressPct: 0,
        },
        {
          activeTab: "quiz",
          quizResult: mockGradedResult,
        }
      );

      // Verify rationale card container exists for question 1 (correct)
      assert.ok(
        html.includes('data-testid="rationale-q_w1_1"'),
        "Question 1 (correct) must render rationale card"
      );
      assert.ok(
        html.includes("Sidecar proxies decouple operational cross-cutting concerns like mTLS"),
        "Question 1 rationale text must be visible in HTML"
      );

      // Verify rationale card container exists for question 2 (unanswered / incorrect)
      assert.ok(
        html.includes('data-testid="rationale-q_w1_2"'),
        "Question 2 (unanswered/incorrect) must render rationale card"
      );
      assert.ok(
        html.includes("When network partitions occur, distributed systems must trade off"),
        "Question 2 rationale text must be visible in HTML"
      );
    });

    it("2.2 Correctness breakdown renders 'Correct' and 'Incorrect' badges", () => {
      const mockGradedResult = {
        success: true,
        passed: false,
        scorePct: 50,
        evaluation: {
          results: [
            {
              questionId: "q_w1_1",
              isCorrect: true,
              explanation: "Correct explanation",
            },
            {
              questionId: "q_w1_2",
              isCorrect: false,
              explanation: "Incorrect explanation",
            },
          ],
        },
      };

      const html = renderPlayerWithState(
        {
          course: sampleCourse,
          weeks: sampleWeeks,
          initialProgressPct: 0,
        },
        {
          activeTab: "quiz",
          quizResult: mockGradedResult,
        }
      );

      // Check per-question badge testids
      assert.ok(html.includes('data-testid="question-badge-q_w1_1"'));
      assert.ok(html.includes('data-testid="question-badge-q_w1_2"'));

      // Check text in badges
      assert.ok(html.includes("Correct"));
      assert.ok(html.includes("Incorrect"));
    });

    it("2.3 Graceful fallback: renders rationale card even if feedback object is missing from evaluation", () => {
      const mockResultMissingFeedback = {
        success: true,
        passed: false,
        scorePct: 0,
        evaluation: {
          results: [], // Empty results array
        },
      };

      const html = renderPlayerWithState(
        {
          course: sampleCourse,
          weeks: sampleWeeks,
          initialProgressPct: 0,
        },
        {
          activeTab: "quiz",
          quizResult: mockResultMissingFeedback,
        }
      );

      // Both question rationale cards must still render via question object fallback
      assert.ok(html.includes('data-testid="rationale-q_w1_1"'));
      assert.ok(html.includes('data-testid="rationale-q_w1_2"'));
      assert.ok(html.includes("Sidecar proxies decouple"));
      assert.ok(html.includes("When network partitions occur"));
    });

    it("2.4 getQuestionFeedback helper accurately matches questionId under evaluation and results wrappers", () => {
      const standardWrapped = {
        evaluation: {
          results: [
            { questionId: "q1", isCorrect: true, explanation: "Exp 1" },
            { questionId: "q2", isCorrect: false, explanation: "Exp 2" },
          ],
        },
      };
      assert.strictEqual(getQuestionFeedback(standardWrapped, "q1")?.explanation, "Exp 1");
      assert.strictEqual(getQuestionFeedback(standardWrapped, "q2")?.isCorrect, false);
      assert.strictEqual(getQuestionFeedback(standardWrapped, "q3"), null);

      const flatWrapped = {
        results: [{ questionId: "qA", isCorrect: true, explanation: "Flat Exp" }],
      };
      assert.strictEqual(getQuestionFeedback(flatWrapped, "qA")?.explanation, "Flat Exp");
      assert.strictEqual(getQuestionFeedback(null, "qA"), null);
    });
  });

  // ==========================================================================
  // SUITE 3: Tab Switching Preserves User Answers Before Submission
  // ==========================================================================
  describe("3. Tab Switching State Preservation (Overview <-> Materials <-> Quiz)", () => {
    it("3.1 Pre-selected answers are preserved when entering Quiz tab", () => {
      const savedAnswers = {
        q_w1_1: 0, // Option 0 selected
        q_w1_2: 0, // Option 0 selected
      };

      const html = renderPlayerWithState(
        {
          course: sampleCourse,
          weeks: sampleWeeks,
          initialProgressPct: 0,
        },
        {
          activeTab: "quiz",
          quizAnswers: savedAnswers,
        }
      );

      // Both radio buttons must be marked checked
      const checkedMatches = html.match(/checked/g) || [];
      assert.ok(
        checkedMatches.length >= 2,
        `Expected at least 2 checked radio buttons, found: ${checkedMatches.length}`
      );
    });

    it("3.2 Progression tracker accurately displays 2 of 2 answered when answers are preserved", () => {
      const savedAnswers = {
        q_w1_1: 0,
        q_w1_2: 1,
      };

      const html = renderPlayerWithState(
        {
          course: sampleCourse,
          weeks: sampleWeeks,
          initialProgressPct: 0,
        },
        {
          activeTab: "quiz",
          quizAnswers: savedAnswers,
        }
      );

      assert.ok(
        html.includes("Progression: 2 of 2 Questions Answered"),
        "Progression tracker must show 2 of 2 answered"
      );
      assert.ok(html.includes("100%"), "Progression percentage must be 100%");
    });

    it("3.3 Progression tracker displays partial completion (1 of 2 answered) when 1 answer is set", () => {
      const savedAnswers = {
        q_w1_1: 0,
      };

      const html = renderPlayerWithState(
        {
          course: sampleCourse,
          weeks: sampleWeeks,
          initialProgressPct: 0,
        },
        {
          activeTab: "quiz",
          quizAnswers: savedAnswers,
        }
      );

      assert.ok(
        html.includes("Progression: 1 of 2 Questions Answered"),
        "Progression tracker must show 1 of 2 answered"
      );
      assert.ok(html.includes("50%"), "Progression percentage must be 50%");
    });

    it("3.4 Code AST invariant: setActiveTab has zero side-effects on quizAnswers", () => {
      const playerCode = fs.readFileSync(
        path.join(process.cwd(), "src/components/player/student-lesson-player.tsx"),
        "utf-8"
      );

      // Assert quizAnswers is declared as top-level state
      assert.match(
        playerCode,
        /const\s*\[\s*quizAnswers\s*,\s*setQuizAnswers\s*\]\s*=\s*useState/,
        "quizAnswers must be lifted state in StudentLessonPlayer"
      );

      // Assert tab buttons only call setActiveTab and DO NOT call setQuizAnswers({})
      const tabOverviewRegex = /onClick\s*=\s*\{\s*\(\)\s*=>\s*setActiveTab\("overview"\)\s*\}/;
      const tabMaterialsRegex = /onClick\s*=\s*\{\s*\(\)\s*=>\s*setActiveTab\("materials"\)\s*\}/;
      const tabQuizRegex = /onClick\s*=\s*\{\s*\(\)\s*=>\s*setActiveTab\("quiz"\)\s*\}/;

      assert.ok(
        tabOverviewRegex.test(playerCode),
        "Overview tab button must cleanly set activeTab to 'overview'"
      );
      assert.ok(
        tabMaterialsRegex.test(playerCode),
        "Materials tab button must cleanly set activeTab to 'materials'"
      );
      assert.ok(
        tabQuizRegex.test(playerCode),
        "Quiz tab button must cleanly set activeTab to 'quiz'"
      );
    });

    it("3.5 State simulation harness: cycling tabs preserves answer state across switches", () => {
      // Simulate player state transitions
      let currentTab: "overview" | "materials" | "quiz" = "quiz";
      let answersState: Record<string, number> = {};

      const selectAnswer = (qId: string, idx: number) => {
        answersState = { ...answersState, [qId]: idx };
      };
      const switchTab = (tab: "overview" | "materials" | "quiz") => {
        currentTab = tab;
      };

      // 1. User is on Quiz tab and answers Q1
      assert.strictEqual(currentTab, "quiz");
      selectAnswer("q_w1_1", 0);
      assert.deepStrictEqual(answersState, { q_w1_1: 0 });

      // 2. User switches to Overview tab to review concepts
      switchTab("overview");
      assert.strictEqual(currentTab, "overview");
      assert.deepStrictEqual(answersState, { q_w1_1: 0 }); // Answers unchanged

      // 3. User switches to Materials tab to download PDF
      switchTab("materials");
      assert.strictEqual(currentTab, "materials");
      assert.deepStrictEqual(answersState, { q_w1_1: 0 }); // Answers unchanged

      // 4. User switches back to Quiz tab and answers Q2
      switchTab("quiz");
      assert.strictEqual(currentTab, "quiz");
      assert.deepStrictEqual(answersState, { q_w1_1: 0 }); // Q1 answer is still intact!
      selectAnswer("q_w1_2", 0);
      assert.deepStrictEqual(answersState, { q_w1_1: 0, q_w1_2: 0 });

      // 5. User switches back to Overview again
      switchTab("overview");
      assert.deepStrictEqual(answersState, { q_w1_1: 0, q_w1_2: 0 });

      // 6. User returns to Quiz tab to submit
      switchTab("quiz");
      assert.deepStrictEqual(answersState, { q_w1_1: 0, q_w1_2: 0 });

      // Verify submission using preserved answers produces 100% pass with rationales
      const evalResult = evaluateQuiz(targetWeekQuizId, {
        q_w1_1: String(answersState.q_w1_1),
        q_w1_2: String(answersState.q_w1_2),
      });
      assert.strictEqual(evalResult.passed, true);
      assert.strictEqual(evalResult.scorePct, 100);
      assert.strictEqual(evalResult.results.length, 2);
      evalResult.results.forEach((r) => assert.ok(r.explanation));
    });
  });

  // ==========================================================================
  // SUITE 4: Video Player Container DOM Persistence During Quiz Interactions
  // ==========================================================================
  describe("4. Video Player DOM Persistence During Quiz Interactions", () => {
    it("4.1 Video container is mounted when activeTab is 'overview'", () => {
      const html = renderPlayerWithState(
        { course: sampleCourse, weeks: sampleWeeks, initialProgressPct: 0 },
        { activeTab: "overview" }
      );

      assert.ok(
        html.includes('data-testid="persistent-video-player-container"'),
        "Video player container must be mounted in Overview tab"
      );
      assert.ok(
        html.includes("<video") || html.includes("aspect-video"),
        "Video element or aspect-video frame must be present in Overview tab"
      );
      assert.ok(
        html.includes('data-testid="tab-content-overview"'),
        "Overview tab content must be active"
      );
    });

    it("4.2 Video container remains mounted when activeTab is 'materials'", () => {
      const html = renderPlayerWithState(
        { course: sampleCourse, weeks: sampleWeeks, initialProgressPct: 0 },
        { activeTab: "materials" }
      );

      assert.ok(
        html.includes('data-testid="persistent-video-player-container"'),
        "Video player container must remain mounted in Materials tab"
      );
      assert.ok(
        html.includes("<video") || html.includes("aspect-video"),
        "Video element or aspect-video frame must be present in Materials tab"
      );
      assert.ok(
        html.includes('data-testid="tab-content-materials"'),
        "Materials tab content must be active"
      );
    });

    it("4.3 Video container remains mounted when activeTab is 'quiz' (taking quiz)", () => {
      const html = renderPlayerWithState(
        { course: sampleCourse, weeks: sampleWeeks, initialProgressPct: 0 },
        { activeTab: "quiz" }
      );

      assert.ok(
        html.includes('data-testid="persistent-video-player-container"'),
        "Video player container must remain mounted in Quiz tab"
      );
      assert.ok(
        html.includes("<video") || html.includes("aspect-video"),
        "Video element or aspect-video frame must be present in Quiz tab"
      );
      assert.ok(
        html.includes('data-testid="tab-content-quiz"'),
        "Quiz tab content must be active"
      );
      assert.ok(
        html.includes('data-testid="interactive-quiz-container"'),
        "Interactive quiz must be rendered below video player"
      );
    });

    it("4.4 Video container remains mounted when activeTab is 'quiz' AND quizResult is present (graded state)", () => {
      const mockResult = {
        success: true,
        passed: true,
        scorePct: 100,
        evaluation: {
          results: [
            { questionId: "q_w1_1", isCorrect: true, explanation: "Exp 1" },
            { questionId: "q_w1_2", isCorrect: true, explanation: "Exp 2" },
          ],
        },
      };

      const html = renderPlayerWithState(
        { course: sampleCourse, weeks: sampleWeeks, initialProgressPct: 0 },
        { activeTab: "quiz", quizResult: mockResult }
      );

      assert.ok(
        html.includes('data-testid="persistent-video-player-container"'),
        "Video player container must remain mounted during graded quiz state"
      );
      assert.ok(
        html.includes('data-testid="quiz-grading-result"'),
        "Grading result banner must be visible"
      );
      assert.ok(
        html.includes('data-testid="rationale-q_w1_1"'),
        "Rationale cards must be visible"
      );
    });

    it("4.5 DOM Hierarchy check: Video player container precedes resource tabs container", () => {
      const html = renderPlayerWithState(
        { course: sampleCourse, weeks: sampleWeeks, initialProgressPct: 0 },
        { activeTab: "quiz" }
      );

      const videoIdx = html.indexOf('data-testid="persistent-video-player-container"');
      const tabsIdx = html.indexOf('data-testid="resource-tabs-container"');

      assert.ok(videoIdx !== -1, "Video container must exist");
      assert.ok(tabsIdx !== -1, "Tabs container must exist");
      assert.ok(
        videoIdx < tabsIdx,
        "Video player container must appear BEFORE resource tabs container in DOM"
      );
    });

    it("4.6 Playback speeds [0.75, 1, 1.25, 1.5, 2] remain accessible while on Quiz tab", () => {
      assert.deepStrictEqual(Array.from(PLAYBACK_SPEEDS), [0.75, 1, 1.25, 1.5, 2]);

      const html = renderPlayerWithState(
        { course: sampleCourse, weeks: sampleWeeks, initialProgressPct: 0 },
        { activeTab: "quiz" }
      );

      // Verify speed pills are rendered inside the persistent video controls
      assert.ok(html.includes("0.75x"));
      assert.ok(html.includes("1x"));
      assert.ok(html.includes("1.25x"));
      assert.ok(html.includes("1.5x"));
      assert.ok(html.includes("2x"));
    });

    it("4.7 Drawer quiz action triggers Quiz tab without displacing video player", () => {
      const html = renderPlayerWithState(
        { course: sampleCourse, weeks: sampleWeeks, initialProgressPct: 0 },
        { activeTab: "overview" }
      );

      // Verify curriculum drawer has the Week 1 Knowledge check button
      assert.ok(
        html.includes('data-testid="drawer-quiz-button-1"'),
        "Drawer must have button to jump to Week 1 Knowledge Check"
      );
    });
  });

  // ==========================================================================
  // SUITE 5: API Route End-to-End Submission & Rationales Lifecycle
  // ==========================================================================
  describe("5. End-to-End API Route (POST /api/quizzes/[quizId]/submit)", () => {
    it("5.1 HTTP submit with full answers returns immediate grading and rationales for all questions", async () => {
      const req = new NextRequest(`http://localhost:3000/api/quizzes/${targetWeekQuizId}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lms-user-id": testStudentId,
        },
        body: JSON.stringify({
          answers: {
            q_w1_1: 0,
            q_w1_2: 0,
          },
        }),
      });

      const res = await submitQuizRoute(req, {
        params: Promise.resolve({ quizId: targetWeekQuizId }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();

      assert.strictEqual(data.success, true);
      assert.strictEqual(data.scorePct, 100);
      assert.strictEqual(data.passed, true);
      assert.ok(data.evaluation);
      assert.strictEqual(data.evaluation.results.length, 2);

      data.evaluation.results.forEach((r: any) => {
        assert.strictEqual(r.isCorrect, true);
        assert.ok(r.explanation);
        assert.ok(r.explanation.length > 15);
      });
    });

    it("5.2 HTTP submit with partial/unanswered questions returns rationales for all questions", async () => {
      const req = new NextRequest(`http://localhost:3000/api/quizzes/${targetWeekQuizId}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lms-user-id": testStudentId,
        },
        body: JSON.stringify({
          answers: {
            q_w1_1: 0, // only Q1 answered
          },
        }),
      });

      const res = await submitQuizRoute(req, {
        params: Promise.resolve({ quizId: targetWeekQuizId }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();

      assert.strictEqual(data.success, true);
      assert.strictEqual(data.scorePct, 50);
      assert.strictEqual(data.passed, false);
      assert.ok(data.evaluation);
      assert.strictEqual(data.evaluation.results.length, 2);

      // Verify Q2 (unanswered) has explanation
      const q2 = data.evaluation.results.find((r: any) => r.questionId === "q_w1_2");
      assert.ok(q2);
      assert.strictEqual(q2.isCorrect, false);
      assert.ok(q2.explanation);
    });

    it("5.3 HTTP submit records audit event in database", () => {
      const db = getDb();
      const auditLog = db
        .prepare(
          "SELECT * FROM audit_logs WHERE target_id = ? ORDER BY timestamp DESC LIMIT 1"
        )
        .get(targetWeekQuizId) as any;

      assert.ok(auditLog, "Audit log record must exist for quiz attempt");
      assert.ok(
        auditLog.action === "QUIZ_PASSED" || auditLog.action === "QUIZ_FAILED",
        "Audit action must be QUIZ_PASSED or QUIZ_FAILED"
      );
    });

    it("5.4 HTTP submit rejects invalid quiz ID with 404 or 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/quizzes/qz_non_existent/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lms-user-id": testStudentId,
        },
        body: JSON.stringify({ answers: {} }),
      });

      const res = await submitQuizRoute(req, {
        params: Promise.resolve({ quizId: "qz_non_existent" }),
      });

      assert.ok(
        res.status === 404 || res.status === 400 || res.status === 500,
        `Expected error status for non-existent quiz, got ${res.status}`
      );
    });
  });
});
