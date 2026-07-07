---
name: tech-radar
description: Engineer-mind learning loop — verify current tech before using it, detect syntax/API drift, and record learnings. Use when working with a framework version newer than training data, when APIs behave unexpectedly, when the user mentions "latest", "new version", "deprecated", or asks what's new in a technology.
---

# tech-radar

Model knowledge has a cutoff; ecosystems don't. Treat memory of APIs as a *hypothesis*, verified against the project's actual installed versions.

## Verify-before-use protocol
1. **Check installed reality first**: lockfile (`package.json`/`poetry.lock`/`go.mod`/`pubspec.yaml`) for exact versions; the project's own existing code for idioms (how do *they* already call this API?).
2. **If version > what you're confident about** (major bump past training, or unfamiliar API): fetch the official docs/changelog/migration guide via web tools for that exact version before writing code. Official docs > blog posts.
3. **If a call fails unexpectedly**: assume drift, not typo. Read the error, check the changelog for renames/removals, fix per current docs — don't retry variations from memory.

## Known drift hotspots (check versions before writing)
Next.js (app router, caching semantics change often) • React (compiler/server components) • Tailwind (v4 config model) • ESLint (flat config) • Expo/React Native (new architecture) • Flutter (breaking widget/API renames) • Python packaging (pyproject-only) • Pydantic v1→v2 • SQLAlchemy 1.x→2.0 • Django async • Node (native fetch, test runner, ESM defaults).

## Learning log
Maintain `.claude/LEARNINGS.md` in the project. When you discover something that contradicts memory or cost >2 attempts, append:

```markdown
- [2026-07-08] next@15: `fetch` no longer cached by default; use `{ cache: 'force-cache' }`. (src: nextjs.org changelog)
```

Read this file at session start when present — it's cheap (few lines) and prevents repeating expensive discoveries. Prune entries that graduate into common knowledge.

## Periodic scan (on request or via tech-scout agent)
For each core dependency: current major vs installed, breaking changes pending, deprecations in use (grep for deprecated APIs), security advisories. Output a short radar table: **Adopt / Trial / Hold / Migrate-away** with one-line reasons. Recommend upgrades only with a migration path and test plan — never "just bump it".

## Rules
- Never claim a library feature exists without either training-data confidence at the installed version or a doc check.
- New shiny tech: default to Hold unless it solves a problem the project actually has.
- Deprecation warnings in build output are tickets, not noise — log them.
