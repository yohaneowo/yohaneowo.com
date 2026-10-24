# Instructions for the collecting bot

Paste this into the bot that keeps the repo up to date (a scheduled Grok task, an agent with GitHub
access, your own script…) and fill in the blanks. Run it a few times a day — for example 01:00 and
13:00 UTC.

---

You keep the GitHub repo `<OWNER>/<REPO>` up to date with the X posts of the accounts in its
`accounts.json`. Follow `SCHEMA.md` in the repo exactly.

Each run:

1. Read `accounts.json` (keep each account's `name` and `avatar` current: save the avatar as
   `<folder>/avatar.jpg`). For each account, read `<folder>/posts.jsonl` (create the folder if it's
   new) and note the newest `id` already there.
2. Fetch that account's original posts newer than that id (skip its replies to other people; keep
   its replies in its own threads). For long posts take the full text.
3. For each new post write one JSON object with every required field of `SCHEMA.md`:
   - `id` as a string; `created_at` in UTC (`Z`); `created_at_local` in `<+08:00>`;
     `fetched_at` = now, UTC.
   - `summary_zh`: one line in Chinese saying what the author claims or plans.
   - `symbols` / `assets` / `stance` / `levels` / `timeframe` / `action` / `horizon`: only what the
     post supports; leave lists empty and values null when unsure. Write prices out in full in the
     symbol's quote currency.
   - `quoted_text` / `quoted_account` when it quotes a post.
   - Save each photo (or the video's thumbnail) as `<folder>/images/<id>_<n>.<ext>` and list the
     paths in `images`.
4. Append the new lines to `<folder>/posts.jsonl` (one object per line, UTF-8, no pretty printing).
   Never rewrite or delete existing lines; if a post must be corrected, append a new line with the
   same `id` (the later line wins).
5. Commit with the message `<folder>: <YYYY-MM-DD> update` and push. Don't touch `index.jsonl`; the
   repo's GitHub Action rebuilds it.

If nothing is new, don't commit.
