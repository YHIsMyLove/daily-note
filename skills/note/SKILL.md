---
name: note
description: 轻量级笔记 CLI - 通过 Daily Note 后端创建、获取、更新、删除和搜索笔记
parameters:
  apiBaseUrl:
    description: 后端 API 基础 URL
    default: http://localhost:3001
---

# Note Skill

轻量级笔记 CLI，提供 Daily Note 后端的 CRUD 操作接口。

## 配置

通过环境变量配置 API 地址：

- `NOTE_SKILL_API_URL`: 覆盖默认 API 地址（默认: `http://localhost:3001`）

## 可用命令

### 创建笔记

创建新笔记，支持可选的分类、标签和重要性等级。

**函数:** `createNote(request: CreateNoteRequest): Promise<NoteBlock>`

**参数:**
- `content` (string, 必填): 笔记内容
- `category` (string, 可选): 分类
- `tags` (string[], 可选): 标签数组
- `importance` (number, 可选): 重要性等级 1-10
- `date` (Date, 可选): 笔记日期（默认为当前时间）

**示例:**
```typescript
// 简单笔记
await createNote({ content: 'Buy groceries' })

// 带元数据的笔记
await createNote({
  content: 'Complete project report',
  category: 'work',
  tags: ['important', 'deadline'],
  importance: 8
})

// 指定日期的笔记
await createNote({
  content: 'Meeting notes',
  date: new Date('2026-01-30')
})
```

### 获取笔记列表

获取分页的笔记列表，支持按日期、分类、标签筛选。

**函数:** `listNotes(filters?: ListNotesFilters): Promise<{ notes: NoteBlock[]; total: number }>`

**参数:**
- `date` (string, 可选): 筛选日期 (ISO 格式)
- `category` (string, 可选): 筛选分类
- `tags` (string[], 可选): 筛选标签
- `page` (number, 可选): 页码 (默认: 1)
- `pageSize` (number, 可选): 每页条数 (默认: 50)

**示例:**
```typescript
// 获取所有笔记
const { notes, total } = await listNotes()

// 按日期筛选
const result = await listNotes({ date: '2026-01-30' })

// 分页结果
const result = await listNotes({ page: 1, pageSize: 20 })

// 按分类筛选
const result = await listNotes({ category: 'work' })

// 按标签筛选
const result = await listNotes({ tags: ['important', 'todo'] })
```

### 获取单条笔记

根据 ID 获取单条笔记的完整信息。

**函数:** `getNote(id: string): Promise<NoteBlock>`

**参数:**
- `id` (string, 必填): 笔记唯一标识符

**示例:**
```typescript
const note = await getNote('note-id-123')
```

### 更新笔记

更新现有笔记的内容或元数据。

**函数:** `updateNote(id: string, request: UpdateNoteRequest): Promise<NoteBlock>`

**参数:**
- `id` (string, 必填): 要更新的笔记 ID
- `content` (string, 可选): 新内容
- `category` (string, 可选): 新分类
- `tags` (string[], 可选): 新标签
- `importance` (number, 可选): 新重要性等级 (1-10)

**示例:**
```typescript
// 更新内容
await updateNote('note-id-123', { content: 'Updated content' })

// 更新分类
await updateNote('note-id-123', { category: 'personal' })

// 更新标签
await updateNote('note-id-123', { tags: ['important', 'follow-up'] })

// 更新多个字段
await updateNote('note-id-123', {
  content: 'Revised meeting notes',
  category: 'work',
  tags: ['meeting', 'action-items'],
  importance: 8
})
```

### 删除笔记

软删除笔记（设置 deletedAt 时间戳）。

**函数:** `deleteNote(id: string): Promise<void>`

**参数:**
- `id` (string, 必填): 要删除的笔记 ID

**示例:**
```typescript
await deleteNote('note-id-123')
```

### 搜索笔记

全文搜索笔记内容。

**函数:** `searchNotes(query: string): Promise<NoteBlock[]>`

**参数:**
- `query` (string, 必填): 搜索关键词

**示例:**
```typescript
// 搜索笔记
const notes = await searchNotes('meeting')

// 多关键词搜索
const notes = await searchNotes('project deadline')
```

## 错误处理

所有函数在请求失败时都会抛出描述性错误。常见错误场景：

- **404 Not Found**: 笔记或资源不存在
- **400 Bad Request**: 无效的输入数据（如空内容）
- **500 Server Error**: 后端处理错误

生产环境建议使用 try-catch 包裹调用。

## API 响应格式

所有 API 响应遵循以下格式：

```typescript
{
  success: boolean,
  data?: T,
  error?: string
}
```

Skill 会自动检查 `success` 字段并在需要时抛出错误。
