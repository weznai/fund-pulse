/**
 * 新浪基金估值数据源（统一封装）
 *
 * 自 2026 年起，东方财富（天天基金）全面下线了基金盘中估值接口：
 *   - fundgz.1234567.com.cn/js/{code}.js     （JSONP 单点估值）
 *   - fund.eastmoney.com/tfsj_v1.0.0/fsdata_{code}.js（分时 JS）
 *   - fundf10.eastmoney.com/trend_{code}.js  （分时 JS）
 *   - fundmobapi FundMNFInfo 的 GSZ/GSZZL/GZTIME 字段
 * 以及基金详情页的 isHaveGz 开关。本项目改为统一使用新浪财经的两个接口：
 *
 *   1. FdFundService.getEstimateNetworthPic —— 分钟级分时估值曲线（主）
 *      返回当日完整的分钟级估值序列（约 90+ 个点），单次请求即可拿到全部分时。
 *
 *   2. hq.sinajs.cn/list=fu_{code} —— 单点实时估值（降级 / 轻量场景）
 *      GBK 编码，只返回当前最新一个估值点，用于基金列表等不需要分时曲线的场景。
 *
 * 两个接口均返回两种口径的估值（pre_nav/pre_nav2），本项目统一采用第一种口径
 * （pre_nav / nav_pct），与历史数据源保持一致。
 */

import axios from 'axios'
import iconv from 'iconv-lite'
import { logger } from '../logger.js'

/** 标准分时点：时间、估算净值、涨跌幅% */
export interface FundEstimatePoint {
  time: string
  value: number
  percent: number
}

/** 分钟级分时估值结果 */
export interface FundEstimateTimeseries {
  /** 分钟级分时序列（按时间升序） */
  timeseries: FundEstimatePoint[]
  /** 基准净值（昨日单位净值，由最新点反推） */
  nav: number
  /** 最新估算净值 */
  gsz: number
  /** 最新估算涨跌幅% */
  gszzl: number
  /** 估值时间 "YYYY-MM-DD HH:mm" */
  gztime: string
  /** 估值日期 "YYYY-MM-DD" */
  date: string
}

/** 单点估值结果 */
export interface FundEstimatePointData {
  /** 昨日单位净值 */
  nav: number
  /** 估算净值 */
  gsz: number
  /** 估算涨跌幅% */
  gszzl: number
  /** 估值时间 "YYYY-MM-DD HH:mm:ss" */
  gztime: string
  /** 基金名称（仅部分数据源能提供，如天天基金 FundValuationLast 的 SHORTNAME） */
  name?: string
}

const FUND_TIMESERIES_URL = 'https://stock.finance.sina.com.cn/fundInfo/api/openapi.php/FdFundService.getEstimateNetworthPic'
const FUND_POINT_URL = 'https://hq.sinajs.cn/list='

const COMMON_HEADERS = {
  'Referer': 'https://finance.sina.com.cn/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

/**
 * 新浪 FdFundService 返回的两种估值口径字段名映射
 *
 * 新浪接口对同一净值序列提供两套口径：
 *   - 第一口径（V1）：pre_nav / nav_pct（百分比字符串，如 "3.4170" 表示 3.417%）
 *   - 第二口径（V2）：pre_nav2 / nav2_pct（注意字段名是 nav2_pct 不是 nav_pct2）
 *
 * 另有 growthrate / growthrate2 字段，是小数比例（如 0.03417 表示 3.417%），
 * 作为 nav_pct / nav2_pct 缺失时的 fallback，需要乘以 100 转百分比。
 *
 * 不同基金/时期最准的口径不同，因此 V2 也作为独立数据源暴露。
 */
export type SinaVariant = 'v1' | 'v2'

interface VariantFields {
  navKey: string
  pctKey: string
  /** 涨幅字段的缩放倍数：nav_pct/nav2_pct 类 = 1，growthrate 类 = 100 */
  scale: number
}

const VARIANT_FIELD_MAP: Record<SinaVariant, VariantFields[]> = {
  v1: [
    { navKey: 'pre_nav', pctKey: 'nav_pct', scale: 1 },
    { navKey: 'pre_nav', pctKey: 'growthrate', scale: 100 }
  ],
  v2: [
    { navKey: 'pre_nav2', pctKey: 'nav2_pct', scale: 1 },
    { navKey: 'pre_nav2', pctKey: 'growthrate2', scale: 100 }
  ]
}

function pickVariantValue(item: any, variant: SinaVariant): { nav: number; pct: number } | null {
  for (const fields of VARIANT_FIELD_MAP[variant]) {
    const nav = Number(item[fields.navKey])
    const rawPct = Number(item[fields.pctKey])
    if (!isNaN(nav) && !isNaN(rawPct)) {
      return { nav, pct: rawPct * fields.scale }
    }
  }
  return null
}

/**
 * 通用分时曲线解析：按指定口径版本解析 networth 数组
 *
 * 抽出原 fetchFundEstimateTimeseries 的解析逻辑并参数化，
 * V1/V2 共用同一段代码，避免重复。
 */
function parseTimeseriesByVariant(networth: any[], variant: SinaVariant): {
  timeseries: FundEstimatePoint[]
  lastNav: number
  lastPct: number
  lastDate: string
  lastMinTime: string
} | null {
  const timeseries: FundEstimatePoint[] = []
  let lastNav = NaN
  let lastPct = NaN
  let lastDate = ''
  let lastMinTime = ''

  for (const item of networth) {
    const minTime: string = item.min_time || ''
    if (minTime.length < 5) continue
    const picked = pickVariantValue(item, variant)
    if (!picked) continue
    timeseries.push({
      time: minTime.substring(0, 5),
      value: round4(picked.nav),
      percent: round2(picked.pct)
    })
    lastNav = picked.nav
    lastPct = picked.pct
    lastDate = item.pre_date || lastDate
    lastMinTime = minTime
  }

  if (timeseries.length === 0 || isNaN(lastNav) || isNaN(lastPct)) return null
  return { timeseries, lastNav, lastPct, lastDate, lastMinTime }
}

async function fetchTimeseriesByVariant(code: string, variant: SinaVariant): Promise<FundEstimateTimeseries | null> {
  try {
    const response = await axios.get(FUND_TIMESERIES_URL, {
      params: { symbol: code },
      headers: COMMON_HEADERS,
      timeout: 8000
    })

    const networth = response.data?.result?.data?.networth
    if (!Array.isArray(networth) || networth.length === 0) {
      return null
    }

    const parsed = parseTimeseriesByVariant(networth, variant)
    if (!parsed) return null

    const { timeseries, lastNav, lastPct, lastDate, lastMinTime } = parsed
    const minTime = lastMinTime.substring(0, 5)
    const gztime = lastDate ? `${lastDate} ${minTime}`.trim() : minTime
    // 由最新估算净值和涨幅反推基准（昨日）净值：nav = gsz / (1 + gszzl/100)
    const nav = lastNav > 0 && lastPct ? lastNav / (1 + lastPct / 100) : lastNav

    return {
      timeseries,
      nav: round4(nav),
      gsz: round4(lastNav),
      gszzl: round2(lastPct),
      gztime,
      date: lastDate
    }
  } catch (error) {
    logger.error(`[新浪分时${variant.toUpperCase()}] ${code} 获取失败:`, error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * 获取基金分钟级分时估值曲线（主数据源，第一口径）
 *
 * 调用新浪 FdFundService.getEstimateNetworthPic，返回当日完整的分钟级估值序列。
 * 适用于基金详情页分时图、定时采集入库等需要完整曲线的场景。
 */
export async function fetchFundEstimateTimeseries(code: string): Promise<FundEstimateTimeseries | null> {
  return fetchTimeseriesByVariant(code, 'v1')
}

/**
 * 获取基金分钟级分时估值曲线（第二口径）
 *
 * 与 fetchFundEstimateTimeseries 同一接口，但解析 pre_nav2/nav_pct2 字段。
 * 部分基金第二口径更接近实际涨跌幅，作为独立数据源暴露供选择。
 */
export async function fetchFundEstimateTimeseriesV2(code: string): Promise<FundEstimateTimeseries | null> {
  return fetchTimeseriesByVariant(code, 'v2')
}

/**
 * 获取基金单点实时估值（降级 / 轻量场景）
 *
 * 调用新浪 hq.sinajs.cn/list=fu_{code}（GBK 编码），只返回当前最新的一个估值点。
 * 适用于基金列表等不需要分时曲线、只需展示当前估算涨跌幅的场景。
 *
 * fu_ 响应字段（逗号分隔）：
 *   [0]名称 [1]时间 [2]估算净值gsz [3]昨日净值nav [4]nav [5]变动值 [6]涨幅% [7]日期 [8]gsz2 [9]gszzl2
 */
export async function fetchFundEstimatePoint(code: string): Promise<FundEstimatePointData | null> {
  try {
    const response = await axios.get(`${FUND_POINT_URL}fu_${code}`, {
      headers: COMMON_HEADERS,
      responseType: 'arraybuffer',
      timeout: 8000
    })

    const decoded = iconv.decode(Buffer.from(response.data), 'gbk')
    const match = decoded.match(new RegExp(`fu_${code}="([^"]+)"`))
    if (!match || !match[1]) return null

    const parts = match[1].split(',')
    if (parts.length < 8) return null

    const gsz = parseFloat(parts[2])
    const nav = parseFloat(parts[3])
    const gszzl = parseFloat(parts[6])
    const date = parts[7] || ''
    const time = parts[1] || ''

    if (!gsz || gsz <= 0 || !nav || nav <= 0) return null

    return {
      nav,
      gsz,
      gszzl: isNaN(gszzl) ? 0 : gszzl,
      gztime: date && time ? `${date} ${time}` : date
    }
  } catch (error) {
    logger.error(`[新浪估值] ${code} 获取失败:`, error instanceof Error ? error.message : error)
    return null
  }
}
