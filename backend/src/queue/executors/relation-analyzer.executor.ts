/**
 * 关联分析任务执行器
 *
 * 分析笔记之间的关联性，创建 NoteRelation 记录
 * 流程: 筛选候选笔记 -> AI 分析相似度 -> 创建/更新关联记录
 */
import { prisma } from '../../database/prisma'

/**
 * 关联分析载荷
 */
export interface RelationAnalyzerPayload {
  noteId: string
  content: string
  categoryId?: string
  tagIds?: string[]
}

/**
 * 候选笔记
 */
interface CandidateNote {
  id: string
  content: string
  summary?: string
  category?: string
  tags: string[]
  date: Date
}

/**
 * AI 分析结果
 */
interface RelationAnalysisResult {
  relations: Array<{
    noteId: string
    similarity: number
    reason: string
  }>
}

/**
 * 执行器结果
 */
export interface RelationAnalyzerExecutorResult {
  createdCount: number
  updatedCount: number
  relations: Array<{
    id: string
    fromId: string
    toId: string
    similarity: number
    reason: string
  }>
  isFallback: boolean
}

/**
 * 格式化候选笔记列表
 */
function formatCandidateNotes(notes: CandidateNote[]): string {
  return notes.map((n, idx) => {
    const preview = n.content.slice(0, 150)
    return `${idx + 1}. [ID: ${n.id}] ${n.category || '未分类'} | ${n.tags.join(', ') || '无标签'}
日期：${n.date.toLocaleDateString('zh-CN')}
${preview}${n.content.length > 150 ? '...' : ''}`
  }).join('\n\n')
}

/**
 * 筛选候选笔记
 *
 * 策略: 同分类 OR 同标签，最近 3 个月，最多 20 条
 */
async function findCandidateNotes(
  currentNoteId: string,
  categoryId?: string,
  tagIds: string[] = []
): Promise<CandidateNote[]> {
  const where: any = {
    id: { not: currentNoteId },  // 排除当前笔记
    deletedAt: null,
  }

  // 构建筛选条件：同分类 OR 同标签
  const orConditions: any[] = []

  if (categoryId) {
    orConditions.push({ categoryId })
  }

  if (tagIds.length > 0) {
    orConditions.push({
      noteTags: {
        some: {
          tagId: { in: tagIds }
        }
      }
    })
  }

  if (orConditions.length > 0) {
    where.OR = orConditions
  } else {
    // 如果没有分类和标签，返回最近的笔记
    orConditions.push({ id: { not: currentNoteId } })
    where.OR = orConditions
  }

  // 时间范围：最近 3 个月
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  where.date = { gte: threeMonthsAgo }

  // 最多获取 20 条候选
  const notes = await prisma.note.findMany({
    where,
    take: 20,
    orderBy: { date: 'desc' },
    include: {
      category: true,
      noteTags: { include: { tag: true } }
    }
  })

  return notes.map(n => ({
    id: n.id,
    content: n.content,
    summary: n.summary || undefined,
    category: n.category?.name,
    tags: n.noteTags.map(nt => nt.tag.name),
    date: n.date,
  }))
}

/**
 * 执行关联分析
 */
export async function executeRelationAnalysis(
  taskId: string,
  payload: RelationAnalyzerPayload
): Promise<RelationAnalyzerExecutorResult> {
  const { noteId, content, categoryId, tagIds } = payload

  // 1. 获取当前笔记信息
  const currentNote = await prisma.note.findUnique({
    where: { id: noteId },
    include: {
      noteTags: { include: { tag: true } },
      category: true,
    }
  })

  if (!currentNote) {
    throw new Error(`Note not found: ${noteId}`)
  }

  // 2. 筛选候选笔记
  const candidateNotes = await findCandidateNotes(
    noteId,
    categoryId || currentNote.categoryId || undefined,
    tagIds || currentNote.noteTags.map(nt => nt.tagId)
  )

  if (candidateNotes.length === 0) {
    console.log(`[RelationAnalyzer] No candidate notes found for ${noteId}`)
    return {
      createdCount: 0,
      updatedCount: 0,
      relations: [],
      isFallback: false,
    }
  }

  // 3. 动态导入 claudeService（避免循环依赖）
  const { claudeService } = await import('../../llm/claude.service')

  // 4. 调用 Claude API 分析关联性
  const analysisResult = await claudeService.analyzeRelations({
    currentNote: {
      id: noteId,
      title: currentNote.content.slice(0, 50),
      content: currentNote.content,
      category: currentNote.category?.name,
      tags: currentNote.noteTags.map(nt => nt.tag.name),
    },
    candidateNotes,
  })

  // 5. 创建或更新关联记录
  let createdCount = 0
  let updatedCount = 0
  const relations: Array<{
    id: string
    fromId: string
    toId: string
    similarity: number
    reason: string
  }> = []

  for (const relation of analysisResult.relations) {
    // 只处理相似度 >= 0.2 的关联
    if (relation.similarity < 0.2) continue

    // 检查是否已存在关联
    const existing = await prisma.noteRelation.findUnique({
      where: {
        fromId_toId: {
          fromId: noteId,
          toId: relation.noteId,
        }
      }
    })

    if (existing) {
      // 更新已有关联
      await prisma.noteRelation.update({
        where: { id: existing.id },
        data: {
          similarity: relation.similarity,
          reason: relation.reason,
        },
      })
      updatedCount++
      relations.push({
        id: existing.id,
        fromId: noteId,
        toId: relation.noteId,
        similarity: relation.similarity,
        reason: relation.reason,
      })
    } else {
      // 创建新关联
      const created = await prisma.noteRelation.create({
        data: {
          fromId: noteId,
          toId: relation.noteId,
          similarity: relation.similarity,
          reason: relation.reason,
        },
      })
      createdCount++
      relations.push({
        id: created.id,
        fromId: noteId,
        toId: relation.noteId,
        similarity: relation.similarity,
        reason: relation.reason,
      })
    }
  }

  // 6. SSE 推送关联更新事件
  const { sseService } = await import('../../services/sse.service')
  await sseService.broadcast('relations.updated', {
    noteId,
    createdCount,
    updatedCount,
    relations,
  })

  console.log(`[RelationAnalyzer] Analysis complete for ${noteId}: ${createdCount} created, ${updatedCount} updated`)

  return {
    createdCount,
    updatedCount,
    relations,
    isFallback: analysisResult.isFallback || false,
  }
}
