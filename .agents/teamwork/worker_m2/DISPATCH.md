# Dispatch to worker_m2: Milestone M2 (Learner Experience & Course Modules)

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Context & Inputs
- Original Request: `/Users/janstevedaniel/Downloads/LMS FOR GAURAV/.agents/teamwork/ORIGINAL_REQUEST.md`
- Project Scope: `/Users/janstevedaniel/Downloads/LMS FOR GAURAV/PROJECT.md`
- Test Ready Report: `/Users/janstevedaniel/Downloads/LMS FOR GAURAV/TEST_READY.md`
- Prior Milestone Review Recommendations:
  - Add `prevent_audit_replace` trigger on `audit_logs` to prevent `INSERT OR REPLACE` conflict bypass.
  - Ensure quiz grading server-side evaluation is strictly enforced against DB questions.

## Scope of Work (Milestone M2)
Implement the full Learner Experience and Course Modules:
1. **Clutter-Free Employee Dashboard (`src/app/(dashboard)/page.tsx` or `src/app/page.tsx`)**:
   - Active courses with deadlines, progress bars, quick resume action.
   - Welcome onboarding roadmap for new hires.
   - Personal streak & learning analytics card (completed courses, hours, average score).
2. **Course Catalog & Track Explorer (`src/app/courses/page.tsx`)**:
   - Search & category filter (Compliance, Security, Technical, Onboarding).
   - Course cards displaying estimated duration, mandatory badges, enrollment button.
3. **Bite-Sized Modular Lesson Player (`src/app/courses/[courseId]/modules/[moduleId]/page.tsx`)**:
   - Course overview page (`src/app/courses/[courseId]/page.tsx`).
   - Distraction-free lesson player with collapsible chapter drawer, breadcrumbs, previous/next buttons.
   - Rich Markdown Content Engine (`src/components/learner/markdown-renderer.tsx`) with tables, checklists, code blocks, alert callouts.
   - Responsive Video Embed Module (`src/components/learner/video-player.tsx`) with progress tracking and completion callback.
4. **Interactive Quiz Engine & Grading (`src/components/quiz/quiz-runner.tsx`, `src/lib/quiz/index.ts`, `src/app/api/quizzes/[quizId]/submit/route.ts`)**:
   - Single-choice and multiple-choice questions with instant scoring.
   - Immediate feedback with correct answer explanations.
   - Pass threshold validation (>=80%); failed quiz retake logic preserving full attempt history.
   - Auto-logging quiz submission to `quiz_submissions` and `audit_logs`.
5. **Automated Certificate Generation & Verification (`src/components/learner/certificate-view.tsx`, `src/app/certificates/`, `src/app/certificates/[certId]/page.tsx`)**:
   - Triggered on 100% course completion and quiz pass.
   - Printable certificate with unique UUID, serial number, learner name, course title, issue date, and verification QR/link.
   - Public/internal certificate verification route (`/certificates/[certId]` and `/api/certificates/[certId]`).
6. **API Endpoints**:
   - `GET /api/courses` & `GET /api/courses/[courseId]`
   - `GET /api/modules/[moduleId]` & `POST /api/modules/[moduleId]/complete`
   - `POST /api/quizzes/[quizId]/submit`
   - `GET /api/certificates/[certId]`
7. **Verification**:
   - Run `npm test` and verify that all 163+ tests pass.
   - Run `npm run build` and ensure production build succeeds with 0 errors.

## Output
Write report to `/Users/janstevedaniel/Downloads/LMS FOR GAURAV/.agents/teamwork/worker_m2/handoff.md`.
Communicate back to orchestrator (`63cc1ecb-221c-430c-8bd9-507d14db22d3`) via send_message when complete.

## 2026-10-25T12:47:15Z
[Message] timestamp=2026-10-25T12:47:15Z sender=63cc1ecb-221c-430c-8bd9-507d14db22d3 priority=MESSAGE_PRIORITY_HIGH content=You are worker_m2. Your working directory is /Users/janstevedaniel/Downloads/LMS FOR GAURAV/.agents/teamwork/worker_m2.
Read /Users/janstevedaniel/Downloads/LMS FOR GAURAV/.agents/teamwork/worker_m2/DISPATCH.md, /Users/janstevedaniel/Downloads/LMS FOR GAURAV/.agents/teamwork/ORIGINAL_REQUEST.md, and /Users/janstevedaniel/Downloads/LMS FOR GAURAV/PROJECT.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implement Milestone M2 (Learner Experience & Course Modules):
- Clutter-free employee dashboard with onboarding roadmap, streaks, and analytics
- Course catalog & search filters (/courses)
- Course overview & bite-sized modular lesson player with collapsible chapters drawer, rich markdown renderer (tables, callouts, checklists), and responsive video player (/courses/[courseId]/modules/[moduleId])
- Interactive knowledge check and quiz engine with instant scoring, explanations, attempt history, and pass threshold validation (/api/quizzes/[quizId]/submit)
- Automated certificate generation with unique serial IDs and verification view (/certificates/[certId])
- Add prevent_audit_replace trigger on audit_logs for Layer-1 trigger hardening
- Verify npm test passes all tests and npm run build succeeds with zero errors.
Write handoff.md in your working directory and notify orchestrator (63cc1ecb-221c-430c-8bd9-507d14db22d3) via send_message when complete.
