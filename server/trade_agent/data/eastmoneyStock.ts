import axios from 'axios'
import iconv from 'iconv-lite'
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

// Track EastMoney outage to skip retries when service is down
let eastmoneyDownSince = 0
const EASTMONEY_COOLDOWN = 60000  // 1 min — skip EastMoney after consecutive failures

function markEastMoneyDown() { eastmoneyDownSince = Date.now() }
function isEastMoneyLikelyDown(): boolean {
  if (eastmoneyDownSince === 0) return false
  if (Date.now() - eastmoneyDownSince > EASTMONEY_COOLDOWN) { eastmoneyDownSince = 0; return false }
  return true
}

async function rateLimitedDelay(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < MIN_REQUEST_INTERVAL) {
    const jitter = Math.floor(Math.random() * 200)  // 0-200ms random jitter
    await sleep(MIN_REQUEST_INTERVAL - elapsed + jitter)
  }
  lastRequestTime = Date.now()
}

/** Retry an axios request on 5xx / 403 / 429 errors, with rate limiting */
async function axiosWithRetry(fn: () => Promise<any>, retries = 3, delayMs = 600): Promise<any> {
  for (let i = 0; i <= retries; i++) {
    await rateLimitedDelay()
    try {
      return await fn()
    } catch (e: any) {
      const status = e?.response?.status
      const isRetryable = (status >= 500 && status < 600) || status === 403 || status === 429 || e?.code === 'ECONNABORTED' || e?.code === 'ETIMEDOUT'
      if (isRetryable && i < retries) {
        const wait = delayMs * (i + 1) + Math.floor(Math.random() * 500)
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

/** Convert code to Sina symbol prefix (sh/sz/bj). */
function toSinaSymbol(code: string): string {
  const c = code.replace(/\s/g, '')
  if (c.startsWith('6')) return `sh${c}`
  if (c.startsWith('4') || c.startsWith('8')) return `bj${c}`
  return `sz${c}`
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

  // If EastMoney is known to be down, skip straight to Sina
  if (isEastMoneyLikelyDown()) {
    logger.log(`[eastmoneyStock] getStockKline skipping EastMoney (service down) → Sina for ${code}`)
    return fetchKlineFromSina(code, days)
  }

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

  // Attempt 1: push2his with guessed secid
  try {
    const result = await tryKline(secid)
    if (result.length > 0) return result
  } catch (e: any) {
    logger.log(`[eastmoneyStock] getStockKline attempt1 secid=${secid} failed: ${e?.message}`)
    markEastMoneyDown()
  }

  // Attempt 2: resolve secid, retry with resolved secid
  logger.log(`[eastmoneyStock] getStockKline empty/failed for secid=${secid}, trying fallback`)
  await sleep(300)
  const resolved = await resolveSecid(code)
  if (resolved && resolved !== secid) {
    try {
      const result = await tryKline(resolved)
      if (result.length > 0) return result
    } catch (e: any) {
      logger.log(`[eastmoneyStock] getStockKline attempt2 secid=${resolved} failed: ${e?.message}`)
    }
  }

  // Attempt 3: retry original secid once more (EastMoney 502s are intermittent)
  await sleep(500)
  try {
    const result = await tryKline(secid)
    if (result.length > 0) {
      logger.log(`[eastmoneyStock] getStockKline succeeded on retry for secid=${secid}`)
      return result
    }
  } catch (e: any) {
    logger.log(`[eastmoneyStock] getStockKline attempt3 secid=${secid} failed: ${e?.message}`)
  }

  // Attempt 4: Sina Finance fallback (independent data source, works when EastMoney is down)
  return fetchKlineFromSina(code, days)
}

/** Fetch K-line data from Sina Finance (independent data source). */
async function fetchKlineFromSina(code: string, days: number): Promise<StockKlinePoint[]> {
  logger.log(`[eastmoneyStock] getStockKline trying Sina Finance for ${code}`)
  try {
    const symbol = toSinaSymbol(code)
    const resp = await axiosWithRetry(() => axios.get('https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData', {
      params: { symbol, scale: 240, ma: 'no', datalen: days },
      headers: { 'User-Agent': randomUA(), 'Referer': 'https://finance.sina.com.cn/' },
      timeout: 10000,
    }))
    const items = resp.data
    if (Array.isArray(items) && items.length > 0) {
      const parsed = items.map((it: any) => ({
        date: it.day?.slice(0, 10) || '',
        open: parseFloat(it.open) || 0,
        close: parseFloat(it.close) || 0,
        high: parseFloat(it.high) || 0,
        low: parseFloat(it.low) || 0,
        volume: parseFloat(it.volume) || 0,
        amount: 0,
        change: 0,
        turnover: 0,
      }))
      for (let i = parsed.length - 1; i > 0; i--) {
        const prev = parsed[i - 1].close
        parsed[i].change = prev > 0 ? +((parsed[i].close - prev) / prev * 100).toFixed(2) : 0
      }
      if (parsed.length > 0) parsed[0].change = 0
      logger.log(`[eastmoneyStock] getStockKline Sina got ${parsed.length} points for ${code}`)
      return parsed.slice(-days)
    }
  } catch (e: any) {
    logger.log(`[eastmoneyStock] getStockKline Sina failed: ${e?.message}`)
  }
  return []
}

// ===== Stock Info =====

/** Resolve secid and classification via eastmoney suggest API. */
async function resolveSecidWithMeta(code: string): Promise<{ secid: string; classify: string } | null> {
  try {
    await rateLimitedDelay()
    const resp = await axios.get('https://searchapi.eastmoney.com/api/suggest/get', {
      params: { input: code, type: '14', token: 'D43BF722C8E33BDC906FB84D85E326E8', count: 5 },
      headers: buildHeaders('https://www.eastmoney.com/'),
      timeout: 8000,
    })
    const items = resp.data?.QuotationCodeTable?.Data
    if (!Array.isArray(items) || items.length === 0) return null
    const exact = items.find((it: any) => it.Code === code) || items[0]
    return { secid: `${exact.MktNum}.${code}`, classify: exact.Classify || '' }
  } catch {
    return null
  }
}

/** Fetch basic stock info from push2his (historical kline, reliable 24/7). */
async function fetchStockInfoFromPush2his(sid: string, code: string): Promise<StockInfo | null> {
  const recentDate = new Date()
  recentDate.setDate(recentDate.getDate() - 10)
  const beg = formatDate(recentDate)
  const resp = await axiosWithRetry(() => axios.get('https://push2his.eastmoney.com/api/qt/stock/kline/get', {
    params: {
      secid: sid,
      fields1: 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13',
      fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
      klt: '101', fqt: '1',
      beg, end: '20500101', lmt: 5,
    },
    headers: HEADERS_QUOTE(),
    timeout: 10000,
  }))
  const klines = resp.data?.data?.klines
  const name = resp.data?.data?.name
  if (!Array.isArray(klines) || klines.length === 0) return null
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

export async function getStockInfo(code: string): Promise<StockInfo | null> {
  const { secid } = normalizeCode(code)
  const FIELDS = 'f43,f57,f58,f59,f84,f116,f117,f162,f167,f170,f171,f173,f177,f187,f190,f192'

  // If EastMoney is known to be down, skip straight to Sina
  if (isEastMoneyLikelyDown()) {
    logger.log(`[eastmoneyStock] getStockInfo skipping EastMoney (service down) → Sina for ${code}`)
    return fetchStockInfoFromSina(code)
  }

  const fetchPush2 = async (sid: string) => {
    const resp = await axiosWithRetry(() => axios.get('https://push2.eastmoney.com/api/qt/stock/get', {
      params: { secid: sid, fields: FIELDS },
      headers: HEADERS_QUOTE(),
      timeout: 10000,
    }))
    return parsePush2Data(resp.data?.data)
  }

  // Attempt 1: push2 real-time quote (richest data: PE, PB, marketCap, etc.)
  try {
    const info = await fetchPush2(secid)
    logger.log(`[eastmoneyStock] getStockInfo push2 secid=${secid} result=${info ? `${info.code}/${info.name}` : 'null'}`)
    if (info && info.code === code && info.name) return info
  } catch (e: any) {
    logger.log(`[eastmoneyStock] getStockInfo push2 secid=${secid} failed: ${e?.message}`)
    markEastMoneyDown()
  }

  // Attempt 2: push2his historical kline (reliable 24/7 — push2 may be blocked off-hours)
  // This is tried early to avoid cascading failures when push2 is unavailable.
  logger.log(`[eastmoneyStock] getStockInfo trying push2his (reliable fallback) for ${code}`)
  let push2hisInfo: StockInfo | null = null
  try {
    push2hisInfo = await fetchStockInfoFromPush2his(secid, code)
    if (push2hisInfo && push2hisInfo.name) {
      // Enrich with push2 data (PE, PB, marketCap) if available
      try {
        const push2Info = await fetchPush2(secid)
        if (push2Info && push2Info.code === code) {
          return {
            ...push2hisInfo,
            pe: push2Info.pe,
            pb: push2Info.pb,
            marketCap: push2Info.marketCap,
            totalShares: push2Info.totalShares,
            floatShares: push2Info.floatShares,
            industry: push2Info.industry || push2hisInfo.industry,
          }
        }
      } catch { /* push2 enrichment failed, use basic info from push2his */ }
      logger.log(`[eastmoneyStock] getStockInfo using push2his fallback for ${code}: ${push2hisInfo.name}`)
      return push2hisInfo
    }
  } catch (e: any) {
    logger.log(`[eastmoneyStock] getStockInfo push2his secid=${secid} failed: ${e?.message}`)
  }

  // Attempt 3: resolve secid via suggest API, check for fund codes, retry push2/push2his
  logger.log(`[eastmoneyStock] getStockInfo resolving secid for ${code}`)
  const meta = await resolveSecidWithMeta(code)
  if (meta) {
    if (meta.classify === 'OTCFUND' || meta.classify === 'ETF' || meta.classify === 'LOF') {
      logger.log(`[eastmoneyStock] getStockInfo ${code} is ${meta.classify}, not a stock — rejecting`)
      return null
    }
    if (meta.secid !== secid) {
      try {
        const info = await fetchPush2(meta.secid)
        if (info && info.code === code && info.name) return info
      } catch (e: any) {
        logger.log(`[eastmoneyStock] getStockInfo push2 resolved=${meta.secid} failed: ${e?.message}`)
      }
      try {
        const info = await fetchStockInfoFromPush2his(meta.secid, code)
        if (info && info.name) return info
      } catch (e: any) {
        logger.log(`[eastmoneyStock] getStockInfo push2his resolved=${meta.secid} failed: ${e?.message}`)
      }
    }
  }

  // Attempt 4: push2 with opposite market
  const oppositeSecid = secid.startsWith('1.') ? `0.${code}` : `1.${code}`
  try {
    const info = await fetchPush2(oppositeSecid)
    if (info && info.code === code && info.name) return info
  } catch (e: any) {
    logger.log(`[eastmoneyStock] getStockInfo push2 opposite=${oppositeSecid} failed: ${e?.message}`)
  }

  // Attempt 5: clist API
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
    markEastMoneyDown()
  }

  // Attempt 6: Sina Finance real-time quote (independent source, works when EastMoney is down)
  return fetchStockInfoFromSina(code)
}

/** Fetch stock info from Sina Finance (independent data source). */
async function fetchStockInfoFromSina(code: string): Promise<StockInfo | null> {
  logger.log(`[eastmoneyStock] getStockInfo trying Sina Finance for ${code}`)
  try {
    const symbol = toSinaSymbol(code)
    const resp = await axiosWithRetry(() => axios.get(`https://hq.sinajs.cn/list=${symbol}`, {
      headers: { 'User-Agent': randomUA(), 'Referer': 'https://finance.sina.com.cn/' },
      timeout: 10000,
      responseType: 'arraybuffer',
    }))
    const text = iconv.decode(Buffer.from(resp.data), 'gbk')
    const match = text.match(/="([^"]*)"/)
    if (match) {
      const fields = match[1].split(',')
      if (fields.length >= 4) {
        const name = fields[0]
        const price = parseFloat(fields[3]) || 0
        const prevClose = parseFloat(fields[2]) || 0
        if (name && price > 0) {
          logger.log(`[eastmoneyStock] getStockInfo Sina: ${name}(${code}) price=${price}`)
          return {
            code,
            name,
            industry: '',
            price,
            change: prevClose > 0 ? +((price - prevClose) / prevClose * 100).toFixed(2) : 0,
            marketCap: 0,
            pe: 0,
            pb: 0,
            totalShares: 0,
            floatShares: 0,
          }
        }
      }
    }
  } catch (e: any) {
    logger.log(`[eastmoneyStock] getStockInfo Sina failed: ${e?.message}`)
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
