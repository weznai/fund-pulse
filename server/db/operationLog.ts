import db from './connection.js'
import { getLocalDate } from './connection.js'

export function ensureOperationLogTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL DEFAULT '',
      ip TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      extra TEXT,
      created_at INTEGER NOT NULL
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_oplog_action ON operation_logs (action)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_oplog_created ON operation_logs (created_at)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_oplog_username ON operation_logs (username)`)
}

export interface OperationLog {
  id: number
  username: string
  ip: string
  action: string
  description: string
  extra: string | null
  created_at: number
}

export interface OperationLogListResult {
  logs: OperationLog[]
  total: number
}

export function addOperationLog(log: {
  username: string
  ip: string
  action: string
  description: string
  extra?: string
}): void {
  db.prepare(
    `INSERT INTO operation_logs (username, ip, action, description, extra, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(log.username, log.ip, log.action, log.description, log.extra || null, Date.now())
}

export interface OperationLogQuery {
  page: number
  pageSize: number
  action?: string
  username?: string
  startDate?: string
  endDate?: string
}

export function getOperationLogList(query: OperationLogQuery): OperationLogListResult {
  const conditions: string[] = []
  const params: any[] = []

  if (query.action) {
    conditions.push('action = ?')
    params.push(query.action)
  }
  if (query.username) {
    conditions.push('username LIKE ?')
    params.push(`%${query.username}%`)
  }
  if (query.startDate) {
    conditions.push("date(created_at / 1000, 'unixepoch') >= ?")
    params.push(query.startDate)
  }
  if (query.endDate) {
    conditions.push("date(created_at / 1000, 'unixepoch') <= ?")
    params.push(query.endDate)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM operation_logs ${where}`).get(...params) as { total: number }
  const total = countRow.total

  const offset = (query.page - 1) * query.pageSize
  const logs = db.prepare(
    `SELECT * FROM operation_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, query.pageSize, offset) as OperationLog[]

  return { logs, total }
}
