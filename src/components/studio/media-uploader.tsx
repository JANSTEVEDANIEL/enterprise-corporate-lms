"use client";

import React, { useState } from "react";
import {
  Upload,
  Video,
  FileText,
  Archive,
  FileCode,
  Trash2,
  Plus,
  CheckCircle2,
  Play,
  HelpCircle,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import type { FileAttachment, QuizQuestion, WeekQuiz } from "@/types/marketplace";

// ============================================================================
// 1. LESSON VIDEO CONFIGURATOR & UPLOADER
// ============================================================================
interface VideoUploaderProps {
  videoUrl: string | null;
  durationSeconds: number;
  isPreview: boolean;
  onUpdate: (data: {
    video_url: string | null;
    duration_seconds: number;
    is_preview: boolean;
  }) => void;
}

export function LessonVideoUploader({
  videoUrl,
  durationSeconds,
  isPreview,
  onUpdate,
}: VideoUploaderProps) {
  const [urlInput, setUrlInput] = useState(videoUrl || "");
  const [durationInput, setDurationInput] = useState(
    Math.round(durationSeconds / 60) || 15
  );
  const [previewToggle, setPreviewToggle] = useState(isPreview);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "VIDEO");

      const res = await fetch("/api/studio/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Video upload failed");
      }

      setUrlInput(data.url);
      setUploadSuccess(true);
      onUpdate({
        video_url: data.url,
        duration_seconds: durationInput * 60,
        is_preview: previewToggle,
      });
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload video");
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlSave = () => {
    onUpdate({
      video_url: urlInput.trim() || null,
      duration_seconds: Math.max(0, durationInput * 60),
      is_preview: previewToggle,
    });
    setUploadSuccess(true);
    setTimeout(() => setUploadSuccess(false), 2500);
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-700/60 bg-slate-900/60 p-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Video className="h-4 w-4 text-emerald-400" />
          Lesson Video Stream & Duration
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={previewToggle}
            onChange={(e) => {
              setPreviewToggle(e.target.checked);
              onUpdate({
                video_url: urlInput.trim() || null,
                duration_seconds: durationInput * 60,
                is_preview: e.target.checked,
              });
            }}
            className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/20"
          />
          Free Preview Lesson (Unauthenticated Access)
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2 space-y-1">
          <span className="text-xs text-slate-400">Direct Video URL (MP4 / HLS / Cloud Storage)</span>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://storage.edtech.market/videos/lesson.mp4"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleUrlSave}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-xs text-slate-400">Duration (Minutes)</span>
          <input
            type="number"
            min="1"
            max="300"
            value={durationInput}
            onChange={(e) => {
              const val = Math.max(1, parseInt(e.target.value) || 1);
              setDurationInput(val);
              onUpdate({
                video_url: urlInput.trim() || null,
                duration_seconds: val * 60,
                is_preview: previewToggle,
              });
            }}
            className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Upload Video Button */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-600 bg-slate-800/40 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-emerald-500 hover:text-emerald-400 transition-all">
          <Upload className="h-3.5 w-3.5" />
          <span>{isUploading ? "Uploading to Storage..." : "Upload Video File to Storage Bucket"}</span>
          <input
            type="file"
            accept="video/*"
            disabled={isUploading}
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {uploadSuccess && (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Video saved!
          </span>
        )}
        {uploadError && (
          <span className="flex items-center gap-1 text-xs text-rose-400">
            <AlertCircle className="h-3.5 w-3.5" />
            {uploadError}
          </span>
        )}
      </div>

      {/* Video Preview Player */}
      {urlInput && (
        <div className="mt-2 overflow-hidden rounded-lg border border-slate-800 bg-black/50">
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1.5 text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <Play className="h-3 w-3 text-emerald-400" />
              Video Stream Preview
            </span>
            <a
              href={urlInput}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-emerald-400 text-[11px]"
            >
              Open raw link <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
          <video
            src={urlInput}
            controls
            className="max-h-48 w-full object-contain"
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 2. SUPPLEMENTARY DOWNLOADABLE RESOURCES UPLOADER (PDF / ZIP)
// ============================================================================
interface ResourceUploaderProps {
  files: FileAttachment[];
  onUpdate: (files: FileAttachment[]) => void;
}

export function ResourceAttachmentUploader({
  files = [],
  onUpdate,
}: ResourceUploaderProps) {
  const [nameInput, setNameInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [typeInput, setTypeInput] = useState<"PDF" | "ZIP" | "DOCUMENT">("PDF");
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/studio/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "File upload failed");
      }

      const newAttachment: FileAttachment = {
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: data.name || file.name,
        file_url: data.url,
        url: data.url,
        file_size_bytes: data.size_bytes || file.size,
        size_bytes: data.size_bytes || file.size,
        file_type: data.file_type || "DOCUMENT",
      };

      onUpdate([...files, newAttachment]);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to upload resource");
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddManualResource = () => {
    if (!urlInput.trim()) {
      setErrorMsg("Please provide a resource URL");
      return;
    }

    const fallbackName =
      nameInput.trim() ||
      urlInput.split("/").pop()?.split("?")[0] ||
      `Resource.${typeInput.toLowerCase()}`;

    const newAttachment: FileAttachment = {
      id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: fallbackName,
      file_url: urlInput.trim(),
      url: urlInput.trim(),
      file_size_bytes: 1048576,
      size_bytes: 1048576,
      file_type: typeInput,
    };

    onUpdate([...files, newAttachment]);
    setNameInput("");
    setUrlInput("");
    setErrorMsg(null);
  };

  const handleRemove = (id: string) => {
    onUpdate(files.filter((f) => f.id !== id));
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return "1.0 MB";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string, name: string) => {
    const lower = (type + name).toLowerCase();
    if (lower.includes("pdf")) return <FileText className="h-4 w-4 text-red-400" />;
    if (lower.includes("zip") || lower.includes("tar")) return <Archive className="h-4 w-4 text-amber-400" />;
    return <FileCode className="h-4 w-4 text-blue-400" />;
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-700/60 bg-slate-900/60 p-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <FileText className="h-4 w-4 text-sky-400" />
          Supplementary Downloadable Files (PDF / ZIP)
        </label>
        <span className="text-xs text-slate-400">
          {files.length} {files.length === 1 ? "file" : "files"} attached
        </span>
      </div>

      {/* Existing Attached Files */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between rounded-lg border border-slate-700/80 bg-slate-800/80 px-3 py-2 text-sm text-slate-200"
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                {getFileIcon(file.file_type || "", file.name)}
                <div className="truncate">
                  <p className="truncate font-medium text-slate-100">{file.name}</p>
                  <p className="text-xs text-slate-400">
                    {formatBytes(file.file_size_bytes || file.size_bytes || 0)} • {file.file_type}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={file.file_url || file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded p-1 text-slate-400 hover:text-emerald-400 transition-colors"
                  title="Preview Link"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={() => handleRemove(file.id)}
                  className="rounded p-1 text-slate-400 hover:text-rose-400 transition-colors"
                  title="Remove Attachment"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add New Attachment Form */}
      <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-12">
        <input
          type="text"
          placeholder="Resource label (e.g. Architecture_Diagram.pdf)"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          className="sm:col-span-5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
        />
        <input
          type="url"
          placeholder="File URL (https://storage...)"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          className="sm:col-span-4 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
        />
        <select
          value={typeInput}
          onChange={(e) => setTypeInput(e.target.value as any)}
          className="sm:col-span-2 rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-1.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
        >
          <option value="PDF">PDF</option>
          <option value="ZIP">ZIP</option>
          <option value="DOCUMENT">DOC</option>
        </select>
        <button
          type="button"
          onClick={handleAddManualResource}
          className="sm:col-span-1 flex items-center justify-center rounded-lg bg-sky-600 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 transition-colors"
          title="Add Resource URL"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* File Upload Trigger */}
      <div className="flex items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-600 bg-slate-800/40 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-sky-500 hover:text-sky-400 transition-all">
          <Upload className="h-3.5 w-3.5" />
          <span>{isUploading ? "Uploading resource..." : "Upload File (PDF / ZIP)"}</span>
          <input
            type="file"
            accept=".pdf,.zip,.tar,.gz,.doc,.docx"
            disabled={isUploading}
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
        {errorMsg && (
          <span className="flex items-center gap-1 text-xs text-rose-400">
            <AlertCircle className="h-3.5 w-3.5" />
            {errorMsg}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 3. WEEKLY KNOWLEDGE CHECK / QUIZ BUILDER
// ============================================================================
interface WeeklyQuizBuilderProps {
  courseId: string;
  weekId: string;
  weekNumber: number;
  initialQuiz?: WeekQuiz | null;
  onSaveSuccess?: (quiz: WeekQuiz) => void;
}

export function WeeklyQuizBuilder({
  courseId,
  weekId,
  weekNumber,
  initialQuiz,
  onSaveSuccess,
}: WeeklyQuizBuilderProps) {
  const [title, setTitle] = useState(
    initialQuiz?.title || `Week ${weekNumber} Knowledge Check`
  );
  const [passingScore, setPassingScore] = useState(
    initialQuiz?.passing_score_pct || 80
  );
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    initialQuiz?.questions || [
      {
        id: `q_${Date.now()}_1`,
        prompt: "What is the primary architectural concept covered in this weekly milestone?",
        options: ["Core system modularity and isolation", "Manual single-server operations", "Unencrypted plaintext communications", "Hardcoded database credentials"],
        correct_index: 0,
        explanation: "System modularity ensures resilient fault isolation and scalable horizontal growth.",
      },
    ]
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: `q_${Date.now()}_${questions.length + 1}`,
        prompt: "",
        options: ["Option A", "Option B", "Option C", "Option D"],
        correct_index: 0,
        explanation: "",
      },
    ]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestionPrompt = (index: number, text: string) => {
    const updated = [...questions];
    updated[index].prompt = text;
    setQuestions(updated);
  };

  const updateQuestionOption = (qIndex: number, optIndex: number, text: string) => {
    const updated = [...questions];
    const newOptions = [...updated[qIndex].options];
    newOptions[optIndex] = text;
    updated[qIndex].options = newOptions;
    setQuestions(updated);
  };

  const updateCorrectAnswer = (qIndex: number, optIndex: number) => {
    const updated = [...questions];
    updated[qIndex].correct_index = optIndex;
    setQuestions(updated);
  };

  const updateExplanation = (qIndex: number, text: string) => {
    const updated = [...questions];
    updated[qIndex].explanation = text;
    setQuestions(updated);
  };

  const handleSaveQuiz = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/studio/courses/${courseId}/weeks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SET_QUIZ",
          week_id: weekId,
          title: title.trim(),
          passing_score_pct: Number(passingScore),
          questions,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save quiz");
      }

      setSaveSuccess(true);
      if (onSaveSuccess && data.quiz) {
        onSaveSuccess(data.quiz);
      }
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save quiz");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-indigo-500/30 bg-slate-900/80 p-5 shadow-lg backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-indigo-400" />
          <h4 className="text-base font-bold text-slate-100">
            Week {weekNumber} Knowledge Check / Quiz Builder
          </h4>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Passing Score:</span>
            <input
              type="number"
              min="50"
              max="100"
              value={passingScore}
              onChange={(e) => setPassingScore(Math.max(50, Math.min(100, parseInt(e.target.value) || 80)))}
              className="w-16 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-center text-xs font-bold text-indigo-300"
            />
            <span className="text-xs text-slate-400">%</span>
          </div>
          <button
            type="button"
            onClick={handleSaveQuiz}
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {isSaving ? "Saving..." : "Save Quiz"}
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-950/60 border border-emerald-500/40 px-3 py-2 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          Quiz configuration saved successfully for Week {weekNumber}!
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-950/60 border border-rose-500/40 px-3 py-2 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4" />
          {errorMsg}
        </div>
      )}

      {/* Quiz Title */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-300">Knowledge Check Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`Week ${weekNumber} Knowledge Check`}
          className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {/* Questions List */}
      <div className="space-y-4 pt-2">
        {questions.map((q, qIndex) => (
          <div
            key={q.id || qIndex}
            className="space-y-3 rounded-lg border border-slate-800 bg-slate-800/50 p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                Question {qIndex + 1}
              </span>
              {questions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeQuestion(qIndex)}
                  className="rounded p-1 text-slate-400 hover:text-rose-400 transition-colors"
                  title="Remove Question"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <input
              type="text"
              placeholder="Enter question prompt..."
              value={q.prompt}
              onChange={(e) => updateQuestionPrompt(qIndex, e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />

            {/* Multiple Choice Options */}
            <div className="space-y-2 pt-1">
              <span className="text-xs font-medium text-slate-400">Options (Select radio for correct answer)</span>
              {q.options.map((opt, optIndex) => (
                <div key={optIndex} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct_${q.id || qIndex}`}
                    checked={q.correct_index === optIndex}
                    onChange={() => updateCorrectAnswer(qIndex, optIndex)}
                    className="h-4 w-4 text-indigo-500 focus:ring-indigo-500/20 bg-slate-800 border-slate-700"
                  />
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => updateQuestionOption(qIndex, optIndex, e.target.value)}
                    placeholder={`Option ${String.fromCharCode(65 + optIndex)}`}
                    className={`w-full rounded-lg border px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none ${
                      q.correct_index === optIndex
                        ? "border-emerald-500/70 bg-emerald-950/20 text-emerald-200"
                        : "border-slate-700 bg-slate-900/80 focus:border-indigo-500"
                    }`}
                  />
                </div>
              ))}
            </div>

            {/* Explanation */}
            <div className="pt-1">
              <input
                type="text"
                placeholder="Explanation (shown upon review, optional)"
                value={q.explanation || ""}
                onChange={(e) => updateExplanation(qIndex, e.target.value)}
                className="w-full rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addQuestion}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-indigo-500/40 bg-indigo-950/20 py-2.5 text-xs font-semibold text-indigo-300 hover:border-indigo-500 hover:bg-indigo-950/40 transition-all"
      >
        <Plus className="h-4 w-4" />
        Add Next Question
      </button>
    </div>
  );
}
