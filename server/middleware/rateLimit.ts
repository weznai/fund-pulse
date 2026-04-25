import { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/errors.js'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  message?: string
}

interface RequestLog {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RequestLog>()

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 100,
  message: '请求过于频繁，请稍后再试'
}

const configs: Record<string, RateLimitConfig> = {
  '/api/auth/login': { windowMs: 60 * 1000, maxRequests: 200, message: '登录尝试次数过多，请1分钟后再试' },
  '/api/auth/register': { windowMs: 60 * 60 * 1000, maxRequests: 50, message: '注册请求过于频繁，请1小时后再试' },
  '/api/auth/send-otp': { windowMs: 60 * 1000, maxRequests: 20, message: '验证码发送过于频繁，请1分钟后再试' },
  '/api/admin/login': { windowMs: 60 * 1000, maxRequests: 200, message: '管理员登录尝试次数过多，请1分钟后再试' }
}

function getClientIdentifier(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  const ip = forwarded 
    ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0])
    : req.socket.remoteAddress || 'unknown'
  
  const userAgent = req.headers['user-agent'] || ''
  return `${ip}:${userAgent}`.substring(0, 200)
}

function getConfig(path: string): RateLimitConfig {
  for (const [key, config] of Object.entries(configs)) {
    if (path.startsWith(key)) {
      return config
    }
  }
  return defaultConfig
}

function cleanExpiredEntries(): void {
  const now = Date.now()
  for (const [key, log] of rateLimitStore.entries()) {
    if (now > log.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const clientId = getClientIdentifier(req)
  const config = getConfig(req.path)
  const key = `${clientId}:${req.path}`
  const now = Date.now()
  
  cleanExpiredEntries()
  
  let log = rateLimitStore.get(key)
  
  if (!log || now > log.resetTime) {
    log = {
      count: 0,
      resetTime: now + config.windowMs
    }
    rateLimitStore.set(key, log)
  }
  
  log.count++
  
  const remaining = config.maxRequests - log.count
  const resetTimeSeconds = Math.ceil((log.resetTime - now) / 1000)
  
  res.setHeader('X-RateLimit-Limit', config.maxRequests.toString())
  res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining).toString())
  res.setHeader('X-RateLimit-Reset', resetTimeSeconds.toString())
  
  if (log.count > config.maxRequests) {
    res.setHeader('Retry-After', resetTimeSeconds.toString())
    throw new AppError(config.message || '请求过于频繁', 429, 'RATE_LIMIT_EXCEEDED', {
      retryAfter: resetTimeSeconds
    })
  }
  
  next()
}

export function createRateLimitMiddleware(customConfig: Partial<RateLimitConfig>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const config = { ...defaultConfig, ...customConfig }
    const clientId = getClientIdentifier(req)
    const key = `${clientId}:${req.path}`
    const now = Date.now()
    
    let log = rateLimitStore.get(key)
    
    if (!log || now > log.resetTime) {
      log = {
        count: 0,
        resetTime: now + config.windowMs
      }
      rateLimitStore.set(key, log)
    }
    
    log.count++
    
    if (log.count > config.maxRequests) {
      throw new AppError(config.message || '请求过于频繁', 429, 'RATE_LIMIT_EXCEEDED')
    }
    
    next()
  }
}
