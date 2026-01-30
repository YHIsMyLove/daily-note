/**
 * Media Query React Hook
 *
 * 功能：
 * - 监听媒体查询变化
 * - 响应式断点检测
 * - 支持自定义查询条件
 */
import { useEffect, useState, useCallback } from 'react'

/**
 * useMediaQuery Hook 返回值
 */
interface UseMediaQueryReturn {
  matches: boolean
}

/**
 * useMediaQuery Hook
 *
 * 用于监听媒体查询变化的 React Hook
 *
 * @param query - CSS 媒体查询字符串（例如："(max-width: 768px)"）
 * @returns 返回包含 matches 属性的对象，表示当前是否匹配查询条件
 *
 * @example
 * ```tsx
 * const isMobile = useMediaQuery('(max-width: 768px)')
 * const isDesktop = useMediaQuery('(min-width: 768px)')
 * ```
 */
export function useMediaQuery(query: string): UseMediaQueryReturn {
  const [matches, setMatches] = useState<boolean>(() => {
    // 初始化时检查匹配状态
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia(query)
      return mediaQuery.matches
    }
    return false
  })

  useEffect(() => {
    // 跳过 SSR
    if (typeof window === 'undefined') {
      return
    }

    let mounted = true

    // 创建媒体查询监听器
    const mediaQuery = window.matchMedia(query)

    // 处理匹配状态变化
    const handleChange = (event: MediaQueryListEvent) => {
      if (mounted) {
        setMatches(event.matches)
      }
    }

    // 添加监听器
    // 使用 addEventListener 替代 deprecated 的 addListener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
    } else {
      // 降级到旧版 API
      mediaQuery.addListener(handleChange)
    }

    // 初始化匹配状态
    setMatches(mediaQuery.matches)

    // 清理函数
    return () => {
      mounted = false
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange)
      } else {
        // 降级到旧版 API
        mediaQuery.removeListener(handleChange)
      }
    }
  }, [query])

  return {
    matches,
  }
}

/**
 * 预设的响应式断点 Hook
 *
 * @example
 * ```tsx
 * const isMobile = useIsMobile() // < 768px
 * ```
 */
export function useIsMobile(): UseMediaQueryReturn {
  return useMediaQuery('(max-width: 767.9px)')
}

/**
 * 预设的桌面断点 Hook
 *
 * @example
 * ```tsx
 * const isDesktop = useIsDesktop() // >= 768px
 * ```
 */
export function useIsDesktop(): UseMediaQueryReturn {
  return useMediaQuery('(min-width: 768px)')
}
