import { useState } from "react";
import { galaxyConfigured } from "../lib/supabase";
import { useSession } from "../stores/session";

export function AuthMenu() {
  const session = useSession((s) => s.session);
  const profile = useSession((s) => s.profile);
  const busy = useSession((s) => s.authBusy);
  const error = useSession((s) => s.authError);
  const notice = useSession((s) => s.authNotice);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (!galaxyConfigured) return null;

  if (session) {
    return (
      <div className="flex items-center gap-2">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="h-6 w-6 rounded-full border border-border" />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/30 text-[10px] font-bold">
            {(profile?.handle ?? "?").slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className="text-xs text-muted">@{profile?.handle ?? "…"}</span>
        <button className="btn-ghost text-xs" title="Sign out" onClick={() => void useSession.getState().signOut()}>
          ⏻
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button className="btn" onClick={() => setOpen((o) => !o)}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-72 rounded-2xl border border-border bg-[#0e1328] p-4 shadow-2xl">
          <button
            className="btn-primary w-full"
            disabled={busy}
            onClick={() => void useSession.getState().signInWithGitHub()}
          >
             Continue with GitHub
          </button>
          <div className="my-3 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted">
            <span className="h-px flex-1 bg-border" /> or email <span className="h-px flex-1 bg-border" />
          </div>
          <input
            className="mb-2 w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-xs outline-none focus:border-brand"
            placeholder="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="mb-3 w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-xs outline-none focus:border-brand"
            placeholder="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              className="btn flex-1"
              disabled={busy || !email || !password}
              onClick={async () => {
                const fn =
                  mode === "signin"
                    ? useSession.getState().signInWithEmail
                    : useSession.getState().signUpWithEmail;
                if (await fn(email, password)) setOpen(false);
              }}
            >
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
            <button
              className="btn-ghost text-[11px]"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "New here?" : "Have an account?"}
            </button>
          </div>
          {error && <p className="mt-2 text-[11px] leading-snug text-red-300">{error}</p>}
          {notice && <p className="mt-2 text-[11px] leading-snug text-emerald-300">{notice}</p>}
        </div>
      )}
    </div>
  );
}
