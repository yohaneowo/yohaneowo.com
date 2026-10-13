# yohaneowo.com

个人网站：多个小功能的集合（观影统计、UIDHub 游戏 UID 公开页……）。Next.js 16（App Router）+ React 19 + shadcn/ui（base-nova 风格，组件在 `src/components/ui/`）+ Tailwind 4 + ECharts。登录用 Better Auth，资料存在网站自己的 PostgreSQL（Drizzle ORM）。

相关 repo：

- **yohaneowo-admin**（`../yohaneowo-admin`，FastAPI + Vue）：管理后台。
- **yohaneowo-bot**（`../yohaneowo-bot`，Node.js Discord / LINE bot）：已经有 Trakt 订阅与口味分析（`services/movies/`）。

## 工作约定

- 用中文回复。代码注释用英文，风格跟周围一致。前端只用 React，不用 Vue。
- 格式以 Prettier 为准（`.prettierrc.json`，含 Tailwind class 排序），ESLint 只管代码问题。改完跑 `pnpm format`、`pnpm lint`、`pnpm build`。
- 只有被要求时才 commit / push。commit 讯息用中文摘要，结尾加 `Co-Authored-By`。
- `.env*` 有密钥：不要印出内容、不要 commit。

## 结构

| 位置                               | 内容                                                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/site-nav.ts`       | 功能列表；顶栏和首页都从这里渲染，新增功能在这里加一项                                                                                      |
| `src/components/charts/echart.tsx` | ECharts 封装：按需注册图表类型（用到新类型要加进 `echarts.use`），跟着深浅色主题切换                                                        |
| `src/app/<功能>/`                  | 每个功能一个路由                                                                                                                            |
| `src/lib/auth.ts`                  | Better Auth 设定（服务端）；`getSession()` 读当前登录者。客户端用 `src/lib/auth-client.ts`                                                  |
| `src/db/schema.ts`                 | Drizzle 表定义。Better Auth 的四张表（user / session / account / verification）属性名要跟 Better Auth 的栏位名一致，数据库栏位是 snake_case |
| `drizzle/`                         | 迁移 SQL（`pnpm db:generate` 生成，要 commit）                                                                                              |

`next.config.ts` 开了 `cacheComponents`：读取动态资料（cookies、session）的组件要包在 `<Suspense>` 里，例如顶栏的 `UserMenu`。

## 登录

- 只用 Google 登录。Discord 等其他帐号是登录后用 `authClient.linkSocial()` 关联（`accountLinking` 已开，允许不同 email），关联的帐号存在 `account` 表。
- Google OAuth 的重定向 URI：`<BETTER_AUTH_URL>/api/auth/callback/google`，本机和正式站要分别加进 Google Cloud Console。

## 本机开发

- 数据库：`docker compose -f compose.dev.yaml up -d`（容器 `yohaneowo-site-postgres`，`127.0.0.1:15432`）。
- 环境变量在 `.env.local`（照 `.env.example`）。
- 改了 `schema.ts`：`pnpm db:generate --name <说明>` → 检查生成的 SQL → `pnpm db:migrate`。

## 常用指令

| 指令                                                      | 用途                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------- |
| `pnpm dev`                                                | 开发服务器（3100 端口；Windows 的 Hyper-V 保留了 2981–3080，3000 用不了） |
| `pnpm build`                                              | 生产构建（`output: "standalone"`）                                        |
| `pnpm format` / `pnpm format:check`                       | Prettier 格式化 / 检查                                                    |
| `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:studio` | 生成迁移 / 套用迁移 / 浏览资料                                            |
| `pnpm dlx shadcn@latest add <组件>`                       | 加 shadcn 组件                                                            |

## 部署（NAS）

跟 bot、admin 一样：`Dockerfile` 构建镜像推到 Docker Hub，NAS 只拉镜像跑，对外经 Cloudflare Tunnel。
