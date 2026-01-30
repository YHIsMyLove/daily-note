# 智能总结功能使用指南

## 功能概述

智能总结功能支持按日/周/月/年生成多维度分析报告，包含：

- **AI 总结**：自动生成的整体概述、关键成就、待办任务和感悟洞察
- **心情曲线**：展示情绪变化趋势的可视化图表
- **笔记统计**：分类分布、热门标签、重要性分布、字数统计等
- **任务完成情况**：提及任务数、完成率、完成趋势
- **时间分布**：小时级活跃度和星期分布热力图

## 分层总结架构

系统采用智能分层总结策略：

- **日总结**：直接分析当天的所有原始笔记
- **周总结**：
  - 优先基于本周的 7 个日总结生成（更高效、结果更准确）
  - 如果日总结数量不足 5 个，降级到分析原始笔记
- **月总结**：
  - 优先基于本月的周总结生成
  - 如果周总结数量不足 2 个，降级到分析原始笔记
- **年总结**：
  - 优先基于本年度的月总结生成
  - 如果月总结数量不足 6 个，降级到分析原始笔记

## 使用方法

### 快速开始

1. 启动后端服务：
```bash
cd backend
pnpm start
```

2. 启动前端服务：
```bash
cd frontend
pnpm dev
```

3. 在浏览器中打开应用（通常是 `http://localhost:3000`）

### 创建总结

1. 点击顶部栏的"智能总结"按钮
2. 从下拉菜单中选择总结类型：
   - **今日总结**：分析今天的笔记
   - **本周总结**：分析本周的笔记
   - **本月总结**：分析本月的笔记
   - **年度总结**：分析整年的笔记
3. 系统将自动创建分析任务并在后台处理
4. 完成后会自动弹出结果展示面板

### 查看分析结果

分析结果面板包含以下部分：

#### 1. 时间范围信息
- 显示总结的时间范围和笔记数量

#### 2. AI 总结
- **概述**：整体概括这个时间段的主要活动和变化
- **关键成就**：已完成的重要事项和成就
- **待办任务**：识别还未完成的任务或待办事项
- **感悟洞察**：基于笔记内容提炼有价值的感悟

#### 3. 心情曲线
- 面积图展示积极/中性/消极情绪的分布
- 折线图展示平均情绪的变化趋势
- 趋势指示器（上升/稳定/下降）

#### 4. 笔记统计
- 总笔记数和日均笔记数
- 分类分布（带百分比进度条）
- 热门标签（按使用频率排序）
- 重要性分布（高/中/低）
- 字数统计（总数、平均、最大、最小）

#### 5. 任务完成情况
- 提及任务数、已完成数、待完成数
- 完成率百分比
- 完成趋势图表

#### 6. 时间分布
- 小时分布：展示每天 24 小时的笔记活跃度，最活跃时段会高亮显示
- 星期分布：展示周一到周日的笔记分布

## 技术实现

### 后端 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/summaries` | POST | 创建分析任务 |
| `/api/summaries` | GET | 获取分析任务列表 |
| `/api/summaries/:id` | GET | 获取单个分析结果 |
| `/api/summaries/:id` | DELETE | 取消/删除分析任务 |
| `/api/summaries/stats` | GET | 获取总结历史统计 |

### 数据流

```
用户点击"智能总结"
  ↓
前端调用 POST /api/summaries
  ↓
后端创建 ClaudeTask（type=summary_analyzer, status=PENDING）
  ↓
任务队列执行 summary-analyzer 执行器
  ↓
SummaryService 根据 mode 选择数据源：
  - 日总结：直接查询 Note 表
  - 周/月/年总结：优先查询子总结，不足则降级到原始笔记
  ↓
计算统计数据（心情、分类、标签、任务、时间分布）
  ↓
调用 Claude API 生成 AI 总结
  ↓
更新 ClaudeTask（status=COMPLETED, result=JSON）
  ↓
SSE 推送 task.completed 事件
  ↓
前端收到通知，展示结果面板
```

### 核心文件

| 文件 | 说明 |
|------|------|
| `backend/src/services/summary.service.ts` | 分层总结核心逻辑 |
| `backend/src/queue/executors/summary-analyzer.executor.ts` | 任务执行器 |
| `backend/src/api/routes/summaries.ts` | API 路由 |
| `backend/src/llm/claude.service.ts` | Claude API 调用（`generateSummaryAnalysis`、`generateHierarchicalSummary`） |
| `frontend/src/components/SummaryMenu.tsx` | 智能总结下拉菜单 |
| `frontend/src/components/SummaryResultSheet.tsx` | 分析结果展示面板 |
| `frontend/src/components/charts/SentimentCurveChart.tsx` | 心情曲线图表 |
| `frontend/src/components/charts/TimeDistributionChart.tsx` | 时间分布图表 |

## 依赖项

### 前端新增依赖
- `recharts`: 用于数据可视化（面积图、折线图、柱状图等）

安装命令：
```bash
pnpm add recharts --filter @daily-note/frontend
```

## 提示词模板

系统使用两个主要的提示词模板（存储在数据库 PromptTemplate 表中）：

### 1. summary_analysis
用于分析原始笔记生成总结（日总结、降级模式）

变量：
- `timeRange`: 时间范围
- `noteCount`: 笔记总数
- `notesSummary`: 笔记内容摘要
- `sentimentSummary`: 情绪分布统计
- `importantNotes`: 高重要性笔记

### 2. hierarchical_summary
用于基于子总结生成分层总结（周/月/年总结优先模式）

变量：
- `level`: 总结级别（week/month/year）
- `timeRange`: 时间范围
- `subSummariesCount`: 子总结数量
- `subSummaries`: 子总结详情

## 最佳实践

1. **定期生成日总结**：每天生成一次日总结，为周/月/年总结提供数据基础
2. **合理设置时间范围**：自定义时间范围不宜过大，建议不超过 3 个月
3. **注意笔记质量**：笔记内容越详细，AI 生成的总结越准确
4. **检查任务状态**：通过顶部栏的"任务状态"按钮查看分析任务进度
5. **利用分层总结**：优先使用分层总结（基于子总结）可以获得更准确和高效的结果

## 故障排除

### 1. 分析任务一直处于 PENDING 状态
- 检查后端服务是否正常运行
- 检查任务队列是否已启动（后端日志应显示 "Queue manager started"）
- 检查 Claude API 配置是否正确

### 2. 分析结果为空
- 检查指定时间范围内是否有符合条件的笔记
- 检查筛选条件（分类、标签）是否过于严格

### 3. 图表不显示
- 检查前端是否正确安装 recharts 依赖
- 检查浏览器控制台是否有错误信息
- 刷新页面重新加载

### 4. AI 总结内容不准确
- 考虑在"设置"->"提示词管理"中调整提示词模板
- 确保笔记内容包含足够的上下文信息

## 未来改进

- [ ] 支持自定义筛选条件（分类、标签）的总结
- [ ] 支持导出分析报告为 PDF
- [ ] 支持对比不同时间段的分析结果
- [ ] 支持设置定期自动生成总结
- [ ] 支持多维度交叉分析（如分类×时间）
