/**
 * 管理端仪表盘聚合接口
 *
 * GET /api/admin/dashboard
 * 一次返回运营总览所需全部指标：
 *   user   用户总量/今日新增/7日活跃/类型分布/最新注册
 *   visit  今日 PV/UV（剔除爬虫）与近14天趋势
 *   news   文章数/总阅读/今日阅读/阅读TOP5
 *   ai     智能分析累计调用/使用人数/今日活跃分析用户
 *   fund   用户持仓基金总数/持仓用户数
 */

import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import db, { getLocalDate } from '../db/connection.js'
import { logger } from '../logger.js'

const BOT_FILTER = `(
  user_agent IS NULL
  OR (
    user_agent NOT LIKE '%bot%' AND user_agent NOT LIKE '%Bot%'
    AND user_agent NOT LIKE '%spider%' AND user_agent NOT LIKE '%Spider%'
    AND user_agent NOT LIKE '%slurp%' AND user_agent NOT LIKE '%crawler%'
  )
)`

function num(v: unknown): number {
  return typeof v === 'number' ? v : 0
}

function dayStartMs(offsetDays = 0): number {
  const d = new Date()
  d.setDate(d.getDate() - offsetDays)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function setupDashboardRoutes(validateAdminToken: (req: Request, res: Response, next: NextFunction) => void): Router {
  const router = Router()
  router.use(validateAdminToken)

  router.get('/', (_req: Request, res: Response) => {
    try {
      const today = getLocalDate()
      const todayStart = dayStartMs()
      const now = Date.now()

      // ---- 用户 ----
      const userTotal = num((db.prepare('SELECT COUNT(*) c FROM users').get() as { c: number }).c)
      const userTodayNew = num((db.prepare('SELECT COUNT(*) c FROM users WHERE created_at >= ?').get(todayStart) as { c: number }).c)
      const userActive7d = num((db.prepare('SELECT COUNT(*) c FROM users WHERE last_active >= ?').get(now - 7 * 86400000) as { c: number }).c)
      const userByType = db.prepare('SELECT type, COUNT(*) c FROM users GROUP BY type ORDER BY c DESC').all() as { type: string; c: number }[]
      const recentUsers = db
        .prepare('SELECT id, type, email, label, created_at, disabled FROM users ORDER BY created_at DESC LIMIT 8')
        .all()

      // ---- 访问（剔爬虫）----
      const todayPv = num(
        (db.prepare(`SELECT COUNT(*) c FROM visit_logs WHERE visit_date = ? AND ${BOT_FILTER}`).get(today) as { c: number }).c
      )
      const todayUv = num(
        (
          db.prepare(`SELECT COUNT(DISTINCT user_id) c FROM visit_logs WHERE visit_date = ? AND ${BOT_FILTER}`).get(today) as {
            c: number
          }
        ).c
      )
      const dates: string[] = []
      for (let i = 13; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        dates.push(d.toLocaleDateString('sv-SE'))
      }
      const visitRows = db
        .prepare(
          `SELECT visit_date d, COUNT(*) pv, COUNT(DISTINCT user_id) uv FROM visit_logs WHERE visit_date >= ? AND ${BOT_FILTER} GROUP BY visit_date`
        )
        .all(dates[0]) as { d: string; pv: number; uv: number }[]
      const visitMap = new Map(visitRows.map(r => [r.d, r]))
      const trend14 = dates.map(d => ({
        date: d,
        pv: visitMap.get(d)?.pv || 0,
        uv: visitMap.get(d)?.uv || 0
      }))

      // ---- 资讯 ----
      const newsRow = db
        .prepare("SELECT COUNT(*) articles, COALESCE(SUM(views),0) views FROM news_articles WHERE status = 'published'")
        .get() as { articles: number; views: number }
      const newsTop = db
        .prepare("SELECT id, title, views FROM news_articles WHERE status = 'published' ORDER BY views DESC LIMIT 5")
        .all() as { id: number; title: string; views: number }[]
      const newsTodayReads = num(
        (
          db
            .prepare(
              `SELECT COUNT(*) c FROM visit_logs WHERE visit_date = ? AND path LIKE '/news/%' AND ${BOT_FILTER}`
            )
            .get(today) as { c: number }
        ).c
      )

      // ---- 智能分析（analysis_usage 时间戳为秒）----
      const aiRow = db
        .prepare('SELECT COUNT(*) users, COALESCE(SUM(total_usage),0) calls FROM analysis_usage')
        .get() as { users: number; calls: number }
      const aiTodayUsers = num(
        (db.prepare('SELECT COUNT(*) c FROM analysis_usage WHERE updated_at >= ?').get(Math.floor(todayStart / 1000)) as { c: number }).c
      )

      // ---- 持仓 ----
      const fundRow = db.prepare('SELECT COUNT(*) holdings, COUNT(DISTINCT user_id) users FROM user_funds').get() as {
        holdings: number
        users: number
      }

      res.json({
        generatedAt: now,
        user: { total: userTotal, todayNew: userTodayNew, active7d: userActive7d, byType: userByType, recent: recentUsers },
        visit: { todayPv, todayUv, trend14 },
        news: { articles: newsRow.articles, totalViews: newsRow.views, todayReads: newsTodayReads, top: newsTop },
        ai: { totalCalls: aiRow.calls, users: aiRow.users, todayUsers: aiTodayUsers },
        fund: { holdings: fundRow.holdings, users: fundRow.users }
      })
    } catch (error) {
      logger.error('获取仪表盘数据失败:', error)
      res.status(500).json({ error: '获取仪表盘数据失败' })
    }
  })

  return router
}
