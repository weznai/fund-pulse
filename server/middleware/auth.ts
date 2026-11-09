import express from 'express'
import crypto from 'crypto'
import { logger } from '../logger.js'
import config from '../config/index.js'
import { verifyPassword } from '../services/password.js'
import { getAdminUserByUsername, touchAdminUserLogin, type AdminRole } from '../db/adminUser.js'

/**
 * 后台管理员认证
 *
 * Token 两种格式：
 *   1. 新格式（带签名，携带身份）: base64url(JSON{u,r,t}) + '.' + HMAC-SHA256
 *   2. 旧格式（兼容）: base64("admin:" + timestamp)，视为内置超管（env 密码登录）
 *
 * 登录方式：
 *   - username 为空或 'admin'：比对 env ADMIN_PASSWORD（内置超管，角色 super）
 *   - 其他：查 admin_users 表，PBKDF2 校验（角色见 admin_users.role）
 */

export interface AdminIdentity {
  username: string
  role: AdminRole
}

const TOKEN_TTL = 24 * 60 * 60 * 1000

function adminTokenSecret(): string {
  return process.env.ADMIN_TOKEN_SECRET || process.env.SESSION_SECRET || 'fund-pulse-admin-secret-key'
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', adminTokenSecret()).update(payload).digest('base64url')
}

export function issueAdminToken(username: string, role: AdminRole): string {
  const payload = Buffer.from(JSON.stringify({ u: username, r: role, t: Date.now() })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

function parseAdminToken(token: string): AdminIdentity | null {
  try {
    // 新格式：签名校验
    const dotIndex = token.indexOf('.')
    if (dotIndex > 0) {
      const payload = token.slice(0, dotIndex)
      const signature = token.slice(dotIndex + 1)
      const expected = sign(payload)
      const a = Buffer.from(signature)
      const b = Buffer.from(expected)
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

      const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
      if (!data.u || (data.r !== 'super' && data.r !== 'news') || !Number.isInteger(data.t)) return null
      if (Date.now() - data.t > TOKEN_TTL) return null
      return { username: String(data.u), role: data.r }
    }

    // 旧格式：base64("admin:" + timestamp)，视为内置超管
    const decoded = Buffer.from(token, 'base64').toString()
    const [prefix, timestamp] = decoded.split(':')
    if (prefix !== 'admin' || !timestamp) return null
    const tokenTime = parseInt(timestamp, 10)
    if (Date.now() - tokenTime > TOKEN_TTL) return null
    return { username: 'admin', role: 'super' }
  } catch {
    return null
  }
}

/** 认证任意后台账号（super / news），通过后挂 res.locals.adminUser */
export function validateAdminToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    return res.status(401).json({ error: '请先登录' })
  }

  const identity = parseAdminToken(token)
  if (!identity) {
    return res.status(401).json({ error: '登录已过期或无效，请重新登录' })
  }

  res.locals.adminUser = identity
  next()
}

/** 仅超管可访问（基金/用户/系统等管理接口） */
export function requireSuperAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  validateAdminToken(req, res, (err?: unknown) => {
    if (err) return next(err)
    const identity = res.locals.adminUser as AdminIdentity | undefined
    if (identity?.role !== 'super') {
      return res.status(403).json({ error: '无权限访问该功能' })
    }
    next()
  })
}

export function handleAdminLogin(req: express.Request, res: express.Response) {
  try {
    const { username, password } = req.body || {}

    if (!password) {
      return res.status(400).json({ success: false, message: '请输入密码' })
    }

    // 内置超管：用户名留空或 admin，走 env 密码
    if (!username || String(username).trim() === 'admin') {
      if (password === config.security.adminPassword) {
        const token = Buffer.from(`admin:${Date.now()}`).toString('base64')
        return res.json({ success: true, token, username: 'admin', role: 'super', label: '超级管理员' })
      }
      return res.status(401).json({ success: false, message: '密码错误' })
    }

    // 后台账号：查 admin_users 表
    const name = String(username).trim()
    const user = getAdminUserByUsername(name)
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ success: false, message: '账号或密码错误' })
    }
    if (user.disabled) {
      return res.status(403).json({ success: false, message: '该账号已被禁用' })
    }

    touchAdminUserLogin(user.id)
    logger.log(`[后台登录] ${name} (${user.role})`)
    res.json({
      success: true,
      token: issueAdminToken(name, user.role),
      username: name,
      role: user.role,
      label: user.label
    })
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
