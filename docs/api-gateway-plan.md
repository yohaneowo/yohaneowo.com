# 第三方 API 网关方案（搁置中，2026-10-23）

网站、admin、bot 三个服务各自打 OpenDota、STRATZ 等第三方 API，金钥各有一份、用量各算各的、快取在各自的记忆体里（部署就清空）。2026-10-22 Googlebot 与 GoogleOther 顺着 GOAT 的连结爬玩家公开页，一天把 OpenDota 免费额度打完、付费金钥再花 15000 次（$1.51），STRATZ 当天 15000 次也用光；STRATZ 自己不稳时失败又不快取，每开一页重送一组。当时的止血（STRATZ 冷却、只对登录用户预热、robots.txt、`[dotahub]` 日志、`/api/dotahub/health?calls=1` 计数）见 `docs/dotahub.md` 的「额度保护」。

站长决定长远要做 **方案 B（admin 当哑网关）**，但先搁置，之后有余力再做。这份文件把讨论过的内容留下来，到时直接照做。

## 两种「只在 admin 做」

- **A：admin 逐个端点重做**（`/website/dota/player/{id}`、`/match/{id}`…）。网站六十几个上游函式要在 Python 再写一遍，型别重复，以后加一笔资料改两个 repo。**不做。**
- **B：admin 当哑网关**。一个通用接口（例如 `POST /website/upstream`，body 带 `source`、`path` / GraphQL `query`、呼叫者标签），admin 不懂内容，只负责带金钥转发、Redis 快取、逐笔日志、算额度、到上限拒绝。网站只改 `lib/dota/data.ts` 的 `getJson` 与 `lib/dota/stratz.ts` 的 fetch 封装（五处左右），其余函式与 `"use cache"` 规则不动。

## B 对比现状（网站自己发、admin 只看）

|                 | 现状                              | B                                                              |
| --------------- | --------------------------------- | -------------------------------------------------------------- |
| 金钥            | 网站、admin 各一份                | 只在 admin                                                     |
| 额度 / 金额上限 | 各算各的                          | 一处算，网站、admin、bot 共用同一个上限                        |
| 日志            | 两边分别记                        | 一处，按来源 / 端点 / 呼叫者                                   |
| 快取            | 网站记忆体，部署就清空            | Redis，跨部署、跨服务共用                                      |
| 来源挂掉        | 各自处理（GOAT 有 Postgres 快照） | 一处做备援与快照                                               |
| 延迟            | 直连                              | 多一跳同主机内网，1–3 ms；快取命中更快                         |
| 依赖            | admin 挂了 DotaHub 还能看         | admin 挂了 DotaHub 跟着挂 → 降级：网关不通就直连、只用免费额度 |
| 改动量          | —                                 | admin 新模块 ＋ 网站改封装，一两天                             |
| 以后加来源      | 每个服务各接一次                  | 网关加一个 source 设定                                         |

## 网关要做齐的（业界 egress gateway 的清单）

1. **持有凭证**：金钥只在网关；各服务用内部身份（`X-Movies-Token` 那套）呼叫，并带呼叫者标签（`site/dotahub/player-page`、`admin/dota/samples`、`bot/…`），用量才算得到人头。
2. **对上游的限速**：按供应商的限制做 token bucket——OpenDota 每分钟 60、每天 2000（免费，按 IP）；STRATZ 每秒 8、每分钟 150、每小时 1500、每天 15000。超过就排队或拒绝，不去撞 429。
3. **预算与开关**：付费金钥按日 / 月硬上限（例如一天 3000 次＝$0.30），到了就停用付费（kill switch），接近时告警。OpenDota 收费 $1 / 10000 次，网站后台没有上限设定，只能自己挡。
4. **快取**：Redis（admin 已有 `admin-redis`），每个路径样式一个 TTL，语义是 stale-while-revalidate（过期先给旧的、背景重抓，跟网站现在的 `cacheLife` 一样）；加 **single-flight**——同一笔资料同时来的请求只打上游一次。网站那层 `"use cache"` 留着当第一层。
5. **韧性**：重试指数退避；**circuit breaker**——连续失败就断一段时间（网站现在的 5 分钟冷却是最简版）。
6. **可观测性**：每个来源 / 端点 / 状态码的计数与耗时、逐笔日志（原始留 7 天、按分钟汇总留 90 天）、告警（错误率、剩余额度低于多少、付费次数超过多少）。
7. **环境隔离**：dev 不配付费金钥（现在 stg 与 prd 共用同一把 `OPENDOTA_API_KEY`，要拿掉 stg 的），或给 dev 一个小预算。
8. **admin 页面**：今天各来源 / 端点次数、付费次数与预估金额、前几名呼叫者、调上限、封锁。可以交给 Codex 写，规格与复核由 Claude。

## 不属于网关的

按 IP 限速与 bot 识别是「谁在逛网站」的事，在 Cloudflare（Bot Fight Mode；免费方案一条 Rate Limiting 规则，例如 `/dotahub/*` 同一 IP 10 秒超过 10 次挡 10 秒）与网站 `src/proxy.ts`（按 `cf-connecting-ip` 记 10 分钟内开了几个贵的页：玩家页、比赛详情、局内科研、GOAT 对比；匿名超过 40 个回「慢一点」，登录放宽，站长 IP 白名单）做。网关只认得「哪个服务为了哪个页面来要资料」。

## 顺序（每步独立可上线）

0. **不等网关就该做的**：付费金钥日 / 月上限放在网站 `lib/dota/opendota-key.ts`（**已做，2026-10-23**：`OPENDOTA_PAID_DAILY_CAP` / `OPENDOTA_PAID_MONTHLY_CAP`，计数存网站 Postgres，重启不归零，到上限不带金钥、页面显示读不到；见 `docs/dotahub.md`「额度保护」）；stg 的 `OPENDOTA_API_KEY` 站长决定留着，用上限管；Cloudflare 的两项还没做。
1. admin 网关模块：转发、金钥、Redis 快取（SWR ＋ single-flight）、token bucket、断路器、逐笔日志、日 / 月上限、政策（上限、封锁）存表。
2. 网站 `getJson` 与 STRATZ 封装改走网关、带直连降级；admin 自己的 `module_bot/dota/`（追踪、样本、访客）也改走网关；bot 之后的 Dota 指令直接用网关。
3. admin 页面（用量、金额、前几名、封锁、调上限）。
4. 网站 `proxy.ts` 的页面限速。

## 当时查到的数字（参考）

- 别人的总览第一次打开：OpenDota 8 次（个人资料、胜负、最近比赛、常用英雄、位置、最近一场详情、天梯索引、队友），STRATZ 4–8 次（最近 100 场、历史 1–5 次、英雄等级、训练赛）。
- GOAT 战队列表 2 次 ＋ 前 10 队预热每队 4 次（1 小时）；正在比赛每分钟 1 次；对比每人 5 次；局内科研一边 10–15 次。
- admin 三个追踪帐号每 5 分钟各 1 次 STRATZ（约 860 / 天）、补历史与访客每分钟 1 页、样本每分钟 1–2 次。
- Googlebot 爬的那天：正式站 4 小时 1406 次 STRATZ 失败（三次一组，每 10–30 秒一组）。
