/**
 * 笔记分类任务执行器
 *
 * 将原 NoteService.classifyNoteAsync 的逻辑迁移为独立的执行器函数
 */
import { prisma } from '../../database/prisma'
import { claudeService } from '../../llm/claude.service'

/**
 * 执行笔记分类任务
 *
 * @param taskId - 任务 ID
 * @param payload - 任务载荷，包含 noteId 和 content
 * @returns 分类结果
 */
export async function executeNoteClassification(
  taskId: string,
  payload: {
    noteId: string
    content: string
  }
) {
  const { noteId, content } = payload

  // 1. 获取现有分类（按使用频率排序）
  const categories = await prisma.category.findMany({
    include: {
      _count: {
        select: { notes: true },
      },
    },
  })
  const existingCategories = categories
    .map((c) => ({ name: c.name, count: c._count.notes }))
    .sort((a, b) => b.count - a.count)

  // 2. 获取现有标签（按使用频率排序）
  const tags = await prisma.tag.findMany({
    include: {
      _count: {
        select: {
          noteTags: {
            where: { note: { deletedAt: null } }
          }
        }
      }
    },
  })
  const existingTags = tags
    .map((t) => ({ name: t.name, count: t._count.noteTags }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count)

  // 3. 调用 Claude API 分类
  const classification = await claudeService.classifyNote(content, {
    existingCategories,
    existingTags,
  })

  // 4. 查找或创建分类
  const category = await prisma.category.upsert({
    where: { name: classification.category },
    update: {},
    create: { name: classification.category },
  })

  // 5. 更新笔记
  await prisma.note.update({
    where: { id: noteId },
    data: {
      categoryId: category.id,
      summary: classification.summary,
      sentiment: classification.sentiment,
      importance: classification.importance,
      metadata: JSON.stringify({
        wordCount: content.split(/\s+/).length,
        classifiedAt: new Date().toISOString(),
      }),
    },
  })

  // 6. 处理标签
  if (classification.tags.length > 0) {
    for (const tagName of classification.tags) {
      // 查找或创建标签
      const tag = await prisma.tag.upsert({
        where: { name: tagName },
        update: {},
        create: { name: tagName },
      })

      // 创建笔记-标签关联
      await prisma.noteTag.upsert({
        where: {
          noteId_tagId: {
            noteId,
            tagId: tag.id,
          },
        },
        update: {},
        create: {
          noteId,
          tagId: tag.id,
        },
      })
    }
  }

  return classification
}
