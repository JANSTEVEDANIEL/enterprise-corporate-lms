import { createClient } from "@supabase/supabase-js";
import { CORPORATE_PERSONAS } from "../src/lib/auth";
import { ALL_MARKETPLACE_COURSES } from "../src/lib/db/seed-curricula";
import path from "node:path";
import fs from "node:fs";

// Load .env.local manually
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ldnvbephtdnignivbgra.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error("❌ Missing SUPABASE_SERVICE_ROLE_KEY in environment or .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  },
});

export async function seedSupabase() {
  console.log("🌱 Seeding Live Supabase Cloud Database:", supabaseUrl);
  const now = new Date().toISOString();

  // 1. Seed Users
  console.log("👤 Seeding Users & Personas...");
  const usersToInsert = [
    ...Object.values(CORPORATE_PERSONAS).map((p) => ({
      id: p.id,
      email: p.email,
      name: p.name,
      avatar_url: p.avatarUrl || null,
      role: p.role,
      department: p.department || "",
      job_title: p.jobTitle || "",
      manager_id: p.managerId || null,
      is_active: 1,
      created_at: now,
      updated_at: now,
    })),
    {
      id: "usr_aris_thorne",
      email: "aris.thorne@enterprise.corp",
      name: "Dr. Aris Thorne",
      avatar_url: "/avatars/aris.jpg",
      role: "CO_ADMIN",
      department: "Curriculum & Engineering",
      job_title: "Principal Cloud Architect & Lead Instructor",
      manager_id: null,
      is_active: 1,
      created_at: now,
      updated_at: now,
    },
    {
      id: "usr_sophia_chen",
      email: "sophia.chen@enterprise.corp",
      name: "Sophia Chen",
      avatar_url: "/avatars/sophia.jpg",
      role: "STUDENT",
      department: "Engineering",
      job_title: "Software Engineer Intern",
      manager_id: null,
      is_active: 1,
      created_at: now,
      updated_at: now,
    },
  ];

  const { error: userErr } = await supabase.from("users").upsert(usersToInsert, { onConflict: "id" });
  if (userErr) {
    console.error("❌ Failed to upsert users:", userErr);
    throw userErr;
  }
  console.log(`  ✔ Seeded ${usersToInsert.length} users successfully`);

  // 2. Seed Wallets
  console.log("💰 Seeding Pre-funded Wallets...");
  const walletsToInsert = [
    { id: "wal_usr_aris_thorne", user_id: "usr_aris_thorne", balance: 12820, balance_cents: 12820, currency: "USD", created_at: now, updated_at: now },
    { id: "wal_usr_sophia_chen", user_id: "usr_sophia_chen", balance: 50000, balance_cents: 50000, currency: "USD", created_at: now, updated_at: now },
    { id: "wal_usr_alex_rivera", user_id: "usr_alex_rivera", balance: 40100, balance_cents: 40100, currency: "USD", created_at: now, updated_at: now },
    { id: "wal_usr_elena_rostova", user_id: "usr_elena_rostova", balance: 50000, balance_cents: 50000, currency: "USD", created_at: now, updated_at: now },
    { id: "wal_usr_david_kim", user_id: "usr_david_kim", balance: 50000, balance_cents: 50000, currency: "USD", created_at: now, updated_at: now },
    { id: "wal_usr_sarah_jenkins", user_id: "usr_sarah_jenkins", balance: 50000, balance_cents: 50000, currency: "USD", created_at: now, updated_at: now },
    { id: "wal_usr_marcus_vance", user_id: "usr_marcus_vance", balance: 50000, balance_cents: 50000, currency: "USD", created_at: now, updated_at: now },
  ];
  const { error: walErr } = await supabase.from("wallets").upsert(walletsToInsert, { onConflict: "user_id" });
  if (walErr) {
    console.error("❌ Failed to upsert wallets:", walErr);
    throw walErr;
  }
  console.log(`  ✔ Seeded ${walletsToInsert.length} wallets successfully`);

  // 3. Seed Courses, Weeks, Lessons, Quizzes
  console.log("📚 Seeding Authentic Marketplace Curricula...");
  const prefixMap: Record<string, string> = {
    crs_cloud_arch_7w: "cloud",
    crs_fullstack_ai_8w: "fsai",
    crs_zerotrust_sec_6w: "sec",
    crs_ai_agents_prod: "agents",
    crs_git_free_1w: "git",
    crs_uiux_design_5w: "uiux",
    crs_leadership_eng_4w: "lead",
  };

  const coursesToInsert = ALL_MARKETPLACE_COURSES.map((course) => ({
    id: course.id,
    slug: course.slug,
    title: course.title,
    description: course.description,
    category: course.category,
    target_role: "ALL",
    is_mandatory: 0,
    estimated_minutes: course.estimatedMinutes,
    renewal_period_days: null,
    passing_score_pct: 80,
    version: "1.0.0",
    is_published: course.isPublished === 1,
    creator_id: course.creatorId,
    price_cents: course.priceCents,
    thumbnail_url: course.thumbnailUrl,
    total_weeks: course.totalWeeks,
    created_at: now,
    updated_at: now,
  }));

  const { error: courseErr } = await supabase.from("courses").upsert(coursesToInsert, { onConflict: "id" });
  if (courseErr) {
    console.error("❌ Failed to upsert courses:", courseErr);
    throw courseErr;
  }
  console.log(`  ✔ Seeded ${coursesToInsert.length} courses successfully`);

  // Prepare weeks, lessons, quizzes
  const weeksToInsert: any[] = [];
  const lessonsToInsert: any[] = [];
  const quizzesToInsert: any[] = [];
  let totalAttachmentCount = 0;

  for (const course of ALL_MARKETPLACE_COURSES) {
    const prefix = prefixMap[course.id] || course.id.replace("crs_", "");

    for (const w of course.weeks) {
      const weekId = `wk_${prefix}_w${w.num}`;
      weeksToInsert.push({
        id: weekId,
        course_id: course.id,
        week_number: w.num,
        title: w.title,
        description: w.desc,
        created_at: now,
        updated_at: now,
      });

      for (const les of w.lessons) {
        lessonsToInsert.push({
          id: `les_${prefix}_w${w.num}_${les.order}`,
          week_id: weekId,
          course_id: course.id,
          title: les.title,
          order_index: les.order,
          duration_seconds: les.sec,
          video_url: les.video,
          supplementary_files: les.files,
          is_preview: les.preview === 1,
          created_at: now,
          updated_at: now,
        });
        totalAttachmentCount += les.files ? les.files.length : 0;
      }

      if (w.questions && w.questions.length > 0) {
        quizzesToInsert.push({
          id: `qz_${prefix}_w${w.num}`,
          week_id: weekId,
          course_id: course.id,
          title: w.quizTitle,
          passing_score_pct: w.passingScore,
          questions: w.questions,
          created_at: now,
          updated_at: now,
        });
      }
    }
  }

  // Upsert weeks
  const { error: weekErr } = await supabase.from("weeks").upsert(weeksToInsert, { onConflict: "id" });
  if (weekErr) {
    console.error("❌ Failed to upsert weeks:", weekErr);
    throw weekErr;
  }
  console.log(`  ✔ Seeded ${weeksToInsert.length} weeks successfully`);

  // Upsert lessons
  const { error: lesErr } = await supabase.from("lessons").upsert(lessonsToInsert, { onConflict: "id" });
  if (lesErr) {
    console.error("❌ Failed to upsert lessons:", lesErr);
    throw lesErr;
  }
  console.log(`  ✔ Seeded ${lessonsToInsert.length} lessons with ${totalAttachmentCount} attachments successfully`);

  // Upsert quizzes
  const { error: qzErr } = await supabase.from("week_quizzes").upsert(quizzesToInsert, { onConflict: "id" });
  if (qzErr) {
    console.error("❌ Failed to upsert week quizzes:", qzErr);
    throw qzErr;
  }
  console.log(`  ✔ Seeded ${quizzesToInsert.length} weekly quizzes successfully`);

  // 4. Seed Enrollments
  console.log("🎓 Seeding Enrollments & Lesson Progress...");
  const enrollmentsToInsert = [
    {
      id: "enr_sophia_cloud",
      user_id: "usr_sophia_chen",
      course_id: "crs_cloud_arch_7w",
      status: "IN_PROGRESS",
      progress_pct: 45,
      assigned_by: null,
      assigned_at: now,
      due_date: null,
      completed_at: null,
      expires_at: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: "enr_alex_cloud",
      user_id: "usr_alex_rivera",
      course_id: "crs_cloud_arch_7w",
      status: "IN_PROGRESS",
      progress_pct: 20,
      assigned_by: null,
      assigned_at: now,
      due_date: null,
      completed_at: null,
      expires_at: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: "enr_sophia_fsai",
      user_id: "usr_sophia_chen",
      course_id: "crs_fullstack_ai_8w",
      status: "IN_PROGRESS",
      progress_pct: 12,
      assigned_by: null,
      assigned_at: now,
      due_date: null,
      completed_at: null,
      expires_at: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: "enr_elena_sec",
      user_id: "usr_elena_rostova",
      course_id: "crs_zerotrust_sec_6w",
      status: "COMPLETED",
      progress_pct: 100,
      assigned_by: null,
      assigned_at: now,
      due_date: null,
      completed_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      expires_at: null,
      created_at: now,
      updated_at: now,
    },
  ];

  const { error: enrErr } = await supabase.from("enrollments").upsert(enrollmentsToInsert, { onConflict: "id" });
  if (enrErr) {
    console.error("❌ Failed to upsert enrollments:", enrErr);
    throw enrErr;
  }
  console.log(`  ✔ Seeded ${enrollmentsToInsert.length} enrollments successfully`);

  // 5. Seed Lesson Progress
  const progressToInsert = [
    {
      id: "lp_sophia_1",
      user_id: "usr_sophia_chen",
      lesson_id: "les_cloud_w1_1",
      course_id: "crs_cloud_arch_7w",
      status: "COMPLETED",
      completed_at: now,
      last_position_seconds: 1200,
      created_at: now,
      updated_at: now,
    },
    {
      id: "lp_sophia_2",
      user_id: "usr_sophia_chen",
      lesson_id: "les_cloud_w1_2",
      course_id: "crs_cloud_arch_7w",
      status: "COMPLETED",
      completed_at: now,
      last_position_seconds: 1450,
      created_at: now,
      updated_at: now,
    },
    {
      id: "lp_alex_1",
      user_id: "usr_alex_rivera",
      lesson_id: "les_cloud_w1_1",
      course_id: "crs_cloud_arch_7w",
      status: "COMPLETED",
      completed_at: now,
      last_position_seconds: 1200,
      created_at: now,
      updated_at: now,
    },
    {
      id: "lp_sophia_cloud_w2",
      user_id: "usr_sophia_chen",
      lesson_id: "les_cloud_w2_1",
      course_id: "crs_cloud_arch_7w",
      status: "COMPLETED",
      completed_at: now,
      last_position_seconds: 1100,
      created_at: now,
      updated_at: now,
    },
    {
      id: "lp_sophia_cloud_w3",
      user_id: "usr_sophia_chen",
      lesson_id: "les_cloud_w3_1",
      course_id: "crs_cloud_arch_7w",
      status: "COMPLETED",
      completed_at: now,
      last_position_seconds: 1350,
      created_at: now,
      updated_at: now,
    },
    {
      id: "lp_sophia_cloud_w4",
      user_id: "usr_sophia_chen",
      lesson_id: "les_cloud_w4_1",
      course_id: "crs_cloud_arch_7w",
      status: "IN_PROGRESS",
      completed_at: null,
      last_position_seconds: 640,
      created_at: now,
      updated_at: now,
    },
    {
      id: "lp_alex_cloud_w2",
      user_id: "usr_alex_rivera",
      lesson_id: "les_cloud_w2_1",
      course_id: "crs_cloud_arch_7w",
      status: "COMPLETED",
      completed_at: now,
      last_position_seconds: 1050,
      created_at: now,
      updated_at: now,
    },
    {
      id: "lp_alex_cloud_w3",
      user_id: "usr_alex_rivera",
      lesson_id: "les_cloud_w3_1",
      course_id: "crs_cloud_arch_7w",
      status: "IN_PROGRESS",
      completed_at: null,
      last_position_seconds: 450,
      created_at: now,
      updated_at: now,
    },
    {
      id: "lp_sophia_fsai_w1",
      user_id: "usr_sophia_chen",
      lesson_id: "les_fsai_w1_1",
      course_id: "crs_fullstack_ai_8w",
      status: "COMPLETED",
      completed_at: now,
      last_position_seconds: 980,
      created_at: now,
      updated_at: now,
    },
    {
      id: "lp_elena_sec_w1",
      user_id: "usr_elena_rostova",
      lesson_id: "les_sec_w1_1",
      course_id: "crs_zerotrust_sec_6w",
      status: "COMPLETED",
      completed_at: now,
      last_position_seconds: 1400,
      created_at: now,
      updated_at: now,
    },
    {
      id: "lp_elena_sec_w2",
      user_id: "usr_elena_rostova",
      lesson_id: "les_sec_w2_1",
      course_id: "crs_zerotrust_sec_6w",
      status: "COMPLETED",
      completed_at: now,
      last_position_seconds: 1300,
      created_at: now,
      updated_at: now,
    },
  ];
  const { error: lpErr } = await supabase.from("lesson_progress").upsert(progressToInsert, { onConflict: "user_id,lesson_id" });
  if (lpErr) {
    console.error("❌ Failed to upsert lesson progress:", lpErr);
  } else {
    console.log(`  ✔ Seeded ${progressToInsert.length} lesson progress records successfully`);
  }

  // 6. Seed Certificates
  console.log("📜 Seeding Verified Certificates...");
  const certsToInsert = [
    {
      id: "cert_elena_sec_mkt",
      certificate_code: "CERT-2026-SEC-77102",
      user_id: "usr_elena_rostova",
      course_id: "crs_zerotrust_sec_6w",
      enrollment_id: "enr_elena_sec",
      course_title: "Zero-Trust Architecture & Enterprise Cloud Security",
      course_version: "1.0.0",
      student_name: "Elena Rostova",
      user_name: "Elena Rostova",
      user_email: "elena.rostova@enterprise.corp",
      score: 100,
      verification_badge_url: "/badges/cert-gold.svg",
      issued_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      expires_at: null,
      verification_hash: "9f83a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c",
      created_at: now,
    },
  ];
  const { error: certErr } = await supabase.from("certificates").upsert(certsToInsert, { onConflict: "id" });
  if (certErr) {
    console.error("❌ Failed to upsert certificates:", certErr);
  } else {
    console.log(`  ✔ Seeded ${certsToInsert.length} certificates successfully`);
  }

  // 7. Seed Transactions
  console.log("💳 Seeding 10/90 Revenue Split Transactions...");
  const txToInsert = [
    {
      id: "tx_seed_cloud_1",
      course_id: "crs_cloud_arch_7w",
      student_id: "usr_sophia_chen",
      creator_id: "usr_aris_thorne",
      amount: 9900,
      amount_cents: 9900,
      platform_fee: 990,
      platform_fee_cents: 990,
      creator_earnings: 8910,
      creator_payout_cents: 8910,
      currency: "USD",
      status: "COMPLETED",
      created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    },
    {
      id: "tx_seed_cloud_2",
      course_id: "crs_cloud_arch_7w",
      student_id: "usr_alex_rivera",
      creator_id: "usr_aris_thorne",
      amount: 9900,
      amount_cents: 9900,
      platform_fee: 990,
      platform_fee_cents: 990,
      creator_earnings: 8910,
      creator_payout_cents: 8910,
      currency: "USD",
      status: "COMPLETED",
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: "tx_seed_fsai_1",
      course_id: "crs_fullstack_ai_8w",
      student_id: "usr_sophia_chen",
      creator_id: "usr_aris_thorne",
      amount: 12900,
      amount_cents: 12900,
      platform_fee: 1290,
      platform_fee_cents: 1290,
      creator_earnings: 11610,
      creator_payout_cents: 11610,
      currency: "USD",
      status: "COMPLETED",
      created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    },
  ];
  const { error: txErr } = await supabase.from("transactions").upsert(txToInsert, { onConflict: "id" });
  if (txErr) {
    console.error("❌ Failed to upsert transactions:", txErr);
  } else {
    console.log(`  ✔ Seeded ${txToInsert.length} transactions successfully`);
  }

  // 8. Seed Payouts & Payout Requests
  console.log("💸 Seeding Creator Payout Requests...");
  const payoutsToInsert = [
    {
      id: "po_seed_1",
      creator_id: "usr_aris_thorne",
      amount: 5000,
      amount_cents: 5000,
      status: "PROCESSED",
      requested_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      processed_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      notes: "Initial creator studio withdrawal",
    },
    {
      id: "po_seed_2",
      creator_id: "usr_aris_thorne",
      amount: 2500,
      amount_cents: 2500,
      status: "PENDING",
      requested_at: now,
      processed_at: null,
      notes: "Bi-weekly creator earnings withdrawal",
    },
  ];
  const { error: poErr } = await supabase.from("payouts").upsert(payoutsToInsert, { onConflict: "id" });
  if (poErr) {
    console.error("❌ Failed to upsert payouts:", poErr);
  }
  const { error: porErr } = await supabase.from("payout_requests").upsert(payoutsToInsert, { onConflict: "id" });
  if (porErr) {
    console.error("❌ Failed to upsert payout_requests:", porErr);
  }
  console.log(`  ✔ Seeded ${payoutsToInsert.length} payouts successfully`);

  console.log("\n🎉 LIVE SUPABASE CLOUD DATABASE SEEDING COMPLETED SUCCESSFULLY!\n");
}

if (process.argv[1] && process.argv[1].endsWith("seed-supabase.ts")) {
  seedSupabase().catch((err) => {
    console.error("Fatal seed error:", err);
    process.exit(1);
  });
}
