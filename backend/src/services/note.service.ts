/**
 * 笔记服务
 * 处理笔记的 CRUD 操作、分类、关联等业务逻辑
 */
import { prisma } from '../database/prisma'
import { NoteBlock, CreateNoteRequest, UpdateNoteRequest, SortField, SortOrder } from '@daily-note/shared'
import { queueManager } from '../queue/queue-manager'

export class NoteService {
  /**
   * 创建笔记
   */
  async createNote(data: CreateNoteRequest): Promise<NoteBlock> {
    // 1. 保存笔记到数据库
    const note = await prisma.note.create({
      data: {
        content: data.content,
        date: data.date || new Date(),
        ...(data.category && { category: data.category }),
        ...(data.importance && { importance: data.importance }),
        metadata: JSON.stringify({
          wordCount: data.content.split(/\s+/).length,
        }),
      },
      include: {
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

    // 4. 重新获取包含标签的笔记
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
    return this.mapToNoteBlock(noteWithTags!)
  }

  /**
   * 获取笔记列表
   */
  async listNotes(options: {
    date?: Date
    category?: string
    tag?: string          // 保留向后兼容
    tags?: string[]       // 新增多标签支持
    page?: number
    pageSize?: number
    includeDeleted?: boolean
    dateFilterMode?: 'createdAt' | 'updatedAt' | 'both'
    orderBy?: SortField
    order?: SortOrder
  } = {}): Promise<{ notes: NoteBlock[]; total: number }> {
    const { date, category, tag, tags, page = 1, pageSize = 50, includeDeleted = false, dateFilterMode = 'both', orderBy = 'updatedAt', order = 'desc' } = options

    // 统一处理标签参数（优先使用 tags，兼容 tag）
    const tagFilters = tags || (tag ? [tag] : undefined)

    // 构建基础条件（不包含日期）
    const baseConditions: any = {}

    if (!includeDeleted) {
      baseConditions.deletedAt = null
    }

    if (category) {
      baseConditions.category = category
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

    const where: any = {}

    if (date) {
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(date)
      endOfDay.setHours(23, 59, 59, 999)

      const mode = dateFilterMode || 'both'

      if (mode === 'createdAt') {
        where.createdAt = { gte: startOfDay, lte: endOfDay }
        Object.assign(where, baseConditions)
      } else if (mode === 'updatedAt') {
        where.updatedAt = { gte: startOfDay, lte: endOfDay }
        Object.assign(where, baseConditions)
      } else {
        // both 模式 - OR 分支包含所有其他条件
        // 手动构建两个完整的条件对象
        const createdAtCondition: any = { createdAt: { gte: startOfDay, lte: endOfDay } }
        const updatedAtCondition: any = { updatedAt: { gte: startOfDay, lte: endOfDay } }

        // 复制基础条件到两个分支
        if (baseConditions.deletedAt !== undefined) {
          createdAtCondition.deletedAt = baseConditions.deletedAt
          updatedAtCondition.deletedAt = baseConditions.deletedAt
        }
        if (baseConditions.category) {
          createdAtCondition.category = baseConditions.category
          updatedAtCondition.category = baseConditions.category
        }
        if (baseConditions.noteTags) {
          createdAtCondition.noteTags = baseConditions.noteTags
          updatedAtCondition.noteTags = baseConditions.noteTags
        }

        where.OR = [createdAtCondition, updatedAtCondition]
      }
    } else {
      // 无日期过滤
      Object.assign(where, baseConditions)
    }

    const [notes, total] = await Promise.all([
      prisma.note.findMany({
        where,
        orderBy: { [orderBy]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
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
      }),
      prisma.note.count({ where }),
    ])

    // 判断每个笔记的匹配来源并添加到结果中
    const notesWithMatchSource = notes.map((n) => {
      let source: 'createdAt' | 'updatedAt' | undefined

      if (date) {
        const startOfDay = new Date(date)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(date)
        endOfDay.setHours(23, 59, 59, 999)

        const createdInRange = n.createdAt >= startOfDay && n.createdAt <= endOfDay
        const updatedInRange = n.updatedAt >= startOfDay && n.updatedAt <= endOfDay

        if (createdInRange && !updatedInRange) {
          source = 'createdAt'
        } else if (updatedInRange && !createdInRange) {
          source = 'updatedAt'
        } else if (createdInRange && updatedInRange) {
          source = 'createdAt'  // 优先显示创建时间
        }
      }

      return this.mapToNoteBlock(n, source)
    })

    return {
      notes: notesWithMatchSource,
      total,
    }
  }

  /**
   * 获取单条笔记
   */
  async getNote(id: string): Promise<NoteBlock | null> {
    const note = await prisma.note.findUnique({
      where: { id },
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
        wordCount: data.content.split(/\s+/).length,
      })
    }

    if (data.category !== undefined) {
      updateData.category = data.category
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
   * 软删除笔记（移到回收站）
   */
  async softDeleteNote(id: string): Promise<void> {
    await prisma.note.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }

  /**
   * 恢复笔记（从回收站恢复）
   */
  async restoreNote(id: string): Promise<NoteBlock> {
    const note = await prisma.note.update({
      where: { id },
      data: { deletedAt: null },
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
    return this.mapToNoteBlock(note)
  }

  /**
   * 永久删除笔记
   */
  async hardDeleteNote(id: string): Promise<void> {
    await prisma.note.delete({
      where: { id },
    })
  }

  /**
   * 获取回收站笔记列表
   */
  async getDeletedNotes(): Promise<NoteBlock[]> {
    const notes = await prisma.note.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
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
          { category: { contains: query } },
        ],
      },
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
   * 触发手动分析
   */
  async analyzeNote(id: string): Promise<NoteBlock> {
    const note = await prisma.note.findUnique({
      where: { id },
    })

    if (!note) {
      throw new Error('Note not found')
    }

    // 创建分类任务
    const task = await queueManager.enqueue(
      'classify_note',
      { noteId: note.id, content: note.content },
      note.id,
      10 // 手动触发优先级更高
    )

    // 轮询等待任务完成（最多等待 30 秒）
    const maxWait = 30000
    const pollInterval = 500
    const startTime = Date.now()

    while (Date.now() - startTime < maxWait) {
      const updatedTask = await prisma.claudeTask.findUnique({
        where: { id: task.id },
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
  private mapToNoteBlock(note: any, matchSource?: 'createdAt' | 'updatedAt'): NoteBlock {
    const metadata = note.metadata ? JSON.parse(note.metadata) : {}

    return {
      id: note.id,
      content: note.content,
      date: note.date,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      deletedAt: note.deletedAt || undefined,
      category: note.category || undefined,
      tags: note.noteTags?.map((nt: any) => nt.tag.name) || [],
      summary: note.summary || undefined,
      sentiment: note.sentiment as 'positive' | 'neutral' | 'negative' | undefined,
      importance: note.importance,
      relatedNotes: [
        ...(note.relations?.map((r: any) => r.toId) || []),
        ...(note.relatedFrom?.map((r: any) => r.fromId) || []),
      ],
      metadata: {
        wordCount: metadata.wordCount,
      },
      matchSource,  // 新增匹配来源标记
    }
  }
}

export const noteService = new NoteService()
