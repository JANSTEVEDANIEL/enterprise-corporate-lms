import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SCHEMA_SQL } from "../../src/lib/db/schema";
import {
  recordAuditEvent,
  verifyAuditLogIntegrity,
  computeRecordHash,
  canonicalStringify,
  GENESIS_HASH,
} from "../../src/lib/audit";
import { getDb, closeDb } from "../../src/lib/db";

describe("Adversarial & Stress Verification: SQLite Immutability & SHA-256 Hash Chaining", () => {
  const testDbDir = path.join(process.cwd(), ".data");
  const testDbPath = path.join(testDbDir, `adversarial_main_${Date.now()}.db`);
  let db: DatabaseSync;

  before(() => {
    process.env.LMS_DB_PATH = testDbPath;
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
    for (const ext of ["", "-wal", "-shm"]) {
      if (fs.existsSync(testDbPath + ext)) {
        try { fs.unlinkSync(testDbPath + ext); } catch {}
      }
    }
    closeDb();
    db = getDb();
    db.exec(SCHEMA_SQL);

    // Insert base users for foreign key satisfaction
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO users (id, email, name, role, department, job_title, created_at, updated_at)
      VALUES ('usr_adv_admin', 'admin@adv.corp', 'Admin Adv', 'SUPER_ADMIN', 'Executive', 'Admin', ?, ?)
    `).run(now, now);

    db.prepare(`
      INSERT INTO users (id, email, name, role, department, job_title, created_at, updated_at)
      VALUES ('usr_adv_user', 'user@adv.corp', 'User Adv', 'EMPLOYEE', 'Engineering', 'Dev', ?, ?)
    `).run(now, now);
  });

  after(() => {
    closeDb();
    delete process.env.LMS_DB_PATH;
    for (const ext of ["", "-wal", "-shm"]) {
      if (fs.existsSync(testDbPath + ext)) {
        try { fs.unlinkSync(testDbPath + ext); } catch {}
      }
    }
  });

  // =========================================================================
  // SUITE 1: SQLite Engine-Level Immutability Triggers (Direct UPDATE attacks)
  // =========================================================================
  describe("Suite 1: Direct SQL UPDATE attacks against audit_logs", () => {
    it("1.1 Direct single-row UPDATE is rejected by SQLite trigger", () => {
      const rec = recordAuditEvent({
        actorId: "usr_adv_admin",
        actorRole: "SUPER_ADMIN",
        action: "INITIAL_RECORD_1",
        targetType: "SYSTEM",
        targetId: "sys_1",
      });

      assert.throws(
        () => {
          db.prepare("UPDATE audit_logs SET action = 'HACKED' WHERE id = ?").run(rec.id);
        },
        (err: any) => {
          assert.match(err.message, /Audit log records are immutable and cannot be updated/i);
          return true;
        }
      );

      // Verify row was untouched
      const row = db.prepare("SELECT * FROM audit_logs WHERE id = ?").get(rec.id) as any;
      assert.strictEqual(row.action, "INITIAL_RECORD_1");
    });

    it("1.2 Bulk unconditional UPDATE is rejected by SQLite trigger", () => {
      assert.throws(
        () => {
          db.prepare("UPDATE audit_logs SET actor_name = 'Malicious Actor'").run();
        },
        (err: any) => {
          assert.match(err.message, /Audit log records are immutable and cannot be updated/i);
          return true;
        }
      );
    });

    it("1.3 Subquery and CTE UPDATE is rejected by SQLite trigger", () => {
      assert.throws(
        () => {
          db.prepare(`
            UPDATE audit_logs 
            SET score = 100.0 
            WHERE id IN (SELECT id FROM audit_logs LIMIT 1)
          `).run();
        },
        (err: any) => {
          assert.match(err.message, /Audit log records are immutable and cannot be updated/i);
          return true;
        }
      );
    });

    it("1.4 Attempted UPDATE inside explicit transaction rolls back entire transaction", () => {
      db.exec("BEGIN TRANSACTION;");
      let threw = false;
      try {
        db.prepare("UPDATE audit_logs SET prev_hash = 'corrupted' WHERE id = 1").run();
        db.exec("COMMIT;");
      } catch (err: any) {
        threw = true;
        db.exec("ROLLBACK;");
        assert.match(err.message, /Audit log records are immutable and cannot be updated/i);
      }
      assert.strictEqual(threw, true, "Transaction update must throw error");

      const row = db.prepare("SELECT * FROM audit_logs WHERE id = 1").get() as any;
      assert.notStrictEqual(row.prev_hash, "corrupted");
    });

    it("1.5 Attempted UPDATE of cryptographic hash columns is rejected", () => {
      assert.throws(
        () => {
          db.prepare("UPDATE audit_logs SET record_hash = '0000000000000000' WHERE id = 1").run();
        },
        /Audit log records are immutable and cannot be updated/i
      );
    });
  });

  // =========================================================================
  // SUITE 2: SQLite Engine-Level Immutability Triggers (Direct DELETE attacks)
  // =========================================================================
  describe("Suite 2: Direct SQL DELETE attacks against audit_logs", () => {
    it("2.1 Direct single-row DELETE is rejected by SQLite trigger", () => {
      const rec = recordAuditEvent({
        actorId: "usr_adv_admin",
        actorRole: "SUPER_ADMIN",
        action: "RECORD_FOR_DELETE_TEST",
        targetType: "SYSTEM",
        targetId: "sys_del_1",
      });

      assert.throws(
        () => {
          db.prepare("DELETE FROM audit_logs WHERE id = ?").run(rec.id);
        },
        (err: any) => {
          assert.match(err.message, /Audit log records are immutable and cannot be deleted/i);
          return true;
        }
      );

      // Verify row still exists
      const row = db.prepare("SELECT * FROM audit_logs WHERE id = ?").get(rec.id) as any;
      assert.ok(row, "Audit log row must still exist after rejected DELETE");
    });

    it("2.2 Bulk table wipe DELETE is rejected by SQLite trigger", () => {
      assert.throws(
        () => {
          db.prepare("DELETE FROM audit_logs").run();
        },
        /Audit log records are immutable and cannot be deleted/i
      );

      const count = db.prepare("SELECT count(*) as count FROM audit_logs").get() as { count: number };
      assert.ok(count.count >= 2, "Audit logs count must not decrease");
    });

    it("2.3 DELETE via subquery is rejected", () => {
      assert.throws(
        () => {
          db.prepare("DELETE FROM audit_logs WHERE id IN (SELECT id FROM audit_logs ORDER BY id DESC LIMIT 1)").run();
        },
        /Audit log records are immutable and cannot be deleted/i
      );
    });
  });

  // =========================================================================
  // SUITE 3: Foreign Key Cascades & Indirect Deletion
  // =========================================================================
  describe("Suite 3: Foreign Key Cascades & Referential Integrity", () => {
    it("3.1 Deleting a referenced User is blocked by Foreign Key constraint", () => {
      // Users referenced in audit_logs cannot be deleted to prevent broken referential integrity
      assert.throws(
        () => {
          db.prepare("DELETE FROM users WHERE id = 'usr_adv_admin'").run();
        },
        /FOREIGN KEY constraint failed/i
      );

      const user = db.prepare("SELECT * FROM users WHERE id = 'usr_adv_admin'").get() as any;
      assert.ok(user, "User must still exist");
    });
  });

  // =========================================================================
  // SUITE 4: SQLite Conflict Resolution (INSERT OR REPLACE) Bypass Vulnerability
  // =========================================================================
  describe("Suite 4: Adversarial SQLite REPLACE Conflict Resolution Analysis", () => {
    it("4.1 Demonstrates that INSERT OR REPLACE bypasses BEFORE UPDATE and BEFORE DELETE triggers in current schema", () => {
      // Create isolated DB to prove trigger bypass without contaminating main DB
      const isoDb = new DatabaseSync(":memory:");
      isoDb.exec(SCHEMA_SQL);
      isoDb.prepare(`
        INSERT INTO users (id, email, name, role, department, job_title, created_at, updated_at)
        VALUES ('u1', 'e1', 'n1', 'SUPER_ADMIN', 'd1', 'j1', '2026-01-01', '2026-01-01')
      `).run();

      isoDb.prepare(`
        INSERT INTO audit_logs (id, uuid, timestamp, actor_id, actor_role, actor_name, action, target_type, target_id, prev_hash, record_hash)
        VALUES (1, 'orig-uuid', '2026-01-01', 'u1', 'SUPER_ADMIN', 'Admin', 'LEGITIMATE_ACTION', 'SYSTEM', 's1', '${GENESIS_HASH}', 'valid_hash')
      `).run();

      // In current schema, INSERT OR REPLACE replaces row 1 without firing prevent_audit_update or prevent_audit_delete
      isoDb.prepare(`
        INSERT OR REPLACE INTO audit_logs (id, uuid, timestamp, actor_id, actor_role, actor_name, action, target_type, target_id, prev_hash, record_hash)
        VALUES (1, 'orig-uuid', '2026-01-01', 'u1', 'SUPER_ADMIN', 'Admin', 'FORGED_MUTATION', 'SYSTEM', 's1', '${GENESIS_HASH}', 'forged_hash')
      `).run();

      const mutated = isoDb.prepare("SELECT action FROM audit_logs WHERE id = 1").get() as any;
      assert.strictEqual(mutated.action, "FORGED_MUTATION", "Confirms vulnerability: REPLACE bypassed triggers");
      isoDb.close();
    });

    it("4.2 Confirms prevent_audit_replace trigger effectively closes the REPLACE bypass", () => {
      const hardenedDb = new DatabaseSync(":memory:");
      hardenedDb.exec(SCHEMA_SQL);
      hardenedDb.exec(`
        CREATE TRIGGER IF NOT EXISTS prevent_audit_replace 
        BEFORE INSERT ON audit_logs 
        WHEN (SELECT 1 FROM audit_logs WHERE id = NEW.id OR uuid = NEW.uuid) IS NOT NULL
        BEGIN 
          SELECT RAISE(ABORT, 'Audit log records are immutable and cannot be replaced or overwritten'); 
        END;
      `);

      hardenedDb.prepare(`
        INSERT INTO users (id, email, name, role, department, job_title, created_at, updated_at)
        VALUES ('u1', 'e1', 'n1', 'SUPER_ADMIN', 'd1', 'j1', '2026-01-01', '2026-01-01')
      `).run();

      hardenedDb.prepare(`
        INSERT INTO audit_logs (id, uuid, timestamp, actor_id, actor_role, actor_name, action, target_type, target_id, prev_hash, record_hash)
        VALUES (1, 'orig-uuid', '2026-01-01', 'u1', 'SUPER_ADMIN', 'Admin', 'LEGITIMATE_ACTION', 'SYSTEM', 's1', '${GENESIS_HASH}', 'valid_hash')
      `).run();

      // Now INSERT OR REPLACE is strictly aborted by prevent_audit_replace
      assert.throws(
        () => {
          hardenedDb.prepare(`
            INSERT OR REPLACE INTO audit_logs (id, uuid, timestamp, actor_id, actor_role, actor_name, action, target_type, target_id, prev_hash, record_hash)
            VALUES (1, 'orig-uuid', '2026-01-01', 'u1', 'SUPER_ADMIN', 'Admin', 'FORGED_MUTATION', 'SYSTEM', 's1', '${GENESIS_HASH}', 'forged_hash')
          `).run();
        },
        /Audit log records are immutable and cannot be replaced or overwritten/i
      );

      hardenedDb.close();
    });
  });

  // =========================================================================
  // SUITE 5: Offline Bit Tampering & SHA-256 Hash Recalculation
  // =========================================================================
  describe("Suite 5: Offline Bit-Flip & Binary Database Tampering Detection", () => {
    it("5.1 Pristine audit log verifies successfully", () => {
      const res = verifyAuditLogIntegrity();
      assert.strictEqual(res.isValid, true);
      assert.ok(res.totalRecords >= 2);
    });

    it("5.2 Offline binary bit tampering in SQLite file is detected by SHA-256 recalculation", () => {
      // 1. Checkpoint WAL and close DB
      db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
      closeDb();

      // 2. Read database raw bytes
      const fileBytes = fs.readFileSync(testDbPath);
      assert.ok(fileBytes.length > 0, "Database file must have content");

      // 3. Search for known record string in raw bytes
      const targetString = "INITIAL_RECORD_1";
      const targetBuffer = Buffer.from(targetString, "utf8");
      const index = fileBytes.indexOf(targetBuffer);
      assert.ok(index !== -1, `Target string "${targetString}" must be found in SQLite binary file`);

      // 4. Tamper by flipping a single byte in the action string (e.g., 'I' -> 'X')
      const tamperedBytes = Buffer.from(fileBytes);
      tamperedBytes[index] = "X".charCodeAt(0); // Changes "INITIAL_RECORD_1" to "XNITIAL_RECORD_1"

      // 5. Write tampered file back to disk
      fs.writeFileSync(testDbPath, tamperedBytes);

      // 6. Reopen DB and execute integrity verification
      const verifyRes = verifyAuditLogIntegrity();

      // 7. ASSERT: Integrity verification MUST detect the tampering!
      assert.strictEqual(verifyRes.isValid, false, "Integrity check must fail on bit-tampered database");
      assert.strictEqual(typeof verifyRes.tamperedIndex, "number");
      assert.match(verifyRes.failureReason || "", /Data tampering detected/i);
      assert.notStrictEqual(verifyRes.expectedHash, verifyRes.actualHash);

      // 8. Restore original bytes for subsequent tests
      closeDb();
      fs.writeFileSync(testDbPath, fileBytes);
      const restoredRes = verifyAuditLogIntegrity();
      assert.strictEqual(restoredRes.isValid, true, "Restored database must verify as valid");
    });

    it("5.3 Offline tampering of metadata payload is detected", () => {
      const uniquePayload = "SECRET_NONCE_987654";
      recordAuditEvent({
        actorId: "usr_adv_user",
        actorRole: "EMPLOYEE",
        action: "METADATA_TEST",
        targetType: "MODULE",
        targetId: "mod_adv_1",
        details: { token: uniquePayload },
      });

      // Flush and close
      db = getDb();
      db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
      closeDb();

      // Read raw bytes and flip a byte in SECRET_NONCE
      const fileBytes = fs.readFileSync(testDbPath);
      const targetBuffer = Buffer.from(uniquePayload, "utf8");
      const index = fileBytes.indexOf(targetBuffer);
      assert.ok(index !== -1, `Unique payload "${uniquePayload}" found in binary`);

      const tamperedBytes = Buffer.from(fileBytes);
      tamperedBytes[index + uniquePayload.length - 1] = "5".charCodeAt(0);
      fs.writeFileSync(testDbPath, tamperedBytes);

      // Verify tampering detected
      const res = verifyAuditLogIntegrity();
      assert.strictEqual(res.isValid, false, "Metadata byte alteration must be detected");
      assert.match(res.failureReason || "", /Data tampering detected/i);

      // Restore
      closeDb();
      fs.writeFileSync(testDbPath, fileBytes);
      assert.strictEqual(verifyAuditLogIntegrity().isValid, true);
    });
  });

  // =========================================================================
  // SUITE 6: Hash Chaining Invariants, Permutations & Rapid Ingestion
  // =========================================================================
  describe("Suite 6: Hash Chain Invariants, Permutations & Rapid Ingestion", () => {
    it("6.1 Canonically sorts metadata keys to ensure strict deterministic hashing", () => {
      const objA = { z: 1, a: 2, m: { y: 10, b: 20 } };
      const objB = { a: 2, m: { b: 20, y: 10 }, z: 1 };
      assert.strictEqual(canonicalStringify(objA), canonicalStringify(objB));

      const hashA = computeRecordHash({
        uuid: "u1",
        prevHash: GENESIS_HASH,
        timestamp: "2026-10-25T12:00:00Z",
        actorId: "usr_1",
        actorRole: "EMPLOYEE",
        action: "TEST",
        targetType: "COURSE",
        targetId: "crs_1",
        metadata: canonicalStringify(objA),
      });

      const hashB = computeRecordHash({
        uuid: "u1",
        prevHash: GENESIS_HASH,
        timestamp: "2026-10-25T12:00:00Z",
        actorId: "usr_1",
        actorRole: "EMPLOYEE",
        action: "TEST",
        targetType: "COURSE",
        targetId: "crs_1",
        metadata: canonicalStringify(objB),
      });

      assert.strictEqual(hashA, hashB, "Hash must be identical regardless of JSON key order");
    });

    it("6.2 Score distinctions: 0 vs null produce distinctly different cryptographic hashes", () => {
      const hashWithZero = computeRecordHash({
        uuid: "u1",
        prevHash: GENESIS_HASH,
        timestamp: "2026-10-25T12:00:00Z",
        actorId: "usr_1",
        actorRole: "EMPLOYEE",
        action: "TEST",
        targetType: "QUIZ",
        targetId: "q_1",
        score: 0,
      });

      const hashWithNull = computeRecordHash({
        uuid: "u1",
        prevHash: GENESIS_HASH,
        timestamp: "2026-10-25T12:00:00Z",
        actorId: "usr_1",
        actorRole: "EMPLOYEE",
        action: "TEST",
        targetType: "QUIZ",
        targetId: "q_1",
        score: null,
      });

      assert.notStrictEqual(hashWithZero, hashWithNull, "Score 0 must not collide with score null");
    });

    it("6.3 Cryptographic avalanche effect: single bit mutation alters all downstream hashes", () => {
      const baseRecords = Array.from({ length: 10 }, (_, i) => ({
        uuid: `uuid_${i}`,
        prevHash: GENESIS_HASH,
        timestamp: `2026-10-25T12:00:0${i}Z`,
        actorId: "usr_1",
        actorRole: "EMPLOYEE",
        action: `ACTION_${i}`,
        targetType: "COURSE",
        targetId: "crs_1",
      }));

      // Compute chain 1
      let prev1 = GENESIS_HASH;
      const chain1: string[] = [];
      for (const r of baseRecords) {
        const h = computeRecordHash({ ...r, prevHash: prev1 });
        chain1.push(h);
        prev1 = h;
      }

      // Mutate 1 character in record 0
      let prev2 = GENESIS_HASH;
      const chain2: string[] = [];
      for (let i = 0; i < baseRecords.length; i++) {
        const action = i === 0 ? "ACTION_TAMPERED" : baseRecords[i].action;
        const h = computeRecordHash({ ...baseRecords[i], action, prevHash: prev2 });
        chain2.push(h);
        prev2 = h;
      }

      assert.notStrictEqual(chain1[chain1.length - 1], chain2[chain2.length - 1]);
      // All 10 hashes must differ
      for (let i = 0; i < baseRecords.length; i++) {
        assert.notStrictEqual(chain1[i], chain2[i], `Hash at index ${i} must differ due to avalanche`);
      }
    });

    it("6.4 High-throughput ingestion stress: 200 consecutive records maintain unbroken chain", () => {
      const initialRes = verifyAuditLogIntegrity();
      const initialCount = initialRes.totalRecords;

      const startTime = Date.now();
      for (let i = 0; i < 200; i++) {
        recordAuditEvent({
          actorId: "usr_adv_user",
          actorRole: "EMPLOYEE",
          action: `STRESS_INGEST_${i}`,
          targetType: "STRESS",
          targetId: `stress_${i}`,
          score: i % 100,
          details: { iteration: i, payload: "a".repeat(64) },
        });
      }
      const durationMs = Date.now() - startTime;

      const finalRes = verifyAuditLogIntegrity();
      assert.strictEqual(finalRes.isValid, true);
      assert.strictEqual(finalRes.totalRecords, initialCount + 200);
      assert.ok(durationMs < 5000, `200 inserts took ${durationMs}ms, should be fast`);
    });
  });

  after(() => {
    delete process.env.LMS_DB_PATH;
    closeDb();
  });
});
