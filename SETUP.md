# Claude Toolkit — Setup Guide

Everything you need to run the desktop app, enable the Galaxy backend, and cut a release.
Steps marked **✅ done** are already configured; **▶ you** need action.

---

## 0. Prerequisites (✅ done on this machine)

- Node 22, pnpm 10 — `pnpm install` at the repo root pulls all workspaces.
- Rust (pinned to 1.93 via `apps/desktop/src-tauri/rust-toolchain.toml`) + MSVC linker.
- If a fresh terminal can't find `cargo`: `~/.cargo/bin` is on your user PATH — just reopen the terminal.

Run the app in dev:
```powershell
cd apps\desktop
$env:RUST_MIN_STACK = "33554432"     # this machine needs bigger compiler stacks
pnpm tauri dev
```
Closing the window fully exits in dev (frees port 1420). First build ~1 min.

---

## 1. Supabase backend (for the Galaxy tab)

### 1a. Project + schema — ✅ done
- Project created; `supabase/migrations/20260709000001_phase2_core.sql` applied.
- Verified live: profiles/toolkits/items tables exist, signup trigger creates a profile + default toolkit.

### 1b. Email sign-in — ▶ you (1 setting)
Dashboard → **Authentication → Sign In / Providers → Email**:
- For testing: **uncheck "Confirm email"** → Save. (Lets you sign in immediately without a confirmation link. Re-enable before going public.)

### 1c. GitHub sign-in — ▶ you (optional, ~5 min)
1. GitHub → Settings → Developer settings → **OAuth Apps → New OAuth App**:
   - Application name: `Claude Toolkit`
   - Homepage URL: `https://dontag.github.io/claude-toolkit`
   - **Authorization callback URL**: copy it from Supabase → Authentication → Sign In / Providers → GitHub (looks like `https://<ref>.supabase.co/auth/v1/callback`).
2. Copy the **Client ID** + generate a **Client secret**.
3. Supabase → **Sign In / Providers → GitHub** → enable, paste Client ID + secret → Save.

### 1d. Redirect URL for the desktop app — ▶ you
Supabase → **Authentication → URL Configuration → Redirect URLs** → **Add** `claude-toolkit://auth-callback` → Save.
(Required for the OAuth deep link to return into the app.)

### 1e. App env — ✅ done
`apps/desktop/.env` holds your project URL + anon key. If you ever rotate keys, update it and rebuild.

---

## 2. Test checklist

1. `pnpm tauri dev` → dark 3D tree renders (Personal Space).
2. Add/edit/delete a file in `C:\Users\<you>\.claude\skills\...` → a fruit grows / updates / falls live.
3. **Sign in** (top-right) → email/password (or GitHub).
4. Pick a fruit → **Share to Galaxy** toggle → it appears in the **Galaxy** tab as your star system.
5. Edit that skill with **Sync** on → a comet fires, a new version pushes.
6. Galaxy tab → click a planet → **Graft onto my tree** → file lands in your `.claude`.

**Multi-user** (comets from others, other people's stars) needs a second account on a **second machine** — a single machine can't fully exercise realtime presence.

---

## 3. Releasing installers (when ready)

### ✅ done
- GitHub Pages set to deploy from Actions; the marketing/download site auto-builds on every push.
- Updater signing keypair generated; `TAURI_SIGNING_PRIVATE_KEY` secret set on the repo; public key embedded in `tauri.conf.json`.

### ▶ you
1. **Back up the signing key** — copy `C:\Users\<you>\.tauri\claude-toolkit.key` (and remember it has no password) somewhere safe. If lost, existing installs can never auto-update again.
2. **Cut a release**: `git tag app-v0.1.0 && git push --tags`. CI builds Windows/macOS/Linux installers, publishes a GitHub Release, and the download page fills in automatically.
3. **(Later) OS code signing** — until you buy a Windows cert (~$100+/yr) and/or Apple Developer ($99/yr), users click through SmartScreen/Gatekeeper warnings (documented on the download page). The release workflow has placeholders ready.

---

## 4. Coming in Phase 3 (not needed yet)

Change-requests + 30-minute exclusive write windows + admin panel will add:
- More migrations (`change_requests`, `access_grants`, `audit_log`) — same `supabase db push` flow.
- A **pg_cron** job to expire grants — enable the `pg_cron` extension in Supabase → Database → Extensions.
- Edge Functions for atomic grant/admin actions — needs the Supabase CLI + your service-role key (I'll walk you through it).
