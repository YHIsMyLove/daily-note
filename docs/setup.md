# Daily Note - 零碎笔记自动整理系统

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Rust (用于 Tauri)

### 安装依赖

```bash
# 安装 pnpm（如果还没有）
npm install -g pnpm

# 安装项目依赖
pnpm install
```

### 配置环境变量

1. 复制 `.env.example` 到 `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

2. 编辑 `backend/.env`，填入你的 Claude API Key:

```env
ANTHROPIC_API_KEY="your-claude-api-key-here"
```

### 初始化数据库

```bash
# 生成 Prisma Client
pnpm --filter backend db:generate

# 推送数据库 schema
pnpm --filter backend db:push

# 或者运行迁移
pnpm --filter backend db:migrate
```

### 开发模式

#### 模式 1: 分别启动前后端（推荐用于开发）

```bash
# 终端 1 - 启动后端
pnpm dev:backend

# 终端 2 - 启动前端
pnpm dev:frontend
```

后端运行在 `http://localhost:3001`
前端运行在 `http://localhost:3000`

#### 模式 2: Tauri 桌面应用

```bash
pnpm tauri dev
```

这将:
1. 启动后端服务 (Sidecar 模式)
2. 启动前端开发服务器
3. 打开 Tauri 桌面应用窗口

## 项目结构

```
daily-note/
├── frontend/              # Next.js 前端
│   ├── src/
│   │   ├── app/         # App Router 页面
│   │   ├── components/  # React 组件
│   │   └── lib/         # API 客户端和工具函数
│   └── package.json
├── backend/              # Fastify 后端
│   ├── src/
│   │   ├── api/         # API 路由
│   │   ├── services/    # 业务逻辑
│   │   ├── llm/         # Claude API 集成
│   │   └── database/    # Prisma 客户端
│   ├── prisma/          # 数据库 schema
│   └── package.json
├── src-tauri/           # Tauri 配置
├── shared/              # 共享类型定义
└── docs/                # 文档
```

## API 文档

### 笔记 API

- `POST /api/notes` - 创建笔记
- `GET /api/notes` - 获取笔记列表
- `GET /api/notes/:id` - 获取单条笔记
- `PUT /api/notes/:id` - 更新笔记
- `DELETE /api/notes/:id` - 删除笔记
- `GET /api/notes/search?q=query` - 搜索笔记
- `GET /api/notes/:id/related` - 获取关联笔记
- `POST /api/notes/:id/analyze` - 手动触发分析

### 分类和标签 API

- `GET /api/categories` - 获取所有分类
- `GET /api/categories/:category/notes` - 获取指定分类的笔记
- `GET /api/tags` - 获取所有标签

### 统计 API

- `GET /api/stats/summary` - 获取统计数据

API 文档（Swagger）: `http://localhost:3001/docs`

## 构建

### 构建桌面应用

```bash
pnpm tauri build
```

构建产物在 `src-tauri/target/release/bundle/`

## 常见问题

### 1. Claude API 调用失败

确保 `backend/.env` 中配置了正确的 `ANTHROPIC_API_KEY`。

### 2. 数据库连接错误

运行 `pnpm --filter backend db:push` 重新初始化数据库。

### 3. 前端无法连接后端

确保后端服务运行在 `http://localhost:3001`。

## 技术栈

- **前端**: Next.js 14, React, Tailwind CSS, shadcn/ui
- **后端**: Fastify, Prisma, SQLite
- **AI**: Claude API (Anthropic)
- **桌面**: Tauri 2.0
- **语言**: TypeScript
