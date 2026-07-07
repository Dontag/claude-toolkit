# Hooks

Hooks are configured in `.claude/settings.json` (not as standalone .md files). Merge the `hooks` block from `settings-hooks.json` into yours, and copy `guard.py` + `session_logger.py` into `.claude/hooks/`.

## What each hook does

**Auto-format (PostToolUse on Edit|Write)**
Runs Prettier on every file Claude edits or creates. Saves tokens: Claude never spends a turn formatting, and the code-reviewer never flags style. Swap the command per stack: `black "$CLAUDE_FILE_PATHS"` (Python), `gofmt -w` (Go), `dart format` (Flutter).

**Command guard (PreToolUse on Bash)**
`guard.py` blocks destructive commands before execution: `rm -rf /`, force-push, direct push to main, `DROP TABLE`, hard reset to origin. Exit code 2 blocks and tells Claude why, so it self-corrects instead of retrying.

**Session logger (Stop)**
`session_logger.py` appends an entry to `dashboard/data.js` when a session ends, with an approximate token count from the transcript size. This feeds the 3D dashboard's changelog automatically. No-op if the dashboard folder is missing.

## Useful additions (add when needed)

Typecheck after TS edits:
```json
{ "matcher": "Edit|Write", "hooks": [{ "type": "command", "command": "npx tsc --noEmit --pretty false 2>&1 | head -20 || true" }] }
```

Warn on secrets before Write:
```json
{ "matcher": "Write", "hooks": [{ "type": "command", "command": "grep -Eq '(api[_-]?key|secret|password)\\s*[:=]\\s*[\"'\\''][A-Za-z0-9]{16,}' \"$CLAUDE_FILE_PATHS\" && echo 'Possible secret in file' >&2 && exit 2 || exit 0" }] }
```

Note: hook payloads arrive on stdin as JSON; `$CLAUDE_FILE_PATHS` expands to the affected file paths. Exit 2 from a PreToolUse hook blocks the tool call; stderr is fed back to Claude.
