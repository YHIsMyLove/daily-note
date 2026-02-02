'use client'

import { useEffect, useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Save, X, Sparkles, FileText } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { promptsApi } from '@/lib/api'
import { PromptTemplateDetail, PromptVariable } from '@daily-note/shared'
import { VariableSelector } from './VariableSelector'
import { PromptPreview } from './PromptPreview'
import { Loader2 } from 'lucide-react'

interface PromptEditorProps {
  mode: 'create' | 'edit'
  promptKey?: string | null
  onSuccess: () => void | Promise<void>
  onCancel: () => void
}

export function PromptEditor({ mode, promptKey, onSuccess, onCancel }: PromptEditorProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [userPart, setUserPart] = useState('')
  const [key, setKey] = useState('')
  const [systemPart, setSystemPart] = useState('')
  const [variables, setVariables] = useState<PromptVariable[]>([])
  const [submitting, setSubmitting] = useState(false)

  const nameInputRef = useRef<HTMLInputElement>(null)

  // 获取提示词详情（仅编辑模式）
  const { data: promptDetail } = useQuery({
    queryKey: ['prompt', promptKey],
    queryFn: () => promptsApi.get(promptKey!),
    enabled: mode === 'edit' && !!promptKey,
  })

  useEffect(() => {
    if (promptDetail?.data) {
      setName(promptDetail.data.name)
      setDescription(promptDetail.data.description || '')
      setUserPart(promptDetail.data.userPart)
      setKey(promptDetail.data.key)
      setSystemPart(promptDetail.data.systemPart)
      setVariables(promptDetail.data.variables)
    }
  }, [promptDetail])

  // 自动聚焦名称输入框
  useEffect(() => {
    if (nameInputRef.current) {
      nameInputRef.current.focus()
    }
  }, [])

  const handleInsertVariable = (placeholder: string) => {
    setUserPart((prev) => prev + placeholder)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      alert('请输入名称')
      return
    }

    try {
      setSubmitting(true)

      if (mode === 'edit') {
        // 更新现有提示词
        await promptsApi.update(promptKey!, userPart)
      } else {
        // 创建新提示词
        if (!key.trim()) {
          alert('请输入标识符')
          return
        }
        await promptsApi.create({
          key: key.trim(),
          name: name.trim(),
          description: description.trim(),
          systemPart: systemPart.trim(),
          userPart: userPart.trim(),
          variables,
        })
      }

      await onSuccess()
    } catch (error) {
      console.error('Failed to save prompt:', error)
      alert('保存失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  const canSubmit = name.trim().length > 0 && !submitting

  return (
    <Card className="border-primary/20 shadow-lg overflow-hidden focus-within:border-primary/80 transition-all duration-300">
      {/* 头部：返回按钮 + 标题 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={submitting}
            className="h-7 w-7 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-base font-semibold flex items-center gap-2">
            {mode === 'create' ? (
              <>
                <Sparkles className="h-4 w-4" />
                创建提示词
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                编辑提示词
              </>
            )}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={submitting}
            className="h-7 px-2 text-xs"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSubmit}
            size="sm"
            className="h-7 px-3 text-xs"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                保存中
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5 mr-1" />
                保存
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* 标识符输入（仅创建模式） */}
        {mode === 'create' && (
          <div className="space-y-1.5">
            <Label htmlFor="prompt-key" className="text-sm">标识符（key）</Label>
            <Input
              id="prompt-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="my_custom_prompt"
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">唯一标识符，用于引用此提示词</p>
          </div>
        )}

        {/* 名称输入 */}
        <div className="space-y-1.5">
          <Label htmlFor="prompt-name" className="text-sm">名称</Label>
          <Input
            ref={nameInputRef}
            id="prompt-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="我的提示词"
            className="text-sm"
          />
        </div>

        {/* 描述输入 */}
        <div className="space-y-1.5">
          <Label htmlFor="prompt-description" className="text-sm">描述</Label>
          <Input
            id="prompt-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="提示词用途描述"
            className="text-sm"
          />
        </div>

        {/* 变量选择器 */}
        {mode === 'edit' && variables.length > 0 && (
          <VariableSelector
            variables={variables}
            onInsert={handleInsertVariable}
          />
        )}

        {/* 提示词内容编辑 */}
        <div className="space-y-1.5">
          <Label htmlFor="prompt-user-part" className="text-sm">
            {mode === 'edit' ? '提示词区（可编辑）' : '提示词内容'}
          </Label>
          <Textarea
            id="prompt-user-part"
            value={userPart}
            onChange={(e) => setUserPart(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="在此编辑您的提示词..."
            className="min-h-[200px] font-mono text-sm resize-none"
          />
        </div>

        {/* 预览 */}
        {mode === 'edit' && (
          <PromptPreview
            systemPart={systemPart}
            userPart={userPart}
            variables={variables}
          />
        )}
      </div>
    </Card>
  )
}
