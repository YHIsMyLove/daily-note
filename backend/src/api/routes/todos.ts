/**
 * Todo API 路由
 * 提供 CRUD 接口
 */
import { FastifyInstance } from 'fastify'
import { todoService } from '../../services/todo.service'
import { CreateTodoRequest, UpdateTodoRequest, CompleteTodoRequest } from '@daily-note/shared'

export async function todosRoutes(fastify: FastifyInstance) {
  // 创建 Todo
  fastify.post('/api/todos', async (request, reply) => {
    try {
      const body = request.body as CreateTodoRequest

      if (!body.title || typeof body.title !== 'string') {
        return reply.status(400).send({
          success: false,
          error: 'Title is required',
        })
      }

      const todo = await todoService.createTodo(body, false)

      return reply.send({
        success: true,
        data: todo,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to create todo',
      })
    }
  })

  // 获取 Todo 列表
  fastify.get('/api/todos', async (request, reply) => {
    try {
      const query = request.query as any

      // 构建过滤器
      const filters: any = {}

      // 支持单/多状态参数
      if (query.status) {
        if (Array.isArray(query.status)) {
          filters.status = query.status
        } else {
          filters.status = query.status
        }
      }

      // 支持单/多优先级参数
      if (query.priority) {
        if (Array.isArray(query.priority)) {
          filters.priority = query.priority
        } else {
          filters.priority = query.priority
        }
      }

      if (query.noteId) {
        filters.noteId = query.noteId
      }

      if (query.isAiGenerated !== undefined) {
        filters.isAiGenerated = query.isAiGenerated === 'true' || query.isAiGenerated === true
      }

      if (query.autoCompletionEnabled !== undefined) {
        filters.autoCompletionEnabled = query.autoCompletionEnabled === 'true' || query.autoCompletionEnabled === true
      }

      if (query.dueDateFrom) {
        filters.dueDateFrom = new Date(query.dueDateFrom)
      }

      if (query.dueDateTo) {
        filters.dueDateTo = new Date(query.dueDateTo)
      }

      if (query.search) {
        filters.search = query.search
      }

      const result = await todoService.listTodos({
        filters,
        sortBy: query.sortBy || 'createdAt',
        sortOrder: query.sortOrder || 'desc',
        page: query.page ? parseInt(query.page) : 1,
        pageSize: query.pageSize ? parseInt(query.pageSize) : 50,
      })

      return reply.send({
        success: true,
        data: result,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch todos',
      })
    }
  })

  // 获取单个 Todo
  fastify.get('/api/todos/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const todo = await todoService.getTodo(id)

      if (!todo) {
        return reply.status(404).send({
          success: false,
          error: 'Todo not found',
        })
      }

      return reply.send({
        success: true,
        data: todo,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch todo',
      })
    }
  })

  // 更新 Todo
  fastify.put('/api/todos/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = request.body as UpdateTodoRequest

      const todo = await todoService.updateTodo(id, body)

      return reply.send({
        success: true,
        data: todo,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to update todo',
      })
    }
  })

  // 删除 Todo（软删除，设置为 CANCELLED 状态）
  fastify.delete('/api/todos/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      await todoService.deleteTodo(id)

      return reply.send({
        success: true,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete todo',
      })
    }
  })

  // 完成 Todo
  fastify.patch('/api/todos/:id/complete', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = request.body as CompleteTodoRequest | undefined

      const todo = await todoService.completeTodo(id, body || {})

      return reply.send({
        success: true,
        data: todo,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to complete todo',
      })
    }
  })

  // 取消 Todo
  fastify.patch('/api/todos/:id/cancel', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const todo = await todoService.cancelTodo(id)

      return reply.send({
        success: true,
        data: todo,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to cancel todo',
      })
    }
  })

  // 启用自动完成
  fastify.patch('/api/todos/:id/auto-completion/enable', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const todo = await todoService.enableAutoCompletion(id)

      return reply.send({
        success: true,
        data: todo,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to enable auto-completion',
      })
    }
  })

  // 禁用自动完成
  fastify.patch('/api/todos/:id/auto-completion/disable', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const todo = await todoService.disableAutoCompletion(id)

      return reply.send({
        success: true,
        data: todo,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to disable auto-completion',
      })
    }
  })

  // 获取 Todo 统计数据
  fastify.get('/api/todos/stats', async (request, reply) => {
    try {
      const query = request.query as any

      // 构建过滤器（与列表相同的过滤器）
      const filters: any = {}

      if (query.status) {
        if (Array.isArray(query.status)) {
          filters.status = query.status
        } else {
          filters.status = query.status
        }
      }

      if (query.priority) {
        if (Array.isArray(query.priority)) {
          filters.priority = query.priority
        } else {
          filters.priority = query.priority
        }
      }

      if (query.noteId) {
        filters.noteId = query.noteId
      }

      if (query.isAiGenerated !== undefined) {
        filters.isAiGenerated = query.isAiGenerated === 'true' || query.isAiGenerated === true
      }

      if (query.autoCompletionEnabled !== undefined) {
        filters.autoCompletionEnabled = query.autoCompletionEnabled === 'true' || query.autoCompletionEnabled === true
      }

      if (query.dueDateFrom) {
        filters.dueDateFrom = new Date(query.dueDateFrom)
      }

      if (query.dueDateTo) {
        filters.dueDateTo = new Date(query.dueDateTo)
      }

      if (query.search) {
        filters.search = query.search
      }

      const stats = await todoService.getTodoStats(filters)

      return reply.send({
        success: true,
        data: stats,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch todo stats',
      })
    }
  })

  // 根据笔记 ID 获取相关 Todos
  fastify.get('/api/todos/note/:noteId', async (request, reply) => {
    try {
      const { noteId } = request.params as { noteId: string }
      const todos = await todoService.getTodosByNoteId(noteId)

      return reply.send({
        success: true,
        data: todos,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch todos for note',
      })
    }
  })

  // 永久删除 Todo
  fastify.delete('/api/todos/:id/permanent', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      await todoService.hardDeleteTodo(id)

      return reply.send({
        success: true,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to permanently delete todo',
      })
    }
  })

  // 获取子任务列表
  fastify.get('/api/todos/:id/subtasks', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const subtasks = await todoService.getSubTasks(id)

      return reply.send({
        success: true,
        data: subtasks,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch subtasks',
      })
    }
  })

  // 创建子任务
  fastify.post('/api/todos/:id/subtasks', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = request.body as { title: string; description?: string; dueDate?: string }

      if (!body.title || typeof body.title !== 'string') {
        return reply.status(400).send({
          success: false,
          error: 'Title is required',
        })
      }

      const subtask = await todoService.createSubTask(id, {
        title: body.title,
        description: body.description,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      })

      return reply.send({
        success: true,
        data: subtask,
      })
    } catch (error: any) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to create subtask',
      })
    }
  })

  // 获取任务树（包含所有子任务）
  fastify.get('/api/todos/:id/tree', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const tree = await todoService.getTodoTree(id)

      if (!tree) {
        return reply.status(404).send({
          success: false,
          error: 'Todo not found',
        })
      }

      return reply.send({
        success: true,
        data: tree,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch todo tree',
      })
    }
  })
}
