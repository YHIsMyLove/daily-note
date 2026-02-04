# Daily Note 后端 AI 分析功能完整文档

> 本文档详细描述了 Daily Note 项目后端 AI 分析功能的架构、实现和使用方法。

## 目录

- [一、架构概览](#一架构概览)
- [二、LLM 服务层](#二llm-服务层)
- [三、提示词服务](#三提示词服务)
- [四、任务队列系统](#四任务队列系统)
- [五、任务执行器](#五任务执行器)
- [六、数据模型](#六数据模型)
- [七、API 端点](#七api-端点)
- [八、配置管理](#八配置管理)
- [九、错误处理](#九错误处理)
- [十、扩展指南](#十扩展指南)

---

## 一、架构概览

### 1.1 目录结构

```
backend/src/
├── llm/                           # LLM 服务层
│   ├── claude.service.ts         # Claude API 核心服务
│   └── prompts.ts                # 提示词常量定义
├── services/                      # 业务逻辑层
│   ├── prompt.service.ts         # 提示词模板管理
│   ├── note.service.ts           # 笔记服务（含 AI 调用）
│   └── summary.service.ts        # 总结服务
├── queue/                         # 任务队列管理
│   ├── queue-manager.ts          # 队列管理器
│   └── executors/                # 任务执行器
│       ├── note-classifier.executor.ts      # 笔记分类
│       ├── task-extraction.executor.ts      # 任务提取
│       ├── summary-analyzer.executor.ts     # 总结分析
│       ├── auto-complete.executor.ts        # 自动完成
│       └── relation-analyzer.executor.ts    # 关联分析
├── utils/                         # 工具函数
│   ├── errors.ts                 # 错误分类和处理
│   └── retry.ts                  # 重试机制
├── config/                        # 配置
│   └── claude-config.ts          # Claude API 配置
└── database/
    └── prisma/
        └── schema.prisma         # 数据库模型
```

### 1.2 核心组件关系图

```
                    ┌─────────────────────┐
                    │   ClaudeService     │
                    │   (LLM 核心服务)     │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   PromptService     │
                    │   (提示词模板管理)   │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
┌───────▼────────┐    ┌────────▼────────┐    ┌───────▼────────┐
│ QueueManager   │    │  Task Executors │    │  NoteService   │
│ (队列管理器)    │    │  (任务执行器)     │    │  (笔记服务)     │
└────────────────┘    └─────────────────┘    └────────────────┘
```

### 1.3 AI 分析流程图

```
用户创建笔记
     │
     ▼
NoteService.createNote()
     │
     ├──► 创建 Note 记录
     │
     ├──► queueManager.enqueue('classify_note')    ◄────┐
     │                                                  │
     ├──► queueManager.enqueue('extract_todo_tasks')    │
     │                                                  │
     └──► queueManager.enqueue('analyze_relations')     │
                                                        │
                        ┌───────────────────────────────┘
                        │
                        ▼
              QueueManager.processQueue()
                        │
                        ▼
              ┌─────────┴─────────┐
              │                   │
              ▼                   ▼
    executeNoteClassification  executeTaskExtraction
              │                   │
              ├──► Claude API    ├──► Claude API
              │                   │
              ├──► 更新 Note      ├──► 创建/更新 Todo
              │                   │
              └──► SSE 推送        └──► SSE 推送
```

---

## 二、LLM 服务层

### 2.1 ClaudeService 类

**文件路径**: `backend/src/llm/claude.service.ts`

#### 核心属性

```typescript
export class ClaudeService {
  private client: Anthropic              // Anthropic SDK 客户端
  private readonly maxAttempts: number   // 最大重试次数（默认 3）
  private readonly initialDelay: number  // 初始重试延迟（默认 1000ms）
  private readonly timeout: number       // API 超时时间（默认 60000ms）
  private requestIdCounter: number = 0   // 请求 ID 计数器
}
```

#### API 方法列表

| 方法名 | 功能 | 返回类型 |
|--------|------|----------|
| `classifyNote()` | 笔记分类分析 | `Promise<ClassificationResult>` |
| `analyzeTrends()` | 趋势分析 | `Promise<TrendsAnalysisResult>` |
| `generateDailySummary()` | 生成每日总结 | `Promise<DailySummaryResult>` |
| `generateSummaryAnalysis()` | 生成总结分析 | `Promise<SummaryAnalysisResult>` |
| `generateHierarchicalSummary()` | 分层总结 | `Promise<SummaryAnalysisResult>` |
| `analyzeAutoCompletion()` | 自动完成分析 | `Promise<AutoCompletionAnalysisResult>` |
| `extractTasks()` | 任务提取 | `Promise<TaskExtractionResult>` |
| `analyzeRelations()` | 关联分析 | `Promise<RelationAnalysisOutput>` |

### 2.2 classifyNote() - 笔记分类

**函数签名**:
```typescript
async classifyNote(
  content: string,
  options: {
    existingCategories?: Array<{ name: string; count: number }>
    existingTags?: Array<{ name: string; count: number }>
  } = {}
): Promise<ClassificationResult>
```

**执行流程**:
```
1. 格式化分类/标签列表（按使用频率排序）
2. 从 PromptService 获取提示词模板
3. 调用 Claude API（使用 retryWithBackoff）
4. 提取 JSON 响应
5. 验证返回结果
6. 失败时返回默认分类
```

**返回值结构**:
```typescript
interface ClassificationResult {
  category: string                  // 分类名称
  tags: string[]                    // 标签数组
  summary: string                   // 一句话摘要
  sentiment: 'positive' | 'neutral' | 'negative'  // 情感分析
  importance: number                // 重要性评分 (1-10)
  isFallback?: boolean              // 是否为降级结果
}
```

### 2.3 extractTasks() - 任务提取

**函数签名**:
```typescript
async extractTasks(
  content: string,
  existingTasks: ExistingTask[] = []
): Promise<TaskExtractionResult>
```

**支持的操作类型**:
```typescript
type TaskOperationAction =
  | CreateOperation      // 创建新任务
  | UpdateOperation      // 更新已有任务
  | DeleteOperation      // 删除任务
  | SkipOperation        // 跳过（保持不变）
```

**关键特性**:
- 支持智能去重（基于语义相似性）
- 支持复杂任务拆分（最多 2 级子任务）
- 自动识别任务状态（已完成/待办）

### 2.4 analyzeRelations() - 关联分析

**函数签名**:
```typescript
async analyzeRelations(input: {
  currentNote: {
    id: string
    title: string
    content: string
    category?: string
    tags: string[]
  }
  candidateNotes: Array<{
    id: string
    content: string
    summary?: string
    category?: string
    tags: string[]
    date: Date
  }>
}): Promise<RelationAnalysisOutput>
```

**相似度评分标准**:
| 相似度范围 | 关联强度 | 说明 |
|-----------|---------|------|
| 0.8-1.0 | 强关联 | 相同主题、延续性、因果关系 |
| 0.5-0.7 | 中等关联 | 相关领域、引用关系 |
| 0.2-0.4 | 弱关联 | 间接相关 |
| 0.0-0.1 | 无关联 | 不相关 |

### 2.5 降级处理

**默认分类策略**:
```typescript
private getDefaultClassification(content: string): ClassificationResult {
  const lowerContent = content.toLowerCase()
  let category = '其他'

  if (lowerContent.includes('完成') || lowerContent.includes('任务')) {
    category = '待办事项'
  } else if (lowerContent.includes('学习') || lowerContent.includes('阅读')) {
    category = '学习笔记'
  }

  return {
    category,
    tags: [category, '默认'],
    summary: content.slice(0, 50) + '...',
    sentiment: 'neutral',
    importance: 5,
    isFallback: true,
  }
}
```

---

## 三、提示词服务

### 3.1 PromptService 类

**文件路径**: `backend/src/services/prompt.service.ts`

#### 核心方法

| 方法名 | 功能 |
|--------|------|
| `initializeDefaults()` | 初始化默认提示词模板到数据库 |
| `getPrompt(key, variables)` | 获取提示词并替换变量 |
| `getTemplate(key)` | 获取原始模板对象 |
| `listTemplates()` | 列出所有提示词模板 |
| `createTemplate(data)` | 创建新提示词模板 |
| `updateTemplate(key, userPart)` | 更新提示词（仅用户可编辑部分） |
| `deleteTemplate(key)` | 删除提示词 |
| `resetToDefault(key)` | 恢复默认提示词 |
| `previewTemplate(key, sampleData)` | 预览提示词（使用示例数据） |

### 3.2 提示词模板结构

**数据库模型** (`PromptTemplate`):
```typescript
{
  id: string                    // UUID
  key: string                   // 唯一标识符（如 'classify_note'）
  name: string                  // 显示名称
  description?: string          // 描述
  systemPart: string            // 系统提示（限定区，不可修改）
  userPart: string              // 用户提示（可编辑）
  variables: string             // JSON 序列化的变量定义
  isActive: boolean             // 是否启用
  isDefault: boolean            // 是否为默认模板
  createdAt: DateTime
  updatedAt: DateTime
}
```

### 3.3 变量替换机制

```typescript
private replaceVariables(
  template: string,
  variables: Record<string, any>
): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`
    result = result.replaceAll(placeholder, String(value ?? ''))
  }
  return result
}
```

### 3.4 默认提示词模板列表

| Key | 名称 | 用途 |
|-----|------|------|
| `classify_note` | 笔记分类 | 自动分类、标签生成、摘要、情感分析 |
| `analyze_trends` | 趋势分析 | 分析笔记趋势和模式 |
| `generate_daily_summary` | 每日总结 | 生成每日笔记总结 |
| `summary_analysis` | 总结分析 | 分析笔记并生成综合总结 |
| `hierarchical_summary` | 分层总结 | 基于子总结生成高级别总结 |
| `extract_tasks` | 任务提取 | 从笔记中提取可执行任务 |
| `auto_completion_analysis` | 自动补全分析 | 分析任务是否可自动完成 |
| `analyze_relations` | 关联分析 | 分析笔记之间的关联性 |

---

## 四、任务队列系统

### 4.1 QueueManager 类

**文件路径**: `backend/src/queue/queue-manager.ts`

#### 核心属性

```typescript
class QueueManager {
  private maxConcurrency: number           // 最大并发数（默认 3）
  private processingCount: number          // 当前处理数
  private executors: Map<string, Executor> // 执行器注册表
  private sseEmitter: any                  // SSE 推送器
}
```

#### 核心功能

| 功能 | 描述 |
|------|------|
| 事件驱动模式 | 入队后立即执行，任务完成后检查剩余任务 |
| 并发控制 | 信号量模式，默认最大并发数 3 |
| 优先级队列 | 按优先级（降序）和创建时间（升序）排序 |
| 自动重试 | 指数退避，最大重试次数可配置 |
| SSE 实时推送 | 任务状态变化实时通知前端 |
| 任务恢复 | 服务重启时将 RUNNING 任务标记为 FAILED |

### 4.2 任务执行流程

```
┌──────────────┐
│  enqueue()   │ 入队
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ processQueue │ 处理队列（事件驱动）
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ executeTask  │ 执行任务
└──────┬───────┘
       │
       ├──► PENDING → RUNNING → COMPLETED
       │                         │
       │                         └──► SSE: task.completed
       │
       └──► PENDING → RUNNING → FAILED (可重试)
                                 │
                                 ├──► 计算重试延迟
                                 ├──► 更新 nextRetryAt
                                 └──► SSE: task.retry
                                        │
                                        └──► 等待下次 checkRetryTasks()
```

### 4.3 重试机制

**环境变量配置**:
```bash
MAX_CLAUDE_CONCURRENCY=3              # 最大并发数
CLAUDE_MAX_RETRY_ATTEMPTS=3           # 最大重试次数
CLAUDE_RETRY_INITIAL_DELAY=1000       # 初始延迟（毫秒）
```

**重试延迟计算**:
```typescript
// 指数退避：delay = initialDelay * (2 ^ retryCount)
const baseDelay = retryInitialDelay * Math.pow(2, retryCount)
const delay = Math.min(baseDelay, 10000)  // 最大 10 秒
const nextRetryAt = new Date(Date.now() + delay)
```

### 4.4 已注册的任务类型

```typescript
// 在 backend/src/index.ts 中注册
queueManager.registerExecutor('classify_note', {
  type: 'classify_note',
  execute: executeNoteClassification,
})

queueManager.registerExecutor('extract_todo_tasks', {
  type: 'extract_todo_tasks',
  execute: executeTaskExtraction,
})

queueManager.registerExecutor('analyze_relations', {
  type: 'analyze_relations',
  execute: executeRelationAnalysis,
})

queueManager.registerExecutor('auto_complete_todo', {
  type: 'auto_complete_todo',
  execute: executeAutoCompletion,
})

queueManager.registerExecutor('summary_analyzer', {
  type: 'summary_analyzer',
  execute: executeSummaryAnalysis,
})
```

---

## 五、任务执行器

### 5.1 笔记分类执行器

**文件路径**: `backend/src/queue/executors/note-classifier.executor.ts`

**函数签名**:
```typescript
export async function executeNoteClassification(
  taskId: string,
  payload: { noteId: string; content: string }
)
```

**执行流程**:
```
1. 获取现有分类（按使用频率排序）
2. 获取现有标签（按使用频率排序）
3. 调用 Claude API 分类
4. 查找或创建分类
5. 更新笔记（分类、摘要、情感、重要性）
6. 处理标签（创建笔记-标签关联）
```

### 5.2 任务提取执行器

**文件路径**: `backend/src/queue/executors/task-extraction.executor.ts`

**函数签名**:
```typescript
export async function executeTaskExtraction(
  taskId: string,
  payload: TaskExtractionPayload
): Promise<TaskExtractionExecutorResult>
```

**操作处理**:
```typescript
switch (operation.action) {
  case 'create':  // 创建新任务 + 子任务
  case 'update':  // 更新已有任务状态
  case 'delete':  // 删除任务
  case 'skip':    // 保持不变
}
```

**子任务支持**:
- 最多支持 3 级嵌套（level 0, 1, 2）
- 子任务继承父任务的 noteId 关联

### 5.3 关联分析执行器

**文件路径**: `backend/src/queue/executors/relation-analyzer.executor.ts`

**候选笔记筛选策略**:
```typescript
// 筛选条件：同分类 OR 同标签，最近 3 个月，最多 20 条
const where: any = {
  id: { not: currentNoteId },
  deletedAt: null,
  OR: [
    { categoryId },
    { noteTags: { some: { tagId: { in: tagIds } } } }
  ],
  date: { gte: threeMonthsAgo }
}
```

**执行流程**:
```
1. 获取当前笔记信息
2. 筛选候选笔记（同分类/同标签，最近 3 个月）
3. 调用 Claude API 分析关联性
4. 创建或更新 NoteRelation 记录（similarity >= 0.2）
5. SSE 推送关联更新事件
```

### 5.4 自动完成执行器

**文件路径**: `backend/src/queue/executors/auto-complete.executor.ts`

**置信度阈值**: 70%

**执行逻辑**:
```typescript
if (canAutoComplete && confidence >= 70) {
  // 自动完成任务
  await todoService.completeTodo(todoId)
  status = 'COMPLETED'
} else {
  // 标记为失败
  status = 'FAILED'
  error = confidence < 70 ? '置信度不足' : '不适合自动完成'
}
```

### 5.5 总结分析执行器

**文件路径**: `backend/src/queue/executors/summary-analyzer.executor.ts`

**执行流程**:
```
1. 更新任务状态为 RUNNING
2. 调用 summaryService.createAnalysis()
3. 持久化总结到 Summary 表
4. 保存总结为笔记
5. 更新任务状态为 COMPLETED
6. SSE 推送完成事件
```

---

## 六、数据模型

### 6.1 Note (笔记块)

```prisma
model Note {
  id                String   @id @default(uuid())
  content           String
  date              DateTime @default(now())
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  deletedAt         DateTime?  // 软删除时间戳

  // LLM 处理结果
  categoryId        String?
  category          Category? @relation(fields: [categoryId], references: [id])
  summary           String?
  sentiment         String?   // 'positive' | 'neutral' | 'negative'
  importance        Int       @default(5)
  metadata          String?   // JSON string

  // 每日待办笔记相关
  isDailyTodoNote   Boolean   @default(false)
  dailyTodoDate     DateTime?

  // 关联关系
  relations         NoteRelation[] @relation("FromNote")
  relatedFrom       NoteRelation[] @relation("ToNote")
  noteTags          NoteTag[]
  claudeTasks       ClaudeTask[]

  @@index([date])
  @@index([categoryId])
  @@index([deletedAt])
  @@index([isDailyTodoNote, dailyTodoDate])
}
```

### 6.2 ClaudeTask (AI 任务队列)

```prisma
model ClaudeTask {
  id                    String   @id @default(uuid())
  type                  String   // 任务类型
  noteId                String?
  payload               String   // JSON格式任务数据
  status                String   @default("PENDING")
  priority              Int      @default(0)
  error                 String?
  result                String?  // JSON格式结果
  startedAt             DateTime?
  completedAt           DateTime?
  retryCount            Int      @default(0)
  lastRetryAt           DateTime?
  nextRetryAt           DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  note                  Note?    @relation(fields: [noteId], references: [id])

  // Todo 特定字段
  title                 String?
  description           String?
  dueDate               DateTime?
  todoCompletedAt       DateTime?
  isAiGenerated         Boolean  @default(false)
  autoCompletionEnabled Boolean  @default(false)
  autoCompletionTaskId  String?
  autoCompletionError   String?
  todoMetadata          String?

  // 嵌套结构支持
  parentId              String?
  level                 Int      @default(0)
  parent                ClaudeTask? @relation("TodoHierarchy", fields: [parentId], references: [id])
  children              ClaudeTask[] @relation("TodoHierarchy")

  @@index([status])
  @@index([noteId])
  @@index([type])
  @@index([isAiGenerated])
  @@index([autoCompletionEnabled])
  @@index([dueDate])
  @@index([parentId])
  @@index([level])
}
```

**任务类型 (type)**:
- `classify_note` - 笔记分类
- `analyze_relations` - 关联分析
- `summary_analyzer` - 总结分析
- `extract_todo_tasks` - 任务提取
- `auto_complete_todo` - Todo 自动完成

**任务状态 (status)**:
- `PENDING` - 待处理
- `NEEDS_REVIEW` - 需要审核 (Todo 专用)
- `RUNNING` - 执行中
- `COMPLETED` - 已完成
- `FAILED` - 失败
- `CANCELLED` - 已取消

### 6.3 NoteRelation (笔记关联)

```prisma
model NoteRelation {
  id         String   @id @default(uuid())
  fromId     String
  toId       String
  similarity Float?
  reason     String?
  createdAt  DateTime @default(now())

  from       Note     @relation("FromNote", fields: [fromId], references: [id])
  to         Note     @relation("ToNote", fields: [toId], references: [id])

  @@unique([fromId, toId])
  @@index([fromId])
  @@index([toId])
}
```

### 6.4 Summary (总结记录)

```prisma
model Summary {
  id              String   @id @default(uuid())
  mode            String   // 'day' | 'week' | 'month' | 'year' | 'custom'
  periodKey       String   // 周期唯一标识
  startDate       DateTime
  endDate         DateTime

  // 总结内容
  overview        String
  achievements    String   // JSON数组
  pendingTasks    String   // JSON数组
  insights        String   // JSON数组

  // 知识提炼
  keyLearnings    String?
  trends          String?
  patterns        String?
  recommendations String?

  // 统计数据
  noteCount       Int
  sentimentData   String   // JSON
  categoryStats   String   // JSON
  tagStats        String   // JSON
  importanceStats String   // JSON
  taskStats       String   // JSON
  timeStats       String   // JSON
  todoStats       String   @default("{}")

  generatedAt     DateTime @default(now())
  updatedAt       DateTime @updatedAt
  taskId          String?
  isAutoGenerated Boolean  @default(true)

  @@unique([mode, periodKey])
  @@index([startDate])
  @@index([generatedAt])
}
```

### 6.5 PromptTemplate (提示词模板)

```prisma
model PromptTemplate {
  id          String   @id @default(uuid())
  key         String   @unique
  name        String
  description String?
  systemPart  String   // 限定区(不可修改)
  userPart    String   // 提示词区(用户可修改)
  variables   String   // JSON数组
  isActive    Boolean  @default(true)
  isDefault   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([key])
  @@index([isActive])
}
```

---

## 七、API 端点

### 7.1 笔记 API (`/api/notes`)

| 方法 | 端点 | 功能 | 请求体 |
|------|------|------|--------|
| POST | `/api/notes` | 创建笔记 | `CreateNoteRequest` |
| GET | `/api/notes` | 获取笔记列表 | 查询参数: date, dateRange, category, tags, keyword, page, pageSize |
| GET | `/api/notes/:id` | 获取单条笔记 | - |
| PUT | `/api/notes/:id` | 更新笔记 | `UpdateNoteRequest` |
| DELETE | `/api/notes/:id` | 软删除笔记 | - |
| PATCH | `/api/notes/:id/trash` | 软删除到回收站 | - |
| PATCH | `/api/notes/:id/restore` | 从回收站恢复 | - |
| DELETE | `/api/notes/:id/permanent` | 永久删除 | - |
| GET | `/api/notes/trash` | 获取回收站列表 | - |
| GET | `/api/notes/search` | 搜索笔记 | query: `q` |
| GET | `/api/notes/:id/related` | 获取关联笔记 | - |
| POST | `/api/notes/:id/analyze` | 手动触发AI分析 | - |
| POST | `/api/notes/:id/analyze-relations` | 手动触发关联分析 | - |
| GET | `/api/notes/daily-todo/:date?` | 获取或创建指定日期的待办笔记 | - |

### 7.2 任务队列 API (`/api/tasks`)

| 方法 | 端点 | 功能 | 查询参数 |
|------|------|------|----------|
| GET | `/api/tasks` | 获取任务列表 | status, noteId |
| GET | `/api/tasks/:id` | 获取单个任务 | - |
| DELETE | `/api/tasks/:id` | 取消任务 | - |
| GET | `/api/tasks/stats` | 获取队列统计 | - |

**统计响应格式**:
```typescript
{
  success: boolean
  data?: {
    pending: number
    running: number
    completed: number
    failed: number
    maxConcurrency: number
  }
}
```

### 7.3 总结分析 API (`/api/summaries`)

| 方法 | 端点 | 功能 | 请求体/参数 |
|------|------|------|-------------|
| POST | `/api/summaries` | 创建分析任务 | `SummaryAnalyzerPayload` |
| GET | `/api/summaries` | 获取分析任务列表 | status, mode, limit |
| GET | `/api/summaries/unsummarized` | 检测未总结的日期 | days (默认7) |
| GET | `/api/summaries/:id` | 获取单个分析任务 | - |
| DELETE | `/api/summaries/:id` | 取消/删除任务 | - |
| GET | `/api/summaries/stats` | 获取总结历史统计 | - |
| GET | `/api/summaries/history` | 获取总结历史列表 | mode, year, month, limit |
| GET | `/api/summaries/record/:id` | 获取总结详情(从Summary表) | - |
| DELETE | `/api/summaries/record/:id` | 删除总结记录 | - |
| GET | `/api/summaries/:id/compare` | 对比两个总结 | compareId |
| GET | `/api/summaries/timeline` | 获取时间线视图 | mode, groupBy, limit |

### 7.4 知识图谱 API (`/api/graph`)

| 方法 | 端点 | 功能 | 查询参数 |
|------|------|------|----------|
| GET | `/api/graph` | 获取图谱数据 | categories, tags, dateFrom, dateTo, minSimilarity, minImportance, limit, sentiment |

**图谱数据响应格式**:
```typescript
{
  success: boolean
  data?: {
    nodes: GraphNode[]
    edges: GraphEdge[]
    total: number
    stats?: {
      nodeCount: number
      edgeCount: number
      categoryDistribution: Category[]
    }
  }
}
```

### 7.5 提示词模板 API (`/api/prompts`)

| 方法 | 端点 | 功能 | 请求体/参数 |
|------|------|------|-------------|
| GET | `/api/prompts` | 获取提示词列表 | - |
| GET | `/api/prompts/:key` | 获取提示词详情 | - |
| POST | `/api/prompts` | 创建新提示词 | `UpsertPromptRequest` |
| PUT | `/api/prompts/:key` | 更新提示词 | `{ userPart: string }` |
| DELETE | `/api/prompts/:key` | 删除提示词 | - |
| POST | `/api/prompts/:key/reset` | 恢复默认提示词 | - |
| GET | `/api/prompts/:key/preview` | 预览提示词 | query: 变量值 |

### 7.6 SSE 实时推送 (`/api/sse`)

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/api/sse` | 建立SSE连接 |

**推送事件类型**:
- `task.created` - 任务创建
- `task.started` - 任务开始执行
- `task.completed` - 任务完成
- `task.failed` - 任务失败
- `task.retry` - 任务重试
- `task.cancelled` - 任务取消
- `task.duplicate` - 任务重复
- `stats.updated` - 统计更新
- `relations.updated` - 关联更新
- `todo.created/updated/deleted` - Todo 操作事件

---

## 八、配置管理

### 8.1 Claude API 配置

**文件路径**: `backend/src/config/claude-config.ts`

**配置优先级**:
```
1. Claude Code settings.json
   ~/.claude/settings.json → env.ANTHROPIC_AUTH_TOKEN

2. 环境变量
   ANTHROPIC_API_KEY
   ANTHROPIC_BASE_URL

3. 默认值
```

### 8.2 环境变量配置

在 `backend/.env` 中配置：

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| `DATABASE_URL` | SQLite 数据库路径 | `file:../dev.db` |
| `ANTHROPIC_API_KEY` | Claude API 密钥 | 必填 |
| `ANTHROPIC_BASE_URL` | 自定义 API 端点 | 官方端点 |
| `ANTHROPIC_API_TIMEOUT` | API 超时时间（毫秒） | 60000 |
| `PORT` | 后端端口 | 3001 |
| `CORS_ORIGIN` | 允许的前端域名 | `*` |
| `MAX_CLAUDE_CONCURRENCY` | 最大并发数 | 3 |
| `CLAUDE_MAX_RETRY_ATTEMPTS` | 最大重试次数 | 3 |
| `CLAUDE_RETRY_INITIAL_DELAY` | 初始重试延迟（毫秒） | 1000 |

---

## 九、错误处理

### 9.1 错误分类

**文件路径**: `backend/src/utils/errors.ts`

```typescript
enum ErrorType {
  AUTHENTICATION = 'authentication_error',    // 不可重试
  QUOTA_EXCEEDED = 'quota_exceeded',          // 不可重试
  RATE_LIMIT = 'rate_limit_error',            // 可重试
  NETWORK = 'network_error',                  // 可重试
  TIMEOUT = 'timeout_error',                  // 可重试
  SERVER = 'server_error',                    // 可重试 (5xx)
  CLIENT = 'client_error',                    // 不可重试 (4xx)
  PARSING = 'parsing_error',                  // 可重试
  UNKNOWN = 'unknown_error',                  // 可重试
}
```

### 9.2 重试策略

**文件路径**: `backend/src/utils/retry.ts`

**重试机制特性**:
- **指数退避**: `delay = initialDelay * (backoffMultiplier ^ attempt)`
- **最大延迟**: 10 秒
- **随机抖动**: ±25% 避免多个客户端同时重试
- **默认最大重试次数**: 3

**不可重试的错误**:
- 认证失败 (401)
- 配额超限 (429 with specific error type)
- 客户端错误 (400, 403, 404)

### 9.3 降级策略

当 Claude API 不可用时，系统会返回合理的默认值：

| 功能 | 降级策略 |
|------|----------|
| 笔记分类 | 基于关键词的简单分类 |
| 标签提取 | 使用分类名作为默认标签 |
| 摘要生成 | 截取前 50 个字符 |
| 情感分析 | 默认为 `neutral` |
| 重要性评分 | 默认为 5 |

---

## 十、扩展指南

### 10.1 添加新的 AI 分析功能

要添加新的 AI 分析功能，请按以下步骤操作：

#### 步骤 1: 在 ClaudeService 中添加方法

**文件**: `backend/src/llm/claude.service.ts`

```typescript
async newAnalysisFunction(
  input: YourInputType
): Promise<YourResultType> {
  const prompt = await promptService.getPrompt('your_prompt_key', {
    // 变量
  })

  const response = await this.client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  // 处理响应
  return result
}
```

#### 步骤 2: 创建执行器

**文件**: `backend/src/queue/executors/your-executor.executor.ts`

```typescript
export async function executeYourTask(
  taskId: string,
  payload: YourPayload
): Promise<YourResult> {
  // 1. 更新任务状态为 RUNNING
  await queueManager.updateTaskStatus(taskId, 'RUNNING')

  try {
    // 2. 调用 ClaudeService
    const result = await claudeService.newAnalysisFunction(payload)

    // 3. 处理结果
    // ...

    // 4. 更新任务状态为 COMPLETED
    await queueManager.updateTaskStatus(taskId, 'COMPLETED', { result })

    return result
  } catch (error) {
    // 5. 错误处理
    await queueManager.updateTaskStatus(taskId, 'FAILED', { error: error.message })
    throw error
  }
}
```

#### 步骤 3: 注册执行器

**文件**: `backend/src/index.ts`

```typescript
queueManager.registerExecutor('your_task_type', {
  type: 'your_task_type',
  execute: executeYourTask,
})
```

#### 步骤 4: 添加提示词模板

**文件**: `backend/src/services/prompt.service.ts`

```typescript
private readonly DEFAULT_TEMPLATES: PromptTemplateInput[] = [
  // ... 其他模板
  {
    key: 'your_prompt_key',
    name: '你的提示词名称',
    description: '描述',
    systemPart: '系统提示',
    userPart: '用户提示，使用 {variable} 占位符',
    variables: JSON.stringify([
      { name: 'variable', description: '变量描述', required: true }
    ])
  }
]
```

#### 步骤 5: 触发任务

```typescript
// 在需要的地方调用
await queueManager.enqueue(
  'your_task_type',
  payload,
  noteId,
  priority  // 优先级
)
```

### 10.2 最佳实践

1. **使用降级策略**: 当 API 调用失败时，返回合理的默认值而不是让整个流程失败

2. **合理设置优先级**:
   - 手动触发的任务: 优先级 10
   - 用户操作关联的任务: 优先级 5
   - 后台分析任务: 优先级 1-3

3. **处理大内容**: 对于超过 token 限制的内容，考虑分批处理或摘要后处理

4. **监控任务状态**: 使用 SSE 实时推送任务状态变化

5. **错误日志**: 记录详细的错误信息以便调试

---

## 附录

### A. 关键类型定义

```typescript
// 分类结果
interface ClassificationResult {
  category: string
  tags: string[]
  summary: string
  sentiment: 'positive' | 'neutral' | 'negative'
  importance: number
  isFallback?: boolean
}

// 任务提取结果
interface TaskExtractionResult {
  operations: TaskOperationAction[]
  isFallback?: boolean
}

// 关联分析结果
interface RelationAnalysisOutput {
  relations: Array<{
    noteId: string
    similarity: number
    reason: string
  }>
  isFallback?: boolean
}

// 总结分析结果
interface SummaryAnalysisResult {
  overview: string
  achievements: string[]
  pendingTasks: string[]
  insights: string[]
  keyLearnings?: string[]
  trends?: string[]
  patterns?: string[]
  recommendations?: string[]
}
```

### B. 相关文件清单

| 文件路径 | 功能描述 |
|---------|---------|
| `backend/src/llm/claude.service.ts` | Claude API 核心服务 |
| `backend/src/services/prompt.service.ts` | 提示词模板管理 |
| `backend/src/services/note.service.ts` | 笔记业务逻辑 |
| `backend/src/services/summary.service.ts` | 总结业务逻辑 |
| `backend/src/queue/queue-manager.ts` | 任务队列管理器 |
| `backend/src/queue/executors/note-classifier.executor.ts` | 笔记分类执行器 |
| `backend/src/queue/executors/task-extraction.executor.ts` | 任务提取执行器 |
| `backend/src/queue/executors/relation-analyzer.executor.ts` | 关联分析执行器 |
| `backend/src/queue/executors/summary-analyzer.executor.ts` | 总结分析执行器 |
| `backend/src/queue/executors/auto-complete.executor.ts` | 自动完成执行器 |
| `backend/src/utils/errors.ts` | 错误分类工具 |
| `backend/src/utils/retry.ts` | 重试机制工具 |
| `backend/src/config/claude-config.ts` | Claude API 配置 |
| `backend/prisma/schema.prisma` | 数据库模型定义 |
| `backend/src/api/routes/notes.ts` | 笔记 API 路由 |
| `backend/src/api/routes/tasks.ts` | 任务 API 路由 |
| `backend/src/api/routes/summaries.ts` | 总结 API 路由 |
| `backend/src/api/routes/prompts.ts` | 提示词 API 路由 |

---

**文档版本**: 1.0
**最后更新**: 2026-02-03
**维护者**: Daily Note 开发团队
