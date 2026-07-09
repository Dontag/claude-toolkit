# Claude Dev Toolkit

A drop-in `.claude/` productivity pack **and** a desktop app that renders your Claude setup as a living 3D world.

- **The toolkit** — skills, subagents, hooks, and slash commands covering design → build → test → review → ship → patch/tickets, plus token-saving rules.
- **The desktop app** (`apps/desktop`, Tauri) — your `~/.claude` folder as a 3D tree that updates live; a **Galaxy** where each user is a solar system of shared items orbiting a black hole; per-item sharing, 30-minute exclusive edit windows, and propose-and-approve editing.
- **The site** (`apps/site`, Astro) — auto-deployed marketing/download page.

### 📖 Guides
- **[DEV.md](DEV.md)** — full step-by-step: run the app, configure Supabase, env vars & feature flags, email, troubleshooting.
- **[SETUP.md](SETUP.md)** — the short "turn the Galaxy on" checklist.

Quick start for the desktop app:
```bash
pnpm install
cd apps/desktop && pnpm tauri dev      # runs offline; add a .env for the Galaxy (see DEV.md)
```

## Install (toolkit only)

Copy the contents into your project's `.claude/` folder (or `~/.claude/` for global use):

```
your-project/
└── .claude/
    ├── CLAUDE.md          ← merge into your existing CLAUDE.md (or copy as-is)
    ├── skills/            ← copy the whole folder
    ├── agents/            ← copy the whole folder
    ├── commands/          ← copy the whole folder
    └── settings.json      ← merge the "hooks" block from hooks/settings-hooks.json
```

Notes:
- **Skills** live at `.claude/skills/<name>/SKILL.md` — the folder structure here already matches; copy as-is.
- **Agents** live at `.claude/agents/<name>.md` — copy as-is.
- **Commands** live at `.claude/commands/<name>.md` — copy as-is; use as `/fix-ticket`, `/ship`, `/ui-audit`.
- **Hooks** are configured in `settings.json`, not standalone .md files. Open `hooks/settings-hooks.json`, merge the `hooks` key into your `.claude/settings.json`. `hooks/HOOKS.md` explains each one.
- For global availability put skills/agents in `~/.claude/skills/` and `~/.claude/agents/`.

## What's inside

| Type | Name | Purpose |
|---|---|---|
| Skill | `headsoff` | Context-overload detector: saves a handoff brief and tells you to start a fresh session |
| Skill | `ui-ux-master` | World-class UI/UX: layouts, color palettes, typography, accessibility, feature patterns |
| Skill | `motion-animation` | Production-grade animation: easing, physics, micro-interactions, 3D |
| Skill | `backend-architect` | Picks the right backend per project type; diagnosis + auto-fix playbooks for every major language |
| Skill | `ticket-workflow` | Patch/ticket-based work: reproduce → minimal fix → test → PR, with MCP integration |
| Skill | `testing-qa` | Test strategy, framework commands, flaky-test handling, coverage discipline |
| Skill | `token-saver` | Hard rules that cut token spend on every task |
| Skill | `tech-radar` | "Engineer mind": verify-before-use habit, syntax/version drift detection, learning log |
| Skill | `prd-writer` | Idea → build-ready PRD: stories, acceptance criteria, M0 slice |
| Skill | `web-perf` | Core Web Vitals, bundle budgets, FPS — measure-first client performance |
| Agent | `ui-designer` | Frontend + design specialist |
| Agent | `backend-engineer` | Polyglot backend specialist |
| Agent | `bug-fixer` | Ticket-driven minimal-diff patcher |
| Agent | `test-runner` | Runs tests, fixes failures, never touches product logic |
| Agent | `code-reviewer` | Review gate before merge |
| Agent | `release-manager` | Versioning, changelog, deploy checklist |
| Agent | `tech-scout` | Researches new tech/syntax changes, updates the learning log |
| Agent | `security-auditor` | Deep security sweep before releases (secrets, injection, authz, deps) |
| Agent | `docs-writer` | READMEs, API docs, ADRs — derived from code, commands verified |
| Command | `/fix-ticket` | End-to-end ticket resolution pipeline |
| Command | `/ship` | Pre-release pipeline: test → review → changelog → tag |
| Command | `/ui-audit` | Audit a screen/component against the UI/UX skill |
| Command | `/standup` | Daily summary: shipped, in flight, blocked, next actions |
| Command | `/new-feature` | Idea → PRD → build → test → review, end to end |
| Hooks | see `hooks/` | Auto-format on edit, block dangerous commands, context-size warning, dashboard logger |
| Dashboard | `dashboard/index.html` | 3D rotatable skill tree with physics, changelog, token-savings stats |

## Dashboard

Open `dashboard/index.html` directly in any browser (no server needed).
- Drag to rotate the 3D tree, scroll to zoom; click a foliage cloud (or a legend chip) to fly into that group — skills, agents, hooks, commands each grow on their own cluster.
- Search box (top-left): type a name and press Enter — the camera flies to the matching apple and opens its summary.
- Each fruit = a skill/agent/hook. Click one → details popup → Remove (with confirmation) → apple falls with gravity and fades.
- Dark bioluminescent theme: the tree glows in the dark (additive particle foliage, canopy lights, fireflies).
- Mobile-friendly: one finger rotates, two fingers pinch-zoom, panel becomes a full-screen slide-over.
- Side panel: changelog of what was done, new additions, and tokens saved (animated counters).
- To add entries, edit `dashboard/data.js` — the format is documented at the top of that file. The `session-logger` hook shows how to append automatically.

### Two modes
- **Local** (opened via `file://` or `localhost`): full mode — you can remove items (apple-fall) and restore them. Removals persist in your browser's localStorage; the actual `.md` skill files in your Claude folder are managed separately (by you or Claude) — `data.js` is the single source the tree renders from.
- **Hosted** (GitHub Pages or any `https://` domain): automatically view-only. Remove/Restore are disabled and a 🔒 badge shows; everyone can browse the tree, changelog, and stats but can't change anything.

### Publishing — automatic
The site deploys itself. `.github/workflows/site.yml` runs on every push to `main` (and on each app release): it regenerates the toolkit inventory from `skills/`, `agents/`, `commands/`, `hooks/`, pulls release download links from the GitHub API, builds the Astro site in `apps/site/`, and deploys to GitHub Pages — zero manual editing. One-time setup: repo → Settings → Pages → Source: **GitHub Actions**.

- Marketing/download site: `https://<user>.github.io/<repo>/`
- Legacy 3D dashboard (kept working): `https://<user>.github.io/<repo>/dashboard/`

## Monorepo layout

The repo is evolving into a desktop product (Tauri v2 app + Supabase backend). Structure:

| Path | What |
|---|---|
| `skills/` `agents/` `commands/` `hooks/` | The toolkit content (unchanged — copy into `.claude/`) |
| `dashboard/` | Legacy single-file 3D web demo (frozen) |
| `activity/changelog.jsonl` | Append-only activity log (session-logger hook writes here) |
| `apps/site/` | Astro marketing/download site (auto-deployed to Pages) |
| `apps/desktop/` | Tauri v2 desktop app — the 3D tree bound to your real `~/.claude` |
| `packages/core/` | Shared TypeScript: schemas, frontmatter parser, source interfaces |
| `scripts/generate-inventory.mjs` | Scans toolkit content → `inventory.json` (site + app demo data) |

Dev: `pnpm install`, then `pnpm generate && pnpm --filter @claude-toolkit/site dev` for the site.

### Desktop dev

```bash
pnpm --filter @claude-toolkit/desktop tauri dev    # needs Rust (pinned via rust-toolchain.toml)
```

### Galaxy backend (Supabase)

The Galaxy tab (shared universe, per-item publishing, realtime comets) needs a Supabase project:

1. Create a free project at supabase.com → run the migration: `supabase link --project-ref <ref> && supabase db push` (or paste `supabase/migrations/*.sql` into the SQL editor).
2. Auth → Providers: enable **GitHub** (create a GitHub OAuth app; callback URL comes from the Supabase dashboard) and **Email**. Add `claude-toolkit://auth-callback` to Auth → URL Configuration → Redirect URLs.
3. Copy `apps/desktop/.env.example` to `.env`, fill in the project URL + anon key, rebuild.

Without the env vars the app builds fine and the Galaxy tab shows setup instructions.
