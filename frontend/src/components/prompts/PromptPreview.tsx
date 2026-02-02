'use client'

import { useEffect, useState } from 'react'
import { PromptVariable } from '@daily-note/shared'

interface PromptPreviewProps {
  systemPart: string
  userPart: string
  variables: PromptVariable[]
}

export function PromptPreview({ systemPart, userPart, variables }: PromptPreviewProps) {
  const [preview, setPreview] = useState<string>('')

  useEffect(() => {
    // 构造示例数据
    const sampleData: Record<string, any> = {}
    variables.forEach((v) => {
      if (v.name === 'content') sampleData.content = '示例笔记内容...'
      else if (v.name === 'existingCategories')
        sampleData.existingCategories = '- 工作 (5次)\n- 学习 (3次)'
      else if (v.name === 'existingTags')
        sampleData.existingTags = '- 重要 (3次)\n- 待办 (2次)'
      else if (v.name === 'dateRange') sampleData.dateRange = '2024-01-01 至 2024-01-31'
      else if (v.name === 'noteCount') sampleData.noteCount = '42'
      else if (v.name === 'categoryDistribution')
        sampleData.categoryDistribution = '- 工作: 20\n- 学习: 15\n- 生活: 7'
      else if (v.name === 'tagDistribution')
        sampleData.tagDistribution = '- 重要: 25\n- 待办: 18\n- 笔记: 12'
      else if (v.name === 'date') sampleData.date = '2024-01-15'
      else if (v.name === 'categorySummary')
        sampleData.categorySummary = '工作: 5篇\n学习: 3篇\n生活: 2篇'
      else if (v.name === 'importantNotes')
        sampleData.importantNotes = '1. 完成项目报告\n2. 学习新技术'
      else sampleData[v.name] = `[${v.description}]`
    })

    // 客户端预览（合并和替换变量）
    let result = systemPart + '\n\n' + userPart
    Object.entries(sampleData).forEach(([key, value]) => {
      result = result.replaceAll(`{${key}}`, value)
    })
    setPreview(result)
  }, [systemPart, userPart, variables])

  return (
    <div className="border border-border rounded-lg p-4">
      <h3 className="text-sm font-medium mb-2">提示词预览</h3>
      <pre className="text-xs whitespace-pre-wrap text-text-primary bg-background-secondary p-3 rounded overflow-auto max-h-64">
        {preview}
      </pre>
    </div>
  )
}
