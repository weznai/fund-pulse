export interface User {
  id: string
  username: string
  email: string
  password?: string
  type: string
  label?: string
  emailVerified: boolean
  disabled: boolean
  createdAt: number
  lastActive: number
}

export interface UserFund {
  fundCode: string
  fundName: string
  isHeld: boolean
  share: number
  cost: number
  amount: number
  holdingDate?: string
  settled?: boolean
  settleDate?: string
  accumulatedProfit?: number
  currentDayProfit?: number
  currentDayProfitRate?: number
  profitType?: 'estimate' | 'final'
  lastProfitDate?: string
  addedAt: number
}

export interface FundInfo {
  code: string
  name: string
  ftype?: string
  fund_company?: string
  fund_manager?: string
  establish_date?: string
  fund_scale?: number
  benchmark?: string
  is_recommend?: boolean
}

export interface FundCache {
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

export interface HoldingProfitHistory {
  id?: number
  userId: string
  fundCode: string
  fundName: string
  profitDate: string
  openingAmount: number
  closingAmount: number
  dayProfit: number
  dayProfitRate: number
  profitType: 'estimate' | 'final'
  createdAt: number
}

export interface SystemParam {
  key: string
  value: string
  remark?: string
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface QueryOptions {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface UserPreferences {
  userId: string
  hideAmount: boolean
  viewMode: 'list' | 'card'
  sortField: string
  sortDirection: 'asc' | 'desc'
  filterMode: 'all' | 'held' | 'favorite'
  migratedFromLocal: boolean
  lastUpdated: number
}
