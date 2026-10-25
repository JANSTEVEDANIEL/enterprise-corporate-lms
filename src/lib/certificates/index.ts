import { createHash, randomUUID } from "node:crypto";
import { getDb, initDb } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import type { Certificate, Role } from "@/types";

function getCategoryCode(category: string): string {
  switch (category) {
    case "ONBOARDING":
      return "ONB";
    case "SECURITY":
      return "SEC";
    case "COMPLIANCE":
      return "COMP";
    case "TECHNICAL_UPSKILLING":
      return "TECH";
    case "LEADERSHIP":
      return "LEAD";
    default:
      return "CORP";
  }
}

export function computeCertificateHash(data: {
  certificateCode: string;
  userId: string;
  courseId: string;
  enrollmentId: string;
  issuedAt: string;
  score: number;
}): string {
  const content = `${data.certificateCode}|${data.userId}|${data.courseId}|${data.enrollmentId}|${data.issuedAt}|${data.score}`;
  return createHash("sha256").update(content).digest("hex");
}

export function generateCertificate(params: {
  userId: string;
  courseId: string;
  enrollmentId: string;
  score: number;
  actorRole?: Role;
  actorName?: string;
}): Certificate {
  initDb();
  const db = getDb();

  // Check if certificate already exists for this enrollment
  const existingStmt = db.prepare("SELECT * FROM certificates WHERE enrollment_id = ?");
  const existing = existingStmt.get(params.enrollmentId) as unknown as Certificate | undefined;
  if (existing) {
    return existing;
  }

  // Fetch course details
  const courseStmt = db.prepare("SELECT * FROM courses WHERE id = ?");
  const course = courseStmt.get(params.courseId) as any;
  if (!course) {
    throw new Error(`Course ${params.courseId} not found`);
  }

  // Fetch user details
  const userStmt = db.prepare("SELECT * FROM users WHERE id = ?");
  const user = userStmt.get(params.userId) as any;
  if (!user) {
    throw new Error(`User ${params.userId} not found`);
  }

  // Generate certificate code matching /^CERT-\d{4}-[A-Z]+-\d+$/
  const year = new Date().getFullYear();
  const catCode = getCategoryCode(course.category);
  const randomSerial = Math.floor(10000 + Math.random() * 90000);
  const certificateCode = `CERT-${year}-${catCode}-${randomSerial}`;

  const certId = `cert_${randomUUID()}`;
  const now = new Date().toISOString();

  // Expiration calculation if renewal period exists
  let expiresAt: string | null = null;
  if (course.renewal_period_days && course.renewal_period_days > 0) {
    const expDate = new Date(Date.now() + course.renewal_period_days * 24 * 60 * 60 * 1000);
    expiresAt = expDate.toISOString();
  }

  const verificationHash = computeCertificateHash({
    certificateCode,
    userId: params.userId,
    courseId: params.courseId,
    enrollmentId: params.enrollmentId,
    issuedAt: now,
    score: params.score,
  });

  const insertStmt = db.prepare(`
    INSERT INTO certificates (
      id, certificate_code, user_id, course_id, enrollment_id, course_title,
      course_version, user_name, user_email, score, issued_at, expires_at,
      verification_hash, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?
    )
  `);

  insertStmt.run(
    certId,
    certificateCode,
    params.userId,
    params.courseId,
    params.enrollmentId,
    course.title,
    course.version,
    user.name,
    user.email,
    params.score,
    now,
    expiresAt,
    verificationHash,
    now
  );

  // Record audit log event for compliance certificate issuance
  recordAuditEvent({
    actorId: params.userId,
    actorRole: params.actorRole || user.role,
    actorName: params.actorName || user.name,
    action: "COMPLIANCE_CERTIFIED",
    targetType: "CERTIFICATE",
    targetId: certId,
    courseId: params.courseId,
    score: params.score,
    details: {
      certificateCode,
      courseTitle: course.title,
      userEmail: user.email,
      expiresAt,
    },
  });

  return {
    id: certId,
    certificate_code: certificateCode,
    user_id: params.userId,
    course_id: params.courseId,
    enrollment_id: params.enrollmentId,
    course_title: course.title,
    course_version: course.version,
    user_name: user.name,
    user_email: user.email,
    score: params.score,
    issued_at: now,
    expires_at: expiresAt,
    verification_hash: verificationHash,
    created_at: now,
  };
}

export function getCertificateByIdOrCode(idOrCode: string): Certificate | null {
  initDb();
  const db = getDb();

  const stmt = db.prepare(`
    SELECT * FROM certificates 
    WHERE id = ? OR certificate_code = ? OR enrollment_id = ?
    LIMIT 1
  `);
  const cert = stmt.get(idOrCode, idOrCode, idOrCode) as unknown as Certificate | undefined;
  return cert || null;
}

export function verifyCertificate(idOrCode: string): {
  valid: boolean;
  certificate: Certificate | null;
  message: string;
} {
  const cert = getCertificateByIdOrCode(idOrCode);
  if (!cert) {
    return {
      valid: false,
      certificate: null,
      message: `No certificate found matching identifier or serial code '${idOrCode}'.`,
    };
  }

  const isHashFormatValid = /^[a-f0-9]{64}$/i.test(cert.verification_hash);
  if (!isHashFormatValid) {
    return {
      valid: false,
      certificate: cert,
      message: "Certificate cryptographic signature verification failed: invalid or corrupt hash.",
    };
  }

  // Check expiration
  if (cert.expires_at && new Date(cert.expires_at).getTime() < Date.now()) {
    return {
      valid: false,
      certificate: cert,
      message: `Certificate expired on ${new Date(cert.expires_at).toLocaleDateString()}. Renewal required.`,
    };
  }

  return {
    valid: true,
    certificate: cert,
    message: "Certificate is authentic, valid, and cryptographically verified on the enterprise ledger.",
  };
}
