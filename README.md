<div align="center">

# Rhex

**基于 Next.js 16 + React 19 + Prisma + PostgreSQL 的现代社区系统**

适合搭建兴趣社区、知识社区、会员论坛、品牌用户社区和内部讨论平台。

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.2-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

</div>

---

## 项目简介

Rhex 是一套面向正式部署和长期维护的论坛/社区底座。项目当前基于 `Next.js App Router`、`React 19`、`Prisma`、`PostgreSQL` 和 `Redis` 构建，已经包含：

- 前台社区站点
- 完整后台管理
- 用户成长与运营能力
- 多种内置应用
- RSS 抓取与异步任务处理
- AI 助手自动回复能力

README 已按当前代码库现状更新，下面的功能、脚本和运行方式与仓库保持一致。

## 当前能力

### 论坛与内容

- 分区、节点、标签、关注、热门流、最新流、搜索
- 普通帖、悬赏帖、投票帖、抽奖帖
- 匿名发帖、匿名回复、匿名马甲配置
- 楼层回复、楼中楼、点赞、收藏、关注、举报、屏蔽
- `@用户` 提及通知
- 红包帖、聚宝盆、打赏、礼物、热度权重
- 帖子可见等级/VIP 限制、登录解锁、回复解锁、积分购买解锁
- 附件上传、附件购买、附件回复解锁、外链附件
- RSS 输出

### Markdown 与富内容

- Markdown 渲染
- 代码高亮
- KaTeX 数学公式
- Mermaid 图表
- Task List、脚注、上下标、定义列表、缩写等扩展
- 图片灯箱与媒体内容展示
- Markdown 自定义表情

### 用户体系

- 用户名密码登录
- GitHub OAuth、Google OAuth
- Passkey / WebAuthn
- 找回密码、邮箱/手机验证码
- 等级、勋章、认证、VIP
- 积分、签到、补签、邀请奖励
- 邀请码、兑换码
- 个人资料、头像裁剪、账户绑定
- 站外通知 Webhook

### 后台管理

- 总览仪表盘
- 用户管理
- 帖子管理
- 评论管理
- 分区/节点管理
- 节点申请审核
- 等级系统
- 勋章系统
- 认证系统
- 公告与帮助文档
- 举报中心
- 日志中心
- 敏感词与内容安全
- 站点设置
- 后台全局搜索

### 内置应用

| 应用 | 说明 |
|------|------|
| `AI 助手` | 配置 AI 开关、模型接口、提示词、代理账号，并在帖子/评论中被 `@` 后自动异步回复 |
| `RSS 抓取中心` | 支持 RSS/Atom 源管理、统一 worker 调度、Redis 队列快照、失败重试、日志追踪 |
| `五子棋` | 人机对战、免费次数、门票积分、AI 难度、胜利奖励 |
| `阴阳契` | 双选项积分挑战、税率配置、战绩统计 |
| `自助广告位` | 首页广告位购买、订单审核、广告展示 |

## 界面预览

<details>
<summary><b>首页与社区导航</b></summary>

![首页预览](./docs/preview/home-overview.png)

</details>

<details>
<summary><b>帖子详情</b></summary>

![帖子详情](./docs/preview/post-detail.png)

</details>

<details>
<summary><b>后台管理</b></summary>

![后台总览](./docs/preview/admin-dashboard.png)

</details>

<details>
<summary><b>站点设置</b></summary>

![后台设置](./docs/preview/admin-settings.png)

</details>

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | Next.js 16.2 + React 19 |
| UI / 样式 | Tailwind CSS 4.2、Base UI、Radix UI |
| 数据库 | PostgreSQL |
| ORM | Prisma |
| 缓存 / 队列 / 锁 | Redis + ioredis |
| 鉴权 | Session Cookie、GitHub OAuth、Google OAuth、Passkey |
| 内容渲染 | markdown-it、highlight.js、KaTeX、Mermaid |
| 文件处理 | 本地存储、S3/OSS 兼容对象存储、Jimp |
| 运行环境 | Node.js 20+ |

## 运行架构

标准部署至少包含 4 个部分：

- `Web / API`：Next.js 服务
- `PostgreSQL`：主数据库
- `Redis`：异步任务、消费锁、运行时队列
- `Worker`：统一后台进程，负责异步任务和 RSS 抓取

如果你使用本地上传，还需要为 `uploads/` 准备持久化存储。

仓库现在也提供了开箱即用的 `Dockerfile` 与 `docker-compose.yml`，可以直接按下方 Docker 安装步骤启动完整环境。

### Worker 说明

项目现在提供统一入口：

```bash
pnpm run worker
```

这个进程会同时启动：

- 通用后台任务 runtime
- RSS 抓取调度与执行

部署建议直接使用统一的 `pnpm run worker`。

> 说明：开发环境下，Web/API 进程会在入队时按需拉起后台任务 runtime。生产环境默认建议单独跑 `worker`，Web/API 只负责入队，不再自动消费；如需恢复旧行为，可设置 `BACKGROUND_JOB_WEB_RUNTIME=hybrid`。当前 `worker` 进程不再运行本地 while-loop，而是只负责消费统一 Redis background jobs；RSS 调度、竞拍恢复等周期任务都通过 Redis 延迟任务自驱动。

## 快速开始

### 推荐：Docker Compose

```bash
git clone https://github.com/lovedevpanda/Rhex.git
cd Rhex
cp .env.example .env
# 编辑 .env
docker compose up -d
```

至少确认以下配置：

- `SESSION_SECRET`
- `CAPTCHA_SECRET_KEY`
- `SITE_URL` / `APP_URL`

默认镜像：`ghcr.io/lovedevpanda/rhex:latest`

如需覆盖官方镜像，再设置 `APP_IMAGE`。

访问地址：

| 入口 | 地址 |
|------|------|
| 前台 | `http://localhost:3000` |
| 后台 | `http://localhost:3000/admin` |

更新：

```bash
git pull
docker compose pull
docker compose up -d
```

常用命令：

```bash
docker compose logs -f web
docker compose logs -f worker
docker compose down
docker compose down -v
```

### 本地开发 / 裸机部署

### 前置条件

- Node.js 20+
- PostgreSQL 16+
- Redis 6+
- pnpm

### 1. 克隆仓库

```bash
git clone <your-repo-url>
cd Rhex
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

复制 `.env.example`：

```bash
cp .env.example .env
```

`.env.example` 已按「启动方式 / 必填 / 可选」整理并附中文注释。
数据库相关变量按部署方式二选一：

- 宿主机直接运行：主要配置 `DATABASE_URL` / `REDIS_URL`
- Docker Compose：主要配置 `POSTGRES_*`，应用容器内连接串会自动注入

**必填（缺一不可）：**

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bbs?schema=public"
SESSION_SECRET="replace-with-a-long-random-secret"
CAPTCHA_SECRET_KEY="replace-with-a-long-random-secret"
REDIS_URL="redis://127.0.0.1:6379"
```

**可选（按需覆盖默认值）：**

| 分组 | 关键变量 | 说明 |
|------|----------|------|
| 站点 URL | `SITE_URL` / `APP_URL` | 用于生成外链、OAuth 回调、邮件中的绝对 URL，未设置时回落到请求头；`NEXT_PUBLIC_SITE_URL` 仅兼容旧配置，不推荐新部署使用 |
| Redis | `REDIS_KEY_PREFIX`、`REDIS_CLIENT_NAME_PREFIX`、`REDIS_SLOWLOG_SAMPLE_INTERVAL_MS` | Key 前缀与 SLOWLOG 采样周期 |
| 鉴权 | `AUTH_FLOW_SECRET`、`POW_CAPTCHA_SECRET_KEY`、`POW_CAPTCHA_DIFFICULTY`、`POW_CAPTCHA_EXPIRE_SECONDS` | 未设置的密钥会回落到 `SESSION_SECRET` / `CAPTCHA_SECRET_KEY` |
| 后台任务 | `BACKGROUND_JOB_WEB_RUNTIME`、`BACKGROUND_JOB_CONCURRENCY`、`BACKGROUND_JOB_MAX_ATTEMPTS`、`BACKGROUND_JOB_RETRY_*`、`BACKGROUND_JOB_STREAM_MAX_LENGTH`、`BACKGROUND_JOB_PENDING_*`、`BACKGROUND_JOB_DEAD_LETTER_*`、`BACKGROUND_JOB_IDEMPOTENCY_TTL_SECONDS`、`BACKGROUND_JOB_LANE_RESTART_*` | Redis Streams 队列行为调优 |
| 帖子竞拍 | `POST_AUCTION_SETTLEMENT_BATCH_SIZE`、`POST_AUCTION_SETTLEMENT_RECOVERY_*` | 结算批大小与恢复周期 |
| AI 助手 | `AI_REPLY_PROCESSING_STALE_MS` | AI 回复任务失联阈值（默认 30 分钟） |
| RSS 抓取 | `RSS_LOG_RETENTION_SECONDS`、`RSS_QUEUE_RETENTION_SECONDS` | 日志 / 队列保留时长 |
| 通用日志 | `LOG_STORE_MAX_ENTRIES` | 单个日志 ZSET 最大条目数 |
| 通知 Webhook | `SYSTEM_NOTIFICATION_WEBHOOK_TIMEOUT_MS`、`SYSTEM_NOTIFICATION_WEBHOOK_MAX_ATTEMPTS`、`SYSTEM_NOTIFICATION_WEBHOOK_RETRY_*` | 用户订阅的 Webhook 推送重试策略 |
| 种子管理员 | `SEED_ADMIN_USERNAME`、`SEED_ADMIN_PASSWORD`、`SEED_ADMIN_EMAIL`、`SEED_ADMIN_NICKNAME` | 仅首次初始化时生效，已存在管理员时忽略 |

说明：

- `DATABASE_URL`、`SESSION_SECRET`、`CAPTCHA_SECRET_KEY`、`REDIS_URL` 是启动和安全校验的关键配置，**必须**提前写好。
- `BACKGROUND_JOB_WEB_RUNTIME` 建议生产环境使用 `"worker-only"`，让 Web 进程只入队，实际消费交给独立 worker。
- 每个可选变量的默认值、取值范围、回落规则都在 `.env.example` 的对应注释中明确列出。
- OAuth、Passkey、SMTP、对象存储、AI Provider、RSS 源等业务配置统一放在后台 `/admin` 中维护，**不需要**写入环境变量。

### 4. 初始化数据库

```bash
pnpm run setup
```

这个过程会：

- 生成 Prisma Client
- 使用 `prisma db push` 同步数据库结构
- 检查当前数据库是否已完成初始化
- 在需要时写入初始业务数据

兼容说明：

- `pnpm run setup:dev`
- `pnpm run setup:prod`

以上两个命令都会执行同一套 setup 流程；其中 `pnpm run setup:prod` 会额外显式设置 `NODE_ENV=production`。

### 5. 启动开发服务

```bash
pnpm run dev
```

访问：

| 入口 | 地址 |
|------|------|
| 前台 | `http://localhost:3000` |
| 后台 | `http://localhost:3000/admin` |

默认种子管理员账号通常是：

- 用户名：`admin`
- 密码：`ChangeMe_123456`

首次登录后请立即修改密码。

### 6. 启动统一 worker

开发和生产都推荐再开一个终端：

```bash
pnpm run worker
```

### Docker Compose 安装

前置条件：

- Docker Engine / Docker Desktop
- Docker Compose Plugin

默认服务：

- `web`
- `worker`
- `postgres`
- `redis`

访问地址：

| 入口 | 地址 |
|------|------|
| 前台 | `http://localhost:3000` |
| 后台 | `http://localhost:3000/admin` |

更新：

```bash
git pull
docker compose pull
docker compose up -d
```

常用命令：

```bash
docker compose logs -f web
docker compose logs -f worker
docker compose down
docker compose down -v
```

## 生产部署（宿主机直跑）

最小推荐部署方式：

### 1. 构建 Web 应用

```bash
pnpm run start:prod
```

这个命令会显式以 `NODE_ENV=production` 执行构建和 `next start`。

### 2. 启动统一 worker

```bash
pnpm run worker
```

`pnpm run worker` 默认就会设置 `NODE_ENV=production`，需要更详细的堆栈排查时可以改用 `pnpm run worker:debug`。

### 3. 如需先初始化数据库

```bash
pnpm run setup:prod
```

### 4. 确保持久化资源可用

- PostgreSQL 正常运行
- Redis 正常运行
- 如果使用本地上传，`uploads/` 目录可持久化
- 如果使用对象存储，后台已配置 S3/OSS 兼容参数

### 部署建议

- Web 和 Worker 分成两个独立进程管理
- 反向代理后统一走 HTTPS
- 本地上传场景给 `uploads/` 挂载持久卷
- 为 PostgreSQL 和 Redis 做备份与监控
- 部署完成后先检查后台的：
  - 站点信息
  - 注册策略
  - 上传策略
  - SMTP
  - OAuth / Passkey
  - AI 助手
  - RSS 抓取中心

## 常用脚本

| 命令 | 说明 |
|------|------|
| `pnpm run dev` | 启动开发环境 |
| `pnpm run build` | 构建生产包 |
| `pnpm run start` | 启动生产 Web 服务 |
| `pnpm run start:prod` | 构建并启动生产 Web 服务 |
| `pnpm run setup` | 初始化数据库结构并按需写入基础数据 |
| `pnpm run setup:dev` | 以默认环境执行 `pnpm run setup` |
| `pnpm run setup:prod` | 以 `NODE_ENV=production` 执行 `pnpm run setup` |
| `pnpm run setup:start` | 初始化并启动开发环境 |
| `pnpm run setup:start:prod` | 初始化、构建并启动生产 Web 服务 |
| `pnpm run worker` | 启动统一 worker（默认 `NODE_ENV=production`），处理后台任务、延迟任务、RSS 抓取、拍卖结算、AI 回复等所有异步消费 |
| `pnpm run worker:debug` | 以更详细的堆栈信息启动 worker，方便排查 |
| `pnpm run prisma:generate` | 生成 Prisma Client |
| `pnpm run prisma:push` | 同步数据库结构 |
| `pnpm run prisma:seed` | 执行种子脚本 |
| `pnpm run lint` | 运行 ESLint |

## 后台模块概览

### 管理后台

- `/admin`
- `/admin?tab=users`
- `/admin?tab=posts`
- `/admin?tab=comments`
- `/admin?tab=structure`
- `/admin?tab=levels`
- `/admin?tab=badges`
- `/admin?tab=verifications`
- `/admin?tab=announcements`
- `/admin?tab=reports`
- `/admin?tab=logs`
- `/admin?tab=security`

### 站点设置

- 展示与品牌
- 注册与邀请
- 验证码
- GitHub / Google / Passkey
- SMTP
- 节点申请
- 评论与互动
- 匿名发帖
- 打赏与礼物
- 红包与聚宝盆
- 热度算法
- 积分与 VIP
- 上传与附件
- Markdown 表情
- 页脚导航
- 头部应用导航

### 应用后台

- `/admin/apps/ai-reply`
- `/admin/apps/rss-harvest`
- `/admin/apps/gobang`
- `/admin/apps/yinyang-contract`
- `/admin/apps/self-serve-ads`

## 项目结构

```text
Rhex/
├── src/
│   ├── app/              # 页面、路由、API Route
│   ├── components/       # UI 组件和页面组件
│   ├── db/               # Prisma 查询与数据访问层
│   ├── hooks/            # 前端复用 Hook
│   ├── lib/              # 业务服务、运行时、领域逻辑
│   └── types/            # TS 类型声明
├── prisma/
│   ├── migrations/       # 数据库迁移
│   ├── schema.prisma     # Prisma 数据模型
│   └── seed.ts           # 初始化种子脚本
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .env.example
├── scripts/              # setup、worker 等脚本
├── public/               # 静态资源
├── uploads/              # 本地上传目录
├── docs/                 # 项目文档和截图
├── package.json
└── README.md
```

## 适用场景

- 技术社区
- 知识论坛
- 内容沉淀型社区
- 品牌会员社区
- 内部讨论平台
- 带积分、VIP、活动和小游戏的运营型社区

## 社区支持

<div align="center">

**学 AI，上 L 站**

[![LINUX DO](https://img.shields.io/badge/LINUX%20DO-社区支持-blue?style=for-the-badge)](https://linux.do)

本项目在 [LINUX DO](https://linux.do) 社区发布与交流，感谢佬友们的支持与反馈。

</div>

## 贡献

欢迎提交 Issue 和 Pull Request。

推荐流程：

1. Fork 仓库
2. 新建分支
3. 提交修改
4. 发起 PR

## License

本项目基于 [MIT License](./LICENSE) 开源。
