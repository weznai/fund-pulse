/**
 * 定时结算任务
 * 功能：
 * 1. 初始化当天结算状态
 * 2. 获取到最终净值后触发结算（由 estimate.ts 调用）
 * 3. 手动结算
 */

import { logger } from '../logger.js'
import {
  getLocalDate,
  getAllUsers,
  UserIdType,
  UserId,
  userContext,
  initDailySettlement,
  settleHoldingProfit,
  executeBatchSettlementFromDb,
  getUnsettledHoldings,
  hasFinalGrowth,
  updateFinalGrowth,
  getFundInfo,
  isFundHeld,
  isNavDateAlreadySettled,
  getLatestGlobalEstimateCache,
  getGlobalEstimateCache,
  updateSystemTradingDays
} from '../db.js'
import { checkTradingDay } from '../services/holidayService.js'
import { fetchFinalNavFromMobApi } from '../external/eastmoney.js'

function isQDIIFund(code: string): boolean {
  const info = getFundInfo(code)
  if (!info) return false
  if (info.ftype && /qdii/i.test(info.ftype)) return true
  if (info.name && /qdii/i.test(info.name)) return true
  if (info.ftype && /海外/i.test(info.ftype)) return true
  return false
}

function isEstimateOnlyFund(code: string): boolean {
  const info = getFundInfo(code)
  if (!info) return false
  return info.data_source === 'estimate_only'
}

let stopScheduledSettlementTimer: (() => void) | null = null

/**
 * 从东方财富获取最终涨跌幅
 */
async function fetchFinalGrowth(code: string): Promise<{ nav: number; dayGrowth: number; navDate?: string } | null> {
  try {
    const response = await fetch(`http://fundf10.eastmoney.com/jjjz_${code}.html`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    const html = await response.text()

    const contentMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i)

    if (!contentMatch) return null

    const content = contentMatch[1].replace(/\\'/g, "'").replace(/\\"/g, '"')
    const rowMatches = content.match(/<tr[\s\S]*?<\/tr>/gi) || []
    const dataRows = rowMatches.filter(r => /<td[^>]*>/i.test(r))

    if (dataRows.length === 0) return null

    const row = dataRows[0]
    const cells = row?.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []
    if (cells.length < 4) return null

    const getText = (td: string) => td.replace(/<[^>]+>/g, '').trim()
    const navDateStr = getText(cells[0] || '')
    const navStr = getText(cells[1] || '')
    const growthStr = getText(cells[3] || '')

    const nav = parseFloat(navStr)
    const growthMatch = growthStr.match(/([-+]?\d+(?:\.\d+)?)\s*%/)
    const dayGrowth = growthMatch ? parseFloat(growthMatch[1]) : 0

    if (isNaN(nav)) return null

    return { nav, dayGrowth, navDate: navDateStr }
  } catch (error) {
    logger.error(`获取 ${code} 最终涨跌幅失败:`, error)
    return null
  }
}

/**
 * 对所有用户结算指定基金
 */
export async function settleFundForAllUsers(
  fundCode: string,
  fundData: { nav: number; growth: number },
  settleDate: string,
  options?: { reSettle?: boolean }
): Promise<{ success: boolean; hasError: boolean }> {
  const users = getAllUsers()
  let totalSettled = 0
  let totalSkipped = 0
  let hasError = false

  for (const user of users) {
    try {
      const targetUserId: UserId = {
        id: user.id,
        type: UserIdType.REGISTERED,
        label: user.label || undefined
      }
      userContext.run(targetUserId, () => {
        if (options?.reSettle) {
          if (!isFundHeld(fundCode)) return
        } else {
          const unsettledHoldings = getUnsettledHoldings(settleDate)
          if (!unsettledHoldings.find(h => h.fundCode === fundCode)) return
        }

        const result = settleHoldingProfit(fundCode, {
          nav: fundData.nav,
          dayGrowth: fundData.growth
        }, { ...options, settleDate })

        if (result.settled) {
          totalSettled++
          logger.log(`💰 用户${user.id} ${fundCode} 结算成功: 收益 ${result.profit.toFixed(2)}`)
        } else {
          totalSkipped++
          logger.log(`⏭️ 用户${user.id} ${fundCode} 结算跳过: ${result.profit.toFixed(2)} (可能已结算)`)
        }
      })
    } catch (error) {
      hasError = true
      logger.error(`用户${user.id} ${fundCode} 结算失败:`, error)
    }
  }

  if (totalSettled > 0 || totalSkipped > 0) {
    logger.log(`📊 ${fundCode} 结算完成: 成功${totalSettled} 跳过${totalSkipped}`)
  }

  const hasNoHoldings = totalSettled === 0 && totalSkipped === 0 && !hasError

  return {
    success: totalSettled > 0 || hasNoHoldings,
    hasError
  }
}

/**
 * 启动定时结算任务 - 初始化当天结算状态
 */
export function startScheduledSettlement(): () => void {
  const executedFlags = new Set<string>()
  let lastCleanupDate = ''

  function cleanupOldFlags(): void {
    const now = new Date()
    const today = getLocalDate(now)

    if (lastCleanupDate === today) return
    lastCleanupDate = today

    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() - 3)
    const cutoffKey = getLocalDate(cutoff)
    for (const key of executedFlags) {
      if (key < cutoffKey) executedFlags.delete(key)
    }
  }

  function checkAndInitSettlement(): void {
    const now = new Date()
    const today = getLocalDate(now)

    if (!checkTradingDay(today)) return

    if (now.getHours() < 8) return

    const initKey = `${today}_init`
      if (!executedFlags.has(initKey)) {
        executedFlags.add(initKey)
        updateSystemTradingDays()
        logger.log(`📅 检查并初始化 ${today} 结算状态...`)
      const users = getAllUsers()
      for (const user of users) {
        const targetUserId: UserId = {
          id: user.id,
          type: UserIdType.REGISTERED,
          label: user.label || undefined
        }
        userContext.run(targetUserId, () => {
          initDailySettlement(today)
        })
      }
    }
  }

  checkAndInitSettlement()

  const checkInterval = () => {
    const now = new Date()
    const today = getLocalDate(now)

    if (!checkTradingDay(today)) return

    cleanupOldFlags()
    checkAndInitSettlement()
  }

  const timer = setInterval(checkInterval, 60 * 1000)

  checkInterval()

  return () => clearInterval(timer)
}

export function stopSettlement() {
  if (stopScheduledSettlementTimer) {
    stopScheduledSettlementTimer()
    stopScheduledSettlementTimer = null
    logger.log('Scheduled settlement task stopped')
  }
}

export async function manualSettlement(settleDate?: string): Promise<{
  processed: number
  settled: number
  profits: Array<{ fundCode: string; profit: number }>
}> {
  const targetDate = settleDate || getLocalDate()
  logger.log(`Manual settlement triggered: ${targetDate}`)

  const users = getAllUsers()
  const allFundCodes = new Set<string>()
  let totalSettled = 0
  let totalProcessed = 0
  const allProfits: Array<{ fundCode: string; profit: number }> = []

  const NO_HISTORY_NAV_CODES = new Set(['968049'])

  for (const user of users) {
    const targetUserId: UserId = {
      id: user.id,
      type: user.type as UserIdType,
      label: user.label || undefined
    }
    userContext.run(targetUserId, () => {
      const unsettledHoldings = getUnsettledHoldings(targetDate)
      for (const holding of unsettledHoldings) {
        allFundCodes.add(holding.fundCode)
      }
    })
  }

  for (const fundCode of allFundCodes) {
    const estOnly = isEstimateOnlyFund(fundCode)

    if (!hasFinalGrowth(fundCode, targetDate)) {
      if (estOnly) {
        logger.log(`📡 ${fundCode} 估值数据源基金，尝试MobAPI获取...`)
        const mobData = await fetchFinalNavFromMobApi(fundCode)
        if (mobData) {
          updateFinalGrowth(fundCode, targetDate, mobData.nav, mobData.growth)
          logger.log(`✅ ${fundCode} MobAPI: nav=${mobData.nav}, growth=${mobData.growth}% (净值日: ${mobData.date})`)
        } else {
          logger.log(`⚠️ ${fundCode} MobAPI获取失败`)
        }
        continue
      }

      logger.log(`📊 ${fundCode} 无最终涨跌幅，尝试获取...`)
      const fundData = await fetchFinalGrowth(fundCode)
      if (fundData) {
        if (isQDIIFund(fundCode)) {
          if (fundData.navDate && fundData.navDate !== targetDate) {
            if (isNavDateAlreadySettled(fundCode, fundData.navDate, fundData.nav, fundData.dayGrowth)) {
              logger.log(`🌍 ${fundCode} QDII基金净值 ${fundData.navDate} 已在之前结算中使用，跳过手动结算`)
              continue
            }
            const lastEntry = getLatestGlobalEstimateCache(fundCode, targetDate)
            if (lastEntry && lastEntry.nav === fundData.nav && lastEntry.dayGrowth === fundData.dayGrowth) {
              logger.log(`🌍 ${fundCode} QDII基金最新净值与最近记录一致，海外休市，跳过手动结算`)
              continue
            }
          }
          updateFinalGrowth(fundCode, targetDate, fundData.nav, fundData.dayGrowth)
          logger.log(`✅ ${fundCode} QDII使用东方财富涨幅结算: nav=${fundData.nav}, growth=${fundData.dayGrowth}%`)
          continue
        }
        updateFinalGrowth(fundCode, targetDate, fundData.nav, fundData.dayGrowth)
        logger.log(`✅ ${fundCode} 涨跌幅已补充: nav=${fundData.nav}, growth=${fundData.dayGrowth}%${fundData.navDate ? ` (净值日: ${fundData.navDate})` : ''}`)
      } else {
        logger.log(`⚠️ ${fundCode} 获取涨跌幅失败`)
      }
    }
  }

  for (const user of users) {
    try {
      const targetUserId: UserId = {
        id: user.id,
        type: UserIdType.REGISTERED,
        label: user.label || undefined
      }
      userContext.run(targetUserId, () => {
        const result = executeBatchSettlementFromDb(targetDate)
        totalProcessed += result.processed
        totalSettled += result.profits.length
        allProfits.push(...result.profits)
      })
    } catch (error) {
      logger.error(`Manual settlement failed for user ${user.id}:`, error)
    }
  }

  if (totalSettled > 0) {
    updateSystemTradingDays()
  }

  logger.log(`Manual settlement completed: processed ${totalProcessed}, settled ${totalSettled}`)
  return { processed: totalProcessed, settled: totalSettled, profits: allProfits }
}
