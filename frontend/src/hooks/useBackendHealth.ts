/**
 * 后端健康检测 Hook
 * 定期检查后端服务是否可用
 */
import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { getApiBase } from '@/lib/api'

export type BackendHealthStatus = 'checking' | 'healthy' | 'unhealthy' | 'unknown'

export interface BackendHealthState {
  status: BackendHealthStatus
  latency?: number
  error?: string
  lastChecked?: Date
}

export function useBackendHealth(checkInterval = 30000) {
  const [healthState, setHealthState] = useState<BackendHealthState>({
    status: 'checking',
  })

  const checkHealth = useCallback(async () => {
    const startTime = Date.now()
    try {
      const apiBase = getApiBase()
      const response = await axios.get(`${apiBase}/health`, {
        timeout: 5000,
      })
      const latency = Date.now() - startTime

      setHealthState({
        status: response.data?.status === 'ok' ? 'healthy' : 'unknown',
        latency,
        lastChecked: new Date(),
      })
    } catch (error) {
      setHealthState({
        status: 'unhealthy',
        error: axios.isAxiosError(error)
          ? error.code === 'ECONNREFUSED'
            ? '后端服务未启动，请运行 pnpm dev:backend'
            : error.message
          : '未知错误',
        lastChecked: new Date(),
      })
    }
  }, [])

  useEffect(() => {
    checkHealth()
    const interval = setInterval(checkHealth, checkInterval)
    return () => clearInterval(interval)
  }, [checkHealth, checkInterval])

  return {
    ...healthState,
    checkHealth,
    isHealthy: healthState.status === 'healthy',
    isUnhealthy: healthState.status === 'unhealthy',
  }
}
