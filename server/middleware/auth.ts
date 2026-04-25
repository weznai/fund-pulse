import express from 'express'
import crypto from 'crypto'
import { logger } from '../logger.js'
import config from '../config/index.js'

export function validateAdminToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return res.status(401).json({ error: '请先登录' })
  }

  try {
    const decoded = Buffer.from(token, 'base64').toString()
    const [prefix, timestamp] = decoded.split(':')
    
    if (prefix !== 'admin' || !timestamp) {
      return res.status(401).json({ error: '无效的认证信息' })
    }

    const tokenTime = parseInt(timestamp, 10)
    const maxAge = 24 * 60 * 60 * 1000
    if (Date.now() - tokenTime > maxAge) {
      return res.status(401).json({ error: '登录已过期，请重新登录' })
    }

    next()
  } catch {
    res.status(401).json({ error: '无效的认证信息' })
  }
}

export function handleAdminLogin(req: express.Request, res: express.Response) {
  try {
    const { password } = req.body

    if (!password) {
      return res.status(400).json({ success: false, message: '请输入密码' })
    }

    if (password === config.security.adminPassword) {
      const token = Buffer.from(`admin:${Date.now()}`).toString('base64')
      res.json({ success: true, token })
    } else {
      res.status(401).json({ success: false, message: '密码错误' })
    }
  } catch (error) {
    logger.error('登录失败:', error)
    res.status(500).json({ success: false, message: '登录失败' })
  }
}

export function adminAuthGuard(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.path === '/login') {
    return next()
  }
  validateAdminToken(req, res, next)
}

const SALT_ROUNDS = 10

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, SALT_ROUNDS, 64, 'sha512')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, hashedPassword: string): boolean {
  const [salt, hash] = hashedPassword.split(':')
  if (!salt || !hash) return false
  
  const verifyHash = crypto.pbkdf2Sync(password, salt, SALT_ROUNDS, 64, 'sha512')
  return hash === verifyHash
}
