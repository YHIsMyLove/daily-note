/**
 * 后端服务启动入口
 * 确保环境变量在任何模块导入之前加载
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

// 获取当前文件所在目录
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 便携式环境变量加载：从多个位置尝试加载 .env 文件
const envPaths = [
  path.join(process.cwd(), '.env'),           // exe 同级目录（便携模式优先）
  path.join(__dirname, '../.env'),            // 开发环境: backend/.env
  path.join(__dirname, '../../../.env'),      // 备用路径: 根目录
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

// 确认关键环境变量
console.log(`DATABASE_URL: ${process.env.DATABASE_URL || '(not set)'}`)
console.log(`PORT: ${process.env.PORT || '3001'}`)
console.log(`CORS_ORIGIN: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`)

// 动态导入主应用（此时环境变量已加载）
import('./index.js').catch((err) => {
  console.error('Failed to start application:', err)
  process.exit(1)
})
