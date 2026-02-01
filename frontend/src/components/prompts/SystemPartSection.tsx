'use client'

import { Lock } from 'lucide-react'

interface SystemPartSectionProps {
  systemPart: string
}

export function SystemPartSection({ systemPart }: SystemPartSectionProps) {
  return (
    <div className="bg-background-secondary p-4 rounded-lg border border-border">
      <div className="flex items-center gap-2 mb-2">
        <Lock className="w-4 h-4 text-text-muted" />
        <h3 className="font-medium text-sm text-text-primary">系统限定区（不可修改）</h3>
      </div>
      <pre className="text-sm whitespace-pre-wrap text-text-primary break-words">
        {systemPart}
      </pre>
    </div>
  )
}
