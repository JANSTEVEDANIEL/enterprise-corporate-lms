import { getDb, initDb } from "./index";
import { CORPORATE_PERSONAS } from "../auth";
import { recordAuditEvent } from "../audit";
import { ALL_MARKETPLACE_COURSES } from "./seed-curricula";

export function seedDb(): void {
  initDb();
  const db = getDb();

  // 1. Seed Users
  const insertUserStmt = db.prepare(`
    INSERT OR REPLACE INTO users (
      id, email, name, avatar_url, role, department, job_title, manager_id, is_active, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?
    )
  `);

  const now = new Date().toISOString();

  for (const persona of Object.values(CORPORATE_PERSONAS)) {
    insertUserStmt.run(
      persona.id,
      persona.email,
      persona.name,
      persona.avatarUrl || null,
      persona.role,
      persona.department,
      persona.jobTitle,
      persona.managerId || null,
      now,
      now
    );
  }

  // Ensure manager relationships are linked once all users exist
  const updateManagerStmt = db.prepare("UPDATE users SET manager_id = ? WHERE id = ?");
  for (const persona of Object.values(CORPORATE_PERSONAS)) {
    if (persona.managerId) {
      updateManagerStmt.run(persona.managerId, persona.id);
    }
  }

  // 2. Seed Courses
  const insertCourseStmt = db.prepare(`
    INSERT OR REPLACE INTO courses (
      id, slug, title, description, category, target_role, is_mandatory,
      estimated_minutes, renewal_period_days, passing_score_pct, version,
      is_published, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?
    )
  `);

  const courses = [
    {
      id: "crs_onboarding_day1",
      slug: "day-1-enterprise-orientation",
      title: "Day-1 Enterprise Orientation & Engineering Setup",
      description: "Mandatory onboarding track for all new corporate hires covering workplace policies, IT credentials, security guidelines, and development toolchain setup.",
      category: "ONBOARDING",
      target_role: "NEW_HIRE",
      is_mandatory: 1,
      estimated_minutes: 45,
      renewal_period_days: null,
      passing_score_pct: 80,
      version: "1.0.0",
      is_published: 1,
    },
    {
      id: "crs_sec_soc2_2026",
      slug: "soc2-information-security-data-privacy-2026",
      title: "SOC 2 Information Security & Data Privacy 2026",
      description: "Annual mandatory compliance training required for SOC 2 Type II audit readiness. Covers customer PII handling, phishing defenses, incident reporting, and cryptographic standards.",
      category: "COMPLIANCE",
      target_role: "ALL",
      is_mandatory: 1,
      estimated_minutes: 60,
      renewal_period_days: 365,
      passing_score_pct: 80,
      version: "2026.1.0",
      is_published: 1,
    },
    {
      id: "crs_tech_prod_safety",
      slug: "production-infrastructure-safety-standards",
      title: "Production Infrastructure Safety & Operational Resilience",
      description: "Advanced technical compliance course for engineering staff covering zero-downtime deployments, canary release gates, incident response runbooks, and blast-radius minimization.",
      category: "TECHNICAL_UPSKILLING",
      target_role: "ENGINEERING",
      is_mandatory: 1,
      estimated_minutes: 50,
      renewal_period_days: 365,
      passing_score_pct: 85,
      version: "2.1.0",
      is_published: 1,
    },
    {
      id: "crs_comp_osha",
      slug: "osha-workplace-safety-hazcom-standards",
      title: "OSHA Workplace Safety & Hazard Communication",
      description: "Mandatory occupational health and safety standards covering chemical labeling (GHS), personal protective equipment (PPE), emergency evacuation, and incident reporting.",
      category: "COMPLIANCE",
      target_role: "ALL",
      is_mandatory: 1,
      estimated_minutes: 40,
      renewal_period_days: 365,
      passing_score_pct: 80,
      version: "2026.1.0",
      is_published: 1,
    },
    {
      id: "crs_comp_hipaa",
      slug: "hipaa-security-patient-privacy-2026",
      title: "HIPAA Security & Health Information Privacy 2026",
      description: "Regulatory compliance training covering protected health information (PHI) confidentiality, electronic transmissions, breach notification rules, and HIPAA Security Rule controls.",
      category: "COMPLIANCE",
      target_role: "ALL",
      is_mandatory: 1,
      estimated_minutes: 45,
      renewal_period_days: 365,
      passing_score_pct: 80,
      version: "2026.1.0",
      is_published: 1,
    },
    {
      id: "crs_comp_harassment",
      slug: "anti-harassment-workplace-conduct-eeo",
      title: "Anti-Harassment & Workplace Conduct Policy",
      description: "Mandatory corporate policy training on preventing unlawful harassment, discrimination, bystander intervention techniques, and safe retaliation-free reporting channels.",
      category: "COMPLIANCE",
      target_role: "ALL",
      is_mandatory: 1,
      estimated_minutes: 35,
      renewal_period_days: 365,
      passing_score_pct: 80,
      version: "2026.1.0",
      is_published: 1,
    },
  ];

  for (const c of courses) {
    insertCourseStmt.run(
      c.id,
      c.slug,
      c.title,
      c.description,
      c.category,
      c.target_role,
      c.is_mandatory,
      c.estimated_minutes,
      c.renewal_period_days,
      c.passing_score_pct,
      c.version,
      c.is_published,
      now,
      now
    );
  }

  // 3. Seed Modules
  const insertModuleStmt = db.prepare(`
    INSERT OR REPLACE INTO modules (
      id, course_id, title, description, order_index, type, content,
      estimated_minutes, version, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `);

  const modules = [
    // Course 1: Onboarding
    {
      id: "mod_onb_welcome",
      course_id: "crs_onboarding_day1",
      title: "Welcome to Enterprise Core & Cultural Values",
      description: "Introduction to enterprise mission, leadership principles, communication etiquette, and employee benefits.",
      order_index: 0,
      type: "RICH_MARKDOWN",
      content: `# Welcome to Enterprise Core!

Congratulations on joining our organization! As a member of our team, you are building systems that power mission-critical operations.

## Our Core Values
1. **Customer Obsession & Data Security**: Security is not an afterthought; it is our foundation.
2. **Speed & High Standards**: We move quickly with rigor and test-driven discipline.
3. **Radical Transparency**: We communicate early, document decisions, and learn from mistakes.

## Day-1 Checklist
- [ ] Configure corporate Google Workspace / Slack account with hardware 2FA.
- [ ] Review the IT Acceptable Use Policy.
- [ ] Set up your local developer workstation using standard tooling.
- [ ] Complete this orientation module and quiz to earn your Day-1 Certificate.

## Support Resources
If you require assistance, ping the **#it-helpdesk** or **#people-ops** Slack channels.`,
      estimated_minutes: 15,
      version: "1.0.0",
    },
    {
      id: "mod_onb_security_video",
      course_id: "crs_onboarding_day1",
      title: "Workplace Physical & Digital Security Overview",
      description: "Video walkthrough detailing building badge security, hardware key 2FA, and phishing awareness.",
      order_index: 1,
      type: "VIDEO_EMBED",
      content: JSON.stringify({
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        thumbnailUrl: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80",
        durationSeconds: 180,
        chapters: [
          { time: 0, title: "Physical Badge Security" },
          { time: 60, title: "Hardware FIDO2 Security Keys" },
          { time: 120, title: "Clean Desk & Screen Lock Standards" },
        ],
        summary: "This video outlines physical campus security, visitor policies, and mandatory FIDO2 hardware token authentication for all corporate devices.",
      }),
      estimated_minutes: 15,
      version: "1.0.0",
    },
    {
      id: "mod_onb_quiz",
      course_id: "crs_onboarding_day1",
      title: "Day-1 Orientation Knowledge Check",
      description: "Validate your comprehension of enterprise policies and security hygiene.",
      order_index: 2,
      type: "INTERACTIVE_QUIZ",
      content: "Complete all questions with at least 80% score to receive your completion certificate.",
      estimated_minutes: 15,
      version: "1.0.0",
    },

    // Course 2: SOC 2 Security
    {
      id: "mod_sec_phishing",
      course_id: "crs_sec_soc2_2026",
      title: "Phishing Detection & Social Engineering Defenses",
      description: "Learn how to spot spear-phishing, credential harvesting, and suspicious Slack/email communications.",
      order_index: 0,
      type: "RICH_MARKDOWN",
      content: `# Phishing & Social Engineering Defense 2026

Modern threats utilize highly targeted spear-phishing, spoofed CEO communications, and malicious pull requests.

## Key Defense Rules
- **Verify the Sender**: Inspect the full email envelope, not just the display name.
- **Never Approve Unexpected Push Prompts**: If your authenticator prompts for MFA approval when you didn't initiate a login, hit **Deny** and report immediately.
- **Reporting Mechanism**: Click the PhishNotify button in your mail client or forward to \`security-alerts@enterprise.corp\`.`,
      estimated_minutes: 20,
      version: "2026.1.0",
    },
    {
      id: "mod_sec_pii_handling",
      course_id: "crs_sec_soc2_2026",
      title: "Customer PII Handling & Data Classification",
      description: "Mandatory guidelines on encrypting, storing, and purging Personally Identifiable Information.",
      order_index: 1,
      type: "RICH_MARKDOWN",
      content: `# Data Classification & PII Protection

Under our SOC 2 Type II trust criteria and GDPR/CCPA compliance commitments, customer data must be treated with utmost confidentiality.

## Classification Tiers
1. **Public**: Marketing content, published blog posts.
2. **Internal**: Architecture diagrams, internal documentation.
3. **Confidential**: Financial reports, roadmaps.
4. **Restricted / PII**: Customer database backups, passwords, API tokens, personal identifying records.

## Production Data Rules
- Never copy production database snapshots to local laptops.
- Always use synthetic or scrubbed test data for QA environments.`,
      estimated_minutes: 20,
      version: "2026.1.0",
    },
    {
      id: "mod_sec_quiz",
      course_id: "crs_sec_soc2_2026",
      title: "Annual SOC 2 Security Competency Exam",
      description: "Comprehensive assessment covering corporate security policies and incident SLAs.",
      order_index: 2,
      type: "INTERACTIVE_QUIZ",
      content: "Passing threshold is 80%. Successful completion satisfies your annual compliance requirement.",
      estimated_minutes: 20,
      version: "2026.1.0",
    },

    // Course 3: Tech Safety
    {
      id: "mod_tech_canary",
      course_id: "crs_tech_prod_safety",
      title: "Canary Deployments & Automated Rollback Strategies",
      description: "Best practices for progressive delivery, observability metrics, and automated rollback triggers.",
      order_index: 0,
      type: "RICH_MARKDOWN",
      content: `# Canary Deployments & Resilience Engineering

Zero-downtime deployments require strict progressive rollout phases:
1. **Canary Phase (1-5% Traffic)**: Soak for 15 minutes while monitoring error budgets and p99 latency.
2. **Automated Rollback Criteria**:
   - HTTP 5xx error rate exceeds 0.05%
   - Latency degradation > 15%
3. **Full Fleet Rollout**: Only triggered after automated health checks pass.`,
      estimated_minutes: 25,
      version: "2.1.0",
    },
    {
      id: "mod_tech_safety_quiz",
      course_id: "crs_tech_prod_safety",
      title: "Production Resilience & Safety Exam",
      description: "Technical assessment for production access certification.",
      order_index: 1,
      type: "INTERACTIVE_QUIZ",
      content: "Score 85% or higher to unlock production deployment credentials.",
      estimated_minutes: 25,
      version: "2.1.0",
    },
    {
      id: "mod_osha_safety",
      course_id: "crs_comp_osha",
      title: "Workplace Hazard Communication & Emergency Standards",
      description: "Comprehensive guide to OSHA hazard symbols, SDS sheets, and emergency action plans.",
      order_index: 0,
      type: "RICH_MARKDOWN",
      content: `# OSHA Hazard Communication & Site Safety

This regulatory standard establishes requirements for identifying and communicating hazardous conditions in the workplace.

## Key Safety Tenets
1. **Hazard Communication (GHS)**: All chemicals must have standardized pictograms and Safety Data Sheets (SDS).
2. **Personal Protective Equipment (PPE)**: Inspect PPE before every shift.
3. **Emergency Egress**: Keep fire exit pathways unobstructed at all times.

## Incident Escalation
Report any safety near-miss or injury to the Site Operations lead immediately.`,
      estimated_minutes: 20,
      version: "1.0.0",
    },
    {
      id: "mod_hipaa_privacy",
      course_id: "crs_comp_hipaa",
      title: "HIPAA Privacy and Security Rule Compliance",
      description: "Safeguards for protecting Electronic Protected Health Information (ePHI).",
      order_index: 0,
      type: "RICH_MARKDOWN",
      content: `# HIPAA Security & Privacy Standards

Under 45 CFR Part 160 and Part 164, corporate systems processing health data must enforce administrative, physical, and technical safeguards.

## The Minimum Necessary Rule
Only access or disclose the minimum amount of PHI required to perform your authorized job function.

## Encryption & Access Control
- All stored ePHI must utilize AES-256 encryption.
- Multi-factor authentication is mandatory for any database access.`,
      estimated_minutes: 25,
      version: "1.0.0",
    },
    {
      id: "mod_harass_conduct",
      course_id: "crs_comp_harassment",
      title: "Workplace Respect, Bystander Intervention & EEO",
      description: "Maintaining a respectful, inclusive, and harassment-free enterprise work environment.",
      order_index: 0,
      type: "RICH_MARKDOWN",
      content: `# Workplace Respect & Equal Opportunity

Our enterprise strictly prohibits harassment, discrimination, and retaliation under Title VII and international labor laws.

## Core Commitments
1. **Professional Respect**: Treat all colleagues, partners, and customers with dignity.
2. **Active Bystander Intervention**: Speak up or report whenever you observe unacceptable conduct.
3. **No Retaliation**: Zero tolerance for retaliation against anyone reporting in good faith.`,
      estimated_minutes: 20,
      version: "1.0.0",
    },
  ];

  for (const m of modules) {
    insertModuleStmt.run(
      m.id,
      m.course_id,
      m.title,
      m.description,
      m.order_index,
      m.type,
      m.content,
      m.estimated_minutes,
      m.version,
      now,
      now
    );
  }

  // 4. Seed Quizzes & Questions
  const insertQuizStmt = db.prepare(`
    INSERT OR REPLACE INTO quizzes (
      id, module_id, title, passing_score_pct, time_limit_minutes, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?
    )
  `);

  const insertQuestionStmt = db.prepare(`
    INSERT OR REPLACE INTO quiz_questions (
      id, quiz_id, order_index, prompt, question_type, options, correct_answers, explanation, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  // Quiz 1: Onboarding Quiz
  insertQuizStmt.run("q_onb_1", "mod_onb_quiz", "Day-1 Orientation Knowledge Check", 80, 15, now, now);

  const onbQuestions = [
    {
      id: "qq_onb_1",
      quiz_id: "q_onb_1",
      order_index: 0,
      prompt: "What is the mandatory authentication requirement for corporate laptops and internal tools?",
      question_type: "SINGLE_CHOICE",
      options: JSON.stringify([
        { id: "opt_1", text: "SMS text message code" },
        { id: "opt_2", text: "Hardware FIDO2 Security Key with 2FA" },
        { id: "opt_3", text: "Simple 8-character password" },
        { id: "opt_4", text: "No authentication on VPN" },
      ]),
      correct_answers: JSON.stringify(["opt_2"]),
      explanation: "Hardware FIDO2 keys are phishing-resistant and mandatory across all enterprise systems.",
    },
    {
      id: "qq_onb_2",
      quiz_id: "q_onb_1",
      order_index: 1,
      prompt: "Which of the following actions comply with the enterprise Clean Desk and Device Security Policy? (Select all that apply)",
      question_type: "MULTIPLE_CHOICE",
      options: JSON.stringify([
        { id: "opt_1", text: "Lock your workstation screen whenever stepping away (Cmd+Ctrl+Q)" },
        { id: "opt_2", text: "Store written credentials on sticky notes under keyboard" },
        { id: "opt_3", text: "Report unbadged visitors in secure engineering zones" },
        { id: "opt_4", text: "Keep customer data on personal unencrypted USB drives" },
      ]),
      correct_answers: JSON.stringify(["opt_1", "opt_3"]),
      explanation: "Workstations must be locked immediately when unattended, and unbadged visitors must be reported to security.",
    },
    {
      id: "qq_onb_3",
      quiz_id: "q_onb_1",
      order_index: 2,
      prompt: "True or False: You may share your corporate VPN credentials with external contractors if they are working on your direct project.",
      question_type: "TRUE_FALSE",
      options: JSON.stringify([
        { id: "opt_t", text: "True" },
        { id: "opt_f", text: "False" },
      ]),
      correct_answers: JSON.stringify(["opt_f"]),
      explanation: "Credential sharing is strictly prohibited under SOC 2 criteria. Contractors must be formally provisioned their own accounts.",
    },
  ];

  for (const q of onbQuestions) {
    insertQuestionStmt.run(q.id, q.quiz_id, q.order_index, q.prompt, q.question_type, q.options, q.correct_answers, q.explanation, now);
  }

  // Quiz 2: SOC 2 Security Quiz
  insertQuizStmt.run("q_sec_1", "mod_sec_quiz", "Annual SOC 2 Security Competency Exam", 80, 20, now, now);

  const secQuestions = [
    {
      id: "qq_sec_1",
      quiz_id: "q_sec_1",
      order_index: 0,
      prompt: "You receive an urgent email purportedly from the CEO requesting gift cards or wire transfers for an urgent partner meeting. What should you do?",
      question_type: "SINGLE_CHOICE",
      options: JSON.stringify([
        { id: "opt_1", text: "Purchase the gift cards immediately to satisfy the executive request" },
        { id: "opt_2", text: "Forward to the PhishNotify button and verify through an out-of-band channel" },
        { id: "opt_3", text: "Reply asking for proof of identification" },
        { id: "opt_4", text: "Ignore it and delete without reporting" },
      ]),
      correct_answers: JSON.stringify(["opt_2"]),
      explanation: "Executive impersonation is a common social engineering tactic. Always flag to Security and verify out-of-band.",
    },
    {
      id: "qq_sec_2",
      quiz_id: "q_sec_1",
      order_index: 1,
      prompt: "Which data classification tier applies to customer email addresses, billing records, and authentication logs?",
      question_type: "SINGLE_CHOICE",
      options: JSON.stringify([
        { id: "opt_1", text: "Public" },
        { id: "opt_2", text: "Internal" },
        { id: "opt_3", text: "Restricted / PII" },
        { id: "opt_4", text: "Unclassified" },
      ]),
      correct_answers: JSON.stringify(["opt_3"]),
      explanation: "Customer identifiers and payment records are classified as Restricted / PII and require encryption at rest and in transit.",
    },
    {
      id: "qq_sec_3",
      quiz_id: "q_sec_1",
      order_index: 2,
      prompt: "What is the maximum SLA window to report a suspected customer data spill or leaked credential to the Security Incident Response team?",
      question_type: "SINGLE_CHOICE",
      options: JSON.stringify([
        { id: "opt_1", text: "Within 1 hour" },
        { id: "opt_2", text: "Within 24 hours" },
        { id: "opt_3", text: "At the end of the work week" },
        { id: "opt_4", text: "Next monthly retrospective" },
      ]),
      correct_answers: JSON.stringify(["opt_1"]),
      explanation: "Corporate policy mandates reporting potential security incidents within 1 hour to contain exposure.",
    },
  ];

  for (const q of secQuestions) {
    insertQuestionStmt.run(q.id, q.quiz_id, q.order_index, q.prompt, q.question_type, q.options, q.correct_answers, q.explanation, now);
  }

  // Quiz 3: Tech Safety Quiz
  insertQuizStmt.run("q_tech_1", "mod_tech_safety_quiz", "Production Resilience & Safety Exam", 85, 20, now, now);

  const techQuestions = [
    {
      id: "qq_tech_1",
      quiz_id: "q_tech_1",
      order_index: 0,
      prompt: "During a canary rollout, what automated action is triggered if the 5xx HTTP error rate spikes to 0.1%?",
      question_type: "SINGLE_CHOICE",
      options: JSON.stringify([
        { id: "opt_1", text: "Traffic is routed to 100% to test scale" },
        { id: "opt_2", text: "Automated instant rollback to previous stable release" },
        { id: "opt_3", text: "Server reboot of all nodes" },
        { id: "opt_4", text: "Suppress errors in logging pipeline" },
      ]),
      correct_answers: JSON.stringify(["opt_2"]),
      explanation: "Exceeding the 0.05% error budget threshold triggers immediate automated rollback to protect user uptime.",
    },
    {
      id: "qq_tech_2",
      quiz_id: "q_tech_1",
      order_index: 1,
      prompt: "True or False: Schema migrations that drop database columns can be run directly during peak production traffic without phased backward compatibility.",
      question_type: "TRUE_FALSE",
      options: JSON.stringify([
        { id: "opt_t", text: "True" },
        { id: "opt_f", text: "False" },
      ]),
      correct_answers: JSON.stringify(["opt_f"]),
      explanation: "Schema changes must use the expand-and-contract pattern to prevent crashing running application instances.",
    },
  ];

  for (const q of techQuestions) {
    insertQuestionStmt.run(q.id, q.quiz_id, q.order_index, q.prompt, q.question_type, q.options, q.correct_answers, q.explanation, now);
  }

  // 5. Seed Enrollments & Progress
  const insertEnrollmentStmt = db.prepare(`
    INSERT OR REPLACE INTO enrollments (
      id, user_id, course_id, status, progress_pct, assigned_by, assigned_at,
      due_date, completed_at, expires_at, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `);

  const insertModuleProgressStmt = db.prepare(`
    INSERT OR REPLACE INTO module_progress (
      id, enrollment_id, module_id, user_id, status, completed_at,
      time_spent_seconds, last_position_seconds, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `);

  const insertCertStmt = db.prepare(`
    INSERT OR REPLACE INTO certificates (
      id, certificate_code, user_id, course_id, enrollment_id,
      course_title, course_version, user_name, user_email, score,
      issued_at, expires_at, verification_hash, created_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `);

  // Alex Rivera (New Hire): Enrolled in Day-1 Orientation (In Progress: 33%) and SOC 2 Security (Not Started)
  const dueDate30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  insertEnrollmentStmt.run(
    "enr_alex_onb",
    "usr_alex_rivera",
    "crs_onboarding_day1",
    "IN_PROGRESS",
    33,
    "usr_sarah_jenkins",
    now,
    dueDate30Days,
    null,
    null,
    now,
    now
  );

  insertModuleProgressStmt.run(
    "mp_alex_onb_1",
    "enr_alex_onb",
    "mod_onb_welcome",
    "usr_alex_rivera",
    "COMPLETED",
    now,
    900,
    900,
    now,
    now
  );

  insertEnrollmentStmt.run(
    "enr_alex_sec",
    "usr_alex_rivera",
    "crs_sec_soc2_2026",
    "NOT_STARTED",
    0,
    "usr_sarah_jenkins",
    now,
    dueDate30Days,
    null,
    null,
    now,
    now
  );

  // Elena Rostova (Senior Engineer): Completed SOC 2 Security & Tech Safety with Certificates
  const pastCompletedDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const renewalExpiresDate = new Date(Date.now() + 351 * 24 * 60 * 60 * 1000).toISOString();

  insertEnrollmentStmt.run(
    "enr_elena_sec",
    "usr_elena_rostova",
    "crs_sec_soc2_2026",
    "COMPLETED",
    100,
    "usr_marcus_vance",
    now,
    dueDate30Days,
    pastCompletedDate,
    renewalExpiresDate,
    pastCompletedDate,
    pastCompletedDate
  );

  insertCertStmt.run(
    "cert_elena_sec_2026",
    "CERT-2026-SEC-89214",
    "usr_elena_rostova",
    "crs_sec_soc2_2026",
    "enr_elena_sec",
    "SOC 2 Information Security & Data Privacy 2026",
    "2026.1.0",
    "Elena Rostova",
    "elena.rostova@enterprise.corp",
    100,
    pastCompletedDate,
    renewalExpiresDate,
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    pastCompletedDate
  );

  insertEnrollmentStmt.run(
    "enr_elena_tech",
    "usr_elena_rostova",
    "crs_tech_prod_safety",
    "COMPLETED",
    100,
    "usr_sarah_jenkins",
    now,
    dueDate30Days,
    pastCompletedDate,
    renewalExpiresDate,
    pastCompletedDate,
    pastCompletedDate
  );

  insertCertStmt.run(
    "cert_elena_tech_2026",
    "CERT-2026-ENG-44109",
    "usr_elena_rostova",
    "crs_tech_prod_safety",
    "enr_elena_tech",
    "Production Infrastructure Safety & Operational Resilience",
    "2.1.0",
    "Elena Rostova",
    "elena.rostova@enterprise.corp",
    100,
    pastCompletedDate,
    renewalExpiresDate,
    "cb46599b4566f1beffda25197825b4fa1eb5b290dfcbb3cc0db8c2b7ca7cf1cf",
    pastCompletedDate
  );

  // Sarah Jenkins (Manager) & Marcus Vance (Compliance Officer): Completed SOC 2
  insertEnrollmentStmt.run(
    "enr_sarah_sec",
    "usr_sarah_jenkins",
    "crs_sec_soc2_2026",
    "COMPLETED",
    100,
    "usr_david_kim",
    now,
    dueDate30Days,
    pastCompletedDate,
    renewalExpiresDate,
    pastCompletedDate,
    pastCompletedDate
  );

  insertEnrollmentStmt.run(
    "enr_marcus_sec",
    "usr_marcus_vance",
    "crs_sec_soc2_2026",
    "COMPLETED",
    100,
    "usr_david_kim",
    now,
    dueDate30Days,
    pastCompletedDate,
    renewalExpiresDate,
    pastCompletedDate,
    pastCompletedDate
  );

  const pastDueDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Alex Rivera: Overdue on OSHA (creates real overdue flag for manager dashboard)
  insertEnrollmentStmt.run(
    "enr_alex_osha",
    "usr_alex_rivera",
    "crs_comp_osha",
    "OVERDUE",
    20,
    "usr_sarah_jenkins",
    now,
    pastDueDate,
    null,
    null,
    now,
    now
  );

  // Alex Rivera: In-Progress on Anti-Harassment
  insertEnrollmentStmt.run(
    "enr_alex_harass",
    "usr_alex_rivera",
    "crs_comp_harassment",
    "IN_PROGRESS",
    50,
    "usr_sarah_jenkins",
    now,
    dueDate30Days,
    null,
    null,
    now,
    now
  );

  // Elena Rostova: Completed OSHA and HIPAA
  insertEnrollmentStmt.run(
    "enr_elena_osha",
    "usr_elena_rostova",
    "crs_comp_osha",
    "COMPLETED",
    100,
    "usr_sarah_jenkins",
    now,
    dueDate30Days,
    pastCompletedDate,
    renewalExpiresDate,
    pastCompletedDate,
    pastCompletedDate
  );

  insertEnrollmentStmt.run(
    "enr_elena_hipaa",
    "usr_elena_rostova",
    "crs_comp_hipaa",
    "COMPLETED",
    100,
    "usr_marcus_vance",
    now,
    dueDate30Days,
    pastCompletedDate,
    renewalExpiresDate,
    pastCompletedDate,
    pastCompletedDate
  );

  // Sarah Jenkins: Completed Anti-Harassment
  insertEnrollmentStmt.run(
    "enr_sarah_harass",
    "usr_sarah_jenkins",
    "crs_comp_harassment",
    "COMPLETED",
    100,
    "usr_david_kim",
    now,
    dueDate30Days,
    pastCompletedDate,
    renewalExpiresDate,
    pastCompletedDate,
    pastCompletedDate
  );

  // Marcus Vance: Completed HIPAA
  insertEnrollmentStmt.run(
    "enr_marcus_hipaa",
    "usr_marcus_vance",
    "crs_comp_hipaa",
    "COMPLETED",
    100,
    "usr_david_kim",
    now,
    dueDate30Days,
    pastCompletedDate,
    renewalExpiresDate,
    pastCompletedDate,
    pastCompletedDate
  );

  // 6. Seed Initial Audit Log Chain
  const countStmt = db.prepare("SELECT COUNT(*) as count FROM audit_logs");
  const auditCount = (countStmt.get() as { count: number }).count;

  if (auditCount === 0) {
    recordAuditEvent({
      actorId: "usr_david_kim",
      actorRole: "SUPER_ADMIN",
      actorName: "David Kim",
      action: "SYSTEM_INITIALIZED",
      targetType: "SYSTEM",
      targetId: "lms_core_v1",
      details: { message: "Enterprise LMS database initialized and corporate catalog provisioned." },
    });

    recordAuditEvent({
      actorId: "usr_sarah_jenkins",
      actorRole: "MANAGER",
      actorName: "Sarah Jenkins",
      action: "COURSE_ASSIGNED",
      targetType: "ENROLLMENT",
      targetId: "enr_alex_onb",
      courseId: "crs_onboarding_day1",
      details: { assignedTo: "usr_alex_rivera", courseTitle: "Day-1 Enterprise Orientation & Engineering Setup" },
    });

    recordAuditEvent({
      actorId: "usr_elena_rostova",
      actorRole: "EMPLOYEE",
      actorName: "Elena Rostova",
      action: "COMPLIANCE_CERTIFIED",
      targetType: "CERTIFICATE",
      targetId: "cert_elena_sec_2026",
      courseId: "crs_sec_soc2_2026",
      score: 100,
      details: { certificateCode: "CERT-2026-SEC-89214", validityDays: 365 },
    });
  }

  // 10. Seed Marketplace Personas & Creator Studio Data
  try {
    const insertMarketplaceUser = db.prepare(`
      INSERT OR IGNORE INTO users (id, email, name, avatar_url, role, department, job_title, manager_id, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 1, ?, ?)
    `);
    insertMarketplaceUser.run(
      "usr_aris_thorne",
      "aris.thorne@enterprise.corp",
      "Dr. Aris Thorne",
      "/avatars/aris.jpg",
      "CO_ADMIN",
      "Curriculum & Engineering",
      "Principal Cloud Architect & Lead Instructor",
      now,
      now
    );
    insertMarketplaceUser.run(
      "usr_sophia_chen",
      "sophia.chen@enterprise.corp",
      "Sophia Chen",
      "/avatars/sophia.jpg",
      "STUDENT",
      "Engineering",
      "Software Engineer Intern",
      now,
      now
    );

    // Wallets
    const insertWallet = db.prepare(`
      INSERT OR REPLACE INTO wallets (id, user_id, balance, balance_cents, currency, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'USD', ?, ?)
    `);
    insertWallet.run("wal_usr_aris_thorne", "usr_aris_thorne", 12820, 12820, now, now);
    insertWallet.run("wal_usr_sophia_chen", "usr_sophia_chen", 50000, 50000, now, now);
    insertWallet.run("wal_usr_alex_rivera", "usr_alex_rivera", 40100, 40100, now, now);

    // Seed Marketplace Courses & Curricula
    const insertCourse = db.prepare(`
      INSERT OR REPLACE INTO courses (
        id, slug, title, description, category, target_role, is_mandatory,
        estimated_minutes, renewal_period_days, passing_score_pct, version,
        is_published, creator_id, price_cents, thumbnail_url, total_weeks, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, 'ALL', 0,
        ?, NULL, 80, '1.0.0',
        ?, ?, ?, ?, ?, ?, ?
      )
    `);

    const insertWeek = db.prepare(`
      INSERT OR REPLACE INTO weeks (id, course_id, week_number, title, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertLesson = db.prepare(`
      INSERT OR REPLACE INTO lessons (
        id, week_id, course_id, title, order_index, duration_seconds,
        video_url, supplementary_files, is_preview, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertWeekQuiz = db.prepare(`
      INSERT OR REPLACE INTO week_quizzes (
        id, week_id, course_id, title, passing_score_pct, questions, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const prefixMap: Record<string, string> = {
      crs_cloud_arch_7w: "cloud",
      crs_fullstack_ai_8w: "fsai",
      crs_zerotrust_sec_6w: "sec",
      crs_ai_agents_prod: "agents",
      crs_git_free_1w: "git",
      crs_uiux_design_5w: "uiux",
      crs_leadership_eng_4w: "lead",
    };

    for (const course of ALL_MARKETPLACE_COURSES) {
      insertCourse.run(
        course.id,
        course.slug,
        course.title,
        course.description,
        course.category,
        course.estimatedMinutes,
        course.isPublished,
        course.creatorId,
        course.priceCents,
        course.thumbnailUrl,
        course.totalWeeks,
        now,
        now
      );

      const prefix = prefixMap[course.id] || course.id.replace("crs_", "");

      for (const w of course.weeks) {
        const weekId = `wk_${prefix}_w${w.num}`;
        insertWeek.run(weekId, course.id, w.num, w.title, w.desc, now, now);

        for (const les of w.lessons) {
          insertLesson.run(
            `les_${prefix}_w${w.num}_${les.order}`,
            weekId,
            course.id,
            les.title,
            les.order,
            les.sec,
            les.video,
            JSON.stringify(les.files),
            les.preview,
            now,
            now
          );
        }

        if (w.questions && w.questions.length > 0) {
          insertWeekQuiz.run(
            `qz_${prefix}_w${w.num}`,
            weekId,
            course.id,
            w.quizTitle,
            w.passingScore,
            JSON.stringify(w.questions),
            now,
            now
          );
        }
      }
    }

    // Seed enrollments for Sophia Chen and Alex Rivera
    const insertEnrollment = db.prepare(`
      INSERT OR IGNORE INTO enrollments (
        id, user_id, course_id, status, progress_pct, assigned_by, assigned_at, due_date, completed_at, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, NULL, ?, NULL, NULL, NULL, ?, ?)
    `);
    insertEnrollment.run("enr_sophia_cloud", "usr_sophia_chen", "crs_cloud_arch_7w", "IN_PROGRESS", 45, now, now, now);
    insertEnrollment.run("enr_alex_cloud", "usr_alex_rivera", "crs_cloud_arch_7w", "IN_PROGRESS", 20, now, now, now);

    // Seed transactions (Sophia and Alex bought crs_cloud_arch_7w: $99.00 each)
    const insertTx = db.prepare(`
      INSERT OR REPLACE INTO transactions (
        id, course_id, student_id, creator_id,
        amount, amount_cents,
        platform_fee, platform_fee_cents,
        creator_earnings, creator_payout_cents,
        currency, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertTx.run("tx_seed_cloud_1", "crs_cloud_arch_7w", "usr_sophia_chen", "usr_aris_thorne", 9900, 9900, 990, 990, 8910, 8910, "USD", "COMPLETED", now);
    insertTx.run("tx_seed_cloud_2", "crs_cloud_arch_7w", "usr_alex_rivera", "usr_aris_thorne", 9900, 9900, 990, 990, 8910, 8910, "USD", "COMPLETED", now);

    // Seed payouts
    const insertPayout = db.prepare(`
      INSERT OR REPLACE INTO payouts (id, creator_id, amount, amount_cents, status, requested_at, processed_at, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertPayout.run("po_seed_1", "usr_aris_thorne", 5000, 5000, "PROCESSED", new Date(Date.now() - 3 * 86400000).toISOString(), new Date(Date.now() - 2 * 86400000).toISOString(), "Initial creator studio withdrawal");
    insertPayout.run("po_seed_2", "usr_aris_thorne", 2500, 2500, "PENDING", now, null, "Bi-weekly creator earnings withdrawal");

  } catch (err) {
    // ignore
  }

  // Record migration marker
  db.prepare("INSERT OR REPLACE INTO _migrations (name, applied_at) VALUES ('001_initial_schema_and_seed', ?)").run(now);
}
