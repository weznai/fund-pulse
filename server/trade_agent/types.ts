// ===== Stock Data Types =====

export interface StockKlinePoint {
  date: string
  open: number
  close: number
  high: number
  low: number
  volume: number
  amount: number
  change: number      // 涨跌幅 %
  turnover: number    // 换手率 %
}

export interface StockInfo {
  code: string
  name: string
  industry: string
  price: number
  change: number
  marketCap: number   // 总市值(亿)
  pe: number
  pb: number
  totalShares: number // 总股本(万)
  floatShares: number // 流通股(万)
}

export interface StockFundamentals {
  code: string
  name: string
  pe: number          // 市盈率(动)
  pb: number          // 市净率
  marketCap: number   // 总市值(亿)
  totalRevenue: number // 营业收入(亿)
  netProfit: number   // 净利润(亿)
  revenueGrowth: number // 营收增长率(%)
  profitGrowth: number  // 净利润增长率(%)
  grossMargin: number   // 毛利率(%)
  netMargin: number     // 净利率(%)
  roe: number           // ROE(%)
  debtRatio: number     // 资产负债率(%)
}

export interface BalanceSheetItem {
  reportDate: string
  totalAssets: number      // 总资产(亿)
  totalLiabilities: number // 总负债(亿)
  totalEquity: number      // 所有者权益(亿)
  currentAssets: number    // 流动资产(亿)
  currentLiabilities: number // 流动负债(亿)
  cash: number             // 货币资金(亿)
}

export interface CashFlowItem {
  reportDate: string
  operatingCashFlow: number   // 经营现金流(亿)
  investingCashFlow: number   // 投资现金流(亿)
  financingCashFlow: number   // 筹资现金流(亿)
  freeCashFlow: number        // 自由现金流(亿)
}

export interface IncomeStatementItem {
  reportDate: string
  totalRevenue: number   // 营业收入(亿)
  totalCost: number      // 营业成本(亿)
  grossProfit: number    // 毛利润(亿)
  netProfit: number      // 净利润(亿)
  eps: number            // 每股收益
}

export interface StockNewsItem {
  title: string
  content: string
  source: string
  time: string
  url: string
}

// ===== Technical Indicator Types =====

export interface TechnicalIndicators {
  ma5: number[]
  ma10: number[]
  ma20: number[]
  ma60: number[]
  macd: {
    dif: number[]
    dea: number[]
    macd: number[]
  }
  rsi: {
    rsi6: number[]
    rsi12: number[]
    rsi24: number[]
  }
  boll: {
    upper: number[]
    middle: number[]
    lower: number[]
  }
  atr: number[]
  kdj: {
    k: number[]
    d: number[]
    j: number[]
  }
}

// ===== Agent Types =====

export type AgentName =
  | 'market_analyst'
  | 'social_media_analyst'
  | 'news_analyst'
  | 'fundamentals_analyst'
  | 'bull_researcher'
  | 'bear_researcher'
  | 'research_manager'
  | 'trader'
  | 'aggressive_debator'
  | 'conservative_debator'
  | 'neutral_debator'
  | 'risk_manager'

export type Phase = 'analysts' | 'research_debate' | 'trading' | 'risk_debate' | 'decision'

export type Decision = 'BUY' | 'SELL' | 'HOLD'

export interface AgentConfig {
  name: AgentName
  label: string
  phase: Phase
}

export const AGENT_CONFIGS: Record<AgentName, AgentConfig> = {
  market_analyst:       { name: 'market_analyst',       label: '市场分析师',     phase: 'analysts' },
  social_media_analyst: { name: 'social_media_analyst', label: '社交媒体分析师', phase: 'analysts' },
  news_analyst:         { name: 'news_analyst',         label: '新闻分析师',     phase: 'analysts' },
  fundamentals_analyst: { name: 'fundamentals_analyst', label: '基本面分析',   phase: 'analysts' },
  bull_researcher:      { name: 'bull_researcher',      label: '看多研究员',     phase: 'research_debate' },
  bear_researcher:      { name: 'bear_researcher',      label: '看空研究员',     phase: 'research_debate' },
  research_manager:     { name: 'research_manager',     label: '研究主管',       phase: 'research_debate' },
  trader:               { name: 'trader',               label: '交易员',         phase: 'trading' },
  aggressive_debator:   { name: 'aggressive_debator',   label: '激进分析师',     phase: 'risk_debate' },
  conservative_debator: { name: 'conservative_debator', label: '保守分析师',     phase: 'risk_debate' },
  neutral_debator:      { name: 'neutral_debator',      label: '中性分析师',     phase: 'risk_debate' },
  risk_manager:         { name: 'risk_manager',         label: '风险经理',       phase: 'decision' },
}

export const AGENT_ORDER: AgentName[] = [
  'market_analyst',
  'social_media_analyst',
  'news_analyst',
  'fundamentals_analyst',
  'bull_researcher',
  'bear_researcher',
  'research_manager',
  'trader',
  'aggressive_debator',
  'conservative_debator',
  'neutral_debator',
  'risk_manager',
]

// ===== SSE Event Types =====

export type SSEEventType =
  | 'agent_start'
  | 'agent_progress'
  | 'agent_complete'
  | 'tool_call'
  | 'tool_result'
  | 'debate_start'
  | 'debate_round'
  | 'decision'
  | 'usage'
  | 'done'
  | 'error'

export interface SSEEvent {
  type: SSEEventType
  agent?: AgentName
  phase?: Phase
  content?: string
  report?: string
  tool?: string
  toolResult?: string
  debateType?: string
  round?: number
  decision?: Decision
  credits?: number
  error?: string
  reportUrl?: string
  reportId?: number
}

// ===== Analysis Context =====

export interface StockAnalysisContext {
  stockCode: string
  stockInfo: StockInfo | null
  klineData: StockKlinePoint[]
  technicalIndicators: TechnicalIndicators | null
  fundamentals: StockFundamentals | null
  balanceSheet: BalanceSheetItem[]
  cashFlow: CashFlowItem[]
  incomeStatement: IncomeStatementItem[]
  stockNews: StockNewsItem[]
  globalNews: StockNewsItem[]
  // Agent reports accumulated during analysis
  agentReports: Record<AgentName, string>
  // Debate state
  debateHistory: string[]
}
