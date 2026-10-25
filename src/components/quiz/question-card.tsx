"use client";
import React from "react";
import { CheckCircle2, XCircle, HelpCircle, Check, AlertCircle } from "lucide-react";
import type { SanitizedQuestion, QuestionFeedback } from "@/lib/quiz";

interface QuestionCardProps {
  question: SanitizedQuestion;
  index: number;
  totalQuestions: number;
  selectedAnswer: string | string[];
  onSelectAnswer: (questionId: string, answer: string | string[]) => void;
  feedback?: QuestionFeedback | null;
  disabled?: boolean;
}

export function QuestionCard({
  question,
  index,
  totalQuestions,
  selectedAnswer,
  onSelectAnswer,
  feedback,
  disabled = false,
}: QuestionCardProps) {
  const isMultiple = question.question_type === "MULTIPLE_CHOICE";
  const selectedList = Array.isArray(selectedAnswer)
    ? selectedAnswer
    : selectedAnswer
    ? [selectedAnswer]
    : [];

  const handleOptionClick = (optionId: string) => {
    if (disabled) return;

    if (isMultiple) {
      if (selectedList.includes(optionId)) {
        onSelectAnswer(
          question.id,
          selectedList.filter((id) => id !== optionId)
        );
      } else {
        onSelectAnswer(question.id, [...selectedList, optionId]);
      }
    } else {
      onSelectAnswer(question.id, optionId);
    }
  };

  const isGraded = !!feedback;
  const isCorrect = feedback?.isCorrect;

  return (
    <div
      className={`rounded-xl border p-5 transition-all ${
        isGraded
          ? isCorrect
            ? "bg-emerald-50/40 border-emerald-200"
            : "bg-rose-50/40 border-rose-200"
          : "bg-white border-slate-200 shadow-sm"
      }`}
    >
      {/* Top Question Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-xs">
            Question {index + 1} of {totalQuestions}
          </span>
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            {question.question_type.replace("_", " ")}
          </span>
        </div>

        {isGraded && (
          <div className="flex items-center gap-1.5 shrink-0">
            {isCorrect ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Correct
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-xs font-bold">
                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                Incorrect
              </span>
            )}
          </div>
        )}
      </div>

      {/* Prompt */}
      <h3 className="text-sm md:text-base font-bold text-slate-900 leading-snug mb-4">
        {question.prompt}
      </h3>

      {isMultiple && !isGraded && (
        <p className="text-xs text-blue-600 font-medium mb-3">
          Select all options that apply.
        </p>
      )}

      {/* Options List */}
      <div className="space-y-2.5">
        {question.options.map((option) => {
          const isSelected = selectedList.includes(option.id);
          const isAnswerKeyCorrect = feedback?.correctAnswer?.includes(option.id);

          let optionStyle = "border-slate-200 hover:border-blue-400 bg-white hover:bg-slate-50";

          if (isGraded) {
            if (isAnswerKeyCorrect) {
              optionStyle = "border-emerald-500 bg-emerald-50/80 text-emerald-950 font-medium";
            } else if (isSelected && !isAnswerKeyCorrect) {
              optionStyle = "border-rose-400 bg-rose-50/80 text-rose-950";
            } else {
              optionStyle = "border-slate-200 opacity-60 bg-white";
            }
          } else if (isSelected) {
            optionStyle = "border-blue-600 bg-blue-50/60 text-blue-950 font-medium shadow-xs";
          }

          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => handleOptionClick(option.id)}
              className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left text-xs md:text-sm transition-all cursor-pointer ${optionStyle}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-all ${
                    isMultiple ? "rounded-md" : "rounded-full"
                  } ${
                    isSelected
                      ? isGraded
                        ? isAnswerKeyCorrect
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "bg-rose-600 border-rose-600 text-white"
                        : "bg-blue-600 border-blue-600 text-white"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
                <span className="leading-relaxed">{option.text}</span>
              </div>

              {isGraded && isAnswerKeyCorrect && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 ml-2 shrink-0">
                  Correct Answer
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Feedback & Explanation */}
      {isGraded && feedback.explanation && (
        <div className="mt-4 p-3.5 rounded-xl bg-slate-900 text-white text-xs leading-relaxed space-y-1">
          <div className="font-bold text-amber-300 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5" />
            Pedagogical Explanation:
          </div>
          <p className="text-slate-200">{feedback.explanation}</p>
        </div>
      )}
    </div>
  );
}
