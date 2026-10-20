# DotaHub

Dota 2 的个人统计：用 Steam 连结帐号后看总览、比赛、死亡热力图、经济、IMP 与队友；每场天梯打完由 bot 私讯这场的死亡地图。任何玩家都有公开页（`/dotahub/players/<Dota 帐号 ID>`），不用登录也能看。

## 资料来源

| 来源             | 拿什么                                                                                                                        | 金钥 / 额度                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Steam OpenID 2.0 | 连结 Steam 帐号（只拿 SteamID）                                                                                               | 不用金钥                                                                                                 |
| OpenDota         | 玩家资料、段位、胜率、最近比赛、比赛列表与详情、常用英雄、位置、队友、每场阵营、装备价格（`constants/items`）                 | 免费方案：每分钟 60、每天约 3000                                                                         |
| Valve datafeed   | 英雄与物品的中英文名称、图片、英雄主属性                                                                                      | 不用金钥                                                                                                 |
| STRATZ GraphQL   | IMP、死亡事件（位置、谁杀的、掉金、等待、一血）、经济与 IMP 的每分钟资料、位置、奖项、出装时间；重新解析 `retryMatchDownload` | `STRATZ_API_TOKEN`；每秒 8、每分钟 150、每小时 1500、每天 15000，**网站与 admin 的 dev、正式共用同一组** |

STRATZ 要设 `User-Agent: STRATZ_API`。OpenDota 的统计接口（`/wl`、`/heroes`、`/counts`、`/matches`）偶尔要半分钟以上，玩家资料 `/players/{id}` 通常一秒内。

## 分工

- **网站**（`src/app/[lang]/dotahub/`、`src/lib/dota/`）：页面与图表。OpenDota、Valve、STRATZ 的单场查询都在网站，`"use cache"` 快取。
  - `lib/steam-link.ts`：Steam 连结（`steam_account` 表）、SteamID 与 Dota 帐号 ID 互换（差 `76561197960265728`）、`getSteamOwner` 查某个 Steam 是不是本站用户。
  - `lib/dota/data.ts`：OpenDota 与 Valve。`getJson` 把超时、连不上、错误码都变成 `DotaUnavailable`；但 `"use cache"` 里丢出的错误回到页面会变成普通 `Error`，所以页面一律 `catch` 后显示提示，不靠错误类型判断。
  - `lib/dota/stratz.ts`：单场（`getStratzMatch`，比赛详情与最近一场）、别人最近 100 场天梯（`getStratzRanked`，含死亡与经济/IMP，快取数小时）、重新解析（`requestStratzParse`，同一场 10 分钟一次）。
  - `lib/dota/admin.ts`：admin 的网站接口（连结、状态、私讯开关、存档的死亡与 details）。
  - `lib/dota/health.ts`：导航右边三个点的状态（见下）。
  - `lib/dota/map.ts`：地图座标与分区。
- **admin**（`backend/app/plugin/module_bot/dota/`）：有在本站连结的玩家，背景追踪他们的天梯比赛并存下来；私讯队列。
- **bot**（`services/dota/notify.js`）：每分钟取 admin 的私讯队列，私讯死亡地图。

## 连结与追踪

1. `/api/steam/connect` → Steam → `/api/steam/callback`：验证 OpenID（`check_authentication`），写 `steam_account`，并通知 admin（`PUT /website/dota/users/{网站帐号 ID}/link`，带 Discord ID）。打开 DotaHub 页面时也会 `syncDotaLink` 补一次。
2. admin 的背景工作（`job.py`，第一次有 DotaHub 接口被呼叫时启动，每 30 秒最多处理 5 个到期的档案）对每个档案 `check()`：
   - 查最近 10 场天梯：新的且已解析的存起来；还没解析的先等（最多 24 小时），比赛结束 30 分钟还没解析就请 STRATZ 重新解析（3 小时后再请，最多 3 次，记在记忆体）。
   - 历史还没读完时，再读一页（100 场，`backfill_skip` 往后推）；读完 `backfill_done`。之后每 5 分钟检查一次，补历史时每分钟一次。
   - 已存的比赛再读到时会更新死亡、IMP、是否解析与 details，不动私讯状态。
3. 新比赛（连结后才打的、12 小时内、已解析、有 Discord、开着私讯）排进私讯队列；bot 送出（或私讯关闭）后回报 `sent`。
4. 要让所有人的历史重读（例如多存了新栏位），写一个只改资料的迁移：`UPDATE bot_dota_profile SET backfill_skip = 0, backfill_done = 0`。重读 1000 场约 10 分钟、10 次 STRATZ 额度。

`bot_dota_match` 每场一列：KDA、IMP、是否解析、`death_events`（JSON：`t` 秒、`x`/`y` 地图格子、`by` 击杀英雄、`gold` 掉金、`dead` 等待秒数、`fb` 是否一血）、`details`（JSON，见经济与 IMP）、私讯状态。

## 页面

| 页面       | 内容                                                                         | 资料                                                         |
| ---------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 总览       | 头像、段位、胜率、最近一场（IMP、死亡地图）、IMP 图、常用英雄、位置          | OpenDota；最近一场与 IMP 图另用 STRATZ / admin               |
| 比赛       | 比赛列表、比赛详情（计分板、出装、经济与经验曲线、十个玩家的死亡地图、选角） | OpenDota、STRATZ 单场                                        |
| 死亡热力图 | 热力图、死在哪里（分区）、重点卡片、胜率                                     | 有连结：admin 存档（含「全部」）；没连结：STRATZ 最近 100 场 |
| 经济       | GPM、XPM、正补、身价、曲线、各位置、关键装备时间                             | 同上（details）                                              |
| IMP        | 走势、一场里每分钟的 IMP、各位置、英雄表、最好最差、奖项                     | 同上（details）                                              |
| 队友       | 常一起玩的人（同队 ≥ 3 场）                                                  | OpenDota                                                     |

别人的页面（`/dotahub/players/<ID>/…`）子导航整排换成那位玩家的；打开自己的 ID 会转回自己的页面。宽萤幕（≥1280px）时 DotaHub 页面加宽（`components/page-width.tsx`）。

### 总览的快取与「几分钟前更新」

OpenDota 的资料用自订 `cacheLife`：胜率、最近比赛 15 分钟后算过期（`QUICK`），常用英雄、位置 6 小时（`SLOW`），都保留 7 天。过期后先给旧资料、背景再抓。每份资料带抓取时间（`Fresh<T>`），各区标题旁显示「几分钟前更新」；过期时显示「更新中…」，8 秒后 `router.refresh()` 拿新资料，最多 3 次（`freshness.tsx`）。总览拆成几块各自 `Suspense`，一块慢不会拖住整页。快取在网站程序的记忆体里，部署后清空。

### 死亡热力图

- 地图：OpenDota 的 `detailed_740` 底图；STRATZ 的位置是地图格子，64–192，y 往北增加：`left = (x − 64) / 128`、`top = (192 − y) / 128`。
- 分区（`mapZone`）：四个角是高地、边是上下路、一条对角线是中路、另一条是河道，其他是野区；配合 OpenDota 查到的阵营（`getRankedSides`，一次拿全部天梯的 `player_slot`）换成「自己野区 / 敌方野区」。是大致范围。
- STRATZ 很多 2020–2024 的旧比赛标为已解析却没有死亡位置；有死亡却没位置的比赛不算进场数与平均。
- 一血：比赛的 `firstBloodTime` 等于你某次死亡的时间。
- 筛选：场数（伺服器端）、阶段、阵营、英雄、胜负（浏览器端）。胜率放在标题旁（`DEATHS_TITLE_SLOT`，常数放在一般模组 `insights.ts`，不能从 `"use client"` 档案给伺服器页面引入）。

### 经济与 IMP

`details`（admin `stratz.details()`，网站 `toDetails()` 同样的格式）：`pos` 1–5、`lane`、`award`、`gpm`、`xpm`、`nw`、`lh`、`dn`、`hd`、`nwm`（每分钟身价，累计值）、`impm`（每分钟 IMP，当下的表现，平均约等于整场 IMP）、`lhm`（每分钟新增的正补，加起来等于总正补）、`items`（每件装备第一次买的 `[秒, 物品 ID]`）。

- 两页共用 `stats/`：`load.ts` 统一两种来源、`controls.tsx` 筛选（场数、位置、阵营、英雄、胜负）与 `useMatchFilters`（同时给出「全部套用」与「少一个筛选」的清单，用在跨位置、跨英雄的比较）、`charts.tsx`（走势、每分钟曲线、横条）。
- 每分钟曲线某一分钟至少 3 场才画。
- 关键装备（`isKeyItem`）：不是消耗品、不是秘密商店的材料，且价格 ≥ 2000，或是合成品且 ≥ 1000。价格来自 OpenDota `constants/items`，Valve datafeed 没有价格。

## 私讯

bot 每 60 秒 `GET /internal/dota/notifications`，私讯 embed：英雄、胜负、KDA、IMP、依序的死亡（时间、一血、谁杀的、掉金、等待），附 `/api/dotahub/deathmap?match=&account=` 画的 PNG（Satori；底图用 OpenDota 的 JPEG，Satori 不能读 webp）。dev 站在 Cloudflare Access 后面，bot-dev 拿到的是登录页，会只发文字。

## 健康状态

导航右边三个点（`/api/dotahub/health`）：每次网站真的呼叫 OpenDota、STRATZ、Valve/Steam 都记下结果、耗时与额度标头；太久没呼叫（3 分钟）才发小探测。绿＝正常、黄＝超过 5 秒或 5 分钟内失败过、红＝最近一次失败、灰＝还没检查。每个网站程序各自记录。

## 已知的坑

- **Node 连线等待**：从家里网路连 OpenDota（Cloudflare 后面）建立连线要约 280 毫秒，超过 Node `fetch` 对每个位址只等 250 毫秒的预设，会一直 `ETIMEDOUT`（curl 正常）。网站 `src/instrumentation-node.ts`、bot `index.js` 都把它设成 2 秒。
- **STRATZ 重新解析**不保证有用：有些比赛请了几小时还是没解析。
- **本机 admin 重启**：要连 uvicorn 的 `spawn_main` 子程序一起停掉，否则旧程式会继续占用 8001；迁移要 `main.py upgrade --env=dev`。
- 迁移 ID 不要用规律的字串（例如 `e1f2a3b4c5d6`），admin 里已经有用过的，会造成 alembic 循环；用随机的。
