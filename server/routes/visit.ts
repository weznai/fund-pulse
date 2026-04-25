import { Router, Request, Response } from 'express'
import { logger } from '../logger.js'
import { getLocalDate, ensureVisitLogsTable, getVisitStats, logVisit } from '../db/index.js'
import { getClientIp, parseUserAgent } from '../services/statsService.js'
import { ensureUserSession } from '../middleware/userSession.js'

const router = Router()

router.get('/stats', (req: Request, res: Response) => {
  try {
    ensureVisitLogsTable()
    const visitStats = getVisitStats()
    res.json(visitStats)
  } catch (error) {
    logger.error('获取访问统计失败:', error)
    res.status(500).json({ error: '获取访问统计失败' })
  }
})

router.post('/visit', (req: Request, res: Response) => {
  try {
    const { path } = req.body
    const now = new Date()
    const visitDate = getLocalDate(now)
    const visitTime = now.getTime()

    const ip = getClientIp(req)

    const userId = ensureUserSession(req, res)
    const ua = req.headers['user-agent'] || ''
    const reqSource = parseUserAgent(ua, ip, req)

    logVisit({
      ip: ip,
      path: path || req.headers.referer || '/',
      userAgent: ua,
      referer: req.headers['referer'],
      userId: userId.id,
      visitDate: visitDate,
      visitTime: visitTime,
      reqSource: reqSource
    })

    res.json({ success: true })
  } catch (error) {
    logger.error('记录访问失败:', error)
    res.status(500).json({ error: '记录访问失败' })
  }
})

export default router
