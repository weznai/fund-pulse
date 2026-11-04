/**
 * 资讯功能路由
 *
 * 双工厂模式（参考 estimateSource 路由）：
 *   setupPublicNewsRoutes —— 用户端，挂载 /api/news（仅已发布文章）
 *   setupAdminNewsRoutes  —— 管理端，挂载 /api/admin/news（需 validateAdminToken）
 *
 * 路由总览：
 *   用户端：
 *     GET  /                     资讯列表（不含正文，分页）
 *     GET  /:id                  资讯详情（含 content_html，浏览量 +1）
 *   管理端：
 *     GET    /                   资讯列表（全部状态，支持 keyword/status 筛选）
 *     GET    /stats              统计（总数/已发布/草稿）
 *     GET    /:id                详情
 *     POST   /                   新建 { title, summary, content_html, source, status, pinned }
 *     PUT    /:id                编辑
 *     PUT    /:id/status         发布/下架 { status }
 *     DELETE /:id                删除
 *     POST   /batch-delete       批量删除 { ids }（失败隔离，返回未命中列表）
 */

import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { logger } from '../logger.js'
import {
  getNewsList,
  getNewsById,
  incrementNewsViews,
  createNews,
  updateNews,
  setNewsStatus,
  deleteNewsById,
  deleteNewsBatch,
  getNewsStats
} from '../db/news.js'

function parsePage(req: Request): { page: number; pageSize: number } {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1)
  const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize || '10'), 10) || 10))
  return { page, pageSize }
}

function parseStatus(v: unknown): 'draft' | 'published' | undefined {
  return v === 'draft' || v === 'published' ? v : undefined
}

export function setupPublicNewsRoutes() {
  const router = Router()

  router.get('/', (req: Request, res: Response) => {
    try {
      const { page, pageSize } = parsePage(req)
      const { list, total } = getNewsList({
        page,
        pageSize,
        status: 'published',
        keyword: req.query.keyword ? String(req.query.keyword) : undefined
      })
      res.json({ list, total, page, pageSize })
    } catch (error) {
      logger.error('获取资讯列表失败:', error)
      res.status(500).json({ error: '获取资讯列表失败' })
    }
  })

  router.get('/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10)
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '无效的资讯ID' })
      const article = getNewsById(id, { publishedOnly: true })
      if (!article) return res.status(404).json({ error: '资讯不存在' })
      incrementNewsViews(id)
      res.json(article)
    } catch (error) {
      logger.error('获取资讯详情失败:', error)
      res.status(500).json({ error: '获取资讯详情失败' })
    }
  })

  return router
}

export function setupAdminNewsRoutes(validateAdminToken: (req: Request, res: Response, next: NextFunction) => void) {
  const router = Router()
  router.use(validateAdminToken)

  router.get('/', (req: Request, res: Response) => {
    try {
      const { page, pageSize } = parsePage(req)
      const { list, total } = getNewsList({
        page,
        pageSize,
        status: parseStatus(req.query.status),
        keyword: req.query.keyword ? String(req.query.keyword) : undefined
      })
      res.json({ list, total, page, pageSize })
    } catch (error) {
      logger.error('获取资讯管理列表失败:', error)
      res.status(500).json({ error: '获取资讯列表失败' })
    }
  })

  router.get('/stats', (_req: Request, res: Response) => {
    try {
      res.json(getNewsStats())
    } catch (error) {
      logger.error('获取资讯统计失败:', error)
      res.status(500).json({ error: '获取资讯统计失败' })
    }
  })

  router.get('/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10)
      const article = getNewsById(id)
      if (!article) return res.status(404).json({ error: '资讯不存在' })
      res.json(article)
    } catch (error) {
      logger.error('获取资讯详情失败:', error)
      res.status(500).json({ error: '获取资讯详情失败' })
    }
  })

  function validateArticleBody(body: any, requireContent: boolean): string | null {
    if (!body || typeof body !== 'object') return '请求体不能为空'
    if (!body.title || !String(body.title).trim()) return '标题不能为空'
    if (String(body.title).trim().length > 200) return '标题过长（最多200字）'
    if (requireContent && (!body.content_html || !String(body.content_html).trim())) return '正文内容不能为空'
    if (body.content_html && String(body.content_html).length > 2 * 1024 * 1024) return '正文过大（最大2MB）'
    return null
  }

  router.post('/', (req: Request, res: Response) => {
    try {
      const err = validateArticleBody(req.body, true)
      if (err) return res.status(400).json({ error: err })
      const id = createNews({
        title: String(req.body.title).trim(),
        summary: String(req.body.summary || '').trim(),
        content_html: String(req.body.content_html),
        source: String(req.body.source || '').trim(),
        status: parseStatus(req.body.status) || 'draft',
        pinned: !!req.body.pinned
      })
      res.json({ success: true, id })
    } catch (error) {
      logger.error('新建资讯失败:', error)
      res.status(500).json({ error: '新建资讯失败' })
    }
  })

  router.put('/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10)
      if (!Number.isInteger(id)) return res.status(400).json({ error: '无效的资讯ID' })
      const err = validateArticleBody(req.body, false)
      if (err) return res.status(400).json({ error: err })
      const updated = updateNews(id, {
        title: req.body.title !== undefined ? String(req.body.title).trim() : undefined,
        summary: req.body.summary !== undefined ? String(req.body.summary).trim() : undefined,
        content_html: req.body.content_html !== undefined ? String(req.body.content_html) : undefined,
        source: req.body.source !== undefined ? String(req.body.source).trim() : undefined,
        status: parseStatus(req.body.status),
        pinned: req.body.pinned !== undefined ? !!req.body.pinned : undefined
      })
      if (!updated) return res.status(404).json({ error: '资讯不存在' })
      res.json({ success: true, article: updated })
    } catch (error) {
      logger.error('编辑资讯失败:', error)
      res.status(500).json({ error: '编辑资讯失败' })
    }
  })

  router.put('/:id/status', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10)
      const status = parseStatus(req.body?.status)
      if (!status) return res.status(400).json({ error: 'status 必须为 draft 或 published' })
      const article = setNewsStatus(id, status)
      if (!article) return res.status(404).json({ error: '资讯不存在' })
      logger.log(`[资讯] ${status === 'published' ? '发布' : '下架'}: ${article.title} (#${id})`)
      res.json({ success: true, article })
    } catch (error) {
      logger.error('更新资讯状态失败:', error)
      res.status(500).json({ error: '更新资讯状态失败' })
    }
  })

  router.delete('/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10)
      const deleted = deleteNewsById(id)
      if (!deleted) return res.status(404).json({ error: '资讯不存在' })
      res.json({ success: true })
    } catch (error) {
      logger.error('删除资讯失败:', error)
      res.status(500).json({ error: '删除资讯失败' })
    }
  })

  router.post('/batch-delete', (req: Request, res: Response) => {
    try {
      const { ids } = req.body as { ids: unknown }
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: '缺少资讯ID列表' })
      if (ids.length > 500) return res.status(400).json({ error: '单次最多删除500条' })
      const validIds = ids.filter(n => Number.isInteger(n) && (n as number) > 0) as number[]
      if (validIds.length === 0) return res.status(400).json({ error: '无有效的资讯ID' })
      const { deleted, notFound } = deleteNewsBatch(validIds)
      res.json({ success: true, deleted, total: validIds.length, notFound })
    } catch (error) {
      logger.error('批量删除资讯失败:', error)
      res.status(500).json({ error: '批量删除资讯失败' })
    }
  })

  return router
}
