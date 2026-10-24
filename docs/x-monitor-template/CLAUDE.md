# For models and programs reading this repo

Purpose: the posts of the X traders the owner follows, to be laid over candlestick charts by time
and analysed.

1. **Read `index.jsonl`** (every account) or `<folder>/posts.jsonl` (one). Ignore `.md` digests.
   The format is `SCHEMA.md`.
2. **Join to candles** on the symbol and the time: `created_at` (UTC) to unix seconds, floored to
   the bar interval (`bar = floor(ts / interval) * interval`). Never do maths on the local time.
   For "could I have acted on it", use `fetched_at` when present (collection runs a few times a day).
3. **Marks**: one per post and symbol; colour from `stance[].bias` (bullish green, bearish red,
   neutral / null grey); label with `account`; details `summary_zh`, `text`, `url`.
4. **Levels**: `levels` whose `symbol` matches the chart, as horizontal lines from the post's bar
   (support / entry green, resistance / stop / invalidation red, target blue), in the symbol's quote
   currency.
5. **Images** are repo-relative paths. For a private repo read them server-side with a token and
   never hand the token to a browser.
6. **Symbols** are TradingView-style guesses. If a chart names them differently, match on `assets`
   (e.g. `BTC`). Posts with `symbols: []` are commentary for a timeline, not a chart.
7. **Sync**: `id` is the unique key; upsert by it (files can be re-sorted).
8. Annotations are machine-made; when in doubt, `text` wins.
