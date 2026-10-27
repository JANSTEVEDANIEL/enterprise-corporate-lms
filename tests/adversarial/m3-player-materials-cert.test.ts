import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { initDb, getDb } from "../../src/lib/db";
import { dbAdapter } from "../../src/lib/supabase/adapter";
import {
  computeCertificateHash,
  generateCertificate,
  verifyCertificate,
  getCertificateByIdOrCode,
} from "../../src/lib/certificates";
import { POST as updateCourseProgress } from "../../src/app/api/courses/[courseId]/progress/route";
import {
  POST as mintCourseCertificate,
  GET as getCourseCertificate,
} from "../../src/app/api/courses/[courseId]/certificate/route";
import {
  categorizeLessonMaterials,
  formatFileSize,
} from "../../src/components/player/student-lesson-player";
import {
  PLAYBACK_SPEEDS,
  type PlaybackSpeed,
} from "../../src/components/player/video-player-controls";
import type { FileAttachment } from "../../src/types/marketplace";

describe("Milestone 3 Adversarial Suite: Materials Categorization, Playback Speeds, Auto-Completion & Certification", () => {
  const testStudentId = "usr_adv_m3_learner";
  const testCourseId = "crs_adv_m3_flow";
  const testLesson1Id = "les_adv_m3_01";
  const testLesson2Id = "les_adv_m3_02";

  before(() => {
    initDb();
    const db = getDb();
    const now = new Date().toISOString();

    // 1. Seed dedicated student
    db.prepare(`
      INSERT OR REPLACE INTO users (id, email, name, role, department, job_title, is_active, created_at, updated_at)
      VALUES (?, ?, ?, 'STUDENT', 'Engineering', 'QA Engineer', 1, ?, ?)
    `).run(
      testStudentId,
      "adv.learner@enterprise.test",
      "Adversarial Learner",
      now,
      now
    );

    // 2. Seed dedicated test course with 2 lessons
    db.prepare(`
      INSERT OR REPLACE INTO courses (
        id, slug, title, description, category, target_role, is_mandatory,
        estimated_minutes, renewal_period_days, passing_score_pct, version,
        is_published, creator_id, created_at, updated_at
      ) VALUES (
        ?, 'adv-m3-course-slug', 'Adversarial M3 Verification Course',
        'Course for verifying player materials, speed bounds and cert minting',
        'SOFTWARE', 'ALL', 0, 90, 0, 80, '1.0.0', 1, 'usr_aris_thorne', ?, ?
      )
    `).run(testCourseId, now, now);

    // 3. Seed week
    db.prepare(`
      INSERT OR REPLACE INTO weeks (id, course_id, week_number, title, description, created_at, updated_at)
      VALUES ('wk_adv_m3_01', ?, 1, 'Week 1: Core Mechanics', 'Testing materials and video player', ?, ?)
    `).run(testCourseId, now, now);

    // 4. Seed 2 lessons
    db.prepare(`
      INSERT OR REPLACE INTO lessons (
        id, week_id, course_id, title, order_index, duration_seconds,
        video_url, supplementary_files, is_preview, created_at, updated_at
      ) VALUES (?, 'wk_adv_m3_01', ?, ?, ?, 1200, 'https://storage.test/video.mp4', '[]', 0, ?, ?)
    `).run(testLesson1Id, testCourseId, "Lesson 1: Foundations", 1, now, now);

    db.prepare(`
      INSERT OR REPLACE INTO lessons (
        id, week_id, course_id, title, order_index, duration_seconds,
        video_url, supplementary_files, is_preview, created_at, updated_at
      ) VALUES (?, 'wk_adv_m3_01', ?, ?, ?, 1200, 'https://storage.test/video2.mp4', '[]', 0, ?, ?)
    `).run(testLesson2Id, testCourseId, "Lesson 2: Advanced Verification", 2, now, now);

    // 5. Enroll student
    db.prepare(`
      INSERT OR REPLACE INTO enrollments (
        id, user_id, course_id, status, progress_pct, created_at, updated_at
      ) VALUES ('enr_adv_m3_learner', ?, ?, 'IN_PROGRESS', 0, ?, ?)
    `).run(testStudentId, testCourseId, now, now);

    // Ensure clean progress and certificate slate for this test pair
    db.prepare("DELETE FROM lesson_progress WHERE user_id = ? AND course_id = ?").run(
      testStudentId,
      testCourseId
    );
    db.prepare("DELETE FROM certificates WHERE user_id = ? AND course_id = ?").run(
      testStudentId,
      testCourseId
    );
  });

  // ==========================================================================
  // SUITE 1: Materials Categorization Stress Testing (categorizeLessonMaterials)
  // ==========================================================================
  describe("1. Materials Categorization Adversarial Stress Tests", () => {
    it("1.1 Accurately routes diverse extensions (.pdf, .pptx, .zip, .sql, .docx, unknown)", () => {
      const sampleFiles: any[] = [
        // Slide decks (.pptx, .ppt, or .pdf with slide/presentation/deck in name)
        { name: "Week_1_Lecture_Slides.pptx", file_size_bytes: 5242880, file_type: "PPTX", url: "/f1.pptx" },
        { name: "Legacy_Presentation.ppt", file_size_bytes: 2097152, file_type: "PPT", url: "/f2.ppt" },
        { name: "Microservices_Architecture_Slide_Deck.pdf", file_size_bytes: 3145728, file_type: "PDF", url: "/f3.pdf" },
        { name: "Keynote_Presentation_Overview.pdf", file_size_bytes: 4194304, file_type: "PDF", url: "/f4.pdf" },

        // Starter code and project ZIPs (.zip, .tar.gz, .sql, .json, .yaml, .yml)
        { name: "Distributed_Consensus_Lab_Starter.zip", file_size_bytes: 10485760, file_type: "ZIP", url: "/f5.zip" },
        { name: "Kubernetes_Manifests.tar.gz", file_size_bytes: 1572864, file_type: "TAR.GZ", url: "/f6.tar.gz" },
        { name: "Marketplace_Schema_Migration.sql", file_size_bytes: 131072, file_type: "SQL", url: "/f7.sql" },
        { name: "Kafka_Event_Fixtures.json", file_size_bytes: 65536, file_type: "JSON", url: "/f8.json" },
        { name: "Docker_Compose_Environment.yaml", file_size_bytes: 32768, file_type: "YAML", url: "/f9.yaml" },
        { name: "Service_Mesh_Config.yml", file_size_bytes: 16384, file_type: "YML", url: "/f10.yml" },

        // Reference guides (.pdf without slide keywords, .docx, .doc, unknown)
        { name: "Domain_Driven_Design_CheatSheet.pdf", file_size_bytes: 819200, file_type: "PDF", url: "/f11.pdf" },
        { name: "Production_Readiness_Runbook.docx", file_size_bytes: 524288, file_type: "DOCX", url: "/f12.docx" },
        { name: "Security_Hardening_Standard.doc", file_size_bytes: 262144, file_type: "DOC", url: "/f13.doc" },
        { name: "Telemetry_Data_Schema.parquet", file_size_bytes: 4194304, file_type: "PARQUET", url: "/f14.parquet" },
        { name: "Binary_Machine_Weights.bin", file_size_bytes: 8388608, file_type: "BIN", url: "/f15.bin" },
        { name: "Unrecognized_Custom_Script.unknown", file_size_bytes: 1024, file_type: "UNKNOWN", url: "/f16.unknown" },
        { name: "Dockerfile_Standalone", file_size_bytes: 2048, file_type: "RAW", url: "/f17" },
      ];

      const categorized = categorizeLessonMaterials(sampleFiles as FileAttachment[]);

      // Verify Slide Decks
      assert.strictEqual(categorized.slideDecks.length, 4);
      assert.ok(categorized.slideDecks.some((f) => f.name === "Week_1_Lecture_Slides.pptx"));
      assert.ok(categorized.slideDecks.some((f) => f.name === "Legacy_Presentation.ppt"));
      assert.ok(categorized.slideDecks.some((f) => f.name === "Microservices_Architecture_Slide_Deck.pdf"));
      assert.ok(categorized.slideDecks.some((f) => f.name === "Keynote_Presentation_Overview.pdf"));

      // Verify Starter Codes
      assert.strictEqual(categorized.starterCodes.length, 6);
      assert.ok(categorized.starterCodes.some((f) => f.name === "Distributed_Consensus_Lab_Starter.zip"));
      assert.ok(categorized.starterCodes.some((f) => f.name === "Kubernetes_Manifests.tar.gz"));
      assert.ok(categorized.starterCodes.some((f) => f.name === "Marketplace_Schema_Migration.sql"));
      assert.ok(categorized.starterCodes.some((f) => f.name === "Kafka_Event_Fixtures.json"));
      assert.ok(categorized.starterCodes.some((f) => f.name === "Docker_Compose_Environment.yaml"));
      assert.ok(categorized.starterCodes.some((f) => f.name === "Service_Mesh_Config.yml"));

      // Verify Reference Guides
      assert.strictEqual(categorized.referenceGuides.length, 7);
      assert.ok(categorized.referenceGuides.some((f) => f.name === "Domain_Driven_Design_CheatSheet.pdf"));
      assert.ok(categorized.referenceGuides.some((f) => f.name === "Production_Readiness_Runbook.docx"));
      assert.ok(categorized.referenceGuides.some((f) => f.name === "Security_Hardening_Standard.doc"));
      assert.ok(categorized.referenceGuides.some((f) => f.name === "Telemetry_Data_Schema.parquet"));
      assert.ok(categorized.referenceGuides.some((f) => f.name === "Binary_Machine_Weights.bin"));
      assert.ok(categorized.referenceGuides.some((f) => f.name === "Unrecognized_Custom_Script.unknown"));
      assert.ok(categorized.referenceGuides.some((f) => f.name === "Dockerfile_Standalone"));

      // Invariant: exact partitioning
      const totalCount =
        categorized.slideDecks.length +
        categorized.starterCodes.length +
        categorized.referenceGuides.length;
      assert.strictEqual(totalCount, sampleFiles.length);
    });

    it("1.2 Supports case-insensitivity across uppercase and mixed-case file names and extensions", () => {
      const mixedCaseFiles: any[] = [
        { name: "SLIDES_SUMMARY.PPTX", file_type: "pptx" },
        { name: "ARCH_DECK_FINAL.PDF", file_type: "pdf" },
        { name: "STARTER_REPO.ZIP", file_type: "zip" },
        { name: "DB_INIT.SQL", file_type: "sql" },
        { name: "LAB_MANUAL.DOCX", file_type: "docx" },
        { name: "CheatSheet_Reference.Pdf", file_type: "Pdf" },
      ];

      const res = categorizeLessonMaterials(mixedCaseFiles as FileAttachment[]);
      assert.strictEqual(res.slideDecks.length, 2);
      assert.strictEqual(res.starterCodes.length, 2);
      assert.strictEqual(res.referenceGuides.length, 2);
    });

    it("1.3 Handles empty, malformed, and missing properties without throwing uncaught exceptions", () => {
      assert.doesNotThrow(() => {
        const resEmpty = categorizeLessonMaterials([]);
        assert.deepStrictEqual(resEmpty, { slideDecks: [], referenceGuides: [], starterCodes: [] });
      });

      assert.doesNotThrow(() => {
        const resUndefined = categorizeLessonMaterials(undefined);
        assert.deepStrictEqual(resUndefined, { slideDecks: [], referenceGuides: [], starterCodes: [] });
      });

      assert.doesNotThrow(() => {
        const malformedFiles: any[] = [
          {},
          { name: "" },
          { name: undefined, file_type: undefined },
          { name: null, file_type: null },
          { file_type: "PPTX" },
          { file_type: "ZIP" },
          { file_type: "CODE" },
        ];
        const res = categorizeLessonMaterials(malformedFiles);
        // { file_type: "PPTX" } -> slideDecks
        // { file_type: "ZIP" } and { file_type: "CODE" } -> starterCodes
        // others -> referenceGuides
        assert.strictEqual(res.slideDecks.length, 1);
        assert.strictEqual(res.starterCodes.length, 2);
        assert.strictEqual(res.referenceGuides.length, 4);
      });
    });

    it("1.4 formatFileSize accurately formats bytes across KB, MB, 0, and negative boundaries", () => {
      assert.strictEqual(formatFileSize(undefined), "Download Ready");
      assert.strictEqual(formatFileSize(0), "Download Ready");
      assert.strictEqual(formatFileSize(-500), "Download Ready");
      assert.strictEqual(formatFileSize(512), "1 KB");
      assert.strictEqual(formatFileSize(1024), "1 KB");
      assert.strictEqual(formatFileSize(2048), "2 KB");
      assert.strictEqual(formatFileSize(512000), "500 KB");
      assert.strictEqual(formatFileSize(1048576), "1.0 MB");
      assert.strictEqual(formatFileSize(2621440), "2.5 MB");
      assert.strictEqual(formatFileSize(104857600), "100.0 MB");
    });
  });

  // ==========================================================================
  // SUITE 2: Playback Speed Array Bounds and Cycling Logic
  // ==========================================================================
  describe("2. Playback Speed Array Bounds & Cycling Mechanics", () => {
    it("2.1 PLAYBACK_SPEEDS has exact rate options [0.75, 1, 1.25, 1.5, 2]", () => {
      assert.strictEqual(PLAYBACK_SPEEDS.length, 5);
      assert.deepStrictEqual(Array.from(PLAYBACK_SPEEDS), [0.75, 1, 1.25, 1.5, 2]);
    });

    it("2.2 Validates speed bounds: minimum speed 0.75x, maximum speed 2.0x, all strictly positive", () => {
      const minSpeed = Math.min(...PLAYBACK_SPEEDS);
      const maxSpeed = Math.max(...PLAYBACK_SPEEDS);
      assert.strictEqual(minSpeed, 0.75, "Minimum playback speed must be 0.75x");
      assert.strictEqual(maxSpeed, 2.0, "Maximum playback speed must be 2.0x");

      for (let i = 0; i < PLAYBACK_SPEEDS.length; i++) {
        assert.ok(PLAYBACK_SPEEDS[i] > 0, `Speed ${PLAYBACK_SPEEDS[i]} must be positive non-zero`);
        if (i > 0) {
          assert.ok(
            PLAYBACK_SPEEDS[i] > PLAYBACK_SPEEDS[i - 1],
            `Speeds must strictly increase: ${PLAYBACK_SPEEDS[i]} > ${PLAYBACK_SPEEDS[i - 1]}`
          );
        }
      }
    });

    it("2.3 Cycles sequentially through [0.75, 1, 1.25, 1.5, 2] and wraps around to 0.75", () => {
      const cycleSpeed = (current: PlaybackSpeed): PlaybackSpeed => {
        const idx = PLAYBACK_SPEEDS.indexOf(current);
        if (idx === -1) return 1;
        const nextIdx = (idx + 1) % PLAYBACK_SPEEDS.length;
        return PLAYBACK_SPEEDS[nextIdx];
      };

      assert.strictEqual(cycleSpeed(0.75), 1);
      assert.strictEqual(cycleSpeed(1), 1.25);
      assert.strictEqual(cycleSpeed(1.25), 1.5);
      assert.strictEqual(cycleSpeed(1.5), 2);
      assert.strictEqual(cycleSpeed(2), 0.75); // Wrap-around back to start

      // Multi-cycle stress: 5 cycles returns to identical speed
      let s: PlaybackSpeed = 1;
      for (let step = 0; step < 5; step++) {
        s = cycleSpeed(s);
      }
      assert.strictEqual(s, 1, "5 steps from 1x must cycle back to 1x");

      // 25 cycles returns to identical speed
      let s2: PlaybackSpeed = 0.75;
      for (let step = 0; step < 25; step++) {
        s2 = cycleSpeed(s2);
      }
      assert.strictEqual(s2, 0.75, "25 steps from 0.75x must cycle back to 0.75x");
    });

    it("2.4 Gracefully handles unrecognized or out-of-bounds speed values without crashing", () => {
      const safeCycleSpeed = (speed: any): PlaybackSpeed => {
        const idx = PLAYBACK_SPEEDS.indexOf(speed);
        if (idx === -1) return 1;
        return PLAYBACK_SPEEDS[(idx + 1) % PLAYBACK_SPEEDS.length];
      };

      assert.strictEqual(safeCycleSpeed(0), 1);
      assert.strictEqual(safeCycleSpeed(-1), 1);
      assert.strictEqual(safeCycleSpeed(3.5), 1);
      assert.strictEqual(safeCycleSpeed(NaN), 1);
      assert.strictEqual(safeCycleSpeed(undefined), 1);
    });
  });

  // ==========================================================================
  // SUITE 3: Auto-Completion Threshold: Exactly 90% Boundary Condition
  // ==========================================================================
  describe("3. Auto-Completion Threshold: Exactly 90% Boundary Condition", () => {
    it("3.1 Mathematical playback calculation threshold (current / duration)", () => {
      const duration = 1000;
      const computeProgress = (curr: number) => {
        const total = duration;
        if (total <= 0) return { pct: 0, autoCompleted: false };
        const pct = Math.round((curr / total) * 100);
        return {
          pct,
          autoCompleted: pct >= 90,
        };
      };

      // Below boundary (< 90%)
      assert.strictEqual(computeProgress(0).autoCompleted, false);
      assert.strictEqual(computeProgress(500).autoCompleted, false);
      assert.strictEqual(computeProgress(894).pct, 89);
      assert.strictEqual(computeProgress(894).autoCompleted, false);

      // Boundary condition (89.5% rounds up to 90%, 900 is exactly 90.0%)
      assert.strictEqual(computeProgress(895).pct, 90);
      assert.strictEqual(computeProgress(895).autoCompleted, true);

      assert.strictEqual(computeProgress(900).pct, 90);
      assert.strictEqual(computeProgress(900).autoCompleted, true);

      // Above boundary (> 90%)
      assert.strictEqual(computeProgress(901).pct, 90);
      assert.strictEqual(computeProgress(901).autoCompleted, true);
      assert.strictEqual(computeProgress(950).pct, 95);
      assert.strictEqual(computeProgress(950).autoCompleted, true);
      assert.strictEqual(computeProgress(1000).pct, 100);
      assert.strictEqual(computeProgress(1000).autoCompleted, true);
    });

    it("3.2 API boundary test: POST /api/courses/[courseId]/progress respects exactly 90% boundary", async () => {
      // Case A: 89.9% playback does not trigger completion
      const req89 = new NextRequest(`http://localhost:3000/api/courses/${testCourseId}/progress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lms-user-id": testStudentId,
        },
        body: JSON.stringify({
          lesson_id: testLesson1Id,
          playback_percentage: 89.9,
          last_position_seconds: 1079,
        }),
      });

      const res89 = await updateCourseProgress(req89, {
        params: Promise.resolve({ courseId: testCourseId }),
      });
      assert.strictEqual(res89.status, 200);
      const data89 = await res89.json();
      assert.strictEqual(data89.success, true);
      assert.strictEqual(data89.status, "IN_PROGRESS", "89.9% must remain IN_PROGRESS");
      assert.strictEqual(data89.is_completed, false);

      // Case B: Exactly 90% playback triggers COMPLETED
      const req90 = new NextRequest(`http://localhost:3000/api/courses/${testCourseId}/progress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lms-user-id": testStudentId,
        },
        body: JSON.stringify({
          lesson_id: testLesson1Id,
          playback_percentage: 90.0,
          last_position_seconds: 1080,
        }),
      });

      const res90 = await updateCourseProgress(req90, {
        params: Promise.resolve({ courseId: testCourseId }),
      });
      assert.strictEqual(res90.status, 200);
      const data90 = await res90.json();
      assert.strictEqual(data90.success, true);
      assert.strictEqual(data90.status, "COMPLETED", "90.0% must automatically mark COMPLETED");
      assert.strictEqual(data90.progress_pct, 50, "Course has 2 lessons, 1 completed = 50%");
      assert.strictEqual(data90.is_completed, false, "Course overall is not yet complete (50% < 100%)");
      assert.strictEqual(data90.certificate, null, "Certificate must NOT be issued at 50%");
    });
  });

  // ==========================================================================
  // SUITE 4: Certificate Generation Logic: <100% completion vs 100% completion
  // ==========================================================================
  describe("4. Certificate Generation Logic: <100% vs 100% Completion & SHA-256 Ledger Hash", () => {
    it("4.1 Rejects certificate minting when curriculum is < 100% complete", async () => {
      // Current progress is 50% (1 of 2 lessons)
      const mintReq = new NextRequest(`http://localhost:3000/api/courses/${testCourseId}/certificate`, {
        method: "POST",
        headers: { "x-lms-user-id": testStudentId },
      });

      const mintRes = await mintCourseCertificate(mintReq, {
        params: Promise.resolve({ courseId: testCourseId }),
      });
      assert.strictEqual(mintRes.status, 400);
      const data = await mintRes.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, "COURSE_INCOMPLETE");

      // Verify dbAdapter throws directly as well
      await assert.rejects(
        async () => {
          await dbAdapter.mintCertificateForCourse(testStudentId, testCourseId);
        },
        {
          message: "COURSE_INCOMPLETE",
        }
      );
    });

    it("4.2 Issues certificate upon reaching exactly 100% completion", async () => {
      // Complete lesson 2 to reach 100% (2 of 2 lessons)
      const req100 = new NextRequest(`http://localhost:3000/api/courses/${testCourseId}/progress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lms-user-id": testStudentId,
        },
        body: JSON.stringify({
          lesson_id: testLesson2Id,
          playback_percentage: 100,
          last_position_seconds: 1200,
        }),
      });

      const res100 = await updateCourseProgress(req100, {
        params: Promise.resolve({ courseId: testCourseId }),
      });
      assert.strictEqual(res100.status, 200);
      const data100 = await res100.json();
      assert.strictEqual(data100.success, true);
      assert.strictEqual(data100.progress_pct, 100, "Progress must be 100%");
      assert.strictEqual(data100.is_completed, true, "Course must be marked completed");
      assert.ok(data100.certificate, "Certificate must be auto-minted at 100%");

      const cert = data100.certificate;

      // Verify non-empty serial code
      assert.ok(cert.certificate_code && cert.certificate_code.length > 0);
      assert.match(
        cert.certificate_code,
        /^CERT(-[A-Z0-9]+)+-\d+$/,
        `Certificate code ${cert.certificate_code} must match valid enterprise serial pattern`
      );

      // Verify SHA-256 verification hash length exactly 64 hex characters
      assert.strictEqual(
        cert.verification_hash.length,
        64,
        "Verification hash length must be exactly 64 characters"
      );
      assert.match(
        cert.verification_hash,
        /^[a-f0-9]{64}$/i,
        "Verification hash must be valid hexadecimal SHA-256 string"
      );

      // Verify cryptographically recomputed hash matches exactly
      const recomputedHash = computeCertificateHash({
        certificateCode: cert.certificate_code,
        userId: testStudentId,
        courseId: testCourseId,
        enrollmentId: cert.enrollment_id,
        issuedAt: cert.issued_at,
        score: cert.score,
      });
      assert.strictEqual(
        cert.verification_hash,
        recomputedHash,
        "Stored verification hash must match cryptographic sha256 output"
      );
    });

    it("4.3 Public certificate verification validates authentic certificate", () => {
      const db = getDb();
      const cert = db
        .prepare("SELECT * FROM certificates WHERE user_id = ? AND course_id = ?")
        .get(testStudentId, testCourseId) as any;

      assert.ok(cert, "Certificate must exist in database");

      const result = verifyCertificate(cert.certificate_code);
      assert.strictEqual(result.valid, true);
      assert.ok(result.certificate);
      assert.strictEqual(result.certificate.certificate_code, cert.certificate_code);
      assert.strictEqual(result.certificate.verification_hash, cert.verification_hash);
      assert.strictEqual(result.certificate.verification_hash.length, 64);
    });

    it("4.4 Adversarially challenges certificate verification with tampered and forged credentials", () => {
      // 1. Non-existent certificate code
      const fakeResult = verifyCertificate("CERT-FORGED-0000-9999");
      assert.strictEqual(fakeResult.valid, false);
      assert.strictEqual(fakeResult.certificate, null);

      // 2. Tampered hash in database
      const db = getDb();
      const testCertId = `cert_${randomUUID()}`;
      const now = new Date().toISOString();

      // Insert supporting distinct users and enrollments to satisfy foreign key constraints
      const insertMockUser = db.prepare(`
        INSERT OR REPLACE INTO users (id, email, name, role, department, job_title, is_active, created_at, updated_at)
        VALUES (?, ?, 'Tampered User', 'STUDENT', 'Engineering', 'QA Engineer', 1, ?, ?)
      `);
      insertMockUser.run("usr_adv_tampered_1", "tamper1@test.corp", now, now);
      insertMockUser.run("usr_adv_tampered_2", "tamper2@test.corp", now, now);
      insertMockUser.run("usr_adv_tampered_3", "tamper3@test.corp", now, now);

      const insertMockEnr = db.prepare(`
        INSERT OR REPLACE INTO enrollments (id, user_id, course_id, status, progress_pct, created_at, updated_at)
        VALUES (?, ?, ?, 'COMPLETED', 100, ?, ?)
      `);
      insertMockEnr.run("enr_adv_tampered_1", "usr_adv_tampered_1", testCourseId, now, now);
      insertMockEnr.run("enr_adv_tampered_2", "usr_adv_tampered_2", testCourseId, now, now);
      insertMockEnr.run("enr_adv_tampered_3", "usr_adv_tampered_3", testCourseId, now, now);

      // Insert forged certificate with invalid hash length (40 chars)
      const invalidLengthHash = "abcdef1234567890abcdef1234567890abcdef12";
      db.prepare(`
        INSERT INTO certificates (
          id, certificate_code, user_id, course_id, enrollment_id,
          course_title, course_version, user_name, user_email, score,
          issued_at, verification_hash, created_at
        ) VALUES (
          ?, 'CERT-TAMPERED-40', 'usr_adv_tampered_1', ?, 'enr_adv_tampered_1',
          'Test Course', '1.0.0', 'Tampered User', 'tamper@test.corp', 100,
          ?, ?, ?
        )
      `).run(testCertId, testCourseId, now, invalidLengthHash, now);

      const tamperedResult = verifyCertificate("CERT-TAMPERED-40");
      assert.strictEqual(tamperedResult.valid, false, "Must reject non-64-character hash");
      assert.match(tamperedResult.message, /invalid or corrupt hash/i);

      // Insert forged certificate with non-hex characters
      const testCertId2 = `cert_${randomUUID()}`;
      const nonHexHash = "z".repeat(64);
      db.prepare(`
        INSERT INTO certificates (
          id, certificate_code, user_id, course_id, enrollment_id,
          course_title, course_version, user_name, user_email, score,
          issued_at, verification_hash, created_at
        ) VALUES (
          ?, 'CERT-TAMPERED-NONHEX', 'usr_adv_tampered_2', ?, 'enr_adv_tampered_2',
          'Test Course', '1.0.0', 'Tampered User', 'tamper@test.corp', 100,
          ?, ?, ?
        )
      `).run(testCertId2, testCourseId, now, nonHexHash, now);

      const nonHexResult = verifyCertificate("CERT-TAMPERED-NONHEX");
      assert.strictEqual(nonHexResult.valid, false, "Must reject non-hexadecimal hash");
      assert.match(nonHexResult.message, /invalid or corrupt hash/i);

      // Insert expired certificate
      const testCertId3 = `cert_${randomUUID()}`;
      const expiredDate = new Date(Date.now() - 100000).toISOString();
      const validHash = "a".repeat(64);
      db.prepare(`
        INSERT INTO certificates (
          id, certificate_code, user_id, course_id, enrollment_id,
          course_title, course_version, user_name, user_email, score,
          issued_at, expires_at, verification_hash, created_at
        ) VALUES (
          ?, 'CERT-EXPIRED-TEST', 'usr_adv_tampered_3', ?, 'enr_adv_tampered_3',
          'Test Course', '1.0.0', 'Expired User', 'expired@test.corp', 100,
          ?, ?, ?, ?
        )
      `).run(testCertId3, testCourseId, now, expiredDate, validHash, now);

      const expiredResult = verifyCertificate("CERT-EXPIRED-TEST");
      assert.strictEqual(expiredResult.valid, false, "Must reject expired certificate");
      assert.match(expiredResult.message, /Certificate expired on/i);
    });

    it("4.5 Direct generateCertificate idempotency and parameter stress", () => {
      const db = getDb();
      // Generate certificate directly
      const cert1 = generateCertificate({
        userId: testStudentId,
        courseId: testCourseId,
        enrollmentId: "enr_adv_m3_learner",
        score: 100,
        customDb: db,
      });

      assert.ok(cert1);
      assert.ok(cert1.certificate_code);
      assert.strictEqual(cert1.verification_hash.length, 64);

      // Calling again for same enrollment returns identical certificate (idempotence)
      const cert2 = generateCertificate({
        userId: testStudentId,
        courseId: testCourseId,
        enrollmentId: "enr_adv_m3_learner",
        score: 100,
        customDb: db,
      });

      assert.strictEqual(cert1.id, cert2.id);
      assert.strictEqual(cert1.certificate_code, cert2.certificate_code);
      assert.strictEqual(cert1.verification_hash, cert2.verification_hash);
    });
  });
});
