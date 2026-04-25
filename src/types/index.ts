// 基金基础信息
export interface Fund {
  code: string
  name: string
  type: string
  nav: number              // 最新净值
  accNav: number           // 累计净值
  dayGrowth: number        // 当日涨跌幅 (%)
  lastUpdate: string       // 最后更新时间
  growthValue?: number     // 涨跌额
  
  // 估值相关（新增）
  gsz?: number             // 估算净值
  gszzl?: number           // 估算涨跌幅 (%)
  gztime?: string          // 估值时间
  
  // 净值相关（新增）
  jzrq?: string            // 净值日期
  dwjz?: string            // 单位净值（字符串格式）
  
  // 历史数据相关（新增）
  yesterdayGrowth?: number // 昨日涨跌幅 (%)
  yesterdayDate?: string   // 昨日日期
  navDate?: string         // 净值日期
  
  // 涨跌幅（新增）
  zzl?: number             // 昨日涨跌幅
}

// 基金详情（扩展信息）
export interface FundDetail extends Fund {
  manager: string
  company: string
  size: number
  establishDate: string
  benchmark: string
  navHistory: NavHistory[]
}

// 净值历史记录
export interface NavHistory {
  date: string
  nav: number
  accNav: number
  growth: number
}

// 搜索结果
export interface SearchResult {
  code: string
  name: string
  type: string
  pinyin: string
}

// 持仓信息（新增）
export interface Holding {
  fundCode: string
  fundName: string
  share: number            // 持有份额
  cost: number             // 成本价
  amount: number           // 持有金额
  holdingDate: string      // 持有日期 YYYY-MM-DD
  // 收益相关字段
  settled?: boolean         // 是否已结算（当日收益已确认）
  lastSettledDate?: string  // 最后结算日期
  lastSettledStatus?: boolean // 最后结算日是否已结算（原始值）
  accumulatedProfit?: number // 累计历史收益（不含当天）
  currentDayProfit?: number  // 当日收益
  currentDayProfitRate?: number // 当日收益率
  profitType?: 'estimate' | 'final' // 收益类型：估值/最终
  lastProfitDate?: string   // 最后收益日期
  profitToday?: number     // 当日收益（兼容字段）
  profitTotal?: number     // 持有收益（兼容字段）
}

// 持仓收益历史记录
export interface HoldingProfitHistory {
  id?: number
  userId: string
  fundCode: string
  fundName: string
  profitDate: string       // 收益日期
  openingAmount: number    // 开盘持仓金额
  closingAmount: number    // 收盘持仓金额
  dayProfit: number        // 当日收益
  dayProfitRate: number    // 当日收益率
  nav?: number             // 净值
  profitType: 'estimate' | 'final' // 收益类型
  createdAt: number        // 创建时间
}

// 表格行数据（新增，用于 PC 端表格）
export interface FundTableRow {
  rawFund: Fund
  code: string
  fundName: string
  isUpdated: boolean       // 今日净值是否已更新
  
  // 净值相关
  latestNav: string        // 最新净值（格式化后）
  latestNavDate: string    // 净值日期
  latestNavDateShort: string  // 净值日期（短格式）
  estimateNav: string      // 估算净值
  estimateNavDate: string  // 估值时间
  estimateNavDateShort: string  // 估值时间（短格式）
  
  // 涨跌幅相关
  yesterdayChangePercent: string   // 昨日涨跌幅
  yesterdayChangeValue: number | null
  yesterdayDate: string
  estimateChangePercent: string    // 估值涨跌幅
  estimateChangeValue: number | null
  estimateTime: string
  estimateTimeShort: string        // 估值时间（短格式）
  
  // 收益相关（基于持仓）
  estimateProfit: string           // 估算收益
  estimateProfitValue: number | null
  estimateProfitPercent: string
  
  holdingAmount: string            // 持仓金额
  holdingAmountValue: number | null
  
  todayProfit: string              // 当日收益
  todayProfitPercent: string
  todayProfitValue: number | null
  todayProfitGrowthValue: number | null  // 用于计算当日收益的涨跌幅值
  isHistoryProfit: boolean         // 是否为最近交易日收益（非当天）
  todayProfitDate: string          // 收益对应的日期
  
  holdingProfit: string            // 持有收益
  holdingProfitPercent: string
  holdingProfitValue: number | null
}
