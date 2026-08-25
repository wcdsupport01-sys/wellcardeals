import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Everything lives here now: account identity (Supabase Auth + the
// `profiles` table), car listings, dropdown lookups, live-bid state and the
// bidding-pass access codes (see SUPABASE_SETUP.md). If these env vars
// aren't set yet, everything that reads `supabase` falls back gracefully to
// a local, in-browser simulation instead of crashing.
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null;

if (!isSupabaseConfigured && import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.warn(
    "[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — cars, lookups and live bidding are running in local preview mode (see SUPABASE_SETUP.md)."
  );
}
