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
 * 获取基金分钟级分时估值曲线（主数据源）
 *
 * 调用新浪 FdFundService.getEstimateNetworthPic，返回当日完整的分钟级估值序列。
 * 适用于基金详情页分时图、定时采集入库等需要完整曲线的场景。
 */
export async function fetchFundEstimateTimeseries(code: string): Promise<FundEstimateTimeseries | null> {
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

    const timeseries: FundEstimatePoint[] = []
    for (const item of networth) {
      const minTime: string = item.min_time || ''
      const preNav = Number(item.pre_nav)
      const navPct = Number(item.nav_pct)
      if (minTime.length < 5 || isNaN(preNav) || isNaN(navPct)) continue
      // "09:30:00" -> "09:30"
      timeseries.push({
        time: minTime.substring(0, 5),
        value: round4(preNav),
        percent: round2(navPct)
      })
    }

    if (timeseries.length === 0) return null

    const last = networth[networth.length - 1]
    const gsz = Number(last.pre_nav)
    const gszzl = Number(last.nav_pct)
    const date: string = last.pre_date || ''
    const minTime: string = (last.min_time || '').substring(0, 5)
    const gztime = date ? `${date} ${minTime}`.trim() : minTime
    // 由最新估算净值和涨幅反推基准（昨日）净值：nav = gsz / (1 + gszzl/100)
    const nav = gsz > 0 && gszzl ? gsz / (1 + gszzl / 100) : gsz

    return {
      timeseries,
      nav: round4(nav),
      gsz: round4(gsz),
      gszzl: round2(gszzl),
      gztime,
      date
    }
  } catch (error) {
    logger.error(`[新浪分时] ${code} 获取失败:`, error instanceof Error ? error.message : error)
    return null
  }
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
