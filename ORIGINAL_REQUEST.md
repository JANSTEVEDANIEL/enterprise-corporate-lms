# Original User Request

## Initial Request — 2026-10-25T11:42:52Z

Build a modern, production-grade Enterprise Corporate Learning Management System (LMS) specifically engineered for corporate employee onboarding, role-based upskilling, and mandatory compliance tracking with an intuitive, clutter-free UI/UX distinct from legacy academic portals.

Working directory: /Users/janstevedaniel/Downloads/LMS FOR GAURAV
Integrity mode: development

## Requirements

### R1. Learner Experience & Course Modules
A streamlined employee portal with single-click onboarding, bite-sized interactive training modules (rich markdown, video embeds, quizzes), personal progress analytics, and automated completion certificates.

### R2. Management, Compliance & Audit Trail
An administrative and managerial control center with granular Role-Based Access Control (RBAC: Employee, Manager, Compliance Officer, Super Admin), automated compliance renewal tracking, tamper-evident audit logs for legal/regulatory proof, and team progress reporting.

### R3. Modern Production Full-Stack Architecture
Implemented using Next.js (App Router, React 19) with TypeScript, Tailwind CSS for sleek responsive UI, structured relational database schema (SQLite/PostgreSQL with migrations), robust API validation, and production-ready server scripts.

### R4. Automated Office Employee Persona Simulation & Testing
A synthetic test suite simulating realistic office personas (New Hire navigating Day-1 orientation, Senior Engineer completing technical safety modules, Manager reviewing department compliance rates) alongside automated end-to-end programmatic tests validating data persistence, auth barriers, and completion states.

## Acceptance Criteria

### Core Functionality & UX
- [ ] Employee dashboard renders personalized active courses, deadlines, and progress with zero clutter.
- [ ] Course viewer supports interactive lessons, modular navigation, knowledge checks/quizzes, and instant feedback.
- [ ] Role-Based Access Control cleanly separates Learner views from Admin/Manager dashboards.

### Compliance & Verification
- [ ] Immutable completion audit logs record timestamp, user ID, module version, and score.
- [ ] Compliance manager dashboard displays team-wide completion rates with CSV/JSON audit export.

### Architecture & Quality
- [ ] Production build (`npm run build`) compiles with zero TypeScript errors or broken routes.
- [ ] Database schema includes relations for Users, Roles, Courses, Modules, Enrollments, QuizSubmissions, and AuditLogs.

### Multi-Agent Office Employee Verification
- [ ] Automated persona runner executes simulations for at least 3 distinct roles (New Hire, Engineer, Compliance Manager) and verifies state transitions.
- [ ] Test suite executes successfully (`npm test`) validating API endpoints, auth permissions, and quiz grading logic.
