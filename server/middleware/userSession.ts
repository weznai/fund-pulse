import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { getCurrentUserId, getUserIdFromClientId, generateSessionId, setGuestUser, UserIdType, UserId } from '../db/index.js'
import { logger } from '../logger.js'

const SESSION_SECRET = process.env.SESSION_SECRET || 'fund-pulse-session-secret-key'
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000

function signToken(payload: string): string {
  const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex')
  return `${payload}.${hmac}`
}

function verifyToken(token: string): string | null {
  const dotIndex = token.lastIndexOf('.')
  if (dotIndex === -1) return null

  const payload = token.substring(0, dotIndex)
  const signature = token.substring(dotIndex + 1)
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex')

  if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return payload
  }
  return null
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {}
  if (!cookieHeader) return cookies

  cookieHeader.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=')
    if (name && value) {
      cookies[name] = decodeURIComponent(value)
    }
  })

  return cookies
}

export function getClientUserId(req: Request): { userId: UserId; isNew: boolean } {
  const cookies = parseCookies(req.headers.cookie)
  const rawSessionId = cookies['session_id']

  if (rawSessionId) {
    const sessionId = verifyToken(rawSessionId)
    if (sessionId) {
      const userId = getUserIdFromClientId(sessionId)
      if (userId) {
        return { userId, isNew: false }
      }
    }
  }

  const clientId = req.headers['x-client-id'] as string | undefined

  if (clientId) {
    const userId = getUserIdFromClientId(clientId)
    if (userId) {
      return { userId, isNew: false }
    }
  }

  const newSessionId = generateSessionId()
  const newUserId: UserId = {
    id: newSessionId,
    type: UserIdType.GUEST,
    label: '访客'
  }

  return { userId: newUserId, isNew: true }
}

export function setSessionCookie(res: Response, sessionId: string): void {
  const signed = signToken(sessionId)
  res.cookie('session_id', signed, {
    httpOnly: true,
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax'
  })
}

export function ensureUserSession(req: Request, res: Response): UserId {
  const cookies = parseCookies(req.headers.cookie)
  const { userId, isNew } = getClientUserId(req)

  if (!cookies['session_id'] || isNew) {
    setSessionCookie(res, userId.id)
  }

  return userId
}

export function isRegisteredUser(userId: UserId): boolean {
  return userId.type === UserIdType.REGISTERED
}
