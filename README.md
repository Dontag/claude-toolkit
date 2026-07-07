# Claude Dev Toolkit

A drop-in `.claude/` productivity pack: skills, subagents, hooks, and slash commands covering the full development lifecycle — design → build → test → review → ship → patch/tickets — plus token-saving rules and a 3D skill-tree dashboard.

## Install

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
| Agent | `ui-designer` | Frontend + design specialist |
| Agent | `backend-engineer` | Polyglot backend specialist |
| Agent | `bug-fixer` | Ticket-driven minimal-diff patcher |
| Agent | `test-runner` | Runs tests, fixes failures, never touches product logic |
| Agent | `code-reviewer` | Review gate before merge |
| Agent | `release-manager` | Versioning, changelog, deploy checklist |
| Agent | `tech-scout` | Researches new tech/syntax changes, updates the learning log |
| Command | `/fix-ticket` | End-to-end ticket resolution pipeline |
| Command | `/ship` | Pre-release pipeline: test → review → changelog → tag |
| Command | `/ui-audit` | Audit a screen/component against the UI/UX skill |
| Hooks | see `hooks/` | Auto-format on edit, block dangerous commands, context-size warning, dashboard logger |
| Dashboard | `dashboard/index.html` | 3D rotatable skill tree with physics, changelog, token-savings stats |

## Dashboard

Open `dashboard/index.html` directly in any browser (no server needed).
- Drag to rotate the 3D tree, scroll to zoom; click a foliage cloud (or a legend chip) to fly into that group — skills, agents, hooks, commands each grow on their own cluster.
- Each fruit = a skill/agent/hook. Click one → details popup → Remove (with confirmation) → apple falls with gravity and fades.
- Theme dial at the bottom: Lavender Dawn / Champagne Pink / Sage Green.
- Side panel: changelog of what was done, new additions, and tokens saved (animated counters).
- To add entries, edit `dashboard/data.js` — the format is documented at the top of that file. The `session-logger` hook shows how to append automatically.

### Two modes
- **Local** (opened via `file://` or `localhost`): full mode — you can remove items (apple-fall) and restore them. Removals persist in your browser's localStorage; the actual `.md` skill files in your Claude folder are managed separately (by you or Claude) — `data.js` is the single source the tree renders from.
- **Hosted** (GitHub Pages or any `https://` domain): automatically view-only. Remove/Restore are disabled and a 🔒 badge shows; everyone can browse the tree, changelog, and stats but can't change anything.

### Publish to GitHub Pages
1. Push this repo (or just the `dashboard/` folder) to GitHub.
2. Repo → Settings → Pages → Source: `Deploy from a branch` → pick branch + folder (`/ (root)` or `/docs` — if using `/docs`, rename `dashboard/` to `docs/`).
3. Your tree is live at `https://<user>.github.io/<repo>/dashboard/` (view-only by design).
4. To update the public tree, edit `data.js` and push — no build step needed.
