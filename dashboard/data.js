// ── Skill Tree Dashboard data ─────────────────────────────────────────────
// Edit this file to add/remove items. The site reads it on load (works on file://).
//
// tree[]      : nodes on the 3D tree.
//   id        : unique string
//   name      : label shown on the fruit
//   category  : "skill" | "agent" | "hook" | "command"   (one branch per category)
//   added     : ISO date — items ≤7 days old glow as "new"
//   desc      : one-line description for the popup
//
// changelog[] : entries for the side panel (newest first).
//   date, title, detail, tokensSaved (number), type: "feature"|"fix"|"skill"|"session"|"release"
window.SKILL_TREE_DATA = {
  tree: [
    { id: "headsoff",        name: "headsoff",         category: "skill",   added: "2026-07-08", desc: "Context-overload guard: writes HANDOFF.md and prompts a fresh session before quality drops." },
    { id: "ui-ux-master",    name: "ui-ux-master",     category: "skill",   added: "2026-07-08", desc: "Layouts, palettes, typography, accessibility — world-class UI/UX rules." },
    { id: "motion-anim",     name: "motion-animation", category: "skill",   added: "2026-07-08", desc: "Easing, springs, physics, 3D — production-grade motion design." },
    { id: "backend-arch",    name: "backend-architect",category: "skill",   added: "2026-07-08", desc: "Stack selection matrix + cross-language fix playbooks." },
    { id: "ticket-flow",     name: "ticket-workflow",  category: "skill",   added: "2026-07-08", desc: "Reproduce → minimal fix → test → PR, with MCP ticket integration." },
    { id: "testing-qa",      name: "testing-qa",       category: "skill",   added: "2026-07-08", desc: "Test strategy, framework commands, flaky-test handling." },
    { id: "token-saver",     name: "token-saver",      category: "skill",   added: "2026-07-08", desc: "Hard rules that cut token spend on every task." },
    { id: "tech-radar",      name: "tech-radar",       category: "skill",   added: "2026-07-08", desc: "Verify-before-use, drift detection, LEARNINGS.md loop." },
    { id: "prd-writer",      name: "prd-writer",       category: "skill",   added: "2026-07-08", desc: "Turns raw ideas into build-ready PRDs with stories and acceptance criteria." },
    { id: "web-perf",        name: "web-perf",         category: "skill",   added: "2026-07-08", desc: "Core Web Vitals, bundle size, FPS — measure-first performance fixes." },
    { id: "ui-designer",     name: "ui-designer",      category: "agent",   added: "2026-07-08", desc: "Frontend + design specialist subagent." },
    { id: "backend-eng",     name: "backend-engineer", category: "agent",   added: "2026-07-08", desc: "Polyglot backend specialist subagent." },
    { id: "bug-fixer",       name: "bug-fixer",        category: "agent",   added: "2026-07-08", desc: "Ticket-driven minimal-diff patcher." },
    { id: "test-runner",     name: "test-runner",      category: "agent",   added: "2026-07-08", desc: "Runs tests, fixes failures, never touches product logic." },
    { id: "code-reviewer",   name: "code-reviewer",    category: "agent",   added: "2026-07-08", desc: "Review gate: correctness, security, performance." },
    { id: "release-mgr",     name: "release-manager",  category: "agent",   added: "2026-07-08", desc: "Versioning, changelog, deploy checklist." },
    { id: "tech-scout",      name: "tech-scout",       category: "agent",   added: "2026-07-08", desc: "Researches new tech and updates the learning log." },
    { id: "security-auditor",name: "security-auditor", category: "agent",   added: "2026-07-08", desc: "Deep security sweep: secrets, injection, authz, dependencies." },
    { id: "docs-writer",     name: "docs-writer",      category: "agent",   added: "2026-07-08", desc: "READMEs, API docs, ADRs — derived from code, commands verified." },
    { id: "hook-format",     name: "auto-format",      category: "hook",    added: "2026-07-08", desc: "Prettier/black on every edit — zero tokens on formatting." },
    { id: "hook-guard",      name: "command-guard",    category: "hook",    added: "2026-07-08", desc: "Blocks rm -rf /, force-push, DROP TABLE before execution." },
    { id: "hook-logger",     name: "session-logger",   category: "hook",    added: "2026-07-08", desc: "Logs each session to this dashboard automatically." },
    { id: "cmd-fix",         name: "/fix-ticket",      category: "command", added: "2026-07-08", desc: "End-to-end ticket resolution pipeline." },
    { id: "cmd-ship",        name: "/ship",            category: "command", added: "2026-07-08", desc: "Test → review → version → changelog → tag." },
    { id: "cmd-audit",       name: "/ui-audit",        category: "command", added: "2026-07-08", desc: "Audit any screen against the UI/UX checklist." },
    { id: "cmd-standup",     name: "/standup",         category: "command", added: "2026-07-08", desc: "Daily summary: shipped, in flight, blocked, next." },
    { id: "cmd-newfeature",  name: "/new-feature",     category: "command", added: "2026-07-08", desc: "Idea → PRD → build → test → review, end to end." }
  ],
  changelog: [
    { date: "2026-07-08", title: "Impact pack added", detail: "prd-writer & web-perf skills, security-auditor & docs-writer agents, /standup & /new-feature commands, fruit search on the tree.", tokensSaved: 0, type: "feature" },
    { date: "2026-07-08", title: "Toolkit created", detail: "8 skills, 7 agents, 3 hooks, 3 commands installed; 3D dashboard launched.", tokensSaved: 0, type: "feature" },
    { date: "2026-07-08", title: "Token discipline active", detail: "Grep-before-read, edit-over-write, subagent delegation rules enabled in CLAUDE.md.", tokensSaved: 12000, type: "skill" }
  ]
};
