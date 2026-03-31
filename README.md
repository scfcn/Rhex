# Rhex 论坛系统

> 一个面向正式部署、长期维护和二次开发的现代社区系统。

`Rhex` 基于 `Next.js App Router`、`Prisma`、`PostgreSQL` 构建，内置论坛、用户成长、通知私信、管理后台、内容审核、邀请与兑换、上传、应用中心等完整能力，适合自建兴趣社区、知识社区、品牌论坛和内部讨论平台。

## 在线演示

- 演示站点: [https://rhex.im/](https://rhex.im/)
- 项目仓库:
  - GitHub: [https://github.com/lovedevpanda/Rhex](https://github.com/lovedevpanda/Rhex)
  - Gitee: [https://gitee.com/rhex/Rhex](https://gitee.com/rhex/Rhex)

## 适用场景

- 搭建垂直兴趣社区、知识论坛、内容沉淀型社区
- 作为公司内部讨论平台、产品用户社区或会员社区底座
- 在现有论坛模型上继续扩展积分、会员、应用、活动和运营工具

## 功能预览

### 1. 首页与社区导航

- 论坛首页支持左右栏布局、分区节点导航、帖子列表/画廊模式切换
- 左侧导航支持折叠收起，画廊模式下会自动适配更高密度布局

![首页预览](./docs/preview/home-overview.png)

### 2. 画廊模式与帖子卡片

- 支持封面图卡片流展示
- 支持悬停查看完整标题
- 支持封面图懒加载，适合图片较多的社区首页

![画廊模式占位](./docs/preview/gallery-mode.png)

### 3. 帖子详情页

- 支持 Markdown 渲染、代码高亮、KaTeX、Mermaid、任务列表、脚注
- 支持图片灯箱、帖子内图片懒加载、隐藏内容、最低阅读等级等扩展能力

![帖子详情占位](./docs/preview/post-detail.png)

### 4. 个人主页与成长体系

- 支持等级、勋章、认证、VIP、积分、签到、邀请关系等资料展示
- 支持个人资料编辑、头像上传、昵称修改和积分消耗提示

![用户主页占位](./docs/preview/profile-center.png)

### 5. 后台总览与管理中心

- 支持用户、帖子、举报、日志、内容安全、站点设置等后台模块
- 支持后台顶部搜索，快速定位“邀请码”“签到日志”“补签”“上传图片”等配置入口

![后台总览占位](./docs/preview/admin-dashboard.png)

### 6. 站点设置与积分/VIP

- 支持基础信息、注册邀请、互动热度、友情链接、邀请码、兑换码、上传、积分与 VIP 等配置
- 支持 VIP1 / VIP2 / VIP3 差异化价格策略

![后台设置占位](./docs/preview/admin-settings.png)

### 7. 应用中心与独立应用后台

- 内置应用中心
- 当前示例应用包括五子棋、阴阳契、自助广告位
- 每个应用都有独立后台配置页

![应用中心占位](./docs/preview/apps-center.png)

## 核心功能

### 论坛与内容系统

- 分区、节点、标签、帖子分类
- 普通帖、悬赏帖、投票帖、抽奖帖
- 帖子封面图、画廊模式、精华、置顶、下线、审核
- 回复、楼中楼、点赞、收藏、关注、举报
- 隐藏内容、回复解锁、付费解锁、最低等级可见、红包帖
- RSS 输出和搜索页

### Markdown 与富文本能力

- Markdown 基础语法
- 代码高亮
- KaTeX 数学公式
- Mermaid 图表
- Task List、脚注、上下标、缩写、定义列表、标记文本
- 安全的 Markdown HTML 白名单处理
- 图片灯箱和媒体嵌入能力

### 用户、成长与会员体系

- 用户注册、登录、找回密码、会话管理
- 昵称、头像、个人简介、用户主页
- 等级系统、勋章系统、认证系统
- 积分系统、签到、补签
- VIP 购买与续费
- VIP1 / VIP2 / VIP3 差异化权益与积分价格
- 邀请码、兑换码、邀请奖励

### 社区互动

- 站内通知
- 私信
- `@` 提及
- 红点未读数量提示
- 公告、友情链接、帮助页、FAQ

### 后台管理

- 总览仪表盘
- 用户管理
- 帖子管理
- 分区/节点管理
- 等级系统
- 勋章系统
- 认证系统
- 公告管理
- 举报中心
- 日志中心
- 内容安全与敏感词
- 站点设置
- 后台全局搜索

### 站点设置

- 站点名称、描述、Logo、页脚导航
- 头部应用导航
- 注册开关、验证码、邮箱/手机号验证、邀请注册
- 积分、VIP、签到、补签、改昵称、邀请码购买价格
- 上传方式、本地存储、OSS、格式和大小限制
- 友情链接、兑换码、邀请码
- Markdown 表情扩展
- 首页统计卡片显示开关

### 内置应用中心

- 五子棋: 免费次数、门票积分、AI 难度、获胜奖励
- 阴阳契: 税率、彩头范围、每日发起/应战限制
- 自助广告位: 首页广告卡片、价格、插槽、广告订单审核

## 技术栈

- 前端: `Next.js 16`、`React 19`
- 样式: `Tailwind CSS`
- 数据库: `PostgreSQL`
- ORM: `Prisma`
- 鉴权: 数据库用户 + 服务端 Session Cookie
- 运行环境: `Node.js 20+`

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 创建环境变量

在项目根目录创建 `.env`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/bbs?schema=public"
SESSION_SECRET="replace_this_with_a_long_random_secret"
CAPTCHA_SECRET_KEY="replace_this_with_a_long_random_secret"

SEED_ADMIN_USERNAME="admin"
SEED_ADMIN_PASSWORD="ChangeMe_123456"
SEED_ADMIN_EMAIL="admin@rhex.im"
SEED_ADMIN_NICKNAME="秦始皇"

```

### 3. 初始化数据库和基础数据

```bash
npm run setup:dev
```

该命令会自动完成:

- 校验必要环境变量
- 生成 Prisma Client
- 同步数据库结构
- 检测数据库状态
- 在需要时自动写入基础数据

### 4. 启动开发环境

```bash
npm run dev
```

默认访问:

- 前台: `http://localhost:3000`
- 后台: `http://localhost:3000/admin`

## 生产环境启动

```bash
npm run build
npm run start
```

也可以直接使用内置命令:

```bash
npm run start:prod
```

如果你希望初始化后直接启动生产环境:

```bash
npm run setup:start:prod
```

## 初始化数据说明

首次初始化会默认写入:

- 站点基础配置
- 默认分区和节点
- 管理员账号
- 等级体系
- 默认勋章规则

默认管理员信息:

- 用户名: `admin`
- 密码: `ChangeMe_123456`

强烈建议首次部署后立即修改默认管理员密码。

### 邮件相关

- 可在后台开启 SMTP，也可通过环境与后台设置结合使用


## 常用脚本

- `npm run dev`: 启动开发环境
- `npm run build`: 构建生产包
- `npm run start`: 启动生产服务
- `npm run start:prod`: 构建并启动生产服务
- `npm run setup:dev`: 开发环境初始化
- `npm run setup:prod`: 生产环境初始化
- `npm run setup:start`: 初始化后启动开发服务
- `npm run setup:start:prod`: 初始化后启动生产服务
- `npm run prisma:generate`: 生成 Prisma Client
- `npm run prisma:push`: 同步数据库结构
- `npm run prisma:seed`: 执行种子脚本
- `npm run lint`: 运行 ESLint

## 项目结构

```text
src/
  app/          页面、路由、API Route
  components/   组件与交互层
  db/           数据访问层
  hooks/        复用 Hook
  lib/          业务逻辑与领域服务
  types/        类型声明
prisma/         数据模型与种子数据
scripts/        初始化与构建辅助脚本
plugins/        插件与扩展能力
```


## 部署建议

首次部署完成后，建议优先处理以下事项:

- 修改默认管理员用户名和密码
- 配置站点名称、描述、Logo 和 SEO
- 检查注册、验证码、邮件和邀请策略
- 检查上传策略、本地存储或 OSS 配置
- 配置 HTTPS、反向代理、备份和监控
- 根据业务实际情况补充分区、节点和权限策略


## License

本项目采用 **MIT License**。
