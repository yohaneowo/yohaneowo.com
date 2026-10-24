# X monitor template

Keep the posts of the X (Twitter) accounts you follow in a GitHub repo, one JSON line per post, so
charts and models can read them. [yohaneowo.com's TradeHub](https://yohaneowo.com/tradehub) marks
each post on the candle it was written in.

把你关注的 X 帐号的贴文存在 GitHub repo 里，一则一行 JSON，给图表和模型读。
[yohaneowo.com 的 TradeHub](https://yohaneowo.com/tradehub) 会把每则贴文标在发文那根 K 线上。

## 怎么用

1. 按右上角 **Use this template** 建自己的 repo（私有、公开都可以）。
2. 编辑 `accounts.json`，填你要追的 X 帐号。
3. 让 bot（Grok、自己的脚本…）照 `BOT_PROMPT.md` 定时把新贴文追加到 `<帐号>/posts.jsonl`。格式见 `SCHEMA.md`。
4. 推上去后，GitHub Action（`.github/workflows/build-index.yml`）会跑 `scripts/build_index.py` 重建根目录的 `index.jsonl`。bot 不用自己维护索引。
5. 到 TradeHub 右侧「X 贴文」：
   - 私有 repo：按「连接 GitHub」，安装 App 时只勾这个 repo（只读）。
   - 公开 repo：直接填 `owner/repo`。

## How to use

1. **Use this template** to make your own repo (private or public).
2. List the X accounts to follow in `accounts.json`.
3. Have a bot (Grok, your own script…) append new posts to `<account>/posts.jsonl` on a schedule,
   following `BOT_PROMPT.md`. The format is in `SCHEMA.md`.
4. On every push the GitHub Action rebuilds `index.jsonl` with `scripts/build_index.py`.
5. In TradeHub's "X posts" panel, **Connect GitHub** and pick this repo (read-only), or enter
   `owner/repo` if it's public.

## Files

| file                    | what                                                   |
| ----------------------- | ------------------------------------------------------ |
| `SCHEMA.md`             | the post format (the only thing readers rely on)       |
| `CLAUDE.md`             | instructions for models and programs reading the repo  |
| `BOT_PROMPT.md`         | instructions for the bot that collects the posts       |
| `accounts.json`         | the accounts to follow                                 |
| `<account>/posts.jsonl` | that account's posts, oldest first                     |
| `<account>/images/`     | their photos and video thumbnails                      |
| `index.jsonl`           | every account merged (built by the Action; don't edit) |
