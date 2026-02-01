/**
 * 笔记快速输入组件
 */
'use client'

import { useState } from 'react'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Card } from './ui/card'
import { Send } from 'lucide-react'

interface NoteInputProps {
  onSubmit: (content: string) => void
  disabled?: boolean
  placeholder?: string
}

export function NoteInput({ onSubmit, disabled = false, placeholder = '记录一条新笔记...' }: NoteInputProps) {
  const [content, setContent] = useState('')

  const handleSubmit = () => {
    if (content.trim()) {
      onSubmit(content.trim())
      setContent('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit()
    }
  }

  return (
    <Card className="p-4 border-primary/20 shadow-lg focus-within:border-primary/50 transition-colors">
      <div className="space-y-3">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-[240px] resize-none bg-transparent border-0 focus:ring-0 focus:outline-none"
          rows={3}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">
            {content.length} 字 · Ctrl+Enter 提交
          </span>
          <Button
            onClick={handleSubmit}
            disabled={disabled || !content.trim()}
            size="sm"
          >
            <Send className="h-4 w-4 mr-2" />
            提交笔记
          </Button>
        </div>
      </div>
    </Card>
  )
}
