import type { Fund } from '@/types'
import type { Holding } from '@/types'
import type { StoredTempHolding } from '@/types/tempHolding'

/**
 * 前端收益计算（仅用于临时客户）
 *
 * 计算公式：
 * - 累计收益 = (当前净值 - 成本价) * 持有份额
 * - 当日收益 = 持有金额 * (涨跌幅 / 100)
 *
 * 注意：这个函数只在临时客户场景下使用，不影响登录用户
 */

/**
 * 计算单个基金的收益
 */
export function calculateFundProfit(
  fund: Fund,
  holding: Holding
): {
  amount: number          // 当前持仓金额
  todayProfit: number | null     // 当日收益
  totalProfit: number | null     // 累计收益（临时客户用）
  effectiveGrowth: number | null // 使用的涨跌幅
} {
  // 确保有持有份额和成本价
  if (!holding.share || holding.share <= 0) {
    return {
      amount: holding.amount || 0,
      todayProfit: null,
      totalProfit: null,
      effectiveGrowth: null
    }
  }

  // 确定当前净值（优先使用真实净值，其次使用估算净值）
  const today = new Date().toLocaleDateString('sv-SE')
  const hasTodayNetValue = fund.jzrq === today
  const hasTodayEstimate = fund.gztime?.startsWith(today)

  let currentNav: number
  let effectiveGrowth: number | null = null

  if (hasTodayNetValue || !hasTodayEstimate) {
    // 使用真实净值
    currentNav = fund.nav || 0
    effectiveGrowth = fund.dayGrowth ?? null
  } else {
    // 使用估算净值（交易日且有估算数据时）
    currentNav = fund.gsz || fund.nav || 0
    effectiveGrowth = fund.gszzl ?? fund.dayGrowth ?? null
  }

  if (currentNav <= 0) {
    return {
      amount: holding.amount || 0,
      todayProfit: null,
      totalProfit: null,
      effectiveGrowth: null
    }
  }

  // 当前持仓金额
  const amount = Math.round(holding.share * currentNav * 100) / 100

  // 当日收益（基于涨跌幅）
  const todayProfit =
    effectiveGrowth !== null
      ? Math.round(amount * (effectiveGrowth / 100) * 100) / 100
      : null

  // 累计收益（临时客户专用）= (当前净值 - 成本价) * 持有份额
  const totalProfit =
    holding.cost && holding.cost > 0
      ? Math.round((currentNav - holding.cost) * holding.share * 100) / 100
      : null

  return {
    amount,
    todayProfit,
    totalProfit,
    effectiveGrowth
  }
}

/**
 * 批量计算所有基金的收益（临时客户）
 *
 * @param funds 基金数据
 * @param holdings 持仓数据
 * @returns Map<基金代码, 计算结果>
 */
export function calculateAllProfits(
  funds: Fund[],
  holdings: Map<string, Holding>
): Map<
  string,
  {
    amount: number
    todayProfit: number | null
    totalProfit: number | null
    effectiveGrowth: number | null
  }
> {
  const results = new Map()

  for (const fund of funds) {
    const holding = holdings.get(fund.code)
    if (!holding) continue

    const profit = calculateFundProfit(fund, holding)
    results.set(fund.code, profit)
  }

  return results
}

/**
 * 更新临时客户的增强数据
 *
 * 说明：这个函数只在临时客户登录时调用，用于前端计算的收益缓存
 * 不影响登录用户的数据
 */
export function updateTempHoldingEnhancement(
  holding: StoredTempHolding,
  profit: ReturnType<typeof calculateFundProfit>
): StoredTempHolding {
  const today = new Date().toLocaleDateString('sv-SE')

  return {
    ...holding,
    calculatedTotalProfit: profit.totalProfit ?? undefined,
    calculatedTodayProfit: profit.todayProfit ?? undefined,
    lastCalculatedDate: today,
    navAtCalculation: profit.amount / (holding.share || 1)
  }
}
