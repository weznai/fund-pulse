import db from './connection.js'

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

  try {
    db.exec(`ALTER TABLE analysis_usage ADD COLUMN credits INTEGER`)
    // Migrate existing records: set initial credits based on user_type
    db.exec(`UPDATE analysis_usage SET credits = 50 WHERE user_type = 'registered' AND credits IS NULL`)
    db.exec(`UPDATE analysis_usage SET credits = 10 WHERE user_type = 'guest' AND credits IS NULL`)
  } catch { /* column exists */ }
}

const GUEST_INITIAL_CREDITS = 10
const USER_INITIAL_CREDITS = 50

export interface AnalysisUsageRecord {
  id: number
  user_id: string
  user_type: string
  usage_count: number
  total_usage: number
  last_reset_date: string
  credits: number | null
}

function getRecord(userId: string): AnalysisUsageRecord | undefined {
  return db.prepare('SELECT * FROM analysis_usage WHERE user_id = ?').get(userId) as AnalysisUsageRecord | undefined
}

function createRecord(userId: string, userType: string): void {
  const credits = userType === 'registered' ? USER_INITIAL_CREDITS : GUEST_INITIAL_CREDITS
  db.prepare(
    'INSERT INTO analysis_usage (user_id, user_type, usage_count, total_usage, last_reset_date, credits) VALUES (?, ?, 0, 0, ?, ?)'
  ).run(userId, userType, '', credits)
}

export function getAnalysisUsage(userId: string, userType: 'guest' | 'registered'): {
  credits: number
  totalUsed: number
} {
  let record = getRecord(userId)

  if (!record) {
    createRecord(userId, userType)
    const credits = userType === 'registered' ? USER_INITIAL_CREDITS : GUEST_INITIAL_CREDITS
    return { credits, totalUsed: 0 }
  }

  const credits = record.credits ?? (record.user_type === 'registered' ? USER_INITIAL_CREDITS : GUEST_INITIAL_CREDITS)
  return { credits, totalUsed: record.total_usage }
}

export function getAnalysisUsageList(page: number, pageSize: number, keyword?: string): {
  list: Array<{
    id: number
    user_id: string
    user_type: string
    credits: number
    total_usage: number
    created_at: number
    updated_at: number
  }>
  total: number
  registeredCount: number
  guestCount: number
} {
  let whereClause = ''
  const params: any[] = []

  if (keyword) {
    whereClause = 'WHERE user_id LIKE ? OR user_type LIKE ?'
    params.push(`%${keyword}%`, `%${keyword}%`)
  }

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM analysis_usage ${whereClause}`).get(...params) as { total: number }
  const regRow = db.prepare(`SELECT COUNT(*) as cnt FROM analysis_usage ${whereClause ? '(' + whereClause + ') AND' : 'WHERE'} user_type = 'registered'`).get(...params) as { cnt: number }
  const guestRow = db.prepare(`SELECT COUNT(*) as cnt FROM analysis_usage ${whereClause ? '(' + whereClause + ') AND' : 'WHERE'} user_type = 'guest'`).get(...params) as { cnt: number }

  const offset = (page - 1) * pageSize
  const list = db.prepare(
    `SELECT id, user_id, user_type, credits, total_usage, created_at, updated_at FROM analysis_usage ${whereClause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset) as Array<{
    id: number
    user_id: string
    user_type: string
    credits: number
    total_usage: number
    created_at: number
    updated_at: number
  }>

  return {
    list,
    total: countRow.total,
    registeredCount: regRow.cnt,
    guestCount: guestRow.cnt
  }
}

export function updateUserCredits(userId: string, credits: number): boolean {
  const result = db.prepare(
    `UPDATE analysis_usage SET credits = ?, updated_at = strftime('%s', 'now') WHERE user_id = ?`
  ).run(credits, userId)
  return result.changes > 0
}

export function incrementAnalysisUsage(userId: string, cost: number): { success: boolean; remaining: number } {
  const record = getRecord(userId)

  if (!record) return { success: false, remaining: 0 }

  const userType = record.user_type
  const currentCredits = record.credits ?? (userType === 'registered' ? USER_INITIAL_CREDITS : GUEST_INITIAL_CREDITS)

  if (currentCredits < cost) {
    return { success: false, remaining: currentCredits }
  }

  const newCredits = currentCredits - cost
  db.prepare(
    `UPDATE analysis_usage SET credits = ?, total_usage = total_usage + 1, updated_at = strftime('%s', 'now') WHERE user_id = ?`
  ).run(newCredits, userId)
  return { success: true, remaining: newCredits }
}
