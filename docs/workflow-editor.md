# 工作流可视化编辑器

## 功能概述

工作流可视化编辑器允许用户通过图形界面配置和管理 AI 分析流程。用户可以：

- 查看和编辑不同触发场景的工作流配置
- 添加、删除、编辑任务节点
- 创建和删除节点之间的连线
- 导出和导入工作流配置
- 重置为默认配置

## 界面入口

点击主页面顶部工具栏的「🔧 工作流设置」按钮，打开工作流配置覆盖层。

## 界面布局

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🔧 工作流配置                                              [X]         │
├──────────────┬──────────────────────────────────────────────────────────┤
│              │  [导入] [导出] [重置默认] [保存配置]                      │
│  📋 触发场景  │                                                          │
│              │  ┌─────────────────┐       ┌─────────────────┐           │
│  • 笔记创建时  │  │ 📝 笔记分类      │──────▶│ 📋 提取待办      │           │
│  • 笔记更新时  │  └─────────────────┘       └─────────────────┘           │
│  • 笔记删除时  │                                                          │
│  • 手动分析时  │                                                          │
│              │                                                          │
│  ☑ 启用工作流  │  [+ 添加节点] [连线] [编辑] [删除]                       │
└──────────────┴───────────────────────────────────────────────────────────┘
```

## 操作说明

### 1. 切换场景

点击左侧的场景列表（笔记创建时、笔记更新时等）可以切换查看不同触发场景的工作流配置。

### 2. 启用/禁用工作流

使用左侧底部的开关可以启用或禁用当前场景的工作流。

### 3. 添加节点

点击底部工具栏的「添加节点」按钮，会在流程图中添加一个新的任务节点。默认类型为「笔记分类」，可以在节点编辑器中修改。

### 4. 创建连线

1. 点击「连线」按钮进入连线模式
2. 点击起始节点（源节点）
3. 点击目标节点
4. 系统会自动创建一条从起始节点到目标节点的连线

### 5. 删除连线

直接点击连线，确认后即可删除。

### 6. 编辑节点

1. 单击节点选中
2. 点击「编辑」按钮或双击节点
3. 在弹出的编辑器中修改节点属性：
   - 显示名称
   - 任务类型
   - 启用状态
   - 优先级
   - 执行顺序
   - 依赖节点

### 7. 删除节点

1. 单击节点选中
2. 点击「删除」按钮
3. 确认后删除节点及相关连线

### 8. 移动节点

直接拖拽节点可以调整其在流程图中的位置。位置会在保存时一起保存。

### 9. 保存配置

修改配置后，工具栏会显示「有未保存的更改」提示。点击「保存配置」按钮保存所有更改。

### 10. 导出/导入配置

- **导出**：将当前所有工作流配置导出为 JSON 文件
- **导入**：从 JSON 文件导入工作流配置，可选择是否覆盖现有配置

### 11. 重置默认

点击「重置默认」可以将所有工作流配置恢复为系统默认设置。

## 数据结构

### 工作流配置

```typescript
interface WorkflowConfig {
  id: string
  trigger: 'note_created' | 'note_updated' | 'note_deleted' | 'manual_analysis'
  label: string
  description?: string
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}
```

### 工作流步骤

```typescript
interface WorkflowStep {
  id: string
  workflowId: string
  taskType: string        // classify_note, extract_todo_tasks, etc.
  label: string           // 显示名称
  enabled: boolean
  priority: number        // 执行优先级 (0-10)
  position: number        // 执行顺序
  dependencies: string[]  // 依赖的步骤ID
  config?: Record<string, any>
  nodeX: number           // 流程图中的 X 坐标
  nodeY: number           // 流程图中的 Y 坐标
  createdAt: Date
  updatedAt: Date
}
```

### 工作流连线

```typescript
interface WorkflowConnection {
  id: string
  workflowId: string
  fromStepId: string
  toStepId: string
  condition?: string
  createdAt: Date
}
```

## 可用任务类型

| 类型 | 标签 | 描述 | 图标 |
|------|------|------|------|
| classify_note | 笔记分类 | 使用 AI 对笔记进行分类、打标签、情感分析和重要性评分 | 📝 |
| extract_todo_tasks | 提取待办 | 从笔记内容中提取待办事项和任务 | 📋 |
| analyze_relations | 关联分析 | 分析笔记之间的关联关系，构建知识图谱 | 🔗 |
| summary_analyzer | 总结分析 | 对指定时间范围的笔记进行汇总分析 | 📊 |
| auto_complete_todo | 待办自动完成 | AI 分析并自动完成符合条件的待办事项 | ✅ |

## 默认工作流

### 笔记创建时

1. 笔记分类
2. 提取待办
3. 关联分析（依赖笔记分类）

### 笔记更新时

1. 提取待办

### 笔记删除时

（无任务）

### 手动分析时

1. 笔记分类
2. 提取待办

## API 端点

- `GET /api/workflow` - 获取所有工作流配置
- `GET /api/workflow/:trigger` - 获取指定触发场景的工作流
- `PUT /api/workflow/:id` - 更新工作流配置
- `POST /api/workflow/:id/steps` - 添加工作流步骤
- `PUT /api/workflow/steps/:stepId` - 更新工作流步骤
- `DELETE /api/workflow/steps/:stepId` - 删除工作流步骤
- `POST /api/workflow/:id/connections` - 添加连线
- `DELETE /api/workflow/connections/:connectionId` - 删除连线
- `POST /api/workflow/reset` - 重置为默认配置
- `GET /api/workflow/export` - 导出配置
- `POST /api/workflow/import` - 导入配置
- `GET /api/workflow/meta/task-types` - 获取可用任务类型

## 技术实现

- **前端**: React + vis-network（流程图渲染）
- **后端**: Fastify + Prisma
- **数据库**: SQLite (WorkflowConfig, WorkflowStep, WorkflowConnection 表)
