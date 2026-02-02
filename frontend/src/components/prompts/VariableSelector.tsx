'use client'

import { PromptVariable } from '@daily-note/shared'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface VariableSelectorProps {
  variables: PromptVariable[]
  onInsert: (placeholder: string) => void
}

export function VariableSelector({ variables, onInsert }: VariableSelectorProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">可用变量（点击插入）</h4>
      <TooltipProvider>
        <div className="flex flex-wrap gap-2">
          {variables.map((variable) => (
            <Tooltip key={variable.name}>
              <TooltipTrigger asChild>
                <Badge
                  variant={variable.required ? 'default' : 'outline'}
                  className="cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => onInsert(variable.placeholder)}
                >
                  {variable.name}
                  {variable.required && <span className="text-red-500 ml-1">*</span>}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{variable.description}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  )
}
