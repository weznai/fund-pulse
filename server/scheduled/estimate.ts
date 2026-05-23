/**
 * 定时估值任务
 * 功能：
 * - 9:25-16:00: 采集分时估值数据
 * - 18:00-23:30: 采集非QDII基金最终涨幅值（从历史净值接口）
 * - 20:00-23:30: 采集QDII基金最终涨幅值（QDII净值延迟发布）
 * - 获取到最终净值后调用 settlement.ts 触发结算
 */

import axios from 'axios'
import { logger } from '../logger.js'
import {
  getLocalDate,
  getGlobalEstimateCache,
  getLatestGlobalEstimateCache,
  saveGlobalEstimateCache,
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
import { fetchFinalNavFromMobApi } from '../external/eastmoney.js'

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
  return currentTime >= 20 * 60 && currentTime <= 23 * 60 + 59
}

function getRecordTimePoint(hasOpenPoint: boolean): string | null {
  const now = new Date()
  const hour = now.getHours()
  const minute = now.getMinutes()

  const totalMinutes = hour * 60 + minute
  const openTime = 9 * 60 + 25
  const firstInterval = 9 * 60 + 30
  const closeTime = 16 * 60

  if (totalMinutes >= closeTime) {
    return '16:00'
  }

  if (totalMinutes > 12 * 60 && totalMinutes < 13 * 60) {
    return null
  }

  if (totalMinutes >= openTime && totalMinutes < firstInterval) {
    return hasOpenPoint ? '09:30' : '09:25'
  }

  const roundedMinutes = Math.floor(totalMinutes / 5) * 5
  const recordHour = Math.floor(roundedMinutes / 60)
  const recordMinute = roundedMinutes % 60

  return `${recordHour.toString().padStart(2, '0')}:${recordMinute.toString().padStart(2, '0')}`
}

async function fetchSingleEstimate(code: string): Promise<{ nav: number; gsz: number; gszzl: number; gztime: string } | null> {
  try {
    const url = `https://fundgz.1234567.com.cn/js/${code}.js?rt=${Date.now()}`
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      responseType: 'text',
      timeout: 5000
    })

    const match = response.data.match(/jsonpgz\s*\(\s*(\{[\s\S]*?\})\s*\)/)
    if (match && match[1]) {
      const data = JSON.parse(match[1])
      return {
        nav: parseFloat(data.dwjz) || 0,
        gsz: parseFloat(data.gsz) || 0,
        gszzl: parseFloat(data.gszzl) || 0,
        gztime: data.gztime || ''
      }
    }
  } catch (error) {
    logger.log(`获取 ${code} 估值失败:`, error instanceof Error ? error.message : 'Unknown error')
  }
  return null
}

async function fetchSingleEstimateFallback(code: string): Promise<{ nav: number; gsz: number; gszzl: number; gztime: string; isEtfStock?: boolean } | null> {
  try {
    const fsUrls = [
      `https://fund.eastmoney.com/tfsj_v1.0.0/fsdata_${code}.js`,
      `https://fundf10.eastmoney.com/trend_${code}.js`,
    ]
    for (const url of fsUrls) {
      try {
        const fsResponse = await axios.get(url, {
          headers: {
            'Referer': 'https://fund.eastmoney.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 8000,
          responseType: 'text'
        })
        const jsContent = fsResponse.data || ''
        const dataMatch = jsContent.match(new RegExp(`var\\s+fsdata_${code}\\s*=\\s*(\\{[\\s\\S]*?\\});`))
        if (dataMatch && dataMatch[1]) {
          const fundData = JSON.parse(dataMatch[1])
          if (fundData.d && Array.isArray(fundData.d) && fundData.d.length > 0) {
            const baseValue = fundData.d[0][1] || fundData.fsrq || 1
            const lastPoint = fundData.d[fundData.d.length - 1]
            if (Array.isArray(lastPoint) && lastPoint.length >= 2) {
              const value = lastPoint[1]
              const percent = baseValue > 0 ? ((value - baseValue) / baseValue) * 100 : 0
              return {
                nav: baseValue > 1 ? baseValue : value,
                gsz: value,
                gszzl: percent,
                gztime: getLocalDate()
              }
            }
          }
        }
      } catch (_e) { }
    }
  } catch (error) {
    logger.log(`ETF ${code} 东方财富分时降级失败:`, error instanceof Error ? error.message : 'Unknown error')
  }

  try {
    const sinaPrefix = code.startsWith('5') ? 'sh' : 'sz'
    const sinaUrl = `https://hq.sinajs.cn/list=${sinaPrefix}${code}`
    const response = await axios.get(sinaUrl, {
      headers: { 'Referer': 'https://finance.sina.com.cn/', 'User-Agent': 'Mozilla/5.0' },
      responseType: 'arraybuffer', timeout: 8000
    })
    const iconv = await import('iconv-lite')
    const decodedData = iconv.decode(Buffer.from(response.data), 'gbk')
    const sinaMatch = decodedData.match(new RegExp(`${sinaPrefix}${code}="([^"]+)"`))
    if (sinaMatch && sinaMatch[1]) {
      const parts = sinaMatch[1].split(',')
      const preClose = parseFloat(parts[2]) || 0
      const currentPrice = parseFloat(parts[3]) || 0
      if (preClose > 0 && currentPrice > 0) {
        const percent = ((currentPrice - preClose) / preClose) * 100
        logger.log(`🏦 [场内ETF] ${code} 股票行情降级: 昨收=${preClose} 现价=${currentPrice} 涨幅=${percent.toFixed(2)}%`)
        return { nav: preClose, gsz: currentPrice, gszzl: percent, gztime: getLocalDate(), isEtfStock: true }
      }
    }
  } catch (_e) { }

  return null
}

async function fetchFinalNavFromHistory(code: string, today: string): Promise<{ nav: number; growth: number; date: string } | null> {
  try {
    const url = `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=${code}&page=1&per=3`
    const response = await axios.get(url, {
      headers: { 'Referer': 'https://fund.eastmoney.com/' },
      timeout: 5000
    })

    const dataStr = response.data || ''
    const contentMatch = dataStr.match(/content:\s*"(.+?)"/s)
    if (!contentMatch || !contentMatch[1]) return null

    const content = contentMatch[1].replace(/\\'/g, "'").replace(/\\"/g, '"')
    const rowMatches = content.match(/<tr[\s\S]*?<\/tr>/gi) || []
    const dataRows = rowMatches.filter(r => /<td[^>]*>/i.test(r))

    const latestResult = { nav: 0, growth: 0, date: '' }

    for (const row of dataRows) {
      const cells = row.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []
      if (cells.length < 4) continue

      const getText = (td: string) => td.replace(/<[^>]+>/g, '').trim()
      const dateStr = getText(cells[0] || '')

      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue

      const nav = parseFloat(getText(cells[1] || '')) || 0
      const growthText = getText(cells[3] || '')
      const growthMatch = growthText.match(/([-+]?\d+(?:\.\d+)?)\s*%/)

      if (nav > 0 && growthMatch) {
        const growth = parseFloat(growthMatch[1])

        if (!latestResult.date) {
          latestResult.nav = nav
          latestResult.growth = growth
          latestResult.date = dateStr
        }

        if (dateStr === today) {
          return { nav, growth, date: dateStr }
        }
      }
    }

    if (isQDIIFund(code) && latestResult.date) {
      if (latestResult.date === today) {
        return { nav: latestResult.nav, growth: latestResult.growth, date: latestResult.date }
      }

      if (isNavDateAlreadySettled(code, latestResult.date, latestResult.nav, latestResult.growth)) {
        logger.log(`🌍 ${code} QDII基金净值 ${latestResult.date} (nav=${latestResult.nav}, growth=${latestResult.growth}%) 已在之前结算中使用，跳过`)
        return null
      }

      const lastEntry = getLatestGlobalEstimateCache(code, today)
      if (lastEntry && lastEntry.nav === latestResult.nav && lastEntry.dayGrowth === latestResult.growth) {
        logger.log(`🌍 ${code} QDII基金最新净值 ${latestResult.date} 与最近记录完全一致，海外休市，跳过`)
        return null
      }

      logger.log(`🌍 ${code} QDII基金使用最新净值 (净值日期: ${latestResult.date}, 当天: ${today})`)
      return { nav: latestResult.nav, growth: latestResult.growth, date: latestResult.date }
    }
  } catch (error) {
    logger.log(`获取 ${code} 历史净值失败:`, error instanceof Error ? error.message : 'Unknown error')
  }
  return null
}

async function fetchEstimateData(codes: string[]): Promise<void> {
  const today = getLocalDate()
  const todayIsTradingDay = checkTradingDay(today)
  const results: Array<{ code: string; data: string; date: string; isUpdated: boolean; isTradingDay: boolean }> = []

  logger.log(`⏰ [${new Date().toLocaleTimeString()}] 开始采集分时估值数据... (${codes.length}只)`)

  const concurrencyLimit = 10
  const batches: string[][] = []
  for (let i = 0; i < codes.length; i += concurrencyLimit) {
    batches.push(codes.slice(i, i + concurrencyLimit))
  }

  for (const batch of batches) {
    const batchResults = await Promise.all(batch.map(async (code) => {
      try {
        const cached = getGlobalEstimateCache(code, today)
        let estimates: Array<{ time: string; value: number; percent: number }> = []

        if (cached && cached.data) {
          try {
            estimates = JSON.parse(cached.data)
          } catch (e) {
            estimates = []
          }
        }

        let estimate = await fetchSingleEstimate(code)
        if (!estimate || estimate.nav <= 0) {
          estimate = await fetchSingleEstimateFallback(code)
          if (!estimate || estimate.nav <= 0) return null
        }

        const hasOpenPoint = estimates.some(e => e.time === '09:25' || e.time === '09:30')
        const recordTime = getRecordTimePoint(hasOpenPoint)
        if (!recordTime) return null

        const existingIndex = estimates.findIndex(e => e.time === recordTime)
        const newData = {
          time: recordTime,
          value: Number(estimate.gsz.toFixed(4)),
          percent: Number(estimate.gszzl.toFixed(2))
        }

        if (existingIndex >= 0) {
          estimates[existingIndex] = newData
        } else {
          estimates.push(newData)
          estimates.sort((a, b) => {
            const [ah, am] = a.time.split(':').map(Number)
            const [bh, bm] = b.time.split(':').map(Number)
            return (ah * 60 + am) - (bh * 60 + bm)
          })
        }

        const fundName = getFundInfo(code)?.name || ''
        const etfTag = estimate.isEtfStock ? ' [场内ETF]' : ''
        logger.log(`📊 采集${etfTag} ${code}${fundName ? '(' + fundName + ')' : ''}: ${recordTime} 估值=${estimate.gsz.toFixed(4)} 涨幅=${estimate.gszzl.toFixed(2)}% (累计${estimates.length}点)`)

        return {
          code,
          data: JSON.stringify(estimates),
          date: today,
          nav: estimate.nav,
          gsz: estimate.gsz,
          gszzl: estimate.gszzl,
          isUpdated: false,
          isTradingDay: todayIsTradingDay
        }
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
    const isQDII = isQDIIFund(code)
    const estOnly = isEstimateOnlyFund(code)
    if (isQDII && !estOnly && !qdiiFinalTimeReady) {
      logger.log(`🌍 ${code} QDII基金，20:00后才开始获取最终净值 (当前${new Date().toLocaleTimeString()})`)
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
        const estOnly = isEstimateOnlyFund(code)

        let finalData: { nav: number; growth: number; date: string } | null = null

        if (estOnly) {
          finalData = await fetchFinalNavFromMobApi(code)
          if (!finalData) {
            logger.log(`⚠️ ${code} MobAPI净值未更新，稍后重试`)
            return null
          }
          logger.log(`📡 ${code} MobAPI: nav=${finalData.nav.toFixed(4)} growth=${finalData.growth.toFixed(2)}% (净值日: ${finalData.date})`)
        } else {
          finalData = await fetchFinalNavFromHistory(code, today)
          if (!finalData) {
            logger.log(`⚠️ ${code} 历史净值未更新，稍后重试`)
            return null
          }
        }

        const lastEntry = getLatestGlobalEstimateCache(code, today)
        let effectiveGrowth = finalData.growth

        if (!estOnly && isQDIIFund(code)) {
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
          logger.log(`🌍 ${code} QDII基金: 净值日=${finalData.date}, 东方财富涨幅=${finalData.growth.toFixed(2)}%`)
        }

        if (!estOnly && !isQDIIFund(code) && lastEntry && lastEntry.date !== finalData.date && lastEntry.nav === finalData.nav && lastEntry.dayGrowth === finalData.growth) {
          effectiveGrowth = 0
          logger.log(`🌍 ${code} 海外休市净值未变 (${finalData.date}, nav=${finalData.nav})，按涨跌幅0%结算`)
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
  const estOnly = isEstimateOnlyFund(fundCode)

  let finalData: { nav: number; growth: number; date: string } | null = null

  if (estOnly) {
    finalData = await fetchFinalNavFromMobApi(fundCode)
    if (!finalData) {
      return { success: false, message: `${fundCode} MobAPI净值未更新，请稍后重试` }
    }
    logger.log(`📡 ${fundCode} MobAPI: nav=${finalData.nav.toFixed(4)} growth=${finalData.growth.toFixed(2)}%`)
  } else {
    finalData = await fetchFinalNavFromHistory(fundCode, today)
    if (!finalData) {
      return { success: false, message: `${fundCode} 历史净值未更新，请稍后重试` }
    }
  }

  const isQDII = isQDIIFund(fundCode)
  let effectiveGrowth = finalData.growth

  if (!estOnly && isQDII) {
    if (finalData.date !== today) {
      const lastEntry = getLatestGlobalEstimateCache(fundCode, today)
      if (isNavDateAlreadySettled(fundCode, finalData.date, finalData.nav, finalData.growth)) {
        return { success: false, message: `${fundCode} QDII净值 ${finalData.date} 已被之前结算使用` }
      }
      if (lastEntry && lastEntry.nav === finalData.nav && lastEntry.dayGrowth === finalData.growth) {
        return { success: false, message: `${fundCode} QDII净值未更新，海外休市` }
      }
    }
    logger.log(`🌍 ${fundCode} QDII: 净值日=${finalData.date}, 东方财富涨幅=${finalData.growth.toFixed(2)}%`)
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
