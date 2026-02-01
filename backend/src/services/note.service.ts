/**
 * 笔记服务
 * 处理笔记的 CRUD 操作、分类、关联等业务逻辑
 */
import { prisma } from '../database/prisma'
import { NoteBlock, CreateNoteRequest, UpdateNoteRequest, DateRangeInput } from '@daily-note/shared'
import { queueManager } from '../queue/queue-manager'
import { calculateDateRange } from '../utils/date-range.util'
import { sseService } from './sse.service'

export class NoteService {
  /**
   * 创建笔记
   */
  async createNote(data: CreateNoteRequest): Promise<NoteBlock> {
    // 1. 如果提供了分类名称，查找或创建分类
    let categoryId: string | undefined
    if (data.category) {
      const category = await prisma.category.upsert({
        where: { name: data.category },
        update: {},
        create: { name: data.category },
      })
      categoryId = category.id
    }

    // 2. 保存笔记到数据库
    const note = await prisma.note.create({
      data: {
        content: data.content,
        date: data.date || new Date(),
        ...(categoryId && { categoryId }),
        ...(data.importance && { importance: data.importance }),
        metadata: JSON.stringify({
          wordCount: data.content.replace(/\s/g, '').length,
        }),
      },
      include: {
        category: true,
        relations: {
          include: {
            to: true,
          },
        },
        relatedFrom: {
          include: {
            from: true,
          },
        },
        noteTags: {
          include: {
            tag: true,
          },
        },
      },
    })

    // 2. 处理标签（如果提供）
    if (data.tags && data.tags.length > 0) {
      for (const tagName of data.tags) {
        const tag = await prisma.tag.upsert({
          where: { name: tagName },
          update: {},
          create: { name: tagName },
        })

        await prisma.noteTag.create({
          data: {
            noteId: note.id,
            tagId: tag.id,
          },
        })
      }
    }

    // 3. 将分类任务加入队列
    queueManager.enqueue(
      'classify_note',
      { noteId: note.id, content: note.content },
      note.id,
      5 // 优先级
    )

    // 4. 将任务提取任务加入队列
    queueManager.enqueue(
      'extract_todo_tasks',
      { noteId: note.id, content: note.content },
      note.id,
      5 // 优先级
    )

    // 5. 重新获取包含标签的笔记
    const noteWithTags = await prisma.note.findUnique({
      where: { id: note.id },
      include: {
        relations: {
          include: { to: true },
        },
        relatedFrom: {
          include: { from: true },
        },
        noteTags: {
          include: { tag: true },
        },
      },
    })

    // 5. 返回笔记（此时可能还未完成分类）
    const result = this.mapToNoteBlock(noteWithTags!)

    // 6. 广播笔记创建事件
    sseService.broadcast('note.created', { note: result })

    return result
  }

  /**
   * 获取笔记列表
   */
  async listNotes(options: {
    date?: Date
    dateRange?: DateRangeInput
    category?: string
    tag?: string
    tags?: string[]
    keyword?: string
    page?: number
    pageSize?: number
    includeDeleted?: boolean
  } = {}): Promise<{ notes: NoteBlock[]; total: number }> {
    const {
      date,
      dateRange,
      category,
      tag,
      tags,
      keyword,
      page = 1,
      pageSize = 50,
      includeDeleted = false,
    } = options

    // 统一处理标签参数（优先使用 tags，兼容 tag）
    const tagFilters = tags || (tag ? [tag] : undefined)

    // 构建基础条件（不包含日期和关键字）
    const baseConditions: any = {}

    if (!includeDeleted) {
      baseConditions.deletedAt = null
    }

    if (category) {
      baseConditions.category = {
        name: category,
      }
    }

    if (tagFilters && tagFilters.length > 0) {
      baseConditions.noteTags = {
        some: {
          tag: {
            name: {
              in: tagFilters  // OR 逻辑：匹配任一标签
            }
          },
        },
      }
    }

    // 构建关键字搜索条件
    const keywordCondition = keyword ? {
      OR: [
        { content: { contains: keyword } },
        { summary: { contains: keyword } },
        { category: { name: { contains: keyword } } },
      ]
    } : undefined

    const where: any = {}

    // 确定使用哪个日期参数
    let startDate: Date | undefined
    let endDate: Date | undefined

    if (dateRange) {
      // 使用时间范围参数
      const range = calculateDateRange(dateRange)
      startDate = range.startDate
      endDate = range.endDate
    } else if (date) {
      // 使用单日参数（向后兼容）
      startDate = new Date(date)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(date)
      endDate.setHours(23, 59, 59, 999)
    }

    // 构建查询条件
    if (startDate && endDate) {
      where.date = { gte: startDate, lte: endDate }
    }
    this.assignBaseConditions(where, baseConditions, keywordCondition)

    const [notes, total] = await Promise.all([
      prisma.note.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: true,
          relations: {
            include: { to: true },
          },
          relatedFrom: {
            include: { from: true },
          },
          noteTags: {
            include: { tag: true },
          },
        },
      }),
      prisma.note.count({ where }),
    ])

    return {
      notes: notes.map((n) => this.mapToNoteBlock(n)),
      total,
    }
  }

  /**
   * 辅助方法：将基础条件和关键字条件赋值到目标对象
   */
  private assignBaseConditions(
    target: any,
    baseConditions: any,
    keywordCondition?: any
  ): void {
    if (baseConditions.deletedAt !== undefined) {
      target.deletedAt = baseConditions.deletedAt
    }
    if (baseConditions.category) {
      target.category = baseConditions.category
    }
    if (baseConditions.noteTags) {
      target.noteTags = baseConditions.noteTags
    }
    if (keywordCondition) {
      // 将关键字搜索的 OR 条件合并
      if (!target.OR) {
        target.OR = []
      }
      if (Array.isArray(keywordCondition.OR)) {
        target.OR.push(...keywordCondition.OR)
      }
    }
  }

  /**
   * 获取单条笔记
   */
  async getNote(id: string): Promise<NoteBlock | null> {
    const note = await prisma.note.findUnique({
      where: { id },
      include: {
        category: true,
        relations: {
          include: { to: true },
        },
        relatedFrom: {
          include: { from: true },
        },
        noteTags: {
          include: { tag: true },
        },
      },
    })

    return note ? this.mapToNoteBlock(note) : null
  }

  /**
   * 更新笔记
   */
  async updateNote(id: string, data: UpdateNoteRequest): Promise<NoteBlock> {
    const updateData: any = {}

    if (data.content !== undefined) {
      updateData.content = data.content
      updateData.metadata = JSON.stringify({
        wordCount: data.content.replace(/\s/g, '').length,
      })
    }

    // 处理分类更新
    if (data.category !== undefined) {
      if (data.category === null || data.category === '') {
        // 清空分类
        updateData.categoryId = null
      } else {
        // 查找或创建分类
        const category = await prisma.category.upsert({
          where: { name: data.category },
          update: {},
          create: { name: data.category },
        })
        updateData.categoryId = category.id
      }
    }

    if (data.importance !== undefined) {
      updateData.importance = data.importance
    }

    // 更新标签（如果提供）
    if (data.tags !== undefined) {
      // 删除现有标签关联
      await prisma.noteTag.deleteMany({
        where: { noteId: id },
      })

      // 添加新标签
      for (const tagName of data.tags) {
        const tag = await prisma.tag.upsert({
          where: { name: tagName },
          update: {},
          create: { name: tagName },
        })

        await prisma.noteTag.create({
          data: {
            noteId: id,
            tagId: tag.id,
          },
        })
      }
    }

    const note = await prisma.note.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        relations: {
          include: { to: true },
        },
        relatedFrom: {
          include: { from: true },
        },
        noteTags: {
          include: { tag: true },
        },
      },
    })

    // 如果内容被更新，触发任务提取
    if (data.content !== undefined) {
      queueManager.enqueue(
        'extract_todo_tasks',
        { noteId: note.id, content: note.content },
        note.id,
        5 // 优先级
      )
    }

    const result = this.mapToNoteBlock(note)

    // 广播笔记更新事件
    sseService.broadcast('note.updated', { note: result })

    return result
  }

  /**
   * 软删除笔记（移到回收站）
   */
  async softDeleteNote(id: string): Promise<void> {
    await prisma.note.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    // 广播笔记删除事件
    sseService.broadcast('note.deleted', { noteId: id })
  }

  /**
   * 恢复笔记（从回收站恢复）
   */
  async restoreNote(id: string): Promise<NoteBlock> {
    const note = await prisma.note.update({
      where: { id },
      data: { deletedAt: null },
      include: {
        category: true,
        relations: {
          include: { to: true },
        },
        relatedFrom: {
          include: { from: true },
        },
        noteTags: {
          include: { tag: true },
        },
      },
    })
    const result = this.mapToNoteBlock(note)

    // 广播笔记恢复事件
    sseService.broadcast('note.restored', { note: result })

    return result
  }

  /**
   * 永久删除笔记
   */
  async hardDeleteNote(id: string): Promise<void> {
    await prisma.note.delete({
      where: { id },
    })

    // 广播笔记永久删除事件
    sseService.broadcast('note.permanent_deleted', { noteId: id })
  }

  /**
   * 获取回收站笔记列表
   */
  async getDeletedNotes(): Promise<NoteBlock[]> {
    const notes = await prisma.note.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      include: {
        category: true,
        relations: {
          include: { to: true },
        },
        relatedFrom: {
          include: { from: true },
        },
        noteTags: {
          include: { tag: true },
        },
      },
    })
    return notes.map((n) => this.mapToNoteBlock(n))
  }

  /**
   * 删除笔记（保留兼容性，改为软删除）
   */
  async deleteNote(id: string): Promise<void> {
    await this.softDeleteNote(id)
  }

  /**
   * 搜索笔记（全文搜索）
   */
  async searchNotes(query: string): Promise<NoteBlock[]> {
    const notes = await prisma.note.findMany({
      where: {
        OR: [
          { content: { contains: query } },
          { summary: { contains: query } },
          { category: { name: { contains: query } } },
        ],
      },
      include: {
        category: true,
        relations: {
          include: { to: true },
        },
        relatedFrom: {
          include: { from: true },
        },
        noteTags: {
          include: { tag: true },
        },
      },
    })

    return notes.map((n) => this.mapToNoteBlock(n))
  }

  /**
   * 获取关联笔记
   */
  async getRelatedNotes(noteId: string): Promise<NoteBlock[]> {
    const relations = await prisma.noteRelation.findMany({
      where: {
        OR: [{ fromId: noteId }, { toId: noteId }],
      },
      include: {
        from: true,
        to: true,
      },
    })

    const relatedIds = relations.map((r) => (r.fromId === noteId ? r.toId : r.fromId))

    const notes = await prisma.note.findMany({
      where: { id: { in: relatedIds } },
      include: {
        category: true,
        relations: {
          include: { to: true },
        },
        relatedFrom: {
          include: { from: true },
        },
        noteTags: {
          include: { tag: true },
        },
      },
    })

    return notes.map((n) => this.mapToNoteBlock(n))
  }

  /**
   * 获取或创建指定日期的待办笔记
   * @param date 日期（默认今天）
   * @returns 每日待办笔记
   */
  async getOrCreateDailyTodoNote(date?: Date): Promise<NoteBlock> {
    // 规范化日期为当天的 00:00:00
    const targetDate = date || new Date()
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

    // 查询是否已存在该日期的待办笔记
    const existing = await prisma.note.findFirst({
      where: {
        isDailyTodoNote: true,
        dailyTodoDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        category: true,
        relations: {
          include: { to: true },
        },
        relatedFrom: {
          include: { from: true },
        },
        noteTags: {
          include: { tag: true },
        },
      },
    })

    if (existing) {
      return this.mapToNoteBlock(existing)
    }

    // 创建新的每日待办笔记
    const formatDate = (d: Date) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    // 查找或创建"待办"分类
    const category = await prisma.category.upsert({
      where: { name: '待办' },
      update: {},
      create: { name: '待办' },
    })

    const note = await prisma.note.create({
      data: {
        content: `## ${formatDate(startOfDay)} 待办汇总\n`,
        date: startOfDay,
        isDailyTodoNote: true,
        dailyTodoDate: startOfDay,
        categoryId: category.id,
        importance: 5,
        metadata: JSON.stringify({
          wordCount: 0,
          isDailyTodoNote: true,
        }),
      },
      include: {
        category: true,
        relations: {
          include: { to: true },
        },
        relatedFrom: {
          include: { from: true },
        },
        noteTags: {
          include: { tag: true },
        },
      },
    })

    return this.mapToNoteBlock(note)
  }

  /**
   * 更新每日待办笔记的内容，追加新待办
   * @param noteId 笔记 ID
   * @param todo 待办事项
   */
  async appendTodoToDailyNote(noteId: string, todo: { title: string; description?: string }): Promise<void> {
    const note = await prisma.note.findUnique({
      where: { id: noteId },
    })

    if (!note) {
      throw new Error('Note not found')
    }

    // 追加待办内容
    const newContent = note.content + `\n- [ ] ${todo.title}${todo.description ? `: ${todo.description}` : ''}`

    await prisma.note.update({
      where: { id: noteId },
      data: {
        content: newContent,
        metadata: JSON.stringify({
          wordCount: newContent.replace(/\s/g, '').length,
          isDailyTodoNote: true,
        }),
      },
    })
  }

  /**
   * 触发手动分析
   *
   * 同时创建分类和任务提取两个任务
   */
  async analyzeNote(id: string): Promise<NoteBlock> {
    const note = await prisma.note.findUnique({
      where: { id },
    })

    if (!note) {
      throw new Error('Note not found')
    }

    // 同时创建分类任务和任务提取任务
    const classifyTask = await queueManager.enqueue(
      'classify_note',
      { noteId: note.id, content: note.content },
      note.id,
      10 // 手动触发优先级更高
    )

    await queueManager.enqueue(
      'extract_todo_tasks',
      { noteId: note.id, content: note.content },
      note.id,
      10 // 同样的优先级
    )

    // 轮询等待分类任务完成（最多等待 30 秒）
    const maxWait = 30000
    const pollInterval = 500
    const startTime = Date.now()

    while (Date.now() - startTime < maxWait) {
      const updatedTask = await prisma.claudeTask.findUnique({
        where: { id: classifyTask.id },
      })

      if (
        !updatedTask ||
        updatedTask.status === 'COMPLETED' ||
        updatedTask.status === 'FAILED'
      ) {
        break
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval))
    }

    const updated = await prisma.note.findUnique({
      where: { id },
      include: {
        category: true,
        relations: {
          include: { to: true },
        },
        relatedFrom: {
          include: { from: true },
        },
        noteTags: {
          include: { tag: true },
        },
      },
    })

    return this.mapToNoteBlock(updated!)
  }

  /**
   * 将 Prisma Note 映射为 NoteBlock
   */
  private mapToNoteBlock(note: any): NoteBlock {
    const metadata = note.metadata ? JSON.parse(note.metadata) : {}

    return {
      id: note.id,
      content: note.content,
      date: note.date,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      deletedAt: note.deletedAt || undefined,
      category: note.category?.name || undefined,
      categoryId: note.categoryId || undefined,
      tags: note.noteTags?.map((nt: any) => nt.tag.name) || [],
      summary: note.summary || undefined,
      sentiment: note.sentiment as 'positive' | 'neutral' | 'negative' | undefined,
      importance: note.importance,
      relatedNotes: [
        ...(note.relations?.map((r: any) => r.toId) || []),
        ...(note.relatedFrom?.map((r: any) => r.fromId) || []),
      ],
      isDailyTodoNote: note.isDailyTodoNote || undefined,
      dailyTodoDate: note.dailyTodoDate || undefined,
      // 直接传递解析后的 metadata 对象，保留所有字段
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    }
  }
}

export const noteService = new NoteService()
