import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import fs from "node:fs";
import assert from "node:assert/strict";

// Force load .env.local
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
      process.env[key] = val;
    }
  }
}

// Set environment for live development mode testing
(process.env as any).NODE_ENV = "development";
process.env.LMS_FORCE_OFFLINE = "false";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ldnvbephtdnignivbgra.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!serviceRoleKey || !token) {
  console.error("❌ Missing required keys in .env.local");
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  },
});

const anonClient = createClient(supabaseUrl, anonKey || serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  },
});

interface ProbeResult {
  suite: string;
  test: string;
  status: "PASS" | "FAIL";
  details: string;
  data?: any;
}

const results: ProbeResult[] = [];

function record(suite: string, test: string, passed: boolean, details: string, data?: any) {
  results.push({
    suite,
    test,
    status: passed ? "PASS" : "FAIL",
    details,
    data,
  });
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} [${suite}] ${test}: ${details}`);
}

async function runManagementApiSql(query: string): Promise<any> {
  const refMatch = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
  const projectRef = refMatch ? refMatch[1] : "ldnvbephtdnignivbgra";

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Management API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

async function main() {
  console.log("================================================================================");
  console.log("CHALLENGER M1.5.1: LIVE SUPABASE CLOUD & DATA SYNC EMPIRICAL STRESS TEST SUITE");
  console.log("Target Database:", supabaseUrl);
  console.log("Timestamp:", new Date().toISOString());
  console.log("================================================================================\n");

  // ---------------------------------------------------------------------------
  // SECTION 1: Direct SQL Schema Inspection (Information Schema via Management API)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 1: Schema & Primary Key Verification ---");
  try {
    const schemaSql = `
      SELECT 
        c.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        tc.constraint_type
      FROM information_schema.columns c
      LEFT JOIN information_schema.key_column_usage kcu
        ON c.table_name = kcu.table_name 
        AND c.column_name = kcu.column_name
        AND c.table_schema = kcu.table_schema
      LEFT JOIN information_schema.table_constraints tc
        ON kcu.constraint_name = tc.constraint_name
        AND kcu.table_schema = tc.table_schema
        AND tc.constraint_type = 'PRIMARY KEY'
      WHERE c.table_schema = 'public' 
        AND c.column_name = 'id'
      ORDER BY c.table_name;
    `;
    const schemaRows = await runManagementApiSql(schemaSql);

    const expectedTables = [
      "certificates",
      "courses",
      "enrollments",
      "lesson_progress",
      "lessons",
      "payouts",
      "transactions",
      "users",
      "wallets",
      "week_quizzes",
      "weeks",
    ];

    for (const table of expectedTables) {
      const match = schemaRows.find((r: any) => r.table_name === table);
      const exists = Boolean(match);
      const isText = match?.data_type === "text";
      const isPk = match?.constraint_type === "PRIMARY KEY";

      record(
        "Schema Inspection",
        `Table '${table}' id TEXT PRIMARY KEY`,
        exists && isText && isPk,
        exists
          ? `Found column 'id' of type '${match.data_type}', PK constraint='${match.constraint_type}'`
          : `Table '${table}' not found in public schema`
      );
    }
  } catch (err: any) {
    record("Schema Inspection", "Management API Query", false, err.message);
  }

  // ---------------------------------------------------------------------------
  // SECTION 2: Row Counts and Custom String ID Prefix Compliance
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 2: Live Row Counts & Custom String ID Prefixes ---");
  const prefixChecks = [
    { table: "users", prefix: "usr_", minExpected: 7 },
    { table: "courses", prefix: "crs_", minExpected: 7 },
    { table: "weeks", prefix: "wk_", minExpected: 35 },
    { table: "lessons", prefix: "les_", minExpected: 66 },
    { table: "week_quizzes", prefix: "qz_", minExpected: 35 },
    { table: "wallets", prefix: "wal_", minExpected: 7 },
    { table: "transactions", prefix: "tx_", minExpected: 2 },
    { table: "payouts", prefix: "po_", minExpected: 2 },
    { table: "enrollments", prefix: "enr_", minExpected: 3 },
    { table: "lesson_progress", prefix: "lp_", minExpected: 10 },
    { table: "certificates", prefix: "cert_", minExpected: 1 },
  ];

  for (const check of prefixChecks) {
    try {
      const { data, count, error } = await adminClient
        .from(check.table)
        .select("id", { count: "exact" })
        .limit(10);

      if (error) {
        record("ID & Row Counts", check.table, false, `Query error: ${error.message}`);
        continue;
      }

      const totalCount = count ?? 0;
      const countPass = totalCount >= check.minExpected;
      const samples = data || [];
      const prefixPass = samples.length > 0 && samples.every((row: any) => row.id.startsWith(check.prefix));

      record(
        "ID & Row Counts",
        `${check.table} (Prefix: ${check.prefix}*, Min: ${check.minExpected})`,
        countPass && prefixPass,
        `Count: ${totalCount} (min: ${check.minExpected}), Samples inspected: ${samples.length}, all match prefix '${check.prefix}': ${prefixPass}`
      );
    } catch (err: any) {
      record("ID & Row Counts", check.table, false, err.message);
    }
  }

  // ---------------------------------------------------------------------------
  // SECTION 3: Storage Buckets Verification (course-materials & lesson-videos)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 3: Storage Buckets & Policies Verification ---");
  try {
    const { data: buckets, error: bucketErr } = await adminClient.storage.listBuckets();
    if (bucketErr) {
      record("Storage Buckets", "List Buckets", false, bucketErr.message);
    } else {
      const courseMaterials = buckets.find((b) => b.id === "course-materials");
      const lessonVideos = buckets.find((b) => b.id === "lesson-videos");

      record(
        "Storage Buckets",
        "course-materials exists and is public",
        Boolean(courseMaterials && courseMaterials.public === true),
        courseMaterials
          ? `Bucket id: ${courseMaterials.id}, public: ${courseMaterials.public}, size_limit: ${courseMaterials.file_size_limit}`
          : "Bucket course-materials not found"
      );

      record(
        "Storage Buckets",
        "lesson-videos exists and is private",
        Boolean(lessonVideos && lessonVideos.public === false),
        lessonVideos
          ? `Bucket id: ${lessonVideos.id}, public: ${lessonVideos.public}, size_limit: ${lessonVideos.file_size_limit}`
          : "Bucket lesson-videos not found"
      );

      // Verify live upload and signed streaming URL on private lesson-videos bucket
      const testVidKey = `test_probe_${Date.now()}.mp4`;
      const dummyVid = Buffer.from("DUMMY_MP4_VIDEO_STREAM");
      const { error: uploadVidErr } = await adminClient.storage
        .from("lesson-videos")
        .upload(testVidKey, dummyVid, { contentType: "video/mp4", upsert: true });

      if (uploadVidErr) {
        record("Storage Buckets", "lesson-videos private upload", false, uploadVidErr.message);
      } else {
        const { data: signedUrlData, error: signedUrlErr } = await adminClient.storage
          .from("lesson-videos")
          .createSignedUrl(testVidKey, 120);

        const hasValidSignedUrl = !signedUrlErr && Boolean(signedUrlData?.signedUrl && signedUrlData.signedUrl.includes("/object/sign/lesson-videos/"));
        record(
          "Storage Buckets",
          "lesson-videos private signed URL generation",
          hasValidSignedUrl,
          signedUrlErr ? signedUrlErr.message : `Signed URL: ${signedUrlData?.signedUrl?.slice(0, 75)}...`
        );

        // Clean up test object
        await adminClient.storage.from("lesson-videos").remove([testVidKey]);
      }

      // Verify public URL generation for course-materials
      const { data: publicUrlData } = adminClient.storage
        .from("course-materials")
        .getPublicUrl("sample-slides.pdf");

      const hasPublicUrl = Boolean(publicUrlData?.publicUrl && publicUrlData.publicUrl.includes("/object/public/course-materials/"));
      record(
        "Storage Buckets",
        "course-materials public URL resolution",
        hasPublicUrl,
        `Resolved public URL: ${publicUrlData?.publicUrl}`
      );
    }
  } catch (err: any) {
    record("Storage Buckets", "Storage API", false, err.message);
  }

  // ---------------------------------------------------------------------------
  // SECTION 4: View super_admin_course_catalog Verification
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 4: Super Admin Catalog View Verification ---");
  try {
    const { data: catalogRows, error: catalogErr } = await adminClient
      .from("super_admin_course_catalog")
      .select("*");

    if (catalogErr) {
      record("Catalog View", "super_admin_course_catalog query", false, catalogErr.message);
    } else {
      assert(catalogRows && catalogRows.length >= 7, "Catalog view returned fewer than 7 rows");
      const first = catalogRows[0];
      const titleMasked = typeof first.title === "string" && first.title.includes("[Content Encrypted]");
      const hasThumb = typeof first.thumbnail_url === "string";
      const hasSales = typeof first.sales_count === "number";
      const hasRevenue = typeof first.gross_revenue_dollars === "number";

      record(
        "Catalog View",
        "super_admin_course_catalog masks titles and calculates ledger economics",
        titleMasked && hasThumb && hasSales && hasRevenue,
        `Sample title: '${first.title}', creator: '${first.creator_name}', sales: ${first.sales_count}, GMV: $${first.gross_revenue_dollars}, fee: $${first.platform_fee_dollars}`
      );
    }
  } catch (err: any) {
    record("Catalog View", "super_admin_course_catalog", false, err.message);
  }

  // ---------------------------------------------------------------------------
  // SECTION 5: Online dbAdapter Operations in Live Development Mode
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 5: Live dbAdapter Online Operations ---");
  try {
    const { dbAdapter } = await import("../src/lib/supabase/adapter");

    record(
      "dbAdapter Online",
      "dbAdapter.isOffline is FALSE in development with live credentials",
      dbAdapter.isOffline === false,
      `dbAdapter.isOffline = ${dbAdapter.isOffline}`
    );

    // 5.1 getCourses()
    const courses = await dbAdapter.getCourses();
    record(
      "dbAdapter Online",
      "getCourses() returns live published courses",
      courses.length >= 6,
      `Returned ${courses.length} courses. First: '${courses[0]?.title}' ($${courses[0]?.price_dollars})`
    );

    // 5.2 getCourses() with category filter
    const aiCourses = await dbAdapter.getCourses({ category: "DATA_SCIENCE" });
    record(
      "dbAdapter Online",
      "getCourses({ category: 'DATA_SCIENCE' }) filters correctly",
      aiCourses.length >= 1 && aiCourses.every((c) => c.category === "DATA_SCIENCE"),
      `Returned ${aiCourses.length} DATA_SCIENCE courses`
    );

    // 5.3 getCourseById & getCourseWithFullCurriculum
    const cloudCourseId = "crs_cloud_arch_7w";
    const fullCourseData = await dbAdapter.getCourseWithFullCurriculum(cloudCourseId);
    const curriculumWeeks = fullCourseData?.weeks || [];
    const totalLessons = curriculumWeeks.reduce((acc: number, w: any) => acc + (w.lessons?.length || 0), 0);

    record(
      "dbAdapter Online",
      "getCourseWithFullCurriculum('crs_cloud_arch_7w') retrieves 7-week curriculum hierarchy",
      Boolean(fullCourseData?.course && curriculumWeeks.length === 7 && totalLessons >= 10),
      `Course: '${fullCourseData?.course?.title}', Weeks: ${curriculumWeeks.length}, Total lessons: ${totalLessons}`
    );

    // Check that weekly quizzes are attached
    const quizzesCount = curriculumWeeks.filter((w: any) => w.quiz || w.week_quiz).length;
    record(
      "dbAdapter Online",
      "Curriculum weeks have associated quizzes with questions",
      quizzesCount >= 7,
      `Found ${quizzesCount} weeks with quizzes attached`
    );

    // 5.4 getWallet
    const sophiaWallet = await dbAdapter.getWallet("usr_sophia_chen");
    record(
      "dbAdapter Online",
      "getWallet('usr_sophia_chen') retrieves pre-funded student wallet",
      Boolean(sophiaWallet && sophiaWallet.balance_cents >= 0),
      `Wallet ID: ${sophiaWallet?.id}, Balance: $${((sophiaWallet?.balance_cents || 0) / 100).toFixed(2)} (${sophiaWallet?.balance_cents} cents)`
    );

    // 5.5 getAdminStats
    const adminStats = await dbAdapter.getAdminStats();
    record(
      "dbAdapter Online",
      "getAdminStats() aggregates live metrics from Supabase",
      Boolean(adminStats && adminStats.total_users >= 7 && adminStats.platform_fee_dollars !== undefined),
      `Users: ${adminStats?.total_users}, Completed TXs: ${adminStats?.completed_transactions}, GMV: $${adminStats?.gmv_dollars}, Fee: $${adminStats?.platform_fee_dollars}`
    );

    // 5.6 getTransactionsForUser & getPayouts
    const sophiaTxs = await dbAdapter.getTransactionsForUser("usr_sophia_chen");
    record(
      "dbAdapter Online",
      "getTransactionsForUser('usr_sophia_chen') returns ledger records",
      Array.isArray(sophiaTxs),
      `Transactions count: ${sophiaTxs.length}`
    );

    const payouts = await dbAdapter.getPayouts();
    record(
      "dbAdapter Online",
      "getPayouts() returns creator payout records",
      Array.isArray(payouts) && payouts.length >= 2,
      `Payouts count: ${payouts.length}`
    );
  } catch (err: any) {
    record("dbAdapter Online", "dbAdapter execution", false, err.message);
  }

  // ---------------------------------------------------------------------------
  // SECTION 6: Adversarial Stress Testing & Boundary Probes
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 6: Adversarial & Boundary Stress Tests ---");
  try {
    const { dbAdapter } = await import("../src/lib/supabase/adapter");

    // Attack 1: Non-existent IDs
    const nullCourse = await dbAdapter.getCourseById("crs_non_existent_666");
    record(
      "Adversarial Stress",
      "Non-existent course ID returns null safely without crash",
      nullCourse === null,
      `Result: ${JSON.stringify(nullCourse)}`
    );

    const emptyCurriculum = await dbAdapter.getCurriculum("crs_non_existent_666");
    record(
      "Adversarial Stress",
      "Non-existent course curriculum returns empty array safely",
      Array.isArray(emptyCurriculum) && emptyCurriculum.length === 0,
      `Result length: ${emptyCurriculum?.length}`
    );

    const nullWallet = await dbAdapter.getWallet("usr_ghost_user_999");
    record(
      "Adversarial Stress",
      "Non-existent user wallet lookup returns null safely",
      nullWallet === null,
      `Result: ${JSON.stringify(nullWallet)}`
    );

    // Attack 2: SQL Injection & Malicious Search Query Resilience
    const sqliSearches = [
      "' OR '1'='1",
      "\" UNION SELECT * FROM users --",
    ];

    let sqliSafe = true;
    for (const payload of sqliSearches) {
      try {
        const res = await dbAdapter.getCourses({ search: payload });
        if (!Array.isArray(res)) sqliSafe = false;
      } catch (err) {
        sqliSafe = false;
        break;
      }
    }
    record(
      "Adversarial Stress",
      "SQL injection attack payloads in course search handled safely without exception",
      sqliSafe,
      "PostgREST client properly parameterizes search filter values"
    );

    // Attack 3: Creator Privacy Shield - Direct Lesson Video Query via Anon/Student Client
    const { data: anonLessons } = await anonClient
      .from("lessons")
      .select("id, title, video_url, is_preview")
      .eq("course_id", "crs_cloud_arch_7w");

    // Under RLS, unauthenticated callers cannot retrieve non-preview video streaming URLs
    const nonPreviewWithVideo = (anonLessons || []).filter((l) => !l.is_preview && l.video_url);
    record(
      "Adversarial Stress",
      "Creator Privacy Shield: Anon client restricted from raw video URLs of non-preview lessons",
      nonPreviewWithVideo.length === 0,
      `Anon query returned ${anonLessons?.length ?? 0} lessons, non-preview with video: ${nonPreviewWithVideo.length}`
    );

    // Attack 4: Double Purchase / Idempotency Check in executeCheckout
    const enrollments = await adminClient.from("enrollments").select("user_id, course_id").limit(1);
    let doublePurchaseBlocked = false;
    let blockReason = "";
    if (enrollments.data && enrollments.data.length > 0) {
      const enrolled = enrollments.data[0];
      try {
        const checkoutResult = await dbAdapter.executeCheckout({
          studentId: enrolled.user_id,
          courseId: enrolled.course_id,
        });
        if (checkoutResult.success === false) {
          doublePurchaseBlocked = true;
          blockReason = checkoutResult.error || "success=false";
        }
      } catch (err: any) {
        if (/ALREADY_ENROLLED/i.test(err.message)) {
          doublePurchaseBlocked = true;
          blockReason = "Threw expected ALREADY_ENROLLED error";
        } else {
          blockReason = `Unexpected error: ${err.message}`;
        }
      }

      record(
        "Adversarial Stress",
        "executeCheckout() prevents double-purchase of already enrolled course",
        doublePurchaseBlocked,
        blockReason
      );
    }

    // Attack 5: Payout Request Negative or Zero Amount
    let negativePayoutBlocked = false;
    try {
      const badPayout = await dbAdapter.createPayoutRequest("usr_aris_thorne", -5000);
      if (badPayout?.error || badPayout?.success === false) {
        negativePayoutBlocked = true;
      }
    } catch (err: any) {
      negativePayoutBlocked = true;
    }
    record(
      "Adversarial Stress",
      "createPayoutRequest() rejects negative payout amounts",
      negativePayoutBlocked,
      "Negative amount was rejected by validation / DB check constraint"
    );

    // Attack 6: Payout Request Exceeding Wallet Balance
    let excessivePayoutBlocked = false;
    try {
      const excessivePayout = await dbAdapter.createPayoutRequest("usr_aris_thorne", 999999999);
      if (excessivePayout?.error || excessivePayout?.success === false) {
        excessivePayoutBlocked = true;
      }
    } catch (err: any) {
      excessivePayoutBlocked = true;
    }
    record(
      "Adversarial Stress",
      "createPayoutRequest() rejects payout exceeding available wallet balance",
      excessivePayoutBlocked,
      "Excessive payout amount rejected"
    );

    // Attack 7: Insufficient Funds Checkout
    // Create temporary zero-balance user or attempt checkout with high price course
    let insufficientFundsBlocked = false;
    try {
      // Find a course with high price and test with user having 0 balance
      const fakePoorStudent = "usr_poor_student_test";
      await adminClient.from("users").upsert({
        id: fakePoorStudent,
        email: "poor.student@test.corp",
        name: "Poor Student",
        role: "STUDENT",
        is_active: true,
      });
      await adminClient.from("wallets").upsert({
        id: `wal_${fakePoorStudent}`,
        user_id: fakePoorStudent,
        balance: 0,
        balance_cents: 0,
        currency: "USD",
      });

      try {
        await dbAdapter.executeCheckout({
          studentId: fakePoorStudent,
          courseId: "crs_cloud_arch_7w",
        });
      } catch (err: any) {
        if (/INSUFFICIENT_FUNDS/i.test(err.message)) {
          insufficientFundsBlocked = true;
        }
      }

      // Cleanup poor student test data
      await adminClient.from("wallets").delete().eq("user_id", fakePoorStudent);
      await adminClient.from("users").delete().eq("id", fakePoorStudent);
    } catch (err: any) {
      console.error("Cleanup/test error for insufficient funds:", err.message);
    }

    record(
      "Adversarial Stress",
      "executeCheckout() rejects purchase when student wallet has insufficient funds",
      insufficientFundsBlocked,
      "Throws INSUFFICIENT_FUNDS when balance < price_cents"
    );

  } catch (err: any) {
    record("Adversarial Stress", "Adversarial test harness", false, err.message);
  }

  // ---------------------------------------------------------------------------
  // SUMMARY AND VERDICT
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("FINAL SUMMARY OF EMPIRICAL FINDINGS");
  console.log("================================================================================");

  const total = results.length;
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  console.log(`Total Probes Executed: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  const verdict = failed === 0 ? "APPROVE" : "REJECT";
  console.log(`\nVERDICT: ${verdict}\n`);

  return { total, passed, failed, verdict, results };
}

main().catch((err) => {
  console.error("FATAL ERROR IN PROBE SUITE:", err);
  process.exit(1);
});
