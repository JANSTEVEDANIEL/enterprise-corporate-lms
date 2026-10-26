import fs from "node:fs";
import path from "node:path";

export async function runSupabaseMigration(): Promise<{ success: boolean; result?: any; error?: string }> {
  console.log("🚀 Executing Supabase PostgreSQL Migration via Management API...");

  let token = process.env.SUPABASE_ACCESS_TOKEN;
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ldnvbephtdnignivbgra.supabase.co";

  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    const tokenMatch = envContent.match(/SUPABASE_ACCESS_TOKEN=(.*)/);
    if (tokenMatch) {
      token = tokenMatch[1].trim();
    }
    const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
    if (urlMatch) {
      supabaseUrl = urlMatch[1].trim();
    }
  }

  if (!token) {
    const err = "❌ SUPABASE_ACCESS_TOKEN not found in environment or .env.local.";
    console.error(err);
    return { success: false, error: err };
  }

  // Extract project ref from URL or fallback
  const refMatch = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
  const projectRef = refMatch ? refMatch[1] : "ldnvbephtdnignivbgra";

  const migrationFilePath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261026_init_marketplace_schema.sql"
  );

  if (!fs.existsSync(migrationFilePath)) {
    const err = `❌ Migration file not found at ${migrationFilePath}`;
    console.error(err);
    return { success: false, error: err };
  }

  const sql = fs.readFileSync(migrationFilePath, "utf-8");

  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Migration failed (HTTP ${response.status}):`, errorText);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const result = await response.json();
    console.log("✅ Supabase PostgreSQL Migration Applied Successfully!");
    console.log("Result summary:", Array.isArray(result) ? `Returned ${result.length} result sets` : result);
    return { success: true, result };
  } catch (err: any) {
    console.error("❌ Exception during Supabase migration:", err);
    return { success: false, error: err.message };
  }
}

// Allow direct execution
if (process.argv[1] && process.argv[1].endsWith("supabase-migrate.ts")) {
  runSupabaseMigration().then((res) => {
    if (!res.success) {
      process.exit(1);
    }
  });
}
