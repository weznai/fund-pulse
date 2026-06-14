import { get, post, del } from '@/utils/request'

export interface UserFund {
  fundCode: string
  fundName: string
  isHeld: boolean
  share: number
  cost: number
  amount: number
  settled?: boolean
  settleDate?: string
  accumulatedProfit?: number
  currentDayProfit?: number
  currentDayProfitRate?: number
  profitType?: 'estimate' | 'final'
  totalCost?: number
}

export interface UserPreferences {
  userId: string
  hideAmount: boolean
  viewMode: 'grid' | 'list'
  sortField: string
  sortDirection: 'desc' | 'asc'
  filterMode: 'all' | 'held'
  tradingDay?: string
}

export interface Holding {
  fundCode: string
  fundName: string
  share: number
  cost: number
  amount: number
  settled?: boolean
  settleDate?: string
  accumulatedProfit?: number
  currentDayProfit?: number
  currentDayProfitRate?: number
  totalCost?: number
}

export function getUserPreferences(): Promise<UserPreferences> {
  return get('/api/user/preferences')
}

export function saveUserPreferences(prefs: Partial<UserPreferences>): Promise<UserPreferences> {
  return post('/api/user/preferences', prefs).then((data: any) => data.preferences)
}

export function getUserFunds(): Promise<UserFund[]> {
  return get('/api/user/funds')
}

export function addUserFund(fundCode: string, fundName?: string): Promise<{ success: boolean }> {
  return post('/api/user/funds', { fundCode, fundName })
}

export function addUserFundsBatch(funds: Array<{ code: string; fundName?: string }>): Promise<{ success: boolean; count: number }> {
  return post('/api/user/funds/batch', { funds })
}

export function deleteUserFund(fundCode: string): Promise<{ success: boolean }> {
  return del(`/api/user/funds/${fundCode}`)
}

export function getHoldings(): Promise<Holding[]> {
  return get('/api/user/holdings')
}

export function saveHolding(holding: Holding): Promise<any> {
  return post('/api/user/holdings', holding)
}

export function deleteHolding(code: string): Promise<{ success: boolean }> {
  return del(`/api/user/holdings/${code}`)
}

export function setHolding(code: string, data: { share?: number; cost?: number; amount?: number }): Promise<any> {
  return post(`/api/user/funds/${code}/holding`, data)
}

export function removeHolding(code: string): Promise<{ success: boolean }> {
  return del(`/api/user/funds/${code}/holding`)
}
