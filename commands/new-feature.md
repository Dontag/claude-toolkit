---
description: Build a feature end-to-end from an idea or PRD (plan → build → test → review)
argument-hint: "<feature description or path to PRD>"
---

Build feature: $ARGUMENTS

1. **Requirements**: if $ARGUMENTS is a PRD path, read it; otherwise run the `prd-writer` skill quickly (ask only the questions that change the design) and save the PRD to `docs/`.
2. **Plan**: identify the M0 slice (thinnest end-to-end path). List files to create/change, data model changes, and API contract. Show the plan in ≤10 lines before writing code.
3. **Build**: backend first (`backend-engineer` agent: schema → API → validation), then UI (`ui-designer` agent: states, responsive, motion per skills). Small conventional commits per layer.
4. **Test**: `test-runner` agent — unit for logic, integration for API, at least the happy-path e2e. Acceptance criteria from the PRD become test names.
5. **Review**: `code-reviewer` agent on the full diff; fix blockers; `security-auditor` if the feature touches auth, payments, uploads, or user data.
6. **Wrap up**: changelog entry, docs touched (`docs-writer` if public API changed), log to `claude-toolkit/dashboard/data.js`, and output: what shipped, how to try it, follow-ups.

Stop and ask before: schema migrations on existing tables, new dependencies >30KB, or anything not in the PRD.
