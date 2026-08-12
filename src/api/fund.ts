import axios from 'axios'
import type { Fund, FundDetail, SearchResult } from '@/types'

const eastmoneyApi = axios.create({
  baseURL: '/api/eastmoney',
  timeout: 10000
})

function createPlaceholder(code: string): Fund {
  return {
    code,
    name: `基金${code}`,
    type: '',
    nav: 0,
    accNav: 0,
    dayGrowth: 0,
    lastUpdate: '',
    gszzl: 0,
    gsz: 0,
    gztime: '',
    jzrq: ''
  }
}

export async function fetchFunds(codes: string[], forceRefresh = false): Promise<Fund[]> {
  try {
    const response = await axios.post('/api/funds', { codes, forceRefresh }, { timeout: 30000 })
    const funds: any[] = response.data || []
    const fundsMap = new Map(funds.map(f => [f.code, f]))

    return codes.map(code => {
      const fund = fundsMap.get(code)
      if (!fund) return createPlaceholder(code)

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
  } catch (error) {
    console.error('获取基金数据失败:', error)
    return codes.map(createPlaceholder)
  }
}

export async function searchFunds(keyword: string): Promise<SearchResult[]> {
  try {
    const response = await eastmoneyApi.get('/FundSearch.ashx', {
      params: { key: keyword, pagesize: 20, _: Date.now() }
    })
    return response.data?.Datas || []
  } catch (error) {
    console.error('搜索基金失败:', error)
    return []
  }
}

export async function getFundDetail(code: string): Promise<FundDetail | null> {
  try {
    const response = await eastmoneyApi.get('/FundDetail.ashx', {
      params: { FCODE: code, _: Date.now() }
    })
    const data = response.data?.Datas
    if (!data) return null

    const nav = data.NAV || 0
    const dayGrowth = data.DAYGROWTH || 0
    const growthValue = nav > 0 ? (dayGrowth / 100) * nav : 0

    return {
      code: data.FCODE,
      name: data.SHORTNAME,
      type: data.FTYPE || '',
      nav,
      accNav: data.ACCNAV || 0,
      dayGrowth,
      lastUpdate: data.FSRQ || '',
      manager: data.FUNDMANAGER || data.JJJL || '',
      company: data.JJGS || '',
      size: data.FUNDSCALE ? parseFloat(data.FUNDSCALE) : 0,
      establishDate: data.FOUNDDATE || '',
      benchmark: data.BENCHMARK || '',
      navHistory: data.NETVALUE || [],
      growthValue
    }
  } catch (error) {
    console.error('获取基金详情失败:', error)
    return null
  }
}

export async function getFundHistory(code: string, period: string = '1'): Promise<any> {
  try {
    const response = await eastmoneyApi.get('/FundNetValue.ashx', {
      params: { FCODE: code, period, _: Date.now() }
    })
    return response.data?.Datas || []
  } catch (error) {
    console.error('获取基金历史净值失败:', error)
    return []
  }
}

export const fundApi = {
  search: searchFunds,
  getList: fetchFunds,
  getDetail: getFundDetail,
  getHistory: getFundHistory
}
