# Claude Galaxy — Setup Guide

Everything you need to run the desktop app, enable the Galaxy backend, and cut a release.
Steps marked **✅ done** are already configured; **▶ you** need action.
For the full production-build reference (per-OS outputs, signing, checklist) see
[DEV.md §8](DEV.md#8-build-production-installers-exe--dmg--appimage).

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
- Release builds ship **without DevTools** (compiled out, not just hidden).

### ▶ you — the 3-command production release
Builds Windows `.exe`/`.msi`, macOS `.dmg` (Apple Silicon + Intel), and Linux
`.AppImage`/`.deb` on GitHub's runners — no need for three machines:
```bash
# 1. bump "version" in apps/desktop/src-tauri/tauri.conf.json (e.g. 0.1.0 → 0.1.1)
git commit -am "chore: release v0.1.1"
# 2. tag it (the app-v* tag is what triggers the build)
git tag app-v0.1.1
# 3. push
git push origin main --tags
```
Watch **Actions → Desktop release**; ~10–15 min later a GitHub Release appears
with all installers + `latest.json`, and the site's Download page auto-fills.
To build a single platform locally instead, see [DEV.md §8a](DEV.md#8a-build-on-your-own-machine-fastest-for-one-platform).

### ▶ you — one-time safety + polish
1. **Back up the signing key** — copy `C:\Users\<you>\.tauri\claude-toolkit.key` (it has no password) somewhere safe. If lost, existing installs can never auto-update again.
2. **(Later) OS code signing** — until you buy a Windows cert (~$100+/yr) and/or Apple Developer ($99/yr), users click through SmartScreen/Gatekeeper warnings (documented on the download page). The release workflow has placeholders ready.

---

## 4. Phase 3 — access management (change requests + 30-min windows + admin)

Run the second migration (`supabase/migrations/20260709000002_phase3_access.sql`) — same as before: paste it into the Supabase **SQL Editor** and Run, or `supabase db push`. It's validated against Postgres 15 (9/9 RLS window checks pass, all 6 RPCs compile).

Two one-time steps in Supabase:
1. **Enable `pg_cron`** — Database → Extensions → search `pg_cron` → enable. The migration auto-schedules `expire-grants` to run every minute (it's a safe no-op if the extension isn't on — expiry is still enforced instantly by RLS on the server clock, the cron just cleans up + sends "expired" notifications).
2. **Make yourself an admin** (to see the ⚙ console) — Database → SQL Editor:
   ```sql
   update public.profiles set role='admin' where handle='<your-handle>';
   ```
   (Roles are immutable from the client by design; only SQL / another admin can set them.)

How it works in the app:
- On someone else's Galaxy item → **✋ Request changes**. The owner gets a 🔔 notification with **Grant 30 min / Deny**.
- While a grant is live: the grantee sees 🔓 + countdown and can edit/push; the owner sees 🔒 + countdown and is paused. When it expires, control reverts automatically.
- **⚙ Admin console**: users (promote/demote), live grants (force-revoke), toolkit moderation (active/hidden/banned), audit log.

Grant/deny/revoke/admin actions all run through security-definer RPCs that re-check permissions server-side, so the client can't bypass them.
