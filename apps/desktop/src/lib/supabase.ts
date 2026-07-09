// Supabase client — null when the app is built without a configured backend,
// in which case all Galaxy features show their "not connected" states.
// The anon key is public by design; every access is enforced by RLS.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          flowType: "pkce",
          persistSession: true,
          detectSessionInUrl: false, // desktop: we exchange the deep-link code manually
        },
      })
    : null;

export const galaxyConfigured = supabase !== null;
