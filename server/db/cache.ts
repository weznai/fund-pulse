import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from './connection.js'
import { getLocalDate } from './connection.js'
import { logger } from '../logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface FundCacheData {
  code: string
  data: string
  timestamp: number
}

export function getFundCache(code: string, maxAge: number): FundCacheData | null {
  const now = Date.now()
  const cutoff = now - maxAge

  const stmt = db.prepare(`
    SELECT code, data, timestamp
    FROM fund_cache
    WHERE code = ? AND timestamp > ?
    LIMIT 1
  `)

  const result = stmt.get(code, cutoff) as FundCacheData | undefined

  if (result) {
    logger.log(`📦 从数据库读取基金缓存 ${code}`)
    return result
  }

  return null
}

export function saveFundCache(code: string, dataStr: string): void {
  const now = Date.now()

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO fund_cache (code, data, timestamp, created_at)
    VALUES (?, ?, ?, ?)
  `)

  stmt.run(code, dataStr, now, now)
  logger.log(`💾 基金缓存已保存到数据库 ${code}`)
}

export function getCacheStats() {
  const fundCount = db.prepare('SELECT COUNT(*) as count FROM fund_cache').get() as { count: number }

  let dbSize = 0
  try {
    const dbPath = path.join(__dirname, '../../db/fund-data.db')
    const stats = fs.statSync(dbPath)
    dbSize = stats.size
  } catch (e) {}

  return {
    fundCount: fundCount.count,
    dbSize: dbSize,
    dbPath: ''
  }
}

export function clearAllCache(): void {
  db.prepare('DELETE FROM fund_cache').run()
  db.prepare('DELETE FROM fund_time_trend').run()
  db.prepare('DELETE FROM stock_time_trend').run()
  logger.log(`🗑️ 已清空所有缓存`)
}

export interface StockTimeTrendData {
  code: string
  data: string
  date: string
  dayGrowth?: number
  price?: number
  isTradingDay?: boolean
}

export interface StockTimeTrendCacheData {
  code: string
  data: string
  date: string
  timestamp: number
  dayGrowth?: number
  price?: number
  isTradingDay?: boolean
}

export function saveStockTimeTrend(item: StockTimeTrendData): void {
  const now = Date.now()
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO stock_time_trend (code, data, date, timestamp, created_at, day_growth, price, is_trading_day)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(item.code, item.data, item.date, now, now, item.dayGrowth ?? null, item.price ?? null, item.isTradingDay ? 1 : 0)
  logger.log(`📈 指数分时数据已保存 ${item.code}`)
}

export function getStockTimeTrend(code: string, date: string): StockTimeTrendCacheData | null {
  const stmt = db.prepare(`
    SELECT code, data, date, timestamp, day_growth, price, is_trading_day
    FROM stock_time_trend
    WHERE code = ? AND date = ?
    LIMIT 1
  `)
  const result = stmt.get(code, date) as any
  if (result) {
    return {
      code: result.code,
      data: result.data,
      date: result.date,
      timestamp: result.timestamp,
      dayGrowth: result.day_growth,
      price: result.price,
      isTradingDay: result.is_trading_day === 1
    }
  }
  return null
}

export function getLatestStockTimeTrend(code: string, excludeDate?: string): StockTimeTrendCacheData | null {
  let sql = `
    SELECT code, data, date, timestamp, day_growth, price, is_trading_day
    FROM stock_time_trend
    WHERE code = ?
  `
  const params: string[] = [code]
  if (excludeDate) {
    sql += ' AND date < ?'
    params.push(excludeDate)
  }
  sql += ' ORDER BY date DESC LIMIT 1'
  const result = db.prepare(sql).get(...params) as any
  if (result) {
    return {
      code: result.code,
      data: result.data,
      date: result.date,
      timestamp: result.timestamp,
      dayGrowth: result.day_growth,
      price: result.price,
      isTradingDay: result.is_trading_day === 1
    }
  }
  return null
}

export interface TimeTrendData {
  code: string
  data: string
  date: string
  dayGrowth?: number
  nav?: number
  gsz?: number
  gszzl?: number
  isUpdated?: boolean
  isTradingDay?: boolean
}

export interface TimeTrendCacheData {
  code: string
  data: string
  date: string
  timestamp: number
  dayGrowth?: number
  nav?: number
  gsz?: number
  gszzl?: number
  isUpdated?: boolean
  isTradingDay?: boolean
  settlementStatus?: number
  settlementTime?: string
}

export function saveGlobalEstimateCache(item: TimeTrendData): void {
  const now = Date.now()

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO fund_time_trend (code, data, date, timestamp, created_at, day_growth, nav, gsz, gszzl, is_updated, is_trading_day)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(item.code, item.data, item.date, now, now, item.dayGrowth ?? null, item.nav ?? null, item.gsz ?? null, item.gszzl ?? null, item.isUpdated ? 1 : 0, item.isTradingDay ? 1 : 0)
  logger.log(`🌐 分时数据已保存 ${item.code}`)
}

export function getGlobalEstimateCache(code: string, today: string): TimeTrendCacheData | null {
  const stmt = db.prepare(`
    SELECT code, data, date, timestamp, day_growth, nav, gsz, gszzl, is_updated, is_trading_day, settlement_status, settlement_time
    FROM fund_time_trend
    WHERE code = ? AND date = ?
    LIMIT 1
  `)

  const result = stmt.get(code, today) as any

  if (result) {
    logger.log(`📦 从分时数据缓存读取 ${code}`)
    return {
      code: result.code,
      data: result.data,
      date: result.date,
      timestamp: result.timestamp,
      dayGrowth: result.day_growth,
      nav: result.nav,
      gsz: result.gsz,
      gszzl: result.gszzl,
      isUpdated: result.is_updated === 1,
      isTradingDay: result.is_trading_day === 1,
      settlementStatus: result.settlement_status ?? 0,
      settlementTime: result.settlement_time ?? undefined
    }
  }

  return null
}

export function getGlobalEstimateCodes(): string[] {
  const today = getLocalDate()
  const stmt = db.prepare(`SELECT DISTINCT code FROM fund_time_trend WHERE date = ?`)
  const results = stmt.all(today) as Array<{ code: string }>
  return results.map(r => r.code)
}

export function saveGlobalEstimateCacheBatch(items: TimeTrendData[]): void {
  const now = Date.now()
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO fund_time_trend (code, data, date, timestamp, created_at, day_growth, nav, gsz, gszzl, is_updated, is_trading_day)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const transaction = db.transaction(() => {
    for (const item of items) {
      stmt.run(item.code, item.data, item.date, now, now, item.dayGrowth ?? null, item.nav ?? null, item.gsz ?? null, item.gszzl ?? null, item.isUpdated ? 1 : 0, item.isTradingDay ? 1 : 0)
    }
  })

  transaction()
  logger.log(`🌐 批量保存分时数据: ${items.length} 条`)
}

export function getGlobalCacheStats(): { count: number; codes: string[] } {
  const today = getLocalDate()
  const countResult = db.prepare(`SELECT COUNT(*) as count FROM fund_time_trend WHERE date = ?`).get(today) as { count: number }
  const codes = getGlobalEstimateCodes()
  return { count: countResult.count, codes }
}

export function getLatestGlobalEstimateCache(code: string, excludeDate?: string): TimeTrendCacheData | null {
  let sql = `
    SELECT code, data, date, timestamp, day_growth, nav, gsz, gszzl, is_updated, is_trading_day
    FROM fund_time_trend
    WHERE code = ?
  `
  const params: string[] = [code]

  if (excludeDate) {
    sql += ' AND date < ?'
    params.push(excludeDate)
  }

  sql += ' ORDER BY date DESC LIMIT 1'

  const result = db.prepare(sql).get(...params) as any

  if (result) {
    logger.log(`📦 从分时数据缓存读取最近数据 ${code} (${result.date})`)
    return {
      code: result.code,
      data: result.data,
      date: result.date,
      timestamp: result.timestamp,
      dayGrowth: result.day_growth,
      nav: result.nav,
      gsz: result.gsz,
      gszzl: result.gszzl,
      isUpdated: result.is_updated === 1,
      isTradingDay: result.is_trading_day === 1
    }
  }

  return null
}

export function hasFinalGrowth(fundCode: string, date: string): boolean {
  const stmt = db.prepare(`
    SELECT day_growth FROM fund_time_trend
    WHERE code = ? AND date = ? AND day_growth IS NOT NULL
  `)
  const result = stmt.get(fundCode, date) as { day_growth: number } | undefined
  return !!result
}

export function getFinalGrowthData(fundCode: string, date: string): { nav: number; dayGrowth: number } | null {
  const stmt = db.prepare(`
    SELECT nav, day_growth FROM fund_time_trend
    WHERE code = ? AND date = ?
  `)
  const result = stmt.get(fundCode, date) as { nav: number; day_growth: number } | undefined

  if (result && result.day_growth !== null) {
    return {
      nav: result.nav,
      dayGrowth: result.day_growth
    }
  }
  return null
}

export function updateFinalGrowth(fundCode: string, date: string, nav: number, dayGrowth: number): boolean {
  const now = Date.now()

  const existing = db.prepare(`
    SELECT code FROM fund_time_trend WHERE code = ? AND date = ?
  `).get(fundCode, date) as any

  if (existing) {
    const stmt = db.prepare(`
      UPDATE fund_time_trend
      SET day_growth = ?, nav = ?, timestamp = ?, settlement_status = 0
      WHERE code = ? AND date = ?
    `)
    const result = stmt.run(dayGrowth, nav, now, fundCode, date)
    logger.log(`📊 更新最终涨跌幅 ${fundCode}: nav=${nav}, dayGrowth=${dayGrowth}%, settlement_status=0`)
    return result.changes > 0
  } else {
    const stmt = db.prepare(`
      INSERT INTO fund_time_trend (code, data, date, timestamp, created_at, day_growth, nav, gsz, gszzl, settlement_status)
      VALUES (?, '', ?, ?, ?, ?, ?, ?, ?, 0)
    `)
    stmt.run(fundCode, date, now, now, dayGrowth, nav, null, null)
    logger.log(`📊 插入最终涨跌幅 ${fundCode}: nav=${nav}, dayGrowth=${dayGrowth}%, settlement_status=0`)
    return true
  }
}

function formatDateTime(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function isNavDateAlreadySettled(code: string, navDate: string, nav: number, dayGrowth: number): boolean {
  const stmt = db.prepare(`
    SELECT date FROM fund_time_trend
    WHERE code = ? AND date != ? AND nav = ? AND day_growth = ? AND is_updated = 1 AND settlement_status = 1
    ORDER BY date DESC LIMIT 1
  `)
  const result = stmt.get(code, navDate, nav, dayGrowth) as { date: string } | undefined
  return !!result
}

export function resetFundTodayStatus(fundCode: string, date: string): boolean {
  const row = db.prepare(`
    SELECT data FROM fund_time_trend WHERE code = ? AND date = ?
  `).get(fundCode, date) as { data: string } | undefined

  if (!row) return false

  let data = row.data || ''

  const stmt = db.prepare(`
    UPDATE fund_time_trend
    SET is_updated = 0, settlement_status = 0, day_growth = NULL, nav = NULL, data = ?
    WHERE code = ? AND date = ?
  `)
  const result = stmt.run(data, fundCode, date)
  logger.log(`🔄 重置 ${fundCode} ${date} 状态: is_updated=0, settlement_status=0, 清除day_growth/nav`)
  return result.changes > 0
}

export function updateSettlementStatus(fundCode: string, date: string, status: 0 | 1 | 2): boolean {
  const settlementTime = status === 1 ? formatDateTime() : null

  const stmt = db.prepare(`
    UPDATE fund_time_trend
    SET settlement_status = ?, settlement_time = ?
    WHERE code = ? AND date = ?
  `)
  const result = stmt.run(status, settlementTime, fundCode, date)

  if (result.changes > 0) {
    const statusText = status === 1 ? '已结算' : status === 2 ? '结算失败' : '未结算'
    logger.log(`📋 更新结算状态 ${fundCode}: ${statusText}${settlementTime ? ` at ${settlementTime}` : ''}`)
    return true
  }
  return false
}
