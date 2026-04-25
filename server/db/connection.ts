import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import crypto from 'crypto'
import { AsyncLocalStorage } from 'node:async_hooks'
import { logger } from '../logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbDir = path.join(__dirname, '../../db')
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
  logger.log('📁 创建数据库目录:', dbDir)
}

const dbPath = path.join(dbDir, 'fund-data.db')

const db = new Database(dbPath)

db.pragma('journal_mode = WAL')

export default db

export function getLocalDate(date: Date = new Date()): string {
  return date.toLocaleDateString('sv-SE')
}

export enum UserIdType {
  REGISTERED = 'registered',
  GUEST = 'guest'
}

export interface UserId {
  id: string
  type: UserIdType
  label?: string
}

export const userContext = new AsyncLocalStorage<UserId>()

const _fallbackUserId: UserId = { id: 'SYSTEM', type: UserIdType.GUEST, label: '系统' }

export { _fallbackUserId }

export function generateSessionId(): string {
  return 'S-' + crypto.randomBytes(16).toString('hex').toUpperCase()
}

export function getCurrentUserId(): UserId {
  const userId = userContext.getStore()
  if (userId) {
    return userId
  }
  return _fallbackUserId
}

export function getUserIdFromClientId(clientId: string | undefined): UserId | null {
  if (!clientId) {
    return null
  }

  if (clientId.startsWith('S-') || clientId.startsWith('C-') || clientId.startsWith('M-')) {
    return { id: clientId, type: UserIdType.GUEST, label: '访客' }
  }

  const stmt = db.prepare('SELECT id, username, email, label, type FROM users WHERE username = ? OR id = ? OR email = ?')
  const user = stmt.get(clientId, clientId, clientId) as any
  if (user) {
    return { 
      id: user.username, 
      type: UserIdType.REGISTERED, 
      label: user.label || user.username 
    }
  }

  return { id: clientId, type: UserIdType.GUEST, label: clientId }
}

export function setCurrentUserId(userId: UserId): void {
  const store = userContext.getStore()
  if (store) {
    Object.assign(store, userId)
  }
}

export function setRegisteredUser(userId: string, label?: string): void {
  setCurrentUserId({
    id: userId,
    type: UserIdType.REGISTERED,
    label: label || userId
  })
}

export function setGuestUser(): void {
  const sessionId = generateSessionId()
  setCurrentUserId({
    id: sessionId,
    type: UserIdType.GUEST,
    label: '访客'
  })
}

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fund_cache (
      code TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS fund_time_trend (
      code TEXT NOT NULL,
      data TEXT,
      date TEXT NOT NULL,
      timestamp INTEGER,
      created_at INTEGER,
      day_growth REAL,
      nav REAL,
      gsz REAL,
      gszzl REAL,
      is_updated INTEGER DEFAULT 0,
      is_trading_day INTEGER DEFAULT 1,
      PRIMARY KEY (code, date)
    )
  `)

  const migrations: string[] = [
    `ALTER TABLE fund_time_trend ADD COLUMN day_growth REAL`,
    `ALTER TABLE fund_time_trend ADD COLUMN nav REAL`,
    `ALTER TABLE fund_time_trend ADD COLUMN gsz REAL`,
    `ALTER TABLE fund_time_trend ADD COLUMN gszzl REAL`,
    `ALTER TABLE fund_time_trend ADD COLUMN is_updated INTEGER DEFAULT 0`,
    `ALTER TABLE fund_time_trend ADD COLUMN is_trading_day INTEGER DEFAULT 1`,
    `ALTER TABLE fund_time_trend ADD COLUMN settlement_status INTEGER DEFAULT 0`,
    `ALTER TABLE fund_time_trend ADD COLUMN settlement_time TEXT`,
    `ALTER TABLE user_funds ADD COLUMN settled INTEGER DEFAULT 0`,
    `ALTER TABLE user_funds ADD COLUMN last_settled_date TEXT DEFAULT ''`,
    `ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0`,
  ]
  for (const sql of migrations) {
    try { db.exec(sql) } catch (e) { /* field exists */ }
  }
  try { db.exec(`UPDATE user_funds SET settled = 0 WHERE settled IS NULL`) } catch (e) { /* ignore */ }

  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_funds_pk ON user_funds(user_id, fund_code)`)

  db.exec(`CREATE INDEX IF NOT EXISTS idx_fund_time_trend_date ON fund_time_trend(date)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_fund_time_trend_timestamp ON fund_time_trend(timestamp)`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_time_trend (
      code TEXT NOT NULL,
      date TEXT NOT NULL,
      data TEXT,
      timestamp INTEGER,
      created_at INTEGER,
      day_growth REAL,
      price REAL,
      is_trading_day INTEGER DEFAULT 1,
      PRIMARY KEY (code, date)
    )
  `)

  const migrations2: string[] = [
    `ALTER TABLE stock_time_trend ADD COLUMN day_growth REAL`,
    `ALTER TABLE stock_time_trend ADD COLUMN price REAL`,
    `ALTER TABLE stock_time_trend ADD COLUMN is_trading_day INTEGER DEFAULT 1`,
  ]
  for (const sql of migrations2) {
    try { db.exec(sql) } catch (e) { /* field exists */ }
  }

  try {
    db.exec(`
      INSERT OR IGNORE INTO stock_time_trend (code, date, data, timestamp, created_at, day_growth, price, is_trading_day)
      SELECT '000001', date, data, timestamp, created_at, day_growth, gsz, is_trading_day
      FROM fund_time_trend WHERE code = 'INDEX_SH000001'
    `)
  } catch (e) { /* ignore */ }

  try {
    db.prepare(`DELETE FROM fund_time_trend WHERE code = 'INDEX_SH000001'`).run()
  } catch (e) { /* ignore */ }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_stock_time_trend_date ON stock_time_trend(date)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_stock_time_trend_timestamp ON stock_time_trend(timestamp)`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_daily_profit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      profit_date TEXT NOT NULL,
      opening_amount REAL NOT NULL DEFAULT 0,
      time_profit_data TEXT,
      final_rate REAL,
      final_profit REAL,
      final_amount REAL,
      settled INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE (user_id, profit_date)
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_user_daily_profit_user ON user_daily_profit(user_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_user_daily_profit_date ON user_daily_profit(profit_date)`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      password TEXT,
      type TEXT NOT NULL,
      label TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      last_active INTEGER NOT NULL
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_type ON users(type)`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS system_params (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      remark TEXT
    )
  `)

  logger.log('✅ 数据库初始化完成:', dbPath)

  const userId = getCurrentUserId()
  logger.log('👤 当前用户ID:', userId.id, `(${userId.type})${userId.label ? ' - ' + userId.label : ''}`)
}

export function closeDatabase(): void {
  db.close()
  logger.log('🔒 数据库连接已关闭')
}

export { getCurrentUserId as getUserId }
