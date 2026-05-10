import db from './connection.js'
import { logger } from '../logger.js'

export interface NavHistoryRecord {
  code: string
  date: string
  nav: number
  accNav: number
  growth: number
}

export function getLatestNavDate(code: string): string | null {
  const row = db.prepare(
    `SELECT date FROM fund_nav_history WHERE code = ? ORDER BY date DESC LIMIT 1`
  ).get(code) as { date: string } | undefined
  return row?.date ?? null
}

export function getNavHistoryRange(code: string, startDate: string): NavHistoryRecord[] {
  const rows = db.prepare(
    `SELECT code, date, nav, acc_nav, growth FROM fund_nav_history WHERE code = ? AND date >= ? ORDER BY date`
  ).all(code, startDate) as Array<{ code: string; date: string; nav: number; acc_nav: number; growth: number }>
  return rows.map(r => ({
    code: r.code,
    date: r.date,
    nav: r.nav,
    accNav: r.acc_nav ?? r.nav,
    growth: r.growth ?? 0
  }))
}

export function getNavCount(code: string): number {
  const row = db.prepare(
    `SELECT COUNT(*) as cnt FROM fund_nav_history WHERE code = ?`
  ).get(code) as { cnt: number }
  return row.cnt
}

export function saveNavHistoryBatch(code: string, items: Array<{ date: string; nav: number; accNav: number; growth: number }>): number {
  if (items.length === 0) return 0

  const now = Date.now()
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO fund_nav_history (code, date, nav, acc_nav, growth, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const insert = db.transaction(() => {
    let count = 0
    for (const item of items) {
      stmt.run(code, item.date, item.nav, item.accNav, item.growth, now, now)
      count++
    }
    return count
  })

  const count = insert()
  logger.log(`📊 NAV历史数据已保存 ${code}: ${count} 条`)
  return count
}
