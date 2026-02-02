/**
 * 分类和标签 API 路由
 */
import { FastifyInstance } from 'fastify'
import { prisma } from '../../database/prisma'

export async function categoriesRoutes(fastify: FastifyInstance) {
  // ==================== 分类相关接口 ====================

  // 获取所有分类
  fastify.get('/api/categories', async (request, reply) => {
    try {
      const categories = await prisma.category.findMany({
        include: {
          _count: {
            select: {
              notes: true,
            },
          },
        },
        orderBy: {
          notes: {
            _count: 'desc',
          },
        },
      })

      const result = categories.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        count: c._count.notes,
      }))

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

  // 创建分类
  fastify.post('/api/categories', async (request, reply) => {
    try {
      const { name, color } = request.body as { name: string; color?: string }
      if (!name || !name.trim()) {
        return reply.status(400).send({
          success: false,
          error: 'Category name is required',
        })
      }

      const trimmedName = name.trim()

      // 检查是否已存在
      const existing = await prisma.category.findUnique({
        where: { name: trimmedName },
      })

      if (existing) {
        return reply.status(400).send({
          success: false,
          error: 'Category already exists',
        })
      }

      const category = await prisma.category.create({
        data: {
          name: trimmedName,
          color,
        },
      })

      return reply.send({
        success: true,
        data: {
          id: category.id,
          name: category.name,
          color: category.color,
        },
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to create category',
      })
    }
  })

  // 更新分类
  fastify.put('/api/categories/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const { name, color } = request.body as { name?: string; color?: string }

      const category = await prisma.category.findUnique({
        where: { id },
      })

      if (!category) {
        return reply.status(404).send({
          success: false,
          error: 'Category not found',
        })
      }

      // 如果要更新名称，检查是否与其他分类重名
      if (name && name !== category.name) {
        const existing = await prisma.category.findUnique({
          where: { name },
        })
        if (existing) {
          return reply.status(400).send({
            success: false,
            error: 'Category name already exists',
          })
        }
      }

      const updated = await prisma.category.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(color !== undefined ? { color } : {}),
        },
      })

      return reply.send({
        success: true,
        data: {
          id: updated.id,
          name: updated.name,
          color: updated.color,
        },
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to update category',
      })
    }
  })

  // 删除分类
  fastify.delete('/api/categories/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }

      // 检查分类是否有关联的笔记
      const categoryWithRelations = await prisma.category.findUnique({
        where: { id },
        include: {
          _count: {
            select: { notes: true },
          },
        },
      })

      if (!categoryWithRelations) {
        return reply.status(404).send({
          success: false,
          error: 'Category not found',
        })
      }

      if (categoryWithRelations._count.notes > 0) {
        return reply.status(400).send({
          success: false,
          error: 'Cannot delete category with associated notes',
        })
      }

      await prisma.category.delete({
        where: { id },
      })

      return reply.send({
        success: true,
        data: { id },
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete category',
      })
    }
  })

  // 获取指定分类的笔记
  fastify.get('/api/categories/:category/notes', async (request, reply) => {
    try {
      const { category } = request.params as { category: string }
      const query = request.query as any

      const notes = await prisma.note.findMany({
        where: {
          category: {
            name: category,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.page ? (parseInt(query.page) - 1) * (query.pageSize || 50) : 0,
        take: query.pageSize ? parseInt(query.pageSize) : 50,
        include: {
          category: true,
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
          category: n.category?.name,
          categoryId: n.categoryId,
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

  // ==================== 标签相关接口 ====================

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
        color: t.color,
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
      const { name, color } = request.body as { name: string; color?: string }
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
        create: { name: trimmedName, color },
      })

      return reply.send({
        success: true,
        data: {
          id: tag.id,
          name: tag.name,
          color: tag.color,
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

  // 更新标签
  fastify.put('/api/tags/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const { name, color } = request.body as { name?: string; color?: string }

      const tag = await prisma.tag.findUnique({
        where: { id },
      })

      if (!tag) {
        return reply.status(404).send({
          success: false,
          error: 'Tag not found',
        })
      }

      // 如果要更新名称，检查是否与其他标签重名
      if (name && name !== tag.name) {
        const existing = await prisma.tag.findUnique({
          where: { name },
        })
        if (existing) {
          return reply.status(400).send({
            success: false,
            error: 'Tag name already exists',
          })
        }
      }

      const updated = await prisma.tag.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(color !== undefined ? { color } : {}),
        },
      })

      return reply.send({
        success: true,
        data: {
          id: updated.id,
          name: updated.name,
          color: updated.color,
        },
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to update tag',
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
            select: { noteTags: true },
          },
        },
      })

      if (!tagWithRelations) {
        return reply.status(404).send({
          success: false,
          error: 'Tag not found',
        })
      }

      if (tagWithRelations._count.noteTags > 0) {
        return reply.status(400).send({
          success: false,
          error: 'Cannot delete tag with associated notes',
        })
      }

      // 删除标签（Cascade 会自动删除 NoteTag）
      await prisma.tag.delete({
        where: { id },
      })

      return reply.send({
        success: true,
        data: { id },
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete tag',
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
            none: {},
          },
        },
        select: {
          id: true,
          name: true,
        },
      })

      // 批量删除
      if (unusedTags.length > 0) {
        await prisma.tag.deleteMany({
          where: {
            id: {
              in: unusedTags.map((t) => t.id),
            },
          },
        })
      }

      return reply.send({
        success: true,
        data: {
          deletedCount: unusedTags.length,
          deletedTags: unusedTags,
        },
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to cleanup tags',
      })
    }
  })
}
