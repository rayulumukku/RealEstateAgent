import { createClient, SupabaseClient } from "@supabase/supabase-js";

// -----------------------------------------------------------------------------
// Public anon client — safe to use from the browser.
//
// Lazily created behind a Proxy so that `next build` can statically analyse
// routes even when env vars haven't been set yet (e.g. fresh Vercel project).
// The client is only constructed on first method call.
// -----------------------------------------------------------------------------

let cached: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (cached) return cached;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is missing. Set it in your environment (or .env.local)."
    );
  }
  if (!supabaseAnonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. Set it in your environment (or .env.local)."
    );
  }

  cached = createClient(supabaseUrl, supabaseAnonKey);
  return cached;
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
