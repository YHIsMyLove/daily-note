import fs from 'fs'
import path from 'path'
import os from 'os'

interface ClaudeSettings {
  env?: {
    ANTHROPIC_AUTH_TOKEN?: string
    ANTHROPIC_BASE_URL?: string
    ANTHROPIC_DEFAULT_HAIKU_MODEL?: string
    ANTHROPIC_DEFAULT_SONNET_MODEL?: string
    ANTHROPIC_DEFAULT_OPUS_MODEL?: string
  }
}

/**
 * 从 Claude Code settings.json 读取配置
 * @returns 配置对象，如果读取失败返回 null
 */
export function loadClaudeSettings(): ClaudeSettings | null {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json')

  try {
    const content = fs.readFileSync(settingsPath, 'utf-8')
    return JSON.parse(content) as ClaudeSettings
  } catch (error) {
    // 文件不存在或读取失败
    return null
  }
}

/**
 * 获取 API Key（优先级：settings.json > 环境变量）
 */
export function getApiKey(): string {
  const settings = loadClaudeSettings()
  const settingsKey = settings?.env?.ANTHROPIC_AUTH_TOKEN

  if (settingsKey) {
    console.log('[Config] Using API key from Claude Code settings.json')
    return settingsKey
  }

  // 后备：环境变量
  const envKey = process.env.ANTHROPIC_API_KEY
  if (envKey) {
    console.log('[Config] Using API key from environment variable')
    return envKey
  }

  throw new Error(
    'API Key not found. Please configure in Claude Code settings or set ANTHROPIC_API_KEY environment variable.'
  )
}

/**
 * 获取 Base URL（优先级：settings.json > 环境变量 > undefined）
 */
export function getBaseUrl(): string | undefined {
  const settings = loadClaudeSettings()
  const settingsUrl = settings?.env?.ANTHROPIC_BASE_URL

  if (settingsUrl) {
    console.log(`[Config] Using base URL from Claude Code settings: ${settingsUrl}`)
    return settingsUrl
  }

  // 后备：环境变量
  const envUrl = process.env.ANTHROPIC_BASE_URL
  if (envUrl) {
    console.log(`[Config] Using base URL from environment: ${envUrl}`)
    return envUrl
  }

  console.log('[Config] Using default Anthropic API endpoint')
  return undefined
}
