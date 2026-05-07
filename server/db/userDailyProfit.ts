import db from './connection.js'
import { getCurrentUserId, getLocalDate } from './connection.js'
import { logger } from '../logger.js'

export interface TimeProfitPoint {
  time: string
  amount: number
  profit: number
  rate: number
}

export interface UserDailyProfit {
  id: number
  userId: string
  profitDate: string
  openingAmount: number
  timeProfitData: TimeProfitPoint[]
  finalRate: number | null
  finalProfit: number | null
  finalAmount: number | null
  settled: boolean
  createdAt: number
  updatedAt: number
}

export function getDailyProfit(date?: string): UserDailyProfit | null {
  const userId = getCurrentUserId().id
  const targetDate = date || getLocalDate()

  const row = db.prepare(`
    SELECT * FROM user_daily_profit
    WHERE user_id = ? AND profit_date = ?
  `).get(userId, targetDate) as any

  if (!row) return null

  return mapRowToDailyProfit(row)
}

export function getDailyProfitByDateRange(startDate: string, endDate: string): UserDailyProfit[] {
  const userId = getCurrentUserId().id

  const rows = db.prepare(`
    SELECT * FROM user_daily_profit
    WHERE user_id = ? AND profit_date >= ? AND profit_date <= ?
    ORDER BY profit_date ASC
  `).all(userId, startDate, endDate) as any[]

  return rows.map(mapRowToDailyProfit)
}

export function getLatestDailyProfit(excludeDate?: string): UserDailyProfit | null {
  const userId = getCurrentUserId().id

  let sql = `SELECT * FROM user_daily_profit WHERE user_id = ?`
  const params: string[] = [userId]

  if (excludeDate) {
    sql += ' AND profit_date < ?'
    params.push(excludeDate)
  }

  sql += ' ORDER BY profit_date DESC LIMIT 1'

  const row = db.prepare(sql).get(...params) as any
  if (!row) return null

  return mapRowToDailyProfit(row)
}

export function upsertDailyProfitTimeshare(
  date: string,
  openingAmount: number,
  timeProfitData: TimeProfitPoint[]
): void {
  const userId = getCurrentUserId().id
  const now = Date.now()

  const existing = db.prepare(`
    SELECT id, time_profit_data FROM user_daily_profit
    WHERE user_id = ? AND profit_date = ?
  `).get(userId, date) as { id: number; time_profit_data: string | null } | undefined

  if (existing) {
    let merged: TimeProfitPoint[] = []

    if (existing.time_profit_data) {
      try {
        merged = JSON.parse(existing.time_profit_data)
      } catch {
        merged = []
      }
    }

    const mergedMap = new Map<string, TimeProfitPoint>()
    for (const p of merged) {
      mergedMap.set(p.time, p)
    }
    for (const p of timeProfitData) {
      mergedMap.set(p.time, p)
    }

    const sorted = Array.from(mergedMap.values()).sort((a, b) => a.time.localeCompare(b.time))

    db.prepare(`
      UPDATE user_daily_profit
      SET opening_amount = ?, time_profit_data = ?, updated_at = ?
      WHERE id = ?
    `).run(openingAmount, JSON.stringify(sorted), now, existing.id)

    logger.log(`📊 更新用户分时收益 ${date}: ${sorted.length}个时点`)
  } else {
    db.prepare(`
      INSERT INTO user_daily_profit (user_id, profit_date, opening_amount, time_profit_data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, date, openingAmount, JSON.stringify(timeProfitData), now, now)

    logger.log(`📊 创建用户分时收益 ${date}: ${timeProfitData.length}个时点`)
  }
}

export function updateDailyProfitFinal(
  date: string,
  finalRate: number,
  finalProfit: number,
  finalAmount: number,
  allSettled: boolean
): void {
  const userId = getCurrentUserId().id
  const now = Date.now()

  const result = db.prepare(`
    UPDATE user_daily_profit
    SET final_rate = ?, final_profit = ?, final_amount = ?,
        settled = ?, updated_at = ?
    WHERE user_id = ? AND profit_date = ?
  `).run(finalRate, finalProfit, finalAmount, allSettled ? 1 : 0, now, userId, date)

  if (result.changes > 0) {
    logger.log(`📊 更新用户最终收益 ${date}: profit=${finalProfit.toFixed(2)} rate=${finalRate.toFixed(2)}% settled=${allSettled}`)
  }
}

export interface DailyProfitSummary {
  date: string
  totalProfit: number
}

export function getDailyProfitSummaries(startDate: string, endDate: string): DailyProfitSummary[] {
  const userId = getCurrentUserId().id

  const rows = db.prepare(`
    SELECT profit_date, SUM(day_profit) as total_profit
    FROM (
      SELECT profit_date, fund_code, day_profit,
        ROW_NUMBER() OVER (
          PARTITION BY profit_date, fund_code
          ORDER BY CASE WHEN profit_type = 'final' THEN 0 ELSE 1 END, created_at DESC
        ) as rn
      FROM user_funds_profit_history
      WHERE user_id = ? AND profit_date >= ? AND profit_date <= ?
    )
    WHERE rn = 1
    GROUP BY profit_date
    ORDER BY profit_date ASC
  `).all(userId, startDate, endDate) as any[]

  if (rows.length === 0) return []

  let cumSum = 0
  return rows.map(row => {
    cumSum += row.total_profit
    return {
      date: row.profit_date,
      totalProfit: cumSum
    }
  })
}

function mapRowToDailyProfit(row: any): UserDailyProfit {
  let timeProfitData: TimeProfitPoint[] = []
  if (row.time_profit_data) {
    try {
      timeProfitData = JSON.parse(row.time_profit_data)
    } catch {
      timeProfitData = []
    }
  }

  return {
    id: row.id,
    userId: row.user_id,
    profitDate: row.profit_date,
    openingAmount: row.opening_amount,
    timeProfitData,
    finalRate: row.final_rate,
    finalProfit: row.final_profit,
    finalAmount: row.final_amount,
    settled: Boolean(row.settled),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}
