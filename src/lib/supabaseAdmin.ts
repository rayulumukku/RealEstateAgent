import { createClient, SupabaseClient } from "@supabase/supabase-js";

// -----------------------------------------------------------------------------
// Server-only admin client — uses the service-role key and therefore BYPASSES
// row-level security. Never import this from a client component.
//
// Why a Proxy / lazy init instead of a top-level createClient():
//   `next build` performs static page-data collection by importing every
//   route module. If we call createClient(url, "") at import time it throws
//   `supabaseKey is required` synchronously and the whole build fails with
//   "Failed to collect page data". By deferring the actual client creation
//   to first use, the build can analyse routes even when the env vars are
//   not set (e.g. on a fresh Vercel project before envs are configured).
// -----------------------------------------------------------------------------

let cached: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (cached) return cached;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is missing. Set it in your environment (or .env.local)."
    );
  }
  if (!supabaseServiceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing. Set it on the server (Vercel project settings or .env.local). Never expose it to the browser."
    );
  }

  cached = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cached;
}

// Proxy that forwards all property access to the lazily-created client.
// Existing call sites (`supabaseAdmin.from(...)`) continue to work unchanged.
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
