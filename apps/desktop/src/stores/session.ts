import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { openUrl } from "@tauri-apps/plugin-opener";
import { supabase } from "../lib/supabase";

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
    set({ authBusy: true, authError: null, authNotice: null });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ authBusy: false, authError: error?.message ?? null });
    return !error;
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
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  },

  completeOAuth: async (url) => {
    if (!supabase) return;
    const code = new URL(url).searchParams.get("code");
    if (!code) {
      set({ authBusy: false, authError: "Sign-in was cancelled" });
      return;
    }
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    set({ authBusy: false, authError: error?.message ?? null });
  },
}));

// keep the store in lock-step with supabase-js
if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    useSession.setState({ session, authBusy: false });
    if (session) {
      void loadProfile(session.user.id).then((profile) => useSession.setState({ profile }));
    } else {
      useSession.setState({ profile: null });
    }
  });
  void supabase.auth.getSession().then(({ data }) => {
    useSession.setState({ session: data.session });
    if (data.session) {
      void loadProfile(data.session.user.id).then((profile) => useSession.setState({ profile }));
    }
  });
}
