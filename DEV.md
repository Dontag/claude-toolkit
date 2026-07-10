# DEV.md — run, configure, and develop Claude Galaxy

Step-by-step for running the desktop app locally, wiring the backend, and the
feature flags. Companion to [SETUP.md](SETUP.md) (which is the shorter "turn it
on" guide). This file is the detailed reference.

---

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node | 22+ | `node -v` |
| pnpm | 10+ | `npm i -g pnpm` |
| Rust | pinned 1.93 | auto-selected by `apps/desktop/src-tauri/rust-toolchain.toml`; installed via rustup |
| MSVC build tools | any recent | Windows linker (VS Build Tools) |
| Docker | optional | only for validating SQL migrations locally |

Install everything JS:
```bash
pnpm install            # at the repo root — installs all workspaces
```

---

## 2. Run the desktop app (dev)

```powershell
cd apps\desktop
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"   # if a fresh shell can't find cargo
$env:RUST_MIN_STACK = "33554432"                       # this machine needs bigger compiler stacks
pnpm tauri dev
```

- First run compiles the Rust shell (~1–2 min); later runs are fast.
- Closing the window **fully exits in dev** (frees port 1420, releases the exe).
- DevTools auto-opens in dev builds.
- If port 1420 is stuck from a previous run: close the old window, or kill the
  `node`/`desktop.exe` process.

Without any `.env`, the app runs fully offline: the **Personal Space** tree
binds to your real `~/.claude` folder (or shows demo data with a "Set up
~/.claude" button if the folder doesn't exist), and the **Galaxy** tab shows a
"backend not configured" card.

---

## 3. Configure the Galaxy backend (Supabase)

### 3a. Project + migrations
1. Create a free project at supabase.com.
2. **SQL Editor → New query** → paste and Run each migration **in order**:
   - `supabase/migrations/20260709000001_phase2_core.sql` (accounts, toolkits, items, versions)
   - `supabase/migrations/20260709000002_phase3_access.sql` (change requests, 30-min grants, admin)
   - `supabase/migrations/20260710000003_phase4_proposals.sql` (propose-and-approve editing)
   (Or with the CLI: `supabase link --project-ref <ref> && supabase db push`.)

### 3b. Auth
- **Authentication → Sign In / Providers → Email**: enable. For testing, **uncheck "Confirm email"**.
- **GitHub** (optional): create a GitHub OAuth app —
  - Homepage URL: `https://dontag.github.io/claude-toolkit`
  - Authorization callback URL: `https://<your-ref>.supabase.co/auth/v1/callback` (copy from the Supabase GitHub provider page)
  - paste Client ID + secret into Supabase → GitHub → enable.
- **Authentication → URL Configuration → Redirect URLs** → add **both**:
  - `claude-toolkit://auth-callback` (desktop deep link)
  - `https://dontag.github.io/claude-toolkit/app/` (the web/Galaxy-only build)
- For the web app's GitHub OAuth to return correctly, also make sure the GitHub
  OAuth app's callback stays the Supabase one (`…/auth/v1/callback`) — Supabase
  redirects on to whichever site URL initiated it.

### Web (Galaxy-only) build
The same app runs in a browser with Personal Space hidden. CI builds it via
`pnpm --filter @claude-toolkit/desktop build:web` and mounts it at
`/claude-toolkit/app/`. It reads Supabase creds from the repo **Variables**
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (Settings → Secrets and variables
→ Actions → Variables). Run locally with `pnpm --filter @claude-toolkit/desktop dev`
in a browser at `http://localhost:1420`.

### 3c. Extensions (Phase 3)
- **Database → Extensions → enable `pg_cron`**. The migration auto-schedules the
  grant-expiry sweep. It's a safe no-op if the extension is off — expiry is still
  enforced instantly by RLS on the server clock; the cron only cleans up + sends
  "expired" notifications.

### 3d. Make yourself an admin (for the ⚙ Admin console)
```sql
update public.profiles set role='admin' where handle='<your-handle>';
```
(Roles are immutable from the client by design.)

---

## 4. Environment variables — `apps/desktop/.env`

Copy `apps/desktop/.env.example` → `apps/desktop/.env` and fill in:

```env
# Supabase (from Settings → API). Anon/publishable key is public by design.
VITE_SUPABASE_URL=https://YOUR-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-OR-PUBLISHABLE-KEY

# Feature flags — turn functionality on/off without code changes:
VITE_ENABLE_NOTIFICATIONS=true   # in-app 🔔 alerts for requests/grants/proposals
VITE_ENABLE_EMAIL=false          # email alerts — needs the notify-email function + provider
```

- These are **build-time defaults**. At runtime you can override both from the
  in-app **⚙ Config** panel (persisted per-machine in localStorage).
- After changing `.env`, restart `pnpm tauri dev` (Vite reads it at startup).

---

## 5. Email notifications (optional — off by default)

You said you don't have an email subscription, so leave `VITE_ENABLE_EMAIL=false`
and skip this. When you're ready:

1. Get an email provider key (e.g. [Resend](https://resend.com)).
2. Set secrets + deploy the edge function:
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxx
   supabase secrets set EMAIL_FROM="Claude Galaxy <noreply@yourdomain>"
   supabase functions deploy notify-email
   ```
3. Fire it on new pending proposals — Supabase → **Database → Webhooks → Create**:
   - Table: `notifications`, Events: `INSERT`
   - Type: Supabase Edge Function → `notify-email`
   The function ignores everything except `proposal_pending` rows and no-ops if
   `RESEND_API_KEY` is unset, so it's safe.
4. Flip `VITE_ENABLE_EMAIL=true` and rebuild.

The in-app notification center works with or without email.

---

## 6. How the features work (quick tour)

- **Personal Space** — your `~/.claude` tree, live. **✚ Add** creates a skill /
  agent / command / hook from a picked file or pasted text. Click a fruit to
  view / edit / delete or **🌌 Share to Galaxy**.
- **🔒 Locked / 🧭 Free** — toggle center-lock. Free = right-drag or Shift+drag
  to pan and fly around either canvas.
- **Galaxy** — one **solar system per user** around a central **black hole**;
  each shared item is a planet grouped into per-kind orbital lanes. Click a
  planet → **Graft** it onto your tree, **✋ Request changes**, or (if you hold a
  grant) **✏️ Edit (propose)**.
- **Change windows** — request → owner grants a **30-minute exclusive window**
  (🔒 for the owner, 🔓 for you). Your edit is submitted as a **proposal**; the
  owner sees it in 🔔, reviews the content, and **Approve replaces** their item
  (locally + in the Galaxy) or **Reject** discards it. A proposal can't be empty.
- **⚙ Config** — notifications/email/free-nav toggles, environment status,
  open-folder, and **Report an issue**.
- **⚙ Admin** (admins only) — users, live grants (force-revoke), moderation,
  audit log.

---

## 7. Validate SQL migrations locally (optional)

```bash
docker run -d --rm --name pg -e POSTGRES_PASSWORD=x postgres:15
# apply an auth stub + the three migrations, then run ad-hoc RLS tests
# (see git history for the exact test scripts; 9/9 window checks + 8/8 proposal checks pass)
docker stop pg
```

---

## 8. Build production installers (.exe / .dmg / .AppImage)

Production builds are **release** builds: optimized (`lto`, `strip`), and with
**no DevTools compiled in** — the inspector, F12, and right-click *Inspect* are
all gone (the `open_devtools()` call is `#[cfg(debug_assertions)]`-gated and the
`tauri` crate's `devtools` feature is off in `Cargo.toml`). Closing the window
hides to the tray instead of exiting, so the `~/.claude` watcher keeps running.

### 8a. Build on your own machine (fastest for one platform)

Each OS's installer must be built **on that OS** (Tauri can't cross-compile the
webview). On this Windows machine:

```powershell
cd apps\desktop
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"   # if cargo isn't found
$env:RUST_MIN_STACK = "33554432"                       # this machine needs it
# Optional: sign the updater artifacts (see 8c). Without these two vars the
# build still succeeds; it just won't emit .sig files / latest.json.
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content "$env:USERPROFILE\.tauri\claude-toolkit.key" -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""            # this key has no password
pnpm tauri build
```

Artifacts land in `apps/desktop/src-tauri/target/release/bundle/`:

| OS | Build on | Output (under `bundle/`) |
|---|---|---|
| **Windows** | Windows | `msi/Claude Galaxy_<ver>_x64_en-US.msi` and `nsis/Claude Galaxy_<ver>_x64-setup.exe` |
| **macOS** | macOS | `dmg/Claude Galaxy_<ver>_<arch>.dmg` and `macos/Claude Galaxy.app` |
| **Linux** | Linux | `appimage/Claude Galaxy_<ver>_amd64.AppImage` and `deb/…_amd64.deb` |

macOS notes: build `--target aarch64-apple-darwin` (Apple Silicon) and
`--target x86_64-apple-darwin` (Intel) separately, or `universal-apple-darwin`
for a fat binary. Linux needs `libwebkit2gtk-4.1-dev libappindicator3-dev
librsvg2-dev patchelf` (see the CI workflow for the exact apt list).

Just the frontend bundle (no installer): `pnpm --filter @claude-toolkit/desktop build`.

### 8b. Build all three platforms at once (recommended — via CI)

You don't need three machines. The [`desktop-release.yml`](.github/workflows/desktop-release.yml)
workflow builds Windows + macOS (arm64 & Intel) + Linux on GitHub's runners and
publishes a **GitHub Release** with all installers and the updater `latest.json`:

```bash
# bump the version in apps/desktop/src-tauri/tauri.conf.json first (e.g. 0.1.0 → 0.1.1)
git commit -am "chore: release v0.1.1"
git tag app-v0.1.1
git push origin main --tags        # the tag push triggers the build
```

Watch it under the repo's **Actions** tab; ~10–15 min later the Release appears
and the site's **Download** page fills in automatically from it. You can also run
it manually from **Actions → Desktop release → Run workflow** (workflow_dispatch).

### 8c. Signing — two independent things

1. **Updater signing (already set up).** Ensures the auto-updater only installs
   artifacts you signed. The keypair exists; the public key is embedded in
   `tauri.conf.json`, and the private key is the repo secret
   `TAURI_SIGNING_PRIVATE_KEY` (CI uses it automatically). **Back up
   `~/.tauri/claude-toolkit.key`** — if lost, every installed app can *never
   auto-update again*.
2. **OS code signing (not set up — optional).** Without an Apple Developer cert
   ($99/yr) or a Windows Authenticode cert (~$100+/yr), installers are unsigned,
   so first launch shows **Windows SmartScreen** ("More info → Run anyway") or
   **macOS Gatekeeper** (right-click → Open). This is expected and documented on
   the download page. When you buy certs, uncomment the `APPLE_CERTIFICATE` /
   `WINDOWS_CERTIFICATE` env in `desktop-release.yml`.

### 8d. Pre-release checklist

- [ ] `pnpm --filter @claude-toolkit/desktop typecheck` and `… test` pass.
- [ ] Version bumped in `apps/desktop/src-tauri/tauri.conf.json` (drives the tag).
- [ ] `apps/desktop/.env` is **not** required for a build — but the Galaxy only
      works in the shipped app if `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
      were present at build time (CI reads them from repo **Variables**).
- [ ] Signing key backed up (8c).
- [ ] Smoke-test the built installer on a clean machine/VM before announcing.

---

## 9. Common issues

| Symptom | Fix |
|---|---|
| `cargo not found` | `$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"` or reopen terminal |
| rustc crash building Tauri | ensured by the pinned 1.93 toolchain + `RUST_MIN_STACK=33554432` |
| Port 1420 in use | close the old app window / kill `node`/`desktop.exe` |
| Blank window | should be fixed; if it recurs, DevTools auto-opens in dev — check the console |
| GitHub sign-in error | that provider isn't enabled in Supabase yet; use email, or enable it |
| Email not confirmed | uncheck "Confirm email" in Supabase for testing |
| Galaxy empty | share an item from Personal Space; multi-user needs a 2nd account on a 2nd machine |
