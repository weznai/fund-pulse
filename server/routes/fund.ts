import { Router, Request, Response } from 'express'
import axios from 'axios'
import iconv from 'iconv-lite'
import { logger } from '../logger.js'
import { getLocalDate, getCacheStats, getGlobalCacheStats, clearAllCache, getFundInfo, updateFundInfoField, getGlobalEstimateCache, saveGlobalEstimateCache, getLatestGlobalEstimateCache, getRecommendFundCodes, getStockTimeTrend, getLatestStockTimeTrend, getSystemParam, getLatestNavDate, getNavHistoryRange, saveNavHistoryBatch, getTradingDay } from '../db/index.js'
import { isTradingTime, fetchEstimateDataForCodes } from '../scheduled/estimate.js'
import { checkTradingDay } from '../services/holidayService.js'
import { fetchFundData, fetchFundsBatch } from '../services/fundService.js'
import { getClientIp } from '../services/statsService.js'
import { fetchFinalNavFromMobApi } from '../external/eastmoney.js'
import { fetchEstimateTimeseries, fetchFundEstimatePoint } from '../external/estimateSource.js'

const router = Router()

router.post('/funds', async (req: Request, res: Response) => {
  try {
    const { codes, forceRefresh } = req.body
    if (!codes || !Array.isArray(codes)) return res.json([])
    const results = await fetchFundsBatch(codes, !!forceRefresh)
    res.json(results)
  } catch (error) {
    logger.error('Batch fetch funds error:', error)
    res.status(500).json({ error: '获取数据失败' })
  }
})

router.get('/sina', async (req: Request, res: Response) => {
  try {
    const { list } = req.query
    const response = await axios.get(`https://hq.sinajs.cn/list=${list}`, {
      headers: { 'Referer': 'https://finance.sina.com.cn/' },
      responseType: 'arraybuffer'
    })
    const decodedData = iconv.decode(Buffer.from(response.data), 'gbk')
    res.send(decodedData)
  } catch (error) {
    logger.error('Sina API proxy error:', error)
    res.status(500).json({ error: '获取数据失败' })
  }
})

router.get('/eastmoney/FundSearch.ashx', async (req: Request, res: Response) => {
  try {
    const { key, pagesize } = req.query
    const response = await axios.get('https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx', {
      params: { m: 1, key, pagesize: pagesize || 20, _: Date.now() },
      headers: { 'Referer': 'https://fund.eastmoney.com/' }
    })
    const transformedData = {
      Datas: response.data.Datas?.map((item: any) => ({
        code: item.CODE,
        name: item.NAME,
        type: item.FundBaseInfo?.FTYPE || '',
        pinyin: item.JP
      })) || []
    }
    res.json(transformedData)
  } catch (error) {
    logger.error('Eastmoney Search API proxy error:', error)
    res.status(500).json({ error: '获取数据失败' })
  }
})

router.get('/eastmoney/FundDetail.ashx', async (req: Request, res: Response) => {
  try {
    const { FCODE } = req.query
    const code = String(FCODE)
    const mobHeaders = {
      'Referer': 'https://mpservice.com/eastmoneyfund/',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    }
    const mobParams = {
      deviceid: '3f8b2c5d-7a1e-4d9b-b6e3-2c4f8a1d5e7b',
      plat: 'Android',
      appType: 'ttjj',
      product: 'EFund',
      Version: '1'
    }

    // 并行获取静态详情 + 最新净值
    const [detailRes, navRes] = await Promise.all([
      axios.get('https://fundmobapi.eastmoney.com/FundMNewApi/FundMNDetailInformation', {
        params: { FCode: code, ...mobParams }, headers: mobHeaders, timeout: 8000
      }),
      axios.get('https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo', {
        params: { Fcodes: code, ...mobParams }, headers: mobHeaders, timeout: 8000
      })
    ])

    const d = detailRes.data?.Datas
    const n = navRes.data?.Datas?.[0]
    if (!d) {
      return res.json({ Datas: null, Success: false })
    }

    // 映射为前端 getFundDetail 预期的字段结构
    res.json({
      Datas: {
        FCODE: d.FCODE,
        SHORTNAME: d.SHORTNAME,
        FTYPE: d.FTYPE || '',
        FOUNDDATE: d.ESTABDATE || '',
        JJGS: d.JJGS || '',
        JJJL: d.JJJL || '',
        FUNDMANAGER: d.JJJL || '',
        FUNDSCALE: d.ENDNAV ? (parseFloat(d.ENDNAV) / 1e8).toFixed(2) : '',
        BENCHMARK: d.BENCH || '',
        NAV: n?.NAV || 0,
        ACCNAV: n?.ACCNAV || 0,
        DAYGROWTH: n?.NAVCHGRT || 0,
        FSRQ: n?.PDATE || '',
        NETVALUE: []
      },
      Success: true
    })
  } catch (error) {
    logger.error('Eastmoney Detail API proxy error:', error)
    res.status(500).json({ error: '获取数据失败' })
  }
})

router.get('/eastmoney/FundNetValue.ashx', async (req: Request, res: Response) => {
  try {
    const { FCODE, period } = req.query
    const response = await axios.get('https://fund.eastmoney.com/f10/F10Data.html', {
      params: { code: FCODE, line: period || '1' },
      headers: { 'Referer': 'https://fund.eastmoney.com/' }
    })
    res.send(response.data)
  } catch (error) {
    logger.error('Eastmoney History API proxy error:', error)
    res.status(500).json({ error: '获取数据失败' })
  }
})

router.get('/fundgz/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params
    const point = await fetchFundEstimatePoint(code)
    if (!point || point.gsz <= 0) {
      return res.status(404).json({ error: '无估值数据' })
    }
    const today = getLocalDate()
    res.json({
      fundcode: code,
      name: '',
      dwjz: point.nav,
      gsz: point.gsz,
      gszzl: point.gszzl,
      gztime: point.gztime,
      jzrq: today
    })
  } catch (error) {
    logger.error('获取估值数据失败:', error)
    res.status(500).json({ error: '获取估值数据失败' })
  }
})

/**
 * 获取基金重仓股持仓数据
 *
 * 数据源策略（由 fund_info.data_source 字段控制）：
 *   standard   → 东方财富标准API（FundArchivesDatas），适用于绝大多数基金
 *   overseas   → 东方财富海外站API（overseas.1234567.com.cn），适用于互认基金(968xxx)
 *   etf_linked → 穿透到底层ETF查询持仓，适用于ETF联接基金（如013309→513010）
 *   mobapi     → 仅移动端API获取净值，持仓和历史净值走海外站API，但不改写data_source
 *
 * 首次探测（data_source='standard' 时自动触发，探测成功后回写标记避免重复探测）：
 *   1. 标准API返回数据 → 直接用
 *   2. 标准API返回404页面(pageNotFound=true) → 该基金不在标准站 → 试海外站 → 成功则标记 overseas
 *   3. 标准API返回空持仓(pageNotFound=false) → 先试ETF穿透(MobAPI查底层ETF) → 成功则标记 etf_linked
 *   4. ETF穿透也无结果 → 最后试海外站兜底 → 成功则标记 overseas
 *   5. 全部失败 → 确实无持仓数据（如货币基金）
 */
router.get('/fund/holdings/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params
    const { getFundHoldings, getOverseasFundHoldings, getEtfUnderlyingCode } = await import('../external/eastmoney.js')
    const fundInfo = getFundInfo(code)
    const ds = fundInfo?.data_source || 'standard'
    let holdings: any[] = []
    let source = ds

    if (ds === 'overseas' || ds === 'mobapi') {
      holdings = await getOverseasFundHoldings(code)
    } else if (ds === 'etf_linked') {
      const etfCode = fundInfo?.data_extra?.etf_code
      if (etfCode) {
        holdings = (await getFundHoldings(etfCode)).data
        source = `穿透ETF(${etfCode})`
      }
    } else {
      const result = await getFundHoldings(code)
      holdings = result.data
      if (holdings.length === 0 && fundInfo) {
        if (result.pageNotFound) {
          // 情况2：标准API页面不存在(404) → 互认基金等，试海外站
          holdings = await getOverseasFundHoldings(code)
          if (holdings.length > 0) {
            source = 'overseas(探测-404)'
            updateFundInfoField(code, { data_source: 'overseas' })
          }
        } else {
          // 情况3：标准API返回空持仓 → 先试ETF穿透
          const etfCode = await getEtfUnderlyingCode(code)
          if (etfCode) {
            const etfResult = await getFundHoldings(etfCode)
            holdings = etfResult.data
            if (holdings.length > 0) {
              source = `etf_linked(探测,${etfCode})`
              updateFundInfoField(code, { data_source: 'etf_linked', data_extra: { etf_code: etfCode } })
            }
          }
          // 情况4：ETF穿透也无结果 → 最后试海外站兜底
          // （海外基金的持仓API返回"空内容"而非404，需要额外一次探测）
          if (holdings.length === 0) {
            holdings = await getOverseasFundHoldings(code)
            if (holdings.length > 0) {
              source = 'overseas(探测-兜底)'
              updateFundInfoField(code, { data_source: 'overseas' })
            }
          }
        }
      }
    }

    logger.log(`重仓股数据 ${fundInfo?.name || code}(${code}):`, holdings.length, '条', source ? `来源:${source}` : '')
    res.json(holdings)
  } catch (error) {
    logger.error('获取重仓股数据失败:', error)
    res.json([])
  }
})

router.get('/fund/estimate/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params
    const tradingDay = getTradingDay()
    const today = getLocalDate()
    const currentHour = new Date().getHours()
    const currentMinute = new Date().getMinutes()
    const todayIsTradingDay = checkTradingDay(today) && tradingDay === today
    const isBeforeTrading = currentHour < 9 || (currentHour === 9 && currentMinute < 30)

    const fundInfo = getFundInfo(code)
    const fundName = fundInfo?.name || code
    const isQDII = fundInfo
      ? ((fundInfo.ftype && /qdii/i.test(fundInfo.ftype)) || !!(fundInfo.name && /qdii/i.test(fundInfo.name)))
      : false

    if ((!todayIsTradingDay || isBeforeTrading) && !isQDII) {
      const latestCached = getLatestGlobalEstimateCache(code, today)
      if (latestCached && latestCached.data) {
        try {
          const data = JSON.parse(latestCached.data)
          logger.log(`🕘 非交易日或未到9:30，使用历史分时数据 ${fundName}(${code}) (${latestCached.date}):`, data.length, '条')
          return res.json({ data, date: latestCached.date, isHistory: true, isUpdated: !!latestCached.isUpdated, finalNav: latestCached.nav ?? null, finalGrowth: latestCached.dayGrowth ?? null, isQDII })
        } catch (e) {
          logger.error('解析历史分时数据失败:', e)
        }
      }
    }

    const globalCached = getGlobalEstimateCache(code, tradingDay)
    if (globalCached) {
      try {
        const data = JSON.parse(globalCached.data)
        logger.log(`🌐 使用全局缓存分时数据 ${fundName}(${code}):`, data.length, '条')
        return res.json({ data, isUpdated: !!globalCached.isUpdated, finalNav: globalCached.dayGrowth != null ? globalCached.nav : null, finalGrowth: globalCached.dayGrowth, isQDII })
      } catch (e) {
        logger.error('解析全局缓存数据失败:', e)
      }
    }

    // 实时获取分时估值曲线（新浪 FdFundService，覆盖普通基金/QDII/ETF联接）
    const estimate = await fetchEstimateTimeseries(code)
    if (estimate && estimate.timeseries.length > 0) {
      saveGlobalEstimateCache({
        code,
        data: JSON.stringify(estimate.timeseries),
        date: tradingDay,
        nav: estimate.nav,
        gsz: estimate.gsz,
        gszzl: estimate.gszzl
      })
      logger.log(`✅ 实时分时数据 ${fundName}(${code}):`, estimate.timeseries.length, '条')
      return res.json({ data: estimate.timeseries, isQDII })
    }

    // FdFundService 无分时数据时，对 QDII 基金尝试 MobAPI 取最新净值（海外市场可能休市）
    if (isQDII) {
      try {
        const mobNav = await fetchFinalNavFromMobApi(code)
        if (mobNav && mobNav.nav > 0) {
          logger.log(`🌍 QDII基金获取最新净值 ${fundName}(${code}): nav=${mobNav.nav.toFixed(4)}, growth=${mobNav.growth.toFixed(2)}%, 净值日期=${mobNav.date}`)
          return res.json({ data: [], date: mobNav.date, isHistory: true, isUpdated: true, finalNav: mobNav.nav, finalGrowth: mobNav.growth, isQDII })
        }
      } catch (qdiiError: any) {
        logger.log('QDII MobAPI获取失败:', qdiiError.message)
      }
    }

    const latestCached = getLatestGlobalEstimateCache(code, today)
    if (latestCached && latestCached.data) {
      try {
        const data = JSON.parse(latestCached.data)
        logger.log(`⏪ 所有数据源失败，回退到历史分时数据 ${fundName}(${code}) (${latestCached.date}):`, data.length, '条')
        return res.json({ data, date: latestCached.date, isHistory: true, isUpdated: !!latestCached.isUpdated, finalNav: latestCached.nav ?? null, finalGrowth: latestCached.dayGrowth ?? null, isQDII })
      } catch (e) {
        logger.error('解析历史分时数据失败:', e)
      }
    }

    logger.log(`⚠️  无法获取 ${fundName}(${code}) 的分时数据`)
    res.json([])
  } catch (error) {
    logger.error('获取实时估值走势失败:', error)
    res.json([])
  }
})

router.delete('/fund/estimate/cache/:code?', (req: Request, res: Response) => {
  const { code } = req.params
  if (code) {
    logger.log(`🗑️ 清除 ${code} 的估值缓存`)
    res.json({ success: true, message: `已清除 ${code} 的估值缓存` })
  } else {
    logger.log(`🗑️ 已清除所有估值缓存`)
    res.json({ success: true, message: `已清除所有估值缓存` })
  }
})

/**
 * 获取基金历史净值（业绩走势）数据
 *
 * 数据源策略：
 *   standard → 东方财富 pingzhongdata/{code}.js
 *   overseas → 东方财富海外站 F10页面解析 dwJQChartData
 *   etf_linked / mobapi → 海外站API（mobapi基金持仓和历史净值走海外站，净值估值走MobAPI）
 *
 * 首次探测（data_source='standard' 且需要同步时自动触发）：
 *   1. pingzhongdata返回有效JS数据 → 直接用
 *   2. pingzhongdata返回404页面(pageNotFound=true) → 试海外站F10 → 成功则标记 overseas
 *   3. pingzhongdata返回空数据(非404) → 该基金暂无NAV数据，不做特殊处理
 */
router.get('/fund/history/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params
    const period = String(req.query.period || '1')
    const fundInfo = getFundInfo(code)
    const fundName = fundInfo?.name || code
    const ds = fundInfo?.data_source || 'standard'

    const startDate = calcStartDate(period, fundInfo?.establish_date)
    const localLatest = getLatestNavDate(code)
    const today = getLocalDate()

    let needsSync = !localLatest || localLatest < today

    if (needsSync) {
      const { fetchFullNavData, fetchOverseasFullNavData } = await import('../external/eastmoney.js')
      let fullData: any[] = []

      if (ds === 'overseas' || ds === 'mobapi') {
        fullData = await fetchOverseasFullNavData(code)
      } else {
        const result = await fetchFullNavData(code)
        fullData = result.data
        if (fullData.length === 0 && result.pageNotFound && fundInfo) {
          fullData = await fetchOverseasFullNavData(code)
          if (fullData.length > 0) {
            updateFundInfoField(code, { data_source: 'overseas' })
          }
        }
      }

      if (fullData.length > 0) {
        saveNavHistoryBatch(code, fullData)
        logger.log(`📊 同步NAV历史 ${fundName}(${code}): ${fullData.length} 条, 来源:${ds}`)
      }
    }

    const localData = getNavHistoryRange(code, startDate)
    logger.log(`历史净值 ${fundName}(${code}) period=${period}: 本地${localData.length}条${needsSync ? '(已同步)' : ''}`)
    res.json(localData)
  } catch (error) {
    logger.error('获取历史净值失败:', error)
    res.json([])
  }
})

function calcStartDate(period: string, establishDate?: string): string {
  const now = new Date()
  let d: Date
  if (period === 'all') {
    if (establishDate) {
      const parsed = new Date(establishDate)
      if (!isNaN(parsed.getTime())) {
        d = parsed
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      }
    }
    d = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate())
  } else {
    const months = parseInt(period, 10)
    if (isNaN(months) || months <= 0) {
      d = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
    } else if (months < 12) {
      d = new Date(now.getFullYear(), now.getMonth() - months, now.getDate())
    } else if (months < 24) {
      d = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    } else {
      d = new Date(now.getFullYear() - Math.floor(months / 12), now.getMonth(), now.getDate())
    }
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

router.post('/estimate/fetch', async (req: Request, res: Response) => {
  try {
    if (!isTradingTime()) {
      return res.status(400).json({
        error: '当前不在交易时间',
        tradingHours: '周一至周五 9:30-16:00 (A股9:30-15:00, 港股至16:00)'
      })
    }

    const { codes } = req.body
    const codesToFetch = codes && Array.isArray(codes) && codes.length > 0
      ? codes
      : getRecommendFundCodes()

    await fetchEstimateDataForCodes(codesToFetch)

    const globalStats = getGlobalCacheStats()
    res.json({
      success: true,
      message: `已获取 ${codesToFetch.length} 只基金的估值数据`,
      stats: globalStats
    })
  } catch (error) {
    logger.error('手动获取估值数据失败:', error)
    res.status(500).json({ error: '获取估值数据失败' })
  }
})

router.get('/recommend-funds', (_req: Request, res: Response) => {
  try {
    const codes = getRecommendFundCodes()
    res.json({ codes })
  } catch (error) {
    logger.error('获取推荐基金失败:', error)
    res.status(500).json({ error: '获取推荐基金失败' })
  }
})

router.get('/index/timeshare/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params
    const today = getLocalDate()
    const stockCode = getSystemParam('STOCK_INDEX_CODE') || code
    logger.log(`📊 [指数分时] 请求 code=${code}, stockCode=${stockCode}, today=${today}`)
    
    let cached = getStockTimeTrend(stockCode, today)
    logger.log(`📊 [指数分时] 今日缓存: ${cached ? `有(${cached.date})` : '无'}`)
    
    if (!cached || !cached.data) {
      cached = getLatestStockTimeTrend(stockCode, today)
      logger.log(`📊 [指数分时] 历史缓存(before today): ${cached ? `有(${cached.date})` : '无'}`)
    }
    if (!cached || !cached.data) {
      cached = getLatestStockTimeTrend(stockCode)
      logger.log(`📊 [指数分时] 历史缓存(latest): ${cached ? `有(${cached.date})` : '无'}`)
    }
    
    if (cached && cached.data) {
      let parsedData = JSON.parse(cached.data)
      
      if (!parsedData || parsedData.length === 0) {
        return res.json({ success: false, error: '无分时数据' })
      }
      
      if (cached.date && cached.date !== today) {
        return res.json({ 
          success: true, 
          data: parsedData,
          cached: true,
          date: cached.date,
          isHistory: true
        })
      }
      
      return res.json({ 
        success: true, 
        data: parsedData,
        cached: true,
        date: cached.date,
        isHistory: false
      })
    }
    
    logger.log(`📊 [指数分时] 无缓存，从新浪获取数据 code=${code}`)
    
    const sinaCode = code.startsWith('sh') || code.startsWith('sz') ? code : `sh${code}`
    
    const response = await axios.get(`https://hq.sinajs.cn/list=${sinaCode}`, {
      headers: { 'Referer': 'https://finance.sina.com.cn/' },
      responseType: 'arraybuffer',
      timeout: 5000
    })
    
    const decodedData = iconv.decode(Buffer.from(response.data), 'gbk')
    const match = decodedData.match(/="([^"]*)"/)
    
    if (!match || !match[1]) {
      return res.json({ success: false, error: '获取指数数据失败' })
    }
    
    const parts = match[1].split(',')
    if (parts.length < 4) {
      return res.json({ success: false, error: '数据格式错误' })
    }
    
    const yesterdayClose = parseFloat(parts[2])
    const currentPrice = parseFloat(parts[3])
    
    if (!yesterdayClose || yesterdayClose === 0) {
      return res.json({ success: false, error: '无效的昨收价格' })
    }
    
    const percent = ((currentPrice - yesterdayClose) / yesterdayClose) * 100
    const now = new Date()
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const timeSeries = [
      { time: '09:30', value: yesterdayClose, percent: 0 },
      { time: currentTime, value: currentPrice, percent: Math.round(percent * 100) / 100 }
    ]
    
    logger.log(`📊 [指数分时] 新浪数据: 昨收=${yesterdayClose}, 现价=${currentPrice}, 涨跌幅=${percent.toFixed(2)}%`)
    res.json({ success: true, data: timeSeries, cached: false, isHistory: false })
  } catch (error) {
    logger.error('获取指数分时数据失败:', error)
    res.status(500).json({ error: '获取指数分时数据失败' })
  }
})

export default router
