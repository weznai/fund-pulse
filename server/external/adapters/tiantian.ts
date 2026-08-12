/**
 * 天天基金批量估值适配器（FundValuationLast）
 *
 * 调用 fundcomapi.tiantianfunds.com/mm/newCore/FundValuationLast，
 * 该接口自 2026 年起替代已下线的 fundgz.1234567.com.cn JSONP 单点估值。
 *
 * 返回字段：FCODE / SHORTNAME / GSZ / GSZZL / GZTIME / NAV / PDATE
 * 仅单点（无分时曲线），但对部分基金比新浪口径更准。
 *
 * 参考 real-time-fund 项目 app/api/fund.js 的实现。
 */

import axios from 'axios'
import { logger } from '../../logger.js'
import type { FundEstimatePointData } from '../sina.js'
import type { EstimateAdapter, HealthCheckResult } from './types.js'
import { HEALTH_CHECK_CODE } from './sinaV1.js'

const FUND_VALUATION_LAST_URL = 'https://fundcomapi.tiantianfunds.com/mm/newCore/FundValuationLast'
const FUND_VALUATION_LAST_FIELDS = 'FCODE,SHORTNAME,GSZZL,GZTIME,GSZ,NAV,PDATE'
const REQUEST_TIMEOUT = 8000

const COMMON_HEADERS = {
  'Referer': 'https://fund.eastmoney.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

interface TiantianValuationItem {
  FCODE?: string
  SHORTNAME?: string
  GSZ?: string | number | null
  GSZZL?: string | number | null
  GZTIME?: string | null
  NAV?: string | number | null
  PDATE?: string | null
}

function toNumber(v: unknown): number {
  if (v == null) return NaN
  const n = Number(v)
  return isNaN(n) ? NaN : n
}

/** 规范化 GZTIME："2026-07-27 09:30:00" → "2026-07-27 09:30"（去掉秒） */
function normalizeGztime(t: string | null | undefined): string {
  if (!t) return ''
  return String(t).replace(/:(\d{2}):\d{2}$/, ':$1')
}

/**
 * 单只基金查询（适配器接口要求）
 *
 * 底层接口支持批量（FCODES 逗号分隔），但单只查询时也直接调用，
 * 批量优化在采集层（scheduled/estimate.ts）的并发逻辑中自然完成。
 */
export async function fetchTiantianValuation(code: string): Promise<FundEstimatePointData | null> {
  try {
    const response = await axios.get(FUND_VALUATION_LAST_URL, {
      params: {
        FCODES: code,
        FIELDS: FUND_VALUATION_LAST_FIELDS
      },
      headers: COMMON_HEADERS,
      timeout: REQUEST_TIMEOUT
    })

    const data = response.data
    if (!data || data.success === false || !Array.isArray(data.data) || data.data.length === 0) {
      return null
    }

    const item: TiantianValuationItem = data.data[0]
    const gsz = toNumber(item.GSZ)
    const gszzl = toNumber(item.GSZZL)
    const nav = toNumber(item.NAV)
    const gztime = normalizeGztime(item.GZTIME)

    if (isNaN(gsz) || gsz <= 0) {
      logger.error(`[天天估值] ${code} GSZ 无效: ${JSON.stringify(item).substring(0, 200)}`)
      return null
    }

    // 由估算净值和涨幅反推基准净值：nav = gsz / (1 + gszzl/100)
    // 如果接口返回了 NAV 字段则优先用，否则反推
    const baseNav = !isNaN(nav) && nav > 0 ? nav : (gszzl ? gsz / (1 + gszzl / 100) : gsz)

    return {
      nav: Math.round(baseNav * 10000) / 10000,
      gsz: Math.round(gsz * 10000) / 10000,
      gszzl: isNaN(gszzl) ? 0 : Math.round(gszzl * 100) / 100,
      gztime,
      name: item.SHORTNAME || undefined
    }
  } catch (error) {
    logger.error(`[天天估值] ${code} 获取失败:`, error instanceof Error ? error.message : error)
    return null
  }
}

export const tiantianAdapter: EstimateAdapter = {
  id: 'tiantian',
  name: '天天基金估值',
  category: 'point',
  description: 'fundcomapi FundValuationLast 接口，对部分基金比新浪口径更准',
  builtin: true,
  enabled: true,

  // 单点适配器不提供分时曲线
  fetchTimeseries: undefined,

  async fetchPoint(code: string) {
    return fetchTiantianValuation(code)
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now()
    try {
      const point = await fetchTiantianValuation(HEALTH_CHECK_CODE)
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
