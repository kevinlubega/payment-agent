import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * Returns a lazily-initialised Supabase client.
 * Throws clearly if env vars are missing so misconfiguration is obvious.
 */
export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables"
    );
  }

  _client = createClient(url, key);
  return _client;
}
