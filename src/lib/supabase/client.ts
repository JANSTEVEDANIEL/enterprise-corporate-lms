import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let clientInstance: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (clientInstance) return clientInstance;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  clientInstance = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return clientInstance;
}
