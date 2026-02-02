/**
 * FilterActiveIndicator 组件
 * 显示过滤器激活状态并提供清除所有过滤器按钮
 */
'use client'

import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilterActiveIndicatorProps {
  /** 是否有激活的过滤器 */
  hasFilters: boolean
  /** 清除所有过滤器的回调函数 */
  onClear: () => void
  /** 可选的额外类名 */
  className?: string
}

export const FilterActiveIndicator = React.forwardRef<
  HTMLDivElement,
  FilterActiveIndicatorProps
>(({ hasFilters, onClear, className }, ref) => {
  if (!hasFilters) {
    return null
  }

  return (
    <div
      ref={ref}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md bg-background-secondary border border-border',
        className
      )}
    >
      <Badge variant="secondary" className="text-xs font-medium">
        过滤器已激活
      </Badge>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        className="h-7 text-xs hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="h-3 w-3 mr-1" />
        清除全部
      </Button>
    </div>
  )
})

FilterActiveIndicator.displayName = 'FilterActiveIndicator'
