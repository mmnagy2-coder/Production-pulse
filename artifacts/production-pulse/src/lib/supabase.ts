import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set. Copy .env.example to .env and fill in your Supabase project details.",
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // The sign-in/sign-up pages are rendered by the app itself rather than
    // reached via a magic-link redirect, so there is no URL fragment to parse.
    detectSessionInUrl: false,
  },
});

/**
 * The current access token, refreshed if it has expired. Returns null when
 * signed out — callers treat that as "send the request unauthenticated".
 */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
