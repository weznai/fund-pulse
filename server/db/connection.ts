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
    `ALTER TABLE user_funds ADD COLUMN settle_date TEXT DEFAULT ''`,
    `ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE user_funds ADD COLUMN total_cost REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE fund_info ADD COLUMN data_source VARCHAR(20) DEFAULT 'standard'`,
  ]
  for (const sql of migrations) {
    try { db.exec(sql) } catch (e) { /* field exists */ }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL,
      description TEXT
    )
  `)

  const pendingMigrations: Array<{
    name: string
    description: string
    up: () => void
  }> = [
    {
      name: 'holding_cost_20260427',
      description: '持仓收益率优化：新增交易流水表、total_cost字段、迁移现有持仓数据',
      up: () => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS user_fund_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            fund_code TEXT NOT NULL,
            fund_name TEXT,
            type TEXT NOT NULL CHECK(type IN ('buy', 'sell', 'migrate')),
            shares REAL NOT NULL,
            nav REAL NOT NULL,
            amount REAL NOT NULL,
            cost_price REAL NOT NULL,
            shares_before REAL NOT NULL DEFAULT 0,
            shares_after REAL NOT NULL DEFAULT 0,
            total_cost_before REAL NOT NULL DEFAULT 0,
            total_cost_after REAL NOT NULL DEFAULT 0,
            realized_profit REAL DEFAULT 0,
            transaction_date TEXT NOT NULL,
            remark TEXT,
            created_at INTEGER NOT NULL
          )
        `)
        db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_user ON user_fund_transactions (user_id)`)
        db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_fund ON user_fund_transactions (user_id, fund_code)`)
        db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON user_fund_transactions (transaction_date)`)

        const rows = db.prepare(`
          SELECT user_id, fund_code, fund_name, share, cost, amount, accumulated_profit
          FROM user_funds WHERE is_held = 1 AND share > 0
        `).all() as any[]
        if (rows.length > 0) {
          const now = Date.now()
          const today = getLocalDate()
          const updateCost = db.prepare(`UPDATE user_funds SET total_cost = ?, accumulated_profit = ? WHERE user_id = ? AND fund_code = ?`)
          const insertTx = db.prepare(`
            INSERT INTO user_fund_transactions (
              user_id, fund_code, fund_name, type, shares, nav, amount, cost_price,
              shares_before, shares_after, total_cost_before, total_cost_after,
              realized_profit, transaction_date, remark, created_at
            ) VALUES (?, ?, ?, 'migrate', ?, ?, ?, ?, 0, ?, 0, ?, 0, ?, '数据迁移-历史重建', ?)
          `)
          db.transaction(() => {
            for (const row of rows) {
              const totalCost = reconstructTotalCost(row.user_id, row.fund_code)
              const correctProfit = Math.round((row.amount - totalCost) * 100) / 100
              updateCost.run(totalCost, correctProfit, row.user_id, row.fund_code)
              insertTx.run(row.user_id, row.fund_code, row.fund_name,
                row.share, row.cost, totalCost, row.cost,
                row.share, totalCost, today, now)
            }
          })()
          logger.log(`🔄 持仓数据迁移完成(历史重建): ${rows.length} 条记录`)
        }
      }
    },
    {
      name: 'rename_settle_date_20260509',
      description: '重命名 last_settled_date 为 settle_date',
      up: () => {
        const cols = db.prepare(`PRAGMA table_info(user_funds)`).all() as any[]
        const hasOld = cols.some(c => c.name === 'last_settled_date')
        const hasNew = cols.some(c => c.name === 'settle_date')
        if (hasOld && !hasNew) {
          db.exec(`ALTER TABLE user_funds RENAME COLUMN last_settled_date TO settle_date`)
        }
      }
    },
    {
      name: 'data_source_v2_20260511',
      description: '新增data_extra字段，重命名estimate_only为mobapi',
      up: () => {
        const cols = db.prepare(`PRAGMA table_info(fund_info)`).all() as any[]
        if (!cols.some(c => c.name === 'data_extra')) {
          db.exec(`ALTER TABLE fund_info ADD COLUMN data_extra TEXT DEFAULT NULL`)
        }
        db.exec(`UPDATE fund_info SET data_source = 'mobapi' WHERE data_source = 'estimate_only'`)
      }
    }
  ]

  function reconstructTotalCost(userId: string, fundCode: string): number {
    const history = db.prepare(`
      SELECT opening_amount, closing_amount
      FROM user_funds_profit_history
      WHERE user_id = ? AND fund_code = ?
      ORDER BY profit_date
    `).all(userId, fundCode) as { opening_amount: number; closing_amount: number }[]

    if (history.length === 0) {
      const fallback = db.prepare(`
        SELECT share, cost, amount, accumulated_profit FROM user_funds
        WHERE user_id = ? AND fund_code = ?
      `).get(userId, fundCode) as any
      if (!fallback) return 0
      const ap = fallback.accumulated_profit || 0
      if (ap !== 0 && fallback.amount > 0) {
        return Math.max(Math.round((fallback.amount - ap) * 100) / 100, 0)
      }
      return Math.max(Math.round(fallback.share * fallback.cost * 100) / 100, 0)
    }

    let totalCost = history[0].opening_amount
    for (let i = 1; i < history.length; i++) {
      const prevClose = history[i - 1].closing_amount
      const curOpen = history[i].opening_amount
      const delta = curOpen - prevClose
      if (Math.abs(delta) > 0.5) {
        if (delta > 0) {
          totalCost += delta
        } else {
          const ratio = curOpen / prevClose
          totalCost = totalCost * ratio
        }
      }
    }
    return Math.max(Math.round(totalCost * 100) / 100, 0)
  }

  for (const migration of pendingMigrations) {
    const applied = db.prepare(`SELECT 1 FROM schema_migrations WHERE name = ?`).get(migration.name)
    if (!applied) {
      try {
        migration.up()
        db.prepare(`INSERT INTO schema_migrations (name, applied_at, description) VALUES (?, ?, ?)`)
          .run(migration.name, Date.now(), migration.description)
        logger.log(`✅ 迁移完成: ${migration.name} - ${migration.description}`)
      } catch (e) {
        logger.error(`❌ 迁移失败: ${migration.name}`, e)
      }
    }
  }

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
    CREATE TABLE IF NOT EXISTS fund_nav_history (
      code TEXT NOT NULL,
      date TEXT NOT NULL,
      nav REAL NOT NULL,
      acc_nav REAL,
      growth REAL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (code, date)
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_fund_nav_history_code ON fund_nav_history(code)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_fund_nav_history_date ON fund_nav_history(code, date)`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_daily_profit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      profit_date TEXT NOT NULL,
      opening_amount REAL NOT NULL DEFAULT 0,  -- 当日开盘总市值（所有持仓基金市值之和）
      time_profit_data TEXT,                    -- 盘中分时走势JSON数组 [{time, amount, profit, rate}]
      final_rate REAL,                          -- 当日总收益率(%): finalProfit / openingAmount * 100
      final_profit REAL,                        -- 当日总收益金额: 所有基金收益之和（已结算用真实值，未结算用估值）
      final_amount REAL,                        -- 当日收盘总市值 = openingAmount + finalProfit
      settled INTEGER DEFAULT 0,                -- 是否全部基金已结算(1=是, 0=否，部分未结算时final_profit含估值)
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

  db.exec(`
    CREATE TABLE IF NOT EXISTS biz_system (
      name TEXT PRIMARY KEY,
      last_trading_day TEXT,
      trading_day TEXT,
      updated_at INTEGER NOT NULL
    )
  `)

  try {
    const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='system'").get()
    if (exists) {
      db.exec(`ALTER TABLE system RENAME TO biz_system`)
    }
  } catch (e) { /* ignore */ }

  db.exec(`INSERT OR IGNORE INTO biz_system (name, last_trading_day, trading_day, updated_at) VALUES ('fund', '', '', 0)`)

  logger.log('✅ 数据库初始化完成:', dbPath)

  const userId = getCurrentUserId()
  logger.log('👤 当前用户ID:', userId.id, `(${userId.type})${userId.label ? ' - ' + userId.label : ''}`)
}

export function rollbackMigration(name: string): boolean {
  const row = db.prepare(`SELECT * FROM schema_migrations WHERE name = ?`).get(name) as any
  if (!row) {
    logger.log(`⚠️ 迁移记录不存在: ${name}`)
    return false
  }

  const rollbacks: Record<string, () => void> = {
    holding_cost_20260427: () => {
      db.exec(`DROP TABLE IF EXISTS user_fund_transactions`)
      db.exec(`UPDATE user_funds SET total_cost = 0`)
    }
  }

  const rollback = rollbacks[name]
  if (!rollback) {
    logger.log(`⚠️ 未定义回滚逻辑: ${name}`)
    return false
  }

  try {
    rollback()
    db.prepare(`DELETE FROM schema_migrations WHERE name = ?`).run(name)
    logger.log(`🔄 回滚完成: ${name} - ${row.description}`)
    return true
  } catch (e) {
    logger.error(`❌ 回滚失败: ${name}`, e)
    return false
  }
}

export function listMigrations(): Array<{ name: string; appliedAt: number; description: string }> {
  return (db.prepare(`SELECT name, applied_at, description FROM schema_migrations ORDER BY applied_at`).all() as any[])
    .map(r => ({ name: r.name, appliedAt: r.applied_at, description: r.description }))
}

export function closeDatabase(): void {
  db.close()
  logger.log('🔒 数据库连接已关闭')
}

export { getCurrentUserId as getUserId }
