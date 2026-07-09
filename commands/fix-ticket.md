---
description: Resolve a ticket end-to-end (reproduce → fix → test → PR → close loop)
argument-hint: "<ticket-id or description>"
---

Resolve ticket: $ARGUMENTS

Use the `ticket-workflow` skill pipeline strictly:
1. Fetch full ticket context via the connected ticket MCP (Linear/Jira/GitHub Issues). If none is connected, ask me to paste the ticket.
2. Reproduce with a failing test before touching product code.
3. State root cause in one line, then apply the minimal fix via the `bug-fixer` agent.
4. Run the `test-runner` agent on affected scope; add regression test.
5. Run the `code-reviewer` agent on the diff; fix blockers.
6. Commit as `fix(scope): description (TICKET-ID)` on branch `fix/TICKET-ID-slug`; prepare (don't push) the PR body with root cause + fix summary.
7. Comment the resolution back on the ticket via MCP and log the entry (with estimated tokens saved) to `claude-toolkit/dashboard/data.js`.

Output only: root cause, diff summary, test result, links.
