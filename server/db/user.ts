import db from './connection.js'
import { setCurrentUserId, userContext } from './connection.js'
import type { UserId } from './connection.js'
import { logger } from '../logger.js'

export interface RegisterUser {
  id: string
  username: string
  email: string
  password: string
  type: string
  label?: string
  emailVerified: boolean
  disabled: boolean
  createdAt: number
  lastActive: number
}

export function isUsernameExists(username: string): boolean {
  const stmt = db.prepare('SELECT 1 FROM users WHERE username = ?')
  return !!stmt.get(username)
}

export function isEmailExists(email: string): boolean {
  const stmt = db.prepare('SELECT 1 FROM users WHERE email = ?')
  return !!stmt.get(email)
}

export function getUserByUsername(username: string): RegisterUser | null {
  const stmt = db.prepare(`
    SELECT id, username, email, password, type, label, email_verified, disabled, created_at, last_active
    FROM users WHERE username = ?
  `)
  const result = stmt.get(username) as any

  if (result) {
    return {
      id: result.id,
      username: result.username,
      email: result.email,
      password: result.password,
      type: result.type,
      label: result.label || undefined,
      emailVerified: Boolean(result.email_verified),
      disabled: Boolean(result.disabled),
      createdAt: result.created_at,
      lastActive: result.last_active
    }
  }
  return null
}

export function getUserByEmail(email: string): RegisterUser | null {
  const stmt = db.prepare(`
    SELECT id, username, email, password, type, label, email_verified, disabled, created_at, last_active
    FROM users WHERE email = ?
  `)
  const result = stmt.get(email) as any

  if (result) {
    return {
      id: result.id,
      username: result.username,
      email: result.email,
      password: result.password,
      type: result.type,
      label: result.label || undefined,
      emailVerified: Boolean(result.email_verified),
      disabled: Boolean(result.disabled),
      createdAt: result.created_at,
      lastActive: result.last_active
    }
  }
  return null
}

export function getUserByUsernameOrEmail(identifier: string): RegisterUser | null {
  let user = getUserByUsername(identifier)
  if (user) return user
  user = getUserByEmail(identifier)
  return user
}

export function createUser(user: {
  username: string
  email: string
  password: string
  emailVerified?: boolean
}): RegisterUser {
  const now = Date.now()
  const id = user.username
  const verified = user.emailVerified ? 1 : 0

  const stmt = db.prepare(`
    INSERT INTO users (id, username, email, password, type, label, email_verified, created_at, last_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(id, user.username, user.email, user.password, 'email', user.username, verified, now, now)

  logger.log(`👤 创建新用户: ${user.username} (${user.email})`)

  return {
    id,
    username: user.username,
    email: user.email,
    password: user.password,
    type: 'email',
    label: user.username,
    emailVerified: verified === 1,
    disabled: false,
    createdAt: now,
    lastActive: now
  }
}

export function verifyUserEmail(userId: string): boolean {
  const now = Date.now()
  const stmt = db.prepare(`
    UPDATE users SET email_verified = 1, last_active = ? WHERE id = ?
  `)
  const result = stmt.run(now, userId)
  return result.changes > 0
}

export function updateUserLastActive(userId: string): void {
  const now = Date.now()
  db.prepare('UPDATE users SET last_active = ? WHERE id = ?').run(now, userId)
}

export function updateUserPassword(userId: string, password: string): boolean {
  const stmt = db.prepare('UPDATE users SET password = ? WHERE id = ?')
  const result = stmt.run(password, userId)
  return result.changes > 0
}

export function isUserLabelExists(label: string, excludeUserId?: string): boolean {
  if (!label || !label.trim()) return false
  const trimmedLabel = label.trim()

  let stmt
  let result

  if (excludeUserId) {
    stmt = db.prepare('SELECT id FROM users WHERE label = ? AND id != ?')
    result = stmt.get(trimmedLabel, excludeUserId)
  } else {
    stmt = db.prepare('SELECT id FROM users WHERE label = ?')
    result = stmt.get(trimmedLabel)
  }

  return !!result
}

export function updateUserLabel(userId: string, label: string): boolean {
  const trimmedLabel = label?.trim() || null
  const stmt = db.prepare('UPDATE users SET label = ? WHERE id = ?')
  const result = stmt.run(trimmedLabel, userId)
  return result.changes > 0
}

export function setUserDisabled(userId: string, disabled: boolean): boolean {
  const stmt = db.prepare('UPDATE users SET disabled = ? WHERE id = ?')
  const result = stmt.run(disabled ? 1 : 0, userId)
  if (result.changes > 0) {
    logger.log(`👤 用户 ${userId} 已${disabled ? '禁用' : '启用'}`)
    return true
  }
  return false
}

export function getUserById(userId: string): RegisterUser | null {
  const stmt = db.prepare(`
    SELECT id, username, email, password, type, label, email_verified, disabled, created_at, last_active
    FROM users WHERE id = ?
  `)
  const result = stmt.get(userId) as any

  if (result) {
    return {
      id: result.id,
      username: result.username,
      email: result.email,
      password: result.password,
      type: result.type,
      label: result.label || undefined,
      emailVerified: Boolean(result.email_verified),
      disabled: Boolean(result.disabled),
      createdAt: result.created_at,
      lastActive: result.last_active
    }
  }
  return null
}

export function fixUsersDataIntegrity(): void {
  try {
    const deleteResult = db.prepare(`
      DELETE FROM users WHERE id LIKE 'M-%'
    `).run()

    if (deleteResult.changes > 0) {
      logger.log(`🔧 已清理 ${deleteResult.changes} 个机器ID用户`)
    }

    const fixResult = db.prepare(`
      UPDATE users 
      SET email = id,
          username = COALESCE(NULLIF(username, ''), SUBSTR(id, 1, INSTR(id, '@') - 1)),
          email_verified = CASE WHEN password IS NOT NULL AND password != '' THEN 1 ELSE email_verified END
      WHERE (email IS NULL OR email = '')
      AND id LIKE '%@%.%'
    `).run()

    if (fixResult.changes > 0) {
      logger.log(`🔧 已修复 ${fixResult.changes} 个用户的邮箱数据`)
    }
  } catch (error) {
    logger.error('修复用户数据完整性失败:', error)
  }
}

export function getAllUsers(): Array<{ id: string; type: string; email: string | null; label: string | null; disabled: boolean; created_at: number; last_active: number }> {
  const stmt = db.prepare('SELECT id, type, email, label, disabled, created_at, last_active FROM users ORDER BY last_active DESC')
  return stmt.all() as any[]
}

export function getUserByOpenId(openid: string): RegisterUser | null {
  const stmt = db.prepare(`
    SELECT id, username, email, password, type, label, email_verified, disabled, created_at, last_active
    FROM users WHERE wechat_openid = ?
  `)
  const result = stmt.get(openid) as any
  if (result) {
    return {
      id: result.id,
      username: result.username,
      email: result.email,
      password: result.password,
      type: result.type,
      label: result.label || undefined,
      emailVerified: Boolean(result.email_verified),
      disabled: Boolean(result.disabled),
      createdAt: result.created_at,
      lastActive: result.last_active
    }
  }
  return null
}

export function createWechatUser(openid: string, nickname?: string): RegisterUser {
  const now = Date.now()
  const username = 'wx_' + openid.substring(0, 12)
  const id = username
  const email = `${username}@wechat.local`

  const stmt = db.prepare(`
    INSERT INTO users (id, username, email, password, type, label, email_verified, wechat_openid, created_at, last_active)
    VALUES (?, ?, ?, '', 'wechat', ?, 1, ?, ?, ?)
  `)

  stmt.run(id, username, email, nickname || username, openid, now, now)

  logger.log(`👤 创建微信用户: ${username} (openid: ${openid.substring(0, 8)}...)`)

  return {
    id,
    username,
    email,
    password: '',
    type: 'wechat',
    label: nickname || username,
    emailVerified: true,
    disabled: false,
    createdAt: now,
    lastActive: now
  }
}

export function bindWechatOpenId(userId: string, openid: string): boolean {
  const stmt = db.prepare('UPDATE users SET wechat_openid = ? WHERE id = ?')
  const result = stmt.run(openid, userId)
  return result.changes > 0
}

export function switchUser(userId: string): boolean {
  const stmt = db.prepare('SELECT id, username, type, label FROM users WHERE id = ? OR username = ? OR email = ?')
  const user = stmt.get(userId, userId, userId) as { id: string; username: string; type: string; label: string } | undefined

  if (user) {
    setCurrentUserId({
      id: user.id,
      type: 'registered' as any,
      label: user.label || undefined
    })
    return true
  }

  return false
}
