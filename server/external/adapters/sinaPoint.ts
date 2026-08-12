/**
 * 新波单点估值适配器（fu_）
 *
 * 调用 hq.sinajs.cn/list=fu_{code}，GBK 编码，只返回当前最新一个估值点。
 * 无分时曲线，仅适合基金列表等只需当前估值的场景，或作为分时源的降级。
 */

import { fetchFundEstimatePoint } from '../sina.js'
import type { EstimateAdapter, HealthCheckResult } from './types.js'
import { HEALTH_CHECK_CODE } from './sinaV1.js'

export const sinaPointAdapter: EstimateAdapter = {
  id: 'sina_point',
  name: '新波单点（fu_）',
  category: 'point',
  description: 'hq.sinajs.cn/list=fu_ 单点估值，轻量快速，无分时曲线，适合降级',
  builtin: true,
  enabled: true,

  // 单点适配器不提供分时曲线
  fetchTimeseries: undefined,

  async fetchPoint(code: string) {
    return fetchFundEstimatePoint(code)
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now()
    try {
      const point = await fetchFundEstimatePoint(HEALTH_CHECK_CODE)
      const latency = Date.now() - start
      if (point && point.gsz > 0) {
        return { ok: true, latency, checkedAt: start }
      }
      return { ok: false, latency, message: '返回数据无效', checkedAt: start }
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
