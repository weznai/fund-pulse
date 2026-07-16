import axios from 'axios'
import { getStockChangePercent } from './tencent.js'
import { logger } from '../logger.js'

export interface HistoryData {
  date: string
  nav: number
  growth: number
  accNav?: number
}

export interface FullNavData {
  date: string
  nav: number
  accNav: number
  growth: number
}

export interface HoldingsData {
  name: string
  code: string
  ratio: string
  change: string
}

const getText = (td: string) => td.replace(/<[^>]+>/g, '').trim()

function getStartTimestamp(period: string, establishDate?: string): number {
  const now = new Date()
  if (period === 'all') {
    if (establishDate) {
      const parsed = new Date(establishDate)
      if (!isNaN(parsed.getTime())) return parsed.getTime()
    }
    return new Date(now.getFullYear() - 10, now.getMonth(), now.getDate()).getTime()
  }
  const months = parseInt(period, 10)
  if (isNaN(months) || months <= 0) {
    return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).getTime()
  }
  if (months < 12) {
    return new Date(now.getFullYear(), now.getMonth() - months, now.getDate()).getTime()
  }
  if (months < 24) {
    return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).getTime()
  }
  return new Date(now.getFullYear() - Math.floor(months / 12), now.getMonth(), now.getDate()).getTime()
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function getFundHistory(code: string, period: string, establishDate?: string): Promise<HistoryData[]> {
  const startTs = getStartTimestamp(period, establishDate)

  const response = await axios.get(`https://fund.eastmoney.com/pingzhongdata/${code}.js`, {
    headers: { 'Referer': 'https://fund.eastmoney.com/' },
    timeout: 10000,
    responseType: 'text'
  })

  const jsContent = response.data || ''
  const dataMatch = jsContent.match(/var\s+Data_netWorthTrend\s*=\s*(\[[\s\S]+?\]);/)
  if (!dataMatch || !dataMatch[1]) return []

  const rawItems: Array<{ x: number; y: number; equityReturn: number }> = JSON.parse(dataMatch[1])
  const filtered = rawItems.filter(item => item.x >= startTs)

  return filtered.map(item => ({
    date: formatTimestamp(item.x),
    nav: item.y,
    growth: item.equityReturn || 0
  }))
}

export interface NavDataResult {
  data: FullNavData[]
  pageNotFound: boolean
}

export async function fetchFullNavData(code: string): Promise<NavDataResult> {
  const response = await axios.get(`https://fund.eastmoney.com/pingzhongdata/${code}.js`, {
    headers: { 'Referer': 'https://fund.eastmoney.com/' },
    timeout: 10000,
    responseType: 'text'
  })

  const jsContent = response.data || ''

  if (jsContent.includes('页面未找到') || jsContent.includes('您访问的页面不存在')) {
    return { data: [], pageNotFound: true }
  }

  const navMatch = jsContent.match(/var\s+Data_netWorthTrend\s*=\s*(\[[\s\S]+?\]);/)
  if (!navMatch || !navMatch[1]) return { data: [], pageNotFound: false }
  const navItems: Array<{ x: number; y: number; equityReturn: number }> = JSON.parse(navMatch[1])

  let accNavMap = new Map<number, number>()
  const accMatch = jsContent.match(/var\s+Data_ACWorthTrend\s*=\s*(\[[\s\S]+?\]);/)
  if (accMatch && accMatch[1]) {
    try {
      const accItems: Array<{ x: number; y: number }> = JSON.parse(accMatch[1])
      for (const item of accItems) {
        accNavMap.set(item.x, item.y)
      }
    } catch (e) {
      logger.error(`解析累计净值数据失败 ${code}:`, e instanceof Error ? e.message : e)
    }
  }

  return {
    data: navItems.map(item => ({
      date: formatTimestamp(item.x),
      nav: item.y,
      accNav: accNavMap.get(item.x) ?? item.y,
      growth: item.equityReturn || 0
    })),
    pageNotFound: false
  }
}

export interface HoldingsResult {
  data: HoldingsData[]
  pageNotFound: boolean
}

export async function getFundHoldings(code: string): Promise<HoldingsResult> {
  const url = `https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=${code}&topline=10&year=&month=&_=${Date.now()}`

  const response = await axios.get(url, {
    headers: {
      'Referer': 'https://fundf10.eastmoney.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    timeout: 10000
  })

  const holdings: HoldingsData[] = []
  const data = response.data || ''
  const stockCodes: string[] = []

  const apidataMatch = data.match(/var\s+apidata\s*=\s*\{/)
  const hasEmptyContent = apidataMatch && data.match(/content:\s*""/)
  const pageNotFound = !apidataMatch && (data.includes('页面未找到') || data.includes('您访问的页面不存在') || data.length < 100)

  const contentMatch = data.match(/content:\s*"([^"]+)"/s)
  if (contentMatch && contentMatch[1]) {
    const content = contentMatch[1]
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\r\\n/g, '')
      .replace(/\\\//g, '/')

    const rowMatches = content.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []

    for (const row of rowMatches) {
      const cells = row.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []
      if (cells.length < 3) continue

      const stockCode = getText(cells[1] || '')
      const name = getText(cells[2] || '')
      const ratio = getText(cells[6] || cells[3] || '')

      if (name && stockCode && !name.includes('序号') && stockCode.length > 3) {
        holdings.push({
          code: stockCode,
          name: name,
          ratio: ratio || '-',
          change: '-'
        })
        stockCodes.push(stockCode)

        if (holdings.length >= 10) break
      }
    }
  }

  if (stockCodes.length > 0) {
    const changeMap = await getStockChangePercent(stockCodes)
    for (const holding of holdings) {
      if (changeMap[holding.code]) {
        holding.change = changeMap[holding.code]
      }
    }
  }

  return { data: holdings, pageNotFound: !!pageNotFound }
}

interface OverseasFundMeta {
  hkfcode: string
  holdingsDate: string
}

async function getOverseasFundMeta(code: string): Promise<OverseasFundMeta | null> {
  try {
    const response = await axios.get(`https://overseas.1234567.com.cn/${code}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000,
      responseType: 'text'
    })
    const html = response.data || ''
    const hkfMatch = html.match(/hkfcode\s*=\s*['"](\d+)['"]/)
    if (!hkfMatch) return null
    const dateMatch = html.match(/持仓数据截止至[：:]\s*(\d{4}-\d{2}-\d{2})/)
    return {
      hkfcode: hkfMatch[1],
      holdingsDate: dateMatch ? dateMatch[1] : ''
    }
  } catch (error) {
    logger.error(`[Overseas] 获取基金元数据失败 ${code}:`, error instanceof Error ? error.message : error)
    return null
  }
}

export async function fetchOverseasFullNavData(code: string): Promise<FullNavData[]> {
  try {
    const response = await axios.get(`https://overseas.1234567.com.cn/f10/FundJz/${code}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 15000,
      responseType: 'text'
    })

    const html = response.data || ''
    const chartMatch = html.match(/dwJZChartData\s*=\s*eval\((\{.*?\})\)/s)
    if (!chartMatch || !chartMatch[1]) {
      logger.error(`[Overseas] ${code} 未找到dwJZChartData`)
      return []
    }

    const chartData = JSON.parse(chartMatch[1])
    const dataList: Array<{ x: number; y: number; equityReturn: string }> = chartData.dataList
    if (!dataList || !Array.isArray(dataList)) return []

    return dataList.map(item => ({
      date: formatTimestamp(item.x),
      nav: item.y,
      accNav: item.y,
      growth: parseFloat(item.equityReturn) || 0
    }))
  } catch (error) {
    logger.error(`[Overseas] 获取NAV历史失败 ${code}:`, error instanceof Error ? error.message : error)
    return []
  }
}

interface OverseasHoldingItem {
  ITEMNAME: string
  PCTNV: number
  ENDDATE: string
}

export async function getOverseasFundHoldings(code: string): Promise<HoldingsData[]> {
  try {
    const meta = await getOverseasFundMeta(code)
    if (!meta) {
      logger.error(`[Overseas] ${code} 无法获取基金元数据`)
      return []
    }

    const response = await axios.get('https://overseas.1234567.com.cn/overseasapi/OpenApiHander.ashx', {
      params: {
        api: 'HKFDApi',
        m: 'MethodJJZH',
        action: 1,
        hkfcode: meta.hkfcode,
        date: meta.holdingsDate,
        pageindex: 0,
        pagesize: 10
      },
      headers: {
        'Referer': `https://overseas.1234567.com.cn/f10/FundTZZH/${code}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    })

    let holdingsData: OverseasHoldingItem[] = response.data?.Data || []
    if (!holdingsData || !Array.isArray(holdingsData) || holdingsData.length === 0) return []

    return holdingsData.slice(0, 10).map(item => ({
      code: '',
      name: item.ITEMNAME || '-',
      ratio: item.PCTNV ? `${item.PCTNV.toFixed(2)}%` : '-',
      change: '-'
    }))
  } catch (error) {
    logger.error(`[Overseas] 获取持仓数据失败 ${code}:`, error instanceof Error ? error.message : error)
    return []
  }
}

export async function getEtfUnderlyingCode(code: string): Promise<string | null> {
  try {
    const response = await axios.get('https://fundmobapi.eastmoney.com/FundMNewApi/FundMNInverstPosition', {
      params: {
        FCODE: code,
        plat: 'Android',
        appType: 'ttjj',
        product: 'EFund',
        Version: '1',
        deviceid: '3f8b2c5d-7a1e-4d9b-b6e3-2c4f8a1d5e7b'
      },
      headers: {
        'Referer': 'https://mpservice.com/eastmoneyfund/',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
      },
      timeout: 8000
    })

    const datas = response.data?.Datas
    if (!datas) return null
    return datas.ETFCODE || null
  } catch (error) {
    logger.error(`[MobAPI] 获取ETF底层代码失败 ${code}:`, error instanceof Error ? error.message : error)
    return null
  }
}

export interface MobApiNavData {
  nav: number
  growth: number
  date: string
  accNav?: number
}

const nonFundCodes = new Set<string>()

export function isKnownNonFund(code: string): boolean {
  return nonFundCodes.has(code)
}

export async function fetchFinalNavFromMobApi(code: string): Promise<MobApiNavData | null> {
  try {
    const response = await axios.get('https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo', {
      params: {
        plat: 'Android',
        appType: 'ttjj',
        product: 'EFund',
        Version: '1',
        deviceid: '3f8b2c5d-7a1e-4d9b-b6e3-2c4f8a1d5e7b',
        Fcodes: code
      },
      headers: {
        'Referer': 'https://mpservice.com/eastmoneyfund/',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
      },
      timeout: 8000
    })

    const datas = response.data?.Datas
    if (!datas || !Array.isArray(datas) || datas.length === 0) {
      // Success=true 但 Datas=null：确认不是基金代码（股票/不存在），标记后避免反复请求
      if (response.data?.Success) {
        nonFundCodes.add(code)
        logger.log(`[MobAPI] ${code} 非基金代码，已标记跳过`)
      } else {
        logger.error(`[MobAPI] ${code} no datas:`, JSON.stringify(response.data).substring(0, 200))
      }
      return null
    }

    const item = datas[0]
    const nav = parseFloat(item.NAV) || 0
    const growth = parseFloat(item.NAVCHGRT) || 0
    const accNav = parseFloat(item.ACCNAV) || 0
    const date = item.PDATE || ''

    if (nav <= 0 || !date) {
      logger.error(`[MobAPI] ${code} invalid data: nav=${nav}, date=${date}`, JSON.stringify(item).substring(0, 200))
      return null
    }

    logger.log(`[MobAPI] ${code}: nav=${nav}, growth=${growth}, date=${date}`)
    return { nav, growth, date, accNav: accNav > 0 ? accNav : undefined }
  } catch (error) {
    logger.error(`[MobAPI] ${code} fetch error:`, error instanceof Error ? error.message : error)
    return null
  }
}
