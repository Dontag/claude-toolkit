# Project Operating Rules (merge into your CLAUDE.md)

## Token discipline (always on)
- Read only the files and line ranges needed; never re-read files already in context.
- Prefer Grep/Glob to locate code before opening files; open with offset/limit on large files.
- No restating file contents back in chat; reference `path:line` instead.
- Batch independent tool calls in one turn.
- Answers: shortest correct form. No preamble, no summary of what you just did beyond one line.
- Delegate long exploration to a subagent so raw output stays out of the main context.
- When context feels heavy (repeated re-reads, slow recall of earlier decisions), invoke the `headsoff` skill.

## Development lifecycle
1. **Understand** — restate the task in one line; check ticket/issue via MCP if referenced.
2. **Design** — for UI work consult `ui-ux-master` + `motion-animation`; for services consult `backend-architect`.
3. **Build** — small commits, conventional-commit messages (`feat:`, `fix:`, `chore:`).
4. **Test** — `testing-qa` skill; never mark done with failing tests.
5. **Review** — run the `code-reviewer` agent on the diff before declaring complete.
6. **Ship** — `/ship` command; `release-manager` agent handles versioning + changelog.
7. **Patch** — production issues go through `/fix-ticket` (minimal diff, regression test, changelog entry).

## Quality gates
- No secrets in code or logs. No `console.log`/`print` debugging left behind.
- Every bug fix ships with a regression test.
- UI changes must pass the `/ui-audit` checklist (contrast, keyboard nav, responsive).
- Public API changes require a changelog entry.

## Stack defaults (this user)
- Frontend: React / Next.js (TypeScript strict), Tailwind.
- Mobile: React Native / Flutter.
- Backend: Node (NestJS/Fastify) or Python (FastAPI/Django); see `backend-architect` for selection matrix.
- Before using an unfamiliar API or a framework feature that may have changed, apply `tech-radar`: verify against installed version/docs, don't trust memory.

## Dashboard logging
After completing a significant task, append one entry to `claude-toolkit/dashboard/data.js` (`changelog` array): what was done, files touched, estimated tokens saved by discipline above. Add new skills/agents to the `tree` array so they appear on the 3D tree.
