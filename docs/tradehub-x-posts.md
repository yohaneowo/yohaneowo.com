# TradeHub：X 贴文上 K 线

每个登录用户可以连接自己的「贴文 repo」：一个 GitHub repo，用 x-monitor 格式存他关注的 X 帐号的贴文（根目录 `index.jsonl` 一行一则，`<帐号>/images/` 放图），通常由 Grok 之类的 bot 每天更新。TradeHub 把每则贴文标在发文那根 K 线上，侧栏「X 贴文」列出贴文、管理资料来源。格式与 bot 指示在范本 `docs/x-monitor-template/`（要发布成公开的 template repo `yohaneowo/x-monitor-template`，面板的「范本 repo」连结指向它）。

## 资料来源（`x_post_source`）

一个用户最多 8 个来源，每个是一个 repo：

- **私有 repo：经本站的 GitHub App。** 用户按「连接 GitHub」→ `/api/coinhub/posts/github/connect` 设签名 state（`lib/github-state.ts`，绑网站帐号，nonce 放 cookie，十分钟）→ GitHub 的 App 安装页，勾选 repo（权限只有 Contents 唯读）→ 回 `/api/coinhub/posts/github/callback`。App 开了「Request user authorization (OAuth) during installation」，所以回来时带 OAuth code：用它换一次性的用户 token，列出这个 GitHub 用户能碰到的本 App 安装与 repo（`/user/installations`），用完立刻撤销。这样别人伪造 `installation_id` 也接不到不属于他的 repo。那些 repo 里根目录有合格 `index.jsonl` 的（最多试 30 个）自动成为来源；同一安装里被取消勾选的 repo 会移除。已经装过的人用 `?mode=authorize` 走纯授权页，流程相同。
- **读私有 repo**：只存安装 ID，不存任何 token。每次读时用 App 私钥签 JWT（RS256，`iss` = client ID）换一小时的安装 token（`lib/github-app.ts`，记在记忆体到到期前五分钟），GitHub 回 401 就丢掉重换一次。
- **公开 repo**：面板直接填 `owner/repo` 或 GitHub 网址，从 `raw.githubusercontent.com/<repo>/HEAD/…` 读，不用授权（也不吃 API 额度）。加入前先读一次，读不到或格式不对就当场告诉用户。
- **快取**：每个 repo 的贴文 `"use cache"` 十分钟（`repoPosts`，以 repo＋安装 ID 为键，`cacheTag("xrepo:<repo>")`）。App 的 webhook（`/api/coinhub/posts/github/webhook`，`GITHUB_APP_WEBHOOK_SECRET` 验 HMAC）收到 push 就 `revalidateTag(…, { expire: 0 })`，bot 一推马上更新；收到 App 被移除、repo 被取消勾选时删掉对应来源。dev 站在 Cloudflare Access 后面，webhook 进不来，dev 的 App 不开 webhook，靠十分钟快取。
- 「use cache」函式丢出的错误出来时不一定还是原本的类别，所以读取失败用 `Error(code)` 带错误码（notFound / denied / badFormat / unavailable），外面用讯息判断。每个来源的上次结果（`lastOkAt`、`lastError`、`lastCount`）存在表里给面板显示，只有变了或超过十分钟才写回。

## API

- `GET /api/coinhub/posts`：登录者的 `{ sources, posts, app }`（`app`：本站是否设了 GitHub App）；未登录回 `{ data: null }`。开头 `await connection()`，否则会被预渲染成静态。
- `POST /api/coinhub/posts/sources { repo }`：加公开 repo；`DELETE ?id=`：移除来源。
- `GET /api/coinhub/posts/image?s=<来源 id>&p=<folder>/images/<id>_<n>.<ext>`：图片代理，只读登录者自己的来源，路径白名单，浏览器快取一年。

## GitHub App

dev 与正式站各一个（App 安装完只会跳回一个 callback URL）。建 App 时：

| 栏位                                                   | 正式站                                                                          | dev                                                                                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Homepage URL                                           | `https://yohaneowo.com/tradehub`                                                | `https://dev.yohaneowo.com/tradehub`                                                                                   |
| Callback URL                                           | `https://yohaneowo.com/api/coinhub/posts/github/callback`                       | `https://dev.yohaneowo.com/api/coinhub/posts/github/callback`（可再加 `http://localhost:3100/…` 给本机的「直接授权」） |
| Request user authorization (OAuth) during installation | 勾                                                                              | 勾                                                                                                                     |
| Expire user authorization tokens                       | 勾（预设）                                                                      | 勾                                                                                                                     |
| Webhook                                                | Active，URL `https://yohaneowo.com/api/coinhub/posts/github/webhook`，填 secret | 不勾 Active                                                                                                            |
| Repository permissions                                 | Contents: Read-only（Metadata 自动唯读）                                        | 同左                                                                                                                   |
| Subscribe to events                                    | Push                                                                            | —                                                                                                                      |
| Where can this GitHub App be installed?                | Any account                                                                     | Only on this account                                                                                                   |

建好后：产生 private key（下载 .pem）、产生 client secret，记下 App ID、Client ID、slug（App 网址最后一段）。Doppler `yohaneowo-site` 的 `prd` / `stg` 各自设 `GITHUB_APP_ID`、`GITHUB_APP_SLUG`、`GITHUB_APP_CLIENT_ID`、`GITHUB_APP_CLIENT_SECRET`、`GITHUB_APP_PRIVATE_KEY`（.pem 全文，多行可以，`\n` 也可以）、`GITHUB_APP_WEBHOOK_SECRET`（只有正式站）。`dev`（本机）可以用 dev 的 App。没设 App 时面板只提供公开 repo。

## 标的对应

Bot 用 TradingView 的写法（`BINANCE:BTCUSDT`、`TVC:GOLD`、`NASDAQ:TSLA`），本站图表是 Binance 交易对、Yahoo 代码和自己的指数。两边都换成一个键（`x-posts.ts` 的 `postSymbolKey` / `chartSymbolKey`），键相同就标上：

- 币对美元稳定币（USDT / USDC / FDUSD / BUSD / TUSD / USD）一律是 `COIN:<币>`：一则 BTC 贴文在 BTCUSDT、BTCUSDC、BTCUSDT.P 都会出现；其他交易对（SUIBTC）是 `PAIR:<对>`。
- 美股交易所（NASDAQ / NYSE / AMEX / ARCA / BATS / CBOE）→ `YAHOO:<代码>`；`CRYPTOCAP:X` → `INDEX:X`；`TWSE` → `.TW`、`HKEX` → `.HK`。
- 不同商品其实是同一样东西的写在 `SAME`（两边的键都会换过去）：代币化黄金 `COIN:XAUT`、`COIN:PAXG` → 金价 `YAHOO:GC=F`，所以 XAUTUSDT、PAXGUSDT 的图显示讲黄金的贴文，金价图也显示讲 XAUT 的贴文。
- 名字不一样的写在 `SPECIAL`：金 `TVC:GOLD` → `GC=F`、`SP:SPX` → `^GSPC`、`NASDAQ:IXIC` → `^IXIC`、`SSE:000001` → `000001.SS`、DXY、VIX、原油等。新出现对不上的标的就加在这里。
- `symbols: []` 的贴文（纯评论）只在面板的「全部」里。

## 谁判读什么

摘要（`summary_zh`）、标的（`symbols` / `assets`）、多空（`stance`）、价位（`levels`）、动作（`action`）都是 bot 写进 repo 的；本站只把 `symbols` 换成图表的键（上一节），不自己读贴文内容判断。判读有错要改 bot 的指示（范本的 `BOT_PROMPT.md`），或在 repo 里追加一行同 `id` 的修正。

## 头像

bot 在根目录 `accounts.json` 记每个帐号（`name`、`avatar` 等），每个帐号资料夹放 `avatar.<ext>`，每则贴文带 `avatar`（repo 路径）与 `author_name`。网站读成 `XPost.avatar` / `authorName`，头像经图片代理（路径白名单多了 `<folder>/avatar.<ext>`，浏览器快取一天，贴文图片仍是一年）。

## 图上的标记与面板

- 一个 overlay（`overlays/trading.ts` 的 `postMarks`）装下所有有贴文的 K 线（每根一个点，`extendData.groups` 是该根的贴文），每次重画时把相距不到一个徽章宽的 K 线合成一叠，缩小时合并而不是叠在一起；一叠最多 3 个徽章，多的写「+n」。徽章在 K 线区底部（像 TradingView 的事件），是作者的头像，外圈是这则贴文对这个标的的看法（绿多、红空、灰中性或只是提及）；头像用自订图形 `postAvatar`（`registerFigure`，canvas 圆形裁切）画，还没载入或没有头像时画两个字母（`accountTag`）在那个颜色上，载入后控制器重画标记（`onAvatarLoaded`）。
- 点徽章：KLineChart 的点击事件带着点到的 `figure`，徽章的 `key` 是 `posts:<这则 id>|<这叠的 id,…>`，「+n」是 `posts:|<这叠的 id,…>`；控制器发 `postMark`（带页面座标）。点徽章在旁边弹出那则贴文的卡片（`post-popover.tsx`，位置在点击当下量好存进 `xPosts.card`），卡片上方的箭头走同一作者在这个标的上的其他贴文（图跟着跳），可以转到侧栏、Esc 或点外面关闭；点「+n」打开侧栏并标出整叠。卡片与侧栏共用 `post-card.tsx`。选取的贴文：图跳到那根 K 线，`levels` 里属于这个标的的价位画成横线（`postLevel`：贴文之前淡、之后清楚，标签在左；支撑 / 进场绿、压力 / 止损 / 失效红、目标蓝）。
- 终端状态 `posts: { show, hidden, scope }`（localStorage）：图上显示与否、隐藏的帐号（键是 `来源 id:资料夹`，跨来源不撞名）、面板列这个商品还是全部。
- 帐号筛选：侧栏的帐号标签点一下只看那个帐号（隐藏其他），再点一次看全部，「全部」也回到全部；按住 Ctrl / ⌘ 点是逐个显示 / 隐藏。图上标记跟着一起筛。
- 贴文的图片点了用灯箱放大（`image-lightbox.tsx`：左右切换、方向键、点图放大到原尺寸、Esc 或点背景关闭；开着时卡片不响应 Esc 与点外面）。
- 面板（`components/coinhub/posts-panel.tsx`）：未登录显示登录按钮；没有来源时先显示「资料来源」（连接 GitHub、填公开 repo、范本连结），之后用标题列的插头按钮打开。从 GitHub 回来的结果用网址参数 `?xposts=connected&n=…` / `noIndex` / `state`… 带回，侧栏读到就弹提示、打开面板、清掉参数（`useXPostsReturn`）。

## 测试

- dev 模式下 `window.__coinhub.xPosts` 是贴文 store：把 `index.jsonl` 转成同样的格式（每则加 `source`）后 `xPosts.set({ status: "ready", posts, sources: [] })` 就能检查标记、点击与面板（图片会 404，正常）。
- 完整的连接流程要在 dev 站用 dev 的 GitHub App 走一次。
