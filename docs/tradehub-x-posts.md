# TradeHub：X 贴文上 K 线

站长关注的几个 X 交易者，由 Grok bot 每天两次（约 01:00、13:00 UTC）抓进私有 repo `yohaneowo/x-monitor`；TradeHub 把每则贴文标在它发文那根 K 线上，侧栏「X 贴文」列出贴文。资料格式以那个 repo 的 `SCHEMA.md` 为准（`index.jsonl` 一行一则、`posts.jsonl` 每个帐号一份、`images/<id>_<n>.<ext>`）。

## 资料流

- `lib/coinhub/x-posts-server.ts`（只在服务端）：用 GitHub contents API（`Accept: application/vnd.github.raw`）读 `index.jsonl`，`"use cache"` 十分钟（`cacheLife({ stale: 300, revalidate: 600 })`），按 `id` 去重、按时间排；坏行跳过。
- `GET /api/coinhub/posts`：回全部贴文（目前一百多则、约 100 KB，客户端自己按图表筛）。开头 `await connection()`——少了它整条路由在构建时被预渲染（构建时没有 token 也读不到 session），永远回 `null`。
- `GET /api/coinhub/posts/image?p=<folder>/images/<id>_<n>.<ext>`：图片代理，路径白名单，浏览器快取一年（贴文的图不会变）。
- 环境变量（Doppler `yohaneowo-site` dev / stg / prd）：
  - `X_MONITOR_GITHUB_TOKEN`：fine-grained token，只给 x-monitor、Contents 只读。没设就整个功能不出现。
  - `X_MONITOR_VIEWERS`：看得到的网站帐号 ID（逗号分隔）。repo 是私有的，所以只开给站长；空的就没人看得到。本机 dev 资料库的帐号 ID 跟正式 / dev 站不同，`dev` 配置要填本机那个。
  - `X_MONITOR_REPO`：可选，预设 `yohaneowo/x-monitor`。
- 不是 viewer 的访客 `/api/coinhub/posts` 回 `{ data: null }`，侧栏不出现「X 贴文」图示，图上也没有标记（客户端 store 状态 `off`）。

## 标的对应

Grok 用 TradingView 的写法（`BINANCE:BTCUSDT`、`TVC:GOLD`、`NASDAQ:TSLA`），本站图表是 Binance 交易对、Yahoo 代码和自己的指数。两边都换成一个键（`x-posts.ts` 的 `postSymbolKey` / `chartSymbolKey`），键相同就标上：

- 币对美元稳定币（USDT / USDC / FDUSD / BUSD / TUSD / USD）一律是 `COIN:<币>`：一则 BTC 贴文在 BTCUSDT、BTCUSDC、BTCUSDT.P 都会出现；其他交易对（SUIBTC）是 `PAIR:<对>`，只对同一个对。
- 美股交易所（NASDAQ / NYSE / AMEX / ARCA / BATS / CBOE）→ `YAHOO:<代码>`；`CRYPTOCAP:X` → `INDEX:X`；`TWSE` → `.TW`、`HKEX` → `.HK`。
- 名字不一样的写在 `SPECIAL`：金 `TVC:GOLD` → `GC=F`、`SP:SPX` → `^GSPC`、`NASDAQ:IXIC` → `^IXIC`、`SSE:000001` → `000001.SS`、DXY、VIX、原油等。新出现对不上的标的就加在这里。
- `symbols: []` 的贴文（纯评论）只在面板的「全部」里。

## 图上的标记

- 一个 overlay（`overlays/trading.ts` 的 `postMarks`）装下所有有贴文的 K 线（每根一个点，`extendData.groups` 是该根的贴文），每次重画时把相距不到一个徽章宽的 K 线合成一叠，所以缩小时会合并而不是叠在一起；一叠最多 3 个徽章，多的写「+n」。徽章在 K 线区底部（像 TradingView 的事件），文字是帐号两个字母（`accountTag`：KayonTai → KT、Patrade_Buer → PB），底色是这则贴文对这个标的的看法（`stance[].bias`：绿多、红空、灰中性或只是提及）。
- 点徽章：KLineChart 的 overlay 点击事件带着点到的 `figure`，徽章的 `key` 是 `posts:<id,id,…>`，控制器发 `postMark` 事件 → 打开「X 贴文」面板、标出那几则、选取最新一则。
- 选取一则贴文（面板里点它或「在图上定位」）：图跳到那根 K 线，`levels` 里属于这个标的的价位画成横线（`postLevel`：贴文之前淡、之后清楚，标签在左边；支撑 / 进场绿、压力 / 止损 / 失效红、目标蓝）。
- 终端状态 `posts: { show, hidden, scope }`（存在 localStorage）：图上显示与否、隐藏的帐号（repo 资料夹名）、面板列这个商品还是全部。

## 面板

`components/coinhub/posts-panel.tsx`：这个商品 / 全部、帐号开关（同时影响图上标记）、每则贴文的头像（帐号色）、时间、动作（开多、开空、止盈……）、每个标的的看法（点了切换图表到那个标的）、繁中摘要（可切原文）、图片（经代理，影片显示缩图加播放符号）、价位、在 X 打开。

## 测试

本机没有登录态时，API 一定回 `null`。dev 模式下 `window.__coinhub.xPosts` 是贴文 store：把 `index.jsonl` 转成同样的格式后 `xPosts.set({ status: "ready", posts })` 就能检查标记、点击与面板（图片会 404，正常）。完整流程（权限、token）要在 dev 站用站长帐号看。
