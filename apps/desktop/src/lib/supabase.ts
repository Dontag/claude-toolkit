// Supabase client — null when the app is built without a configured backend,
// in which case all Galaxy features show their "not connected" states.
// The anon key is public by design; every access is enforced by RLS.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { IS_WEB } from "./platform";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          flowType: "pkce",
          persistSession: true,
          // web: supabase-js picks the OAuth code out of the URL itself;
          // desktop: we exchange the deep-link code manually
          detectSessionInUrl: IS_WEB,
        },
      })
    : null;

export const galaxyConfigured = supabase !== null;
