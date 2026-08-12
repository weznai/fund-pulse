/**
 * 估值数据源注册表与协调层
 *
 * 职责：
 *   1. 集中注册所有内置适配器（sinaV1/sinaV2/sinaPoint/tiantian）
 *   2. 提供查询接口：listAdapters / getAdapter / getAdapterStatuses
 *   3. 解析逻辑：为指定基金按优先级解析适配器链
 *        override（显式指定） → fund_info.estimate_source（基金级） → 全局默认 → 降级链
 *   4. 健康检查：单个 / 全部，结果带 TTL 缓存
 *   5. 全局配置读写：默认源、降级链、启用状态（持久化到 system_params）
 *
 * 上层 estimateSource.ts 分发层通过本注册表统一访问所有数据源，
 * 新增数据源只需实现 EstimateAdapter 接口并在 ADAPTERS 中注册。
 */

import { getSystemParam, setSystemParam, getFundInfo } from '../../db.js'
import { logger } from '../../logger.js'
import type { FundEstimateTimeseries, FundEstimatePointData } from '../sina.js'
import type { EstimateAdapter, AdapterStatus, HealthCheckResult } from './types.js'
import { sinaV1Adapter } from './sinaV1.js'
import { sinaV2Adapter } from './sinaV2.js'
import { sinaPointAdapter } from './sinaPoint.js'
import { tiantianAdapter } from './tiantian.js'

// ============================================================================
// system_params 键定义
// ============================================================================

export const DEFAULT_SOURCE_KEY = 'ESTIMATE_DEFAULT_SOURCE'
export const FALLBACK_CHAIN_KEY = 'ESTIMATE_FALLBACK_CHAIN'
export const ADAPTER_ENABLED_KEY = 'ESTIMATE_ADAPTER_ENABLED'

/** 全局默认降级链（所有内置适配器按推荐顺序） */
export const DEFAULT_FALLBACK_CHAIN = ['tiantian', 'sina_v1', 'sina_v2', 'sina_point']

// ============================================================================
// 适配器注册
// ============================================================================

/** 所有内置适配器（按推荐优先级排序） */
const ADAPTERS: EstimateAdapter[] = [
  tiantianAdapter,
  sinaV1Adapter,
  sinaV2Adapter,
  sinaPointAdapter
]

const adapterMap = new Map<string, EstimateAdapter>(ADAPTERS.map(a => [a.id, a]))

// ============================================================================
// 健康检查缓存
// ============================================================================

const HEALTH_CACHE_TTL = 60 * 1000 // 60 秒
const healthCache = new Map<string, HealthCheckResult>()

// ============================================================================
// 启用状态（持久化到 system_params）
// ============================================================================

interface EnabledMap { [id: string]: boolean }

function loadEnabledMap(): EnabledMap {
  const raw = getSystemParam(ADAPTER_ENABLED_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as EnabledMap : {}
  } catch {
    return {}
  }
}

function saveEnabledMap(map: EnabledMap): void {
  setSystemParam(ADAPTER_ENABLED_KEY, JSON.stringify(map), '估值数据源启用状态')
}

/** 适配器是否启用（未配置时默认启用） */
export function isAdapterEnabled(id: string): boolean {
  const map = loadEnabledMap()
  if (id in map) return map[id]
  const adapter = adapterMap.get(id)
  return adapter ? adapter.enabled : false
}

/** 设置适配器启用状态并持久化 */
export function setAdapterEnabled(id: string, enabled: boolean): boolean {
  if (!adapterMap.has(id)) return false
  const map = loadEnabledMap()
  map[id] = enabled
  saveEnabledMap(map)
  logger.log(`[Registry] 适配器 ${id} ${enabled ? '已启用' : '已禁用'}`)
  return true
}

// ============================================================================
// 全局配置读写
// ============================================================================

/** 获取全局默认适配器 ID */
export function getDefaultSource(): string {
  const v = getSystemParam(DEFAULT_SOURCE_KEY)
  if (v && adapterMap.has(v) && isAdapterEnabled(v)) return v
  // 兜底：降级链第一个已启用的
  for (const id of getFallbackChain()) {
    if (adapterMap.has(id) && isAdapterEnabled(id)) return id
  }
  // 最终兜底：第一个已启用的内置适配器
  const first = ADAPTERS.find(a => isAdapterEnabled(a.id))
  return first ? first.id : 'sina_v1'
}

/** 设置全局默认适配器 ID */
export function setDefaultSource(id: string): boolean {
  if (!adapterMap.has(id)) return false
  setSystemParam(DEFAULT_SOURCE_KEY, id, '估值数据源默认源 ID')
  logger.log(`[Registry] 全局默认源设置为 ${id}`)
  return true
}

/** 获取降级链（JSON 数组） */
export function getFallbackChain(): string[] {
  const raw = getSystemParam(FALLBACK_CHAIN_KEY)
  if (!raw) return [...DEFAULT_FALLBACK_CHAIN]
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter(id => typeof id === 'string') : [...DEFAULT_FALLBACK_CHAIN]
  } catch {
    return [...DEFAULT_FALLBACK_CHAIN]
  }
}

/** 设置降级链 */
export function setFallbackChain(chain: string[]): boolean {
  // 过滤掉不存在的适配器 ID
  const valid = chain.filter(id => adapterMap.has(id))
  if (valid.length === 0) return false
  setSystemParam(FALLBACK_CHAIN_KEY, JSON.stringify(valid), '估值数据源降级链（JSON 数组）')
  logger.log(`[Registry] 降级链设置为 ${valid.join(' → ')}`)
  return true
}

// ============================================================================
// 查询接口
// ============================================================================

/** 列出所有适配器（不含运行时健康状态） */
export function listAdapters(): EstimateAdapter[] {
  return ADAPTERS.map(a => ({ ...a, enabled: isAdapterEnabled(a.id) }))
}

/** 列出所有已启用的适配器 */
export function listEnabledAdapters(): EstimateAdapter[] {
  return ADAPTERS.filter(a => isAdapterEnabled(a.id))
}

/** 获取单个适配器 */
export function getAdapter(id: string): EstimateAdapter | null {
  const a = adapterMap.get(id)
  return a ? { ...a, enabled: isAdapterEnabled(a.id) } : null
}

/** 列出所有适配器状态（含健康检查结果），供后台 UI 渲染 */
export function getAdapterStatuses(): AdapterStatus[] {
  return ADAPTERS.map(a => ({
    id: a.id,
    name: a.name,
    category: a.category,
    description: a.description,
    builtin: a.builtin,
    enabled: isAdapterEnabled(a.id),
    health: healthCache.get(a.id)
  }))
}

// ============================================================================
// 解析逻辑
// ============================================================================

export interface ResolveResult {
  /** 解析出的适配器链（按优先级，已过滤未启用） */
  chain: EstimateAdapter[]
  /** 实际命中的源 ID（用于日志/UI 展示） */
  resolvedFrom: 'override' | 'fund' | 'global' | 'fallback'
}

/**
 * 为指定基金解析适配器链
 *
 * 优先级：
 *   1. override（显式指定，最高优先级，不经过启用过滤——用于对比工具）
 *   2. fund_info.estimate_source（基金级配置）
 *   3. 全局默认 getDefaultSource()
 *
 * 解析出的主源会放在链首，其余按降级链顺序追加。
 * 主源之外的降级链条目用于主源失败时按序降级。
 */
export function resolveAdapterChain(code: string, override?: string): ResolveResult {
  const fallbackIds = getFallbackChain()

  // 1. 确定主源 ID
  let primaryId: string
  let resolvedFrom: ResolveResult['resolvedFrom']

  if (override && adapterMap.has(override)) {
    primaryId = override
    resolvedFrom = 'override'
  } else {
    const fundSource = getFundInfo(code)?.estimate_source
    if (fundSource && adapterMap.has(fundSource) && isAdapterEnabled(fundSource)) {
      primaryId = fundSource
      resolvedFrom = 'fund'
    } else {
      primaryId = getDefaultSource()
      resolvedFrom = 'global'
    }
  }

  // 2. 构造降级链：主源在前，降级链其余项去重追加
  const orderedIds: string[] = [primaryId]
  for (const id of fallbackIds) {
    if (!orderedIds.includes(id)) orderedIds.push(id)
  }

  // 3. 转为适配器对象，过滤未启用（override 模式不过滤）
  const chain: EstimateAdapter[] = []
  for (const id of orderedIds) {
    const adapter = adapterMap.get(id)
    if (!adapter) continue
    if (resolvedFrom !== 'override' && !isAdapterEnabled(id)) continue
    chain.push({ ...adapter, enabled: isAdapterEnabled(id) })
  }

  // 兜底：如果链空了（所有适配器都被禁用），强制返回 sina_v1
  if (chain.length === 0) {
    const fallback = adapterMap.get('sina_v1')
    if (fallback) chain.push({ ...fallback, enabled: true })
  }

  return { chain, resolvedFrom }
}

/**
 * 按降级链获取分时曲线
 *
 * 遍历解析出的适配器链，返回第一个成功且有分时能力的适配器结果。
 * 单点类适配器（无 fetchTimeseries）自动跳过。
 */
export async function fetchTimeseriesWithFallback(
  code: string,
  override?: string
): Promise<{ result: FundEstimateTimeseries | null; sourceId: string | null }> {
  const { chain } = resolveAdapterChain(code, override)
  for (const adapter of chain) {
    if (!adapter.fetchTimeseries) continue
    try {
      const result = await adapter.fetchTimeseries(code)
      if (result && result.timeseries.length > 0) {
        return { result, sourceId: adapter.id }
      }
    } catch (e) {
      logger.error(`[Registry] ${adapter.id} 分时获取失败 ${code}:`, e instanceof Error ? e.message : e)
    }
  }
  return { result: null, sourceId: null }
}

/**
 * 按降级链获取单点估值
 *
 * 遍历解析出的适配器链，返回第一个有效结果。
 */
export async function fetchPointWithFallback(
  code: string,
  override?: string
): Promise<{ result: FundEstimatePointData | null; sourceId: string | null }> {
  const { chain } = resolveAdapterChain(code, override)
  for (const adapter of chain) {
    try {
      const result = await adapter.fetchPoint(code)
      if (result && result.gsz > 0) {
        return { result, sourceId: adapter.id }
      }
    } catch (e) {
      logger.error(`[Registry] ${adapter.id} 单点获取失败 ${code}:`, e instanceof Error ? e.message : e)
    }
  }
  return { result: null, sourceId: null }
}

// ============================================================================
// 健康检查
// ============================================================================

/** 单个适配器健康检查（带 60s 缓存） */
export async function runHealthCheck(id: string, force = false): Promise<HealthCheckResult | null> {
  const adapter = adapterMap.get(id)
  if (!adapter) return null

  if (!force) {
    const cached = healthCache.get(id)
    if (cached && Date.now() - cached.checkedAt < HEALTH_CACHE_TTL) {
      return cached
    }
  }

  const result = await adapter.healthCheck()
  healthCache.set(id, result)
  return result
}

/** 全部适配器健康检查（并行） */
export async function runAllHealthChecks(force = false): Promise<Record<string, HealthCheckResult>> {
  const entries = await Promise.all(
    ADAPTERS.map(async a => [a.id, await runHealthCheck(a.id, force)] as const)
  )
  return Object.fromEntries(entries)
}

/** 清空健康检查缓存（调试用） */
export function clearHealthCache(): void {
  healthCache.clear()
}
