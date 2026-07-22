/**
 * 定时估值任务
 * 功能：
 * - 9:25-16:00: 采集分时估值数据
 * - 18:00-23:30: 采集非QDII基金最终涨幅值（从历史净值接口）
 * - 19:30-23:30: 采集QDII基金最终涨幅值（QDII净值延迟发布）
 * - 获取到最终净值后调用 settlement.ts 触发结算
 */

import axios from 'axios'
import { logger } from '../logger.js'
import {
  getLocalDate,
  getGlobalEstimateCache,
  getLatestGlobalEstimateCache,
  saveGlobalEstimateCacheBatch,
  getAllUserFundCodes,
  updateFinalGrowth,
  updateSettlementStatus,
  getFundInfo,
  getRecommendFundCodes,
  getStockTimeTrend,
  saveStockTimeTrend,
  getSystemParam,
  isNavDateAlreadySettled,
  getAllUsers,
  userContext,
  UserIdType,
  getHeldFunds,
  upsertDailyProfitTimeshare,
  updateDailyProfitFinal,
  getDailyProfit
} from '../db.js'
import { checkTradingDay } from '../services/holidayService.js'
import { settleFundForAllUsers } from './settlement.js'
import { fetchFinalNavFromMobApi, isKnownNonFund } from '../external/eastmoney.js'
import { fetchEstimateTimeseries, fetchFundEstimatePoint } from '../external/estimateSource.js'

let stopScheduledFetchTimer: (() => void) | null = null

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
  return info.data_source === 'mobapi'
}

export function isTradingTime(): boolean {
  if (!checkTradingDay(getLocalDate())) return false

  const now = new Date()
  const currentTime = now.getHours() * 60 + now.getMinutes()

  return currentTime >= 9 * 60 + 25 && currentTime <= 23 * 60 + 30
}

function isInEstimateTime(): boolean {
  const now = new Date()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const currentTime = hour * 60 + minute
  return currentTime >= 9 * 60 + 25 && currentTime <= 16 * 60
}

function isInFinalTime(): boolean {
  const now = new Date()
  const hour = now.getHours()
  const currentTime = hour * 60 + now.getMinutes()
  return currentTime >= 18 * 60 && currentTime <= 23 * 60 + 59
}

function isInQDIIFinalTime(): boolean {
  const now = new Date()
  const hour = now.getHours()
  const currentTime = hour * 60 + now.getMinutes()
  return currentTime >= 19 * 60 + 30 && currentTime <= 23 * 60 + 59
}

/**
 * 获取基金单点估值（用于盘前/盘后轻量校验）
 *
 * 优先用新浪 FdFundService 分时接口的最新点（数据最全），失败降级到 fu_ 单点接口。
 * 返回标准化 { nav, gsz, gszzl, gztime } 结构。
 */
async function fetchSingleEstimate(code: string): Promise<{ nav: number; gsz: number; gszzl: number; gztime: string } | null> {
  const ts = await fetchEstimateTimeseries(code)
  if (ts && ts.gsz > 0) {
    return { nav: ts.nav, gsz: ts.gsz, gszzl: ts.gszzl, gztime: ts.gztime }
  }
  const point = await fetchFundEstimatePoint(code)
  if (point && point.gsz > 0) {
    return point
  }
  return null
}

/**
 * 采集基金分时估值数据（盘中定时任务入口）
 *
 * 调用新浪 FdFundService 一次性获取当日完整的分钟级估值曲线，全量写入缓存。
 * 取代旧的"每分钟采一个点累加"模式，数据更完整、逻辑更简单。
 * 单点降级（fu_）的基金不写入分时 data（只更新 gsz/gszzl 字段），避免用单点伪造曲线。
 */
async function fetchEstimateData(codes: string[]): Promise<void> {
  const today = getLocalDate()
  const todayIsTradingDay = checkTradingDay(today)

  logger.log(`⏰ [${new Date().toLocaleTimeString()}] 开始采集分时估值数据... (${codes.length}只)`)

  const concurrencyLimit = 10
  const results: Array<{ code: string; data: string; date: string; nav?: number; gsz?: number; gszzl?: number; isUpdated: boolean; isTradingDay: boolean }> = []

  for (let i = 0; i < codes.length; i += concurrencyLimit) {
    const batch = codes.slice(i, i + concurrencyLimit)
    const batchResults = await Promise.all(batch.map(async (code) => {
      try {
        const cached = getGlobalEstimateCache(code, today)
        const ts = await fetchEstimateTimeseries(code)

        // 分时曲线获取成功 → 全量替换 data
        if (ts && ts.timeseries.length > 0) {
          const fundName = getFundInfo(code)?.name || ''
          logger.log(`📊 采集 ${code}${fundName ? '(' + fundName + ')' : ''}: ${ts.timeseries.length}点 (最新 ${ts.timeseries[ts.timeseries.length - 1].time} 涨幅=${ts.gszzl.toFixed(2)}%)`)
          return {
            code,
            data: JSON.stringify(ts.timeseries),
            date: today,
            nav: ts.nav,
            gsz: ts.gsz,
            gszzl: ts.gszzl,
            isUpdated: false,
            isTradingDay: todayIsTradingDay
          }
        }

        // 分时失败 → 降级到 fu_ 单点（仅更新 gsz/gszzl，保留 cached.data 的历史曲线）
        const point = await fetchFundEstimatePoint(code)
        if (point && point.gsz > 0) {
          const fundName = getFundInfo(code)?.name || ''
          logger.log(`📊 采集 ${code}${fundName ? '(' + fundName + ')' : ''}: 单点估值(无分时曲线) 涨幅=${point.gszzl.toFixed(2)}%`)
          return {
            code,
            data: cached?.data || '[]',
            date: today,
            nav: point.nav,
            gsz: point.gsz,
            gszzl: point.gszzl,
            isUpdated: false,
            isTradingDay: todayIsTradingDay
          }
        }

        logger.log(`⚠️  采集 ${code} 失败: 所有数据源均无数据`)
        return null
      } catch (error) {
        logger.log(`采集 ${code} 失败:`, error instanceof Error ? error.message : 'Unknown error')
        return null
      }
    }))

    results.push(...batchResults.filter((r): r is NonNullable<typeof r> => r !== null))
  }

  if (results.length > 0) {
    saveGlobalEstimateCacheBatch(results)
  }
}

async function fetchFinalData(codes: string[]): Promise<void> {
  const today = getLocalDate()
  const todayIsTradingDay = checkTradingDay(today)
  const results: Array<{ code: string; data: string; date: string; dayGrowth: number; nav: number; gsz: number; gszzl: number; isUpdated: boolean; isTradingDay: boolean }> = []

  const qdiiFinalTimeReady = isInQDIIFinalTime()

  const codesToFetch: string[] = []
  const codesToSettleOnly: string[] = []

  for (const code of codes) {
    if (isKnownNonFund(code)) continue
    const isQDII = isQDIIFund(code)
    const estOnly = isEstimateOnlyFund(code)
    if (isQDII && !estOnly && !qdiiFinalTimeReady) {
      logger.log(`🌍 ${code} QDII基金，19:30后才开始获取最终净值 (当前${new Date().toLocaleTimeString()})`)
      continue
    }

    const cached = getGlobalEstimateCache(code, today)

    if (cached && cached.isUpdated) {
      if (cached.settlementStatus === 1) {
        logger.log(`✅ ${code} 已获取净值且已结算，跳过`)
        continue
      } else {
        codesToSettleOnly.push(code)
        logger.log(`📋 ${code} 净值已有(${cached.dayGrowth?.toFixed(2)}%)，待结算(status=${cached.settlementStatus})`)
      }
    } else {
      codesToFetch.push(code)
    }
  }

  if (codesToFetch.length === 0 && codesToSettleOnly.length === 0) {
    logger.log(`⏰ [${new Date().toLocaleTimeString()}] 所有基金已处理完成，跳过`)
    return
  }

  logger.log(`⏰ [${new Date().toLocaleTimeString()}] 开始处理: 获取净值${codesToFetch.length}只, 只结算${codesToSettleOnly.length}只`)

  const concurrencyLimit = 10
  const fetchBatches: string[][] = []
  for (let i = 0; i < codesToFetch.length; i += concurrencyLimit) {
    fetchBatches.push(codesToFetch.slice(i, i + concurrencyLimit))
  }

  for (const batch of fetchBatches) {
    const batchResults = await Promise.all(batch.map(async (code) => {
      try {
        const cached = getGlobalEstimateCache(code, today)
        const isQDII = isQDIIFund(code)

        const finalData = await fetchFinalNavFromMobApi(code)
        if (!finalData) {
          logger.log(`⚠️ ${code} MobAPI净值未获取，稍后重试`)
          return null
        }

        // 非 QDII 基金净值日期必须是今天，否则视为未更新
        if (!isQDII && finalData.date !== today) {
          logger.log(`⏳ ${code} 净值日期 ${finalData.date} 非今天(非QDII)，等待更新后重试`)
          return null
        }

        const lastEntry = getLatestGlobalEstimateCache(code, today)
        let effectiveGrowth = finalData.growth

        if (isQDII) {
          if (finalData.date !== today) {
            if (isNavDateAlreadySettled(code, finalData.date, finalData.nav, finalData.growth)) {
              logger.log(`🌍 ${code} QDII基金净值 ${finalData.date} 已被之前结算日使用，跳过本次结算`)
              return null
            }
            if (lastEntry && lastEntry.nav === finalData.nav && lastEntry.dayGrowth === finalData.growth) {
              logger.log(`🌍 ${code} QDII基金最新净值 ${finalData.date} 与最近记录完全一致，海外休市，跳过`)
              return null
            }
          }
          logger.log(`🌍 ${code} QDII基金: 净值日=${finalData.date}, 涨幅=${finalData.growth.toFixed(2)}%`)
        }

        let estimates: Array<{ time: string; value: number; percent: number }> = []
        if (cached && cached.data) {
          try {
            estimates = JSON.parse(cached.data)
          } catch (e) {
            estimates = []
          }
        }

        estimates = estimates.filter(e => e.time !== '16:01')

        logger.log(`🎯 ${code} 获取最终净值: ${finalData.nav.toFixed(4)} 涨幅: ${effectiveGrowth.toFixed(2)}% (净值日期: ${finalData.date})`)

        updateFinalGrowth(code, today, finalData.nav, effectiveGrowth)

        const originalGszzl = cached?.gszzl ?? effectiveGrowth

        return {
          code,
          data: JSON.stringify(estimates),
          date: today,
          dayGrowth: effectiveGrowth,
          nav: finalData.nav,
          gsz: finalData.nav,
          gszzl: originalGszzl,
          isUpdated: true,
          isTradingDay: todayIsTradingDay
        }
      } catch (error) {
        logger.log(`采集 ${code} 最终数据失败:`, error instanceof Error ? error.message : 'Unknown error')
        return null
      }
    }))

    results.push(...batchResults.filter((r): r is NonNullable<typeof r> => r !== null))
  }

  if (results.length > 0) {
    saveGlobalEstimateCacheBatch(results)
  }

  const allCodesToSettle = [...codesToFetch, ...codesToSettleOnly]

  for (const code of allCodesToSettle) {
    try {
      const cached = getGlobalEstimateCache(code, today)
      if (!cached || !cached.isUpdated || cached.settlementStatus === 1) {
        continue
      }

      const fundData = {
        nav: cached.nav!,
        growth: cached.dayGrowth!
      }

      const settleResult = await settleFundForAllUsers(code, fundData, today)

      if (settleResult.success) {
        updateSettlementStatus(code, today, 1)
      } else if (settleResult.hasError) {
        updateSettlementStatus(code, today, 2)
      } else {
        updateSettlementStatus(code, today, 1)
        logger.log(`✅ ${code} 无用户持仓，直接标记结算成功`)
      }

    } catch (error) {
      logger.error(`结算 ${code} 失败:`, error instanceof Error ? error.message : 'Unknown error')
      updateSettlementStatus(code, today, 2)
    }
  }
}

export async function fetchEstimateDataForCodes(codes: string[]): Promise<void> {
  if (isInEstimateTime()) {
    await fetchEstimateData(codes)
  } else if (isInFinalTime()) {
    await fetchFinalData(codes)
  }
}

export async function refreshFundToday(fundCode: string, targetDate?: string): Promise<{ success: boolean; message: string }> {
  const today = targetDate || getLocalDate()
  const isQDII = isQDIIFund(fundCode)

  const finalData = await fetchFinalNavFromMobApi(fundCode)
  if (!finalData) {
    return { success: false, message: `${fundCode} MobAPI净值未获取，请稍后重试` }
  }

  // 非 QDII 基金净值日期必须是目标结算日
  if (!isQDII && finalData.date !== today) {
    return { success: false, message: `${fundCode} 净值日期 ${finalData.date} 未更新到今天，请稍后重试` }
  }

  let effectiveGrowth = finalData.growth

  if (isQDII) {
    if (finalData.date !== today) {
      const lastEntry = getLatestGlobalEstimateCache(fundCode, today)
      if (isNavDateAlreadySettled(fundCode, finalData.date, finalData.nav, finalData.growth)) {
        return { success: false, message: `${fundCode} QDII净值 ${finalData.date} 已被之前结算使用` }
      }
      if (lastEntry && lastEntry.nav === finalData.nav && lastEntry.dayGrowth === finalData.growth) {
        return { success: false, message: `${fundCode} QDII净值未更新，海外休市` }
      }
    }
    logger.log(`🌍 ${fundCode} QDII: 净值日=${finalData.date}, 涨幅=${finalData.growth.toFixed(2)}%`)
  } else {
    logger.log(`📡 ${fundCode} MobAPI: nav=${finalData.nav.toFixed(4)} growth=${finalData.growth.toFixed(2)}% (净值日: ${finalData.date})`)
  }

  const cached = getGlobalEstimateCache(fundCode, today)
  let estimates: Array<{ time: string; value: number; percent: number }> = []
  if (cached && cached.data) {
    try {
      estimates = JSON.parse(cached.data)
    } catch (_) {}
  }
  estimates = estimates.filter(e => e.time !== '16:01')

  updateFinalGrowth(fundCode, today, finalData.nav, effectiveGrowth)

  const refreshCached = getGlobalEstimateCache(fundCode, today)
  const originalGszzl = refreshCached?.gszzl ?? effectiveGrowth

  saveGlobalEstimateCacheBatch([{
    code: fundCode,
    data: JSON.stringify(estimates),
    date: today,
    dayGrowth: effectiveGrowth,
    nav: finalData.nav,
    gsz: finalData.nav,
    gszzl: originalGszzl,
    isUpdated: true,
    isTradingDay: checkTradingDay(today)
  }])

  const settleResult = await settleFundForAllUsers(fundCode, {
    nav: finalData.nav,
    growth: effectiveGrowth
  }, today, { reSettle: true })

  if (settleResult.success) {
    updateSettlementStatus(fundCode, today, 1)
  } else if (settleResult.hasError) {
    updateSettlementStatus(fundCode, today, 2)
  }

  logger.log(`🔄 刷新 ${fundCode} 完成: nav=${finalData.nav.toFixed(4)} growth=${effectiveGrowth.toFixed(2)}% settled=${settleResult.success}`)
  return {
    success: settleResult.success,
    message: `${fundCode} 刷新完成: 净值${finalData.nav.toFixed(4)} 涨幅${effectiveGrowth.toFixed(2)}%`
  }
}

function getFreshCodes(): string[] {
  const codes = getAllUserFundCodes()
  if (codes.length > 0) return codes
  const recommended = getRecommendFundCodes()
  logger.log(`⏰ 没有用户数据，使用推荐基金列表 (${recommended.length}只)`)
  return recommended
}

function startScheduledEstimateFetch(): () => void {
  let lastEstimateTime = 0
  let lastFinalTime = 0

  const timer = setInterval(() => {
    if (!isTradingTime()) return

    const now = Date.now()
    const codes = getFreshCodes()

    if (isInEstimateTime()) {
      const interval = 2 * 60 * 1000
      if (now - lastEstimateTime >= interval) {
        lastEstimateTime = now
        logger.log('⏰ 分时估值采集时间...')
        fetchEstimateData(codes).then(() => {
          updateAllUsersDailyProfit()
        }).catch(err => {
          logger.error('分时估值采集失败:', err)
        })
      }
    } else if (isInFinalTime()) {
      const interval = 5 * 60 * 1000
        if (now - lastFinalTime >= interval) {
        lastFinalTime = now
        logger.log('⏰ 最终涨幅采集时间...')
        fetchFinalData(codes).then(() => {
          updateAllUsersDailyProfitFinal()
        }).catch(err => {
          logger.error('最终涨幅采集失败:', err)
        })
      }
    }
  }, 60 * 1000)

  const initialCodes = getFreshCodes()
  if (isTradingTime()) {
    if (isInEstimateTime()) {
      lastEstimateTime = Date.now()
    } else if (isInFinalTime()) {
      lastFinalTime = Date.now()
    }
    logger.log('⏰ 立即获取数据...')
    fetchEstimateDataForCodes(initialCodes).catch(err => {
      logger.error('获取数据失败:', err)
    })
  }

  return () => clearInterval(timer)
}

export async function startScheduledEstimateWithUserFunds(): Promise<void> {
  if (stopScheduledFetchTimer) {
    stopScheduledFetchTimer()
  }

  stopScheduledFetchTimer = startScheduledEstimateFetch()

  const initialCodes = getFreshCodes()
  logger.log('⏰ 已启动定时数据采集任务，当前监控', initialCodes.length, '只基金')
}

export function stopEstimateFetch() {
  if (stopScheduledFetchTimer) {
    stopScheduledFetchTimer()
    stopScheduledFetchTimer = null
  }
}

const userProfitTradingTimePoints = [
  '09:25', '09:30', '09:35', '09:40', '09:45', '09:50', '09:55',
  '10:00', '10:05', '10:10', '10:15', '10:20', '10:25', '10:30', '10:35', '10:40', '10:45', '10:50', '10:55',
  '11:00', '11:05', '11:10', '11:15', '11:20', '11:25', '11:30', '11:35', '11:40', '11:45', '11:50', '11:55',
  '12:00',
  '13:00', '13:05', '13:10', '13:15', '13:20', '13:25', '13:30', '13:35', '13:40', '13:45', '13:50', '13:55',
  '14:00', '14:05', '14:10', '14:15', '14:20', '14:25', '14:30', '14:35', '14:40', '14:45', '14:50', '14:55', '15:00',
  '15:05', '15:10', '15:15', '15:20', '15:25', '15:30', '15:35', '15:40', '15:45', '15:50', '15:55', '16:00'
]

function getCurrentTradingTimePoint(): string | null {
  const now = new Date()
  const totalMinutes = now.getHours() * 60 + now.getMinutes()

  if (totalMinutes >= 16 * 60) return '16:00'
  if (totalMinutes < 9 * 60 + 25) return null

  const morningEnd = 11 * 60 + 30
  const lunchEnd = 12 * 60
  const afternoonStart = 13 * 60
  if (totalMinutes > lunchEnd && totalMinutes < afternoonStart) return null

  const rounded = Math.floor(totalMinutes / 5) * 5
  const point = `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`

  if (totalMinutes > morningEnd && totalMinutes <= lunchEnd) {
    if (userProfitTradingTimePoints.includes(point)) return point
    for (let i = userProfitTradingTimePoints.length - 1; i >= 0; i--) {
      if (userProfitTradingTimePoints[i] <= point) return userProfitTradingTimePoints[i]
    }
    return null
  }

  if (userProfitTradingTimePoints.includes(point)) return point

  for (let i = userProfitTradingTimePoints.length - 1; i >= 0; i--) {
    if (userProfitTradingTimePoints[i] <= point) return userProfitTradingTimePoints[i]
  }
  return null
}

export function updateAllUsersDailyProfit(): void {
  const today = getLocalDate()
  if (!checkTradingDay(today)) return

  const currentTimePoint = getCurrentTradingTimePoint()
  if (!currentTimePoint) return

  const users = getAllUsers()
  for (const user of users) {
    if (user.disabled) continue

    const targetUserId = { id: user.id, type: UserIdType.REGISTERED, label: user.label || undefined }
    userContext.run(targetUserId, () => {
      try {
        const holdings = getHeldFunds()
        if (holdings.size === 0) return

        let totalAmount = 0
        const fundTimeMap = new Map<string, Map<string, number>>()

        for (const [code, fund] of holdings) {
          if (!fund.amount || fund.amount <= 0) continue

          let cached = getGlobalEstimateCache(code, today)
          if (!cached || !cached.data) {
            cached = getLatestGlobalEstimateCache(code, today)
          }
          if (!cached || !cached.data) continue

          let timeshare: Array<{ time: string; value: number; percent: number }> = []
          try {
            const parsed = JSON.parse(cached.data)
            if (Array.isArray(parsed) && parsed.length > 0) {
              timeshare = parsed
            }
          } catch { /* ignore */ }

          const dataMap = new Map<string, number>()
          for (const point of timeshare) {
            dataMap.set(point.time, point.percent)
          }

          // 对该基金填充缺失时间点：用最近已知值向前填充
          const filledMap = new Map<string, number>()
          let lastPercent: number | null = null
          for (const time of userProfitTradingTimePoints) {
            if (time > currentTimePoint) break
            if (dataMap.has(time)) {
              lastPercent = dataMap.get(time)!
            }
            if (lastPercent !== null) {
              filledMap.set(time, lastPercent)
            }
          }

          if (filledMap.size === 0) continue

          totalAmount += fund.amount
          fundTimeMap.set(code, filledMap)
        }

        if (totalAmount === 0) return

        // 用固定分母（totalAmount）计算每个时间点的加权收益率
        const openingAmount = Math.round(totalAmount * 100) / 100
        const timeMap = new Map<string, number>()
        for (const [code, filledMap] of fundTimeMap) {
          const weight = holdings.get(code)!.amount
          for (const [time, percent] of filledMap) {
            timeMap.set(time, (timeMap.get(time) || 0) + percent * weight)
          }
        }

        const timeProfitData = Array.from(timeMap.entries())
          .map(([time, weightedRate]) => {
            const rate = Math.round((weightedRate / totalAmount) * 100) / 100
            const profit = Math.round(openingAmount * rate / 100 * 100) / 100
            const amount = Math.round((openingAmount + profit) * 100) / 100
            return { time, amount, profit, rate }
          })
          .sort((a, b) => a.time.localeCompare(b.time))

        if (timeProfitData.length === 0) return

        upsertDailyProfitTimeshare(today, openingAmount, timeProfitData)
      } catch (error) {
        logger.error(`更新用户${user.id}分时收益失败:`, error instanceof Error ? error.message : 'Unknown error')
      }
    })
  }
}

export function updateAllUsersDailyProfitFinal(): void {
  const today = getLocalDate()
  const users = getAllUsers()

  for (const user of users) {
    if (user.disabled) continue

    const targetUserId = { id: user.id, type: UserIdType.REGISTERED, label: user.label || undefined }
    userContext.run(targetUserId, () => {
      try {
        const record = getDailyProfit(today)
        if (!record || record.timeProfitData.length === 0) return

        const holdings = getHeldFunds()
        let allSettled = true
        let finalProfit = 0

        for (const [code, fund] of holdings) {
          if (!fund.amount || fund.amount <= 0) continue

          if (fund.settled && fund.settleDate === today && fund.currentDayProfit != null) {
            finalProfit += fund.currentDayProfit
          } else {
            allSettled = false
            const cached = getGlobalEstimateCache(code, today)
            const growth = cached?.dayGrowth ?? cached?.gszzl ?? 0
            finalProfit += fund.amount * growth / 100
          }
        }

        // finalProfit = 所有基金收益之和（已结算用 currentDayProfit，未结算用估值 fund.amount * growth / 100）
        // finalAmount = openingAmount + finalProfit（收盘总市值）
        // settled = 是否所有基金都已结算；未全部结算时 finalProfit 中包含估值部分
        const openingAmount = record.openingAmount
        finalProfit = Math.round(finalProfit * 100) / 100
        const finalAmount = Math.round((openingAmount + finalProfit) * 100) / 100
        const finalRate = openingAmount > 0 ? Math.round(finalProfit / openingAmount * 10000) / 100 : 0

        updateDailyProfitFinal(today, finalRate, finalProfit, finalAmount, allSettled)
      } catch (error) {
        logger.error(`更新用户${user.id}最终收益失败:`, error instanceof Error ? error.message : 'Unknown error')
      }
    })
  }
}

async function fetchIndexTimeshare(): Promise<Array<{ time: string; value: number; percent: number }> | null> {
  try {
    const indexCode = 'sh000001'
    logger.log(`📈 [指数采集] 请求新浪数据: ${indexCode}`)
    const response = await axios.get(`https://hq.sinajs.cn/list=${indexCode}`, {
      headers: { 'Referer': 'https://finance.sina.com.cn/' },
      responseType: 'arraybuffer',
      timeout: 5000
    })
    
    const iconv = await import('iconv-lite')
    const decodedData = iconv.decode(Buffer.from(response.data), 'gbk')
    const match = decodedData.match(/="([^"]*)"/)
    
    if (!match || !match[1]) {
      logger.error('获取上证指数数据失败：无法解析数据')
      return null
    }
    
    const parts = match[1].split(',')
    if (parts.length < 4) {
      logger.error('获取上证指数数据失败：数据格式错误, parts.length=' + parts.length)
      return null
    }
    
    const yesterdayClose = parseFloat(parts[2])
    const currentPrice = parseFloat(parts[3])
    logger.log(`📈 [指数采集] 新浪返回: 昨收=${yesterdayClose}, 现价=${currentPrice}`)
    
    if (!yesterdayClose || yesterdayClose === 0) {
      logger.error('获取上证指数数据失败：无效的昨收价格')
      return null
    }
    
    const percent = ((currentPrice - yesterdayClose) / yesterdayClose) * 100
    const now = new Date()
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    
    const timeSeries: Array<{ time: string; value: number; percent: number }> = [
      { time: '09:30', value: yesterdayClose, percent: 0 },
      { time: currentTime, value: currentPrice, percent: Number(percent.toFixed(4)) }
    ]
    
    return timeSeries
  } catch (error) {
    logger.error('获取上证指数分时数据失败:', error)
    return null
  }
}

function getStockCode(): string {
  return getSystemParam('STOCK_INDEX_CODE') || '000001'
}

const tradingTimePoints = [
  '09:25', '09:30', '09:35', '09:40', '09:45', '09:50', '09:55',
  '10:00', '10:05', '10:10', '10:15', '10:20', '10:25', '10:30', '10:35', '10:40', '10:45', '10:50', '10:55',
  '11:00', '11:05', '11:10', '11:15', '11:20', '11:25', '11:30', '11:35', '11:40', '11:45', '11:50', '11:55',
  '12:00',
  '13:00', '13:05', '13:10', '13:15', '13:20', '13:25', '13:30', '13:35', '13:40', '13:45', '13:50', '13:55',
  '14:00', '14:05', '14:10', '14:15', '14:20', '14:25', '14:30', '14:35', '14:40', '14:45', '14:50', '14:55', '15:00',
  '15:05', '15:10', '15:15', '15:20', '15:25', '15:30', '15:35', '15:40', '15:45', '15:50', '15:55', '16:00'
]

function snapToTradingTime(time: string): string {
  if (time === '09:30') return '09:30'
  for (const point of tradingTimePoints) {
    if (point >= time) return point
  }
  return '16:00'
}

export async function saveIndexTimeshare(): Promise<void> {
  const today = getLocalDate()
  
  if (!checkTradingDay(today)) {
    logger.log('📅 今天不是交易日，跳过指数采集')
    return
  }
  
  const stockCode = getStockCode()
  logger.log(`📈 [指数采集] saveIndexTimeshare stockCode=${stockCode}, today=${today}`)
  const timeSeries = await fetchIndexTimeshare()
  if (!timeSeries || timeSeries.length === 0) {
    logger.error('保存指数分时数据失败：无数据')
    return
  }
  
  const rawPoint = timeSeries[timeSeries.length - 1]
  const rawMinutes = parseInt(rawPoint.time.substring(0, 2)) * 60 + parseInt(rawPoint.time.substring(3, 5))
  if (rawMinutes > 12 * 60 && rawMinutes < 13 * 60) {
    logger.log(`📈 [指数采集] 午休时间(${rawPoint.time})，跳过`)
    return
  }
  
  const snappedTime = snapToTradingTime(rawPoint.time)
  const newPoint = { ...rawPoint, time: snappedTime }
  logger.log(`📈 [指数采集] 原始时间=${rawPoint.time}, 对齐到=${snappedTime}, value=${newPoint.value}, percent=${newPoint.percent}%`)
  
  const cached = getStockTimeTrend(stockCode, today)
  logger.log(`📈 [指数采集] 已有缓存: ${cached ? `有(${cached.date})` : '无'}`)
  let existingPoints: Array<{ time: string; value: number; percent: number }> = []
  if (cached && cached.data) {
    try {
      existingPoints = JSON.parse(cached.data)
    } catch {
      existingPoints = []
    }
  }
  
  const existingIdx = existingPoints.findIndex(p => p.time === newPoint.time)
  if (existingIdx >= 0) {
    existingPoints[existingIdx] = newPoint
  } else {
    existingPoints.push(newPoint)
  }

  if (!existingPoints.some(p => p.time === '09:30') && timeSeries[0]) {
    existingPoints.unshift(timeSeries[0])
  }

  existingPoints.sort((a, b) => a.time.localeCompare(b.time))
  
  const dayGrowth = newPoint.percent
  
  saveStockTimeTrend({
    code: stockCode,
    date: today,
    data: JSON.stringify(existingPoints),
    dayGrowth: dayGrowth,
    price: newPoint.value
  })
  
  logger.log(`✅ 指数分时数据已保存(${existingPoints.length}点)，当前涨跌幅: ${dayGrowth}%`)
}

export function startIndexEstimate(): () => void {
  let lastEstimateTime = 0
  let lastFinalTime = 0

  const timer = setInterval(() => {
    if (!isTradingTime()) return

    const now = Date.now()

    if (isInEstimateTime()) {
      if (now - lastEstimateTime >= 2 * 60 * 1000) {
        lastEstimateTime = now
        saveIndexTimeshare().catch(err => {
          logger.error('指数采集失败:', err)
        })
      }
    } else if (isInFinalTime()) {
      if (now - lastFinalTime >= 5 * 60 * 1000) {
        lastFinalTime = now
        logger.log('⏰ 指数最终数据采集...')
        saveIndexTimeshare().catch(err => {
          logger.error('指数最终采集失败:', err)
        })
      }
    }
  }, 60 * 1000)
  
  if (isTradingTime()) {
    if (isInEstimateTime()) {
      saveIndexTimeshare().catch(err => {
        logger.error('指数采集失败:', err)
      })
    } else if (isInFinalTime()) {
      saveIndexTimeshare().catch(err => {
        logger.error('指数最终采集失败:', err)
      })
    }
  }
  
  return () => clearInterval(timer)
}
