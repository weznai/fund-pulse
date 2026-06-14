import { get, post, del } from '@/utils/request'

export interface Fund {
  code: string
  name: string
  type: string
  nav: number
  accNav: number
  dayGrowth: number
  lastUpdate: string
  gsz?: number
  gszzl?: number
  gztime?: string
  jzrq?: string
}

export interface SearchResult {
  code: string
  name: string
  type: string
  pinyin: string
}

export async function fetchFunds(codes: string[], forceRefresh = false): Promise<Fund[]> {
  try {
    const funds: any[] = await post('/api/funds', { codes, forceRefresh })
    const fundsMap = new Map(funds.map((f: any) => [f.code, f]))
    return codes.map(code => {
      const fund = fundsMap.get(code)
      if (!fund) {
        return { code, name: `基金${code}`, type: '', nav: 0, accNav: 0, dayGrowth: 0, lastUpdate: '', gszzl: 0, gsz: 0, gztime: '', jzrq: '' }
      }
      return {
        code: fund.code,
        name: fund.name,
        type: fund.type || '',
        nav: fund.nav || 0,
        accNav: fund.accNav || 0,
        dayGrowth: fund.dayGrowth ?? fund.gszzl ?? 0,
        lastUpdate: fund.lastUpdate || '',
        gszzl: fund.gszzl ?? fund.dayGrowth ?? 0,
        gsz: fund.gsz ?? fund.nav ?? 0,
        gztime: fund.gztime ?? fund.lastUpdate ?? '',
        jzrq: fund.jzrq ?? fund.lastUpdate ?? ''
      }
    })
  } catch {
    return codes.map(code => ({
      code, name: `基金${code}`, type: '', nav: 0, accNav: 0, dayGrowth: 0, lastUpdate: '', gszzl: 0, gsz: 0, gztime: '', jzrq: ''
    }))
  }
}

export async function searchFunds(keyword: string): Promise<SearchResult[]> {
  try {
    const data: any = await get('/api/eastmoney/FundSearch.ashx', { key: keyword, pagesize: 20 })
    return data?.Datas || []
  } catch {
    return []
  }
}

export async function getFundHistory(code: string, period = '1'): Promise<any[]> {
  try {
    const data: any = await get('/api/eastmoney/FundNetValue.ashx', { FCODE: code, period })
    return data?.Datas || []
  } catch {
    return []
  }
}

export async function getRecommendFunds(): Promise<{ codes: string[] }> {
  return get('/api/recommend-funds')
}
