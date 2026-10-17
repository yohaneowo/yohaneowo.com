# 观影统计：本机开发

网站公开页面允许游客浏览；登录提供 Google 和 Discord。观影档案以网站帐号为主：登录后在 `/moviehub` 选观影地区（预设取 Cloudflare 的 `cf-ipcountry`）并授权 Trakt 帐号：网站向 admin 要授权网址（`GET /website/movies/trakt/authorize`），带上 HMAC 签名、绑定帐号与 10 分钟有效的 `state` 和 PKCE 的 code_challenge（nonce 与 code_verifier 放在 `trakt_connect` cookie）；Trakt 回到 `/api/trakt/callback` 后，网站把 `code` 交给 admin（`POST /website/movies/users/{id}/trakt`），admin 换取 token、用 `users/me` 取得用户名 / 头像 / 是否私密并建档。token 加密存在 admin，同步时用它读取记录，所以私密帐号也能统计；token 失效时档案标 `traktReauth`，网页会要求重新授权。同一个 Trakt 帐号只能连到一个网站帐号（409 `traktTaken`），但 bot 时代没有主人的同名档案会被认领。不再接受手填 Trakt 网址。关联 Discord 是可选的：关联后 admin 把同一份档案和 Discord ID 对上，bot 的 `/movie subscribe` 只负责开启每日推荐；以前在 bot 里建的档案会在关联时自动接上，两边都有时以网站这边为准、推荐记录合并。统计仅当前登录用户可见，网站帐号 ID 与 Discord ID 都从服务端读取，浏览器不能指定其他人的 ID。

网站 PostgreSQL 只保存网站帐号、关联与会话。admin MySQL 保存订阅、统计快照、推荐记录和 TMDB / Wikipedia / 向量快取。Discord bot 使用 admin 内部接口。统计同步在 admin 里执行（`backend/app/plugin/module_bot/movie/sync/`，从 bot 的 JS 移植，逐字段比对过）：第一次有电影接口被调用时启动背景循环，每 15 秒领取一个到期的订阅；网页或 bot 请求刷新时马上唤醒。同步同时写入网站用的 snapshot 和 bot 推荐用的口味资料（`taste` 栏位，bot 经 `GET /internal/movies/taste/{id}` 读取）。Discord bot 退出不影响网站与同步。

## 启动

1. 启动本机网站 PostgreSQL、admin MySQL 和 Redis。
2. 在 admin/backend 运行原有 dev 后端。新路由需要后端重新加载；不要自动关闭用户已有实例。独立联调可运行 `python -m uvicorn app:create_app --factory --host 127.0.0.1 --port 8011`，环境为 `ENVIRONMENT=dev`、`DEBUG=true`。此时在以下终端设置 `$env:ADMIN_API_URL='http://127.0.0.1:8011'`。
3. 在网站目录运行 `pnpm db:migrate`，然后 `pnpm dev`。两者都经 `doppler run` 取得环境变量。
4. 不需要另外启动 worker：admin 开着就会同步。快照超过 24 小时自动更新，也可在网页请求刷新。手动刷新间隔至少 5 分钟；失败保留旧快照，5 分钟后重试。
5. 打开 `http://localhost:3100/moviehub`。旧地址 `/trakt` 会转到这里。登录后在页面上选地区、按「用 Trakt 帐号授权」建立档案（Trakt app 的 Redirect URIs 要含 `http://localhost:3100/api/trakt/callback`）；要让测试 bot 发推荐，到 `/settings` 关联 Discord 后在 bot 用 `/movie subscribe`。

网站连 admin 用的 `ADMIN_API_URL`、`ADMIN_MOVIES_TOKEN` 放在 Doppler。dev admin 没设 `WEBSITE_MOVIES_TOKEN` 时，会用 `BOT_API_TOKEN` 派生一个只读凭据，网站 dev 配置里存的就是这个派生值；admin 设了 `WEBSITE_MOVIES_TOKEN` 时，网站要改成同一个值。

本次预览使用网站 3100、独立 admin 8011。已有 admin 8001 未重启。要让原本正在运行的测试 bot 使用新存储，需先让它连接的 admin 加载新路由，再重启测试 bot；不要并行启动同一 token 的第二个 Discord 实例。

## dev 资料导入

在 bot 目录运行 `npm run movies:import`。必须使用 localhost admin，接口也只允许 dev。导入前为 `data/movies.json` 建立带时间戳的备份。脚本只补缺少的订阅、推荐与快取；已有订阅（包括已取消的订阅）不会被重新建立，已有记录不会被覆盖。未订阅用户的历史推荐也会保留。

旧 JSON 保留作备份，新代码不会回写。迁移后不要在同一份 dev 资料上继续跑旧版 bot 写入 JSON，否则这部分新变更不会自动合并。

## 第一版范围与验证

包含观看/评分数量、均分、剧集评分、评分分布、类型偏好及喜欢的导演/演员。总数使用完整 Trakt 记录，口味分析使用最近最多 200 部有 TMDB ID 的电影，并显示实际样本数。影人至少有两部已评分作品且均分高于个人均分 0.3；不把同一人的导演和演员记录混算。观影时间线、年代分布和推荐历史页面暂未实现。

admin 菜单为「Bot管理 → 观影统计」，权限为 `module_bot:movies:query` / `module_bot:movies:refresh`。网站专用 token 只能读取统计和请求同步，不能修改订阅或推荐记录。

验证命令：网站 `pnpm format`、`pnpm lint`、`pnpm build`。要不登录就看完整档案页（例如截图比较深浅色），把 admin `GET /website/movies/users/{id}` 的回应存成 JSON，用 `MOVIE_PREVIEW_FIXTURE=<路径> pnpm dev` 启动后开 `/moviehub/preview/profile`（只在开发模式有效）；admin 后端 `python -m pytest tests/test_movie_statistics.py -q`、Ruff；admin 前端 ESLint、Prettier、`vue-tsc --noEmit`；bot `node --test tests/movie-statistics.test.js`、`npx eslint .`。授权回调最终仍需本人完成 Google / Discord OAuth。

本轮只处理 dev，未迁移 NAS 或稳定版。以后部署需明确提供网站专用 token，并另行安排正式资料迁移。

## 大众评分、深度与排名

- 观影记录列出全部电影（最多 3000 部，最新在上）；口味分析（类型、影人）仍只用最近 200 部。观看日期优先用 Trakt 的最后观看时间，没有观看纪录的评分电影才用评分日期。
- IMDb / 烂番茄 / Metacritic 分数由 admin 查 OMDb（key 是 admin 的 `OMDB_API_KEY`，免费版每天 1000 次），按 IMDb ID 缓存：近两年的片 7 天、更老的 60 天。额度不够时先查最近看的，其余留到之后的同步；用量与额度在 admin「接口管理 → 第三方接口」。同步从 Trakt 的电影 ID 里拿 IMDb ID 批量查询；查不到不影响同步。
- 导演卡片：网站的 `/api/moviehub/director` 只检查登录，资料来自 admin 的 `GET /website/movies/people/lookup?id=|name=`（TMDB 人物、简介、导演作品，卡片缓存 7 天、作品的 IMDb ID 永久缓存；作品分数走 OMDb 缓存与额度，最近的作品先查）。卡片里的分数可切换 IMDb / 烂番茄 / TMDB / Metacritic，默认 IMDb；网站本身不再需要 TMDB key。
- 动漫：Trakt 列表加 `extended=full` 后每部作品带类型，标成 `anime` 的影集放在 snapshot 的 `anime`（结构同 `shows`），其余剧集在 `shows`；欧美动画只标 `animation`，留在剧集。动漫电影仍在电影里，每部带 `anime` 标记，网站电影页有「全部电影 / 不含动漫 / 只看动漫」筛选。三区各有平台排名（`watched_count`、`shows_watched_count`、`anime_watched_count`）。
- 剧集：snapshot 的 `shows`（admin `sync/shows.py`）。看过或评过分的剧都列出（最多 3000 部，最新在上），每行沿用电影的栏位（首播日期当 releaseDate、第一位主创当 director），加上看过 / 已播出集数。Trakt 的观看清单已不再附各季明细，看过的集数用该剧的播放集次（重看会多算，最多算到已播出集数）；已播出集数来自 TMDB，连载中的剧每周更新、完结的不再重查。网站切到「剧集」后，「导演」分页改叫「主创」，雷达的「深度」是范围内每部剧看完几成的平均，「数量」按看过的剧数在平台排名。
- 剧集评分：跟 Trakt 一样，整部剧的评分和各季评分分开。列表的「我的分」与「我的分 − 大众分」只用整部评分（只评了季的剧算未评分）；均分、评分分布、喜爱的主创也只看整部评分。点一行（或「N 季」按钮）展开各季：集数、首播年份、TMDB 季评分、我的季评分。季资料来自 TMDB 剧集详情（缓存版本 2）。
- 切换电影 / 剧集 / 动漫会回到「概况」分页并清空筛选。顶部「已看 / 观看次数」跟着时间、类型筛选：每行带 `plays`（剧集是播放集次），筛选后按列表计算；没筛选时显示总数（旧 snapshot 没有 `plays` 也显示总数）。
- 动漫的制作人员与评分（admin `sync/anime.py`）：TMDB 一部剧多季，Bangumi / AniList / MyAnimeList 每季是独立条目，所以每季单独配对——用剧的原名（日文）加该季首播日期（前后 20 天）搜 AniList 和 Bangumi；后面的季改名时沿 AniList 的续作关系找，再用 AniList 的日文名搜 Bangumi。人员取监督、原作、动画制作、音乐、总作画监督：中文页用 Bangumi 的名字，英文页用 AniList 的英文名（AniList 没有的只显示 Bangumi 的名字）。整部的 Bangumi / MAL 分数取第一季。
  - 每季的配对结果缓存在 admin（`anime_season`，近一年的季 7 天、更早 90 天；MAL 分数 `mal` 7 天）。AniList 每分钟约 30 次，所以第一次要分几轮：每次同步最多查 4 分钟（最新的先查），没查完就马上再排一次同步；某个服务连不上时不急着重排，等平常的排程。
  - MAL 分数：设了 `MAL_CLIENT_ID`（admin 的 Doppler，在 myanimelist.net/apiconfig 申请）就用官方 API，没有就走 Jikan。三个服务的用量都在「接口管理 → 第三方接口」。
  - 网站动漫页的评分来源可在 Bangumi / MyAnimeList / IMDb / TMDB 之间切换，默认中文页 Bangumi、英文页 MyAnimeList（不保存）；展开的季显示所选平台的季分数（选 IMDb / TMDB 时显示 TMDB 季分数）。「制作」分页按职位分组列出偏爱的人员，只用整部评分。
- 中英版：英文页（`/en/moviehub`）的片名用 TMDB 的英文译名（电影缓存版本 5、剧集 3），类型名在网站对照成 TMDB 英文名，导演卡片的简介与作品名按语言向 admin 要（`lang=en`）。
- 用户选的主要平台（IMDb / TMDB / Metacritic，默认 IMDb）存在网站 PostgreSQL 的 `movie_preference`。烂番茄是好评比例、不是平均分，只在评分卡片里显示，不能选为主要平台。
- 风格雷达五轴：毒舌（比所选平台平均低多少，低 2 分为满分）、探索（上映一年内看的比例）、多样性（类型熵）、深度（同步时计算：看过两部以上的导演、开始看的系列，平均看了几成；TMDB 导演作品与系列缓存在 admin 30 天）、数量（admin 读取时按 `watched_count` 算平台排名）。
- snapshot 新字段（`genres`、`imdb*`、`rottenTomatoes`、`metacritic`、`ratedIds`、`depth`）都是可选的：旧 snapshot 照样能读，下一次同步后才有资料。改了同步程序要重启 admin（dev 的自动 reload 也会重启循环）。

## 正式部署

1. 环境变量照 `.env.example` 全部填好；admin 的 Doppler `prd` 要有 `OMDB_API_KEY`、`TMDB_API_TOKEN`、`TRAKT_CLIENT_ID`（2026-10 之后建的 Trakt app 不发 secret、强制 PKCE，`TRAKT_CLIENT_SECRET` 只有旧 app 才需要；bot 不再需要这些，外部请求都经 admin 代查；Trakt OAuth 的 Redirect URIs 在 Trakt app 设定里加 `https://yohaneowo.com/api/trakt/callback` 与 `https://dev.yohaneowo.com/api/trakt/callback`）。Discord、`ADMIN_*`、`TMDB_API_TOKEN` 缺了不会报错，只是对应功能隐藏或显示「暂时无法连接」。
2. Docker 镜像不包含 `drizzle/` 和 drizzle-kit，迁移要在换镜像前另外跑：在本机把 `DATABASE_URL` 指向正式库，执行 `pnpm db:migrate`。
3. `0001_discord_account_identity` 会加唯一索引，若已有重复关联会失败。先检查：

   ```sql
   SELECT provider_id, account_id, count(*) FROM account GROUP BY 1, 2 HAVING count(*) > 1;
   SELECT user_id, provider_id, count(*) FROM account GROUP BY 1, 2 HAVING count(*) > 1;
   ```

4. `/moviehub/preview` 是图表设计用的示例页，正式环境返回 404。
