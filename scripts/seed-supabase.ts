export { seedSupabase } from "./supabase-seed";
import { seedSupabase } from "./supabase-seed";

if (process.argv[1] && (process.argv[1].endsWith("seed-supabase.ts") || process.argv[1].endsWith("seed-supabase.js"))) {
  seedSupabase().catch((err) => {
    console.error("Fatal seed error:", err);
    process.exit(1);
  });
}
