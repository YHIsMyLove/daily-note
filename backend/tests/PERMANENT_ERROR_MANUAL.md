# 永久性错误处理 - 手动验证指南

本文档提供手动验证永久性错误处理的详细步骤。

## 验证目标

1. ✅ 无效API密钥时不触发重试，立即失败
2. ✅ 配额超限时不触发重试，立即失败
3. ✅ 用户看到清晰的中文错误消息
4. ✅ 任务标记为FAILED状态并包含描述性错误信息
5. ✅ 对比：临时错误会触发重试，永久错误不重试

## 测试场景

### 场景 1: 无效API密钥 (401 Unauthorized)

#### 目标
验证当API密钥无效时，系统立即失败，不进行重试。

#### 步骤

1. **设置无效API密钥**
   ```bash
   # 编辑 backend/.env
   ANTHROPIC_API_KEY=sk-ant-invalid-key-12345
   ```

2. **启动后端服务**
   ```bash
   cd backend
   npm run dev
   ```

3. **创建测试笔记**
   ```bash
   curl -X POST http://localhost:3001/api/notes \
     -H "Content-Type: application/json" \
     -d '{
       "content": "测试无效API密钥错误处理",
       "category": "test"
     }'
   ```

4. **触发分类任务**
   - 笔记创建后会自动触发分类任务
   - 或通过API手动触发:
     ```bash
     curl -X POST http://localhost:3001/api/tasks/classify \
       -H "Content-Type: application/json" \
       -d '{"noteId": "<刚才创建的noteId>"}'
     ```

#### 验证点

- [ ] **立即失败**：任务在第一次尝试后立即失败（不重试）
- [ ] **任务状态**：查询任务状态为 `FAILED`
  ```bash
  curl http://localhost:3001/api/tasks/<taskId>
  ```
  预期响应:
  ```json
  {
    "status": "FAILED",
    "error": "Invalid API key",
    "retryCount": 0
  }
  ```

- [ ] **错误日志**：后端日志显示永久性失败
  ```
  [Queue] Task permanently failed: task_xxx (attempts: 1/3, retryable: false)
  ```

- [ ] **用户消息**：错误消息明确指出API密钥问题
  - 标题: "API 密钥无效"
  - 描述: "无法验证您的 API 密钥，请检查配置是否正确"
  - 建议: "请在设置中检查您的 Anthropic API 密钥"

- [ ] **无重试**：`nextRetryAt` 字段为 `null`

#### 清理
```bash
# 恢复正确的API密钥
# 编辑 backend/.env
ANTHROPIC_API_KEY=sk-ant-your-real-api-key
```

---

### 场景 2: 配额超限错误

#### 目标
验证当API配额用完时，系统立即失败，不进行重试。

#### 步骤

由于无法真实触发配额超限错误，我们使用模拟方式：

1. **临时修改错误分类代码**
   ```typescript
   // backend/src/utils/errors.ts
   // 临时添加测试钩子
   if (process.env.TEST_QUOTA_ERROR === 'true') {
     return {
       type: ErrorType.QUOTA_EXCEEDED,
       retryable: false,
       // ...
     }
   }
   ```

2. **设置测试标志**
   ```bash
   export TEST_QUOTA_ERROR=true
   ```

3. **创建测试笔记并触发分类**
   ```bash
   curl -X POST http://localhost:3001/api/notes \
     -H "Content-Type: application/json" \
     -d '{
       "content": "测试配额超限错误处理",
       "category": "test"
     }'
   ```

#### 验证点

- [ ] **立即失败**：任务在第一次尝试后立即失败
- [ ] **任务状态**：查询任务状态为 `FAILED`
- [ ] **错误日志**：日志显示配额超限
  ```
  [Queue] Task permanently failed: task_xxx (attempts: 1/3, retryable: false)
  ```

- [ ] **用户消息**：
  - 标题: "API 配额已用完"
  - 描述: "您的 API 使用额度已耗尽"
  - 建议: "请前往 Anthropic 控制台充值或等待配额重置"

- [ ] **无重试**：`retryCount` 为 0，`nextRetryAt` 为 `null`

#### 清理
```bash
unset TEST_QUOTA_ERROR
# 恢复错误分类代码
```

---

### 场景 3: 对比测试 - 临时错误 vs 永久错误

#### 目标
验证临时错误会触发重试，永久错误不重试。

#### 步骤

1. **测试临时错误（网络超时）**
   ```bash
   # 设置极短的超时时间
   export ANTHROPIC_API_TIMEOUT=1
   ```

   ```bash
   curl -X POST http://localhost:3001/api/notes \
     -H "Content-Type: application/json" \
     -d '{
       "content": "测试临时错误重试",
       "category": "test"
     }'
   ```

   **验证点:**
   - [ ] 任务重试多次（最多3次）
   - [ ] `retryCount` 递增 (1, 2, 3)
   - [ ] `nextRetryAt` 设置为未来的时间
   - [ ] 日志显示重试调度:
     ```
     [Queue] Task scheduled for retry: task_xxx (attempt 1/3, delay 1000ms)
     ```

2. **测试永久错误（无效API密钥）**
   ```bash
   # 设置无效API密钥
   export ANTHROPIC_API_KEY=invalid-key
   ```

   ```bash
   curl -X POST http://localhost:3001/api/notes \
     -H "Content-Type: application/json" \
     -d '{
       "content": "测试永久错误不重试",
       "category": "test"
     }'
   ```

   **验证点:**
   - [ ] 任务立即失败（第一次尝试后）
   - [ ] `retryCount` 为 0
   - [ ] `nextRetryAt` 为 `null`
   - [ ] 日志显示永久失败:
     ```
     [Queue] Task permanently failed: task_xxx (attempts: 1/3, retryable: false)
     ```

---

## 自动化测试脚本

### 运行 TypeScript 验证脚本

```bash
cd backend
npx tsx tests/verify-permanent-error-handling.ts
```

### 运行 JavaScript 快速验证

```bash
cd backend
node tests/verify-permanent-simple.js
```

### 运行内联测试

```bash
cd backend
npx tsx -e "
import { classifyError, isRetryable, getUserMessage, ErrorType } from './src/utils/errors';

// 测试无效API密钥
const authError = { status: 401, message: 'Invalid API key' };
const classified = classifyError(authError);
console.log('✓ 401 错误分类:', classified.type);
console.log('✓ 可重试:', classified.retryable);
console.log('✓ 用户消息:', getUserMessage(classified).title);
console.assert(classified.type === ErrorType.AUTHENTICATION);
console.assert(classified.retryable === false);

// 测试配额超限
const quotaError = { message: 'Quota exceeded' };
const quotaClassified = classifyError(quotaError);
console.log('✓ 配额错误分类:', quotaClassified.type);
console.log('✓ 可重试:', quotaClassified.retryable);
console.assert(quotaClassified.type === ErrorType.QUOTA_EXCEEDED);
console.assert(quotaClassified.retryable === false);

console.log('\n✅ 所有测试通过！');
"
```

---

## 数据库验证

### 查询失败的任务

```bash
# 进入 backend 目录
cd backend

# 使用 Prisma Studio
npx prisma studio

# 或使用 SQL 查询
sqlite3 prisma/dev.db "SELECT id, type, status, error, retryCount, nextRetryAt FROM ClaudeTask WHERE status = 'FAILED' ORDER BY createdAt DESC LIMIT 10;"
```

### 验证字段

对于永久性错误失败的任务：

```sql
SELECT
  id,
  status,
  error,
  retryCount,
  lastRetryAt,
  nextRetryAt
FROM ClaudeTask
WHERE status = 'FAILED'
  AND (error LIKE '%Invalid API key%' OR error LIKE '%quota%')
ORDER BY createdAt DESC;
```

**预期结果:**
- `status` = `'FAILED'`
- `retryCount` = `0` (未进行重试)
- `nextRetryAt` = `NULL` (无重试计划)

---

## SSE 事件验证

使用 SSE 客户端监听任务事件：

```bash
curl -N http://localhost:3001/api/sse
```

**预期事件流（永久错误）:**

```
event: task.created
data: {"taskId":"xxx","type":"NOTE_CLASSIFICATION","status":"PENDING"}

event: task.started
data: {"taskId":"xxx","type":"NOTE_CLASSIFICATION","status":"RUNNING"}

event: task.failed
data: {
  "taskId": "xxx",
  "type": "NOTE_CLASSIFICATION",
  "status": "FAILED",
  "error": "Invalid API key",
  "retryCount": 0
}
```

**注意：** 永久错误时**不会**出现 `task.retry` 事件。

---

## 故障排除

### 问题 1: 任务仍在重试

**原因：** 错误分类逻辑可能错误地将永久错误标记为可重试。

**检查：**
```bash
cd backend
npx tsx -e "
import { classifyError, isRetryable } from './src/utils/errors';
const error = { status: 401, message: 'Invalid API key' };
console.log('可重试:', isRetryable(error));
console.log('分类:', classifyError(error));
"
```

**预期：** `可重试: false`

### 问题 2: 错误消息不友好

**检查用户消息生成：**
```bash
cd backend
npx tsx -e "
import { getUserMessage, classifyError } from './src/utils/errors';
const error = { status: 401, message: 'Invalid API key' };
const msg = getUserMessage(classifyError(error));
console.log('标题:', msg.title);
console.log('描述:', msg.message);
console.log('建议:', msg.suggestion);
"
```

### 问题 3: 任务状态不正确

**检查数据库字段：**
```bash
sqlite3 prisma/dev.db "SELECT status, retryCount, nextRetryAt FROM ClaudeTask WHERE id = 'xxx';"
```

**永久错误应该:**
- `status` = `'FAILED'`
- `retryCount` = `0`
- `nextRetryAt` = `NULL`

---

## 验证清单

完成以下所有项目即为验证通过：

### 无效API密钥 (401/403)
- [ ] 任务立即失败（第一次尝试后）
- [ ] 任务状态为 `FAILED`
- [ ] `retryCount` = 0
- [ ] `nextRetryAt` = `NULL`
- [ ] 日志显示 "permanently failed"
- [ ] 用户看到 "API 密钥无效" 消息
- [ ] 错误描述清晰，包含修复建议

### 配额超限
- [ ] 任务立即失败
- [ ] 任务状态为 `FAILED`
- [ ] `retryCount` = 0
- [ ] `nextRetryAt` = `NULL`
- [ ] 用户看到 "API 配额已用完" 消息
- [ ] 错误建议充值或等待重置

### 对比测试
- [ ] 临时错误（网络、超时）触发重试
- [ ] 永久错误（认证、配额）不触发重试
- [ ] `isRetryable()` 函数正确区分两种错误
- [ ] 用户消息准确反映错误类型

### 代码质量
- [ ] TypeScript 编译无错误
- [ ] 自动化测试全部通过
- [ ] 日志输出清晰，包含调试信息
- [ ] SSE 事件正确触发

---

## 总结

永久性错误处理验证通过后，系统应具备以下特性：

1. ✅ **智能错误识别**：自动区分临时错误和永久错误
2. ✅ **高效失败机制**：永久错误立即失败，不浪费重试资源
3. ✅ **友好用户体验**：中文错误消息，清晰的修复建议
4. ✅ **完整状态跟踪**：任务状态、错误信息、重试次数完整记录
5. ✅ **实时事件通知**：SSE 推送任务失败事件给前端

如有任何问题，请参考故障排除部分或联系开发团队。
