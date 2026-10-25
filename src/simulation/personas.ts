import type { DatabaseSync } from "node:sqlite";
import type { Role } from "@/types";

export type PersonaKey = "alex" | "elena" | "marcus";

export interface PersonaDefinition {
  key: PersonaKey;
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  jobTitle: string;
  avatarUrl?: string;
  targetCourseId: string;
  targetCourseTitle: string;
  summary: string;
  expectedSteps: string[];
}

export const SIMULATION_PERSONAS: Record<PersonaKey, PersonaDefinition> = {
  alex: {
    key: "alex",
    id: "usr_alex_rivera",
    name: "Alex Rivera",
    email: "alex.rivera@enterprise.corp",
    role: "EMPLOYEE",
    department: "Engineering",
    jobTitle: "Junior Software Engineer",
    avatarUrl: "/avatars/alex.jpg",
    targetCourseId: "crs_onboarding_day1",
    targetCourseTitle: "Day-1 Enterprise Orientation & Engineering Setup",
    summary:
      "New Hire employee navigating Day-1 corporate orientation: reading company culture markdown, completing physical security video module, passing interactive quiz with 100%, and earning a verifiable cryptographic certificate.",
    expectedSteps: [
      "Session Assumption & Onboarding Initialization",
      "Traverse Module 0 (Welcome Markdown & Values)",
      "Traverse Module 1 (Physical Security Video)",
      "Complete Interactive Quiz (100% Score >= 80% Pass Threshold)",
      "Assert Terminal State: 100% Course Completion, Certificate Issued & Audit Chain Verified",
    ],
  },
  elena: {
    key: "elena",
    id: "usr_elena_rostova",
    name: "Elena Rostova",
    email: "elena.rostova@enterprise.corp",
    role: "EMPLOYEE",
    department: "Security",
    jobTitle: "Senior Security Engineer",
    avatarUrl: "/avatars/elena.jpg",
    targetCourseId: "crs_tech_prod_safety",
    targetCourseTitle: "Production Infrastructure Safety & Operational Resilience",
    summary:
      "Senior Engineer undergoing advanced technical safety training: reviewing canary release rollbacks and zero-downtime deployment documentation, passing edge-case resilience exam with 100%, and verifying 365-day renewal validity.",
    expectedSteps: [
      "Session Init & Technical Curriculum Resume",
      "Technical Markdown Review (Canary & Rollback Runbooks)",
      "Technical Safety Exam (100% Score >= 85% Strict Threshold)",
      "Assert Terminal State: Versioned Audit Logging (v2.1.0) & 365-Day Renewal Validity",
    ],
  },
  marcus: {
    key: "marcus",
    id: "usr_marcus_vance",
    name: "Marcus Vance",
    email: "marcus.vance@enterprise.corp",
    role: "COMPLIANCE_OFFICER",
    department: "People Ops",
    jobTitle: "Head of Corporate Compliance",
    avatarUrl: "/avatars/marcus.jpg",
    targetCourseId: "all",
    targetCourseTitle: "Company-Wide Compliance & Regulatory Audit",
    summary:
      "Compliance Officer executing company-wide regulatory audit: reviewing executive KPIs and regulation metrics (SOC2, OSHA, HIPAA), detecting overdue/expiring certifications, dispatching reminder nudges, verifying SHA-256 Merkle hash chain integrity, and generating official CSV/JSON audit export manifests.",
    expectedSteps: [
      "Session Init as Compliance Officer & Executive KPI Assessment",
      "Department Breakdown Analysis & Overdue Credential Detection",
      "One-Click Automated Reminder Nudge Dispatch",
      "Cryptographic SHA-256 Merkle Hash Chain Verification",
      "Regulatory Audit Export Generation (RFC 4180 CSV & SOC 2 JSON Manifest)",
    ],
  },
};

export type SimulationStepStatus = "PENDING" | "RUNNING" | "PASSED" | "FAILED";

export interface StateTransition {
  entity: string;
  from: string;
  to: string;
  metadata?: Record<string, unknown>;
}

export interface SimulationStepResult {
  stepNumber: number;
  name: string;
  description: string;
  status: SimulationStepStatus;
  durationMs: number;
  stateTransition?: StateTransition;
  details?: Record<string, unknown>;
  error?: string;
}

export interface SimulationArtifacts {
  certificateId?: string;
  certificateCode?: string;
  certificateHash?: string;
  quizScore?: number;
  quizPassed?: boolean;
  auditLogsGenerated?: number;
  auditRootHash?: string;
  csvExportBytes?: number;
  jsonExportBytes?: number;
  [key: string]: unknown;
}

export interface PersonaSimulationResult {
  personaKey: PersonaKey;
  personaId: string;
  personaName: string;
  role: Role;
  targetCourseId: string;
  targetCourseTitle: string;
  status: "PASSED" | "FAILED";
  totalDurationMs: number;
  steps: SimulationStepResult[];
  artifacts?: SimulationArtifacts;
  error?: string;
}

export interface OverallSimulationSummary {
  success: boolean;
  totalPersonas: number;
  passedPersonas: number;
  failedPersonas: number;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  totalDurationMs: number;
  executedAt: string;
  results: Record<PersonaKey, PersonaSimulationResult>;
  auditVerification: {
    isValid: boolean;
    totalRecords: number;
    rootHash?: string;
  };
}

export interface SimulationOptions {
  db?: DatabaseSync;
  resetState?: boolean;
  logProgress?: boolean;
  logger?: (message: string) => void;
}
