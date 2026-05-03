import db from './connection.js'
import { getLocalDate } from './connection.js'
import { logger } from '../logger.js'

export interface SystemInfo {
  name: string
  lastTradingDay: string
  tradingDay: string
  updatedAt: number
}

export function getSystemInfo(name: string = 'fund'): SystemInfo | null {
  const stmt = db.prepare('SELECT * FROM system WHERE name = ?')
  const row = stmt.get(name) as any
  if (!row) return null
  return {
    name: row.name,
    lastTradingDay: row.last_trading_day || '',
    tradingDay: row.trading_day || '',
    updatedAt: row.updated_at
  }
}

export function updateSystemTradingDays(name: string = 'fund'): SystemInfo {
  const today = getLocalDate()
  const current = getSystemInfo(name)

  if (current && current.tradingDay === today) {
    return current
  }

  const lastTradingDay = current?.tradingDay || ''
  const now = Date.now()

  db.prepare(`
    INSERT INTO system (name, last_trading_day, trading_day, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      last_trading_day = excluded.last_trading_day,
      trading_day = excluded.trading_day,
      updated_at = excluded.updated_at
  `).run(name, lastTradingDay, today, now)

  return { name, lastTradingDay, tradingDay: today, updatedAt: now }
}

function getLatestSettleDate(): string {
  const row = db.prepare(`
    SELECT MAX(profit_date) as latest FROM user_funds_profit_history
    WHERE profit_date IS NOT NULL AND profit_date != ''
  `).get() as any
  return row?.latest || ''
}

export function getTradingDay(): string {
  const info = getSystemInfo()
  if (info?.tradingDay) return info.tradingDay

  const latest = getLatestSettleDate()
  if (latest) {
    logger.log(`📅 system.trading_day 为空，从结算记录推导: ${latest}`)
    db.prepare(`
      UPDATE system SET trading_day = ? WHERE name = 'fund'
    `).run(latest)
  }
  return latest
}
