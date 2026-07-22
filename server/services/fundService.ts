/**
 * 基金服务层
 * 
 * 职责：处理基金数据相关的业务逻辑
 * 包含：数据获取、缓存、详情查询等功能
 */

import axios from 'axios'
import { logger } from '../logger.js'
import { fundInfoRepository } from '../db/index.js'
import { checkTradingDay } from './holidayService.js'
import { getLocalDate, getFundCache, saveFundCache, getGlobalEstimateCache, getFundInfo, FundInfo } from '../db/index.js'
import type { FundCache } from '../../types/index.js'
import { fetchFinalNavFromMobApi, isKnownNonFund } from '../external/eastmoney.js'
import { fetchFundEstimatePoint } from '../external/estimateSource.js'

// ==================== 缓存配置 ====================
const ESTIMATE_CACHE_TTL = 5 * 60 * 1000  // 5分钟
const FUND_CACHE_TTL = 2 * 60 * 1000  // 2分钟

// ==================== 辅助函数 ====================

/**
 * 从新浪获取基金估算日涨跌幅
 */
async function fetchDayGrowthFromEastmoney(code: string): Promise<number | null> {
  const point = await fetchFundEstimatePoint(code)
  if (point && point.gsz > 0) {
    return point.gszzl
  }
  return null
}

/**
 * 从东方财富搜索API获取基金基本信息
 */
async function fetchFundBasicInfoFromSearchApi(code: string): Promise<{ code: string; name: string; ftype?: string } | null> {
  try {
    logger.log(`[批量导入] ${code} 尝试使用 Search API 获取基本信息...`)
    const response = await axios.get('https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx', {
      params: { m: 1, key: code, pagesize: 1, _: Date.now() },
      headers: { 'Referer': 'https://fund.eastmoney.com/' },
      timeout: 8000
    })

    const datas = response.data?.Datas
    if (!datas || datas.length === 0) {
      logger.log(`[批量导入] ${code} Search API 也未找到数据`)
      return null
    }

    const item = datas[0]
    const result = {
      code: item.CODE,
      name: item.NAME,
      ftype: item.FundBaseInfo?.FTYPE || undefined
    }

    logger.log(`[批量导入] ${code} Search API 获取成功: name=${result.name}`)
    return result
  } catch (error: any) {
    logger.error(`[批量导入] ${code} Search API 获取失败:`, error.message || error)
    return null
  }
}

/**
 * 从 MobAPI 获取基金数据（历史净值接口 F10DataApi 已失效，统一改用移动端 MobAPI）
 */
async function fetchFundFromLsjz(code: string): Promise<any | null> {
  try {
    const searchInfo = await fetchFundBasicInfoFromSearchApi(code)
    const fundName = searchInfo?.name || ''

    const mobNav = await fetchFinalNavFromMobApi(code)
    const latestNav = mobNav?.nav || 0
    const dayGrowth = mobNav?.growth || 0
    const latestDate = mobNav?.date || ''
    const latestAccNav = mobNav?.accNav || latestNav

    if (latestNav === 0 && fundName === '') return null

    const fundData = {
      code,
      name: fundName,
      type: '',
      nav: latestNav,
      accNav: latestAccNav,
      dayGrowth,
      lastUpdate: latestDate,
      growthValue: latestNav > 0 ? (dayGrowth / 100) * latestNav : 0,
      gsz: latestNav,
      gszzl: dayGrowth,
      gztime: latestDate,
      jzrq: latestDate
    }

    saveFundCache(code, JSON.stringify(fundData))
    logger.log(`基金 ${code} 通过MobAPI获取成功: name=${fundName}, nav=${latestNav}`)
    return fundData
  } catch (error) {
    logger.error(`基金 ${code} MobAPI获取失败:`, error)
    return null
  }
}

function isQDIIFund(code: string): boolean {
  const info = getFundInfo(code)
  if (!info) return false
  if (info.ftype && /qdii/i.test(info.ftype)) return true
  if (info.name && /qdii/i.test(info.name)) return true
  if (info.ftype && /海外/i.test(info.ftype)) return true
  return false
}

async function fetchFundData(code: string, forceRefresh = false) {
  if (isKnownNonFund(code)) return null
  const now = Date.now()
  const today = getLocalDate()

  const isTradeDay = checkTradingDay(today)
  let cacheTtl = isTradeDay ? FUND_CACHE_TTL : (forceRefresh ? 0 : 365 * 24 * 60 * 60 * 1000)

  if (isTradeDay && !forceRefresh) {
    const estimateCache = getGlobalEstimateCache(code, today)
    if (estimateCache && estimateCache.isUpdated) {
      const existingCache = getFundCache(code, 365 * 24 * 60 * 60 * 1000)
      if (existingCache) {
        try {
          const parsed = JSON.parse(existingCache.data)
          if (isQDIIFund(code)) {
            parsed.gszzl = estimateCache.dayGrowth ?? parsed.gszzl
            parsed.dayGrowth = estimateCache.dayGrowth ?? parsed.dayGrowth
            if (estimateCache.nav) {
              parsed.nav = estimateCache.nav
              parsed.gsz = estimateCache.nav
            }
            // QDII基金保留原始jzrq，不强制覆盖为今天
            logger.log(`基金 ${code} QDII缓存覆盖: gszzl=${parsed.gszzl}%, dayGrowth=${parsed.dayGrowth}%`)
          }
          if (parsed.jzrq === today && parsed.name) {
            return parsed
          }
        } catch (e) {}
      }
      cacheTtl = 0
    }
  }

  if (!forceRefresh) {
    const cached = getFundCache(code, cacheTtl)
    if (cached) {
      try {
        const parsed = JSON.parse(cached.data)
        if (parsed.name) {
          return parsed
        }
      } catch (e) {
        logger.error('解析基金缓存数据失败:', e)
      }
    }
  }

  try {
    // 优先使用新浪实时估值
    const estimatePoint = await fetchFundEstimatePoint(code)

    if (estimatePoint && estimatePoint.gsz > 0) {
      const info = getFundInfo(code)
      const nav = estimatePoint.nav
      const gsz = estimatePoint.gsz
      const gszzl = estimatePoint.gszzl

      const fundData: any = {
        code,
        name: info?.name || '',
        type: '',
        nav: nav,
        accNav: nav,
        dayGrowth: gszzl,
        lastUpdate: estimatePoint.gztime,
        growthValue: nav > 0 ? (gszzl / 100) * nav : 0,
        gsz: gsz,
        gszzl: gszzl,
        gztime: estimatePoint.gztime,
        jzrq: estimatePoint.gztime ? estimatePoint.gztime.slice(0, 10) : ''
      }

      // 补充真实净值日涨跌幅（天天基金给的是估值涨幅，这里用 MobAPI 取真实净值涨幅）
      try {
        const mobNav = await fetchFinalNavFromMobApi(code)
        if (mobNav) {
          fundData.dayGrowth = mobNav.growth
          fundData.jzrq = mobNav.date
        }
      } catch (lsjzError) {
        logger.error(`获取历史净值失败 ${code}:`, lsjzError)
      }

      if (isQDIIFund(code)) {
        const estimateCache = getGlobalEstimateCache(code, getLocalDate())
        if (estimateCache) {
          if (estimateCache.isUpdated && estimateCache.dayGrowth != null) {
            fundData.gszzl = estimateCache.dayGrowth
            fundData.dayGrowth = estimateCache.dayGrowth
            fundData.gsz = estimateCache.nav ?? fundData.gsz
            fundData.nav = estimateCache.nav ?? fundData.nav
            // QDII基金使用原始jzrq日期，不强制覆盖为今天
            if (fundData.jzrq && fundData.jzrq !== getLocalDate()) {
              fundData.gztime = `${fundData.jzrq} 15:00`
              fundData.lastUpdate = fundData.gztime
            }
            logger.log(`基金 ${code} QDII使用最终净值涨幅覆盖: ${estimateCache.dayGrowth.toFixed(2)}%`)
          } else if (estimateCache.gszzl != null) {
            fundData.gszzl = estimateCache.gszzl
            if (estimateCache.gsz) fundData.gsz = estimateCache.gsz
            // 分时估值也保留原始gztime，不强制覆盖
            logger.log(`基金 ${code} QDII使用分时估值覆盖gszzl: ${estimateCache.gszzl.toFixed(2)}%`)
          }
        }
      }

      saveFundCache(code, JSON.stringify(fundData))

      return fundData
    }

    // 天天基金返回空，先尝试历史净值接口
    const lsjzResult = await fetchFundFromLsjz(code)
    if (lsjzResult) {
      // 历史净值只有昨天的数据，尝试补充今天的实时估值
      try {
        const today = getLocalDate()
        const gztimeToday = lsjzResult.gztime ? lsjzResult.gztime.slice(0, 10) : ''
        if (gztimeToday !== today) {
          // 新浪实时估值补充
          const point = await fetchFundEstimatePoint(code)
          if (point && point.gsz > 0) {
            lsjzResult.gsz = point.gsz
            lsjzResult.gszzl = point.gszzl
            lsjzResult.gztime = point.gztime
            saveFundCache(code, JSON.stringify(lsjzResult))
            logger.log(`基金 ${code} 新浪实时估值补充: gszzl=${point.gszzl}%`)
          }
        }
      } catch (_supError) { }
      return lsjzResult
    }

    // 历史净值也失败，最后尝试新浪获取实时估值
    try {
      const point = await fetchFundEstimatePoint(code)
      if (point && point.nav > 0) {
        const info = getFundInfo(code)
        const fundData: any = {
          code,
          name: info?.name || '',
          type: '',
          nav: point.nav,
          accNav: point.nav,
          dayGrowth: point.gszzl,
          lastUpdate: point.gztime,
          growthValue: point.nav > 0 ? (point.gszzl / 100) * point.nav : 0,
          gsz: point.gsz,
          gszzl: point.gszzl,
          gztime: point.gztime,
          jzrq: point.gztime ? point.gztime.slice(0, 10) : ''
        }
        saveFundCache(code, JSON.stringify(fundData))
        logger.log(`基金 ${code} 新浪实时估值获取成功: gszzl=${point.gszzl}%`)
        return fundData
      }
    } catch (sinaError: any) {
      logger.log(`基金 ${code} 新浪估值获取失败:`, sinaError.message)
    }

    return null
  } catch (error) {
    logger.error(`获取基金${code}数据失败:`, error)
    return null
  }
}

/**
 * 批量获取基金数据
 */
function buildFallbackFund(code: string) {
  return {
    code,
    name: `基金${code}`,
    type: '',
    nav: 0,
    accNav: 0,
    dayGrowth: 0,
    lastUpdate: '',
    gsz: 0,
    gszzl: 0,
    gztime: '',
    jzrq: ''
  }
}

async function fetchFundsBatch(codes: string[], forceRefresh = false) {
  const results: any[] = []
  const concurrencyLimit = 10

  for (let i = 0; i < codes.length; i += concurrencyLimit) {
    const batch = codes.slice(i, i + concurrencyLimit)
    const batchResults = await Promise.all(
      batch.map(async code => {
        try {
          const result = await fetchFundData(code, forceRefresh)
          return result || buildFallbackFund(code)
        } catch (err) {
          logger.error(`获取基金 ${code} 失败:`, err)
          return buildFallbackFund(code)
        }
      })
    )
    results.push(...batchResults)
  }

  return results
}

/**
 * 生成模拟时间序列数据
 */
function generateTimeSeries(nav: number, finalPercent: number, code: string): Array<{ time: string; value: number; percent: number }> {
  const estimates: Array<{ time: string; value: number; percent: number }> = []
  const now = new Date()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const todayIsTradingDay = checkTradingDay(getLocalDate())

  const inTradingHours = todayIsTradingDay && (
    (hour === 9 && minute >= 30) || (hour >= 10 && hour < 16)
  )

  let endMinutes: number
  if (inTradingHours) {
    endMinutes = hour * 60 + minute
  } else if (hour >= 16) {
    endMinutes = 16 * 60 + 1
  } else {
    endMinutes = 15 * 60
  }

  const startMinutes = 9 * 60 + 30

  const seed = code.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const seededRandom = (index: number) => {
    const x = Math.sin(seed + index) * 10000
    return x - Math.floor(x)
  }

  const totalPoints = Math.floor((endMinutes - startMinutes) / 5) + 1

  for (let i = 0; i < totalPoints; i++) {
    const mins = startMinutes + i * 5
    const h = Math.floor(mins / 60)
    const m = mins % 60
    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`

    // 跳过午休时间
    if (mins >= 12 * 60 + 5 && mins <= 12 * 60 + 55) continue

    const progress = i / (totalPoints - 1)

    // 基础进度
    const basePercent = finalPercent * progress

    // 波动幅度
    const volatility = Math.min(Math.abs(finalPercent) * 0.15, 0.3)

    // 添加波动
    const wave1 = Math.sin(progress * Math.PI * 3) * volatility * 0.5
    const wave2 = Math.sin(progress * Math.PI * 7 + seededRandom(i)) * volatility * 0.3
    const wave3 = (seededRandom(i * 2) - 0.5) * volatility * 0.2

    const currentPercent = basePercent + wave1 + wave2 + wave3
    const currentValue = nav * (1 + currentPercent / 100)

    estimates.push({
      time: timeStr,
      value: Number(currentValue.toFixed(4)),
      percent: Number(currentPercent.toFixed(2))
    })
  }

  return estimates
}

/**
 * 从东方财富API获取基金详情
 */
async function fetchFundDetailFromApi(code: string): Promise<Partial<FundInfo> | null> {
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  try {
    const response = await axios.get('https://fundgzapp.eastmoney.com/fundapp/native/ntdetail', {
      params: { FCODE: code, _: Date.now() },
      headers: { 'Referer': 'https://fund.eastmoney.com/', 'User-Agent': UA },
      timeout: 8000
    })

    logger.log(`基金 ${code} API 响应状态: ${response.status}`)

    if (!response.data) {
      logger.error(`基金 ${code} API 返回空数据`)
      return null
    }

    const data = response.data?.Datas
    if (!data) {
      logger.warn(`基金 ${code} ntdetail API 无 Datas 字段，尝试 Search API 降级...`)
      return await fetchFundBasicInfoFromSearchApi(code)
    }

    const result = {
      code: data.FCODE,
      name: data.SHORTNAME,
      ftype: data.FTYPE || undefined,
      fund_company: data.JJGS || undefined,
      fund_manager: data.JJJL || undefined,
      establish_date: data.FOUNDDATE || undefined,
      fund_scale: data.FUNDSCALE ? parseFloat(data.FUNDSCALE) : undefined,
      benchmark: data.BENCHMARK || undefined
    }

    logger.log(`获取基金 ${code} 详情成功: name=${result.name}`)

    return result
  } catch (error: any) {
    if (error.response) {
      logger.warn(`基金 ${code} ntdetail 请求失败(HTTP ${error.response.status}),尝试 Search API 降级...`)
    } else {
      logger.warn(`基金 ${code} ntdetail 请求异常(${error.code || error.message}),尝试 Search API 降级...`)
    }
    return await fetchFundBasicInfoFromSearchApi(code)
  }
}

// ==================== FundService 类 ====================

/**
 * 基金服务类
 * 提供面向对象的基金数据操作接口
 */
export class FundService {
  private readonly CACHE_TTL_TRADING = 30 * 1000
  private readonly CACHE_TTL_NON_TRADING = 365 * 24 * 60 * 60 * 1000

  /**
   * 批量获取基金数据
   */
  async fetchFundsBatch(codes: string[]): Promise<FundCache[]> {
    if (codes.length === 0) return []
    
    const concurrencyLimit = 10
    const batches: string[][] = []
    
    for (let i = 0; i < codes.length; i += concurrencyLimit) {
      batches.push(codes.slice(i, i + concurrencyLimit))
    }
    
    const results: FundCache[] = []
    
    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(code => this.fetchFundFromApi(code))
      )
      
      results.push(...batchResults.filter(r => r !== null) as FundCache[])
    }
    
    return results
  }

  /**
   * 从API获取单个基金数据
   */
  private async fetchFundFromApi(code: string): Promise<FundCache | null> {
    try {
      const point = await fetchFundEstimatePoint(code)
      if (point && point.gsz > 0) {
        const info = getFundInfo(code)
        return {
          code,
          name: info?.name || '',
          type: '',
          nav: point.nav,
          accNav: point.nav,
          dayGrowth: point.gszzl,
          lastUpdate: point.gztime,
          gsz: point.gsz,
          gszzl: point.gszzl,
          gztime: point.gztime,
          jzrq: point.gztime ? point.gztime.slice(0, 10) : ''
        }
      }

      return null
    } catch (error) {
      logger.error(`获取基金 ${code} 数据失败:`, error)
      return null
    }
  }

  /**
   * 获取基金详情
   */
  async fetchFundDetail(code: string): Promise<Partial<FundCache> | null> {
    try {
      const response = await axios.get('https://fundgzapp.eastmoney.com/fundapp/native/ntdetail', {
        params: { FCODE: code, _: Date.now() },
        headers: { 
          'Referer': 'https://fund.eastmoney.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 8000
      })

      const data = response.data?.Datas
      
      if (!data) {
        return fetchFundBasicInfoFromSearchApi(code)
      }

      return {
        code: data.FCODE,
        name: data.SHORTNAME,
        ftype: data.FTYPE,
        fund_company: data.JJGS,
        fund_manager: data.JJJL,
        establish_date: data.FOUNDDATE,
        fund_scale: data.FUNDSCALE ? parseFloat(data.FUNDSCALE) : undefined,
        benchmark: data.BENCHMARK
      }
    } catch (error) {
      logger.error(`获取基金 ${code} 详情失败:`, error)
      return fetchFundBasicInfoFromSearchApi(code)
    }
  }

  /**
   * 批量补充基金信息
   */
  async enrichFundInfo(codes: string[]): Promise<void> {
    if (codes.length === 0) return

    const existingInfos = fundInfoRepository.findByCodes(codes)
    const codesToFetch = codes.filter(code => !existingInfos.has(code))

    if (codesToFetch.length === 0) return

    const newInfos: Array<Partial<FundCache> & { code: string }> = []
    
    for (const code of codesToFetch) {
      const detail = await this.fetchFundDetail(code)
      if (detail) {
        newInfos.push(detail as any)
      }
    }

    if (newInfos.length > 0) {
      fundInfoRepository.saveBatch(newInfos)
    }
  }

  /**
   * 获取并保存基金详情
   */
  async fetchAndSaveFundDetail(code: string): Promise<void> {
    const detail = await this.fetchFundDetail(code)
    if (detail && detail.name) {
      fundInfoRepository.save(detail as any)
    }
  }
}

// ==================== 导出 ====================

export {
  ESTIMATE_CACHE_TTL,
  FUND_CACHE_TTL,
  fetchDayGrowthFromEastmoney,
  fetchFundBasicInfoFromSearchApi,
  fetchFundFromLsjz,
  fetchFundData,
  fetchFundsBatch,
  generateTimeSeries,
  fetchFundDetailFromApi
}
