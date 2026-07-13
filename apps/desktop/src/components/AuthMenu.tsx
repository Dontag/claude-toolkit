import { useEffect, useRef, useState } from "react";
import { galaxyConfigured } from "../lib/supabase";
import { useSession } from "../stores/session";
import { confirm } from "../stores/confirm";
import { useClickOutside } from "../lib/useClickOutside";
import { Spinner } from "./Spinner";

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
  const [signingOut, setSigningOut] = useState(false);
  // which action is in flight, so ONLY that button spins (not every one)
  const [pending, setPending] = useState<"github" | "email" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useClickOutside(rootRef, () => setOpen(false), open);

  // the shared authBusy flag clearing means the attempt finished
  useEffect(() => {
    if (!busy) setPending(null);
  }, [busy]);

  const submit = async () => {
    if (busy || !email || !password) return;
    setPending("email");
    const fn = mode === "signin" ? useSession.getState().signInWithEmail : useSession.getState().signUpWithEmail;
    if (await fn(email, password)) setOpen(false);
  };

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
        {/* handle hides on phones to keep the header on one row; avatar remains */}
        <span className="hidden items-center gap-1 text-xs text-muted sm:flex">
          @{profile?.handle ?? "…"}
          {!profile && <Spinner className="h-3 w-3" />}
        </span>
        <button
          className="btn-ghost flex items-center justify-center text-xs disabled:opacity-60"
          title="Sign out"
          disabled={signingOut}
          onClick={async () => {
            const ok = await confirm({
              title: "Sign out?",
              message: "You'll stay signed in on the web, but the Galaxy will go view-only here until you sign back in.",
              confirmLabel: "Sign out",
              danger: true,
            });
            if (!ok) return;
            setSigningOut(true);
            await useSession.getState().signOut();
            setSigningOut(false); // usually unmounts first, but reset if it doesn't
          }}
        >
          {signingOut ? <Spinner /> : "⏻"}
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={rootRef}>
      <button className="btn flex items-center gap-1.5" onClick={() => setOpen((o) => !o)}>
        {busy && !open && <Spinner />}
        {busy && !open ? "Signing in…" : "Sign in"}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-72 rounded-2xl border border-border bg-[#0e1328] p-4 shadow-2xl">
          <button
            className="btn-primary flex w-full items-center justify-center gap-2"
            disabled={busy}
            onClick={() => {
              setPending("github");
              void useSession.getState().signInWithGitHub();
            }}
          >
            {pending === "github" && <Spinner />}
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
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
          />
          <div className="flex gap-2">
            <button
              className="btn flex flex-1 items-center justify-center gap-1.5"
              disabled={busy || !email || !password}
              onClick={() => void submit()}
            >
              {pending === "email" && <Spinner />}
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
