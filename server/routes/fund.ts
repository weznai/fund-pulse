import { Router, Request, Response } from 'express'
import axios from 'axios'
import iconv from 'iconv-lite'
import { logger } from '../logger.js'
import { getLocalDate, getCacheStats, getGlobalCacheStats, clearAllCache, getFundInfo, getGlobalEstimateCache, saveGlobalEstimateCache, getLatestGlobalEstimateCache, getRecommendFundCodes, getStockTimeTrend, getLatestStockTimeTrend, getSystemParam, getLatestNavDate, getNavHistoryRange, saveNavHistoryBatch, getTradingDay } from '../db/index.js'
import { isTradingTime, fetchEstimateDataForCodes } from '../scheduled/estimate.js'
import { checkTradingDay } from '../services/holidayService.js'
import { fetchFundData, fetchFundsBatch } from '../services/fundService.js'
import { getClientIp } from '../services/statsService.js'

const router = Router()

router.post('/funds', async (req: Request, res: Response) => {
  try {
    const { codes } = req.body
    if (!codes || !Array.isArray(codes)) return res.json([])
    const results = await fetchFundsBatch(codes)
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
    const response = await axios.get('https://fundgzapp.eastmoney.com/fundapp/native/ntdetail', {
      params: { FCODE, _: Date.now() },
      headers: { 'Referer': 'https://fund.eastmoney.com/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    })
    res.json(response.data)
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
    const url = `https://fundgz.1234567.com.cn/js/${code}.js?rt=${Date.now()}`

    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      responseType: 'text',
      timeout: 10000
    })

    const data = response.data
    const match = data.match(/jsonpgz\s*\(\s*(\{[\s\S]*?\})\s*\)/)

    if (match && match[1]) {
      const jsonData = JSON.parse(match[1])
      res.json(jsonData)
    } else {
      res.status(404).json({ error: '数据格式错误' })
    }
  } catch (error) {
    logger.error('天天基金估值接口代理错误:', error)
    res.status(500).json({ error: '获取估值数据失败' })
  }
})

router.get('/fund/holdings/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params
    const { getFundHoldings } = await import('../external/eastmoney.js')
    const fundInfo = getFundInfo(code)
    const holdings = await getFundHoldings(code)
    logger.log(`重仓股数据 ${fundInfo?.name || code}(${code}):`, holdings.length, '条')
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
          return res.json({ data, date: latestCached.date, isHistory: true, isUpdated: !!latestCached.isUpdated, finalNav: latestCached.nav ?? null, finalGrowth: latestCached.dayGrowth ?? null })
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
        return res.json({ data, isUpdated: !!globalCached.isUpdated, finalNav: globalCached.dayGrowth != null ? globalCached.nav : null, finalGrowth: globalCached.dayGrowth })
      } catch (e) {
        logger.error('解析全局缓存数据失败:', e)
      }
    }

    const estimates: Array<{ time: string; value: number; percent: number }> = []

    try {
      const eastMoneyUrls = [
        `https://fund.eastmoney.com/tfsj_v1.0.0/fsdata_${code}.js`,
        `https://fundf10.eastmoney.com/trend_${code}.js`,
      ]

      for (const url of eastMoneyUrls) {
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

              fundData.d.forEach((item: any) => {
                if (Array.isArray(item) && item.length >= 2) {
                  const timestamp = item[0]
                  const value = item[1]

                  const date = new Date(timestamp)
                  const hours = date.getHours().toString().padStart(2, '0')
                  const minutes = date.getMinutes().toString().padStart(2, '0')
                  const timeStr = `${hours}:${minutes}`

                  const percent = baseValue > 0 ? ((value - baseValue) / baseValue) * 100 : 0

                  estimates.push({
                    time: timeStr,
                    value: Number(value.toFixed(4)),
                    percent: Number(percent.toFixed(2))
                  })
                }
              })

              if (estimates.length > 0) {
                saveGlobalEstimateCache({ code, data: JSON.stringify(estimates), date: tradingDay })
                logger.log(`✅ 东方财富分时数据 ${fundName}(${code}):`, estimates.length, '条')
                return res.json(estimates)
              }
            }
          }
        } catch (e) {
        }
      }
    } catch (fsError: any) {
      logger.log('东方财富分时接口失败:', fsError.message)
    }

    try {
      const sinaUrl = `https://hq.sinajs.cn/list=fu_${code}`
      const sinaResponse = await axios.get(sinaUrl, {
        headers: {
          'Referer': 'https://finance.sina.com.cn/',
          'User-Agent': 'Mozilla/5.0'
        },
        responseType: 'arraybuffer',
        timeout: 8000
      })

      const decodedData = iconv.decode(Buffer.from(sinaResponse.data), 'gbk')
      const sinaMatch = decodedData.match(new RegExp(`fu_${code}="([^"]+)"`))

      if (sinaMatch && sinaMatch[1]) {
        const parts = sinaMatch[1].split(',')
        if (parts.length >= 8) {
          const nav = parseFloat(parts[2]) || 0
          const dayGrowth = parseFloat(parts[6]) || 0

          if (nav > 0) {
            logger.log(`📊 新浪估值 ${fundName}(${code}): nav=${nav}, dayGrowth=${dayGrowth}%, 无分时数据`)
          }
        }
      }
    } catch (sinaError: any) {
      logger.log('新浪估值接口失败:', sinaError.message)
    }

    try {
      const gzUrl = `https://fundgz.1234567.com.cn/js/${code}.js?rt=${Date.now()}`
      const gzResponse = await axios.get(gzUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        responseType: 'text',
        timeout: 5000
      })

      const gzMatch = gzResponse.data.match(/jsonpgz\s*\(\s*(\{[\s\S]*?\})\s*\)/)

      if (gzMatch && gzMatch[1]) {
        const gzData = JSON.parse(gzMatch[1])
        const nav = parseFloat(gzData.dwjz) || 0
        const gsz = parseFloat(gzData.gsz) || nav
        const gszzl = parseFloat(gzData.gszzl) || 0

        if (nav > 0) {
          logger.log(`📊 天天基金估值 ${fundName}(${code}): nav=${nav}, gszzl=${gszzl}%, 无分时数据`)
        }
      }
    } catch (gzError: any) {
      logger.log('天天基金估值接口失败:', gzError.message)
    }

    try {
      const historyUrl = `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=${code}&page=1&per=2`
      const historyResponse = await axios.get(historyUrl, {
        headers: { 'Referer': 'https://fund.eastmoney.com/' },
        timeout: 5000
      })

      const dataStr = historyResponse.data || ''
      const contentMatch = dataStr.match(/content:\s*"([^"]+)"/s)

      if (contentMatch && contentMatch[1]) {
        const content = contentMatch[1].replace(/\\'/g, "'").replace(/\\"/g, '"')
        const rowMatches = content.match(/<tr[\s\S]*?<\/tr>/gi) || []
        const dataRows = rowMatches.filter(r => /<td[^>]*>/i.test(r))

        if (dataRows.length >= 2) {
          const getText = (td: string) => td.replace(/<[^>]+>/g, '').trim()

          const cells0 = dataRows[0].match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []
          const cells1 = dataRows[1].match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []

          if (cells0.length >= 4 && cells1.length >= 4) {
            const nav0 = parseFloat(getText(cells1[1])) || 0
            const nav1 = parseFloat(getText(cells0[1])) || 0

            if (nav0 > 0 && nav1 > 0) {
              const dayGrowth = ((nav1 - nav0) / nav0) * 100
              logger.log(`📈 历史净值 ${fundName}(${code}): nav=${nav1}, dayGrowth=${dayGrowth.toFixed(2)}%, 无分时数据`)
            }
          }
        }
      }
    } catch (historyError: any) {
      logger.log('历史净值接口失败:', historyError.message)
    }

    if (isQDII) {
      try {
        const lsjzUrl = `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=${code}&page=1&per=2`
        const lsjzResponse = await axios.get(lsjzUrl, {
          headers: { 'Referer': 'https://fund.eastmoney.com/' },
          timeout: 5000
        })
        const lsjzStr = lsjzResponse.data || ''
        const lsjzContentMatch = lsjzStr.match(/content:\s*"(.+?)"/s)
        if (lsjzContentMatch && lsjzContentMatch[1]) {
          const lsjzContent = lsjzContentMatch[1].replace(/\\'/g, "'").replace(/\\"/g, '"')
          const lsjzRows = lsjzContent.match(/<tr[\s\S]*?<\/tr>/gi) || []
          const dataRows = lsjzRows.filter(r => /<td[^>]*>/i.test(r))
          if (dataRows.length >= 2) {
            const getText = (td: string) => td.replace(/<[^>]+>/g, '').trim()
            const r0Cells = dataRows[0].match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []
            const r1Cells = dataRows[1].match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []
            if (r0Cells.length >= 4 && r1Cells.length >= 4) {
              const dateStr = getText(r0Cells[0] || '')
              const nav = parseFloat(getText(r0Cells[1] || '')) || 0
              const prevNav = parseFloat(getText(r1Cells[1] || '')) || 0
              const growthText = getText(r0Cells[3] || '')
              const growthMatch = growthText.match(/([-+]?\d+(?:\.\d+)?)\s*%/)
              const dayGrowth = growthMatch ? parseFloat(growthMatch[1]) : (prevNav > 0 ? ((nav - prevNav) / prevNav) * 100 : 0)

              if (nav > 0) {
                logger.log(`🌍 QDII基金获取最新净值 ${fundName}(${code}): nav=${nav.toFixed(4)}, growth=${dayGrowth.toFixed(2)}%, 净值日期=${dateStr}`)
                return res.json({ data: [], date: dateStr, isHistory: true, isUpdated: true, finalNav: nav, finalGrowth: dayGrowth })
              }
            }
          }
        }
      } catch (qdiiError: any) {
        logger.log('QDII历史净值获取失败:', qdiiError.message)
      }

      const latestCached = getLatestGlobalEstimateCache(code, today)
      if (latestCached && latestCached.nav && latestCached.nav > 0) {
        try {
          const data = latestCached.data ? JSON.parse(latestCached.data) : []
          logger.log(`🌍 QDII基金回退到历史缓存 ${fundName}(${code}) (${latestCached.date}): nav=${latestCached.nav}, growth=${latestCached.dayGrowth}%`)
          return res.json({ data, date: latestCached.date, isHistory: true, isUpdated: !!latestCached.isUpdated, finalNav: latestCached.nav ?? null, finalGrowth: latestCached.dayGrowth ?? null })
        } catch (e) {
          logger.error('解析QDII历史数据失败:', e)
        }
      }
    }

    const latestCached = getLatestGlobalEstimateCache(code, today)
    if (latestCached && latestCached.data) {
      try {
        const data = JSON.parse(latestCached.data)
        logger.log(`⏪ 所有数据源失败，回退到历史分时数据 ${fundName}(${code}) (${latestCached.date}):`, data.length, '条')
        return res.json({ data, date: latestCached.date, isHistory: true, isUpdated: !!latestCached.isUpdated, finalNav: latestCached.nav ?? null, finalGrowth: latestCached.dayGrowth ?? null })
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

router.get('/fund/history/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params
    const period = String(req.query.period || '1')
    const fundInfo = getFundInfo(code)
    const fundName = fundInfo?.name || code

    const startDate = calcStartDate(period, fundInfo?.establish_date)
    const localLatest = getLatestNavDate(code)
    const today = getLocalDate()

    let needsSync = !localLatest || localLatest < today

    if (needsSync) {
      const { fetchFullNavData } = await import('../external/eastmoney.js')
      const fullData = await fetchFullNavData(code)
      if (fullData.length > 0) {
        saveNavHistoryBatch(code, fullData)
        logger.log(`📊 同步NAV历史 ${fundName}(${code}): ${fullData.length} 条, 最新=${fullData[fullData.length - 1].date}`)
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
