import { Router, Request, Response } from 'express'
import axios from 'axios'
import iconv from 'iconv-lite'
import { logger } from '../logger.js'
import { getLocalDate, getCacheStats, getGlobalCacheStats, clearAllCache, getFundInfo, updateFundInfoField, getGlobalEstimateCache, saveGlobalEstimateCache, getLatestGlobalEstimateCache, getRecommendFundCodes, getStockTimeTrend, getLatestStockTimeTrend, getSystemParam, getLatestNavDate, getNavHistoryRange, saveNavHistoryBatch, getTradingDay } from '../db/index.js'
import { isTradingTime, fetchEstimateDataForCodes } from '../scheduled/estimate.js'
import { checkTradingDay } from '../services/holidayService.js'
import { fetchFundData, fetchFundsBatch } from '../services/fundService.js'
import { getClientIp } from '../services/statsService.js'

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
                return res.json({ data: estimates, isQDII })
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
                return res.json({ data: [], date: dateStr, isHistory: true, isUpdated: true, finalNav: nav, finalGrowth: dayGrowth, isQDII })
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
          return res.json({ data, date: latestCached.date, isHistory: true, isUpdated: !!latestCached.isUpdated, finalNav: latestCached.nav ?? null, finalGrowth: latestCached.dayGrowth ?? null, isQDII })
        } catch (e) {
          logger.error('解析QDII历史数据失败:', e)
        }
      }
    }

    if (estimates.length === 0) {
      try {
        const marketPrefix = code.startsWith('5') ? '1' : '0'
        const sinaPrefix = code.startsWith('5') ? 'sh' : 'sz'
        const sinaUrl = `https://hq.sinajs.cn/list=${sinaPrefix}${code}`
        const sinaResp = await axios.get(sinaUrl, {
          headers: { 'Referer': 'https://finance.sina.com.cn/', 'User-Agent': 'Mozilla/5.0' },
          responseType: 'arraybuffer', timeout: 8000
        })
        const sinaText = iconv.decode(Buffer.from(sinaResp.data), 'gbk')
        const sinaMatch = sinaText.match(new RegExp(`${sinaPrefix}${code}="([^"]+)"`))

        if (sinaMatch && sinaMatch[1]) {
          const sinaParts = sinaMatch[1].split(',')
          const preClose = parseFloat(sinaParts[2]) || 0

          if (preClose > 0) {
            const trendUrl = `https://push2his.eastmoney.com/api/qt/stock/trends2/get?secid=${marketPrefix}.${code}&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58&ndays=1&iscr=0&_=${Date.now()}`
            const trendResp = await axios.get(trendUrl, {
              headers: { 'Referer': 'https://quote.eastmoney.com/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
              timeout: 8000
            })

            if (trendResp.data?.data?.trends) {
              const trends = trendResp.data.data.trends
              for (const trend of trends) {
                const tParts = trend.split(',')
                const timeStr = tParts[0].split(' ')[1]
                const price = parseFloat(tParts[2])
                const percent = ((price - preClose) / preClose) * 100
                estimates.push({
                  time: timeStr,
                  value: Number(price.toFixed(4)),
                  percent: Number(percent.toFixed(2))
                })
              }

              if (estimates.length > 0) {
                saveGlobalEstimateCache({ code, data: JSON.stringify(estimates), date: tradingDay })
                logger.log(`📈 [场内ETF] 股票级分时数据 ${fundName}(${code}):`, estimates.length, '条')
                return res.json({ data: estimates, isQDII })
              }
            }
          }
        }
      } catch (etfError: any) {
        logger.log('[场内ETF] 股票级分时接口失败:', etfError.message)
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
