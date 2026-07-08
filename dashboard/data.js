// ── Skill Tree Dashboard data ─────────────────────────────────────────────
// Edit this file to add/remove items. The site reads it on load (works on file://).
//
// config.repoBase : your GitHub repo URL, e.g. "https://github.com/you/claude-toolkit"
//                   Enables "View file" / "Download" from file:// and the toolkit .zip button.
//
// tree[]      : nodes on the 3D tree.
//   id, name, category ("skill"|"agent"|"hook"|"command"), added (ISO date; ≤7 days glows),
//   desc (one-liner for the summary card), file (path relative to dashboard/ for view/download)
//
// changelog[] : entries for the side panel (newest first).
//   date, title, detail, tokensSaved (number), type: "feature"|"fix"|"skill"|"session"|"release"
window.SKILL_TREE_DATA = {
  config: {
    repoBase: "https://github.com/Dontag/claude-toolkit"
  },
  tree: [
    { id: "headsoff",        name: "headsoff",         category: "skill",   added: "2026-07-08", desc: "Context-overload guard: writes HANDOFF.md and prompts a fresh session before quality drops.", file: "../skills/headsoff/SKILL.md" },
    { id: "ui-ux-master",    name: "ui-ux-master",     category: "skill",   added: "2026-07-08", desc: "Layouts, palettes, typography, accessibility — world-class UI/UX rules.", file: "../skills/ui-ux-master/SKILL.md" },
    { id: "motion-anim",     name: "motion-animation", category: "skill",   added: "2026-07-08", desc: "Easing, springs, physics, 3D — production-grade motion design.", file: "../skills/motion-animation/SKILL.md" },
    { id: "backend-arch",    name: "backend-architect",category: "skill",   added: "2026-07-08", desc: "Stack selection matrix + cross-language fix playbooks.", file: "../skills/backend-architect/SKILL.md" },
    { id: "ticket-flow",     name: "ticket-workflow",  category: "skill",   added: "2026-07-08", desc: "Reproduce → minimal fix → test → PR, with MCP ticket integration.", file: "../skills/ticket-workflow/SKILL.md" },
    { id: "testing-qa",      name: "testing-qa",       category: "skill",   added: "2026-07-08", desc: "Test strategy, framework commands, flaky-test handling.", file: "../skills/testing-qa/SKILL.md" },
    { id: "token-saver",     name: "token-saver",      category: "skill",   added: "2026-07-08", desc: "Hard rules that cut token spend on every task.", file: "../skills/token-saver/SKILL.md" },
    { id: "tech-radar",      name: "tech-radar",       category: "skill",   added: "2026-07-08", desc: "Verify-before-use, drift detection, LEARNINGS.md loop.", file: "../skills/tech-radar/SKILL.md" },
    { id: "prd-writer",      name: "prd-writer",       category: "skill",   added: "2026-07-08", desc: "Turns raw ideas into build-ready PRDs with stories and acceptance criteria.", file: "../skills/prd-writer/SKILL.md" },
    { id: "web-perf",        name: "web-perf",         category: "skill",   added: "2026-07-08", desc: "Core Web Vitals, bundle size, FPS — measure-first performance fixes.", file: "../skills/web-perf/SKILL.md" },
    { id: "ui-designer",     name: "ui-designer",      category: "agent",   added: "2026-07-08", desc: "Frontend + design specialist subagent.", file: "../agents/ui-designer.md" },
    { id: "backend-eng",     name: "backend-engineer", category: "agent",   added: "2026-07-08", desc: "Polyglot backend specialist subagent.", file: "../agents/backend-engineer.md" },
    { id: "bug-fixer",       name: "bug-fixer",        category: "agent",   added: "2026-07-08", desc: "Ticket-driven minimal-diff patcher.", file: "../agents/bug-fixer.md" },
    { id: "test-runner",     name: "test-runner",      category: "agent",   added: "2026-07-08", desc: "Runs tests, fixes failures, never touches product logic.", file: "../agents/test-runner.md" },
    { id: "code-reviewer",   name: "code-reviewer",    category: "agent",   added: "2026-07-08", desc: "Review gate: correctness, security, performance.", file: "../agents/code-reviewer.md" },
    { id: "release-mgr",     name: "release-manager",  category: "agent",   added: "2026-07-08", desc: "Versioning, changelog, deploy checklist.", file: "../agents/release-manager.md" },
    { id: "tech-scout",      name: "tech-scout",       category: "agent",   added: "2026-07-08", desc: "Researches new tech and updates the learning log.", file: "../agents/tech-scout.md" },
    { id: "security-auditor",name: "security-auditor", category: "agent",   added: "2026-07-08", desc: "Deep security sweep: secrets, injection, authz, dependencies.", file: "../agents/security-auditor.md" },
    { id: "docs-writer",     name: "docs-writer",      category: "agent",   added: "2026-07-08", desc: "READMEs, API docs, ADRs — derived from code, commands verified.", file: "../agents/docs-writer.md" },
    { id: "hook-format",     name: "auto-format",      category: "hook",    added: "2026-07-08", desc: "Prettier/black on every edit — zero tokens on formatting.", file: "../hooks/HOOKS.md" },
    { id: "hook-guard",      name: "command-guard",    category: "hook",    added: "2026-07-08", desc: "Blocks rm -rf /, force-push, DROP TABLE before execution.", file: "../hooks/guard.py" },
    { id: "hook-logger",     name: "session-logger",   category: "hook",    added: "2026-07-08", desc: "Logs each session to this dashboard automatically.", file: "../hooks/session_logger.py" },
    { id: "cmd-fix",         name: "/fix-ticket",      category: "command", added: "2026-07-08", desc: "End-to-end ticket resolution pipeline.", file: "../commands/fix-ticket.md" },
    { id: "cmd-ship",        name: "/ship",            category: "command", added: "2026-07-08", desc: "Test → review → version → changelog → tag.", file: "../commands/ship.md" },
    { id: "cmd-audit",       name: "/ui-audit",        category: "command", added: "2026-07-08", desc: "Audit any screen against the UI/UX checklist.", file: "../commands/ui-audit.md" },
    { id: "cmd-standup",     name: "/standup",         category: "command", added: "2026-07-08", desc: "Daily summary: shipped, in flight, blocked, next.", file: "../commands/standup.md" },
    { id: "cmd-newfeature",  name: "/new-feature",     category: "command", added: "2026-07-08", desc: "Idea → PRD → build → test → review, end to end.", file: "../commands/new-feature.md" }
  ],
  changelog: [
    { date: "2026-07-08", title: "File viewer & downloads", detail: "View full skill/agent files and download them from the tree; toolkit .zip button; mobile scroll & tap fixes.", tokensSaved: 0, type: "feature" },
    { date: "2026-07-08", title: "Impact pack added", detail: "prd-writer & web-perf skills, security-auditor & docs-writer agents, /standup & /new-feature commands, fruit search on the tree.", tokensSaved: 0, type: "feature" },
    { date: "2026-07-08", title: "Toolkit created", detail: "8 skills, 7 agents, 3 hooks, 3 commands installed; 3D dashboard launched.", tokensSaved: 0, type: "feature" },
    { date: "2026-07-08", title: "Token discipline active", detail: "Grep-before-read, edit-over-write, subagent delegation rules enabled in CLAUDE.md.", tokensSaved: 12000, type: "skill" }
  ]
};
