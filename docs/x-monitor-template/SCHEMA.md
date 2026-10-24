# Data schema

Each account folder (`some_trader/`, lower case) contains:

- `posts.jsonl` — **the machine data**: one JSON object per line, one line per original post
  (replies to others excluded, the author's own thread replies kept), unique by `id`, sorted by
  `created_at` ascending.
- `images/<post_id>_<n>.<ext>` — the post's photos / video thumbnails (`jpg`, `png`, `webp`, `gif`).
- `avatar.<ext>` — the account's avatar (square, e.g. 400×400).
- Optional `YYYY-MM-DD.md` daily digests for people. Never parsed.

The root `accounts.json` lists the followed accounts: an array of `{ folder, account, name, avatar,
description, followers_count, updated_at }` (`avatar` repo-relative, `account` the handle, `name` the
display name). `build_index.py` copies `avatar` and `name` (as `author_name`) into every post.

The root `index.jsonl` is every account merged and sorted by `created_at`, each row with an extra
`folder` field. It's rebuilt by `scripts/build_index.py` (the GitHub Action runs it on every push);
never edit it by hand. Readers only need `index.jsonl`.

## Post object

Required fields:

| field              | type                            | notes                                                                                                                                                                                                   |
| ------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`               | string                          | X post id — a **string**, never a number (it exceeds 2^53)                                                                                                                                              |
| `account`          | string                          | the X handle as X spells it (`Some_Trader`)                                                                                                                                                             |
| `url`              | string                          | `https://x.com/<handle>/status/<id>`                                                                                                                                                                    |
| `created_at`       | string                          | ISO 8601 UTC, `2026-10-24T00:56:12Z` — **the time to put it on a chart**                                                                                                                                |
| `created_at_local` | string                          | the same instant with the owner's offset (`+08:00`), for display                                                                                                                                        |
| `text`             | string                          | the full original text (long posts in full), HTML entities decoded                                                                                                                                      |
| `summary_zh`       | string                          | a one-line summary (Chinese)                                                                                                                                                                            |
| `lang`             | string \| null                  | X's language code (`zh`, `en`, …)                                                                                                                                                                       |
| `symbols`          | string[]                        | TradingView `EXCHANGE:TICKER` best guesses; `[]` if none                                                                                                                                                |
| `assets`           | string[]                        | plain names in the same order as `symbols` (`BTC`, `Gold`, `SOXL`)                                                                                                                                      |
| `stance`           | `{symbol, bias}`[]              | `bias`: `bullish` \| `bearish` \| `neutral` \| `null` (mentioned, no clear view)                                                                                                                        |
| `levels`           | `{symbol, type, price, note}`[] | `type`: `support` `resistance` `entry` `stop` `target` `invalidation` `other`; `price` a number in the symbol's quote currency; a range is two rows sharing a `note`; `[]` when the post names no price |
| `timeframe`        | string \| null                  | the chart timeframe it talks about: `1h` `4h` `1D` `3D` `1W` …                                                                                                                                          |
| `action`           | string                          | the author's own trade: `open_long` `open_short` `add` `take_profit` `close` `stop_hit` `hold` `none`                                                                                                   |
| `images`           | string[]                        | repo-relative paths (`some_trader/images/2113796811005850053_1.png`)                                                                                                                                    |
| `quoted_post_id`   | string \| null                  | the quoted post's id                                                                                                                                                                                    |
| `reply_to_post_id` | string \| null                  | set for the author's own thread continuations                                                                                                                                                           |
| `has_video`        | bool                            | the post has a video / GIF (its thumbnail is in `images`)                                                                                                                                               |

Recommended (readers use them when present):

| field            | type           | notes                                                                                                                                             |
| ---------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `author_name`    | string         | the display name (from `accounts.json`)                                                                                                           |
| `avatar`         | string         | the author's avatar, repo-relative (`some_trader/avatar.jpg`)                                                                                     |
| `fetched_at`     | string         | ISO 8601 UTC — when the bot saw the post. Posts are collected a few times a day, so this is when the post was _knowable_; backtests should use it |
| `quoted_text`    | string \| null | the quoted post's text (many posts only make sense with it)                                                                                       |
| `quoted_account` | string \| null | the quoted post's handle                                                                                                                          |
| `horizon`        | string \| null | how long the author's view is meant to hold: `intraday` `days` `weeks` `months`                                                                   |

`x-monitor` repos made before the template call `created_at_local` `created_at_taipei`; both are
fine (readers use `created_at`).

## Symbols

Common: `BINANCE:BTCUSDT` `BINANCE:ETHUSDT` `BINANCE:SOLUSDT` `TVC:GOLD` `TVC:SILVER` `TVC:DXY`
`SP:SPX` `NASDAQ:IXIC` `NASDAQ:NDX` `SSE:000001` `CRYPTOCAP:TOTAL2` `CRYPTOCAP:BTC.D` and stocks as
`NASDAQ:TSLA`, `NYSE:…`, `AMEX:SOXL`. Price shorthand in posts (`822`, `8W` for BTC) is written out
in USD (82200, 80000).

Annotations (`symbols`, `stance`, `levels`, `action`, `timeframe`, `horizon`) are written by the
bot, not by the author: treat them as hints. `text` is the ground truth.
