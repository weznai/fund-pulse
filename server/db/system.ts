import db from './connection.js'
import { getLocalDate } from './connection.js'
import { logger } from '../logger.js'
import { hasFundDataForDate } from './userFund.js'
import { isTradingDay } from './holiday.js'

export interface SystemInfo {
  name: string
  lastTradingDay: string
  tradingDay: string
  updatedAt: number
}

export function getSystemInfo(name: string = 'fund'): SystemInfo | null {
  const stmt = db.prepare('SELECT * FROM biz_system WHERE name = ?')
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

  if (current && current.tradingDay === today && hasFundDataForDate(today)) {
    return current
  }

  if (isTradingDay(today)) {
    if (hasFundDataForDate(today) || !current || current.tradingDay !== today) {
      const lastTradingDay = current?.tradingDay || ''
      const now = Date.now()
      db.prepare(`
        INSERT INTO biz_system (name, last_trading_day, trading_day, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
          last_trading_day = excluded.last_trading_day,
          trading_day = excluded.trading_day,
          updated_at = excluded.updated_at
      `).run(name, lastTradingDay, today, now)
      return { name, lastTradingDay, tradingDay: today, updatedAt: now }
    }
    return current
  }

  if (current && current.tradingDay === today) {
    db.prepare(`UPDATE biz_system SET trading_day = ?, updated_at = ? WHERE name = ?`)
      .run(current.lastTradingDay, Date.now(), name)
    return { name, lastTradingDay: current.lastTradingDay, tradingDay: current.lastTradingDay, updatedAt: Date.now() }
  }
  return current || { name, lastTradingDay: '', tradingDay: '', updatedAt: 0 }
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
  const today = getLocalDate()

  if (info?.tradingDay && info.tradingDay === today && hasFundDataForDate(today)) {
    return info.tradingDay
  }

  if (hasFundDataForDate(today) && isTradingDay(today)) {
    if (info && info.tradingDay !== today) {
      const lastTradingDay = info.tradingDay || ''
      const now = Date.now()
      db.prepare(`
        INSERT INTO biz_system (name, last_trading_day, trading_day, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
          last_trading_day = excluded.last_trading_day,
          trading_day = excluded.trading_day,
          updated_at = excluded.updated_at
      `).run(info.name, lastTradingDay, today, now)
      logger.log(`📅 biz_system.trading_day 已更新: ${lastTradingDay} → ${today}`)
    }
    return today
  }

  if (info?.tradingDay && hasFundDataForDate(info.tradingDay)) {
    return info.tradingDay
  }

  if (info?.lastTradingDay && hasFundDataForDate(info.lastTradingDay)) {
    if (info.tradingDay !== info.lastTradingDay) {
      db.prepare(`UPDATE biz_system SET trading_day = ?, updated_at = ? WHERE name = ?`)
        .run(info.lastTradingDay, Date.now(), info.name)
      logger.log(`📅 biz_system.trading_day 已修正: ${info.lastTradingDay}`)
    }
    return info.lastTradingDay
  }

  const latest = getLatestSettleDate()
  if (latest) {
    const lastTradingDay = (info?.tradingDay && info.tradingDay < latest) ? info.tradingDay : (info?.lastTradingDay || '')
    const now = Date.now()
    db.prepare(`
      INSERT INTO biz_system (name, last_trading_day, trading_day, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        last_trading_day = excluded.last_trading_day,
        trading_day = excluded.trading_day,
        updated_at = excluded.updated_at
    `).run('fund', lastTradingDay, latest, now)
    logger.log(`📅 biz_system.trading_day 已同步: ${latest}`)
  }

  return latest
}
