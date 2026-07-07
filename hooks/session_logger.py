#!/usr/bin/env python3
"""Stop hook: appends a session entry to the dashboard's data.js changelog.
Reads hook payload from stdin; counts transcript size as a rough token proxy.
Safe no-op if the dashboard isn't present.
"""
import datetime
import json
import os
import re
import sys

DATA_JS = os.path.join(os.path.dirname(__file__), "..", "dashboard", "data.js")

def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        payload = {}
    transcript = payload.get("transcript_path", "")
    approx_tokens = 0
    if transcript and os.path.exists(transcript):
        approx_tokens = os.path.getsize(transcript) // 4  # ~4 chars/token heuristic

    path = os.path.abspath(DATA_JS)
    if not os.path.exists(path):
        sys.exit(0)

    entry = {
        "date": datetime.date.today().isoformat(),
        "title": "Session completed",
        "detail": f"~{approx_tokens:,} tokens of transcript this session",
        "tokensSaved": 0,
        "type": "session",
    }
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    # Insert at the top of the changelog array.
    new_content, n = re.subn(
        r"(changelog:\s*\[)",
        lambda m: m.group(1) + "\n    " + json.dumps(entry) + ",",
        content,
        count=1,
    )
    if n:
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_content)
    sys.exit(0)

if __name__ == "__main__":
    main()
