/**
 * 基金信息数据访问层
 * 
 * 使用 SafeQueryBuilder 确保 SQL 安全
 */

import db from './connection.js'
import { logger } from '../logger.js'
import {
  SafeQueryBuilder,
  validatePagination,
  validateNumber
} from '../utils/sqlSecurity.js'

export interface FundInfo {
  code: string
  name: string
  pinyin?: string
  ftype?: string
  fund_company?: string
  fund_manager?: string
  establish_date?: string
  fund_scale?: number
  benchmark?: string
  status: string
  is_recommend: number
  created_at: number
  updated_at: number
}

export interface FundInfoListResult {
  list: FundInfo[]
  total: number
  recommendCount: number
  page: number
  pageSize: number
}

export function getFundInfo(code: string): FundInfo | null {
  const stmt = db.prepare('SELECT * FROM fund_info WHERE code = ?')
  const result = stmt.get(code) as any
  if (result) {
    return {
      code: result.code,
      name: result.name,
      pinyin: result.pinyin || undefined,
      ftype: result.ftype || undefined,
      fund_company: result.fund_company || undefined,
      fund_manager: result.fund_manager || undefined,
      establish_date: result.establish_date || undefined,
      fund_scale: result.fund_scale || undefined,
      benchmark: result.benchmark || undefined,
      status: result.status || 'active',
      is_recommend: result.is_recommend || 0,
      created_at: result.created_at,
      updated_at: result.updated_at
    }
  }
  return null
}

export function getFundInfoList(options: {
  keyword?: string
  ftype?: string
  isRecommend?: number
  page?: number
  pageSize?: number
} = {}): FundInfoListResult {
  // 验证分页参数
  const { page, pageSize, offset } = validatePagination(options.page, options.pageSize)

  // 使用 SafeQueryBuilder 构建查询
  const builder = new SafeQueryBuilder('fund_info')

  // 添加搜索条件
  if (options.keyword) {
    builder.whereLikeGroup(['code', 'name', 'pinyin'], options.keyword)
  }

  if (options.ftype) {
    builder.where('ftype', '=', options.ftype)
  }

  if (options.isRecommend !== undefined) {
    const recommendValue = validateNumber(options.isRecommend, 0, 1)
    builder.where('is_recommend', '=', recommendValue)
  }

  builder.orderBy('is_recommend', 'DESC')
  builder.addOrderBy('updated_at', 'DESC')
  builder.limit(pageSize)
  builder.offset(offset)

  // 执行计数查询
  const countQuery = builder.buildCount()
  const countResult = db.prepare(countQuery.sql).get(...countQuery.params) as { count: number }
  const total = countResult.count

  // 查询推荐基金数量
  const recommendResult = db.prepare(
    'SELECT COUNT(*) as count FROM fund_info WHERE is_recommend = 1'
  ).get() as { count: number }
  const recommendCount = recommendResult.count

  // 执行数据查询
  const dataQuery = builder.buildSelect(['*'])
  const list = db.prepare(dataQuery.sql).all(...dataQuery.params) as any[]

  return {
    list: list.map(r => ({
      code: r.code,
      name: r.name,
      pinyin: r.pinyin || undefined,
      ftype: r.ftype || undefined,
      fund_company: r.fund_company || undefined,
      fund_manager: r.fund_manager || undefined,
      establish_date: r.establish_date || undefined,
      fund_scale: r.fund_scale || undefined,
      benchmark: r.benchmark || undefined,
      status: r.status || 'active',
      is_recommend: r.is_recommend || 0,
      created_at: r.created_at,
      updated_at: r.updated_at
    })),
    total,
    recommendCount,
    page,
    pageSize
  }
}

export function saveFundInfo(
  fund: Partial<FundInfo> & { code: string; name: string },
  forceUpdate = false
): boolean {
  const now = Date.now()
  const existing = getFundInfo(fund.code)

  if (existing) {
    const stmt = db.prepare(`
      UPDATE fund_info SET 
        name = ?, pinyin = ?, ftype = ?, fund_company = ?, fund_manager = ?,
        establish_date = ?, fund_scale = ?, benchmark = ?, status = ?, is_recommend = ?, updated_at = ?
      WHERE code = ?
    `)

    const ftype = fund.ftype !== undefined ? fund.ftype : (forceUpdate ? null : existing.ftype)
    const fund_company = fund.fund_company !== undefined ? fund.fund_company : (forceUpdate ? null : existing.fund_company)
    const fund_manager = fund.fund_manager !== undefined ? fund.fund_manager : (forceUpdate ? null : existing.fund_manager)
    const establish_date = fund.establish_date !== undefined ? fund.establish_date : (forceUpdate ? null : existing.establish_date)
    const fund_scale = fund.fund_scale !== undefined ? fund.fund_scale : (forceUpdate ? null : existing.fund_scale)
    const benchmark = fund.benchmark !== undefined ? fund.benchmark : (forceUpdate ? null : existing.benchmark)

    logger.log(`saveFundInfo ${fund.code}: ftype=${ftype}, company=${fund_company}, manager=${fund_manager}`)

    const result = stmt.run(
      fund.name || existing.name,
      fund.pinyin !== undefined ? fund.pinyin : existing.pinyin,
      ftype,
      fund_company,
      fund_manager,
      establish_date,
      fund_scale,
      benchmark,
      fund.status || existing.status,
      fund.is_recommend !== undefined ? fund.is_recommend : existing.is_recommend,
      now,
      fund.code
    )
    logger.log(`saveFundInfo ${fund.code} 更新结果: changes=${result.changes}`)
    return result.changes > 0
  } else {
    const stmt = db.prepare(`
      INSERT INTO fund_info (
        code, name, pinyin, ftype, fund_company, fund_manager,
        establish_date, fund_scale, benchmark, status, is_recommend, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      fund.code,
      fund.name,
      fund.pinyin || null,
      fund.ftype || null,
      fund.fund_company || null,
      fund.fund_manager || null,
      fund.establish_date || null,
      fund.fund_scale || null,
      fund.benchmark || null,
      fund.status || 'active',
      fund.is_recommend || 0,
      now,
      now
    )
    return true
  }
}

export function updateFundInfoRecommend(code: string, isRecommend: number): boolean {
  // 验证输入
  const validRecommend = validateNumber(isRecommend, 0, 1)
  
  const now = Date.now()
  const stmt = db.prepare('UPDATE fund_info SET is_recommend = ?, updated_at = ? WHERE code = ?')
  const result = stmt.run(validRecommend, now, code)
  return result.changes > 0
}

export function getRecommendFundCodes(): string[] {
  const stmt = db.prepare('SELECT code FROM fund_info WHERE is_recommend = 1')
  const results = stmt.all() as { code: string }[]
  return results.map(r => r.code)
}

export function deleteFundInfo(code: string): boolean {
  const stmt = db.prepare('DELETE FROM fund_info WHERE code = ?')
  const result = stmt.run(code)
  return result.changes > 0
}

export function batchSaveFundInfo(
  funds: Array<Partial<FundInfo> & { code: string; name: string }>
): number {
  logger.log(`[batchSaveFundInfo] 开始批量保存 ${funds.length} 只基金`)

  const saveMany = db.transaction((items: typeof funds) => {
    let count = 0
    for (const fund of items) {
      logger.log(`[batchSaveFundInfo] 保存基金: ${fund.code} - ${fund.name}`)
      try {
        const result = saveFundInfo(fund)
        logger.log(`[batchSaveFundInfo] ${fund.code} 保存结果: ${result}`)
        if (result) {
          count++
        }
      } catch (err: any) {
        logger.error(`[batchSaveFundInfo] ${fund.code} 保存异常: ${err?.message}`)
      }
    }
    return count
  })

  const result = saveMany(funds)
  logger.log(`[batchSaveFundInfo] 批量保存完成，成功 ${result} 条`)
  return result
}

export function getAllFundInfoCodes(): string[] {
  const stmt = db.prepare('SELECT code, name FROM fund_info')
  const results = stmt.all() as { code: string; name: string }[]
  logger.log(`getAllFundInfoCodes: 查询到 ${results.length} 条记录`)
  results.forEach(r => logger.log(`  - ${r.code}: ${r.name}`))
  return results.map(r => r.code)
}
