import type { Holding } from '@/types'

/**
 * 临时客户增强数据（仅前端使用）
 * 说明：这是临时客户的本地存储增强，不影响登录用户
 */
export interface TempHoldingEnhancement {
  calculatedTotalProfit?: number   // 前端计算的累计收益
  calculatedTodayProfit?: number   // 前端计算的当日收益
  lastCalculatedDate?: string      // 最后计算日期
  navAtCalculation?: number        // 计算时使用的净值
}

/**
 * 兼容性：旧的临时客户数据没有这些字段，需要向后兼容
 */
export interface LegacyHolding {
  fundCode: string
  fundName: string
  share: number
  cost: number
  amount: number
  holdingDate: string
}

/**
 * 存储的临时客户持仓数据（兼容旧版本）
 */
export type StoredTempHolding = Holding & TempHoldingEnhancement

/**
 * 判断是否为旧的临时客户数据
 */
export function isLegacyHolding(holding: any): holding is LegacyHolding {
  return (
    holding &&
    typeof holding.fundCode === 'string' &&
    typeof holding.fundName === 'string' &&
    typeof holding.share === 'number' &&
    typeof holding.cost === 'number' &&
    typeof holding.amount === 'number' &&
    typeof holding.holdingDate === 'string'
  )
}

/**
 * 升级旧的临时客户数据
 */
export function upgradeLegacyHolding(legacy: LegacyHolding): StoredTempHolding {
  return {
    ...legacy,
    calculatedTotalProfit: 0,
    calculatedTodayProfit: 0,
    lastCalculatedDate: legacy.holdingDate,
    navAtCalculation: legacy.amount / legacy.share
  }
}

/**
 * 数据版本标识（用于未来扩展）
 */
export const TEMP_STORAGE_VERSION = 'v2'
