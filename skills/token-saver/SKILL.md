---
name: token-saver
description: Token-efficiency rules for every task. Use at the start of any coding session, when the user mentions tokens, cost, context limits, or when work involves large files/codebases where careless reading would burn context.
---

# token-saver

Tokens are spent in three places: reading too much, writing too much, and repeating work. Attack all three.

## Reading (biggest lever)
- Grep/Glob to locate before reading; read with offset/limit — never a 2000-line file for one function.
- Never re-read a file already in context; after your own Edit/Write, trust the tool result (don't read back to verify).
- Package/framework questions: check installed version in lockfile once, not by reading node_modules.
- Big logs: `tail -50`, or grep for ERROR/FAIL — never cat entire logs into context.
- Delegate broad exploration ("find where X is handled") to an Explore/general subagent: only its conclusion enters your context, not the file dumps.

## Writing
- Edit > Write for existing files (send only the diff, not the whole file).
- In chat: reference `path:line`, don't quote code blocks back unless the user must copy them.
- No preamble ("Great! Let me..."), no post-summary longer than 2 lines, no restating the plan you just executed.
- Don't regenerate unchanged code; for large generated files, build iteratively with Edits.

## Repeating
- Batch independent tool calls in one turn (parallel calls = one round trip).
- Keep a mental (or `HANDOFF.md`) record of decisions so they aren't re-derived.
- If the same check runs often (lint, typecheck), run it once at the end of a change-set, not per-edit — unless a hook does it automatically for free.
- Long session getting heavy → invoke `headsoff` skill instead of grinding on.

## Estimating savings (for the dashboard log)
Rough accounting per task: tokens_saved ≈ (files located via grep instead of read × avg 1,500) + (re-reads avoided × 1,500) + (subagent-delegated exploration × 5,000) + (summaries trimmed × 200). Log the estimate and one-line basis in `claude-toolkit/dashboard/data.js`.

## Red flags (stop and course-correct)
Reading a file the 2nd time • quoting >30 lines back to the user • explaining code the user didn't ask about • full test suite after a one-line change in an isolated module • writing a file then reading it back.
