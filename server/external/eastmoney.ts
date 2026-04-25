import axios from 'axios'
import { getStockChangePercent } from './tencent.js'

export interface HistoryData {
  date: string
  nav: number
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

export async function getFundHoldings(code: string): Promise<HoldingsData[]> {
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

  return holdings
}
