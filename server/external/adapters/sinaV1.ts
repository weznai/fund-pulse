/**
 * 新浪分时估值适配器（第一口径）
 *
 * 包装 sina.ts 的 fetchFundEstimateTimeseries，使用 pre_nav / nav_pct 字段。
 * 这是项目长期使用的默认口径，对绝大多数 A 股基金有效。
 */

import {
  fetchFundEstimateTimeseries,
  fetchFundEstimatePoint,
  type FundEstimatePointData
} from '../sina.js'
import type { EstimateAdapter, HealthCheckResult } from './types.js'

/** 健康检查用的测试基金代码（易方达蓝筹精选，长期存续、流动性高） */
export const HEALTH_CHECK_CODE = '110022'

export const sinaV1Adapter: EstimateAdapter = {
  id: 'sina_v1',
  name: '新浪分时（一口径）',
  category: 'timeseries',
  description: '新浪 FdFundService 分时曲线，pre_nav/nav_pct 口径，A 股基金默认源',
  builtin: true,
  enabled: true,

  async fetchTimeseries(code: string) {
    return fetchFundEstimateTimeseries(code)
  },

  async fetchPoint(code: string): Promise<FundEstimatePointData | null> {
    const ts = await fetchFundEstimateTimeseries(code)
    if (ts && ts.gsz > 0) {
      return {
        nav: ts.nav,
        gsz: ts.gsz,
        gszzl: ts.gszzl,
        gztime: ts.gztime
      }
    }
    // 分时失败时降级到 fu_ 单点（与原 estimateSource.auto 行为一致）
    return fetchFundEstimatePoint(code)
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now()
    try {
      const ts = await fetchFundEstimateTimeseries(HEALTH_CHECK_CODE)
      const latency = Date.now() - start
      if (ts && ts.timeseries.length > 0) {
        return { ok: true, latency, checkedAt: start }
      }
      return { ok: false, latency, message: '返回数据为空', checkedAt: start }
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
