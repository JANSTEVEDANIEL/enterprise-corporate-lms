import { seedDb } from "../src/lib/db/seed";
import { getDb } from "../src/lib/db";
import { verifyAuditLogIntegrity } from "../src/lib/audit";

console.log("=================================================");
console.log("  Enterprise Corporate LMS Database Provisioner  ");
console.log("=================================================");

try {
  console.log("🌱 Initializing SQLite database and running migrations...");
  seedDb();

  const db = getDb();
  const userCount = (db.prepare("SELECT COUNT(*) as c FROM users").get() as any).c;
  const courseCount = (db.prepare("SELECT COUNT(*) as c FROM courses").get() as any).c;
  const moduleCount = (db.prepare("SELECT COUNT(*) as c FROM modules").get() as any).c;
  const quizCount = (db.prepare("SELECT COUNT(*) as c FROM quizzes").get() as any).c;
  const enrollmentCount = (db.prepare("SELECT COUNT(*) as c FROM enrollments").get() as any).c;
  const certCount = (db.prepare("SELECT COUNT(*) as c FROM certificates").get() as any).c;
  const auditCount = (db.prepare("SELECT COUNT(*) as c FROM audit_logs").get() as any).c;

  console.log("\n📊 Seed Data Summary:");
  console.log(`  • Users Provisioned:       ${userCount}`);
  console.log(`  • Courses Configured:      ${courseCount}`);
  console.log(`  • Modules & Lessons:       ${moduleCount}`);
  console.log(`  • Quizzes & Question Banks: ${quizCount}`);
  console.log(`  • Active Enrollments:      ${enrollmentCount}`);
  console.log(`  • Verified Certificates:   ${certCount}`);
  console.log(`  • Immutable Audit Logs:    ${auditCount}`);

  console.log("\n🔒 Verifying Cryptographic Audit Log Hash Chain...");
  const auditStatus = verifyAuditLogIntegrity();
  if (auditStatus.isValid) {
    console.log(`  ✅ Hash Chain Status: INTACT (${auditStatus.totalRecords} records verified sequentially)`);
  } else {
    console.error(`  ❌ Hash Chain Compromised: ${auditStatus.failureReason}`);
    process.exit(1);
  }

  console.log("\n🚀 Seeding completed successfully!\n");
} catch (err) {
  console.error("❌ Failed to seed database:", err);
  process.exit(1);
}
