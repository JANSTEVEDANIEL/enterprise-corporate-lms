import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { SCHEMA_SQL } from "./schema";

let dbInstance: DatabaseSync | null = null;

export function getDbPath(): string {
  if (process.env.LMS_DB_PATH) {
    return process.env.LMS_DB_PATH;
  }
  return path.join(process.cwd(), ".data", "lms.db");
}

export function getDb(): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  dbInstance = new DatabaseSync(dbPath);
  dbInstance.exec("PRAGMA journal_mode = WAL;");
  dbInstance.exec("PRAGMA foreign_keys = ON;");
  dbInstance.exec("PRAGMA synchronous = NORMAL;");
  dbInstance.exec("PRAGMA busy_timeout = 5000;");

  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore
    }
    dbInstance = null;
  }
}

export function initDb(): void {
  const db = getDb();
  db.exec(SCHEMA_SQL);
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS prevent_audit_replace 
    BEFORE INSERT ON audit_logs 
    WHEN (SELECT 1 FROM audit_logs WHERE id = NEW.id OR uuid = NEW.uuid) IS NOT NULL
    BEGIN 
      SELECT RAISE(ABORT, 'Audit log records are immutable and cannot be replaced or overwritten'); 
    END;
  `);
}

// Re-export seedDb from seed.ts
export { seedDb } from "./seed";
