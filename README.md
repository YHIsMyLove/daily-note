# Daily Note - 零碎笔记自动整理系统

<div align="center">

**基于 Claude API 的智能笔记整理应用**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131)](https://tauri.app/)

</div>

## 项目简介

Daily Note 是一个零碎笔记自动整理系统，通过 Claude API 实现智能分类、标签生成和笔记关联分析。

### 核心功能

- ✅ **快速输入** - 随时随地记录零碎想法
- ✅ **智能分类** - Claude API 自动识别笔记类型
- ✅ **标签生成** - 自动提取关键词标签
- ✅ **笔记关联** - 智能发现相关笔记
- ✅ **全文搜索** - 快速检索历史笔记
- ✅ **红黑主题** - 美观的深色主题界面

### 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Tauri 桌面应用                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │            Next.js 14 + Tailwind CSS                │    │
│  │  - 快速输入界面                                       │    │
│  │  - 笔记列表展示                                       │    │
│  │  - 分类筛选                                           │    │
│  └─────────────────────────────────────────────────────┘    │
│                              │ REST API                      │
└──────────────────────────────┼───────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Fastify 后端服务                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐ │
│  │  API 层  │  │ 服务层   │  │      LLM 整理层           │ │
│  │          │  │          │  │                          │ │
│  │ - CRUD   │  │ - 笔记   │  │ - Claude API            │ │
│  │ - 检索   │  │   管理   │  │ - 自动分类              │ │
│  │ - 关联   │  │          │  │ - 关联分析              │ │
│  └──────────┘  └──────────┘  └──────────────────────────┘ │
└──────────────────────────────┬───────────────────────────────┘
                               │
        ┌──────────────────────┼────────────────┐
        ▼                      ▼                ▼
┌──────────────┐      ┌──────────────┐  ┌──────────────┐
│   SQLite     │      │  Claude API  │  │   本地文件   │
│   数据库      │      │              │  │              │
│ - 笔记块      │      │ - 分类       │  │ - 笔记内容   │
│ - 标签        │      │ - 标签       │  │ - 元数据     │
│ - 关联关系    │      │ - 关联       │  │              │
└──────────────┘      └──────────────┘  └──────────────┘
```

## 快速开始

### 前置要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Rust (用于 Tauri)

### 安装

```bash
# 克隆仓库
git clone https://github.com/your-username/daily-note.git
cd daily-note

# 安装依赖
pnpm install
```

### 配置

```bash
# 复制环境变量模板
cp backend/.env.example backend/.env

# 编辑 backend/.env，填入 Claude API Key
# ANTHROPIC_API_KEY="your-claude-api-key-here"
```

### 初始化数据库

```bash
pnpm --filter backend db:push
```

### 开发模式

```bash
# 启动 Tauri 桌面应用
pnpm tauri dev

# 或者分别启动前后端
pnpm dev:backend  # 终端 1
pnpm dev:frontend # 终端 2
```

### 构建

```bash
pnpm tauri build
```

## 项目结构

```
daily-note/
├── frontend/              # Next.js 前端
│   ├── src/
│   │   ├── app/         # App Router 页面
│   │   ├── components/  # UI 组件
│   │   └── lib/         # API 客户端
│   └── package.json
├── backend/              # Fastify 后端
│   ├── src/
│   │   ├── api/         # API 路由
│   │   ├── services/    # 业务逻辑
│   │   ├── llm/         # Claude API 集成
│   │   └── database/    # Prisma 客户端
│   ├── prisma/
│   └── package.json
├── src-tauri/           # Tauri 配置
├── shared/              # 共享类型
└── docs/                # 文档
```

## API 文档

详细 API 文档请查看 [docs/api.md](docs/api.md)

### 核心接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/notes` | 创建笔记 |
| GET | `/api/notes` | 获取笔记列表 |
| GET | `/api/notes/search` | 搜索笔记 |
| GET | `/api/categories` | 获取分类 |
| GET | `/api/tags` | 获取标签 |

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

---

**Note**: 需要有效的 Claude API Key 才能使用智能分类功能。
