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

let stopScheduledSettlementTimer: (() => void) | null = null

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
    if (!hasFinalGrowth(fundCode, targetDate)) {
      const isQDII = isQDIIFund(fundCode)
      logger.log(`📡 ${fundCode} 尝试MobAPI获取净值...`)
      const mobData = await fetchFinalNavFromMobApi(fundCode)
      if (!mobData) {
        logger.log(`⚠️ ${fundCode} MobAPI获取失败`)
        continue
      }

      // 非 QDII 基金净值日期必须是目标结算日
      if (!isQDII && mobData.date !== targetDate) {
        logger.log(`⏳ ${fundCode} 净值日期 ${mobData.date} 非 ${targetDate}(非QDII)，跳过手动结算`)
        continue
      }

      if (isQDII && mobData.date !== targetDate) {
        if (isNavDateAlreadySettled(fundCode, mobData.date, mobData.nav, mobData.growth)) {
          logger.log(`🌍 ${fundCode} QDII基金净值 ${mobData.date} 已在之前结算中使用，跳过手动结算`)
          continue
        }
        const lastEntry = getLatestGlobalEstimateCache(fundCode, targetDate)
        if (lastEntry && lastEntry.nav === mobData.nav && lastEntry.dayGrowth === mobData.growth) {
          logger.log(`🌍 ${fundCode} QDII基金最新净值与最近记录一致，海外休市，跳过手动结算`)
          continue
        }
      }

      updateFinalGrowth(fundCode, targetDate, mobData.nav, mobData.growth)
      logger.log(`✅ ${fundCode} 涨跌幅已补充: nav=${mobData.nav}, growth=${mobData.growth}% (净值日: ${mobData.date})`)
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
