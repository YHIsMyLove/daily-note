'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { promptsApi } from '@/lib/api'
import { PromptTemplateDetail, PromptVariable } from '@daily-note/shared'
import { VariableSelector } from './VariableSelector'
import { PromptPreview } from './PromptPreview'

interface PromptEditorSheetProps {
  promptKey?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function PromptEditorSheet({ promptKey, open, onOpenChange, onSuccess }: PromptEditorSheetProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [userPart, setUserPart] = useState('')
  const [key, setKey] = useState('')
  const [systemPart, setSystemPart] = useState('')
  const [variables, setVariables] = useState<PromptVariable[]>([])

  const { data: promptDetail } = useQuery({
    queryKey: ['prompt', promptKey],
    queryFn: () => promptsApi.get(promptKey!),
    enabled: !!promptKey && open,
  })

  useEffect(() => {
    if (promptDetail?.data) {
      setName(promptDetail.data.name)
      setDescription(promptDetail.data.description || '')
      setUserPart(promptDetail.data.userPart)
      setKey(promptDetail.data.key)
      setSystemPart(promptDetail.data.systemPart)
      setVariables(promptDetail.data.variables)
    } else {
      // 重置表单（创建模式）
      setName('')
      setDescription('')
      setUserPart('')
      setKey('')
      setSystemPart('')
      setVariables([])
    }
  }, [promptDetail, open])

  const handleInsertVariable = (placeholder: string) => {
    setUserPart((prev) => prev + placeholder)
  }

  const handleSave = async () => {
    try {
      if (!name.trim()) {
        alert('请输入名称')
        return
      }

      if (promptKey) {
        // 更新现有提示词
        await promptsApi.update(promptKey, userPart)
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
      onSuccess()
    } catch (error) {
      console.error('Failed to save prompt:', error)
      alert('保存失败，请稍后重试')
    }
  }

  const isEditing = !!promptKey

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? '编辑提示词' : '创建提示词'}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* 标识符输入（仅创建模式） */}
          {!isEditing && (
            <div className="space-y-2">
              <label className="text-sm font-medium">标识符（key）</label>
              <input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="my_custom_prompt"
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-text-muted">唯一标识符，用于引用此提示词</p>
            </div>
          )}

          {/* 名称输入 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="我的提示词"
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* 描述输入 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">描述</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="提示词用途描述"
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* 限定区已隐藏 - 节省空间 */}

          {/* 变量选择器 */}
          {isEditing && variables.length > 0 && (
            <VariableSelector
              variables={variables}
              onInsert={handleInsertVariable}
            />
          )}

          {/* 提示词区编辑 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {isEditing ? '提示词区（可编辑）' : '提示词内容'}
            </label>
            <Textarea
              value={userPart}
              onChange={(e) => setUserPart(e.target.value)}
              placeholder="在此编辑您的提示词..."
              className="min-h-[200px] font-mono text-sm"
            />
          </div>

          {/* 预览 */}
          {isEditing && (
            <PromptPreview
              systemPart={systemPart}
              userPart={userPart}
              variables={variables}
            />
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button onClick={handleSave}>
              保存
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
