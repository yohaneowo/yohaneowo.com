<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# yohaneowo.com

**先读 `CLAUDE.md`**：技术栈、目录结构、工作约定（中文回复、Prettier、不碰 `.env*`、只有被要求才 commit）、本机开发和常用指令都在里面，同样适用于你。

## 协作方式

这个 repo 由 Claude Code 和 Codex 一起维护：通常 Claude 负责分析和审查，Codex 按交代的说明实现。改完跑 `pnpm format`、`pnpm lint`、`pnpm build`，并在结束时列出改了哪些文件。不要 commit。

## 当前进度（2026-10-13）

已完成：

- 从 create-next-app 起步，删掉了模板文件；Prettier（含 Tailwind class 排序）+ ESLint 已配好。
- 外壳：顶栏（`site-header.tsx`，功能导航 + 深浅色切换 + `UserMenu`）、首页功能卡片，都从 `src/components/site-nav.ts` 渲染。
- 登录：Better Auth + Google（`/login`、`/api/auth/[...all]`），Discord 等帐号预计登录后用 `linkSocial()` 关联（provider 和 UI 都还没做）。
- 数据库：Drizzle + PostgreSQL，目前只有 Better Auth 的四张表（`drizzle/0000_init.sql`）。
- 部署：`Dockerfile`（standalone）、`compose.dev.yaml`（本机 Postgres）。

占位中、还没做：

- `/trakt` 观影统计：只有一张用假数据的评分分布图（`rating-chart.tsx`）。要接 Trakt 观看记录；bot（`../yohaneowo-bot/services/movies/`）已经有 Trakt 订阅和口味分析，可以参考或共用。
- `/uidhub` UIDHub：只有「功能还在搭建中」的占位卡。目标是登录用户维护自己在各游戏的 UID，生成公开页给别人看。需要新表、编辑页和公开页。
- 关联 Discord 帐号：`auth.ts` 还没配 Discord provider（只有 Google），也没有关联 UI；登录页「登录后再关联」的文案目前是预告。

## 分支约定

- `main` 保存主线，`develop` 用于本机测试开发。
- 正式版 bot / admin 的资料迁移暂不处理；当前只开发和验证 dev 环境。
