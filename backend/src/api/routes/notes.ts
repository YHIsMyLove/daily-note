/**
 * 笔记 API 路由
 * 提供 CRUD 接口
 */
import { FastifyInstance } from 'fastify'
import { noteService } from '../../services/note.service'
import { CreateNoteRequest, UpdateNoteRequest } from '@daily-note/shared'

export async function notesRoutes(fastify: FastifyInstance) {
  // 创建笔记
  fastify.post('/api/notes', async (request, reply) => {
    try {
      const body = request.body as CreateNoteRequest

      if (!body.content || typeof body.content !== 'string') {
        return reply.status(400).send({
          success: false,
          error: 'Content is required',
        })
      }

      const note = await noteService.createNote(body)

      return reply.send({
        success: true,
        data: note,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to create note',
      })
    }
  })

  // 获取笔记列表
  fastify.get('/api/notes', async (request, reply) => {
    try {
      const query = request.query as any

      // 支持多标签参数（兼容单标签）
      let tags: string[] | undefined
      if (query.tags) {
        if (Array.isArray(query.tags)) {
          tags = query.tags
        } else {
          tags = [query.tags]
        }
      }

      // 解析 dateRange 参数
      let dateRange: any = undefined
      if (query['dateRange[mode]']) {
        dateRange = {
          mode: query['dateRange[mode]'],
          value: query['dateRange[value]'],
          startDate: query['dateRange[startDate]'],
          endDate: query['dateRange[endDate]'],
        }
      }

      const { notes, total } = await noteService.listNotes({
        // 向后兼容：单日查询
        date: query.date ? new Date(query.date) : undefined,
        // 新增：时间范围查询
        dateRange,
        // 筛选条件
        category: query.category,
        tags,
        keyword: query.keyword,
        dateFilterMode: query.dateFilterMode || 'both',
        page: query.page ? parseInt(query.page) : 1,
        pageSize: query.pageSize ? parseInt(query.pageSize) : 50,
      })

      return reply.send({
        success: true,
        data: { notes, total },
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch notes',
      })
    }
  })

  // 获取单条笔记
  fastify.get('/api/notes/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const note = await noteService.getNote(id)

      if (!note) {
        return reply.status(404).send({
          success: false,
          error: 'Note not found',
        })
      }

      return reply.send({
        success: true,
        data: note,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch note',
      })
    }
  })

  // 更新笔记
  fastify.put('/api/notes/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = request.body as UpdateNoteRequest

      const note = await noteService.updateNote(id, body)

      return reply.send({
        success: true,
        data: note,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to update note',
      })
    }
  })

  // 删除笔记（软删除到回收站）
  fastify.delete('/api/notes/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      await noteService.softDeleteNote(id)

      return reply.send({
        success: true,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete note',
      })
    }
  })

  // 软删除到回收站（别名）
  fastify.patch('/api/notes/:id/trash', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      await noteService.softDeleteNote(id)

      return reply.send({
        success: true,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to trash note',
      })
    }
  })

  // 从回收站恢复
  fastify.patch('/api/notes/:id/restore', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const note = await noteService.restoreNote(id)

      return reply.send({
        success: true,
        data: note,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to restore note',
      })
    }
  })

  // 永久删除
  fastify.delete('/api/notes/:id/permanent', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      await noteService.hardDeleteNote(id)

      return reply.send({
        success: true,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to permanently delete note',
      })
    }
  })

  // 获取回收站列表
  fastify.get('/api/notes/trash', async (request, reply) => {
    try {
      const notes = await noteService.getDeletedNotes()

      return reply.send({
        success: true,
        data: notes,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch trash',
      })
    }
  })

  // 搜索笔记
  fastify.get('/api/notes/search', async (request, reply) => {
    try {
      const { q } = request.query as { q?: string }

      if (!q) {
        return reply.status(400).send({
          success: false,
          error: 'Search query is required',
        })
      }

      const notes = await noteService.searchNotes(q)

      return reply.send({
        success: true,
        data: notes,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to search notes',
      })
    }
  })

  // 获取关联笔记
  fastify.get('/api/notes/:id/related', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const notes = await noteService.getRelatedNotes(id)

      return reply.send({
        success: true,
        data: notes,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch related notes',
      })
    }
  })

  // 手动触发分析
  fastify.post('/api/notes/:id/analyze', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const note = await noteService.analyzeNote(id)

      return reply.send({
        success: true,
        data: note,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to analyze note',
      })
    }
  })

  // 获取或创建指定日期的待办笔记
  // date 参数格式: YYYY-MM-DD，可选，默认今天
  fastify.get('/api/notes/daily-todo/:date?', async (request, reply) => {
    try {
      const { date } = request.params as { date?: string }

      let targetDate: Date | undefined
      if (date) {
        // 解析日期字符串 YYYY-MM-DD
        const [year, month, day] = date.split('-').map(Number)
        targetDate = new Date(year, month - 1, day)
      }

      const note = await noteService.getOrCreateDailyTodoNote(targetDate)

      return reply.send({
        success: true,
        data: note,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to get daily todo note',
      })
    }
  })
}
