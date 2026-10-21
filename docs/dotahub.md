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
  - `lib/dota/stratz.ts`：队友的备援（`getStratzPeers`：OpenDota 的 `peers` 失败时，`getPeers` 改用 STRATZ `stratz.page.player.peers` 最近 2000 场的同队与对手，转成 OpenDota 的格式）；单场（`getStratzMatch`，比赛详情与最近一场）、别人最近 100 场天梯（`getStratzRanked`，含死亡与经济/IMP，快取数小时）、重新解析（`requestStratzParse`，同一场 10 分钟一次）。
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

### 比赛详情

- 网址可带 `?p=<帐号 ID>`（比赛列表、最近一场的连结会带上那页的玩家），每分钟 IMP 图先显示那个人；没带就是登录者自己。
- **选角**：禁用独立一排（天梯全英雄选择是十个人一起提名、随机生效，没有阵营），下面是选人时间轴，每一选放在自己顺序的那一格，天辉在上、夜魇在下，换边处留空，看得出 2-2-2-2-1-1。选人的顺序与阵营用 STRATZ `pickBans`（OpenDota 的选人顺序当备援）；禁用用 OpenDota 的 `picks_bans`（Valve 的生效名单，但全部记在天辉，旧版就是因此天辉显示太多英雄），STRATZ 会把每个提名都标成成功（实测 16 个），只当备援。
- **每分钟 IMP**（`match-imp.tsx`）：STRATZ `impPerMinute`，颜色是 Dota 的玩家槽颜色，预设只显示那位玩家，点头像加其他人；每次阵亡在那一分钟画一个玩家颜色的 ✕ 圆点（ECharts markPoint，已在 `echart.tsx` 注册），滑过显示被哪个英雄击杀。「叠上同段位的某英雄」才开始读段位样本（`actions.ts` 的 server action `rankImp`，跟经济页对比共用 admin 的 `/samples/{英雄}/{牌位}`），画平均（虚线）与中间 50%（色带，`stackStrategy: "all"`，因为 IMP 有负数）；预设牌位是这场的平均段位（STRATZ `rank`），可以换八个牌位；样本收集中每 20 秒自动再问一次。

### 绝活

方案与理由见 `docs/dota-signature-heroes-v2.md`（第一版）；参数集中在 `src/lib/dota/signature.ts` 的 `SIGNATURE`，都还没校准。

- **字段盘点（方案 1.2 节）**：全部用 STRATZ。`getRankedHistory` 抓玩家所有天梯（每次请求 20 页 × 100 场，用别名，抓到短页为止，快取数小时），每场取时间、英雄、胜负、IMP、位置。实测 968 场一次请求 0.7 秒，93% 有 IMP、96% 有位置，最早到 2020 年。IMP 本身就是「跟同英雄同位置的平均比」，直接当精通型的外部基准；OpenDota benchmarks 不用。分段与组排第一版没用。
- **算法**：单位是「英雄 × 位置」（位置不明另成一组）。优势型拿同一段历史里的「其他英雄」当个人基准（合计 < 50 场就不判）：胜率用 Beta 后验（向基准收缩 k=30）算 P(差 > 3 个百分点)，IMP 用收缩后的平均与标准误算 P(差 > 2)，任一 ≥ 0.8。精通型：IMP 向 0 收缩（k=20）后 P(> 0) ≥ 0.8，而且有 IMP 的场次 ≥ 50%，并至少 2 个半年（每个 ≥ 10 场）、其中 ≥ 60% 平均 IMP 为正。近期是最近 180 天 ≥ 20 场；入选的证据在近期还成立才算当前（任一条即可）：胜率优势看近期胜率 ≥ 同期其他英雄胜率，IMP 优势看近期平均 IMP ≥ 同期其他英雄平均 IMP（同期其他英雄 < 50 场就用全部时间），精通型看近期平均 IMP > 0。都是点估计比较，不收缩（向基准收缩再比 ≥ 基准不会改变结果）。2026-10-21 以前一律看「近期 IMP > 0」，靠胜率入选、IMP 偏低的玩家（例如 1415003103 的幻影长矛手、幻影刺客）会被误判为历史绝活。近期与较早的平均 IMP 相差 ≥ 5 标上升 / 下降。
- **标签**：≥ 50 场且有证据 → 当前 / 历史绝活；不到 50 场但近 180 天 ≥ 20 场且有证据 → 潜力绝活；≥ 50 场没证据 → 高熟练候选（差一点：机率 ≥ 0.6，或 IMP 资料不到一半）或常玩英雄。只按证据挑，不凑数量。
- **英雄排行榜**：STRATZ `leaderboard.hero(heroIds, bracketIds)`（stratz.com 英雄页的排行榜），必须指定段位，按最近这个英雄的平均 IMP 排名，取前 50（`getHeroLeaderboard`，快取数小时）。IMP 榜照 STRATZ 的规则（页面上有写）：90 天内这个英雄至少 25 场天梯才上榜，按 90 天内最近 25 场的平均 IMP 排，每个段位前 50；榜是 STRATZ 定期更新的，实测跟当下自己算的最近 25 场会差几分。另有「等级榜」分页：Dota Plus 英雄等级（`leaderboard.dotaPlus`）本身不分段位、一次最多 100 笔，所以用别名一次读 30 页（约 3000 笔、等级最高的，`getHeroLevelPool`），同一人取最高等级，再按各人现在的段位筛出前 50（`getHeroLevelBoard(hero, tier)`），然后用别名一次查这 50 人在这个英雄的天梯 `heroPerformance`（场数、胜场、平均 IMP）。都快取数小时，第一次约 10 秒。低段位 30 级的人少（实测幻影长矛手先锋只有 2 人、莱恩先锋 15 人）。
- **三根柱子**：仿 ES-DE 主题 Art Book Next 的系统画面：历史 / 当前 / 潜力三根斜切的插画柱（当前最宽、金框），柱里是该类前 4 个英雄的全身立绘（`HeroInfo.render`，Valve 的 `videos/dota_react/heroes/renders/<slug>.png`，1440px 透明 PNG 约 1–2 MB，所以走 next/image 优化，`next.config.ts` 的 `remotePatterns`），底色按主属性。点了柱子用 Motion 的 `layout` 动画长成那一类的面板、卡片依序浮现，另外两根缩成两侧的直排窄条（点了切换），× 收回；手机上是横条往下展开。在 `signature/label-pillars.tsx`，尊重减少动态效果，左右方向键可在柱子间移动。
- **英雄登场**：每次点开柱子，那一类每张卡片的英雄依序登场：静态立绘在画面中间放大出现、停一下，再缩小飞到自己卡片的横向头像（`data-sig-hero`）上淡出，那张卡片随即显示（约 0.7 秒一个）。卡片仍用原本的头像，只有登场用立绘（与柱子同一个 `sizes`，图已载过）。登场层用 portal 挂在 body（面板的 layout 动画会 transform，fixed 会跟着歪），点任意处跳过；减少动态效果时直接显示。在 `label-pillars.tsx` 的 `Panel`。待机影片（`renders/<slug>.webm`）曾试过放进卡片头像，用户不要，已撤回；要换成影片登场再说。
- **英雄等级徽章**：`getHeroLevels`（STRATZ `player.dotaPlus`，每个英雄取最高等级），绝活卡片、高熟练表与等级榜都显示 `PlusBadge`。阶级照 Dota 2 Fandom wiki 的 Dota Plus 页：青铜 1–5、白银 6–11、黄金 12–17、铂金 18–24、大师 25–29、宗师 30；徽章图是 Valve 的 `Plus_Hero_Badge_1..6`（同一页），缩成 128px 放 `public/dota/plus/`。卡片右上角显示 56px 的徽章并把等级写在中间（`PlusBadge` 32px 以上才把数字叠在图上，小的写在旁边）。
- 页面：`signature/`（`body.tsx` 卡片与高熟练表、`leaderboard.tsx` 排行榜与 server action `actions.ts`），别人的在 `players/[id]/signature`。时间外验证脚本还没做（方案 8.2）。
- 小导航另有「局内科研」（`research/`，规划中）。

### GOAT（职业战队与选手）

不属于哪个玩家的页面：小导航的 GOAT 在别人的玩家页上也连到 `/dotahub/goat`。资料在 `src/lib/dota/pro.ts`，页面在 `dotahub/goat/`，文字在 `i18n/goat-zh.ts` / `goat-en.ts`（挂在 `dotahub.goat`）。

- **资料（自动更新）**：`getProScene()` 每 6 小时在背景重抓 OpenDota `/teams`（评分，近 120 天有比赛的前 80 队）与 `/proPlayers`（约 5 MB 的职业帐号登记表，只留现役战队与近 90 天有比赛的无队选手）。同名同队的帐号合为一人（`groupPlayers`），最近有比赛的是主帐号、其余是小号。登记表里没人的战队依序用 OpenDota `/teams/{id}/players` 的现役成员、再用 STRATZ `team.members`（战队最后一场前后 14 天有出赛的，最多 5 人）补。`getTeamPage()` 每小时（战队资讯、成员、比赛、英雄），`getProDetails()` 用 STRATZ 别名一次 10 人补真名、位置、赞助、Twitch / X、赛季段位与排行榜名次，`getLivePros()` 每分钟（OpenDota `/live` 里有职业选手的对局）。
- **页面**：战队（排名卡片，可搜战队、选手、帐号 ID）；战队页（帐号卡、每月战绩堆叠长条、常用英雄、近 20 场、近 365 天的对手与赛事、前选手）；选手目录（搜寻、位置 / 国家筛选、四种排序，展开看全部帐号）；正在比赛（每 60 秒 `router.refresh()`；上方按主属性摊开英雄图标筛选，可多选，预设只算职业选手用的英雄，可切换成所有玩家，符合的那一列标亮，`live/live-board.tsx`）；对比（`?ids=` 最多 4 人）。
- **对比**：清单存在浏览器（`compare-tray.tsx`，localStorage，`useSyncExternalStore`），各页的「加入对比」与底部对比栏；对比页的网址是准（`SyncPicks` 让清单跟着网址）。对比页：OpenDota 的总战绩、最近 20 场平均（KDA、GPM、XPM、正补、伤害、时长，每列最佳标金色）、雷达（每轴以最高者为满分）、各自常用英雄、每人都 ≥ 10 场的共同英雄、两两的同队 / 敌对（`/peers`），并连到经济 / IMP 对比（`?vs=`，最多 2 人，需连结 Steam）。帐号卡也有「跟我比经济 / IMP」。
- **坑**：`MAX_COMPARE`、`compareHref` 放在 `compare-ids.ts`，因为服务端从 `"use client"` 档案 import 到的常数只是参照（曾让对比页拿到空清单）。战队页是动态路由，跟比赛页一样要 `export const instant = false`（根版面的客户端 hook 读路径）。资料抓取时间（`page.at`）当「现在」，渲染时不能呼叫 `Date.now()`。
- **PandaScore**（`lib/dota/pandascore.ts`，`PANDASCORE_API_TOKEN` 在 Doppler dev / stg / prd，免费方案约每小时 1000 次）：人工维护的阵容（照片、真名、国籍、年龄、位置）与赛程（系列赛、赛事等级、BO、直播连结）。它没有 Steam 帐号，所以靠名字对接：`getPsTeams()`（6 小时）从近 120 天的比赛与即将开打的系列赛收集战队，对不上的 OpenDota 战队再用名称搜寻；`findPsTeam` 比全名、去掉 Team / Gaming… 后的名字、缩写；`sameNick` 比选手名（相同，或 4 字以上互相包含）。`lib/dota/goat.ts` 的 `getGoatScene()` 以 PandaScore 阵容为准（≥ 3 人才用）：对到的帐号补上 PandaScore 资料并移到这队，这队其他 OpenDota 帐号标为可能已离队（`stale`），再拿 STRATZ 记的职业名称 / Steam 名称救回（ATF = AMMAR_THE_F），仍对不到的列为「还没找到帐号」（战队页再拿为战队出赛过的成员比一次）。赛程页 `getPsSchedule()` 每 5 分钟；战队页 `getPsTeamMatches()` 每 15 分钟；战队卡片显示下一场。时间用 `LocalTime` 在浏览器转成当地时间。
- **还没接的来源**：Liquipedia（资料 API 要申请金钥，wiki API 有严格的频率限制）。

### 死亡热力图

- 地图：OpenDota 的 `detailed_740` 底图；STRATZ 的位置是地图格子，64–192，y 往北增加：`left = (x − 64) / 128`、`top = (192 − y) / 128`。
- 分区（`mapZone`）：四个角是高地、边是上下路、一条对角线是中路、另一条是河道，其他是野区；配合 OpenDota 查到的阵营（`getRankedSides`，一次拿全部天梯的 `player_slot`）换成「自己野区 / 敌方野区」。是大致范围。
- STRATZ 很多 2020–2024 的旧比赛标为已解析却没有死亡位置；有死亡却没位置的比赛不算进场数与平均。
- 一血：比赛的 `firstBloodTime` 等于你某次死亡的时间。
- 筛选：场数（伺服器端）、阶段、阵营、英雄、胜负（浏览器端）。胜率放在标题旁（`DEATHS_TITLE_SLOT`，常数放在一般模组 `insights.ts`，不能从 `"use client"` 档案给伺服器页面引入）。

### 经济与 IMP

`details`（admin `stratz.details()`，网站 `toDetails()` 同样的格式）：`pos` 1–5、`lane`、`award`、`gpm`、`xpm`、`nw`、`lh`、`dn`、`hd`、`nwm`（每分钟身价，累计值）、`impm`（每分钟 IMP，当下的表现，平均约等于整场 IMP）、`lhm`（每分钟新增的正补，加起来等于总正补）、`items`（每件装备第一次买的 `[秒, 物品 ID]`）。

- 两页共用 `stats/`：`load.ts` 统一两种来源、`controls.tsx` 筛选（场数、位置、阵营、英雄、胜负）与 `useMatchFilters`（同时给出「全部套用」与「少一个筛选」的清单，用在跨位置、跨英雄的比较）、`charts.tsx`（走势、每分钟曲线、横条）。
- 从玩家那一方的角度另外存了：`rad` 阵营、`lead`（每分钟队伍经济差，STRATZ `radiantNetworthLeads` 按阵营翻正负）、`wp`（每分钟胜率 0–100，`winRates`）、`laneOut`（自己那条线的对线结果 -2 大败到 2 大胜：优势路在天辉是下路、夜魇是上路）、`outcome`（STRATZ 的整场分类，例如 `COMEBACK`）、`bench`（同英雄同位置在 10 / 20 / 30 分钟的平均身价与正补，来自 `heroAverage`）。这些是后来加的，旧资料重读前没有，网站的 zod 有预设值。
- 分析都在 `stats/analysis.ts`：每分钟按经济差分「领先 / 均势（±2000）/ 落后」，从第 10 分钟算起（对线期几乎都是均势、收入本来就低，会把均势拉低）；每分钟收入是身价比上一分钟多多少（身价含装备，卖东西那分钟会掉）；上下限用第 10 与第 90 百分位；波动率是每场 GPM 的变异系数；顺风局 / 逆风局看第 15 分钟领先或落后 3000 以上；翻盘 / 被翻盘是落后或领先 1 万以上；连胜连败只看同一段时间（前后间隔 3 小时内）的上一场。
- 经济页另有：跟同英雄平均比、顺逆风收入（箱形图与表）、顺风局 / 均势局 / 逆风局、对线结果、翻盘与被翻盘、装备在中位时间前后做出的胜率。IMP 页另有：顺逆风时的 IMP、对线结果与 IMP、比赛长短、IMP 分布、连胜连败、什么时候打得最好（星期 × 四小时，用浏览器的时区）、胜率预测（曾低于 30% 却赢、曾高于 70% 却输）。很多区块不看胜负筛选（要比较胜负），区块说明里有写。
- 波动率（`stats/volatility.ts` 与 `economy/volatility-charts.tsx`，经济页用分页切换 4 种图：收入 × 波动率、漏斗图、控制图、滚动波动率）：一场的收入是 GPM，英雄的波动率是各场 GPM 的变异系数；至少 3 场才列，5 场以下画成淡色。漏斗图：把每场 GPM 除以该英雄平均后混在一起，模拟「纯靠运气抽 n 场」的波动率 95% 范围（固定随机种子，同样的资料画出来一样）。控制图（平均 ±2σ）与滚动波动率（最近 10 场）跟着英雄筛选。四象限文字用 ECharts 的 graphic（已在 `echart.tsx` 注册）。
- 每分钟曲线某一分钟至少 3 场才画。

### 对比模式（经济页与 IMP 页）

`?vs=` 列出对比对象，逗号分隔、最多两个：Dota 帐号 ID、`bracket`（我的对局）或 `r<牌位>h<英雄 ID>`（某个段位玩某个英雄的人，例如 `r5h31` 是传奇巫妖）。有对象时经济页换成 `economy/compare/compare-view.tsx`，所有图共用一组筛选；没有就是原本的经济页。入口：侧栏最上面的「头像 VS 头像 / 奖章」（`compare-menu.tsx`，名字在滑鼠停留时显示；侧栏不显示的较窄屏幕放在筛选上方、带名字），按「＋」打开选单，分「好友」与「段位」两页，已选的打勾、再按一次取消、队友表每一列的「对比」、别人总览的「跟我对比」。

- **好友**：可贴 ID / SteamID / 个人页网址，或从常一起玩的人挑（头像、一起几场）。对象是本站用户就读 admin 存档，否则用 STRATZ 最近 100 场。
- **我的对局**（原「同段位」，只有在本站连结的玩家才有）：自己存档比赛里另外 9 位玩家。admin 在 `dota_match.others` 存每人的英雄、胜负、阵营、位置、对线、GPM / XPM / 正补 / IMP、每分钟身价与正补、装备（`stratz.others_of`）；背景追踪每次补 30 场（`fill_others`）。网站读 `/users/{id}/bracket`，经济差按对方阵营翻正负。场数范围跟着自己的最近场数。
- **段位**：选英雄（每次打开选单都预选左边筛选的英雄，可以改；「所有英雄」时不预选，要先选一个）与牌位，旁边写出目前的位置筛选。选了之后左边的英雄筛选也切到那个英雄；之后在左边换英雄，段位对象自动换成同牌位的那个英雄（`router.replace` 改 `?vs=`）。两个来源：
  - **平均**（`getRankAverages`，STRATZ `heroStats`，快取一天）：STRATZ 只分四档（先锋–卫士、中军–统帅、传奇–万古、超凡–冠绝）。一次查回不分位置与 1–5 号位（别名），跟着位置筛选切换；「都算」时按自己玩这个英雄各位置的场数加权（`averagesFor`）。位置筛选一开始设成自己玩这个英雄最常打的位置。给胜率、每分钟身价 / 正补 / 经验、每件装备第一次购买的平均时间与购买率（`itemFullPurchase`，只算第一件）。用在数字表的胜率、10 分钟正补、10 / 20 分钟身价，身价 / 正补曲线，关键装备时间。
  - **样本**（admin `module_bot/dota/samples.py`，表 `bot_dota_sample_want` 与 `bot_dota_sample`，网站读 `/samples/{英雄}/{牌位}`，问一次就排进背景收集，14 天没人问就停）：其余的图（GPM / XPM、箱线图、森林图、局势、对线、位置）用它，不看场数筛选。公开比赛大多是 Turbo 与非天梯（天梯约 1 成），所以不直接从里面找英雄：OpenDota `publicMatches` 按牌位取一页（从 3 小时前开始，太新的 STRATZ 还没有），STRATZ 查这些比赛的玩家与各自现在的牌位（`seasonRank`），挑出牌位相符、没匿名的人排进队列；每分钟一次用 STRATZ 别名查队列里 10 个人这个英雄最近 90 天解析过的天梯（每人最多 10 场；20 人会超过 STRATZ 的查询复杂度上限 31 万）。凑满 100 场后每 3 天补新的，最多留 200 场。实测传奇巫妖几分钟就有 70 场以上。
  - 同一个人有多场，所以样本里 5 场以上的玩家各有波动率，就是森林图背景的灰点。
- 颜色：你蓝 `#3b82f6`、玩家橙 `#f97316` / 粉 `#ec4899`、我的对局与段位依序紫 `#8b5cf6` / 青 `#06b6d4`（虚线、空心）；不用绿 / 灰 / 红（那是领先 / 均势 / 落后）。
- 有段位对象时，英雄筛选一开始就设成那个英雄（段位只比一个英雄）。
- 只在对比模式出现的两张图：
  - **并排箱线图**：同一种局势（领先 / 均势 / 落后）下每分钟收入，按英雄并排，中位数、25–75%、10% 与 90%；只列自己玩过且至少一方也玩过的英雄，最多 10 个。
  - **森林图**（`forest.tsx`）：两个人时画波动率差值（`cv_A − cv_B`），95% 区间用 `SE(cv) ≈ cv·√((1+2cv²)/(2n))` 合成，区间不碰 0 才说谁更稳。三方或有我的对局 / 段位时改画分布：每人的波动率 ± 95% 区间，背景灰点是抽样的其他玩家（我的对局：每个英雄最多 20 人，用 STRATZ 别名查他们该英雄最近 10 场，`getHeroCvSample`，快取数天；段位：样本里自己的场次），右边写「你比 X% 某某稳」与两人之间分不分得出来。少于 3 场不比、少于 5 场标「仅供参考」。
- 其余沿用经济页的图：数字表、身价 / 正补曲线、收入 × 波动率、漏斗图、控制图（我的对局 / 段位画成 ±2σ 带）、滚动波动率（只画个人）、顺风局 / 均势局 / 逆风局、对线结果、各位置、关键装备时间（最快的加粗）。
- **IMP 页**（`imp/compare-view.tsx`）：同一个对比选单与 `?vs=`。资料只用每场 IMP 与每分钟 IMP（`impm`），所以段位不读 STRATZ 的平均（没有 IMP），只用样本；我的对局只有每场 IMP（`others` 没存每分钟），每分钟曲线与顺逆风箱线图不画它。内容：数字（场数、胜率、平均 IMP、赢 / 输的场 IMP、IMP 为正的比例）、每分钟 IMP 曲线、各英雄每场 IMP 箱线图（双方都至少 3 场）、领先 / 均势 / 落后时每分钟 IMP 箱线图（`impByState`）、局势 / 对线 / 位置的平均 IMP 表、最近 10 场滚动平均的走势（只画个人）。
- 关键装备（`isKeyItem`）：不是消耗品、不是秘密商店的材料，且价格 ≥ 2000，或是合成品且 ≥ 1000。价格来自 OpenDota `constants/items`，Valve datafeed 没有价格。

## 私讯

开关（`bot_dota_profile.notify`）**预设关闭**：新连结不私讯，要在网站的设定打开（之后打算加 Discord 指令订阅）；还要关联 Discord，而且只私讯天梯。

bot 每 60 秒 `GET /internal/dota/notifications`，私讯 embed：英雄、胜负、KDA、IMP、依序的死亡（时间、一血、谁杀的、掉金、等待），附 `/api/dotahub/deathmap?match=&account=` 画的 PNG（Satori；底图用 OpenDota 的 JPEG，Satori 不能读 webp）。dev 站在 Cloudflare Access 后面，bot-dev 拿到的是登录页，会只发文字。

## 健康状态

导航右边三个点（`/api/dotahub/health`）：每次网站真的呼叫 OpenDota、STRATZ、Valve/Steam 都记下结果、耗时与额度标头；太久没呼叫（3 分钟）才发小探测。绿＝正常、黄＝超过 5 秒或 5 分钟内失败过、红＝最近一次失败、灰＝还没检查。每个网站程序各自记录。

## 已知的坑

- **Node 连线等待**：从家里网路连 OpenDota（Cloudflare 后面）建立连线要约 280 毫秒，超过 Node `fetch` 对每个位址只等 250 毫秒的预设，会一直 `ETIMEDOUT`（curl 正常）。网站 `src/instrumentation-node.ts`、bot `index.js` 都把它设成 2 秒。
- **STRATZ 重新解析**不保证有用：有些比赛请了几小时还是没解析。
- **本机 admin 重启**：要连 uvicorn 的 `spawn_main` 子程序一起停掉，否则旧程式会继续占用 8001；迁移要 `main.py upgrade --env=dev`。
- 迁移 ID 不要用规律的字串（例如 `e1f2a3b4c5d6`），admin 里已经有用过的，会造成 alembic 循环；用随机的。
