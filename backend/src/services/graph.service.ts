/**
 * 图谱服务
 * 处理知识图谱数据的计算和转换
 */
import { prisma } from '../database/prisma'
import {
  GraphData,
  GraphNode,
  GraphEdge,
  GraphFilters,
  Category,
} from '@daily-note/shared'

export class GraphService {
  /**
   * 获取图谱数据
   */
  async getGraphData(filters: GraphFilters = {}): Promise<GraphData> {
    const {
      categories,
      tags,
      dateFrom,
      dateTo,
      minSimilarity,
      minImportance,
      limit = 1000,
      sentiment,
    } = filters

    // 1. 构建查询条件
    const where: any = {
      deletedAt: null,
    }

    // 分类过滤
    if (categories && categories.length > 0) {
      where.category = {
        name: { in: categories }
      }
    }

    // 标签过滤
    if (tags && tags.length > 0) {
      where.noteTags = {
        some: {
          tag: {
            name: { in: tags },
          },
        },
      }
    }

    // 日期范围过滤
    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) {
        where.date.gte = new Date(dateFrom)
      }
      if (dateTo) {
        where.date.lte = new Date(dateTo)
      }
    }

    // 重要性过滤
    if (minImportance !== undefined) {
      where.importance = { gte: minImportance }
    }

    // 情感过滤
    if (sentiment) {
      where.sentiment = sentiment
    }

    // 2. 查询笔记（节点）
    const notes = await prisma.note.findMany({
      where,
      take: limit,
      orderBy: { importance: 'desc' },
      include: {
        category: true,
        noteTags: {
          include: { tag: true },
        },
      },
    })

    // 3. 提取节点 ID 集合
    const noteIds = notes.map((n) => n.id)

    // 4. 查询关联关系（边）
    const relations = await prisma.noteRelation.findMany({
      where: {
        OR: [{ fromId: { in: noteIds } }, { toId: { in: noteIds } }],
        ...(minSimilarity !== undefined && { similarity: { gte: minSimilarity } }),
      },
    })

    // 5. 过滤边：只保留两端节点都存在的边
    const validRelations = relations.filter(
      (r) => noteIds.includes(r.fromId) && noteIds.includes(r.toId)
    )

    // 6. 转换为图节点
    const nodes: GraphNode[] = notes.map((note) => {
      // 计算节点大小（基于重要性）
      const size = this.calculateNodeSize(note.importance)

      // 计算节点颜色（基于分类或情感）
      const categoryName = note.category?.name
      const color = this.calculateNodeColor(categoryName, note.sentiment)

      return {
        id: note.id,
        label: this.generateNodeLabel(note.content, categoryName),
        category: categoryName || undefined,
        sentiment: note.sentiment as 'positive' | 'neutral' | 'negative' | undefined,
        importance: note.importance,
        date: note.date.toISOString(),
        content: note.content,
        tags: note.noteTags.map((nt) => nt.tag.name),
        size,
        color,
      }
    })

    // 7. 转换为图边
    const edges: GraphEdge[] = validRelations.map((relation) => ({
      id: relation.id,
      from: relation.fromId,
      to: relation.toId,
      similarity: relation.similarity || undefined,
      weight: this.calculateEdgeWeight(relation.similarity),
      reason: relation.reason || undefined,
      type: 'similarity',
    }))

    // 8. 计算统计信息
    const stats = {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      categoryDistribution: this.calculateCategoryDistribution(notes),
    }

    return {
      nodes,
      edges,
      total: nodes.length,
      stats,
    }
  }

  /**
   * 计算节点大小（基于重要性）
   * 重要性范围：1-10
   * 返回大小范围：10-50
   */
  private calculateNodeSize(importance: number): number {
    const minSize = 10
    const maxSize = 50
    const normalizedImportance = Math.max(1, Math.min(10, importance))
    return minSize + ((normalizedImportance - 1) / 9) * (maxSize - minSize)
  }

  /**
   * 计算节点颜色（基于分类或情感）
   */
  private calculateNodeColor(
    category?: string,
    sentiment?: string | null
  ): string | undefined {
    // 如果有情感，优先使用情感颜色
    if (sentiment) {
      const sentimentColors: Record<string, string> = {
        positive: '#4ade80', // green
        neutral: '#94a3b8', // slate
        negative: '#f87171', // red
      }
      return sentimentColors[sentiment]
    }

    // 否则使用分类颜色（基于哈希）
    if (category) {
      return this.stringToColor(category)
    }

    return undefined
  }

  /**
   * 根据字符串生成固定颜色
   */
  private stringToColor(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    const hue = Math.abs(hash % 360)
    return `hsl(${hue}, 70%, 50%)`
  }

  /**
   * 生成节点标签
   */
  private generateNodeLabel(content: string, category?: string | null): string {
    // 如果有分类，使用分类作为前缀
    const prefix = category ? `[${category}] ` : ''

    // 取内容的前 50 个字符
    const maxLength = 50
    let label = content.trim()
    if (label.length > maxLength) {
      label = label.substring(0, maxLength) + '...'
    }

    // 如果内容为空，使用分类或"无标题"
    if (!label) {
      label = category || '无标题'
    }

    return prefix + label
  }

  /**
   * 计算边的权重（基于相似度）
   * 相似度范围：0-1
   * 返回权重范围：1-10
   */
  private calculateEdgeWeight(similarity?: number | null): number {
    if (!similarity) return 1
    const minWeight = 1
    const maxWeight = 10
    return minWeight + similarity * (maxWeight - minWeight)
  }

  /**
   * 计算分类分布
   */
  private calculateCategoryDistribution(notes: any[]): Category[] {
    const distribution: Record<string, number> = {}

    notes.forEach((note) => {
      const category = note.category?.name || '未分类'
      distribution[category] = (distribution[category] || 0) + 1
    })

    return Object.entries(distribution)
      .map(([name, count]) => ({ id: name, name, count }))
      .sort((a, b) => b.count - a.count)
  }
}

export const graphService = new GraphService()
