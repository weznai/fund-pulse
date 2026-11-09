import db from './connection.js'
import { logger } from '../logger.js'
import { hashPassword } from '../services/password.js'

/**
 * 管理后台账号表
 * role: 'super' = 超级管理员（全部权限，另有 env 密码的内置超管，不入库）
 *       'news'  = 资讯维护（仅 /api/admin/news* 与对应页面）
 * password: PBKDF2 "salt:hash"（services/password.ts）
 */
export type AdminRole = 'super' | 'news'

export const ADMIN_ROLES: Record<AdminRole, string> = {
  super: '超级管理员',
  news: '资讯维护'
}

export interface AdminUser {
  id: number
  username: string
  password: string
  role: AdminRole
  label: string
  disabled: number
  last_login_at: number | null
  created_at: number
}

export type AdminUserSummary = Omit<AdminUser, 'password'>

const SUMMARY_FIELDS = 'id, username, role, label, disabled, last_login_at, created_at'

export function ensureAdminUsersTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'news',
      label TEXT NOT NULL DEFAULT '',
      disabled INTEGER NOT NULL DEFAULT 0,
      last_login_at INTEGER,
      created_at INTEGER NOT NULL
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users (role)`)

  // 播种资讯维护账号（仅首次创建，不覆盖已有数据）
  const exists = db.prepare('SELECT id FROM admin_users WHERE username = ?').get('news')
  if (!exists) {
    db.prepare(
      'INSERT INTO admin_users (username, password, role, label, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run('news', hashPassword('news@2026.'), 'news', '资讯维护', Date.now())
    logger.log('[后台账号] 已创建默认资讯维护账号: news')
  }
}

export function getAdminUserList(keyword?: string): AdminUserSummary[] {
  const where = keyword ? 'WHERE username LIKE ? OR label LIKE ?' : ''
  const params = keyword ? [`%${keyword}%`, `%${keyword}%`] : []
  return db.prepare(
    `SELECT ${SUMMARY_FIELDS} FROM admin_users ${where} ORDER BY created_at ASC`
  ).all(...params) as AdminUserSummary[]
}

export function getAdminUserByUsername(username: string): AdminUser | undefined {
  return db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username) as AdminUser | undefined
}

export function getAdminUserById(id: number): AdminUserSummary | undefined {
  return db.prepare(`SELECT ${SUMMARY_FIELDS} FROM admin_users WHERE id = ?`).get(id) as AdminUserSummary | undefined
}

export function isAdminUsernameExists(username: string): boolean {
  return !!db.prepare('SELECT id FROM admin_users WHERE username = ?').get(username)
}

export function createAdminUser(data: {
  username: string
  password: string
  role: AdminRole
  label?: string
}): number {
  const result = db.prepare(
    'INSERT INTO admin_users (username, password, role, label, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(data.username, hashPassword(data.password), data.role, data.label || '', Date.now())
  logger.log(`[后台账号] 新建: ${data.username} (${ADMIN_ROLES[data.role]})`)
  return result.lastInsertRowid as number
}

export function updateAdminUser(id: number, data: {
  role?: AdminRole
  label?: string
  password?: string
}): AdminUserSummary | null {
  const existing = db.prepare('SELECT id FROM admin_users WHERE id = ?').get(id)
  if (!existing) return null

  const sets: string[] = []
  const params: any[] = []
  if (data.role !== undefined) { sets.push('role = ?'); params.push(data.role) }
  if (data.label !== undefined) { sets.push('label = ?'); params.push(data.label) }
  if (data.password !== undefined) { sets.push('password = ?'); params.push(hashPassword(data.password)) }

  if (sets.length > 0) {
    db.prepare(`UPDATE admin_users SET ${sets.join(', ')} WHERE id = ?`).run(...params, id)
  }
  return getAdminUserById(id) || null
}

export function setAdminUserDisabled(id: number, disabled: boolean): AdminUserSummary | null {
  const existing = db.prepare('SELECT id FROM admin_users WHERE id = ?').get(id)
  if (!existing) return null
  db.prepare('UPDATE admin_users SET disabled = ? WHERE id = ?').run(disabled ? 1 : 0, id)
  return getAdminUserById(id) || null
}

export function deleteAdminUser(id: number): AdminUserSummary | null {
  const existing = getAdminUserById(id)
  if (!existing) return null
  db.prepare('DELETE FROM admin_users WHERE id = ?').run(id)
  logger.log(`[后台账号] 删除: ${existing.username}`)
  return existing
}

export function touchAdminUserLogin(id: number): void {
  db.prepare('UPDATE admin_users SET last_login_at = ? WHERE id = ?').run(Date.now(), id)
}

/** 启用状态的某角色账号数（用于保护最后一个可用超管） */
export function countEnabledAdminUsersByRole(role: AdminRole): number {
  return (db.prepare(
    'SELECT COUNT(*) as cnt FROM admin_users WHERE role = ? AND disabled = 0'
  ).get(role) as { cnt: number }).cnt
}
