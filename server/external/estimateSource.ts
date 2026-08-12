/**
 * 估值数据源分发层（统一入口）
 *
 * 本模块是所有估值请求的对外门面，内部通过 adapters/registry 协调多个数据源：
 *   - 基金级配置 fund_info.estimate_source
 *   - 全局默认 system_params.ESTIMATE_DEFAULT_SOURCE
 *   - 降级链 system_params.ESTIMATE_FALLBACK_CHAIN
 *   - 多数据源：sina_v1 / sina_v2 / sina_point / tiantian
 *
 * 旧的 auto/sina/point 三段式配置已废弃（启动时由迁移自动映射到新键），
 * 旧导出 ESTIMATE_SOURCE_KEY / ESTIMATE_SOURCE_OPTIONS / getEstimateSource 仅为
 * 向下兼容保留，不再影响实际分发逻辑。
 *
 * 后台管理请使用独立的 /api/admin/estimate-sources 路由（routes/estimateSource.ts）。
 */

import {
  fetchTimeseriesWithFallback,
  fetchPointWithFallback,
  resolveAdapterChain,
  getDefaultSource,
  getFallbackChain
} from './adapters/registry.js'
import type { FundEstimateTimeseries, FundEstimatePointData } from './sina.js'

// ============================================================================
// 向下兼容的旧导出（已废弃，不再影响分发）
// ============================================================================

/**
 * @deprecated 已迁移到 system_params.ESTIMATE_DEFAULT_SOURCE
 *   旧键 ESTIMATE_DATA_SOURCE（auto/sina/point）在启动迁移时已自动映射：
 *     auto/sina → sina_v1, point → sina_point
 *   此常量保留仅供旧代码 import 不报错，实际读取请用 getDefaultSource()
 */
export const ESTIMATE_SOURCE_KEY = 'ESTIMATE_DATA_SOURCE'

/** @deprecated 旧的三段式选项，新 UI 请走 /api/admin/estimate-sources 接口 */
export type EstimateSourceMode = 'auto' | 'sina' | 'point'

/** @deprecated 旧选项数组 */
export const ESTIMATE_SOURCE_OPTIONS: Array<{ value: EstimateSourceMode; label: string; desc: string }> = [
  { value: 'auto', label: '自动', desc: '已废弃，请使用数据源管理页面配置' },
  { value: 'sina', label: '分时曲线', desc: '已废弃，请使用数据源管理页面配置' },
  { value: 'point', label: '单点模式', desc: '已废弃，请使用数据源管理页面配置' }
]

/**
 * @deprecated 旧配置读取，现在总是返回 'auto'（等效于"使用新机制"）
 *   旧调用方（如定时任务）继续工作，但实际行为已改为走 registry 多源降级链。
 */
export function getEstimateSource(): EstimateSourceMode {
  return 'auto'
}

// ============================================================================
// 类型 re-export（保持原有导入路径可用）
// ============================================================================

export type { FundEstimateTimeseries, FundEstimatePointData }
export type { FundEstimatePoint } from './sina.js'

// ============================================================================
// 统一分发 API（走 registry 降级链）
// ============================================================================

/**
 * 获取基金分时估值曲线
 *
 * 按优先级解析适配器链（override → 基金级 → 全局默认 + 降级链），
 * 遍历 timeseries 类适配器，返回第一个成功的结果。
 *
 * @param code 基金代码
 * @param override 显式指定适配器 ID（如对比工具、健康检查）
 */
export async function fetchEstimateTimeseries(
  code: string,
  override?: string
): Promise<FundEstimateTimeseries | null> {
  const { result } = await fetchTimeseriesWithFallback(code, override)
  return result
}

/**
 * 获取基金单点估值（走完整降级链）
 *
 * 替代旧版从 sina.ts 直接 re-export 的 fetchFundEstimatePoint。
 * 现在会按适配器链顺序尝试所有已启用数据源，第一个成功即返回。
 *
 * @param code 基金代码
 * @param override 显式指定适配器 ID
 */
export async function fetchFundEstimatePoint(
  code: string,
  override?: string
): Promise<FundEstimatePointData | null> {
  const { result } = await fetchPointWithFallback(code, override)
  return result
}

/**
 * 解析指定基金命中的数据源链（供 UI 展示"当前使用的数据源"）
 */
export function resolveEstimateSource(code: string, override?: string) {
  const result = resolveAdapterChain(code, override)
  return {
    primaryId: result.chain[0]?.id ?? getDefaultSource(),
    resolvedFrom: result.resolvedFrom,
    chain: result.chain.map(a => a.id),
    fallbackChain: getFallbackChain()
  }
}
