#!/usr/bin/env python3
"""Stop hook: appends a session entry to activity/changelog.jsonl (append-only,
crash-safe, git-mergeable). Reads hook payload from stdin; counts transcript
size as a rough token proxy. Creates the activity dir if missing.
"""
import datetime
import json
import os
import sys

ACTIVITY_DIR = os.path.join(os.path.dirname(__file__), "..", "activity")
LOG_PATH = os.path.join(ACTIVITY_DIR, "changelog.jsonl")

def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        payload = {}
    transcript = payload.get("transcript_path", "")
    approx_tokens = 0
    if transcript and os.path.exists(transcript):
        approx_tokens = os.path.getsize(transcript) // 4  # ~4 chars/token heuristic

    entry = {
        "date": datetime.date.today().isoformat(),
        "title": "Session completed",
        "detail": f"~{approx_tokens:,} tokens of transcript this session",
        "tokensSaved": 0,
        "type": "session",
    }
    os.makedirs(os.path.abspath(ACTIVITY_DIR), exist_ok=True)
    with open(os.path.abspath(LOG_PATH), "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")
    sys.exit(0)

if __name__ == "__main__":
    main()
