/**
 * 分类和标签 API 路由
 */
import { FastifyInstance } from 'fastify'
import { prisma } from '../../database/prisma'

export async function categoriesRoutes(fastify: FastifyInstance) {
  // 获取所有分类
  fastify.get('/api/categories', async (request, reply) => {
    try {
      const categories = await prisma.note.groupBy({
        by: ['category'],
        where: { category: { not: null } },
        _count: {
          category: true,
        },
      })

      const result = categories
        .map((c) => ({
          name: c.category as string,
          count: c._count.category,
        }))
        .sort((a, b) => b.count - a.count)

      fastify.log.info({ categories: result }, '分类排序结果')

      return reply.send({
        success: true,
        data: result,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch categories',
      })
    }
  })

  // 获取所有标签
  fastify.get('/api/tags', async (request, reply) => {
    try {
      const tags = await prisma.tag.findMany({
        include: {
          _count: {
            select: {
              noteTags: true,
            },
          },
          noteTags: {
            where: {
              note: {
                deletedAt: null, // 只统计未删除的笔记
              },
            },
          },
        },
        orderBy: {
          noteTags: {
            _count: 'desc',
          },
        },
      })

      const result = tags.map((t) => ({
        id: t.id,
        name: t.name,
        count: t.noteTags.length, // 使用过滤后的 noteTags 数量
      }))

      return reply.send({
        success: true,
        data: result,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch tags',
      })
    }
  })

  // 创建标签
  fastify.post('/api/tags', async (request, reply) => {
    try {
      const { name } = request.body as { name: string }
      if (!name || !name.trim()) {
        return reply.status(400).send({
          success: false,
          error: 'Tag name is required',
        })
      }

      const trimmedName = name.trim()

      // 使用 upsert 创建或返回已存在的标签
      const tag = await prisma.tag.upsert({
        where: { name: trimmedName },
        update: {},
        create: { name: trimmedName },
      })

      return reply.send({
        success: true,
        data: {
          id: tag.id,
          name: tag.name,
        },
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to create tag',
      })
    }
  })

  // 获取指定分类的笔记
  fastify.get('/api/categories/:category/notes', async (request, reply) => {
    try {
      const { category } = request.params as { category: string }
      const query = request.query as any

      const notes = await prisma.note.findMany({
        where: { category },
        orderBy: { createdAt: 'desc' },
        skip: query.page ? (parseInt(query.page) - 1) * (query.pageSize || 50) : 0,
        take: query.pageSize ? parseInt(query.pageSize) : 50,
        include: {
          noteTags: {
            include: { tag: true },
          },
        },
      })

      return reply.send({
        success: true,
        data: notes.map((n) => ({
          id: n.id,
          content: n.content,
          date: n.date,
          category: n.category,
          tags: n.noteTags.map((nt) => nt.tag.name),
          importance: n.importance,
        })),
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch notes by category',
      })
    }
  })

  // 删除标签
  fastify.delete('/api/tags/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }

      // 检查标签是否有关联的笔记
      const tagWithRelations = await prisma.tag.findUnique({
        where: { id },
        include: {
          _count: {
            select: { noteTags: true }
          }
        }
      })

      if (!tagWithRelations) {
        return reply.status(404).send({
          success: false,
          error: 'Tag not found'
        })
      }

      if (tagWithRelations._count.noteTags > 0) {
        return reply.status(400).send({
          success: false,
          error: 'Cannot delete tag with associated notes'
        })
      }

      // 删除标签（Cascade 会自动删除 NoteTag）
      await prisma.tag.delete({
        where: { id }
      })

      return reply.send({
        success: true,
        data: { id }
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete tag'
      })
    }
  })

  // 重命名标签
  fastify.put('/api/tags/:id/rename', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const { newName } = request.body as { newName: string }

      // 验证新名称
      if (!newName || !newName.trim()) {
        return reply.status(400).send({
          success: false,
          error: 'New tag name is required',
        })
      }

      const trimmedName = newName.trim()

      // 检查标签是否存在
      const existingTag = await prisma.tag.findUnique({
        where: { id },
      })

      if (!existingTag) {
        return reply.status(404).send({
          success: false,
          error: 'Tag not found',
        })
      }

      // 检查新名称是否与其他标签冲突
      const conflictingTag = await prisma.tag.findFirst({
        where: {
          name: trimmedName,
          id: { not: id }, // 排除当前标签
        },
      })

      if (conflictingTag) {
        return reply.status(400).send({
          success: false,
          error: 'A tag with this name already exists',
        })
      }

      // 更新标签名称（NoteTag 关系会通过外键自动保留）
      const updatedTag = await prisma.tag.update({
        where: { id },
        data: { name: trimmedName },
      })

      return reply.send({
        success: true,
        data: {
          id: updatedTag.id,
          name: updatedTag.name,
        },
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to rename tag',
      })
    }
  })

  // 合并标签
  fastify.post('/api/tags/merge', async (request, reply) => {
    try {
      const { sourceTagId, targetTagId } = request.body as { sourceTagId: string, targetTagId: string }

      // 验证参数
      if (!sourceTagId || !targetTagId) {
        return reply.status(400).send({
          success: false,
          error: 'Source tag ID and target tag ID are required',
        })
      }

      // 检查是否相同
      if (sourceTagId === targetTagId) {
        return reply.status(400).send({
          success: false,
          error: 'Cannot merge tag with itself',
        })
      }

      // 使用事务进行原子操作
      const result = await prisma.$transaction(async (tx) => {
        // 检查源标签和目标标签是否存在
        const sourceTag = await tx.tag.findUnique({
          where: { id: sourceTagId },
        })

        const targetTag = await tx.tag.findUnique({
          where: { id: targetTagId },
        })

        if (!sourceTag) {
          throw new Error('SOURCE_NOT_FOUND')
        }

        if (!targetTag) {
          throw new Error('TARGET_NOT_FOUND')
        }

        // 获取源标签的所有 NoteTag 关系
        const sourceNoteTags = await tx.noteTag.findMany({
          where: { tagId: sourceTagId },
          select: { noteId: true },
        })

        // 获取目标标签已有的 NoteTag 关系
        const targetNoteTagIds = await tx.noteTag.findMany({
          where: { tagId: targetTagId },
          select: { noteId: true },
        })

        const targetNoteIdSet = new Set(targetNoteTagIds.map(nt => nt.noteId))

        // 转移源标签的 NoteTag 到目标标签（跳过已存在的）
        for (const noteTag of sourceNoteTags) {
          if (!targetNoteIdSet.has(noteTag.noteId)) {
            await tx.noteTag.create({
              data: {
                noteId: noteTag.noteId,
                tagId: targetTagId,
              },
            })
          }
        }

        // 删除源标签的所有 NoteTag 关系
        await tx.noteTag.deleteMany({
          where: { tagId: sourceTagId },
        })

        // 删除源标签
        await tx.tag.delete({
          where: { id: sourceTagId },
        })

        return {
          sourceTagId,
          targetTagId,
          sourceTagName: sourceTag.name,
          targetTagName: targetTag.name,
          transferredCount: sourceNoteTags.length,
        }
      })

      return reply.send({
        success: true,
        data: result,
      })
    } catch (error) {
      fastify.log.error(error)

      if (error instanceof Error) {
        if (error.message === 'SOURCE_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: 'Source tag not found',
          })
        }
        if (error.message === 'TARGET_NOT_FOUND') {
          return reply.status(404).send({
            success: false,
            error: 'Target tag not found',
          })
        }
      }

      return reply.status(500).send({
        success: false,
        error: 'Failed to merge tags',
      })
    }
  })

  // 清理没有笔记关联的标签
  fastify.post('/api/tags/cleanup', async (request, reply) => {
    try {
      // 找出所有没有关联笔记的标签
      const unusedTags = await prisma.tag.findMany({
        where: {
          noteTags: {
            none: {}
          }
        },
        select: {
          id: true,
          name: true
        }
      })

      // 批量删除
      if (unusedTags.length > 0) {
        await prisma.tag.deleteMany({
          where: {
            id: {
              in: unusedTags.map(t => t.id)
            }
          }
        })
      }

      return reply.send({
        success: true,
        data: {
          deletedCount: unusedTags.length,
          deletedTags: unusedTags
        }
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to cleanup tags'
      })
    }
  })
}
