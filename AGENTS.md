<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# yohaneowo.com

**先读 `CLAUDE.md`**：技术栈、目录结构、工作约定（中文回复、Prettier、密钥在 Doppler、不印出值、只有被要求才 commit）、本机开发和常用指令都在里面，同样适用于你。

## 协作方式

这个 repo 主要由 Claude Code 直接实现和维护；Codex 只在用户明确要求时参与。参与时改完跑 `pnpm format`、`pnpm lint`、`pnpm build`（开发服务器开着时不要 build），并在结束时列出改了哪些文件。不要 commit。

## 当前进度（2026-10-14）

已完成：

- 从 create-next-app 起步，删掉了模板文件；Prettier（含 Tailwind class 排序）+ ESLint 已配好。
- 外壳：顶栏（`site-header.tsx`，功能导航 + 深浅色切换 + `UserMenu`）、首页功能卡片，都从 `src/components/site-nav.ts` 渲染。
- 登录：Better Auth + Google / Discord（`/login`、`/api/auth/[...all]`）；`/settings` 可关联或解除 Discord，唯一登录方式不能解除。游客不强制登录。
- 数据库：Drizzle + PostgreSQL 的 Better Auth 四张表，`0001` 增加帐号身份唯一约束。
- `/moviehub`：观影档案。登录后用 Discord 关联读取 admin 里的订阅和统计快照；旧地址 `/trakt` 会转到这里。统计由 admin 同步，资料集中在 admin；详见 `docs/movie-statistics.md`。
- `/coinhub`：自己的 TradingView（KLineChart 10）。Binance 现货 / 永续由浏览器直连（REST + WebSocket；合约的 WebSocket 在部分地区连上但不推数据，`binance-stream.ts` 侦测到后改用 REST 轮询），Yahoo 股票与指数序列（BTC.D、USDT.D、TOTAL、恐惧贪婪、MSTR mNAV、AHR999…）走 `/api/coinhub/*` 并用 `use cache` 缓存。约 70 个画线工具（`src/lib/coinhub/overlays/`）、约 55 个指标（`indicators/`）、警报、回放、多图布局、模拟交易、热门榜；状态存 localStorage，登录后同步到 `coinhub_workspace` 表。市场指标（恐惧贪婪、主导率、MSTR mNAV、AHR999、资金费率）是盖在图上的浮动面板 `market-panel.tsx`，数据来自 `/api/coinhub/overview`。
- 部署：`Dockerfile`（standalone）、`compose.dev.yaml`（本机 Postgres）。

占位中、还没做：

- `/moviehub` 后续：观影时间线、年代分布、推荐历史。
- `/uidhub` UIDHub：只有「功能还在搭建中」的占位卡。目标是登录用户维护自己在各游戏的 UID，生成公开页给别人看。需要新表、编辑页和公开页。

## 分支约定

- `main` 保存主线，`develop` 用于本机测试开发。
- 正式版 bot / admin 的资料迁移暂不处理；当前只开发和验证 dev 环境。
