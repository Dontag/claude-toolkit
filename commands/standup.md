---
description: Daily standup summary — what shipped, what's in flight, what's blocked
argument-hint: "[days back, default 1]"
---

Generate a standup summary for the last $ARGUMENTS day(s) (default 1):

1. **Shipped**: `git log --since="$ARGUMENTS days ago" --oneline --no-merges` grouped by scope; call out anything user-facing.
2. **In flight**: uncommitted/branch work (`git status`, open branches ahead of main), plus in-progress tickets from the ticket MCP if connected.
3. **Blocked**: tickets in blocked state, failing CI, unanswered questions from `HANDOFF.md` if present.
4. **Today**: top 3 suggested next actions based on the above and open P0/P1 tickets.

Format: four short sections, bullet per item, each ≤1 line. Append a one-line entry (with tokens-saved estimate) to `claude-toolkit/dashboard/data.js`. Offer to post to the team channel via a chat MCP if one is connected — never post without confirmation.
