# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**Daily Note** 是一个零碎笔记自动整理系统，使用 Tauri 桌面应用框架构建，集成了 Claude AI 进行智能笔记分析、分类、总结和任务提取。

## 技术栈

### 后端 (backend/)
- **Fastify 4.26** - Node.js Web 框架
- **Prisma 5.22** - SQLite 数据库 ORM
- **@anthropic-ai/sdk 0.72** - Claude AI API 集成
- **TypeScript 5.7**

### 前端 (frontend/)
- **Next.js 14.1** - React 框架 (App Router)
- **React 18** - UI 库
- **Tailwind CSS 3.4** - 样式框架
- **Radix UI** - 无样式组件库 (dialog, dropdown-menu, tabs, tooltip 等)
- **@tanstack/react-query 5.28** - 数据获取和状态管理
- **vis-network 9.1** - 知识图谱可视化
- **Recharts 2.15** - 图表组件

### 桌面应用 (src-tauri/)
- **Tauri 2.0** - Rust 桌面应用框架
- **Rust 2021 Edition**

### 共享类型 (shared/)
- TypeScript 类型定义，前后端共用

## 常用命令

### 开发
```bash
# 启动全部服务 (后端 + 前端)
pnpm dev

# 仅启动后端 (端口 3001)
pnpm dev:backend

# 仅启动前端 (端口 3000)
pnpm dev:frontend

# Tauri 桌面应用开发模式
pnpm tauri:dev
```

### 构建
```bash
# 构建全部
pnpm build

# 构建后端为可执行文件
pnpm build:backend

# 构建前端生产版本
pnpm build:frontend

# 构建 Tauri 桌面应用
pnpm tauri:build
```

### 数据库
```bash
# 运行数据库迁移
pnpm db:migrate

# 推送 schema 变更
pnpm db:push

# 生成 Prisma Client
pnpm db:generate

# 打开 Prisma Studio (数据库管理界面)
pnpm db:studio
```

## 架构概览

### 后端架构
- **index.ts** - Fastify 应用入口，注册路由、CORS、Swagger
- **start.ts** - 环境变量加载入口
- **api/routes/** - RESTful API 路由
- **services/** - 业务逻辑层
- **llm/** - Claude API 服务
- **queue/** - 任务队列管理器
- **database/prisma** - 数据库客户端

### 前端架构
- **app/page.tsx** - 主页面，三栏布局 (侧边栏 + 主内容 + 右侧面板)
- **components/** - React 组件
  - **ui/** - Radix UI 封装组件
  - **graph/** - 知识图谱可视化
  - **prompts/** - 提示词模板管理
- **lib/api** - API 客户端
- **hooks/** - 自定义 React Hooks (useSSE 实时同步)

### 数据模型 (Prisma Schema)
- **Note** - 笔记块 (支持软删除、分类、标签、情感、重要性)
- **Category** - 分类 (支持颜色)
- **Tag** - 标签 (支持颜色)
- **NoteTag** - 笔记-标签多对多关联
- **NoteRelation** - 笔记关联 (图谱边)
- **ClaudeTask** - AI 任务队列 (支持嵌套 Todo、自动完成)
- **PromptTemplate** - 提示词模板
- **Summary** - 总结记录 (持久化)

### 任务队列系统
后端使用内存队列管理 AI 任务：
- **classify_note** - 笔记分类
- **summary_analyzer** - 总结分析
- **extract_todo_tasks** - 任务提取
- **auto_complete_todo** - Todo 自动完成

### SSE 实时同步
前端通过 `/api/sse` 端点监听任务状态变化，任务完成时自动刷新数据。

## 环境变量

后端需要以下环境变量 (在 backend/.env 配置):
- **DATABASE_URL** - SQLite 数据库路径 (如 `file:../dev.db`)
- **ANTHROPIC_API_KEY** - Claude API 密钥
- **PORT** - 后端端口 (默认 3001)
- **CORS_ORIGIN** - 允许的前端域名

## 重要约定

1. **依赖管理**: 使用 pnpm workspace，monorepo 结构包含 frontend/backend/shared 三个包
2. **类型共享**: shared/types/index.ts 定义的前后端共用类型，通过 `@daily-note/shared` 引用
3. **前端导入**: 尽量使用具名导入 `import { xxx } from xxx` 而不是 `import * as XXX from xxx`
4. **Windows 环境**: 项目在 Windows 环境下开发运行
5. **文档放置**: 新增文档统一放到 docs 文件夹中
