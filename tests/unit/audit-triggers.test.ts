import test from "node:test";
import assert from "node:assert/strict";
import { getDb, initDb } from "@/lib/db";
import { recordAuditEvent, verifyAuditLogIntegrity } from "@/lib/audit";

test("Database immutability triggers prevent UPDATE and DELETE on audit_logs", () => {
  initDb();
  const db = getDb();

  // Create a test audit log entry
  const record = recordAuditEvent({
    actorId: "usr_david_kim",
    actorRole: "SUPER_ADMIN",
    action: "IMMUTABILITY_TRIGGER_TEST",
    targetType: "SYSTEM",
    targetId: "test_target",
    details: { test: true },
  });

  assert.ok(record.id > 0);
  assert.ok(record.record_hash);

  // 1. Attempt UPDATE — SQLite trigger must abort
  assert.throws(
    () => {
      db.prepare("UPDATE audit_logs SET action = 'HACKED' WHERE id = ?").run(record.id);
    },
    (err: any) => {
      assert.match(err.message, /Audit log records are immutable and cannot be updated/i);
      return true;
    },
    "Expected UPDATE on audit_logs to be rejected by trigger"
  );

  // 2. Attempt DELETE — SQLite trigger must abort
  assert.throws(
    () => {
      db.prepare("DELETE FROM audit_logs WHERE id = ?").run(record.id);
    },
    (err: any) => {
      assert.match(err.message, /Audit log records are immutable and cannot be deleted/i);
      return true;
    },
    "Expected DELETE on audit_logs to be rejected by trigger"
  );
});

test("Audit log cryptographic hash chain is valid", () => {
  const result = verifyAuditLogIntegrity();
  assert.equal(result.isValid, true);
  assert.ok(result.totalRecords >= 3);
});
