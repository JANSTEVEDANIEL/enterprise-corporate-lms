import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { getDb, initDb } from "../db";
import type { AuditLogRecord, Role } from "@/types";

export const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

export interface RecordAuditEventInput {
  actorId: string;
  actorRole: Role;
  actorName?: string;
  action: string;
  targetType: string;
  targetId: string;
  courseId?: string | null;
  moduleId?: string | null;
  moduleVersion?: string | null;
  score?: number | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string;
}

export function canonicalStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalStringify).join(",") + "]";
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalStringify((obj as Record<string, unknown>)[k])}`
  );
  return "{" + entries.join(",") + "}";
}

export function computeRecordHash(payload: {
  uuid: string;
  prevHash: string;
  timestamp: string;
  actorId: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  courseId?: string | null;
  moduleId?: string | null;
  moduleVersion?: string | null;
  score?: number | null;
  metadata?: string | null;
}): string {
  const canonicalData = canonicalStringify({
    uuid: payload.uuid,
    prev_hash: payload.prevHash,
    timestamp: payload.timestamp,
    actor_id: payload.actorId,
    actor_role: payload.actorRole,
    action: payload.action,
    target_type: payload.targetType,
    target_id: payload.targetId,
    course_id: payload.courseId ?? null,
    module_id: payload.moduleId ?? null,
    module_version: payload.moduleVersion ?? null,
    score: payload.score ?? null,
    metadata: payload.metadata ?? null,
  });

  return createHash("sha256").update(canonicalData).digest("hex");
}

export function recordAuditEvent(event: RecordAuditEventInput, customDb?: DatabaseSync): AuditLogRecord {
  if (!customDb) {
    initDb();
  }
  const db = customDb || getDb();

  let startedTransaction = false;
  try {
    db.exec("BEGIN IMMEDIATE;");
    startedTransaction = true;
  } catch {
    // Transaction already active
  }

  try {
    // Find previous hash
    const lastRecordStmt = db.prepare("SELECT record_hash FROM audit_logs ORDER BY id DESC LIMIT 1");
    const lastRecord = lastRecordStmt.get() as { record_hash: string } | undefined;
    const prevHash = lastRecord ? lastRecord.record_hash : GENESIS_HASH;

    const uuid = randomUUID();
    const timestamp = new Date().toISOString();
    const metadataObj = {
      ...(event.details || {}),
      ipAddress: event.ipAddress || "127.0.0.1",
    };
    const metadata = JSON.stringify(metadataObj);
    const actorName = event.actorName || event.actorId;

    const recordHash = computeRecordHash({
      uuid,
      prevHash,
      timestamp,
      actorId: event.actorId,
      actorRole: event.actorRole,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
      courseId: event.courseId,
      moduleId: event.moduleId,
      moduleVersion: event.moduleVersion,
      score: event.score,
      metadata,
    });

    const insertStmt = db.prepare(`
      INSERT INTO audit_logs (
        uuid, timestamp, actor_id, actor_role, actor_name, action,
        target_type, target_id, course_id, module_id, module_version,
        score, metadata, prev_hash, record_hash
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    const result = insertStmt.run(
      uuid,
      timestamp,
      event.actorId,
      event.actorRole,
      actorName,
      event.action,
      event.targetType,
      event.targetId,
      event.courseId || null,
      event.moduleId || null,
      event.moduleVersion || null,
      event.score ?? null,
      metadata,
      prevHash,
      recordHash
    );

    if (startedTransaction) {
      db.exec("COMMIT;");
    }

    const insertedId = Number(result.lastInsertRowid);

    return {
      id: insertedId,
      uuid,
      timestamp,
      actor_id: event.actorId,
      actor_role: event.actorRole,
      actor_name: actorName,
      action: event.action,
      target_type: event.targetType,
      target_id: event.targetId,
      course_id: event.courseId || null,
      module_id: event.moduleId || null,
      module_version: event.moduleVersion || null,
      score: event.score ?? null,
      metadata,
      prev_hash: prevHash,
      record_hash: recordHash,
    };
  } catch (err) {
    if (startedTransaction) {
      try {
        db.exec("ROLLBACK;");
      } catch {}
    }
    throw err;
  }
}

export interface AuditVerificationResult {
  isValid: boolean;
  totalRecords: number;
  tamperedIndex?: number;
  expectedHash?: string;
  actualHash?: string;
  failureReason?: string;
  firstTimestamp?: string | null;
  lastTimestamp?: string | null;
}

export function verifyAuditLogIntegrity(customDb?: DatabaseSync): AuditVerificationResult {
  if (!customDb) {
    initDb();
  }
  const db = customDb || getDb();

  const stmt = db.prepare("SELECT * FROM audit_logs ORDER BY id ASC");
  const records = stmt.all() as unknown as AuditLogRecord[];

  if (records.length === 0) {
    return {
      isValid: true,
      totalRecords: 0,
      firstTimestamp: null,
      lastTimestamp: null,
    };
  }

  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < records.length; i++) {
    const row = records[i];

    // 1. Check prev_hash link
    if (row.prev_hash !== expectedPrevHash) {
      return {
        isValid: false,
        totalRecords: records.length,
        tamperedIndex: i,
        expectedHash: expectedPrevHash,
        actualHash: row.prev_hash,
        failureReason: `Broken hash chain at record ID ${row.id}: prev_hash does not match previous record's hash`,
        firstTimestamp: records[0].timestamp,
        lastTimestamp: records[records.length - 1].timestamp,
      };
    }

    // 2. Re-compute current record's hash
    const recomputedHash = computeRecordHash({
      uuid: row.uuid,
      prevHash: row.prev_hash,
      timestamp: row.timestamp,
      actorId: row.actor_id,
      actorRole: row.actor_role,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      courseId: row.course_id,
      moduleId: row.module_id,
      moduleVersion: row.module_version,
      score: row.score,
      metadata: row.metadata,
    });

    if (recomputedHash !== row.record_hash) {
      return {
        isValid: false,
        totalRecords: records.length,
        tamperedIndex: i,
        expectedHash: recomputedHash,
        actualHash: row.record_hash,
        failureReason: `Data tampering detected at record ID ${row.id}: record_hash does not match cryptographic hash of record contents`,
        firstTimestamp: records[0].timestamp,
        lastTimestamp: records[records.length - 1].timestamp,
      };
    }

    expectedPrevHash = row.record_hash;
  }

  return {
    isValid: true,
    totalRecords: records.length,
    firstTimestamp: records[0].timestamp,
    lastTimestamp: records[records.length - 1].timestamp,
  };
}
