import { Request, Response, NextFunction } from 'express'
import { logger } from '../logger.js'
import { getLocalDate, logVisit } from '../db/index.js'
import { parseUserAgent, getClientIp } from '../services/statsService.js'
import { getClientUserId, setSessionCookie } from './userSession.js'

export function trackVisit(req: Request, res: Response, next: NextFunction) {
  const isStaticResource = req.path.match(/\.(js|css|ico|png|jpg|svg|woff|woff2|ttf|eot)$/i)
  const isApiRequest = req.path.startsWith('/api/')
  const isAdminPage = req.path.startsWith('/admin')

  if (!isStaticResource && !isApiRequest && !isAdminPage) {
    const now = new Date()
    const visitDate = getLocalDate(now)
    const visitTime = now.getTime()

    const ip = getClientIp(req)

    const { userId, isNew } = getClientUserId(req)
    
    if (isNew) {
      setSessionCookie(res, userId.id)
    }

    const ua = req.headers['user-agent'] || ''
    const reqSource = parseUserAgent(ua, ip, req)

    try {
      logVisit({
        ip: ip,
        path: req.path,
        userAgent: ua,
        referer: req.headers['referer'],
        userId: userId.id,
        visitDate: visitDate,
        visitTime: visitTime,
        reqSource: reqSource
      })
    } catch (err) {
      logger.error('记录访问日志失败:', err)
    }
  }

  next()
}
