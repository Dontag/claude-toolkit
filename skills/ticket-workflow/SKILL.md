---
name: ticket-workflow
description: Patch- and ticket-based development workflow. Use when handling a bug ticket, issue, hotfix, small fix, or patch — anything referencing Jira/Linear/GitHub Issues IDs (e.g. "PROJ-123", "fix #45"), or when the user asks to work through a ticket queue.
---

# ticket-workflow

Small, safe, traceable changes. A ticket is done when: reproduced → minimally fixed → regression-tested → documented → linked back to the ticket.

## Pipeline
1. **Fetch context** — if a ticket MCP is connected (Linear/Jira/GitHub), pull title, description, comments, linked PRs. If not, ask for the ticket text. Restate the problem in one sentence; get confirmation only if ambiguous.
2. **Reproduce** — write a failing test or a minimal repro script FIRST. If you cannot reproduce, report findings and ask — never "fix" what you can't see fail.
3. **Locate** — Grep for error strings/symptoms; read only the implicated files. Identify root cause, not symptom. State it in one line: "Root cause: X because Y."
4. **Minimal fix** — smallest diff that fixes the root cause. No drive-by refactors, no formatting churn outside touched lines. If a bigger refactor is warranted, file it as a follow-up note instead.
5. **Test** — the repro test now passes; run the surrounding test suite; add edge cases the bug implies (null/empty/boundary).
6. **Document** — commit message: `fix(scope): description (TICKET-ID)`. Add changelog entry if user-facing.
7. **Close the loop** — via MCP: comment on the ticket with root cause + fix summary + PR link, move status to review/done. Log entry to `claude-toolkit/dashboard/data.js`.

## Branch/patch conventions
- Branch: `fix/TICKET-ID-short-slug`. Hotfix to production: branch from the release tag, cherry-pick to main after.
- One ticket = one PR. Batch only trivial same-area tickets, and say so in the PR body.
- Severity triage: P0 (prod down) → skip queue, fix on hotfix branch, notify. P1 same day. P2/P3 in order received.

## Queue mode ("work through my tickets")
For each ticket run the pipeline; between tickets output a one-line status table (ID, status, root cause). If a ticket needs product decisions, mark **blocked-question** with the specific question and move on — don't stall the queue.

## Guardrails
- Never push directly to main/master. Never delete or skip a failing test to make CI green — fix or explicitly flag it.
- Behavior changes not covered by the ticket = scope creep: ask first.
- If two tickets conflict, surface it before implementing either.
- Regressions caused by a fix are P0 for you: revert first, re-fix second.
