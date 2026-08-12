/**
 * 估值数据源管理路由（后台）
 *
 * 独立工厂模式（参考 holidays 路由），挂载在 /api/admin/estimate-sources。
 * 提供数据源列表、状态、健康检查、全局配置、基金级配置、实时对比工具。
 *
 * 路由总览：
 *   GET    /                              数据源列表（含健康状态）
 *   GET    /config                        全局配置（默认源 + 降级链）
 *   PUT    /default                       设置全局默认源 { id }
 *   PUT    /fallback-chain                设置降级链 { chain }
 *   PUT    /:id/enabled                   切换启用状态 { enabled }
 *   POST   /:id/health-check              单个健康检查
 *   POST   /health-check-all              全部健康检查
 *   GET    /fund/:code                    查询基金命中数据源
 *   PUT    /fund/:code                    设置基金级数据源 { source | null }
 *   POST   /compare                       实时对比工具 { code }
 */

import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { logger } from '../logger.js'
import { getFundInfo, updateFundInfoField } from '../db.js'
import {
  listAdapters,
  getAdapterStatuses,
  getAdapter,
  getDefaultSource,
  setDefaultSource,
  getFallbackChain,
  setFallbackChain,
  isAdapterEnabled,
  setAdapterEnabled,
  runHealthCheck,
  runAllHealthChecks,
  resolveAdapterChain
} from '../external/adapters/registry.js'

export function setupEstimateSourceRoutes(validateAdminToken: (req: Request, res: Response, next: NextFunction) => void) {
  const router = Router()

  // ---- 数据源列表与状态 ----

  router.get('/', validateAdminToken, (_req, res) => {
    try {
      res.json(getAdapterStatuses())
    } catch (error) {
      logger.error('[EstimateSource] 获取列表失败:', error)
      res.status(500).json({ error: '获取数据源列表失败' })
    }
  })

  router.get('/config', validateAdminToken, (_req, res) => {
    try {
      res.json({
        defaultSource: getDefaultSource(),
        fallbackChain: getFallbackChain(),
        adapters: listAdapters().map(a => ({
          id: a.id,
          name: a.name,
          category: a.category,
          description: a.description,
          enabled: isAdapterEnabled(a.id)
        }))
      })
    } catch (error) {
      logger.error('[EstimateSource] 获取配置失败:', error)
      res.status(500).json({ error: '获取配置失败' })
    }
  })

  // ---- 全局配置 ----

  router.put('/default', validateAdminToken, (req, res) => {
    try {
      const { id } = req.body || {}
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: '缺少 id 参数' })
      }
      if (!setDefaultSource(id)) {
        return res.status(400).json({ error: `无效的数据源 ID: ${id}` })
      }
      res.json({ success: true, defaultSource: id })
    } catch (error) {
      logger.error('[EstimateSource] 设置默认源失败:', error)
      res.status(500).json({ error: '设置默认源失败' })
    }
  })

  router.put('/fallback-chain', validateAdminToken, (req, res) => {
    try {
      const { chain } = req.body || {}
      if (!Array.isArray(chain) || chain.length === 0) {
        return res.status(400).json({ error: 'chain 必须是非空字符串数组' })
      }
      if (!setFallbackChain(chain)) {
        return res.status(400).json({ error: '降级链中没有有效的数据源 ID' })
      }
      res.json({ success: true, fallbackChain: getFallbackChain() })
    } catch (error) {
      logger.error('[EstimateSource] 设置降级链失败:', error)
      res.status(500).json({ error: '设置降级链失败' })
    }
  })

  router.put('/:id/enabled', validateAdminToken, (req, res) => {
    try {
      const { id } = req.params
      const { enabled } = req.body || {}
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'enabled 必须是布尔值' })
      }
      if (!setAdapterEnabled(id, enabled)) {
        return res.status(404).json({ error: `数据源不存在: ${id}` })
      }
      res.json({ success: true, id, enabled })
    } catch (error) {
      logger.error('[EstimateSource] 切换启用状态失败:', error)
      res.status(500).json({ error: '切换启用状态失败' })
    }
  })

  // ---- 健康检查 ----

  router.post('/:id/health-check', validateAdminToken, async (req, res) => {
    try {
      const { id } = req.params
      const adapter = getAdapter(id)
      if (!adapter) {
        return res.status(404).json({ error: `数据源不存在: ${id}` })
      }
      const result = await runHealthCheck(id, true)
      res.json({ id, health: result })
    } catch (error) {
      logger.error('[EstimateSource] 健康检查失败:', error)
      res.status(500).json({ error: '健康检查失败' })
    }
  })

  router.post('/health-check-all', validateAdminToken, async (_req, res) => {
    try {
      const results = await runAllHealthChecks(true)
      res.json(results)
    } catch (error) {
      logger.error('[EstimateSource] 批量健康检查失败:', error)
      res.status(500).json({ error: '批量健康检查失败' })
    }
  })

  // ---- 基金级配置 ----

  router.get('/fund/:code', validateAdminToken, (req, res) => {
    try {
      const { code } = req.params
      const fund = getFundInfo(code)
      if (!fund) {
        return res.status(404).json({ error: `基金不存在: ${code}` })
      }
      const resolution = resolveAdapterChain(code)
      res.json({
        code,
        name: fund.name,
        fundLevelSource: fund.estimate_source ?? null,
        primaryId: resolution.chain[0]?.id ?? getDefaultSource(),
        resolvedFrom: resolution.resolvedFrom,
        chain: resolution.chain.map(a => a.id)
      })
    } catch (error) {
      logger.error('[EstimateSource] 查询基金数据源失败:', error)
      res.status(500).json({ error: '查询基金数据源失败' })
    }
  })

  router.put('/fund/:code', validateAdminToken, (req, res) => {
    try {
      const { code } = req.params
      const { source } = req.body || {}
      // source 为 null 表示清除基金级配置（跟随全局）
      if (source !== null && typeof source !== 'string') {
        return res.status(400).json({ error: 'source 必须是字符串或 null' })
      }
      if (source !== null && !getAdapter(source)) {
        return res.status(400).json({ error: `无效的数据源 ID: ${source}` })
      }
      const fund = getFundInfo(code)
      if (!fund) {
        return res.status(404).json({ error: `基金不存在: ${code}` })
      }
      updateFundInfoField(code, { estimate_source: source })
      logger.log(`[EstimateSource] 基金 ${code} 数据源设置为 ${source ?? '跟随全局'}`)
      res.json({ success: true, code, fundLevelSource: source })
    } catch (error) {
      logger.error('[EstimateSource] 设置基金数据源失败:', error)
      res.status(500).json({ error: '设置基金数据源失败' })
    }
  })

  // ---- 实时对比工具 ----

  router.post('/compare', validateAdminToken, async (req, res) => {
    try {
      const { code } = req.body || {}
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: '缺少 code 参数' })
      }
      const adapters = listAdapters()
      const results = await Promise.all(
        adapters.map(async (adapter) => {
          const start = Date.now()
          try {
            const point = await adapter.fetchPoint(code)
            return {
              adapterId: adapter.id,
              adapterName: adapter.name,
              category: adapter.category,
              enabled: isAdapterEnabled(adapter.id),
              latency: Date.now() - start,
              point: point && point.gsz > 0 ? {
                nav: point.nav,
                gsz: point.gsz,
                gszzl: point.gszzl,
                gztime: point.gztime,
                name: point.name
              } : null,
              error: null as string | null
            }
          } catch (e) {
            return {
              adapterId: adapter.id,
              adapterName: adapter.name,
              category: adapter.category,
              enabled: isAdapterEnabled(adapter.id),
              latency: Date.now() - start,
              point: null,
              error: e instanceof Error ? e.message : String(e)
            }
          }
        })
      )
      // 基金名称解析：优先 fund_info 表，其次从各数据源返回的 name 字段提取
      const fund = getFundInfo(code)
      const fundName = fund?.name
        || results.find(r => r.point?.name)?.point?.name
        || ''
      res.json({ code, name: fundName, results })
    } catch (error) {
      logger.error('[EstimateSource] 对比工具失败:', error)
      res.status(500).json({ error: '对比工具执行失败' })
    }
  })

  return router
}
