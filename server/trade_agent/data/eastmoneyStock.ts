import axios from 'axios'
import { logger } from '../../logger.js'
import type {
  StockKlinePoint, StockInfo, StockFundamentals,
  BalanceSheetItem, CashFlowItem, IncomeStatementItem, StockNewsItem
} from '../types.js'

// ===== Shared request config =====
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
]

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

function buildHeaders(referer: string): Record<string, string> {
  return {
    'User-Agent': randomUA(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': referer,
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-site',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
  }
}

const HEADERS_QUOTE = () => buildHeaders('https://quote.eastmoney.com/')
const HEADERS_EMWEB = () => buildHeaders('https://emweb.securities.eastmoney.com/')
const HEADERS_SEARCH = () => buildHeaders('https://so.eastmoney.com/')
const HEADERS_FINANCE = () => buildHeaders('https://finance.eastmoney.com/')

// ===== Utility =====

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Simple rate limiter: ensure minimum interval between requests
let lastRequestTime = 0
const MIN_REQUEST_INTERVAL = 300  // ms

async function rateLimitedDelay(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < MIN_REQUEST_INTERVAL) {
    const jitter = Math.floor(Math.random() * 200)  // 0-200ms random jitter
    await sleep(MIN_REQUEST_INTERVAL - elapsed + jitter)
  }
  lastRequestTime = Date.now()
}

/** Retry an axios request on 5xx errors, with rate limiting */
async function axiosWithRetry(fn: () => Promise<any>, retries = 3, delayMs = 800): Promise<any> {
  for (let i = 0; i <= retries; i++) {
    await rateLimitedDelay()
    try {
      return await fn()
    } catch (e: any) {
      const status = e?.response?.status
      const isRetryable = (status >= 500 && status < 600) || e?.code === 'ECONNABORTED'
      if (isRetryable && i < retries) {
        const wait = delayMs * (i + 1)
        logger.log(`[eastmoneyStock] axiosWithRetry attempt${i + 1} failed (${status || e?.code}), retrying in ${wait}ms...`)
        await sleep(wait)
        continue
      }
      throw e
    }
  }
}

function normalizeCode(code: string): { secid: string; market: number } {
  const c = code.replace(/\s/g, '')
  let market = 0
  if (c.startsWith('6')) market = 1
  else if (c.startsWith('0') || c.startsWith('3')) market = 0
  else if (c.startsWith('4') || c.startsWith('8')) market = 0
  return { secid: `${market}.${c}`, market }
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

/**
 * Resolve secid via eastmoney suggest API.
 * Returns "{market}.{code}" or null.
 */
async function resolveSecid(code: string): Promise<string | null> {
  try {
    await rateLimitedDelay()
    const resp = await axios.get('https://searchapi.eastmoney.com/api/suggest/get', {
      params: { input: code, type: '14', token: 'D43BF722C8E33BDC906FB84D85E326E8', count: 5 },
      headers: buildHeaders('https://www.eastmoney.com/'),
      timeout: 8000,
    })
    const items = resp.data?.QuotationCodeTable?.Data
    if (!Array.isArray(items) || items.length === 0) return null
    const exact = items.find((it: any) => it.Code === code)
    if (exact) return `${exact.MktNum}.${code}`
    return `${items[0].MktNum}.${code}`
  } catch {
    return null
  }
}

// Parse raw push2 data into StockInfo
function parsePush2Data(d: any): StockInfo | null {
  if (!d || !d.f57) return null
  return {
    code: String(d.f57),
    name: d.f58 || '',
    industry: d.f59 || '',
    price: (d.f43 || 0) / 100,
    change: (d.f170 || 0) / 100,
    marketCap: (d.f116 || 0) / 100000000,
    pe: (d.f162 || 0) / 100,
    pb: (d.f167 || 0) / 100,
    totalShares: (d.f84 || 0) / 10000,
    floatShares: (d.f117 || 0) / 10000,
  }
}

// ===== K-line =====

export async function getStockKline(code: string, days: number = 120): Promise<StockKlinePoint[]> {
  const { secid } = normalizeCode(code)
  const endDate = formatDate(new Date())
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days - 30)
  const startStr = formatDate(startDate)

  const tryKline = async (sid: string): Promise<StockKlinePoint[]> => {
    const resp = await axiosWithRetry(() => axios.get('https://push2his.eastmoney.com/api/qt/stock/kline/get', {
      params: {
        secid: sid,
        fields1: 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13',
        fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
        klt: '101', fqt: '1',
        beg: startStr, end: endDate, lmt: days,
      },
      headers: HEADERS_QUOTE(),
      timeout: 10000,
    }))

    const klines = resp.data?.data?.klines
    if (!klines || !Array.isArray(klines)) return []

    return klines.map((line: string) => {
      const parts = line.split(',')
      return {
        date: parts[0],
        open: parseFloat(parts[1]) || 0,
        close: parseFloat(parts[2]) || 0,
        high: parseFloat(parts[3]) || 0,
        low: parseFloat(parts[4]) || 0,
        volume: parseFloat(parts[5]) || 0,
        amount: parseFloat(parts[6]) || 0,
        change: parseFloat(parts[8]) || 0,
        turnover: parseFloat(parts[10]) || 0,
      }
    }).slice(-days)
  }

  try {
    const result = await tryKline(secid)
    if (result.length > 0) return result

    logger.log(`[eastmoneyStock] getStockKline empty for secid=${secid}, trying fallback`)
    const resolved = await resolveSecid(code)
    if (resolved && resolved !== secid) {
      return await tryKline(resolved)
    }
    return []
  } catch (e: any) {
    logger.error(`[eastmoneyStock] getStockKline error: ${e?.message || e}`)
    return []
  }
}

// ===== Stock Info =====

export async function getStockInfo(code: string): Promise<StockInfo | null> {
  const { secid } = normalizeCode(code)
  const FIELDS = 'f43,f57,f58,f59,f84,f116,f117,f162,f167,f170,f171,f173,f177,f187,f190,f192'

  const fetchPush2 = async (sid: string) => {
    const resp = await axiosWithRetry(() => axios.get('https://push2.eastmoney.com/api/qt/stock/get', {
      params: { secid: sid, fields: FIELDS },
      headers: HEADERS_QUOTE(),
      timeout: 10000,
    }))
    return parsePush2Data(resp.data?.data)
  }

  // Attempt 1: push2 with guessed secid
  try {
    const info = await fetchPush2(secid)
    logger.log(`[eastmoneyStock] getStockInfo attempt1 secid=${secid} result=${info ? `${info.code}/${info.name}` : 'null'}`)
    if (info && info.code === code) return info
  } catch (e: any) {
    logger.log(`[eastmoneyStock] getStockInfo push2 attempt1 failed: ${e?.message}`)
  }

  // Attempt 1.5: try opposite market (e.g. 6-starting code might be SZ)
  const oppositeSecid = secid.startsWith('1.') ? `0.${code}` : `1.${code}`
  try {
    const info = await fetchPush2(oppositeSecid)
    if (info && info.code === code) return info
  } catch (e: any) {
    logger.log(`[eastmoneyStock] getStockInfo push2 attempt1.5 (opposite market) failed: ${e?.message}`)
  }

  // Attempt 2: push2 with resolved secid (via search)
  logger.log(`[eastmoneyStock] getStockInfo resolving secid for ${code}`)
  const resolvedSecid = await resolveSecid(code)
  if (resolvedSecid) {
    try {
      const info = await fetchPush2(resolvedSecid)
      if (info && info.code === code) return info
    } catch (e: any) {
      logger.log(`[eastmoneyStock] getStockInfo push2 attempt2 failed: ${e?.message}`)
    }
  }

  // Attempt 3: clist API on push2 (same domain, different endpoint)
  logger.log(`[eastmoneyStock] getStockInfo trying stock list for ${code}`)
  try {
    const mkt = code.startsWith('6') ? 'm:1+t:23,m:1+t:80' : code.startsWith('0') || code.startsWith('3') ? 'm:0+t:21,m:0+t:13' : 'm:0+t:81'
    const resp = await axiosWithRetry(() => axios.get('https://push2.eastmoney.com/api/qt/clist/get', {
      params: {
        pn: 1, pz: 1, po: 1, np: 1,
        fltt: 2, invt: 2,
        fid: 'f3',
        fs: mkt,
        fields: 'f2,f3,f9,f12,f14,f20,f23',
        fid0: 'f12',
        filter0: `(f12="${code}")`,
      },
      headers: HEADERS_QUOTE(),
      timeout: 10000,
    }))

    const items = resp.data?.data?.diff
    if (Array.isArray(items) && items.length > 0) {
      const s = items[0]
      if (String(s.f12) === code) {
        return {
          code: String(s.f12),
          name: s.f14 || '',
          industry: '',
          price: parseFloat(s.f2) || 0,
          change: parseFloat(s.f3) || 0,
          marketCap: (parseFloat(s.f20) || 0) / 100000000,
          pe: parseFloat(s.f9) || 0,
          pb: 0,
          totalShares: 0,
          floatShares: 0,
        }
      }
    }
  } catch (e: any) {
    logger.error(`[eastmoneyStock] getStockInfo stock list failed: ${e?.message}`)
  }

  // Attempt 4: push2his (different domain, independent service)
  logger.log(`[eastmoneyStock] getStockInfo trying push2his for ${code}`)
  try {
    const sid = resolvedSecid || secid
    const resp = await axiosWithRetry(() => axios.get('https://push2his.eastmoney.com/api/qt/stock/kline/get', {
      params: {
        secid: sid,
        fields1: 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13',
        fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
        klt: '101', fqt: '1',
        beg: '0', end: '20500101', lmt: 1,
      },
      headers: HEADERS_QUOTE(),
      timeout: 10000,
    }))

    const klines = resp.data?.data?.klines
    const name = resp.data?.data?.name
    if (Array.isArray(klines) && klines.length > 0) {
      const parts = klines[klines.length - 1].split(',')
      return {
        code,
        name: name || '',
        industry: '',
        price: parseFloat(parts[2]) || 0,
        change: parseFloat(parts[8]) || 0,
        marketCap: 0,
        pe: 0,
        pb: 0,
        totalShares: 0,
        floatShares: 0,
      }
    }
  } catch (e: any) {
    logger.error(`[eastmoneyStock] getStockInfo push2his failed: ${e?.message}`)
  }

  return null
}

// ===== Fundamentals =====

export async function getStockFundamentals(code: string): Promise<StockFundamentals | null> {
  let secid = normalizeCode(code).secid
  const FIELDS = 'f57,f58,f162,f167,f116,f187,f190,f192,f173,f171,f186'

  try {
    let resp = await axiosWithRetry(() => axios.get('https://push2.eastmoney.com/api/qt/stock/get', {
      params: { secid, fields: FIELDS },
      headers: HEADERS_QUOTE(),
      timeout: 10000,
    }))

    if (!resp.data?.data?.f57) {
      const resolved = await resolveSecid(code)
      if (resolved) {
        secid = resolved
        resp = await axiosWithRetry(() => axios.get('https://push2.eastmoney.com/api/qt/stock/get', {
          params: { secid, fields: FIELDS },
          headers: HEADERS_QUOTE(),
          timeout: 10000,
        }))
      }
    }

    const d = resp.data?.data
    if (!d) return null

    let revenue = 0, netProfit = 0, revenueGrowth = 0, profitGrowth = 0, grossMargin = 0, netMargin = 0, roe = 0, debtRatio = 0
    try {
      await rateLimitedDelay()
      const finResp = await axios.get('https://emweb.securities.eastmoney.com/PC_HSF10/NewFinanceAnalysis/ZYZBAjaxNew', {
        params: {
          companyType: '4',
          reportDateType: '0',
          reportType: '1',
          code: code.startsWith('6') ? `SH${code}` : `SZ${code}`,
        },
        headers: HEADERS_EMWEB(),
        timeout: 10000,
      })

      const finData = finResp.data?.data
      if (finData && Array.isArray(finData) && finData.length > 0) {
        const latest = finData[0]
        revenue = (parseFloat(latest.YYSR) || 0) / 100000000
        netProfit = (parseFloat(latest.GSJLR) || 0) / 100000000
        revenueGrowth = parseFloat(latest.YYSRTBZZ) || 0
        profitGrowth = parseFloat(latest.GSJLRTBZZ) || 0
        grossMargin = parseFloat(latest.XSMLL) || 0
        netMargin = parseFloat(latest.JMLRT) || 0
        roe = parseFloat(latest.ROEJQ) || 0
        debtRatio = parseFloat(latest.ZCFZL) || 0
      }
    } catch { /* fallback to basic data */ }

    return {
      code: String(d.f57),
      name: d.f58 || '',
      pe: d.f162 / 100 || 0,
      pb: d.f167 / 100 || 0,
      marketCap: (d.f116 || 0) / 100000000,
      totalRevenue: revenue,
      netProfit,
      revenueGrowth,
      profitGrowth,
      grossMargin,
      netMargin,
      roe,
      debtRatio,
    }
  } catch (e: any) {
    logger.error(`[eastmoneyStock] getStockFundamentals error: ${e?.message || e}`)
    return null
  }
}

// ===== Financial Reports =====

export async function getStockBalanceSheet(code: string): Promise<BalanceSheetItem[]> {
  try {
    await rateLimitedDelay()
    const prefix = code.startsWith('6') ? `SH${code}` : `SZ${code}`
    const resp = await axios.get('https://emweb.securities.eastmoney.com/PC_HSF10/NewFinanceAnalysis/ZCFZBAjaxNew', {
      params: { companyType: '4', reportDateType: '0', reportType: '1', code: prefix },
      headers: HEADERS_EMWEB(),
      timeout: 10000,
    })

    const data = resp.data?.data
    if (!data || !Array.isArray(data)) return []

    return data.slice(0, 4).map((item: any) => ({
      reportDate: item.REPORT_DATE?.slice(0, 10) || '',
      totalAssets: (parseFloat(item.ZCZJ) || 0) / 100000000,
      totalLiabilities: (parseFloat(item.FZHJ) || 0) / 100000000,
      totalEquity: (parseFloat(item.GDQYHJ) || 0) / 100000000,
      currentAssets: (parseFloat(item.LDZCHJ) || 0) / 100000000,
      currentLiabilities: (parseFloat(item.LDFZHJ) || 0) / 100000000,
      cash: (parseFloat(item.HBZJ) || 0) / 100000000,
    }))
  } catch (e: any) {
    logger.error(`[eastmoneyStock] getStockBalanceSheet error: ${e?.message || e}`)
    return []
  }
}

export async function getStockCashFlow(code: string): Promise<CashFlowItem[]> {
  try {
    await rateLimitedDelay()
    const prefix = code.startsWith('6') ? `SH${code}` : `SZ${code}`
    const resp = await axios.get('https://emweb.securities.eastmoney.com/PC_HSF10/NewFinanceAnalysis/XJLLBAjaxNew', {
      params: { companyType: '4', reportDateType: '0', reportType: '1', code: prefix },
      headers: HEADERS_EMWEB(),
      timeout: 10000,
    })

    const data = resp.data?.data
    if (!data || !Array.isArray(data)) return []

    return data.slice(0, 4).map((item: any) => ({
      reportDate: item.REPORT_DATE?.slice(0, 10) || '',
      operatingCashFlow: (parseFloat(item.JYXJJE) || 0) / 100000000,
      investingCashFlow: (parseFloat(item.TZXJJE) || 0) / 100000000,
      financingCashFlow: (parseFloat(item.CZXJJE) || 0) / 100000000,
      freeCashFlow: (parseFloat(item.ZYXJL) || 0) / 100000000,
    }))
  } catch (e: any) {
    logger.error(`[eastmoneyStock] getStockCashFlow error: ${e?.message || e}`)
    return []
  }
}

export async function getStockIncomeStatement(code: string): Promise<IncomeStatementItem[]> {
  try {
    await rateLimitedDelay()
    const prefix = code.startsWith('6') ? `SH${code}` : `SZ${code}`
    const resp = await axios.get('https://emweb.securities.eastmoney.com/PC_HSF10/NewFinanceAnalysis/LRBAjaxNew', {
      params: { companyType: '4', reportDateType: '0', reportType: '1', code: prefix },
      headers: HEADERS_EMWEB(),
      timeout: 10000,
    })

    const data = resp.data?.data
    if (!data || !Array.isArray(data)) return []

    return data.slice(0, 4).map((item: any) => ({
      reportDate: item.REPORT_DATE?.slice(0, 10) || '',
      totalRevenue: (parseFloat(item.YYSR) || 0) / 100000000,
      totalCost: (parseFloat(item.YYCB) || 0) / 100000000,
      grossProfit: (parseFloat(item.MLR) || 0) / 100000000,
      netProfit: (parseFloat(item.GSJLR) || 0) / 100000000,
      eps: parseFloat(item.MGJYXJJE) || 0,
    }))
  } catch (e: any) {
    logger.error(`[eastmoneyStock] getStockIncomeStatement error: ${e?.message || e}`)
    return []
  }
}

// ===== News =====

export async function getStockNews(code: string): Promise<StockNewsItem[]> {
  try {
    await rateLimitedDelay()
    const resp = await axios.get('https://search-api-web.eastmoney.com/search/jsonp', {
      params: {
        cb: 'jQuery',
        param: JSON.stringify({
          uid: '',
          keyword: code,
          type: ['cmsArticleWebOld'],
          client: 'web',
          clientType: 'web',
          clientVersion: 'curr',
          param: {
            cmsArticleWebOld: {
              searchScope: 'default',
              sort: 'default',
              pageIndex: 1,
              pageSize: 10,
              preTag: '',
              postTag: '',
            }
          }
        }),
      },
      headers: HEADERS_SEARCH(),
      timeout: 10000,
    })

    const text = typeof resp.data === 'string' ? resp.data : ''
    const jsonMatch = text.match(/jQuery\((\{.*\})\)/)
    if (!jsonMatch) return []

    const parsed = JSON.parse(jsonMatch[1])
    const articles = parsed?.result?.cmsArticleWebOld?.list || []

    return articles.map((a: any) => ({
      title: a.title?.replace(/<[^>]+>/g, '') || '',
      content: a.content?.replace(/<[^>]+>/g, '').slice(0, 200) || '',
      source: a.source || '',
      time: a.date || '',
      url: a.url || '',
    }))
  } catch (e: any) {
    logger.error(`[eastmoneyStock] getStockNews error: ${e?.message || e}`)
    return []
  }
}

export async function getGlobalNews(): Promise<StockNewsItem[]> {
  try {
    await rateLimitedDelay()
    const resp = await axios.get('https://np-listapi.eastmoney.com/comm/web/getNewsByColumns', {
      params: {
        client: 'web',
        biz: 'web_news_col',
        column: '350',
        order: '1',
        needInteractData: '0',
        page_index: '1',
        page_size: '10',
        req_trace: Date.now(),
      },
      headers: HEADERS_FINANCE(),
      timeout: 10000,
    })

    const newsList = resp.data?.data?.news_list || []
    return newsList.map((n: any) => ({
      title: n.title || '',
      content: n.summary?.slice(0, 200) || '',
      source: n.source || '',
      time: n.show_time || '',
      url: n.url || '',
    }))
  } catch (e: any) {
    logger.error(`[eastmoneyStock] getGlobalNews error: ${e?.message || e}`)
    return []
  }
}
