"use client";
import React, { useState } from "react";
import Link from "next/link";
import {
  Award,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Send,
  AlertTriangle,
  History,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { QuestionCard } from "./question-card";
import type { SanitizedQuiz, QuizEvaluationResult } from "@/lib/quiz";
import type { Certificate } from "@/types";

interface QuizRunnerProps {
  quiz: SanitizedQuiz;
  courseId: string;
  moduleId: string;
  initialSubmissions?: any[];
  onQuizCompleted?: (result: QuizEvaluationResult, certificate?: Certificate | null) => void;
}

export function QuizRunner({
  quiz,
  courseId,
  moduleId,
  initialSubmissions = [],
  onQuizCompleted,
}: QuizRunnerProps) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState<QuizEvaluationResult | null>(null);
  const [earnedCertificate, setEarnedCertificate] = useState<Certificate | null>(null);
  const [submissionHistory, setSubmissionHistory] = useState<any[]>(initialSubmissions);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check if previously passed from history
  const latestPassed = submissionHistory.find((s) => s.passed === 1);

  const handleSelectAnswer = (questionId: string, val: string | string[]) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: val,
    }));
  };

  const answeredCount = Object.keys(answers).filter((k) => {
    const val = answers[k];
    return Array.isArray(val) ? val.length > 0 : Boolean(val);
  }).length;

  const totalQuestions = quiz.questions.length;
  const allAnswered = answeredCount === totalQuestions;

  const handleSubmit = async () => {
    if (!allAnswered) {
      setErrorMessage("Please answer all questions before submitting your assessment.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/quizzes/${quiz.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to evaluate quiz");
      }

      setEvaluation(data.evaluation);
      if (data.certificate) {
        setEarnedCertificate(data.certificate);
      }

      setSubmissionHistory((prev) => [
        {
          id: data.submissionId,
          score: data.scorePct,
          passed: data.passed ? 1 : 0,
          attempt_number: data.attemptNumber,
          submitted_at: new Date().toISOString(),
        },
        ...prev,
      ]);

      if (onQuizCompleted) {
        onQuizCompleted(data.evaluation, data.certificate);
      }
    } catch (err: any) {
      console.error("Quiz submission error:", err);
      setErrorMessage(err.message || "An error occurred while submitting your assessment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetake = () => {
    setAnswers({});
    setEvaluation(null);
    setErrorMessage(null);
  };

  const isGraded = !!evaluation;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
              Interactive Assessment
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Pass Threshold: {quiz.passing_score_pct}%
            </span>
          </div>
          <h2 className="text-lg md:text-xl font-bold text-slate-900">{quiz.title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Demonstrate your mastery to earn course completion credit and official compliance certification.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-slate-500 font-medium">Progress</div>
            <div className="text-sm font-bold text-slate-900">
              {answeredCount} of {totalQuestions} Answered
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center font-bold text-blue-600 shrink-0">
            {Math.round((answeredCount / totalQuestions) * 100)}%
          </div>
        </div>
      </div>

      {/* 2. Graded Results Banner */}
      {isGraded && (
        <div
          className={`rounded-2xl p-6 border shadow-md text-white ${
            evaluation.passed
              ? "bg-gradient-to-r from-emerald-800 to-teal-900 border-emerald-500"
              : "bg-gradient-to-r from-rose-900 to-red-950 border-rose-500"
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-bold backdrop-blur">
                {evaluation.passed ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>ASSESSMENT PASSED</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-rose-300" />
                    <span>NEEDS IMPROVEMENT</span>
                  </>
                )}
              </div>
              <h3 className="text-2xl font-black">
                You Scored {evaluation.scorePct}% ({evaluation.correctCount}/{evaluation.totalCount} Correct)
              </h3>
              <p className="text-xs md:text-sm text-white/80 max-w-xl">
                {evaluation.passed
                  ? "Outstanding achievement! You have satisfied the required passing threshold and mastered the safety guidelines."
                  : `You did not meet the required ${quiz.passing_score_pct}% passing threshold. Review the explanations below and retake the quiz.`}
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5 shrink-0">
              {evaluation.passed ? (
                earnedCertificate ? (
                  <Link
                    href={`/certificates/${earnedCertificate.id}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-emerald-950 hover:bg-emerald-50 text-xs font-bold shadow-md transition-all"
                  >
                    <Award className="w-4 h-4 text-emerald-700" />
                    View Certificate
                  </Link>
                ) : (
                  <Link
                    href={`/courses/${courseId}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-emerald-950 hover:bg-emerald-50 text-xs font-bold shadow-md transition-all"
                  >
                    Return to Syllabus <ArrowRight className="w-4 h-4" />
                  </Link>
                )
              ) : (
                <button
                  onClick={handleRetake}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-rose-950 hover:bg-rose-50 text-xs font-bold shadow-md transition-all"
                >
                  <RotateCcw className="w-4 h-4 text-rose-700" />
                  Retake Quiz
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 4. Question Cards */}
      <div className="space-y-4">
        {quiz.questions.map((question, idx) => {
          const qFeedback = evaluation?.results.find((r) => r.questionId === question.id);
          return (
            <QuestionCard
              key={question.id}
              question={question}
              index={idx}
              totalQuestions={totalQuestions}
              selectedAnswer={answers[question.id]}
              onSelectAnswer={handleSelectAnswer}
              feedback={qFeedback}
              disabled={isGraded || isSubmitting}
            />
          );
        })}
      </div>

      {/* 5. Bottom Action Bar */}
      {!isGraded && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {allAnswered ? (
              <span className="text-emerald-600 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> All questions completed and ready for server grading.
              </span>
            ) : (
              <span>
                Please answer all {totalQuestions} questions ({totalQuestions - answeredCount} remaining).
              </span>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!allAnswered || isSubmitting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-all"
          >
            <Send className="w-4 h-4" />
            {isSubmitting ? "Grading..." : "Submit Assessment"}
          </button>
        </div>
      )}

      {/* 6. Attempt History Drawer */}
      {submissionHistory.length > 0 && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3 text-slate-700">
            <History className="w-4 h-4 text-slate-500" />
            <h4 className="text-xs font-bold uppercase tracking-wider">
              Attempt History ({submissionHistory.length})
            </h4>
          </div>

          <div className="space-y-2">
            {submissionHistory.map((sub, idx) => (
              <div
                key={sub.id || idx}
                className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-700">
                    Attempt #{sub.attempt_number || submissionHistory.length - idx}
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {new Date(sub.submitted_at).toLocaleDateString()} at{" "}
                    {new Date(sub.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{sub.score}%</span>
                  {sub.passed === 1 ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                      PASSED
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                      FAILED
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
