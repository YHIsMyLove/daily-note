/**
 * Daily Note 后端服务
 * Fastify + Prisma + Claude API
 */
import Fastify from 'fastify'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { notesRoutes } from './api/routes/notes'
import { categoriesRoutes } from './api/routes/categories'
import { statsRoutes } from './api/routes/stats'
import { tasksRoutes } from './api/routes/tasks'
import { sseRoutes } from './api/routes/sse'
import { promptsRoutes } from './api/routes/prompts'
import summariesRoutes from './api/routes/summaries'
import { queueManager } from './queue/queue-manager'
import { executeNoteClassification } from './queue/executors/note-classifier.executor'
import { executeSummaryAnalysis } from './queue/executors/summary-analyzer.executor'
import { promptService } from './services/prompt.service'

// 获取当前文件所在目录
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 便携式环境变量加载：从多个位置尝试加载 .env 文件
const envPaths = [
  path.join(process.cwd(), '.env'),           // exe 同级目录（便携模式优先）
  path.join(__dirname, '../.env'),            // 开发环境
  path.join(__dirname, '../../../.env'),      // 备用路径
]

let envLoaded = false
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    console.log(`[Config] Loading .env from: ${envPath}`)
    dotenv.config({ path: envPath })
    envLoaded = true
    break
  }
}

if (!envLoaded) {
  console.warn('[Config] No .env file found, using default values')
}

// 创建 Fastify 实例
const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
})

// 注册 CORS（支持多个 origin）
const allowedOrigins = [
  'http://localhost:3000',  // 开发模式
  'http://tauri.localhost', // Tauri 打包后
]

fastify.register(cors, {
  origin: (origin, callback) => {
    // 允许没有 origin 的请求（比如服务器端请求、某些移动端请求）
    if (!origin) {
      return callback(null, true)
    }

    // 检查 origin 是否在允许列表中
    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
})

// 注册 Swagger 文档
fastify.register(swagger, {
  openapi: {
    info: {
      title: 'Daily Note API',
      description: '零碎笔记自动整理系统 API',
      version: '1.0.0',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3001}`,
        description: 'Development server',
      },
    ],
  },
})

fastify.register(swaggerUI, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false,
  },
  uiHooks: {
    onRequest: function (request, reply, next) {
      next()
    },
    preHandler: function (request, reply, next) {
      next()
    },
  },
  staticCSP: true,
  transformStaticCSP: (header) => header,
  transformSpecification: (swaggerObject, request, reply) => {
    return swaggerObject
  },
  transformSpecificationClone: true,
})

// 注册路由
fastify.register(notesRoutes)
fastify.register(categoriesRoutes)
fastify.register(statsRoutes)
fastify.register(tasksRoutes)
fastify.register(sseRoutes)
fastify.register(promptsRoutes, { prefix: '/api/prompts' })
fastify.register(summariesRoutes, { prefix: '/api/summaries' })

// 健康检查
fastify.get('/health', async () => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
  }
})

// 启动服务
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001')
    const host = process.env.HOST || '0.0.0.0'

    // ========== 环境配置验证 ==========
    console.log('\n═══════════════════════════════════════════════════════')
    console.log('Claude API Configuration:')
    console.log('═══════════════════════════════════════════════════════')

    // 检查配置来源（settings.json 或环境变量）
    const { getApiKey: checkApiKey, getBaseUrl: checkBaseUrl } = await import('./config/claude-config')

    try {
      const apiKey = checkApiKey()
      const baseUrl = checkBaseUrl()

      console.log(`API Key: ${apiKey.slice(0, 20)}...${apiKey.slice(-4)}`)
      console.log(`Base URL: ${baseUrl || '(default Anthropic API)'}`)
    } catch (error) {
      console.error('❌ Configuration Error:', (error as Error).message)
      console.error('   请在 Claude Code settings.json 或 .env 文件中配置 API Key')
      process.exit(1)
    }

    // 检查数据库
    const dbUrl = process.env.DATABASE_URL
    console.log(`DATABASE_URL: ${dbUrl || '(not set)'}`)

    console.log(`PORT: ${port}`)
    console.log(`CORS_ORIGIN: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`)
    console.log('═══════════════════════════════════════════════════════\n')

    // 注册任务执行器
    queueManager.registerExecutor('classify_note', {
      type: 'classify_note',
      execute: executeNoteClassification,
    })
    queueManager.registerExecutor('summary_analyzer', {
      type: 'summary_analyzer',
      execute: executeSummaryAnalysis,
    })

    // 启动队列管理器
    await queueManager.start()

    // 初始化默认提示词模板
    console.log('[PromptService] Initializing default prompt templates...')
    await promptService.initializeDefaults()
    console.log('[PromptService] Default prompt templates initialized')

    await fastify.listen({ port, host })

    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║              📝 Daily Note Backend Server                  ║
║                                                            ║
║              Server running on port ${port}                   ║
║              Health: http://localhost:${port}/health           ║
║              API Docs: http://localhost:${port}/docs            ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

// 优雅关闭
const gracefulShutdown = async () => {
  await queueManager.stop()
  await fastify.close()
  console.log('Server closed')
  process.exit(0)
}

process.on('SIGINT', gracefulShutdown)
process.on('SIGTERM', gracefulShutdown)

// 启动
start()
