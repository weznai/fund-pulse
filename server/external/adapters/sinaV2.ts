/**
 * 新浪分时估值适配器（第二口径）
 *
 * 同一 FdFundService 接口，但解析 pre_nav2 / nav_pct2 字段。
 * 部分基金（如某些混合型、QDII）第二口径更接近实际涨跌幅。
 */

import {
  fetchFundEstimateTimeseriesV2,
  fetchFundEstimatePoint,
  type FundEstimatePointData,
  type FundEstimateTimeseries
} from '../sina.js'
import type { EstimateAdapter, HealthCheckResult } from './types.js'
import { HEALTH_CHECK_CODE } from './sinaV1.js'

export const sinaV2Adapter: EstimateAdapter = {
  id: 'sina_v2',
  name: '新浪分时（二口径）',
  category: 'timeseries',
  description: '新浪 FdFundService 分时曲线，pre_nav2/nav_pct2 口径，部分基金更准',
  builtin: true,
  enabled: true,

  async fetchTimeseries(code: string): Promise<FundEstimateTimeseries | null> {
    return fetchFundEstimateTimeseriesV2(code)
  },

  async fetchPoint(code: string): Promise<FundEstimatePointData | null> {
    const ts = await fetchFundEstimateTimeseriesV2(code)
    if (ts && ts.gsz > 0) {
      return {
        nav: ts.nav,
        gsz: ts.gsz,
        gszzl: ts.gszzl,
        gztime: ts.gztime
      }
    }
    // V2 分时失败时不降级到 fu_（fu_ 只提供第一口径，会破坏 V2 语义）
    // 返回 null 让 registry 走降级链
    return null
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now()
    try {
      const ts = await fetchFundEstimateTimeseriesV2(HEALTH_CHECK_CODE)
      const latency = Date.now() - start
      // V2 字段可能为空（部分基金无第二口径），只要有数据即视为接口可用
      if (ts) {
        return { ok: true, latency, checkedAt: start }
      }
      return { ok: false, latency, message: '返回数据为空（部分基金无第二口径属正常，可用其他基金复查）', checkedAt: start }
    } catch (e) {
      return {
        ok: false,
        latency: Date.now() - start,
        message: e instanceof Error ? e.message : String(e),
        checkedAt: start
      }
    }
  }
}
