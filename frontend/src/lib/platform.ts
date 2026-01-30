/**
 * 平台检测模块
 * 检测当前运行平台（桌面/移动/Web）
 */

export type Platform = 'desktop' | 'android' | 'ios' | 'web'

/**
 * 检测是否在 Tauri 环境中运行
 * 使用多种方式检测，避免模块加载时 Tauri API 未初始化的问题
 */
export const isTauriEnvironment = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }

  // 方式1: 检查 __TAURI__ 对象
  // @ts-ignore - Tauri API
  if (window.__TAURI__) {
    return true
  }

  // 方式2: 检查 __TAURI_INTERNALS__ （更底层的 API）
  // @ts-ignore - Tauri internal API
  if (window.__TAURI_INTERNALS__) {
    return true
  }

  // 方式3: 检查 Tauri 特定的全局标识
  // @ts-ignore
  if (window.__TAURI_METADATA__) {
    return true
  }

  return false
}

/**
 * 获取当前平台
 */
export const getPlatform = (): Platform => {
  if (typeof window !== 'undefined') {
    // 使用更可靠的 Tauri 环境检测
    if (isTauriEnvironment()) {
      // @ts-ignore - Tauri API
      const platform = window.__TAURI__?.platform
      if (platform === 'android') return 'android'
      if (platform === 'ios') return 'ios'
      return 'desktop'
    }
    return 'web'
  }
  return 'desktop' // SSR 默认
}

/**
 * 是否为移动端
 */
export const isMobile = (): boolean => {
  const platform = getPlatform()
  return platform === 'android' || platform === 'ios'
}

/**
 * 是否为桌面端
 */
export const isDesktop = (): boolean => {
  return getPlatform() === 'desktop'
}

/**
 * 是否为 Web
 */
export const isWeb = (): boolean => {
  return getPlatform() === 'web'
}
