# DEV.md — run, configure, and develop Claude Toolkit

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
- **Authentication → URL Configuration → Redirect URLs** → add `claude-toolkit://auth-callback`.

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
   supabase secrets set EMAIL_FROM="Claude Toolkit <noreply@yourdomain>"
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

## 8. Build & release

```bash
pnpm --filter @claude-toolkit/desktop build      # frontend bundle
git tag app-v0.1.0 && git push --tags            # CI builds installers for win/mac/linux
```
The site's download page fills in automatically from the GitHub Release. Back up
`~/.tauri/claude-toolkit.key` — losing it breaks auto-updates for installed apps.

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
