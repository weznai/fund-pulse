import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { logger } from '../logger.js'

import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const envPath = path.join(__dirname, '../.env')
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
}

interface Config {
  server: {
    port: number
    host: string
    cors: {
      origin: string | string[]
      credentials: boolean
    }
  }
  security: {
    jwtSecret: string
    adminPassword: string
    sessionSecret: string
  }
  database: {
    path: string
  }
  email: {
    smtp: {
      host: string
      port: number
      secure: boolean
      user: string
      pass: string
    }
    from: string
  }
  rateLimit: {
    windowMs: number
    maxRequests: number
  }
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key]
  if (!value && defaultValue === undefined) {
    throw new Error(`环境变量 ${key} 未设置`)
  }
  return value || defaultValue!
}

function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key]
  if (!value && defaultValue === undefined) {
    throw new Error(`环境变量 ${key} 未设置`)
  }
  return value ? parseInt(value, 10) : defaultValue!
}

function getEnvBoolean(key: string, defaultValue?: boolean): boolean {
  const value = process.env[key]
  if (!value && defaultValue === undefined) {
    throw new Error(`环境变量 ${key} 未设置`)
  }
  return value ? value === 'true' : defaultValue!
}

export const config: Config = {
  server: {
    port: getEnvNumber('PORT', 3010),
    host: getEnvVar('HOST', '0.0.0.0'),
    cors: {
      origin: getEnvVar('CORS_ORIGIN', 'http://localhost:5173'),
      credentials: true
    }
  },
  security: {
    jwtSecret: getEnvVar('JWT_SECRET', 'dev-secret-key-change-in-production'),
    adminPassword: getEnvVar('ADMIN_PASSWORD', 'admin123'),
    sessionSecret: getEnvVar('SESSION_SECRET', 'session-secret-key')
  },
  database: {
    path: getEnvVar('DB_PATH', path.join(__dirname, '../db/fund-data.db'))
  },
  email: {
    smtp: {
      host: getEnvVar('SMTP_HOST', 'smtp.qq.com'),
      port: getEnvNumber('SMTP_PORT', 587),
      secure: getEnvBoolean('SMTP_SECURE', false),
      user: getEnvVar('SMTP_USER', ''),
      pass: getEnvVar('SMTP_PASS', '')
    },
    from: getEnvVar('EMAIL_FROM', 'noreply@example.com')
  },
  rateLimit: {
    windowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 60000),
    maxRequests: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100)
  }
}

if (process.env.NODE_ENV === 'production') {
  if (config.security.jwtSecret === 'dev-secret-key-change-in-production') {
    logger.error('⚠️ 生产环境必须设置 JWT_SECRET 环境变量')
    process.exit(1)
  }
  if (config.security.adminPassword === 'admin123') {
    logger.error('⚠️ 生产环境必须设置 ADMIN_PASSWORD 环境变量')
    process.exit(1)
  }
}

export default config
