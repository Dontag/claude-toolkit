<div align="center">

# 🌌 Claude Galaxy

**Your Claude Code setup as a living 3D world** — a drop-in `.claude/` productivity pack **and** a desktop app that grows your `~/.claude` folder into a tree, and shares it in a galaxy.

<p>
  <a href="https://dontag.github.io/claude-toolkit/"><img alt="Visit the site" src="https://img.shields.io/badge/%F0%9F%8C%90%20Visit%20the%20Site-8f83ff?style=for-the-badge&labelColor=0b0f22"></a>
  &nbsp;
  <a href="https://dontag.github.io/claude-toolkit/download"><img alt="Download" src="https://img.shields.io/badge/%E2%AC%87%20Download-7ce7f5?style=for-the-badge&labelColor=0b0f22"></a>
  &nbsp;
  <a href="https://dontag.github.io/claude-toolkit/app/"><img alt="Explore online" src="https://img.shields.io/badge/%F0%9F%9A%80%20Explore%20Online-d94bd0?style=for-the-badge&labelColor=0b0f22"></a>
</p>

<p>
  <a href="SETUP.md"><img alt="Setup guide" src="https://img.shields.io/badge/%E2%9A%99%20Setup%20Guide-1f2a4d?style=flat-square"></a>
  <a href="DEV.md"><img alt="Dev guide" src="https://img.shields.io/badge/%F0%9F%93%96%20Dev%20Guide-1f2a4d?style=flat-square"></a>
  <img alt="Tauri v2" src="https://img.shields.io/badge/Tauri-v2-24C8DB?style=flat-square">
  <img alt="React + TypeScript" src="https://img.shields.io/badge/React%20%2B%20TS-strict-3178C6?style=flat-square">
</p>

</div>

---

## What is it?

Claude Galaxy has three parts you can use independently:

| | Part | What it gives you |
|:-:|---|---|
| 🧰 | **The toolkit** | Skills, subagents, hooks & slash commands covering design → build → test → review → ship → patch, plus token-saving rules. Drop into any `.claude/` folder. |
| 🌳 | **The desktop app** (`apps/desktop`) | Your `~/.claude` folder rendered as a living 3D tree that updates the moment files change — add a file, a fruit grows; delete one, it falls. |
| 🌌 | **The Galaxy** | Sign in and every creator becomes a solar system of shared items orbiting a black hole: one-toggle sharing, 30-minute exclusive edit windows, and propose-and-approve editing. |

> 👉 **See it live:** [dontag.github.io/claude-toolkit](https://dontag.github.io/claude-toolkit/) · or [explore the Galaxy in your browser](https://dontag.github.io/claude-toolkit/app/).

---

## Quick start

**Use the toolkit** — copy the content into your project's `.claude/` (or `~/.claude/` for global use):

```
your-project/.claude/
├── CLAUDE.md          ← merge into your existing CLAUDE.md (or copy as-is)
├── skills/            ← copy the whole folder  →  .claude/skills/<name>/SKILL.md
├── agents/            ← copy the whole folder  →  .claude/agents/<name>.md
├── commands/          ← copy the whole folder  →  use as /fix-ticket, /ship, /ui-audit
└── settings.json      ← merge the "hooks" block from hooks/settings-hooks.json
```

**Run the desktop app** — needs Node 22 + pnpm 10 + Rust (auto-pinned):

```bash
pnpm install
cd apps/desktop && pnpm tauri dev      # runs offline; add a .env for the Galaxy
```

That's the 30-second version. For everything else:

- 🚀 **[SETUP.md](SETUP.md)** — the short "turn the Galaxy on" checklist + how to cut a release.
- 🛠️ **[DEV.md](DEV.md)** — full reference: run, configure Supabase, env vars & flags, production builds, site deploy, troubleshooting.

---

## What's inside the toolkit

<table>
<tr><th>Skills</th><th>Agents</th><th>Commands</th></tr>
<tr valign="top"><td>

- `headsoff` — context-overload guard
- `ui-ux-master` — world-class UI/UX
- `motion-animation` — animation & 3D
- `backend-architect` — stack + fix playbooks
- `ticket-workflow` — reproduce → fix → PR
- `testing-qa` — test strategy & coverage
- `token-saver` — cut token spend
- `tech-radar` — verify-before-use loop
- `prd-writer` — idea → build-ready PRD
- `web-perf` — Core Web Vitals & FPS

</td><td>

- `ui-designer` — frontend + design
- `backend-engineer` — polyglot backend
- `bug-fixer` — minimal-diff patcher
- `test-runner` — runs & fixes tests
- `code-reviewer` — pre-merge gate
- `release-manager` — versioning & changelog
- `tech-scout` — researches new tech
- `security-auditor` — pre-release sweep
- `docs-writer` — READMEs, ADRs

</td><td>

- `/fix-ticket` — ticket → fix → PR
- `/ship` — test → review → tag
- `/ui-audit` — audit a screen
- `/standup` — daily summary
- `/new-feature` — idea → shipped

**Hooks** (`hooks/`)
auto-format on edit · block dangerous
commands · context-size warning ·
dashboard logger

</td></tr>
</table>

Full descriptions live in each item's file; hooks are explained in [`hooks/HOOKS.md`](hooks/HOOKS.md).

---

## Repo layout

| Path | What |
|---|---|
| `skills/` `agents/` `commands/` `hooks/` | The toolkit content — copy into `.claude/` |
| `apps/desktop/` | Tauri v2 desktop app — the 3D tree bound to your real `~/.claude` |
| `apps/site/` | Astro marketing/download site (auto-deployed to GitHub Pages) |
| `packages/core/` | Shared TypeScript: schemas, frontmatter parser, source interfaces |
| `dashboard/` | Legacy single-file 3D web demo (frozen, still hosted) |
| `supabase/migrations/` | Galaxy backend schema (accounts, sharing, grants, proposals) |
| `scripts/generate-inventory.mjs` | Scans toolkit content → `inventory.json` (site + app demo data) |

The site deploys itself on every push to `main` — details in **[DEV.md §9](DEV.md#9-site-deployment-github-pages--automatic)**.

---

<div align="center">

Open source · Built with Claude Code · Crafted by **Nishad Patil**

<a href="https://dontag.github.io/claude-toolkit/"><img alt="Visit the site" src="https://img.shields.io/badge/%F0%9F%8C%8C%20Launch%20Claude%20Galaxy-8f83ff?style=for-the-badge&labelColor=0b0f22"></a>

</div>
