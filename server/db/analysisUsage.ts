import db from './connection.js'
import { getLocalDate } from './connection.js'

export function ensureAnalysisUsageTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS analysis_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      user_type TEXT NOT NULL DEFAULT 'guest',
      usage_count INTEGER NOT NULL DEFAULT 0,
      total_usage INTEGER NOT NULL DEFAULT 0,
      last_reset_date TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      UNIQUE(user_id)
    )
  `)

  try {
    db.exec(`ALTER TABLE analysis_usage ADD COLUMN total_usage INTEGER NOT NULL DEFAULT 0`)
  } catch { /* column exists */ }
}

const GUEST_DAILY_LIMIT = 3
const USER_DAILY_LIMIT = 9

export interface AnalysisUsageRecord {
  id: number
  user_id: string
  user_type: string
  usage_count: number
  total_usage: number
  last_reset_date: string
}

function getRecord(userId: string): AnalysisUsageRecord | undefined {
  return db.prepare('SELECT * FROM analysis_usage WHERE user_id = ?').get(userId) as AnalysisUsageRecord | undefined
}

function createRecord(userId: string, userType: string): void {
  const today = getLocalDate()
  db.prepare(
    'INSERT INTO analysis_usage (user_id, user_type, usage_count, total_usage, last_reset_date) VALUES (?, ?, 0, 0, ?)'
  ).run(userId, userType, today)
}

export function getAnalysisUsage(userId: string, userType: 'guest' | 'registered'): {
  used: number
  limit: number
  totalUsed: number
} {
  const limit = userType === 'registered' ? USER_DAILY_LIMIT : GUEST_DAILY_LIMIT
  const today = getLocalDate()
  let record = getRecord(userId)

  if (!record) {
    createRecord(userId, userType)
    return { used: 0, limit, totalUsed: 0 }
  }

  if (record.last_reset_date !== today) {
    db.prepare(
      `UPDATE analysis_usage SET usage_count = 0, last_reset_date = ?, updated_at = strftime('%s', 'now') WHERE user_id = ?`
    ).run(today, userId)
    return { used: 0, limit, totalUsed: record.total_usage }
  }

  return { used: record.usage_count, limit, totalUsed: record.total_usage }
}

export function incrementAnalysisUsage(userId: string): boolean {
  const today = getLocalDate()
  const record = getRecord(userId)

  if (!record) return false

  const limit = record.user_type === 'registered' ? USER_DAILY_LIMIT : GUEST_DAILY_LIMIT
  if (record.last_reset_date !== today) {
    db.prepare(
      `UPDATE analysis_usage SET usage_count = 1, total_usage = total_usage + 1, last_reset_date = ?, updated_at = strftime('%s', 'now') WHERE user_id = ?`
    ).run(today, userId)
    return true
  }

  if (record.usage_count >= limit) {
    return false
  }

  db.prepare(
    `UPDATE analysis_usage SET usage_count = usage_count + 1, total_usage = total_usage + 1, updated_at = strftime('%s', 'now') WHERE user_id = ?`
  ).run(userId)
  return true
}
