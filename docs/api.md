# Daily Note API 文档

## 基础信息

- 基础 URL: `http://localhost:3001`
- API 版本: `1.0.0`
- 数据格式: JSON

## 响应格式

所有 API 响应遵循以下格式：

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
```

## 笔记 API

### 创建笔记

创建一条新笔记，自动触发 Claude API 分类。

**请求**

```http
POST /api/notes
Content-Type: application/json

{
  "content": "今天学习了 Next.js 14 的新特性",
  "date": "2024-01-26T10:00:00Z"  // 可选，默认为当前时间
}
```

**响应**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "content": "今天学习了 Next.js 14 的新特性",
    "date": "2024-01-26T10:00:00Z",
    "createdAt": "2024-01-26T10:00:00Z",
    "updatedAt": "2024-01-26T10:00:05Z",
    "category": "学习笔记",
    "tags": ["Next.js", "学习", "前端"],
    "summary": "学习 Next.js 14 新功能",
    "sentiment": "positive",
    "importance": 7,
    "relatedNotes": [],
    "metadata": {
      "wordCount": 15
    }
  }
}
```

### 获取笔记列表

支持分页、按日期/分类/标签筛选。

**请求**

```http
GET /api/notes?date=2024-01-26&category=学习笔记&tags=Next.js&page=1&pageSize=50
```

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| date | string | 否 | 日期 (YYYY-MM-DD) |
| category | string | 否 | 分类名称 |
| tags | string[] | 否 | 标签列表 |
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页数量，默认 50 |

**响应**

```json
{
  "success": true,
  "data": {
    "notes": [...],
    "total": 100
  }
}
```

### 获取单条笔记

**请求**

```http
GET /api/notes/:id
```

**响应**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "content": "...",
    "category": "...",
    "tags": ["..."],
    ...
  }
}
```

### 更新笔记

**请求**

```http
PUT /api/notes/:id
Content-Type: application/json

{
  "content": "更新后的内容",
  "category": "新分类",
  "tags": ["新标签"],
  "importance": 8
}
```

**响应**

```json
{
  "success": true,
  "data": { ... }
}
```

### 删除笔记

**请求**

```http
DELETE /api/notes/:id
```

**响应**

```json
{
  "success": true
}
```

### 搜索笔记

全文搜索笔记内容。

**请求**

```http
GET /api/notes/search?q=Next.js
```

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| q | string | 是 | 搜索关键词 |

**响应**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "content": "包含 Next.js 的笔记...",
      ...
    }
  ]
}
```

### 获取关联笔记

**请求**

```http
GET /api/notes/:id/related
```

**响应**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "content": "相关笔记内容...",
      ...
    }
  ]
}
```

### 手动触发分析

重新调用 Claude API 分析笔记。

**请求**

```http
POST /api/notes/:id/analyze
```

**响应**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "category": "更新后的分类",
    "tags": ["更新后的标签"],
    ...
  }
}
```

## 分类和标签 API

### 获取所有分类

**请求**

```http
GET /api/categories
```

**响应**

```json
{
  "success": true,
  "data": [
    { "name": "工作总结", "count": 25 },
    { "name": "学习笔记", "count": 18 },
    { "name": "待办事项", "count": 12 }
  ]
}
```

### 获取所有标签

**请求**

```http
GET /api/tags
```

**响应**

```json
{
  "success": true,
  "data": [
    { "id": "uuid", "name": "Next.js", "count": 5 },
    { "id": "uuid", "name": "学习", "count": 20 }
  ]
}
```

### 获取指定分类的笔记

**请求**

```http
GET /api/categories/:category/notes?page=1&pageSize=50
```

**响应**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "content": "...",
      "category": "工作总结",
      ...
    }
  ]
}
```

## 统计 API

### 获取统计数据

**请求**

```http
GET /api/stats/summary
```

**响应**

```json
{
  "success": true,
  "data": {
    "totalNotes": 100,
    "todayNotes": 5,
    "categories": [
      { "name": "工作总结", "count": 25 },
      { "name": "学习笔记", "count": 18 }
    ],
    "topTags": [
      { "id": "uuid", "name": "Next.js", "count": 5 },
      { "id": "uuid", "name": "学习", "count": 20 }
    ]
  }
}
```

## 健康检查

**请求**

```http
GET /health
```

**响应**

```json
{
  "status": "ok",
  "timestamp": "2024-01-26T10:00:00Z"
}
```

## 错误处理

所有错误响应遵循以下格式：

```json
{
  "success": false,
  "error": "错误描述信息"
}
```

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## API 文档（Swagger）

访问 `http://localhost:3001/docs` 查看交互式 API 文档。
