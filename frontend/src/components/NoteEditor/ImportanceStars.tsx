/**
 * 重要性星星选择组件
 * 使用5颗星星表示1-5级重要性
 */
'use client'

import { Star } from 'lucide-react'
import { useState } from 'react'

interface ImportanceStarsProps {
  value: number  // 0-5 (0=未设置, 1-5=重要性等级)
  onChange: (value: number) => void
  size?: 'sm' | 'md'  // 控制星星大小
  disabled?: boolean
  showLabel?: boolean  // 新增：是否显示文字标签
}

// 根据重要性等级获取颜色
const getImportanceColor = (value: number): string => {
  if (value === 0) return 'text-gray-500'
  if (value <= 1) return 'text-gray-400'
  if (value <= 2) return 'text-blue-400'
  if (value <= 3) return 'text-yellow-400'
  if (value <= 4) return 'text-orange-400'
  return 'text-red-400'
}

// 根据重要性等级获取描述
const getImportanceLabel = (value: number): string => {
  if (value === 0) return '未设置'
  if (value === 1) return '较不重要'
  if (value === 2) return '一般'
  if (value === 3) return '重要'
  if (value === 4) return '很重要'
  return '极重要'
}

// 尺寸配置
const sizeConfig = {
  sm: {
    star: 'h-4 w-4',
    container: 'gap-0.5',
  },
  md: {
    star: 'h-5 w-5',
    container: 'gap-1',
  },
}

export function ImportanceStars({
  value = 0,
  onChange,
  size = 'sm',
  disabled = false,
  showLabel = true,  // 默认显示
}: ImportanceStarsProps) {
  const [hoverValue, setHoverValue] = useState(0)

  const displayValue = hoverValue || value
  const config = sizeConfig[size]

  const handleClick = (starValue: number) => {
    if (disabled) return
    // 点击已选中的星星则取消选择（设置为0）
    const newValue = value === starValue ? 0 : starValue
    onChange(newValue)
  }

  const handleMouseEnter = (starValue: number) => {
    if (disabled) return
    setHoverValue(starValue)
  }

  const handleMouseLeave = () => {
    setHoverValue(0)
  }

  const handleKeyDown = (e: React.KeyboardEvent, starValue: number) => {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick(starValue)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* 星星容器 */}
      <div
        className={`flex items-center ${config.container}`}
        onMouseLeave={handleMouseLeave}
      >
        {[1, 2, 3, 4, 5].map((starValue) => {
          const isSelected = starValue <= displayValue
          const colorClass = getImportanceColor(isSelected ? displayValue : 0)

          return (
            <button
              key={starValue}
              type="button"
              onClick={() => handleClick(starValue)}
              onMouseEnter={() => handleMouseEnter(starValue)}
              onKeyDown={(e) => handleKeyDown(e, starValue)}
              disabled={disabled}
              className={`
                ${config.star}
                ${colorClass}
                transition-all
                ${isSelected ? 'fill-current' : 'fill-transparent'}
                ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-110'}
                focus:outline-none
                focus:ring-1
                focus:ring-primary
                rounded
              `}
              aria-label={`设置重要性为 ${starValue} 级`}
              aria-pressed={isSelected}
              tabIndex={disabled ? -1 : 0}
            >
              <Star className="h-full w-full" />
            </button>
          )
        })}
      </div>

      {/* 当前值提示 - 可选显示 */}
      {showLabel && (
        <span className={`text-xs ${getImportanceColor(value)} whitespace-nowrap`}>
          {getImportanceLabel(value)}
        </span>
      )}
    </div>
  )
}
