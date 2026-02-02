/**
 * 颜色选择器组件
 * 支持点击色块显示原生颜色选择器，支持任意颜色（HEX/HSL）
 */
'use client'

import { useState, useRef } from 'react'
import { Check } from 'lucide-react'

interface ColorPickerProps {
  value?: string
  onChange: (color: string) => void
  size?: 'sm' | 'md' | 'lg'
}

export function ColorPicker({ value, onChange, size = 'md' }: ColorPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localColor, setLocalColor] = useState(value || '#3b82f6')

  // 尺寸映射
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  }

  const handleClick = () => {
    inputRef.current?.click()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value
    setLocalColor(newColor)
    onChange(newColor)
  }

  // 将颜色转换为 CSS 可用的格式
  const getBackgroundStyle = (): React.CSSProperties => {
    if (!value && !localColor) {
      return { backgroundColor: '#3b82f6' }
    }

    const colorToUse = value || localColor

    // 检查是否是 HSL 格式（如 "217 91% 60%"）
    if (colorToUse.match(/^\d+\s+\d+%\s+\d+%$/)) {
      return { backgroundColor: `hsl(${colorToUse})` }
    }

    // 默认当作 HEX 处理
    return { backgroundColor: colorToUse }
  }

  return (
    <div className="relative inline-flex items-center">
      {/* 隐藏的原生颜色输入框 */}
      <input
        ref={inputRef}
        type="color"
        value={localColor}
        onChange={handleChange}
        className="absolute inset-0 opacity-0 cursor-pointer"
        style={{ width: 0, height: 0 }}
      />

      {/* 可见的颜色指示器 */}
      <button
        type="button"
        onClick={handleClick}
        className={`${sizeClasses[size]} rounded-full border-2 border-white/20 hover:border-white/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50`}
        style={getBackgroundStyle()}
        aria-label="选择颜色"
      >
        {value && (
          <Check className="w-full h-full text-white/80" style={{ fontSize: '10px' }} />
        )}
      </button>
    </div>
  )
}

/**
 * 将 HEX 颜色转换为 HSL 格式（用于存储到数据库）
 * @param hex - HEX 格式的颜色值（如 "#3b82f6"）
 * @returns HSL 格式的颜色值（如 "217 91% 60%"）
 */
export function hexToHsl(hex: string): string {
  // 移除 # 前缀
  const cleanHex = hex.replace('#', '')

  // 转换为 RGB
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

/**
 * 将 HSL 颜色转换为 HEX 格式（用于颜色选择器）
 * @param hsl - HSL 格式的颜色值（如 "217 91% 60%"）
 * @returns HEX 格式的颜色值（如 "#3b82f6"）
 */
export function hslToHex(hsl: string): string {
  // 解析 HSL 值
  const [h, s, l] = hsl.split(' ').map((v) => parseFloat(v.replace('%', '')))

  // 转换为 RGB
  const c = (1 - Math.abs(2 * l - 1)) * (s / 100)
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2

  let r = 0
  let g = 0
  let b = 0

  if (h < 60) {
    r = c
    g = x
  } else if (h < 120) {
    r = x
    g = c
  } else if (h < 180) {
    g = c
    b = x
  } else if (h < 240) {
    g = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  const toHex = (v: number) => {
    const hex = Math.round((v + m) * 255).toString(16)
    return hex.length === 1 ? `0${hex}` : hex
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
