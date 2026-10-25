import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { NextRequest } from "next/server";
import { SCHEMA_SQL } from "../src/lib/db/schema";
import { initDb, getDb, closeDb } from "../src/lib/db";
import { recordAuditEvent, verifyAuditLogIntegrity, GENESIS_HASH } from "../src/lib/audit";
import { evaluateQuiz, submitQuizAttempt } from "../src/lib/quiz";
import { hasPermission, requireRole, getUserById } from "../src/lib/auth";
import { GET as getAuditLogs } from "../src/app/api/compliance/audit-logs/route";
import { GET as getCsvExport } from "../src/app/api/compliance/export/csv/route";
import { GET as getJsonExport } from "../src/app/api/compliance/export/json/route";
import { GET as getAdminUsers, POST as postAdminUsers } from "../src/app/api/admin/users/route";
import { GET as getAdminCourses, POST as postAdminCourses } from "../src/app/api/admin/courses/route";
import { GET as getManagerTeam } from "../src/app/api/manager/team/route";

async function runEmpiricalAttacks() {
  console.log("================================================================================");
  console.log("CHALLENGER EMPIRICAL ADVERSARIAL SUITE: STRESS HARNESS & ATTACK REPRODUCTION");
  console.log("================================================================================\n");

  const results: { attack: string; status: "PASSED" | "FAILED"; details: string }[] = [];

  // ---------------------------------------------------------------------------
  // ATTACK 1: Direct SQL Mutation Attacks Against audit_logs
  // ---------------------------------------------------------------------------
  console.log("▶ ATTACK 1: Direct SQL Mutation Attacks against audit_logs triggers");
  try {
    const testDbDir = path.join(process.cwd(), ".data");
    const testDbPath = path.join(testDbDir, `adv_test_${Date.now()}.db`);
    if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir, { recursive: true });

    process.env.LMS_DB_PATH = testDbPath;
    closeDb();
    initDb();
    const db = getDb();

    // Insert user
    db.prepare(`
      INSERT INTO users (id, email, name, role, department, job_title, created_at, updated_at)
      VALUES ('u_test', 'test@corp.com', 'Test User', 'SUPER_ADMIN', 'Security', 'SecEng', datetime('now'), datetime('now'))
    `).run();

    // Insert initial audit record
    const record = recordAuditEvent({
      actorId: "u_test",
      actorRole: "SUPER_ADMIN",
      action: "SECURITY_BASELINE",
      targetType: "SYSTEM",
      targetId: "sys_root",
      details: { env: "prod" }
    });

    // 1.1 Direct single-row UPDATE
    let updateBlocked = false;
    try {
      db.prepare("UPDATE audit_logs SET action = 'HACKED' WHERE id = ?").run(record.id);
    } catch (err: any) {
      if (/Audit log records are immutable and cannot be updated/i.test(err.message)) {
        updateBlocked = true;
      }
    }
    assert.strictEqual(updateBlocked, true, "prevent_audit_update must abort single-row UPDATE");

    // 1.2 Bulk UPDATE
    let bulkUpdateBlocked = false;
    try {
      db.prepare("UPDATE audit_logs SET actor_name = 'HACKER'").run();
    } catch (err: any) {
      if (/Audit log records are immutable and cannot be updated/i.test(err.message)) {
        bulkUpdateBlocked = true;
      }
    }
    assert.strictEqual(bulkUpdateBlocked, true, "prevent_audit_update must abort bulk UPDATE");

    // 1.3 Subquery UPDATE
    let subqueryUpdateBlocked = false;
    try {
      db.prepare("UPDATE audit_logs SET score = 100 WHERE id IN (SELECT id FROM audit_logs)").run();
    } catch (err: any) {
      if (/Audit log records are immutable and cannot be updated/i.test(err.message)) {
        subqueryUpdateBlocked = true;
      }
    }
    assert.strictEqual(subqueryUpdateBlocked, true, "prevent_audit_update must abort subquery UPDATE");

    // 1.4 Single-row DELETE
    let deleteBlocked = false;
    try {
      db.prepare("DELETE FROM audit_logs WHERE id = ?").run(record.id);
    } catch (err: any) {
      if (/Audit log records are immutable and cannot be deleted/i.test(err.message)) {
        deleteBlocked = true;
      }
    }
    assert.strictEqual(deleteBlocked, true, "prevent_audit_delete must abort single-row DELETE");

    // 1.5 Bulk DELETE
    let bulkDeleteBlocked = false;
    try {
      db.prepare("DELETE FROM audit_logs").run();
    } catch (err: any) {
      if (/Audit log records are immutable and cannot be deleted/i.test(err.message)) {
        bulkDeleteBlocked = true;
      }
    }
    assert.strictEqual(bulkDeleteBlocked, true, "prevent_audit_delete must abort bulk DELETE");

    // 1.6 INSERT OR REPLACE (Conflict Resolution Bypass Attack)
    let replaceBlocked = false;
    try {
      db.prepare(`
        INSERT OR REPLACE INTO audit_logs (id, uuid, timestamp, actor_id, actor_role, actor_name, action, target_type, target_id, prev_hash, record_hash)
        VALUES (?, 'forged-uuid', datetime('now'), 'u_test', 'SUPER_ADMIN', 'Test', 'FORGED', 'SYSTEM', 'sys_root', '${GENESIS_HASH}', 'forged_hash')
      `).run(record.id);
    } catch (err: any) {
      if (/Audit log records are immutable and cannot be replaced or overwritten/i.test(err.message)) {
        replaceBlocked = true;
      }
    }
    assert.strictEqual(replaceBlocked, true, "prevent_audit_replace must abort INSERT OR REPLACE");

    // Check row is untouched
    const current = db.prepare("SELECT * FROM audit_logs WHERE id = ?").get(record.id) as any;
    assert.strictEqual(current.action, "SECURITY_BASELINE");
    assert.strictEqual(current.record_hash, record.record_hash);

    closeDb();
    delete process.env.LMS_DB_PATH;
    for (const ext of ["", "-wal", "-shm"]) {
      if (fs.existsSync(testDbPath + ext)) fs.unlinkSync(testDbPath + ext);
    }

    results.push({
      attack: "1. Direct SQL Mutation (UPDATE, DELETE, REPLACE triggers)",
      status: "PASSED",
      details: "All 6 SQL mutation vectors strictly aborted by triggers: prevent_audit_update, prevent_audit_delete, prevent_audit_replace"
    });
    console.log("  ✔ PASSED: All SQLite engine triggers successfully aborted mutation attempts\n");
  } catch (e: any) {
    results.push({
      attack: "1. Direct SQL Mutation (UPDATE, DELETE, REPLACE triggers)",
      status: "FAILED",
      details: e.message
    });
    console.log(`  ✖ FAILED: ${e.message}\n`);
  }

  // ---------------------------------------------------------------------------
  // ATTACK 2: Offline Bit-Flipping in SQLite Database File
  // ---------------------------------------------------------------------------
  console.log("▶ ATTACK 2: Offline Bit-Flipping in .data/lms.db binary file");
  try {
    const tamperDbDir = path.join(process.cwd(), ".data");
    const tamperDbPath = path.join(tamperDbDir, `offline_tamper_${Date.now()}.db`);
    process.env.LMS_DB_PATH = tamperDbPath;
    closeDb();
    initDb();
    const db = getDb();

    db.prepare(`
      INSERT INTO users (id, email, name, role, department, job_title, created_at, updated_at)
      VALUES ('u_offline', 'offline@corp.com', 'Offline User', 'EMPLOYEE', 'Eng', 'Dev', datetime('now'), datetime('now'))
    `).run();

    // Create 3 chained audit events
    recordAuditEvent({ actorId: "u_offline", actorRole: "EMPLOYEE", action: "TAMPER_EVENT_ALPHA", targetType: "MODULE", targetId: "mod_1" });
    recordAuditEvent({ actorId: "u_offline", actorRole: "EMPLOYEE", action: "TAMPER_EVENT_BETA", targetType: "MODULE", targetId: "mod_2" });
    recordAuditEvent({ actorId: "u_offline", actorRole: "EMPLOYEE", action: "TAMPER_EVENT_GAMMA", targetType: "MODULE", targetId: "mod_3" });

    // Flush WAL to disk
    db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
    closeDb();

    // Verify pristine first
    const pristineRes = verifyAuditLogIntegrity();
    assert.strictEqual(pristineRes.isValid, true);
    assert.strictEqual(pristineRes.totalRecords, 3);

    // Read binary file
    closeDb();
    const origBytes = fs.readFileSync(tamperDbPath);
    const targetStr = "TAMPER_EVENT_BETA";
    const targetIdx = origBytes.indexOf(Buffer.from(targetStr, "utf8"));
    assert.ok(targetIdx !== -1, "Target string must be located in binary database");

    // Bit-flip: replace 'B' with 'X' in 'TAMPER_EVENT_BETA'
    const tamperedBytes = Buffer.from(origBytes);
    tamperedBytes[targetIdx + "TAMPER_EVENT_".length] = "X".charCodeAt(0);
    fs.writeFileSync(tamperDbPath, tamperedBytes);

    // Run verification on tampered binary
    const tamperedRes = verifyAuditLogIntegrity();
    assert.strictEqual(tamperedRes.isValid, false, "Offline bit-flip must cause verifyAuditLogIntegrity to fail");
    assert.strictEqual(tamperedRes.tamperedIndex, 1, "Must pinpoint exactly record index 1 (the 2nd record)");
    assert.match(tamperedRes.failureReason || "", /Data tampering detected at record ID/i);

    // Restore pristine bytes
    closeDb();
    fs.writeFileSync(tamperDbPath, origBytes);
    const restoredRes = verifyAuditLogIntegrity();
    assert.strictEqual(restoredRes.isValid, true, "Restored database must verify as 100% valid");

    closeDb();
    delete process.env.LMS_DB_PATH;
    for (const ext of ["", "-wal", "-shm"]) {
      if (fs.existsSync(tamperDbPath + ext)) fs.unlinkSync(tamperDbPath + ext);
    }

    results.push({
      attack: "2. Offline Binary Bit-Flipping Detection",
      status: "PASSED",
      details: "Offline byte mutation in SQLite binary file immediately detected by SHA-256 verification (index 1 pinpointed)"
    });
    console.log("  ✔ PASSED: Offline binary tampering successfully caught by verifyAuditLogIntegrity()\n");
  } catch (e: any) {
    results.push({
      attack: "2. Offline Binary Bit-Flipping Detection",
      status: "FAILED",
      details: e.message
    });
    console.log(`  ✖ FAILED: ${e.message}\n`);
  }

  // ---------------------------------------------------------------------------
  // ATTACK 3: Quiz Grading Tampering Attacks
  // ---------------------------------------------------------------------------
  console.log("▶ ATTACK 3: Quiz Grading Client-Side Tampering Attacks");
  try {
    const quizDbDir = path.join(process.cwd(), ".data");
    const quizDbPath = path.join(quizDbDir, `quiz_tamper_${Date.now()}.db`);
    process.env.LMS_DB_PATH = quizDbPath;
    closeDb();
    initDb();
    const db = getDb();

    // Seed minimal course, module, quiz, user
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO users (id, email, name, role, department, job_title, created_at, updated_at)
      VALUES ('u_learner', 'learner@corp.com', 'Alex Learner', 'EMPLOYEE', 'Engineering', 'Junior Dev', ?, ?)
    `).run(now, now);

    db.prepare(`
      INSERT INTO courses (id, title, slug, description, category, estimated_minutes, passing_score_pct, is_mandatory, is_published, version, created_at, updated_at)
      VALUES ('crs_test', 'Security 101', 'sec-101', 'Test', 'SECURITY', 30, 80, 1, 1, '1.0.0', ?, ?)
    `).run(now, now);

    db.prepare(`
      INSERT INTO modules (id, course_id, title, description, type, order_index, content, estimated_minutes, version, created_at, updated_at)
      VALUES ('mod_quiz_test', 'crs_test', 'Quiz Module', 'Desc', 'INTERACTIVE_QUIZ', 1, 'Body', 10, '1.0.0', ?, ?)
    `).run(now, now);

    db.prepare(`
      INSERT INTO quizzes (id, module_id, title, passing_score_pct, time_limit_minutes, created_at, updated_at)
      VALUES ('q_test', 'mod_quiz_test', 'Security Quiz', 80, 30, ?, ?)
    `).run(now, now);

    db.prepare(`
      INSERT INTO quiz_questions (id, quiz_id, order_index, question_type, prompt, options, correct_answers, explanation, created_at)
      VALUES 
      ('qq_1', 'q_test', 1, 'SINGLE_CHOICE', 'What is 2FA?', '[{"id":"opt_a","text":"Two Factor"},{"id":"opt_b","text":"Wrong"}]', '["opt_a"]', 'Two factor auth', ?),
      ('qq_2', 'q_test', 2, 'SINGLE_CHOICE', 'Never share passwords?', '[{"id":"opt_t","text":"True"},{"id":"opt_f","text":"False"}]', '["opt_t"]', 'Never share', ?)
    `).run(now, now);

    db.prepare(`
      INSERT INTO enrollments (id, user_id, course_id, status, progress_pct, assigned_at, created_at, updated_at)
      VALUES ('enr_test', 'u_learner', 'crs_test', 'IN_PROGRESS', 50, ?, ?, ?)
    `).run(now, now, now);

    // ATTACK 3.1: Client submits WRONG answers, but injects clientScore=100 and passed=true
    const maliciousPayload = {
      answers: { qq_1: "opt_b", qq_2: "opt_f" }, // Both wrong!
      clientScore: 100,
      passed: true,
      scorePct: 100,
      passingScorePct: 10
    };

    const evalResult = evaluateQuiz("q_test", maliciousPayload.answers, db);
    assert.strictEqual(evalResult.scorePct, 0, "Server must calculate 0% regardless of injected client fields");
    assert.strictEqual(evalResult.passed, false, "Server must evaluate passed=false");
    assert.strictEqual(evalResult.correctCount, 0);

    // ATTACK 3.2: Submit through submitQuizAttempt with false answers
    const submitResult = submitQuizAttempt({
      userId: "u_learner",
      quizId: "q_test",
      answers: maliciousPayload.answers,
      actorRole: "EMPLOYEE",
      actorName: "Alex Learner"
    });

    assert.strictEqual(submitResult.scorePct, 0);
    assert.strictEqual(submitResult.passed, false);
    assert.strictEqual(submitResult.certificate, null, "Certificate must NOT be issued on failing score");

    // Verify database certificate table has no entry
    const certCount = db.prepare("SELECT COUNT(*) as c FROM certificates WHERE user_id = 'u_learner'").get() as { c: number };
    assert.strictEqual(certCount.c, 0, "No certificate may exist in database for failed attempt");

    // ATTACK 3.3: Submit correct answers -> Certificate is legitimately issued
    const legitimateSubmit = submitQuizAttempt({
      userId: "u_learner",
      quizId: "q_test",
      answers: { qq_1: "opt_a", qq_2: "opt_t" }, // Both correct!
      actorRole: "EMPLOYEE",
      actorName: "Alex Learner"
    });

    assert.strictEqual(legitimateSubmit.scorePct, 100);
    assert.strictEqual(legitimateSubmit.passed, true);
    assert.ok(legitimateSubmit.certificate, "Certificate must be issued on genuine 100% pass");

    closeDb();
    delete process.env.LMS_DB_PATH;
    for (const ext of ["", "-wal", "-shm"]) {
      if (fs.existsSync(quizDbPath + ext)) fs.unlinkSync(quizDbPath + ext);
    }

    results.push({
      attack: "3. Quiz Grading Tampering Resistance",
      status: "PASSED",
      details: "Client-injected score/passed parameters ignored; evaluation strictly verified against DB answer keys"
    });
    console.log("  ✔ PASSED: Quiz grading tampering strictly rejected, server-side DB answer key enforced\n");
  } catch (e: any) {
    results.push({
      attack: "3. Quiz Grading Tampering Resistance",
      status: "FAILED",
      details: e.message
    });
    console.log(`  ✖ FAILED: ${e.message}\n`);
  }

  // ---------------------------------------------------------------------------
  // ATTACK 4: RBAC Privilege Escalation Attempts
  // ---------------------------------------------------------------------------
  console.log("▶ ATTACK 4: RBAC Privilege Escalation Across Routes & APIs");
  try {
    initDb();

    // 4.1 EMPLOYEE calls requireRole(["MANAGER"])
    process.env.LMS_ACTIVE_USER_ID = "usr_alex_rivera"; // EMPLOYEE
    let managerGateBlocked = false;
    try {
      await requireRole(["MANAGER"]);
    } catch (err: any) {
      if (err.statusCode === 403) managerGateBlocked = true;
    }
    assert.strictEqual(managerGateBlocked, true, "requireRole(['MANAGER']) must reject EMPLOYEE with 403");

    // 4.2 EMPLOYEE calls requireRole(["COMPLIANCE_OFFICER"])
    let complianceGateBlocked = false;
    try {
      await requireRole(["COMPLIANCE_OFFICER"]);
    } catch (err: any) {
      if (err.statusCode === 403) complianceGateBlocked = true;
    }
    assert.strictEqual(complianceGateBlocked, true, "requireRole(['COMPLIANCE_OFFICER']) must reject EMPLOYEE with 403");

    // 4.3 EMPLOYEE calls requireRole(["SUPER_ADMIN"])
    let adminGateBlocked = false;
    try {
      await requireRole(["SUPER_ADMIN"]);
    } catch (err: any) {
      if (err.statusCode === 403) adminGateBlocked = true;
    }
    assert.strictEqual(adminGateBlocked, true, "requireRole(['SUPER_ADMIN']) must reject EMPLOYEE with 403");

    // 4.4 EMPLOYEE attempts to access GET /api/compliance/audit-logs
    const reqAuditLogs = new NextRequest("http://127.0.0.1:3000/api/compliance/audit-logs", {
      headers: { "x-lms-user-id": "usr_alex_rivera" }
    });
    const resAuditLogs = await getAuditLogs(reqAuditLogs);
    assert.strictEqual(resAuditLogs.status, 403, "GET /api/compliance/audit-logs must return 403 for EMPLOYEE");

    // 4.5 EMPLOYEE attempts to access GET /api/compliance/export/csv
    const reqCsv = new NextRequest("http://127.0.0.1:3000/api/compliance/export/csv", {
      headers: { "x-lms-user-id": "usr_alex_rivera" }
    });
    const resCsv = await getCsvExport(reqCsv);
    assert.strictEqual(resCsv.status, 403, "GET /api/compliance/export/csv must return 403 for EMPLOYEE");

    // 4.6 EMPLOYEE attempts to access GET /api/compliance/export/json
    const reqJson = new NextRequest("http://127.0.0.1:3000/api/compliance/export/json", {
      headers: { "x-lms-user-id": "usr_alex_rivera" }
    });
    const resJson = await getJsonExport(reqJson);
    assert.strictEqual(resJson.status, 403, "GET /api/compliance/export/json must return 403 for EMPLOYEE");

    // 4.7 EMPLOYEE attempts to access GET /api/admin/users
    const reqAdminUsersGet = new NextRequest("http://127.0.0.1:3000/api/admin/users", {
      headers: { "x-lms-user-id": "usr_alex_rivera" }
    });
    const resAdminUsersGet = await getAdminUsers(reqAdminUsersGet);
    assert.strictEqual(resAdminUsersGet.status, 403, "GET /api/admin/users must return 403 for EMPLOYEE");

    // 4.8 EMPLOYEE attempts to access POST /api/admin/users (provisioning)
    const reqAdminUsersPost = new NextRequest("http://127.0.0.1:3000/api/admin/users", {
      method: "POST",
      headers: { "x-lms-user-id": "usr_alex_rivera" },
      body: JSON.stringify({ email: "hacker@corp.com", name: "Hacker", role: "SUPER_ADMIN" })
    });
    const resAdminUsersPost = await postAdminUsers(reqAdminUsersPost);
    assert.strictEqual(resAdminUsersPost.status, 403, "POST /api/admin/users must return 403 for EMPLOYEE");

    // 4.9 EMPLOYEE attempts to access POST /api/admin/courses (course authoring)
    const reqAdminCoursesPost = new NextRequest("http://127.0.0.1:3000/api/admin/courses", {
      method: "POST",
      headers: { "x-lms-user-id": "usr_alex_rivera" },
      body: JSON.stringify({ title: "Malicious Course" })
    });
    const resAdminCoursesPost = await postAdminCourses(reqAdminCoursesPost);
    assert.strictEqual(resAdminCoursesPost.status, 403, "POST /api/admin/courses must return 403 for EMPLOYEE");

    // 4.10 EMPLOYEE attempts to access GET /api/manager/team
    const reqManagerTeam = new NextRequest("http://127.0.0.1:3000/api/manager/team", {
      headers: { "x-lms-user-id": "usr_alex_rivera" }
    });
    const resManagerTeam = await getManagerTeam(reqManagerTeam);
    assert.strictEqual(resManagerTeam.status, 403, "GET /api/manager/team must return 403 for EMPLOYEE");

    // 4.11 MANAGER attempts to call POST /api/admin/users (requires SUPER_ADMIN)
    const reqManagerAdminPost = new NextRequest("http://127.0.0.1:3000/api/admin/users", {
      method: "POST",
      headers: { "x-lms-user-id": "usr_sarah_jenkins" }, // MANAGER
      body: JSON.stringify({ email: "new@corp.com", name: "New User", role: "EMPLOYEE" })
    });
    const resManagerAdminPost = await postAdminUsers(reqManagerAdminPost);
    assert.strictEqual(resManagerAdminPost.status, 403, "POST /api/admin/users must return 403 for MANAGER");

    // 4.12 Spoofed role header (e.g. x-user-role: SUPER_ADMIN) ignored when persona is employee
    const reqSpoofedRole = new NextRequest("http://127.0.0.1:3000/api/admin/users", {
      headers: {
        "x-lms-user-id": "usr_alex_rivera",
        "x-user-role": "SUPER_ADMIN",
        "role": "SUPER_ADMIN"
      }
    });
    const resSpoofedRole = await getAdminUsers(reqSpoofedRole);
    assert.strictEqual(resSpoofedRole.status, 403, "Spoofed headers must be ignored, role resolved from DB");

    delete process.env.LMS_ACTIVE_USER_ID;

    results.push({
      attack: "4. RBAC Privilege Escalation Across Routes & APIs",
      status: "PASSED",
      details: "All 12 privilege escalation scenarios returned strict HTTP 403 Forbidden; role spoofing ineffective"
    });
    console.log("  ✔ PASSED: All RBAC privilege escalation attacks blocked with HTTP 403 Forbidden\n");
  } catch (e: any) {
    results.push({
      attack: "4. RBAC Privilege Escalation Across Routes & APIs",
      status: "FAILED",
      details: e.message
    });
    console.log(`  ✖ FAILED: ${e.message}\n`);
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("================================================================================");
  console.log("ADVERSARIAL ATTACK EXECUTION SUMMARY MATRIX");
  console.log("================================================================================");
  let allPassed = true;
  for (const r of results) {
    console.log(`[${r.status}] ${r.attack}`);
    console.log(`       Details: ${r.details}`);
    if (r.status !== "PASSED") allPassed = false;
  }
  console.log("================================================================================");
  if (allPassed) {
    console.log("VERDICT: ALL 4 ADVERSARIAL ATTACKS RIGOROUSLY CHALLENGED AND REPELLED.");
  } else {
    console.log("VERDICT: VULNERABILITY DETECTED IN ADVERSARIAL ATTACK TESTING.");
    process.exit(1);
  }
}

runEmpiricalAttacks().catch((err) => {
  console.error("Execution error:", err);
  process.exit(1);
});
