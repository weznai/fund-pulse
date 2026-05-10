import db from './connection.js'
import { getCurrentUserId, getLocalDate, userContext } from './connection.js'
import type { UserId } from './connection.js'
import { getRecommendFundCodes } from './fundInfo.js'
import { logger } from '../logger.js'

function getFundNameFromInfo(fundCode: string): string {
  const row = db.prepare('SELECT name FROM fund_info WHERE code = ?').get(fundCode) as { name: string } | undefined
  return row?.name || ''
}

export interface Holding {
  fundCode: string
  fundName: string
  share: number
  cost: number
  amount: number
  holdingDate: string
  settled?: boolean
  settleDate?: string
  lastSettledStatus?: boolean
  accumulatedProfit?: number
  currentDayProfit?: number
  currentDayProfitRate?: number
  profitType?: 'estimate' | 'final'
  lastProfitDate?: string
  totalCost?: number
}

export interface Transaction {
  id?: number
  userId: string
  fundCode: string
  fundName: string
  type: 'buy' | 'sell' | 'migrate'
  shares: number
  nav: number
  amount: number
  costPrice: number
  sharesBefore: number
  sharesAfter: number
  totalCostBefore: number
  totalCostAfter: number
  realizedProfit: number
  transactionDate: string
  remark?: string
  createdAt: number
}

export interface HoldingProfitHistory {
  id?: number
  userId: string
  fundCode: string
  fundName: string
  profitDate: string
  openingAmount: number
  closingAmount: number
  dayProfit: number
  dayProfitRate: number
  profitType: 'estimate' | 'final'
  createdAt: number
}

export interface UserFund {
  fundCode: string
  fundName: string
  isHeld: boolean
  share: number
  cost: number
  amount: number
  holdingDate?: string
  settled?: boolean
  settleDate?: string
  accumulatedProfit?: number
  currentDayProfit?: number
  currentDayProfitRate?: number
  profitType?: 'estimate' | 'final'
  lastProfitDate?: string
  addedAt: number
}

export function getHoldings(): Map<string, Holding> {
  const userId = getCurrentUserId().id
  const today = getLocalDate()
  const stmt = db.prepare(`
    SELECT uf.*, COALESCE(NULLIF(NULLIF(uf.fund_name, ''), uf.fund_code), fi.name, '') as fund_name
    FROM user_funds uf
    LEFT JOIN fund_info fi ON uf.fund_code = fi.code
    WHERE uf.user_id = ? AND uf.is_held = 1
  `)
  const results = stmt.all(userId) as any[]

  const holdings = new Map<string, Holding>()
  for (const row of results) {
    const settledDate = row.settle_date || ''
    const isSettledToday = Boolean(row.settled)

    holdings.set(row.fund_code, {
      fundCode: row.fund_code,
      fundName: row.fund_name,
      share: row.share,
      cost: row.cost,
      amount: row.amount,
      holdingDate: row.holding_date,
      settled: isSettledToday,
      settleDate: settledDate,
      lastSettledStatus: Boolean(row.settled),
      accumulatedProfit: row.accumulated_profit ?? 0,
      currentDayProfit: row.current_day_profit ?? null,
      currentDayProfitRate: row.current_day_profit_rate ?? null,
      profitType: row.profit_type || 'estimate',
      lastProfitDate: row.last_profit_date,
      totalCost: row.total_cost ?? 0
    })
  }

  return holdings
}

export interface SaveHoldingResult {
  success: boolean
  error?: string
  holding?: {
    fundCode: string
    amount: number
    share?: number
    cost?: number
    totalCost?: number
    settled: boolean
    settleDate: string
    currentDayProfit: number
    accumulatedProfit: number
  }
}

function getCurrentNav(fundCode: string): number | null {
  const today = getLocalDate()
  const trendRow = db.prepare(`
    SELECT nav, gsz, is_updated FROM fund_time_trend WHERE code = ? AND date = ?
  `).get(fundCode, today) as { nav: number; gsz: number; is_updated: number } | undefined

  if (!trendRow) return null

  if (trendRow.is_updated && trendRow.nav > 0) return trendRow.nav
  if (trendRow.gsz > 0) return trendRow.gsz
  if (trendRow.nav > 0) return trendRow.nav
  return null
}

function recordTransaction(params: {
  userId: string; fundCode: string; fundName: string;
  type: 'buy' | 'sell'; shares: number; nav: number; amount: number;
  costPrice: number; sharesBefore: number; sharesAfter: number;
  totalCostBefore: number; totalCostAfter: number; realizedProfit: number;
  date: string
}) {
  db.prepare(`
    INSERT INTO user_fund_transactions (
      user_id, fund_code, fund_name, type, shares, nav, amount, cost_price,
      shares_before, shares_after, total_cost_before, total_cost_after,
      realized_profit, transaction_date, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.userId, params.fundCode, params.fundName, params.type,
    params.shares, params.nav, params.amount, params.costPrice,
    params.sharesBefore, params.sharesAfter, params.totalCostBefore, params.totalCostAfter,
    params.realizedProfit, params.date, Date.now()
  )
}

export function saveHolding(holding: Holding): SaveHoldingResult {
  const userId = getCurrentUserId().id
  const today = getLocalDate()

  const existing = db.prepare(`
    SELECT settled, settle_date, amount, accumulated_profit, current_day_profit,
           share, cost, total_cost, is_held, fund_name
    FROM user_funds WHERE user_id = ? AND fund_code = ?
  `).get(userId, holding.fundCode) as {
    settled: number; settle_date: string; amount: number;
    accumulated_profit: number; current_day_profit: number;
    share: number; cost: number; total_cost: number;
    is_held: number; fund_name: string
  } | undefined

  if (!existing) {
    return { success: false, error: `基金 ${holding.fundCode} 不存在，请先添加到自选` }
  }

  const newAmount = Math.round(holding.amount * 100) / 100
  const isCurrentlyHeld = existing.is_held === 1
  const settledToday = Boolean(existing.settled) && existing.settle_date === today

  let newShare: number
  let newCost: number
  let newTotalCost: number
  let txType: 'buy' | 'sell' | null = null
  let txShares = 0
  let txNav = 0
  let txAmount = 0
  let txRealizedProfit = 0
  let sharesBefore = 0
  let totalCostBefore = 0

  const currentNav = getCurrentNav(holding.fundCode) || holding.cost || 1

  if (!isCurrentlyHeld || existing.share <= 0 || existing.total_cost <= 0) {
    newShare = currentNav > 0 ? Math.round((newAmount / currentNav) * 100) / 100 : 0
    newCost = currentNav
    newTotalCost = newAmount
    sharesBefore = 0
    totalCostBefore = 0

    if (isCurrentlyHeld && existing.share > 0 && existing.cost > 0) {
      sharesBefore = existing.share
      totalCostBefore = existing.total_cost || Math.round(existing.share * existing.cost * 100) / 100
    }

    if (newAmount > 0) {
      txType = 'buy'
      txShares = newShare
      txNav = currentNav
      txAmount = newAmount
    }
  } else {
    sharesBefore = existing.share
    totalCostBefore = existing.total_cost
    const oldAmount = existing.amount

    if (newAmount > oldAmount) {
      txType = 'buy'
      const buyAmount = Math.round((newAmount - oldAmount) * 100) / 100
      const buyShares = currentNav > 0 ? Math.round((buyAmount / currentNav) * 100) / 100 : 0
      txShares = buyShares
      txNav = currentNav
      txAmount = buyAmount

      newShare = Math.round((existing.share + buyShares) * 100) / 100
      newTotalCost = Math.round((totalCostBefore + buyAmount) * 100) / 100
      newCost = newShare > 0 ? Math.round((newTotalCost / newShare) * 10000) / 10000 : existing.cost
    } else if (newAmount < oldAmount) {
      txType = 'sell'
      const sellAmount = Math.round((oldAmount - newAmount) * 100) / 100
      const sellShares = currentNav > 0 ? Math.round((sellAmount / currentNav) * 100) / 100 : 0
      txShares = sellShares
      txNav = currentNav
      txAmount = sellAmount

      if (sellShares >= existing.share) {
        newShare = 0
        newCost = 0
        newTotalCost = 0
        const costOfSold = totalCostBefore
        txRealizedProfit = Math.round((sellAmount - costOfSold) * 100) / 100
      } else {
        newShare = Math.round((existing.share - sellShares) * 100) / 100
        const costOfSold = Math.round(sellShares * existing.cost * 100) / 100
        newTotalCost = Math.round((totalCostBefore - costOfSold) * 100) / 100
        newCost = existing.cost
        txRealizedProfit = Math.round((sellAmount - costOfSold) * 100) / 100
      }
    } else {
      return {
        success: true,
        holding: {
          fundCode: holding.fundCode,
          amount: existing.amount,
          share: existing.share,
          cost: existing.cost,
          totalCost: existing.total_cost,
          settled: settledToday,
          settleDate: existing.settle_date || '',
          currentDayProfit: existing.current_day_profit || 0,
          accumulatedProfit: existing.accumulated_profit || 0
        }
      }
    }
  }

  const isFullSell = newShare <= 0 && txType === 'sell'

  let finalAmount: number
  let settledState: boolean
  let settleDate: string
  let currentDayProfit: number
  let accumulatedProfit: number

  if (isFullSell) {
    db.prepare(`
      UPDATE user_funds
      SET is_held = 0, share = 0, cost = 0, amount = 0, total_cost = 0, holding_date = NULL
      WHERE user_id = ? AND fund_code = ?
    `).run(userId, holding.fundCode)

    finalAmount = 0
    settledState = false
    settleDate = ''
    currentDayProfit = 0
    accumulatedProfit = 0
  } else if (settledToday && isCurrentlyHeld) {
    db.prepare(`
      UPDATE user_funds
      SET is_held = 1, fund_name = ?, share = ?, cost = ?, amount = ?,
          total_cost = ?, holding_date = ?
      WHERE user_id = ? AND fund_code = ?
    `).run(holding.fundName, newShare, newCost, newAmount, newTotalCost, today, userId, holding.fundCode)

    const reSettleResult = reSettleHoldingForToday(holding.fundCode, newAmount)
    finalAmount = reSettleResult.success ? reSettleResult.settledAmount : newAmount
    settledState = reSettleResult.success
    settleDate = reSettleResult.success ? today : existing.settle_date
    currentDayProfit = reSettleResult.profit
    accumulatedProfit = reSettleResult.success ? reSettleResult.accumulatedProfit : (existing.accumulated_profit || 0)
  } else {
    db.prepare(`
      UPDATE user_funds
      SET is_held = 1, fund_name = ?, share = ?, cost = ?, amount = ?,
          total_cost = ?, holding_date = ?, settled = 0, settle_date = ''
      WHERE user_id = ? AND fund_code = ?
    `).run(holding.fundName, newShare, newCost, newAmount, newTotalCost, today, userId, holding.fundCode)

    const trendRow = db.prepare(`
      SELECT is_updated, day_growth FROM fund_time_trend WHERE code = ? AND date = ?
    `).get(holding.fundCode, today) as { is_updated: number; day_growth: number } | undefined

    if (trendRow && trendRow.is_updated === 1 && trendRow.day_growth !== null) {
      const reSettleResult = reSettleHoldingForToday(holding.fundCode, newAmount)
      finalAmount = reSettleResult.success ? reSettleResult.settledAmount : newAmount
      settledState = reSettleResult.success
      settleDate = reSettleResult.success ? today : ''
      currentDayProfit = reSettleResult.profit
      accumulatedProfit = reSettleResult.success ? reSettleResult.accumulatedProfit : (existing.accumulated_profit || 0)
    } else {
      finalAmount = newAmount
      settledState = false
      settleDate = ''
      currentDayProfit = 0
      accumulatedProfit = existing.accumulated_profit || 0
    }
  }

  if (txType && txShares > 0) {
    recordTransaction({
      userId, fundCode: holding.fundCode, fundName: holding.fundName,
      type: txType, shares: txShares, nav: txNav, amount: txAmount,
      costPrice: txType === 'buy' ? newCost : (existing.cost || holding.cost),
      sharesBefore, sharesAfter: newShare,
      totalCostBefore, totalCostAfter: newTotalCost,
      realizedProfit: txRealizedProfit, date: today
    })

    logger.log(`${txType === 'buy' ? '📈 加仓' : '📉 减仓'}: ${holding.fundCode} ${txType === 'buy' ? '+' : '-'}${txShares}份 ¥${txAmount} 净值${txNav.toFixed(4)}${txRealizedProfit !== 0 ? ` 已实现收益${txRealizedProfit.toFixed(2)}` : ''} 成本价${newCost.toFixed(4)} 总成本${newTotalCost}`)
  }

  return {
    success: true,
    holding: {
      fundCode: holding.fundCode,
      amount: finalAmount,
      share: newShare,
      cost: newCost,
      totalCost: newTotalCost,
      settled: settledState,
      settleDate,
      currentDayProfit,
      accumulatedProfit
    }
  }
}

export function deleteHolding(fundCode: string): void {
  const userId = getCurrentUserId().id
  const stmt = db.prepare('DELETE FROM user_funds WHERE user_id = ? AND fund_code = ?')
  stmt.run(userId, fundCode)
  logger.log(`🗑️ 持仓已删除: ${fundCode}`)
}

export function saveHoldingsBatch(holdingsMap: Map<string, Holding>): void {
  const userId = getCurrentUserId().id

  db.prepare('DELETE FROM user_funds WHERE user_id = ? AND is_held = 1').run(userId)

  const stmt = db.prepare(`
    INSERT INTO user_funds (
      user_id, fund_code, fund_name, is_held, share, cost, amount, holding_date,
      settled, settle_date, accumulated_profit, current_day_profit,
      current_day_profit_rate, profit_type, last_profit_date, added_at
    ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const holding of holdingsMap.values()) {
    stmt.run(
      userId,
      holding.fundCode,
      holding.fundName,
      holding.share,
      holding.cost,
      holding.amount,
      holding.holdingDate,
      holding.settled ? 1 : 0,
      holding.settleDate || null,
      holding.accumulatedProfit || 0,
      holding.currentDayProfit || 0,
      holding.currentDayProfitRate || 0,
      holding.profitType || 'estimate',
      holding.lastProfitDate || null,
      Date.now()
    )
  }

  logger.log(`💾 批量保存持仓: ${holdingsMap.size} 条`)
}

export function updateHoldingCurrentProfit(
  fundCode: string,
  fundName: string,
  currentProfit: number,
  profitRate: number,
  profitType: 'estimate' | 'final'
): boolean {
  const userId = getCurrentUserId().id
  const today = getLocalDate()

  // 防护：已结算为 final 的记录不允许被 estimate 覆盖，避免结算后估值回写导致数据丢失
  if (profitType === 'estimate') {
    const existing = db.prepare(`
      SELECT settled, profit_type, settle_date FROM user_funds
      WHERE user_id = ? AND fund_code = ? AND is_held = 1
    `).get(userId, fundCode) as any
    if (existing && existing.settled && existing.settle_date === today && existing.profit_type === 'final') {
      logger.log(`⛔ 跳过估值覆盖：${fundCode} 今日已结算为 final，忽略 estimate 写入`)
      return false
    }
  }

  const roundedProfit = Math.round(currentProfit * 100) / 100
  const roundedRate = Math.round(profitRate * 100) / 100

  const stmt = db.prepare(`
    UPDATE user_funds
    SET current_day_profit = ?,
        current_day_profit_rate = ?,
        profit_type = ?,
        last_profit_date = ?,
        settled = CASE WHEN settle_date = ? THEN settled ELSE 0 END
    WHERE user_id = ? AND fund_code = ? AND is_held = 1
  `)

  const result = stmt.run(roundedProfit, roundedRate, profitType, today, today, userId, fundCode)
  logger.log(`💰 更新持仓估值收益 ${fundCode}: ${roundedProfit.toFixed(2)} (${roundedRate.toFixed(2)}%)`)
  return result.changes > 0
}

export function settleHoldingProfit(
  fundCode: string,
  fundData: { nav: number; dayGrowth: number },
  options?: { reSettle?: boolean; settleDate?: string }
): { settled: boolean; profit: number; historyId?: number } {
  const userId = getCurrentUserId().id
  const today = options?.settleDate || getLocalDate()

  const holding = db.prepare(`
    SELECT * FROM user_funds WHERE user_id = ? AND fund_code = ? AND is_held = 1
  `).get(userId, fundCode) as any

  if (!holding || holding.amount <= 0) {
    return { settled: false, profit: 0 }
  }

  const dayProfit = Math.round(holding.amount * (fundData.dayGrowth / 100) * 100) / 100
  const dayProfitRate = Math.round(fundData.dayGrowth * 100) / 100
  const openingAmount = Math.round(holding.amount * 100) / 100
  const closingAmount = Math.round((holding.amount + dayProfit) * 100) / 100

  const transaction = db.transaction(() => {
    const existingRecord = db.prepare(`
      SELECT id, day_profit FROM user_funds_profit_history
      WHERE user_id = ? AND fund_code = ? AND profit_date = ? AND profit_type = 'final'
    `).get(userId, fundCode, today) as { id: number; day_profit: number } | undefined

    if (existingRecord) {
      if (!options?.reSettle) {
        logger.log(`⏭️ ${fundCode} 今天已有结算记录，跳过`)
        return { skipped: true } as const
      }

      const oldProfit = existingRecord.day_profit || 0
      const profitDelta = Math.round((dayProfit - oldProfit) * 100) / 100
      const newAccumulatedProfit = Math.round(((holding.accumulated_profit || 0) + profitDelta) * 100) / 100

      db.prepare(`
        UPDATE user_funds_profit_history
        SET opening_amount = ?, closing_amount = ?, day_profit = ?, day_profit_rate = ?,
            nav = ?, day_growth = ?
        WHERE id = ?
      `).run(openingAmount, closingAmount, dayProfit, dayProfitRate, fundData.nav, fundData.dayGrowth, existingRecord.id)

      db.prepare(`
        UPDATE user_funds
        SET amount = ?, accumulated_profit = ?, current_day_profit = ?, current_day_profit_rate = ?,
            settled = 1, settle_date = ?, profit_type = 'final', last_profit_date = ?
        WHERE user_id = ? AND fund_code = ? AND is_held = 1
      `).run(closingAmount, newAccumulatedProfit, dayProfit, dayProfitRate, today, today, userId, fundCode)

      logger.log(`🔄 持仓重新结算 ${fundCode}: 净值${fundData.nav} 涨幅${fundData.dayGrowth}% 收益${dayProfit.toFixed(2)}(旧${oldProfit.toFixed(2)}) 累计${newAccumulatedProfit.toFixed(2)}`)
      return { historyId: existingRecord.id } as const
    }

    const newAccumulatedProfit = Math.round(((holding.accumulated_profit || 0) + dayProfit) * 100) / 100

    const historyResult = db.prepare(`
      INSERT INTO user_funds_profit_history (
        user_id, fund_code, fund_name, profit_date, opening_amount, closing_amount,
        day_profit, day_profit_rate, profit_type, created_at, nav, day_growth
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId, fundCode, holding.fund_name, today,
      openingAmount, closingAmount, dayProfit, dayProfitRate, 'final', Date.now(),
      fundData.nav, fundData.dayGrowth
    )

    db.prepare(`
      UPDATE user_funds
      SET amount = ?, holding_date = ?, accumulated_profit = ?, current_day_profit = ?,
          current_day_profit_rate = ?, settled = 1, settle_date = ?,
          profit_type = 'final', last_profit_date = ?
      WHERE user_id = ? AND fund_code = ? AND is_held = 1
    `).run(closingAmount, today, newAccumulatedProfit, dayProfit, dayProfitRate, today, today, userId, fundCode)

    db.prepare(`
      UPDATE fund_time_trend SET nav = ?, day_growth = ? WHERE code = ? AND date = ?
    `).run(fundData.nav, fundData.dayGrowth, fundCode, today)

    logger.log(`✅ 持仓结算完成 ${fundCode}: 净值${fundData.nav} 涨幅${fundData.dayGrowth}% 收益${dayProfit.toFixed(2)} (累计${newAccumulatedProfit.toFixed(2)})`)
    return { historyId: historyResult.lastInsertRowid as number } as const
  })

  const result = transaction()

  if (result.skipped) {
    return { settled: false, profit: dayProfit }
  }

  return { settled: true, profit: dayProfit, historyId: result.historyId }
}

export function isHoldingSettledToday(fundCode: string): boolean {
  const userId = getCurrentUserId().id
  const today = getLocalDate()
  const row = db.prepare(`
    SELECT settled, settle_date FROM user_funds
    WHERE user_id = ? AND fund_code = ? AND is_held = 1
  `).get(userId, fundCode) as { settled: number; settle_date: string } | undefined
  return !!row && Boolean(row.settled) && row.settle_date === today
}

export function getHoldingRawAmount(fundCode: string): { found: boolean; settledToday: boolean; rawAmount: number } {
  const userId = getCurrentUserId().id
  const today = getLocalDate()
  const row = db.prepare(`
    SELECT amount, settled, settle_date FROM user_funds
    WHERE user_id = ? AND fund_code = ?
  `).get(userId, fundCode) as { amount: number; settled: number; settle_date: string } | undefined

  if (!row) return { found: false, settledToday: false, rawAmount: 0 }
  const settledToday = Boolean(row.settled) && row.settle_date === today
  return { found: true, settledToday, rawAmount: row.amount }
}

export function reSettleHoldingForToday(fundCode: string, baseAmount: number): { success: boolean; profit: number; settledAmount: number; accumulatedProfit: number } {
  const today = getLocalDate()

  const trendData = db.prepare(`
    SELECT day_growth, nav FROM fund_time_trend WHERE code = ? AND date = ?
  `).get(fundCode, today) as { day_growth: number; nav: number } | undefined

  if (!trendData || trendData.day_growth === null || typeof trendData.day_growth !== 'number') {
    logger.log(`⚠️ ${fundCode} 当天无涨跌幅数据，仅更新金额不触发重结算`)
    return { success: false, profit: 0, settledAmount: baseAmount, accumulatedProfit: 0 }
  }

  const userId = getCurrentUserId().id

  const oldProfitRow = db.prepare(`
    SELECT day_profit FROM user_funds_profit_history
    WHERE user_id = ? AND fund_code = ? AND profit_date = ? AND profit_type = 'final'
  `).get(userId, fundCode, today) as { day_profit: number } | undefined

  const oldProfit = oldProfitRow ? oldProfitRow.day_profit : 0
  const originalRounded = Math.round(baseAmount * 100) / 100

  const dayProfit = Math.round(originalRounded * (trendData.day_growth / 100) * 100) / 100
  const closingAmount = Math.round((originalRounded + dayProfit) * 100) / 100

  const currentRow = db.prepare(`
    SELECT accumulated_profit, fund_name FROM user_funds WHERE user_id = ? AND fund_code = ? AND is_held = 1
  `).get(userId, fundCode) as { accumulated_profit: number; fund_name: string } | undefined

  if (!currentRow) {
    logger.log(`⚠️ ${fundCode} 持仓记录不存在，无法重新结算`)
    return { success: false, profit: 0, settledAmount: baseAmount, accumulatedProfit: 0 }
  }

  const currentAccumulated = currentRow.accumulated_profit || 0
  const fundName = currentRow.fund_name || ''
  const profitDelta = Math.round((dayProfit - oldProfit) * 100) / 100
  const newAccumulatedProfit = Math.round((currentAccumulated + profitDelta) * 100) / 100

  const transaction = db.transaction(() => {
    const existingRecord = db.prepare(`
      SELECT id FROM user_funds_profit_history
      WHERE user_id = ? AND fund_code = ? AND profit_date = ? AND profit_type = 'final'
    `).get(userId, fundCode, today) as { id: number } | undefined

    if (existingRecord) {
      db.prepare(`
        UPDATE user_funds_profit_history
        SET opening_amount = ?, closing_amount = ?, day_profit = ?, day_profit_rate = ?,
            nav = ?, day_growth = ?
        WHERE id = ?
      `).run(originalRounded, closingAmount, dayProfit, trendData.day_growth, trendData.nav, trendData.day_growth, existingRecord.id)
    } else {
      db.prepare(`
        INSERT INTO user_funds_profit_history (
          user_id, fund_code, fund_name, profit_date, opening_amount, closing_amount,
          day_profit, day_profit_rate, profit_type, created_at, nav, day_growth
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId, fundCode, fundName, today,
        originalRounded, closingAmount, dayProfit, trendData.day_growth, 'final', Date.now(),
        trendData.nav, trendData.day_growth
      )
    }

    db.prepare(`
      UPDATE user_funds
      SET amount = ?, accumulated_profit = ?, current_day_profit = ?, current_day_profit_rate = ?,
          settled = 1, settle_date = ?, profit_type = 'final', last_profit_date = ?
      WHERE user_id = ? AND fund_code = ? AND is_held = 1
    `).run(closingAmount, newAccumulatedProfit, dayProfit, trendData.day_growth, today, today, userId, fundCode)
  })

  transaction()

  logger.log(`🔄 重新结算 ${fundCode}: 基础金额=${originalRounded} 涨幅=${trendData.day_growth}% 新收益=${dayProfit.toFixed(2)}(旧=${oldProfit.toFixed(2)}) 收盘=${closingAmount}`)
  return { success: true, profit: dayProfit, settledAmount: closingAmount, accumulatedProfit: newAccumulatedProfit }
}

export function getHoldingProfitHistory(fundCode?: string): HoldingProfitHistory[] {
  const userId = getCurrentUserId().id

  let query = `
    SELECT * FROM user_funds_profit_history
    WHERE user_id = ?
  `
  const params: any[] = [userId]

  if (fundCode) {
    query += ' AND fund_code = ?'
    params.push(fundCode)
  }

  query += ' ORDER BY profit_date DESC, created_at DESC'

  const stmt = db.prepare(query)
  const results = stmt.all(...params) as any[]

  return results.map(row => ({
    id: row.id,
    userId: row.user_id,
    fundCode: row.fund_code,
    fundName: row.fund_name,
    profitDate: row.profit_date,
    openingAmount: row.opening_amount,
    closingAmount: row.closing_amount,
    dayProfit: row.day_profit,
    dayProfitRate: row.day_profit_rate,
    profitType: row.profit_type,
    nav: row.nav,
    dayGrowth: row.day_growth,
    createdAt: row.created_at
  }))
}

export function getHoldingProfitStats(fundCode?: string): {
  totalProfit: number
  totalProfitRate: number
  settledDays: number
  historyRecords: number
} {
  const userId = getCurrentUserId().id

  let query = `
    SELECT
      SUM(day_profit) as total_profit,
      COUNT(DISTINCT profit_date) as settled_days
    FROM user_funds_profit_history
    WHERE user_id = ? AND profit_type = 'final'
  `
  let params: any[] = [userId]

  if (fundCode) {
    query += ' AND fund_code = ?'
    params.push(fundCode)
  }

  const stmt = db.prepare(query)
  const result = stmt.get(...params) as any

  return {
    totalProfit: result.total_profit || 0,
    totalProfitRate: 0,
    settledDays: result.settled_days || 0,
    historyRecords: 0
  }
}

export function getAllProfitHistory(): Array<{
  profitDate: string
  fundCode: string
  fundName: string
  dayProfit: number
  dayProfitRate: number
  openingAmount: number
  closingAmount: number
}> {
  const userId = getCurrentUserId().id

  const stmt = db.prepare(`
    SELECT profit_date, fund_code, fund_name, day_profit, day_profit_rate,
           opening_amount, closing_amount, profit_type
    FROM user_funds_profit_history
    WHERE user_id = ?
    ORDER BY profit_date DESC, 
             CASE WHEN profit_type = 'final' THEN 0 ELSE 1 END
  `)

  const results = stmt.all(userId) as any[]
  const seen = new Map<string, any>()

  results.forEach(row => {
    const key = `${row.profit_date}-${row.fund_code}`
    if (!seen.has(key)) {
      seen.set(key, row)
    }
  })

  return Array.from(seen.values()).map(row => ({
    profitDate: row.profit_date,
    fundCode: row.fund_code,
    fundName: row.fund_name,
    dayProfit: row.day_profit,
    dayProfitRate: row.day_profit_rate,
    openingAmount: row.opening_amount,
    closingAmount: row.closing_amount
  }))
}

export function getHeldFundTotalAmount(): number {
  const userId = getCurrentUserId().id

  const result = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM user_funds
    WHERE user_id = ? AND is_held = 1 AND amount > 0
  `).get(userId) as any

  return result.total || 0
}

export function hasFundDataForDate(date: string): boolean {
  const result = db.prepare(`
    SELECT 1 FROM fund_time_trend WHERE date = ? LIMIT 1
  `).get(date) as any
  return !!result
}

export function initDailySettlement(date?: string): boolean {
  const targetDate = date || getLocalDate()

  // 结算初始化设计说明：
  // 新交易日开始时将所有持仓的 settled/current_day_profit 重置为 0，
  // 在初始化完成到开盘（9:30）之间的时间段内，当日收益会显示为 0，
  // 这是正常设计 —— 新的一天尚未产生任何收益数据。
  // 如果上一交易日已结算但新交易日尚未初始化（如周末、节假日、盘前），
  // 则前端仍使用上一次结算后的数据（涨跌幅、收益等），直到本函数执行重置。
  const result = db.prepare(`
    UPDATE user_funds
    SET settle_date = ?,
        settled = 0,
        current_day_profit = 0,
        current_day_profit_rate = 0,
        profit_type = 'estimate'
    WHERE is_held = 1 AND amount > 0
      AND (settle_date IS NULL OR settle_date < ? OR (settle_date = ? AND settled = 0))
  `).run(targetDate, targetDate, targetDate)

  logger.log(`📅 初始化 ${targetDate} 结算状态: ${result.changes} 条持仓`)
  return result.changes > 0
}

export function getUnsettledHoldings(settleDate?: string): Array<{
  fundCode: string
  fundName: string
  amount: number
}> {
  const userId = getCurrentUserId().id
  const targetDate = settleDate || getLocalDate()

  logger.log(`📊 getUnsettledHoldings: userId=${userId}, targetDate=${targetDate}`)

  const stmt = db.prepare(`
    SELECT uf.fund_code, COALESCE(NULLIF(NULLIF(uf.fund_name, ''), uf.fund_code), fi.name, '') as fund_name, uf.amount
    FROM user_funds uf
    LEFT JOIN fund_info fi ON uf.fund_code = fi.code
    WHERE uf.user_id = ? AND uf.is_held = 1 AND uf.amount > 0
      AND (uf.settled = 0 OR uf.settled IS NULL OR uf.settle_date IS NULL OR uf.settle_date = ? OR uf.settle_date < ?)
  `)

  const holdings = stmt.all(userId, targetDate, targetDate) as any[]
  logger.log(`📊 查询结果: ${holdings.length} 条`)
  return holdings.map(h => ({
    fundCode: h.fund_code,
    fundName: h.fund_name,
    amount: h.amount
  }))
}

export function executeBatchSettlement(settleDate?: string): {
  processed: number
  profits: Array<{ fundCode: string; profit: number; historyId: number }>
} {
  const userId = getCurrentUserId().id
  const targetDate = settleDate || getLocalDate()

  const stmt = db.prepare(`
    SELECT uf.*, COALESCE(NULLIF(NULLIF(uf.fund_name, ''), uf.fund_code), fi.name, '') as fund_name
    FROM user_funds uf
    LEFT JOIN fund_info fi ON uf.fund_code = fi.code
    WHERE uf.user_id = ? AND uf.is_held = 1 AND uf.amount > 0
      AND (uf.settle_date IS NULL OR uf.settle_date < ? OR uf.settled = 0)
  `)

  const holdings = stmt.all(userId, targetDate) as any[]

  const results = {
    processed: 0,
    profits: [] as Array<{ fundCode: string; profit: number; historyId: number }>
  }

  for (const holding of holdings) {
    try {
      const trendData = db.prepare(`
        SELECT day_growth, nav FROM fund_time_trend WHERE code = ? AND date = ?
      `).get(holding.fund_code, targetDate) as any

      if (trendData && trendData.day_growth !== null && typeof trendData.day_growth === 'number' && !isNaN(trendData.day_growth)) {
        const result = settleHoldingProfit(holding.fund_code, {
          nav: trendData.nav || 0,
          dayGrowth: trendData.day_growth
        })

        if (result.settled) {
          results.profits.push({
            fundCode: holding.fund_code,
            profit: result.profit,
            historyId: result.historyId!
          })
          results.processed++
        }
      }
    } catch (error) {
      logger.error(`结算持仓 ${holding.fund_code} 失败:`, error)
    }
  }

  logger.log(`📊 批量结算完成: 处理 ${results.processed} 条，结算 ${results.profits.length} 条`)
  return results
}

export const executeBatchSettlementFromDb = executeBatchSettlement

export function getUserFunds(): Map<string, UserFund> {
  const userId = getCurrentUserId().id
  const stmt = db.prepare(`
    SELECT uf.*, COALESCE(NULLIF(NULLIF(uf.fund_name, ''), uf.fund_code), fi.name, '') as fund_name
    FROM user_funds uf
    LEFT JOIN fund_info fi ON uf.fund_code = fi.code
    WHERE uf.user_id = ? AND (uf.status IS NULL OR uf.status != 'd')
  `)
  const results = stmt.all(userId) as any[]

  const funds = new Map<string, UserFund>()
  for (const row of results) {
    funds.set(row.fund_code, {
      fundCode: row.fund_code,
      fundName: row.fund_name,
      isHeld: Boolean(row.is_held),
      share: row.share,
      cost: row.cost,
      amount: row.amount,
      holdingDate: row.holding_date,
      settled: Boolean(row.settled),
      settleDate: row.settle_date,
      accumulatedProfit: row.accumulated_profit || 0,
      currentDayProfit: row.current_day_profit || 0,
      currentDayProfitRate: row.current_day_profit_rate || 0,
      profitType: row.profit_type || 'estimate',
      lastProfitDate: row.last_profit_date,
      addedAt: row.added_at
    })
  }

  return funds
}

export function getHeldFunds(): Map<string, UserFund> {
  const userId = getCurrentUserId().id
  const stmt = db.prepare(`
    SELECT uf.*, COALESCE(NULLIF(NULLIF(uf.fund_name, ''), uf.fund_code), fi.name, '') as fund_name
    FROM user_funds uf
    LEFT JOIN fund_info fi ON uf.fund_code = fi.code
    WHERE uf.user_id = ? AND uf.is_held = 1 AND (uf.status IS NULL OR uf.status != 'd')
  `)
  const results = stmt.all(userId) as any[]

  const funds = new Map<string, UserFund>()
  for (const row of results) {
    funds.set(row.fund_code, {
      fundCode: row.fund_code,
      fundName: row.fund_name,
      isHeld: true,
      share: row.share,
      cost: row.cost,
      amount: row.amount,
      holdingDate: row.holding_date,
      settled: Boolean(row.settled),
      settleDate: row.settle_date,
      accumulatedProfit: row.accumulated_profit || 0,
      currentDayProfit: row.current_day_profit || 0,
      currentDayProfitRate: row.current_day_profit_rate || 0,
      profitType: row.profit_type || 'estimate',
      lastProfitDate: row.last_profit_date,
      addedAt: row.added_at
    })
  }

  return funds
}

export function getFavoriteFunds(): Map<string, UserFund> {
  const userId = getCurrentUserId().id
  const stmt = db.prepare(`
    SELECT uf.*, COALESCE(NULLIF(NULLIF(uf.fund_name, ''), uf.fund_code), fi.name, '') as fund_name
    FROM user_funds uf
    LEFT JOIN fund_info fi ON uf.fund_code = fi.code
    WHERE uf.user_id = ? AND uf.is_held = 0
  `)
  const results = stmt.all(userId) as any[]

  const funds = new Map<string, UserFund>()
  for (const row of results) {
    funds.set(row.fund_code, {
      fundCode: row.fund_code,
      fundName: row.fund_name,
      isHeld: false,
      share: 0,
      cost: 0,
      amount: 0,
      addedAt: row.added_at
    })
  }

  return funds
}

export function addUserFund(fundCode: string, fundName?: string): boolean {
  const userId = getCurrentUserId().id
  const now = Date.now()
  const name = fundName || getFundNameFromInfo(fundCode)

  try {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO user_funds (user_id, fund_code, fund_name, is_held, status, share, cost, amount, added_at)
      VALUES (?, ?, ?, 0, 'a', 0, 0, 0, ?)
    `)
    const result = stmt.run(userId, fundCode, name, now)
    logger.log(`➕ 添加自选基金: ${fundCode}`)
    return result.changes > 0
  } catch (error) {
    logger.error(`添加基金失败: ${fundCode}`, error)
    return false
  }
}

export function deleteUserFund(fundCode: string): boolean {
  const userId = getCurrentUserId().id
  const stmt = db.prepare('DELETE FROM user_funds WHERE user_id = ? AND fund_code = ?')
  const result = stmt.run(userId, fundCode)
  logger.log(`🗑️ 删除基金: ${fundCode}`)
  return result.changes > 0
}

export function setHolding(
  fundCode: string,
  fundName: string,
  share: number,
  cost: number,
  amount: number
): SaveHoldingResult {
  const userId = getCurrentUserId().id
  const today = getLocalDate()

  try {
    const existing = db.prepare(`
      SELECT settled, settle_date, accumulated_profit, current_day_profit,
             share, cost, total_cost, is_held
      FROM user_funds WHERE user_id = ? AND fund_code = ?
    `).get(userId, fundCode) as {
      settled: number; settle_date: string; accumulated_profit: number;
      current_day_profit: number; share: number; cost: number;
      total_cost: number; is_held: number
    } | undefined

    if (!existing) {
      return { success: false, error: `基金 ${fundCode} 不存在，请先添加到自选` }
    }

    const roundedShare = Math.round(share * 100) / 100
    const roundedCost = Math.round(cost * 10000) / 10000
    const roundedAmount = Math.round(amount * 100) / 100
    const computedTotalCost = Math.round(roundedShare * roundedCost * 100) / 100

    const settledToday = Boolean(existing.settled) && existing.settle_date === today

    if (settledToday) {
      db.prepare(`
        UPDATE user_funds
        SET fund_name = ?, is_held = 1, share = ?, cost = ?, amount = ?,
            total_cost = ?, holding_date = ?
        WHERE user_id = ? AND fund_code = ?
      `).run(fundName, roundedShare, roundedCost, roundedAmount, computedTotalCost, today, userId, fundCode)

      const reSettleResult = reSettleHoldingForToday(fundCode, roundedAmount)

      return {
        success: true,
        holding: {
          fundCode,
          amount: reSettleResult.success ? reSettleResult.settledAmount : roundedAmount,
          share: roundedShare,
          cost: roundedCost,
          totalCost: computedTotalCost,
          settled: true,
          settleDate: today,
          currentDayProfit: reSettleResult.profit,
          accumulatedProfit: reSettleResult.success ? reSettleResult.accumulatedProfit : (existing.accumulated_profit || 0)
        }
      }
    }

    db.prepare(`
      UPDATE user_funds
      SET fund_name = ?, is_held = 1, share = ?, cost = ?, amount = ?,
          total_cost = ?, holding_date = ?, settled = 0, settle_date = ?
      WHERE user_id = ? AND fund_code = ?
    `).run(fundName, roundedShare, roundedCost, roundedAmount, computedTotalCost, today, today, userId, fundCode)

    const trendRow = db.prepare(`
      SELECT is_updated, day_growth FROM fund_time_trend WHERE code = ? AND date = ?
    `).get(fundCode, today) as { is_updated: number; day_growth: number } | undefined

    if (trendRow && trendRow.is_updated === 1 && trendRow.day_growth !== null) {
      const reSettleResult = reSettleHoldingForToday(fundCode, roundedAmount)
      logger.log(`💰 设置持仓: ${fundCode} (净值已更新，立即结算${reSettleResult.success ? '成功' : '失败'})`)
      return {
        success: true,
        holding: {
          fundCode,
          amount: reSettleResult.success ? reSettleResult.settledAmount : roundedAmount,
          share: roundedShare,
          cost: roundedCost,
          totalCost: computedTotalCost,
          settled: reSettleResult.success,
          settleDate: reSettleResult.success ? today : '',
          currentDayProfit: reSettleResult.profit,
          accumulatedProfit: reSettleResult.success ? reSettleResult.accumulatedProfit : (existing.accumulated_profit || 0)
        }
      }
    }

    logger.log(`💰 设置持仓: ${fundCode} 份额:${roundedShare} 成本:${roundedCost} 金额:${roundedAmount} 总成本:${computedTotalCost} (待结算)`)
    return {
      success: true,
      holding: {
        fundCode,
        amount: roundedAmount,
        share: roundedShare,
        cost: roundedCost,
        totalCost: computedTotalCost,
        settled: false,
        settleDate: '',
        currentDayProfit: 0,
        accumulatedProfit: existing.accumulated_profit || 0
      }
    }
  } catch (error) {
    logger.error(`设置持仓失败: ${fundCode}`, error)
    return { success: false, error: String(error) }
  }
}

export function removeHolding(fundCode: string): boolean {
  const userId = getCurrentUserId().id

  try {
    const stmt = db.prepare(`
      UPDATE user_funds
      SET is_held = 0, share = 0, cost = 0, amount = 0, total_cost = 0, holding_date = NULL
      WHERE user_id = ? AND fund_code = ?
    `)
    const result = stmt.run(userId, fundCode)
    logger.log(`📉 取消持仓: ${fundCode}`)
    return result.changes > 0
  } catch (error) {
    logger.error(`取消持仓失败: ${fundCode}`, error)
    return false
  }
}

export function getTransactions(fundCode?: string, limit?: number): Transaction[] {
  const userId = getCurrentUserId().id

  let query = 'SELECT * FROM user_fund_transactions WHERE user_id = ?'
  const params: any[] = [userId]

  if (fundCode) {
    query += ' AND fund_code = ?'
    params.push(fundCode)
  }

  query += ' ORDER BY created_at DESC'

  if (limit) {
    query += ' LIMIT ?'
    params.push(limit)
  }

  const rows = db.prepare(query).all(...params) as any[]

  return rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    fundCode: row.fund_code,
    fundName: row.fund_name,
    type: row.type,
    shares: row.shares,
    nav: row.nav,
    amount: row.amount,
    costPrice: row.cost_price,
    sharesBefore: row.shares_before,
    sharesAfter: row.shares_after,
    totalCostBefore: row.total_cost_before,
    totalCostAfter: row.total_cost_after,
    realizedProfit: row.realized_profit,
    transactionDate: row.transaction_date,
    remark: row.remark,
    createdAt: row.created_at
  }))
}

export function getHoldingCostInfo(fundCode: string): { totalCost: number; costPrice: number; share: number } | null {
  const userId = getCurrentUserId().id
  const row = db.prepare(`
    SELECT total_cost, cost, share FROM user_funds WHERE user_id = ? AND fund_code = ? AND is_held = 1
  `).get(userId, fundCode) as { total_cost: number; cost: number; share: number } | undefined

  if (!row) return null

  return {
    totalCost: row.total_cost || (row.share * row.cost),
    costPrice: row.cost,
    share: row.share
  }
}

export function migrateExistingHoldings(): { migrated: number } {
  const today = getLocalDate()
  const now = Date.now()

  const rows = db.prepare(`
    SELECT uf.user_id, uf.fund_code, uf.fund_name, uf.share, uf.cost, uf.amount, uf.total_cost
    FROM user_funds uf
    WHERE uf.is_held = 1 AND uf.share > 0 AND uf.cost > 0 AND uf.total_cost = 0
  `).all() as any[]

  const insertTx = db.prepare(`
    INSERT INTO user_fund_transactions (
      user_id, fund_code, fund_name, type, shares, nav, amount, cost_price,
      shares_before, shares_after, total_cost_before, total_cost_after,
      realized_profit, transaction_date, remark, created_at
    ) VALUES (?, ?, ?, 'migrate', ?, ?, ?, ?, 0, ?, 0, ?, 0, ?, '数据迁移-历史重建', ?)
  `)

  const updateCost = db.prepare(`
    UPDATE user_funds SET total_cost = ?, accumulated_profit = ? WHERE user_id = ? AND fund_code = ?
  `)

  let migrated = 0

  const migrateTx = db.transaction(() => {
    for (const row of rows) {
      const totalCost = reconstructTotalCostFromHistory(row.user_id, row.fund_code)
      const correctProfit = Math.round((row.amount - totalCost) * 100) / 100

      insertTx.run(
        row.user_id, row.fund_code, row.fund_name,
        row.share, row.cost, totalCost, row.cost,
        row.share, totalCost, today, now
      )

      updateCost.run(totalCost, correctProfit, row.user_id, row.fund_code)
      migrated++
    }
  })

  migrateTx()
  logger.log(`🔄 持仓数据迁移完成(历史重建): ${migrated} 条记录`)
  return { migrated }
}

function reconstructTotalCostFromHistory(userId: string, fundCode: string): number {
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

export function updateUserFund(fundCode: string, updates: Partial<UserFund>): boolean {
  const userId = getCurrentUserId().id

  const fields: string[] = []
  const values: any[] = []

  if (updates.fundName !== undefined) {
    fields.push('fund_name = ?')
    values.push(updates.fundName)
  }
  if (updates.isHeld !== undefined) {
    fields.push('is_held = ?')
    values.push(updates.isHeld ? 1 : 0)
  }
  if (updates.share !== undefined) {
    fields.push('share = ?')
    values.push(updates.share)
  }
  if (updates.cost !== undefined) {
    fields.push('cost = ?')
    values.push(updates.cost)
  }
  if (updates.amount !== undefined) {
    fields.push('amount = ?')
    values.push(updates.amount)
  }

  if (fields.length === 0) return false

  values.push(userId, fundCode)
  const stmt = db.prepare(`UPDATE user_funds SET ${fields.join(', ')} WHERE user_id = ? AND fund_code = ?`)
  const result = stmt.run(...values)
  return result.changes > 0
}

export function addUserFundsBatch(funds: Array<{ code: string; name?: string; isHeld?: boolean }>): number {
  const userId = getCurrentUserId().id
  const now = Date.now()
  const today = getLocalDate()

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO user_funds (user_id, fund_code, fund_name, is_held, status, share, cost, amount, added_at, settled, settle_date)
    VALUES (?, ?, ?, ?, 'a', 0, 0, 0, ?, 0, ?)
  `)

  const transaction = db.transaction(() => {
    for (const fund of funds) {
      stmt.run(userId, fund.code, fund.name || '', fund.isHeld ? 1 : 0, now, today)
    }
  })

  transaction()
  logger.log(`➕ 批量添加自选基金: ${funds.length} 条`)
  return funds.length
}

export function isFundInUserList(fundCode: string): boolean {
  const userId = getCurrentUserId().id
  const stmt = db.prepare('SELECT 1 FROM user_funds WHERE user_id = ? AND fund_code = ?')
  return !!stmt.get(userId, fundCode)
}

export function isFundHeld(fundCode: string): boolean {
  const userId = getCurrentUserId().id
  const stmt = db.prepare('SELECT 1 FROM user_funds WHERE user_id = ? AND fund_code = ? AND is_held = 1')
  return !!stmt.get(userId, fundCode)
}

export function getAllUserFundCodes(): string[] {
  const stmt = db.prepare('SELECT code FROM fund_info')
  const results = stmt.all() as Array<{ code: string }>
  logger.log(`getAllUserFundCodes: fund_info=${results.length}`)
  return results.map(r => r.code)
}

export function checkAndImportDefaultFunds(): boolean {
  const userId = getCurrentUserId().id

  const prefs = db.prepare('SELECT default_funds_imported FROM user_preferences WHERE user_id = ?').get(userId) as any
  if (prefs && prefs.default_funds_imported) {
    logger.log('📋 用户已导入过默认基金')
    return false
  }

  const existingFunds = db.prepare('SELECT COUNT(*) as count FROM user_funds WHERE user_id = ?').get(userId) as { count: number }
  if (existingFunds.count > 0) {
    db.prepare('UPDATE user_preferences SET default_funds_imported = 1 WHERE user_id = ?').run(userId)
    logger.log('📋 用户已有自选数据，跳过默认导入')
    return false
  }

  const recommendCodes = getRecommendFundCodes()
  if (recommendCodes.length === 0) {
    logger.log('⚠️ 没有推荐基金，跳过默认导入')
    return false
  }

  return importFundsForUser(userId, recommendCodes)
}

function importFundsForUser(userId: string, codes: string[]): boolean {
  const now = Date.now()
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO user_funds (user_id, fund_code, fund_name, is_held, share, cost, amount, added_at)
    VALUES (?, ?, ?, 0, 0, 0, 0, ?)
  `)

  const transaction = db.transaction(() => {
    for (const code of codes) {
      insertStmt.run(userId, code, getFundNameFromInfo(code), now)
    }
    const updateResult = db.prepare('UPDATE user_preferences SET default_funds_imported = 1, last_updated = ? WHERE user_id = ?')
      .run(now, userId)

    if (updateResult.changes === 0) {
      db.prepare(`
        INSERT INTO user_preferences (user_id, default_funds_imported, last_updated, hide_amount, view_mode, sort_field, sort_direction, filter_mode, migrated_from_local)
        VALUES (?, 1, ?, 0, 'list', 'dayGrowth', 'desc', 'all', 0)
      `).run(userId, now)
    }
  })

  transaction()
  logger.log(`✅ 导入默认基金到用户自选: ${codes.length} 条`)
  return true
}
