import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { AppError, ValidationError } from '../utils/errors.js'

const csrfTokens = new Map<string, { token: string; expiresAt: number }>()
const CSRF_TOKEN_EXPIRY = 24 * 60 * 60 * 1000

export function generateCsrfToken(): string {
  const tokenId = crypto.randomBytes(32).toString('hex')
  const token = crypto.randomBytes(32).toString('hex')
  
  csrfTokens.set(tokenId, {
    token,
    expiresAt: Date.now() + CSRF_TOKEN_EXPIRY
  })
  
  cleanExpiredCsrfTokens()
  
  return tokenId + ':' + token
}

export function validateCsrfToken(tokenHeader: string | undefined): boolean {
  if (!tokenHeader) return false
  
  const [tokenId, token] = tokenHeader.split(':')
  if (!tokenId || !token) return false
  
  const stored = csrfTokens.get(tokenId)
  if (!stored) return false
  
  if (Date.now() > stored.expiresAt) {
    csrfTokens.delete(tokenId)
    return false
  }
  
  return stored.token === token
}

function cleanExpiredCsrfTokens(): void {
  const now = Date.now()
  for (const [id, data] of csrfTokens.entries()) {
    if (now > data.expiresAt) {
      csrfTokens.delete(id)
    }
  }
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next()
  }
  
  const excludedPaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/send-otp',
    '/api/admin/login'
  ]
  
  if (excludedPaths.some(path => req.path.startsWith(path))) {
    return next()
  }
  
  const csrfToken = req.headers['x-csrf-token'] as string | undefined
  
  if (!validateCsrfToken(csrfToken)) {
    throw new ValidationError('无效的CSRF令牌')
  }
  
  next()
}

export function getCsrfTokenHandler(req: Request, res: Response): void {
  const token = generateCsrfToken()
  res.json({ csrfToken: token })
}
