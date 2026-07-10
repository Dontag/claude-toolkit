import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { openUrl } from "@tauri-apps/plugin-opener";
import { supabase } from "../lib/supabase";
import { IS_WEB } from "../lib/platform";

export interface Profile {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  role: "user" | "admin";
}

interface SessionState {
  session: Session | null;
  profile: Profile | null;
  authBusy: boolean;
  authError: string | null;
  authNotice: string | null;
  signInWithGitHub: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signUpWithEmail: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  /** Called from the claude-toolkit://auth-callback deep link. */
  completeOAuth: (url: string) => Promise<void>;
}

async function loadProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return (data as Profile | null) ?? null;
}

export const useSession = create<SessionState>((set) => ({
  session: null,
  profile: null,
  authBusy: false,
  authError: null,
  authNotice: null,

  signInWithGitHub: async () => {
    if (!supabase) return;
    set({ authBusy: true, authError: null, authNotice: null });
    if (IS_WEB) {
      // web: normal browser redirect flow — the page navigates to GitHub and back
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo: window.location.href.split("#")[0] },
      });
      if (error) set({ authBusy: false, authError: error.message });
      return;
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { skipBrowserRedirect: true, redirectTo: "claude-toolkit://auth-callback" },
    });
    if (error || !data.url) {
      const msg = /not enabled|unsupported provider/i.test(error?.message ?? "")
        ? "GitHub sign-in isn't enabled on this Supabase project yet. Enable it under Authentication → Sign In / Providers, or use email below."
        : (error?.message ?? "Could not start GitHub sign-in");
      set({ authBusy: false, authError: msg });
      return;
    }
    await openUrl(data.url); // system browser; the deep link brings the code back
  },

  signInWithEmail: async (email, password) => {
    if (!supabase) return false;
    if (!navigator.onLine) {
      set({ authError: "You're offline — connect to the internet to sign in" });
      return false;
    }
    set({ authBusy: true, authError: null, authNotice: null });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      const msg = /email not confirmed/i.test(error?.message ?? "")
        ? "Email not confirmed. Check your inbox, or turn off 'Confirm email' in Supabase for testing."
        : (error?.message ?? null);
      set({ authBusy: false, authError: msg });
      return !error;
    } catch {
      set({ authBusy: false, authError: "Sign-in failed — check your connection and retry" });
      return false;
    }
  },

  signUpWithEmail: async (email, password) => {
    if (!supabase) return false;
    set({ authBusy: true, authError: null, authNotice: null });
    const { data, error } = await supabase.auth.signUp({ email, password });
    // when "Confirm email" is on, signUp returns a user but no session
    if (!error && data.user && !data.session) {
      set({ authBusy: false, authNotice: "Account created — check your email to confirm, then sign in." });
      return false; // keep the menu open on the sign-in tab
    }
    set({ authBusy: false, authError: error?.message ?? null });
    return !error;
  },

  signOut: async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
    } catch {
      /* offline: server revoke failed, but still sign out locally */
    }
    set({ session: null, profile: null });
  },

  completeOAuth: async (url) => {
    if (!supabase) return;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      set({ authBusy: false, authError: "Received a malformed sign-in link" });
      return;
    }
    // Supabase appends ?error=...&error_description=... on provider failure
    const params = parsed.searchParams;
    const err = params.get("error_description") ?? params.get("error");
    if (err) {
      set({ authBusy: false, authError: decodeURIComponent(err.replace(/\+/g, " ")) });
      return;
    }
    const code = params.get("code");
    if (!code) {
      set({ authBusy: false, authError: "Sign-in was cancelled or timed out" });
      return;
    }
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      set({ authBusy: false, authError: error?.message ?? null });
    } catch {
      set({ authBusy: false, authError: "Couldn't complete sign-in — check your connection and retry" });
    }
  },
}));

async function safeLoadProfile(userId: string) {
  try {
    const profile = await loadProfile(userId);
    useSession.setState({ profile });
  } catch {
    /* profile fetch can fail offline; session still valid, retry on next event */
  }
}

// keep the store in lock-step with supabase-js
if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    useSession.setState({ session, authBusy: false });
    if (session) void safeLoadProfile(session.user.id);
    else useSession.setState({ profile: null });
    // a failed silent token refresh signs the user out — tell them why
    if (event === "SIGNED_OUT") useSession.setState({ authNotice: null });
  });
  supabase.auth.getSession().then(
    ({ data }) => {
      useSession.setState({ session: data.session });
      if (data.session) void safeLoadProfile(data.session.user.id);
    },
    () => {
      /* offline at boot — onAuthStateChange will catch up when back online */
    },
  );
}
