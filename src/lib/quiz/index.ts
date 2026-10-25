import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { getDb, initDb } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { generateCertificate } from "@/lib/certificates";
import type { QuizQuestion, Role, Certificate } from "@/types";

export interface QuestionFeedback {
  questionId: string;
  prompt: string;
  userAnswer: string | string[];
  correctAnswer: string[];
  isCorrect: boolean;
  explanation: string;
}

export interface QuizEvaluationResult {
  scorePct: number;
  passed: boolean;
  correctCount: number;
  totalCount: number;
  passingScorePct: number;
  results: QuestionFeedback[];
}

export interface SanitizedQuestion {
  id: string;
  order_index: number;
  prompt: string;
  question_type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
  options: { id: string; text: string }[];
}

export interface SanitizedQuiz {
  id: string;
  module_id: string;
  title: string;
  passing_score_pct: number;
  time_limit_minutes: number | null;
  questions: SanitizedQuestion[];
}

/**
 * Server-side evaluation of quiz answers strictly against database questions and answer keys.
 * Client never receives correct answers prior to grading.
 */
export function evaluateQuiz(
  quizId: string,
  answers: Record<string, string | string[]>,
  customDb?: DatabaseSync
): QuizEvaluationResult {
  if (!customDb) {
    initDb();
  }
  const db = customDb || getDb();

  const quizStmt = db.prepare("SELECT * FROM quizzes WHERE id = ?");
  const quiz = quizStmt.get(quizId) as any;
  if (!quiz) {
    throw new Error(`Quiz '${quizId}' not found in database`);
  }

  const questionsStmt = db.prepare(
    "SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY order_index ASC"
  );
  const questions = questionsStmt.all(quizId) as unknown as QuizQuestion[];

  if (questions.length === 0) {
    throw new Error(`Quiz '${quizId}' has no questions configured`);
  }

  let correctCount = 0;
  const feedbackList: QuestionFeedback[] = [];

  for (const q of questions) {
    let correctAnswers: string[] = [];
    try {
      correctAnswers = JSON.parse(q.correct_answers);
    } catch {
      correctAnswers = [q.correct_answers];
    }

    const userAnswer = answers[q.id];
    let isCorrect = false;

    if (userAnswer !== undefined && userAnswer !== null) {
      if (Array.isArray(userAnswer)) {
        const sortedUser = [...userAnswer].sort();
        const sortedCorrect = [...correctAnswers].sort();
        isCorrect =
          sortedUser.length === sortedCorrect.length &&
          sortedUser.every((val, idx) => val === sortedCorrect[idx]);
      } else {
        isCorrect = correctAnswers.length === 1 && correctAnswers[0] === userAnswer;
      }
    }

    if (isCorrect) {
      correctCount++;
    }

    feedbackList.push({
      questionId: q.id,
      prompt: q.prompt,
      userAnswer: userAnswer ?? "",
      correctAnswer: correctAnswers,
      isCorrect,
      explanation: q.explanation,
    });
  }

  const scorePct = Math.round((correctCount / questions.length) * 100);
  const passed = scorePct >= quiz.passing_score_pct;

  return {
    scorePct,
    passed,
    correctCount,
    totalCount: questions.length,
    passingScorePct: quiz.passing_score_pct,
    results: feedbackList,
  };
}

/**
 * Returns sanitized quiz metadata and question options safe for frontend rendering (no answers/explanations).
 */
export function getQuizForModule(moduleId: string, customDb?: DatabaseSync): SanitizedQuiz | null {
  if (!customDb) {
    initDb();
  }
  const db = customDb || getDb();

  const quizStmt = db.prepare("SELECT * FROM quizzes WHERE module_id = ?");
  const quiz = quizStmt.get(moduleId) as any;
  if (!quiz) {
    return null;
  }

  const questionsStmt = db.prepare(
    "SELECT id, order_index, prompt, question_type, options FROM quiz_questions WHERE quiz_id = ? ORDER BY order_index ASC"
  );
  const rows = questionsStmt.all(quiz.id) as any[];

  const questions: SanitizedQuestion[] = rows.map((r) => ({
    id: r.id,
    order_index: r.order_index,
    prompt: r.prompt,
    question_type: r.question_type,
    options: JSON.parse(r.options || "[]"),
  }));

  return {
    id: quiz.id,
    module_id: quiz.module_id,
    title: quiz.title,
    passing_score_pct: quiz.passing_score_pct,
    time_limit_minutes: quiz.time_limit_minutes,
    questions,
  };
}

export interface SubmitQuizAttemptParams {
  userId: string;
  quizId: string;
  answers: Record<string, string | string[]>;
  ipAddress?: string;
  actorRole?: Role;
  actorName?: string;
}

export interface SubmitQuizAttemptResult {
  evaluation: QuizEvaluationResult;
  submissionId: string;
  attemptNumber: number;
  passed: boolean;
  scorePct: number;
  enrollmentProgressPct: number;
  certificate?: Certificate | null;
}

/**
 * Processes full quiz submission: grades server-side, records submission attempt in DB,
 * updates progress, logs audit event, and issues certificate on 100% course completion.
 */
export function submitQuizAttempt(params: SubmitQuizAttemptParams): SubmitQuizAttemptResult {
  initDb();
  const db = getDb();

  // 1. Evaluate quiz
  const evaluation = evaluateQuiz(params.quizId, params.answers, db);

  // 2. Fetch quiz and module to get course info
  const quizStmt = db.prepare("SELECT * FROM quizzes WHERE id = ?");
  const quiz = quizStmt.get(params.quizId) as any;
  if (!quiz) {
    throw new Error(`Quiz ${params.quizId} not found`);
  }

  const moduleStmt = db.prepare("SELECT * FROM modules WHERE id = ?");
  const moduleRow = moduleStmt.get(quiz.module_id) as any;
  if (!moduleRow) {
    throw new Error(`Module ${quiz.module_id} not found`);
  }

  const courseId = moduleRow.course_id;

  // 3. Resolve enrollment
  const enrollmentStmt = db.prepare("SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?");
  let enrollment = enrollmentStmt.get(params.userId, courseId) as any;

  const now = new Date().toISOString();

  if (!enrollment) {
    // Auto-enroll if not enrolled
    const enrollmentId = `enr_${randomUUID()}`;
    db.prepare(`
      INSERT INTO enrollments (
        id, user_id, course_id, status, progress_pct, assigned_at, created_at, updated_at
      ) VALUES (?, ?, ?, 'IN_PROGRESS', 0, ?, ?, ?)
    `).run(enrollmentId, params.userId, courseId, now, now, now);

    enrollment = db.prepare("SELECT * FROM enrollments WHERE id = ?").get(enrollmentId) as any;
  }

  // 4. Calculate attempt number
  const attemptCountStmt = db.prepare(`
    SELECT COUNT(*) as count FROM quiz_submissions 
    WHERE enrollment_id = ? AND module_id = ?
  `);
  const attemptCount = (attemptCountStmt.get(enrollment.id, moduleRow.id) as any).count;
  const attemptNumber = attemptCount + 1;

  // 5. Insert quiz_submissions record
  const submissionId = `qs_${randomUUID()}`;
  db.prepare(`
    INSERT INTO quiz_submissions (
      id, enrollment_id, module_id, user_id, score, passed, attempt_number,
      answers_payload, feedback_payload, submitted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    submissionId,
    enrollment.id,
    moduleRow.id,
    params.userId,
    evaluation.scorePct,
    evaluation.passed ? 1 : 0,
    attemptNumber,
    JSON.stringify(params.answers),
    JSON.stringify(evaluation),
    now
  );

  // 6. Record audit event
  const auditAction = evaluation.passed ? "QUIZ_PASSED" : "QUIZ_FAILED";
  recordAuditEvent({
    actorId: params.userId,
    actorRole: params.actorRole || "EMPLOYEE",
    actorName: params.actorName,
    action: auditAction,
    targetType: "QUIZ",
    targetId: params.quizId,
    courseId,
    moduleId: moduleRow.id,
    moduleVersion: moduleRow.version,
    score: evaluation.scorePct,
    details: {
      attemptNumber,
      passed: evaluation.passed,
      scorePct: evaluation.scorePct,
      correctCount: evaluation.correctCount,
      totalCount: evaluation.totalCount,
    },
    ipAddress: params.ipAddress,
  });

  // 7. If passed, update module progress
  let certificate: Certificate | null = null;
  let finalProgressPct = enrollment.progress_pct;

  if (evaluation.passed) {
    // Record or update module_progress
    const mpExisting = db.prepare(`
      SELECT * FROM module_progress WHERE enrollment_id = ? AND module_id = ?
    `).get(enrollment.id, moduleRow.id) as any;

    if (mpExisting) {
      db.prepare(`
        UPDATE module_progress 
        SET status = 'COMPLETED', completed_at = ?, updated_at = ?
        WHERE id = ?
      `).run(now, now, mpExisting.id);
    } else {
      const mpId = `mp_${randomUUID()}`;
      db.prepare(`
        INSERT INTO module_progress (
          id, enrollment_id, module_id, user_id, status, completed_at,
          time_spent_seconds, last_position_seconds, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'COMPLETED', ?, 600, 600, ?, ?)
      `).run(mpId, enrollment.id, moduleRow.id, params.userId, now, now, now);
    }

    // 8. Recalculate course progress
    const allModulesStmt = db.prepare("SELECT id FROM modules WHERE course_id = ?");
    const allModules = allModulesStmt.all(courseId) as any[];
    const totalModules = allModules.length;

    const completedStmt = db.prepare(`
      SELECT COUNT(DISTINCT module_id) as count FROM module_progress
      WHERE enrollment_id = ? AND status = 'COMPLETED'
    `);
    const completedCount = (completedStmt.get(enrollment.id) as any).count;

    finalProgressPct = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 100;
    if (finalProgressPct > 100) finalProgressPct = 100;

    const isCourseCompleted = finalProgressPct === 100;

    db.prepare(`
      UPDATE enrollments 
      SET progress_pct = ?, status = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(
      finalProgressPct,
      isCourseCompleted ? "COMPLETED" : "IN_PROGRESS",
      isCourseCompleted ? now : enrollment.completed_at,
      now,
      enrollment.id
    );

    // 9. If course is 100% complete, issue certificate!
    if (isCourseCompleted) {
      certificate = generateCertificate({
        userId: params.userId,
        courseId,
        enrollmentId: enrollment.id,
        score: evaluation.scorePct,
        actorRole: params.actorRole,
        actorName: params.actorName,
      });
    }
  }

  return {
    evaluation,
    submissionId,
    attemptNumber,
    passed: evaluation.passed,
    scorePct: evaluation.scorePct,
    enrollmentProgressPct: finalProgressPct,
    certificate,
  };
}
