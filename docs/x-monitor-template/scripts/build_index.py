#!/usr/bin/env python3
"""Normalize every <account>/posts.jsonl (dedupe by id, the later line wins; sort by created_at)
and rebuild the root index.jsonl. Run from anywhere: python3 scripts/build_index.py
The GitHub Action runs it on every push."""
import glob
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REQ = ["id", "account", "url", "created_at", "text", "summary_zh", "lang", "symbols", "assets",
       "stance", "levels", "timeframe", "action", "images", "quoted_post_id", "has_video"]

# accounts.json: the display name and avatar copied into each post that lacks them.
accounts = {}
try:
    for acc in json.load(open(os.path.join(ROOT, "accounts.json"), encoding="utf-8")):
        accounts[acc.get("folder")] = acc
except (OSError, ValueError, TypeError):
    pass

allrows, bad = [], 0
for path in sorted(glob.glob(os.path.join(ROOT, "*", "posts.jsonl"))):
    folder = os.path.basename(os.path.dirname(path))
    rows = {}
    for n, line in enumerate(open(path, encoding="utf-8"), 1):
        if not line.strip():
            continue
        try:
            r = json.loads(line)
        except json.JSONDecodeError as e:
            print(f"{path}:{n} bad JSON: {e}", file=sys.stderr)
            bad += 1
            continue
        miss = [k for k in REQ if k not in r]
        if miss:
            print(f"{path}:{n} id={r.get('id')} missing {miss}", file=sys.stderr)
            bad += 1
        for img in r.get("images", []):
            if not os.path.exists(os.path.join(ROOT, img)):
                print(f"{path}:{n} missing image {img}", file=sys.stderr)
        r["id"] = str(r["id"])
        acc = accounts.get(folder) or {}
        if acc.get("avatar") and not r.get("avatar"):
            r["avatar"] = acc["avatar"]
        if acc.get("name") and not r.get("author_name"):
            r["author_name"] = acc["name"]
        r["folder"] = folder
        rows[r["id"]] = r
    ordered = sorted(rows.values(), key=lambda r: (r["created_at"], r["id"]))
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        for r in ordered:
            f.write(json.dumps({k: v for k, v in r.items() if k != "folder"}, ensure_ascii=False) + "\n")
    allrows += ordered

allrows.sort(key=lambda r: (r["created_at"], r["id"]))
with open(os.path.join(ROOT, "index.jsonl"), "w", encoding="utf-8", newline="\n") as f:
    for r in allrows:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")
print(f"index.jsonl: {len(allrows)} posts" + (f", {bad} problems" if bad else ""))
