#!/usr/bin/env python3
"""PreToolUse guard for Bash: blocks dangerous commands before they run.
Exit 2 = block (stderr message shown to Claude). Exit 0 = allow.
"""
import json
import re
import sys

BLOCKED = [
    (r"rm\s+-rf\s+(/|~|\$HOME)(\s|$)", "refusing to delete root/home"),
    (r"git\s+push\s+.*--force(?!-with-lease)", "force-push blocked; use --force-with-lease"),
    (r"git\s+push\s+(origin\s+)?(main|master)(\s|$)", "direct push to main/master blocked; open a PR"),
    (r"\bDROP\s+(TABLE|DATABASE)\b", "destructive SQL blocked; run manually if intended"),
    (r"git\s+reset\s+--hard\s+origin", "hard reset to origin blocked; stash or branch first"),
    (r"(chmod|chown)\s+-R\s+.*\s/(\s|$)", "recursive permission change on / blocked"),
]

def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)
    cmd = (data.get("tool_input") or {}).get("command", "")
    for pattern, reason in BLOCKED:
        if re.search(pattern, cmd, re.IGNORECASE):
            print(f"BLOCKED: {reason}. Command was: {cmd[:200]}", file=sys.stderr)
            sys.exit(2)
    sys.exit(0)

if __name__ == "__main__":
    main()
