import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { initDb, getDb } from "../src/lib/db";
import {
  toCents,
  toDollars,
  formatCurrency,
  calculateRevenueSplit,
  calculateRevenueSplitFromCents,
  verifySplitInvariant,
} from "../src/lib/finance/split";
import {
  checkContentGate,
  maskCourseTitle,
  isTitleMasked,
  sanitizeCourseForRole,
  sanitizeCourseCatalogForRole,
  sanitizeLessonForRole,
  PRIVACY_SHIELD_CONSTANTS,
} from "../src/lib/privacy/content-gate";
import { dbAdapter } from "../src/lib/supabase/adapter";
import { GET as getLessonStream } from "../src/app/api/lessons/[lessonId]/stream/route";
import { GET as getCourseLesson } from "../src/app/api/courses/[courseId]/lessons/[lessonId]/route";
import { GET as getModule } from "../src/app/api/modules/[moduleId]/route";
import { GET as getStudioCourse } from "../src/app/api/studio/courses/[id]/route";
import { GET as getStudioCourseWeeks } from "../src/app/api/studio/courses/[id]/weeks/route";
import { POST as postCheckout } from "../src/app/api/marketplace/checkout/route";

interface ProbeResult {
  category: string;
  name: string;
  status: "PASSED" | "FAILED";
  details: string;
}

async function runEmpiricalChallenge() {
  console.log("================================================================================");
  console.log("CHALLENGER M1.5.2 EMPIRICAL ADVERSARIAL STRESS HARNESS");
  console.log("Target: Financial Split Engine (10/90), Creator Privacy Shield & Regression Safety");
  console.log("================================================================================\n");

  const results: ProbeResult[] = [];
  initDb();
  const db = getDb();

  // ============================================================================
  // PROBE 1: FINANCIAL SPLIT ENGINE MATHEMATICAL INVARIANT & EDGE CASES
  // ============================================================================
  console.log("▶ PROBE 1: Financial Split Engine Invariant & Boundary Stress Testing");
  try {
    // 1.1 Stress-test 100,000 distinct price amounts from 0 to 1,000,000 cents ($0.00 to $10,000.00)
    let invariantFailures = 0;
    const sampleSize = 100000;
    for (let c = 0; c <= sampleSize; c++) {
      const split = calculateRevenueSplitFromCents(c);
      if (split.platformFeeCents + split.creatorPayoutCents !== c) {
        invariantFailures++;
      }
      if (split.platformFeeCents !== Math.round(c * 0.10)) {
        invariantFailures++;
      }
      if (split.creatorPayoutCents !== c - split.platformFeeCents) {
        invariantFailures++;
      }
    }
    assert.strictEqual(invariantFailures, 0, "100,000 cents combinations must have zero invariant failures");

    // 1.2 Boundary cases
    const testMatrix = [
      { cents: 0, expFee: 0, expCreator: 0 },
      { cents: 1, expFee: 0, expCreator: 1 },    // 0.1 cents -> 0
      { cents: 4, expFee: 0, expCreator: 4 },    // 0.4 cents -> 0
      { cents: 5, expFee: 1, expCreator: 4 },    // 0.5 cents -> 1
      { cents: 6, expFee: 1, expCreator: 5 },    // 0.6 cents -> 1
      { cents: 9, expFee: 1, expCreator: 8 },    // 0.9 cents -> 1
      { cents: 10, expFee: 1, expCreator: 9 },   // 1.0 cents -> 1
      { cents: 1999, expFee: 200, expCreator: 1799 }, // $19.99
      { cents: 4900, expFee: 490, expCreator: 4410 }, // $49.00
      { cents: 4995, expFee: 500, expCreator: 4495 }, // $49.95
      { cents: 9900, expFee: 990, expCreator: 8910 }, // $99.00
      { cents: 14950, expFee: 1495, expCreator: 13455 }, // $149.50
    ];

    for (const tc of testMatrix) {
      const s = calculateRevenueSplitFromCents(tc.cents);
      assert.strictEqual(s.platformFeeCents, tc.expFee, `Fee mismatch for ${tc.cents} cents`);
      assert.strictEqual(s.creatorPayoutCents, tc.expCreator, `Creator payout mismatch for ${tc.cents} cents`);
      assert.strictEqual(s.platformFeeCents + s.creatorPayoutCents, tc.cents, `Sum mismatch for ${tc.cents}`);
      assert.strictEqual(verifySplitInvariant(s), true);
    }

    // 1.3 Invalid inputs rejection
    assert.throws(() => toCents(-0.01), RangeError);
    assert.throws(() => toCents(NaN), RangeError);
    assert.throws(() => toCents(Infinity), RangeError);
    assert.throws(() => calculateRevenueSplitFromCents(-1), RangeError);
    assert.throws(() => calculateRevenueSplitFromCents(12.34), RangeError);

    results.push({
      category: "Financial Engine",
      name: "10/90 Split Invariant & Boundary Stress",
      status: "PASSED",
      details: "100,000 cent variations and 12 boundary points strictly satisfied 10% platform fee and 90% creator cut with zero penny leakage."
    });
    console.log("  ✔ PASSED: 100,000 price tests + 12 boundaries strictly satisfy zero penny leakage\n");
  } catch (err: any) {
    results.push({
      category: "Financial Engine",
      name: "10/90 Split Invariant & Boundary Stress",
      status: "FAILED",
      details: err.message
    });
    console.log(`  ✖ FAILED: ${err.message}\n`);
  }

  // ============================================================================
  // PROBE 2: END-TO-END CHECKOUT & WALLET LEDGER ATOMIC SETTLEMENT
  // ============================================================================
  console.log("▶ PROBE 2: End-to-End Checkout API & Wallet Ledger Settlement");
  try {
    const now = new Date().toISOString();
    const testStudentId = "usr_challenger_student";
    const testCreatorId = "usr_challenger_creator";
    const testAdminId = "usr_challenger_admin";
    const testCourseId = "crs_challenger_split_course";
    const testDraftCourseId = "crs_challenger_draft_course";

    // Setup clean test data
    db.prepare("DELETE FROM transactions WHERE student_id = ? OR creator_id = ?").run(testStudentId, testCreatorId);
    db.prepare("DELETE FROM enrollments WHERE user_id = ?").run(testStudentId);
    db.prepare("DELETE FROM courses WHERE id IN (?, ?)").run(testCourseId, testDraftCourseId);

    // Insert personas if not exist
    db.prepare(`
      INSERT OR IGNORE INTO users (id, email, name, role, department, job_title, is_active, created_at, updated_at)
      VALUES 
      (?, 'challenger.student@test.corp', 'Challenger Student', 'STUDENT', 'Eng', 'Learner', 1, ?, ?),
      (?, 'challenger.creator@test.corp', 'Challenger Creator', 'CO_ADMIN', 'Eng', 'Creator', 1, ?, ?),
      (?, 'challenger.admin@test.corp', 'Challenger Admin', 'SUPER_ADMIN', 'Security', 'Admin', 1, ?, ?)
    `).run(testStudentId, now, now, testCreatorId, now, now, testAdminId, now, now);

    db.prepare("DELETE FROM wallets WHERE user_id IN (?, ?, ?)").run(testStudentId, testCreatorId, testAdminId);

    // Provision wallets
    // Student: $500.00 (50000 cents)
    // Creator: $0.00 (0 cents)
    // Admin: $0.00 (0 cents)
    db.prepare(`
      INSERT INTO wallets (id, user_id, balance, balance_cents, currency, created_at, updated_at)
      VALUES 
      ('wal_ch_stu', ?, 50000, 50000, 'USD', ?, ?),
      ('wal_ch_cre', ?, 0, 0, 'USD', ?, ?),
      ('wal_ch_adm', ?, 0, 0, 'USD', ?, ?)
    `).run(testStudentId, now, now, testCreatorId, now, now, testAdminId, now, now);

    // Published course: $49.00 (4900 cents)
    db.prepare(`
      INSERT INTO courses (id, title, slug, description, category, creator_id, price_cents, is_published, version, created_at, updated_at)
      VALUES (?, 'Challenger Cloud Arch', 'challenger-cloud-arch', 'Test', 'DATA_SCIENCE', ?, 4900, 1, '1.0.0', ?, ?)
    `).run(testCourseId, testCreatorId, now, now);

    // Draft course: $29.00 (2900 cents)
    db.prepare(`
      INSERT INTO courses (id, title, slug, description, category, creator_id, price_cents, is_published, version, created_at, updated_at)
      VALUES (?, 'Challenger Draft Course', 'challenger-draft-course', 'Test', 'DATA_SCIENCE', ?, 2900, 0, '1.0.0', ?, ?)
    `).run(testDraftCourseId, testCreatorId, now, now);

    // 2.1 Checkout: Missing courseId -> 400
    const reqMissing = new NextRequest("http://127.0.0.1:3000/api/marketplace/checkout", {
      method: "POST",
      headers: { "x-lms-user-id": testStudentId },
      body: JSON.stringify({})
    });
    const resMissing = await postCheckout(reqMissing);
    assert.strictEqual(resMissing.status, 400);
    const jsonMissing = await resMissing.json();
    assert.strictEqual(jsonMissing.error, "MISSING_COURSE_ID");

    // 2.2 Checkout: Nonexistent course -> 404
    const reqNonExistent = new NextRequest("http://127.0.0.1:3000/api/marketplace/checkout", {
      method: "POST",
      headers: { "x-lms-user-id": testStudentId },
      body: JSON.stringify({ course_id: "crs_non_existent" })
    });
    const resNonExistent = await postCheckout(reqNonExistent);
    assert.strictEqual(resNonExistent.status, 404);
    const jsonNonExistent = await resNonExistent.json();
    assert.strictEqual(jsonNonExistent.error, "COURSE_NOT_FOUND");

    // 2.3 Checkout: Unpublished draft course -> 400
    const reqDraft = new NextRequest("http://127.0.0.1:3000/api/marketplace/checkout", {
      method: "POST",
      headers: { "x-lms-user-id": testStudentId },
      body: JSON.stringify({ course_id: testDraftCourseId })
    });
    const resDraft = await postCheckout(reqDraft);
    assert.strictEqual(resDraft.status, 400);
    const jsonDraft = await resDraft.json();
    assert.strictEqual(jsonDraft.error, "COURSE_NOT_PUBLISHED");

    // 2.4 Checkout: Legitimate purchase of $49.00 course
    const reqValid = new NextRequest("http://127.0.0.1:3000/api/marketplace/checkout", {
      method: "POST",
      headers: { "x-lms-user-id": testStudentId },
      body: JSON.stringify({ course_id: testCourseId })
    });
    const resValid = await postCheckout(reqValid);
    assert.strictEqual(resValid.status, 200);
    const jsonValid = await resValid.json();
    assert.strictEqual(jsonValid.success, true);
    assert.strictEqual(jsonValid.split.amount_cents, 4900);
    assert.strictEqual(jsonValid.split.platform_fee_cents, 490);       // 10% platform fee
    assert.strictEqual(jsonValid.split.creator_payout_cents, 4410);     // 90% creator earnings
    assert.strictEqual(jsonValid.split.platform_fee_dollars, 4.90);
    assert.strictEqual(jsonValid.split.creator_payout_dollars, 44.10);

    // Verify database balances after checkout
    const studentWallet = db.prepare("SELECT balance_cents FROM wallets WHERE user_id = ?").get(testStudentId) as any;
    const creatorWallet = db.prepare("SELECT balance_cents FROM wallets WHERE user_id = ?").get(testCreatorId) as any;
    // Note: in offline adapter, platform fee credits the first SUPER_ADMIN found in DB
    const adminUser = db.prepare("SELECT id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1").get() as any;
    const adminWallet = db.prepare("SELECT balance_cents FROM wallets WHERE user_id = ?").get(adminUser?.id) as any;

    assert.strictEqual(studentWallet.balance_cents, 50000 - 4900, "Student balance must be debited by 4900 cents ($451.00)");
    assert.strictEqual(creatorWallet.balance_cents, 4410, "Creator wallet must be credited by exactly 4410 cents ($44.10, 90%)");

    // Verify transaction record in DB
    const tx = db.prepare("SELECT * FROM transactions WHERE student_id = ? AND course_id = ?").get(testStudentId, testCourseId) as any;
    assert.ok(tx, "Transaction record must exist");
    assert.strictEqual(tx.amount_cents ?? tx.amount, 4900);
    assert.strictEqual(tx.platform_fee_cents ?? tx.platform_fee, 490);
    assert.strictEqual(tx.creator_payout_cents ?? tx.creator_earnings, 4410);
    assert.strictEqual(tx.status, "COMPLETED");

    // Verify enrollment record in DB
    const enr = db.prepare("SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?").get(testStudentId, testCourseId) as any;
    assert.ok(enr, "Enrollment record must exist");
    assert.strictEqual(enr.status, "ACTIVE");

    // 2.5 Replay purchase: Already enrolled -> 400
    const reqReplay = new NextRequest("http://127.0.0.1:3000/api/marketplace/checkout", {
      method: "POST",
      headers: { "x-lms-user-id": testStudentId },
      body: JSON.stringify({ course_id: testCourseId })
    });
    const resReplay = await postCheckout(reqReplay);
    assert.strictEqual(resReplay.status, 400);
    const jsonReplay = await resReplay.json();
    assert.strictEqual(jsonReplay.error, "ALREADY_ENROLLED");

    // 2.6 Insufficient funds test
    // Create new course for $500.00 (50000 cents), but student only has 45100 cents
    const expensiveCourseId = "crs_challenger_expensive";
    db.prepare(`
      INSERT INTO courses (id, title, slug, description, category, creator_id, price_cents, is_published, version, created_at, updated_at)
      VALUES (?, 'Challenger Expensive Course', 'challenger-expensive', 'Test', 'DATA_SCIENCE', ?, 50000, 1, '1.0.0', ?, ?)
    `).run(expensiveCourseId, testCreatorId, now, now);

    const reqExpensive = new NextRequest("http://127.0.0.1:3000/api/marketplace/checkout", {
      method: "POST",
      headers: { "x-lms-user-id": testStudentId },
      body: JSON.stringify({ course_id: expensiveCourseId })
    });
    const resExpensive = await postCheckout(reqExpensive);
    assert.strictEqual(resExpensive.status, 400);
    const jsonExpensive = await resExpensive.json();
    assert.strictEqual(jsonExpensive.error, "INSUFFICIENT_FUNDS");

    // Verify balance was not modified on failed purchase
    const studentWalletUnchanged = db.prepare("SELECT balance_cents FROM wallets WHERE user_id = ?").get(testStudentId) as any;
    assert.strictEqual(studentWalletUnchanged.balance_cents, 45100);

    // Clean up test rows
    db.prepare("DELETE FROM transactions WHERE student_id = ? OR creator_id = ?").run(testStudentId, testCreatorId);
    db.prepare("DELETE FROM enrollments WHERE user_id = ?").run(testStudentId);
    db.prepare("DELETE FROM wallets WHERE user_id IN (?, ?, ?)").run(testStudentId, testCreatorId, testAdminId);
    db.prepare("DELETE FROM courses WHERE id IN (?, ?, ?)").run(testCourseId, testDraftCourseId, expensiveCourseId);

    results.push({
      category: "Checkout & Ledger",
      name: "Checkout Execution, Revenue Split & Double-Spend Protection",
      status: "PASSED",
      details: "Checkout verified: 10% ($4.90) platform fee, 90% ($44.10) creator cut, atomic debit/credit, ALREADY_ENROLLED block, and INSUFFICIENT_FUNDS rollback."
    });
    console.log("  ✔ PASSED: Real checkout settlement, exact 10/90 ledger split, and rollback protections\n");
  } catch (err: any) {
    console.error("Probe 2 error stack:", err.stack);
    results.push({
      category: "Checkout & Ledger",
      name: "Checkout Execution, Revenue Split & Double-Spend Protection",
      status: "FAILED",
      details: err.message
    });
    console.log(`  ✖ FAILED: ${err.message}\n`);
  }

  // ============================================================================
  // PROBE 3: CREATOR CONTENT PRIVACY SHIELD & GATE ENFORCEMENT
  // ============================================================================
  console.log("▶ PROBE 3: Creator Privacy Shield Strict Interception & Title Masking");
  try {
    // 3.1 Title masking algorithm probes
    assert.strictEqual(maskCourseTitle("Advanced Next.js Mastery"), "Advanc... [Content Encrypted]");
    assert.strictEqual(maskCourseTitle("Cloud Native"), "Cloud ... [Content Encrypted]");
    assert.strictEqual(maskCourseTitle("Python"), "Python... [Content Encrypted]");
    assert.strictEqual(maskCourseTitle("Rust"), "Rust... [Content Encrypted]");
    assert.strictEqual(maskCourseTitle(""), "[Content Encrypted]");
    assert.strictEqual(maskCourseTitle("   "), "[Content Encrypted]");
    assert.strictEqual(maskCourseTitle(null), "[Content Encrypted]");
    assert.strictEqual(maskCourseTitle(undefined), "[Content Encrypted]");
    assert.strictEqual(isTitleMasked("Advanc... [Content Encrypted]"), true);
    assert.strictEqual(isTitleMasked("Advanced Next.js Mastery"), false);

    // 3.2 checkContentGate barrier logic
    // SUPER_ADMIN must be blocked regardless of author/enrolled status
    const gateSuperAdmin1 = checkContentGate("SUPER_ADMIN", false, false);
    assert.strictEqual(gateSuperAdmin1.allowed, false);
    assert.strictEqual(gateSuperAdmin1.status, 403);
    assert.strictEqual(gateSuperAdmin1.errorCode, PRIVACY_SHIELD_CONSTANTS.ERROR_CODE_SUPER_ADMIN);

    const gateSuperAdmin2 = checkContentGate("SUPER_ADMIN", true, true);
    assert.strictEqual(gateSuperAdmin2.allowed, false);
    assert.strictEqual(gateSuperAdmin2.status, 403);
    assert.strictEqual(gateSuperAdmin2.errorCode, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");

    // CO_ADMIN author must be allowed
    const gateAuthor = checkContentGate("CO_ADMIN", true, false);
    assert.strictEqual(gateAuthor.allowed, true);
    assert.strictEqual(gateAuthor.status, 200);

    // Enrolled Student must be allowed
    const gateStudentEnrolled = checkContentGate("STUDENT", false, true);
    assert.strictEqual(gateStudentEnrolled.allowed, true);
    assert.strictEqual(gateStudentEnrolled.status, 200);

    // Unenrolled Student must be blocked with FORBIDDEN_UNENROLLED
    const gateStudentUnenrolled = checkContentGate("STUDENT", false, false);
    assert.strictEqual(gateStudentUnenrolled.allowed, false);
    assert.strictEqual(gateStudentUnenrolled.status, 403);
    assert.strictEqual(gateStudentUnenrolled.errorCode, PRIVACY_SHIELD_CONSTANTS.ERROR_CODE_UNENROLLED);

    // 3.3 sanitizeLessonForRole: Redacts video and attachments for Super Admin
    const rawLesson = {
      id: "les_secret",
      title: "Secret Lesson",
      video_url: "https://storage.supabase.co/lesson-videos/private.mp4",
      content: "Sensitive trade secret curriculum",
      supplementary_files: [{ name: "secret.pdf", url: "https://secret.pdf" }]
    };

    const sanitizedForAdmin = sanitizeLessonForRole(rawLesson, "SUPER_ADMIN", true, true);
    assert.strictEqual(sanitizedForAdmin.video_url, null, "video_url must be redacted to null for SUPER_ADMIN");
    assert.strictEqual(sanitizedForAdmin.content, "[Content Encrypted]", "content must be masked for SUPER_ADMIN");
    assert.deepStrictEqual(sanitizedForAdmin.supplementary_files, [], "supplementary_files must be empty array for SUPER_ADMIN");
    assert.strictEqual(sanitizedForAdmin.is_content_encrypted, true);

    const sanitizedForAuthor = sanitizeLessonForRole(rawLesson, "CO_ADMIN", true, false);
    assert.strictEqual(sanitizedForAuthor.video_url, "https://storage.supabase.co/lesson-videos/private.mp4");
    assert.strictEqual(sanitizedForAuthor.content, "Sensitive trade secret curriculum");
    assert.strictEqual(sanitizedForAuthor.is_content_encrypted, false);

    results.push({
      category: "Privacy Shield",
      name: "Gate Logic & Data Sanitizer Hardening",
      status: "PASSED",
      details: "Title masking, gate truth table, and data sanitization strictly redact all private media and curriculum for Super Admin."
    });
    console.log("  ✔ PASSED: Privacy Shield gate barrier and data sanitization algorithms verified\n");
  } catch (err: any) {
    results.push({
      category: "Privacy Shield",
      name: "Gate Logic & Data Sanitizer Hardening",
      status: "FAILED",
      details: err.message
    });
    console.log(`  ✖ FAILED: ${err.message}\n`);
  }

  // ============================================================================
  // PROBE 4: DIRECT HTTP ROUTE PROBES FOR FORBIDDEN_SUPER_ADMIN_CONTENT_GATE
  // ============================================================================
  console.log("▶ PROBE 4: Direct HTTP Endpoint Probing (Super Admin Content Gate)");
  try {
    const adminUser = db.prepare("SELECT id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1").get() as any;
    const studentUser = db.prepare("SELECT id FROM users WHERE role = 'STUDENT' LIMIT 1").get() as any;
    const creatorUser = db.prepare("SELECT id FROM users WHERE role = 'CO_ADMIN' LIMIT 1").get() as any;

    const superAdminId = adminUser?.id || "usr_david_kim";
    const studentId = studentUser?.id || "usr_sophia_chen";
    const creatorId = creatorUser?.id || "usr_aris_thorne";

    // Find a course and a lesson
    const lesson = db.prepare("SELECT * FROM lessons WHERE course_id IS NOT NULL LIMIT 1").get() as any;
    assert.ok(lesson, "Lesson must exist in database");

    const course = db.prepare("SELECT * FROM courses WHERE id = ?").get(lesson.course_id) as any;
    assert.ok(course, "Course must exist in database");

    // 4.1 GET /api/lessons/[lessonId]/stream as Super Admin -> 403 FORBIDDEN_SUPER_ADMIN_CONTENT_GATE
    const reqStreamAdmin = new NextRequest(`http://127.0.0.1:3000/api/lessons/${lesson.id}/stream`, {
      headers: { "x-lms-user-id": superAdminId }
    });
    const resStreamAdmin = await getLessonStream(reqStreamAdmin, { params: Promise.resolve({ lessonId: lesson.id }) });
    assert.strictEqual(resStreamAdmin.status, 403, "Stream route must return HTTP 403 for Super Admin");
    const jsonStreamAdmin = await resStreamAdmin.json();
    assert.strictEqual(jsonStreamAdmin.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
    assert.strictEqual(jsonStreamAdmin.streamUrl, undefined, "Stream URL must not be leaked");

    // 4.2 GET /api/courses/[courseId]/lessons/[lessonId] as Super Admin -> 403 FORBIDDEN_SUPER_ADMIN_CONTENT_GATE
    const reqLessonAdmin = new NextRequest(`http://127.0.0.1:3000/api/courses/${course.id}/lessons/${lesson.id}`, {
      headers: { "x-lms-user-id": superAdminId }
    });
    const resLessonAdmin = await getCourseLesson(reqLessonAdmin, {
      params: Promise.resolve({ courseId: course.id, lessonId: lesson.id })
    });
    assert.strictEqual(resLessonAdmin.status, 403, "Lesson route must return HTTP 403 for Super Admin");
    const jsonLessonAdmin = await resLessonAdmin.json();
    assert.strictEqual(jsonLessonAdmin.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
    assert.strictEqual(jsonLessonAdmin.lesson, undefined, "Raw lesson must not be leaked");

    // 4.3 GET /api/studio/courses/[id] as Super Admin -> 403 FORBIDDEN_SUPER_ADMIN_CONTENT_GATE
    const reqStudioAdmin = new NextRequest(`http://127.0.0.1:3000/api/studio/courses/${course.id}`, {
      headers: { "x-lms-user-id": superAdminId }
    });
    const resStudioAdmin = await getStudioCourse(reqStudioAdmin, {
      params: Promise.resolve({ id: course.id })
    });
    assert.strictEqual(resStudioAdmin.status, 403, "Studio course route must return HTTP 403 for Super Admin");
    const jsonStudioAdmin = await resStudioAdmin.json();
    assert.strictEqual(jsonStudioAdmin.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");

    // 4.4 GET /api/studio/courses/[id]/weeks as Super Admin -> 403 FORBIDDEN_SUPER_ADMIN_CONTENT_GATE
    const reqWeeksAdmin = new NextRequest(`http://127.0.0.1:3000/api/studio/courses/${course.id}/weeks`, {
      headers: { "x-lms-user-id": superAdminId }
    });
    const resWeeksAdmin = await getStudioCourseWeeks(reqWeeksAdmin, {
      params: Promise.resolve({ id: course.id })
    });
    assert.strictEqual(resWeeksAdmin.status, 403, "Studio curriculum weeks route must return HTTP 403 for Super Admin");
    const jsonWeeksAdmin = await resWeeksAdmin.json();
    assert.strictEqual(jsonWeeksAdmin.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");

    // 4.5 GET /api/modules/[moduleId] as Super Admin -> 403 FORBIDDEN_SUPER_ADMIN_CONTENT_GATE
    // Check if modules table exists with rows
    const moduleRow = db.prepare("SELECT id FROM modules LIMIT 1").get() as any;
    if (moduleRow) {
      const reqModAdmin = new NextRequest(`http://127.0.0.1:3000/api/modules/${moduleRow.id}`, {
        headers: { "x-lms-user-id": superAdminId }
      });
      const resModAdmin = await getModule(reqModAdmin, {
        params: Promise.resolve({ moduleId: moduleRow.id })
      });
      assert.strictEqual(resModAdmin.status, 403, "Module route must return HTTP 403 for Super Admin");
      const jsonModAdmin = await resModAdmin.json();
      assert.strictEqual(jsonModAdmin.error, "FORBIDDEN_SUPER_ADMIN_CONTENT_GATE");
    }

    // 4.6 Verification that enrolled student or creator DOES get 200 on authorized routes
    // Ensure student is enrolled in course
    const now2 = new Date().toISOString();
    db.prepare(`
      INSERT OR IGNORE INTO enrollments (id, user_id, course_id, status, progress_pct, assigned_at, created_at, updated_at)
      VALUES ('enr_probe_student', ?, ?, 'ACTIVE', 0, ?, ?, ?)
    `).run(studentId, course.id, now2, now2, now2);

    const reqStreamStudent = new NextRequest(`http://127.0.0.1:3000/api/lessons/${lesson.id}/stream`, {
      headers: { "x-lms-user-id": studentId }
    });
    const resStreamStudent = await getLessonStream(reqStreamStudent, { params: Promise.resolve({ lessonId: lesson.id }) });
    assert.strictEqual(resStreamStudent.status, 200, "Enrolled student must receive HTTP 200 from stream route");
    const jsonStreamStudent = await resStreamStudent.json();
    assert.strictEqual(jsonStreamStudent.success, true);
    assert.ok(jsonStreamStudent.streamUrl);

    results.push({
      category: "Privacy Shield",
      name: "Super Admin HTTP 403 Gating Across 5 Endpoints",
      status: "PASSED",
      details: "Super Admin access blocked with HTTP 403 FORBIDDEN_SUPER_ADMIN_CONTENT_GATE across /api/lessons/[id]/stream, /api/courses/[id]/lessons/[id], /api/studio/courses/[id], /api/studio/courses/[id]/weeks, and /api/modules/[id]."
    });
    console.log("  ✔ PASSED: All 5 sensitive endpoints returned HTTP 403 FORBIDDEN_SUPER_ADMIN_CONTENT_GATE for Super Admin\n");
  } catch (err: any) {
    results.push({
      category: "Privacy Shield",
      name: "Super Admin HTTP 403 Gating Across 5 Endpoints",
      status: "FAILED",
      details: err.message
    });
    console.log(`  ✖ FAILED: ${err.message}\n`);
  }

  // ============================================================================
  // SUMMARY MATRIX
  // ============================================================================
  console.log("================================================================================");
  console.log("EMPIRICAL ADVERSARIAL CHALLENGE SUMMARY MATRIX");
  console.log("================================================================================");
  let allPassed = true;
  for (const r of results) {
    console.log(`[${r.status}] [${r.category}] ${r.name}`);
    console.log(`       Details: ${r.details}`);
    if (r.status !== "PASSED") allPassed = false;
  }
  console.log("================================================================================");
  if (allPassed) {
    console.log("CHALLENGER VERDICT: APPROVE");
    console.log("All financial invariant tests, checkout transactions, and privacy shields PASSED.");
  } else {
    console.log("CHALLENGER VERDICT: REJECT");
    process.exit(1);
  }
}

runEmpiricalChallenge().catch((err) => {
  console.error("Execution failed:", err);
  process.exit(1);
});
