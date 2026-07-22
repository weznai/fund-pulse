/**
 * 估值数据源分发层
 *
 * 通过 system_params 表的 ESTIMATE_DATA_SOURCE 参数控制数据源，
 * 后台可随时切换，无需改代码重启。
 *
 * 支持的模式：
 *   - auto（默认）：优先用新浪 FdFundService 拿完整分时曲线，失败降级到 fu_ 单点
 *   - sina：强制新浪 FdFundService 分时曲线（不降级，适合调试）
 *   - point：强制 fu_ 单点模式（分时曲线留空，只展示当前估值数字。
 *            适合 FdFundService 被封/IP 限流的生产环境）
 */

import { getSystemParam } from '../db/index.js'
import {
  fetchFundEstimateTimeseries as fetchFromSina,
  fetchFundEstimatePoint,
  type FundEstimateTimeseries,
  type FundEstimatePoint,
  type FundEstimatePointData
} from './sina.js'

export type EstimateSourceMode = 'auto' | 'sina' | 'point'

export const ESTIMATE_SOURCE_KEY = 'ESTIMATE_DATA_SOURCE'

/** 估值数据源可选模式 */
export const ESTIMATE_SOURCE_OPTIONS: Array<{ value: EstimateSourceMode; label: string; desc: string }> = [
  { value: 'auto', label: '自动', desc: '优先分时曲线，失败降级单点（推荐）' },
  { value: 'sina', label: '分时曲线', desc: '强制新浪 FdFundService，不降级' },
  { value: 'point', label: '单点模式', desc: '只用 fu_ 单点，适合 FdFundService 被限流的环境' }
]

/** 读取当前配置的数据源模式 */
export function getEstimateSource(): EstimateSourceMode {
  const v = getSystemParam(ESTIMATE_SOURCE_KEY) || 'auto'
  return v === 'sina' || v === 'point' ? v : 'auto'
}

// 单点估值接口：所有模式统一用 fu_，不受配置影响
export { fetchFundEstimatePoint }
export type { FundEstimatePoint, FundEstimatePointData }

/**
 * 获取基金分时估值曲线（根据配置分发）
 *
 * - auto：先试 FdFundService，失败返回 null（调用方应降级到 fetchFundEstimatePoint）
 * - sina：强制 FdFundService（不降级）
 * - point：直接返回 null（不请求分时曲线，调用方走单点逻辑）
 */
export async function fetchEstimateTimeseries(code: string): Promise<FundEstimateTimeseries | null> {
  const mode = getEstimateSource()

  if (mode === 'point') {
    return null
  }

  const ts = await fetchFromSina(code)
  if (ts && ts.timeseries.length > 0) {
    return ts
  }

  // sina 模式不降级，auto 模式返回 null 让调用方走单点
  return mode === 'sina' ? ts : null
}
