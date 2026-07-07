---
name: headsoff
description: Context-overload guard. Use when the session context is getting heavy — long conversation, repeated file re-reads, degraded recall of earlier decisions, or the user says "context", "session is slow", "you're forgetting things", or asks to hand off to a new session. Produces a handoff brief and tells the user to start fresh.
---

# headsoff — session handoff before quality drops

When context gets too heavy, model quality degrades: forgotten constraints, re-asking answered questions, re-reading files. Instead of degrading silently, this skill makes the switch explicit.

## Trigger signals (self-check every ~10 turns on long sessions)
- You needed to re-read a file you already read this session.
- You can't recall a decision made earlier without scrolling context.
- The conversation spans 3+ distinct tasks or 40+ turns.
- Large pasted logs/files dominate the context.

If 2+ signals are true → run the handoff procedure now, without waiting to be asked.

## Handoff procedure
1. **Write `HANDOFF.md`** in the project root (overwrite previous). Keep it under 60 lines:

```markdown
# Session handoff — <date time>
## Goal
<one line: what the user is ultimately trying to achieve>
## State
- Done: <completed items, terse>
- In progress: <current item + exact next step>
- Blocked/Open: <unresolved questions, awaiting user input>
## Key decisions & constraints
- <decision>: <why> (don't relitigate)
## Files that matter
- path/file.ts:123 — <why it matters>
## Environment / commands
- run: <dev command> | test: <test command>
## First action for next session
<the single command or edit to start with>
```

2. **Tell the user** (verbatim style):
   > Context is getting heavy — quality will drop soon. I've saved a handoff brief to `HANDOFF.md`. Start a new session and say: **"Read HANDOFF.md and continue."**

3. **Stop starting new work.** Finish only the current atomic step, then wait.

## Resuming (new session)
When asked to continue from `HANDOFF.md`: read it, read ONLY the files it lists (at the listed line ranges), confirm the goal in one line, then execute "First action". Do not re-explore the codebase.

## Rules
- Never dump raw context into the brief — distill. The brief is a map, not a transcript.
- Record decisions with their *why*, so the next session doesn't reverse them.
- Update `HANDOFF.md` rather than creating dated copies; git history preserves the past.
