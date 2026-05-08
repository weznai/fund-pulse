/**
 * 增强版基金 API
 */
import axios from 'axios'
import type { Fund } from '@/types'

/**
 * 批量获取基金数据（使用现有的后端接口）
 */
export async function fetchFundsEnhanced(codes: string[]): Promise<Fund[]> {
  const createPlaceholder = (code: string): Fund => ({
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
  })

  try {
    const response = await axios.post('/api/funds', {
      codes
    }, { timeout: 30000 })
    
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

/**
 * 搜索基金
 */
export async function searchFunds(keyword: string) {
  try {
    const response = await axios.get('/api/eastmoney/FundSearch.ashx', {
      params: {
        key: keyword,
        pageindex: 1,
        pagesize: 20,
        _: Date.now()
      },
      timeout: 10000
    })
    
    return response.data?.Datas || []
  } catch (error) {
    console.error('搜索基金失败:', error)
    return []
  }
}

/**
 * 获取基金历史净值
 */
export async function fetchFundHistory(code: string, period: string = '1') {
  try {
    const response = await axios.get('/api/eastmoney/FundNetValue.ashx', {
      params: {
        FCODE: code,
        period: period,
        _: Date.now()
      },
      timeout: 10000
    })
    
    return response.data?.Datas || []
  } catch (error) {
    console.error('获取基金历史净值失败:', error)
    return []
  }
}

/**
 * 导出所有增强版 API
 */
export const fundEnhancedApi = {
  fetchFundsEnhanced,
  searchFunds,
  fetchFundHistory
}
