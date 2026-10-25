import { getAllPersonas } from "../src/lib/auth";
import { getDb, initDb } from "../src/lib/db";
import { verifyAuditLogIntegrity } from "../src/lib/audit";

console.log("=================================================");
console.log("    Enterprise LMS Persona Simulation Runner     ");
console.log("=================================================");

initDb();
const db = getDb();
const personas = getAllPersonas();

console.log(`\n📋 Loaded ${personas.length} Corporate Personas:`);
for (const p of personas) {
  const enrollments = db
    .prepare("SELECT COUNT(*) as c FROM enrollments WHERE user_id = ?")
    .get(p.id) as any;
  const certs = db
    .prepare("SELECT COUNT(*) as c FROM certificates WHERE user_id = ?")
    .get(p.id) as any;

  console.log(`  [${p.role.padEnd(18)}] ${p.name.padEnd(16)} | Dept: ${p.department.padEnd(12)} | Courses: ${enrollments.c} | Certs: ${certs.c}`);
}

const auditCheck = verifyAuditLogIntegrity();
console.log(`\n🔒 Audit Log Chain Verification: ${auditCheck.isValid ? "✅ VALID" : "❌ COMPROMISED"} (${auditCheck.totalRecords} records)`);

console.log("\n✨ Simulation environment ready for Milestone M2/M3 execution.\n");
