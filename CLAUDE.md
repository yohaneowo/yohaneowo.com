# yohaneowo.com

个人网站：多个小功能的集合（观影统计、UIDHub 游戏 UID 公开页……）。Next.js 16（App Router）+ React 19 + shadcn/ui（base-nova 风格，组件在 `src/components/ui/`）+ Tailwind 4 + ECharts。登录用 Better Auth，资料存在网站自己的 PostgreSQL（Drizzle ORM）。

相关 repo：

- **yohaneowo-admin**（`../yohaneowo-admin`，FastAPI + Vue）：管理后台。
- **yohaneowo-bot**（`../yohaneowo-bot`，Node.js Discord / LINE bot）：已经有 Trakt 订阅与口味分析（`services/movies/`）。

## 工作约定

- 用中文回复。代码注释用英文，风格跟周围一致。前端只用 React，不用 Vue。
- 格式以 Prettier 为准（`.prettierrc.json`，含 Tailwind class 排序），ESLint 只管代码问题。改完跑 `pnpm format`、`pnpm lint`、`pnpm build`。
- 只有被要求时才 commit / push。commit 讯息用中文摘要，结尾加 `Co-Authored-By`。
- 密钥在 Doppler：不要印出值（`doppler secrets` 会印出，用 `--only-names`），也不要写进 repo 或 `.env` 文件。

## 结构

| 位置                                       | 内容                                                                                                                                                                                                                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/site-nav.ts`               | 功能列表；顶栏和首页都从这里渲染，新增功能在这里加一项                                                                                                                                                                                                                        |
| `src/components/charts/echart.tsx`         | ECharts 封装：按需注册图表类型（用到新类型要加进 `echarts.use`），跟着深浅色主题切换                                                                                                                                                                                          |
| `src/app/[lang]/<功能>/`                   | 每个功能一个路由。所有页面都在 `[lang]` 下（`zh` / `en`），API 路由在 `src/app/api/`，不分语言                                                                                                                                                                                |
| `src/i18n/`                                | 中英字典：`zh.ts`（同时是类型）和 `en.ts` 要同步加键。服务端用 `getDictionary()` / `getLocale()`（`server.ts`），客户端用 `useLocale()`                                                                                                                                       |
| `src/proxy.ts`                             | 语言路由：中文没有前缀（`/moviehub` 内部改写到 `/zh/moviehub`），英文在 `/en/...`；记住顶栏切换的语言（`lang` cookie），首次访问看浏览器语言                                                                                                                                  |
| `src/app/[lang]/moviehub/genre-weights.ts` | 类型环的加权（常见类型分得少、稀有类型分得多，一部片合计 1）与三份基率表；算法与抓样方法见 `docs/genre-weighting.md`                                                                                                                                                          |
| `src/lib/coinhub/`                         | CoinHub：`chart-controller.ts` 包一个 KLineChart 实例（数据加载、画线保存与撤销、回放），`overlays/` 画线工具，`indicators/` 指标，`server.ts` 上游数据（只在服务端），`store.ts` 终端状态。KLineChart 一 import 就碰 `window`，所以终端用 `next/dynamic` + `ssr: false` 载入 |
| `src/lib/auth.ts`                          | Better Auth 设定（服务端）；`getSession()` 读当前登录者。客户端用 `src/lib/auth-client.ts`                                                                                                                                                                                    |
| `src/db/schema.ts`                         | Drizzle 表定义。Better Auth 的四张表（user / session / account / verification）属性名要跟 Better Auth 的栏位名一致，数据库栏位是 snake_case                                                                                                                                   |
| `drizzle/`                                 | 迁移 SQL（`pnpm db:generate` 生成，要 commit）                                                                                                                                                                                                                                |

站内连结用 `localePath(lang, "/路径")`（`src/i18n/config.ts`），不要写死 `/路径`，否则英文页会跳回中文。新增 UI 文字一律放进字典。

`next.config.ts` 开了 `cacheComponents`：读取动态资料（cookies、session）的组件要包在 `<Suspense>` 里，例如顶栏的 `UserMenu`。

## 登录

- 支持 Google 或 Discord 登录；公开页面无需登录。观影统计只要登录即可：档案在 `/moviehub` 上建，Trakt 帐号只能经 Trakt OAuth 连接（`moviehub/actions.ts` 的 `startTraktConnect` 产生签名 `state` + `trakt_connect` cookie → Trakt → `/api/trakt/callback` → admin 换 token 并建档），不接受贴网址；地区选一下即可。档案存在 admin，以网站帐号 ID 为键。关联 Discord 是可选的（`authClient.linkSocial()`，允许不同 email，禁止仅凭相同 email 自动合并帐号）：关联后 bot 能找到同一份档案发每日推荐，以前在 bot 里建的档案也会接上。`/connect/discord` 是 bot 发出的「智能」链接：未登录就用 Discord 登录，已登录就把 Discord 关联到当前帐号。
- 别人的观影统计：`/moviehub/u/<网站帐号 ID>`，任何人（含未登录）都能看，羁绊卡片的每一行都连到这里。页面用 admin 的只读接口（`/website/movies/users/{id}/view`，不会认领或合并档案），藏掉刷新等本人按钮；羁绊按对方已存的伺服器列表算，不动对方的 Discord token；对方还没有快照时会帮 TA 排一次同步。登录且自己有统计的访客，在风格雷达左下角有「对比」勾选框，把自己的风格用蓝色虚线叠上去（`compare.ts` 只传雷达要用的栏位）。
- Discord OAuth 回调：`<BETTER_AUTH_URL>/api/auth/callback/discord`，需要 `identify`、`email`、`guilds`（`guilds` 给观影页的「羁绊」用：`lib/discord-guilds.ts` 用 Better Auth 存的 token 读 `/users/@me/guilds` 存进 `discord_guild` 表，每天最多刷新一次；没有这个 scope 的旧关联会在羁绊卡片看到「重新授权 Discord」）。帐号与 Discord 身份都有唯一约束，不能跨网站帐号重复关联。
- Trakt OAuth 回调：`<BETTER_AUTH_URL>/api/trakt/callback`，要加进 Trakt app 的 Redirect URIs（正式、dev、本机各一条）。流程用 PKCE（网站产生 verifier 放 `trakt_connect` cookie，challenge 交给 admin 拼进授权网址）；Client ID 在 admin 的 Doppler，新 Trakt app 没有 secret，网站不碰 Trakt API。
- Google OAuth 的重定向 URI：`<BETTER_AUTH_URL>/api/auth/callback/google`，本机和正式站要分别加进 Google Cloud Console。

## 本机开发

- 数据库：`docker compose -f compose.dev.yaml up -d`（容器 `yohaneowo-site-postgres`，`127.0.0.1:15432`）。
- 环境变量在 Doppler（项目 `yohaneowo-site`，本机用 `dev`，NAS 用 `prd`），`.env.example` 只列名称。新电脑先 `doppler login`，再在本目录 `doppler setup`（读 `doppler.yaml`）。`pnpm dev`、`pnpm start`、`pnpm db:*` 都已包在 `doppler run` 里；直接跑别的指令要自己加 `doppler run -p yohaneowo-site -c dev --`（明确写项目和配置：Doppler 比对 `doppler setup` 绑定的目录时区分路径大小写）。Git Bash 里执行 `doppler` 要加 `env -u PWD`（它会读 Unix 格式的 `PWD`，找不到登录状态）。
- 改了 `schema.ts`：`pnpm db:generate --name <说明>` → 检查生成的 SQL → `pnpm db:migrate`。
- 观影统计的资料、同步任务状态与快取保存在 admin MySQL；网站通过服务端接口读取（`/website/movies/users/{网站帐号 ID}`，带上关联的 Discord ID）。地区的预设值来自 Cloudflare 的 `cf-ipcountry` 头。统计由 admin 自己同步（`module_bot/movie/sync/`，第一次有电影接口被调用时启动，每 15 秒检查一次），不再有独立 worker。启动与迁移说明见 `docs/movie-statistics.md`。

## 常用指令

| 指令                                                      | 用途                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------- |
| `pnpm dev`                                                | 开发服务器（3100 端口；Windows 的 Hyper-V 保留了 2981–3080，3000 用不了） |
| `pnpm build`                                              | 生产构建（`output: "standalone"`）                                        |
| `pnpm format` / `pnpm format:check`                       | Prettier 格式化 / 检查                                                    |
| `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:studio` | 生成迁移 / 套用迁移 / 浏览资料                                            |
| `pnpm dlx shadcn@latest add <组件>`                       | 加 shadcn 组件                                                            |

## 部署（Coolify）

跑在家里的 Proxmox 虚拟机（Coolify，局域网 `http://192.168.0.210:8000`）。push 到 `main` 会经 GitHub webhook 自动用 `Dockerfile` 构建并部署；镜像启动时先跑 `scripts/migrate.mjs` 套用 drizzle 迁移，再启动 Next.js。正式站的密钥在 Doppler `prd`，容器只拿到一个 `DOPPLER_TOKEN`。对外经 Cloudflare Tunnel，TLS 由 Cloudflare 终结，所以 Coolify 里的域名写 `http://yohaneowo.com`。观影统计连的是同一台机器上的 admin（`ADMIN_API_URL=http://yohaneowo-admin-web`）。`develop` 是开发分支：push 后自动部署到 dev 站（https://dev.yohaneowo.com，Cloudflare Access 只有站长能开，Doppler `stg`，连的是 admin 的 dev 部署 `http://yohaneowo-admin-dev-web`）；用户在 dev 站看过并确认后，才把 `develop` 快进合并进 `main` 上线。**没有用户确认不要合并进 `main`。** admin、bot 也各有 dev 部署（`admin-dev.yohaneowo.com`、`line-dev.yohaneowo.com`），同样跟 `develop` 分支。
