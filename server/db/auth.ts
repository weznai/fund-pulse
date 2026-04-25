import db from './connection.js'
import { logger } from '../logger.js'

export interface EmailOtp {
  email: string
  otp: string
  expiresAt: number
  createdAt: number
}

export function saveOtp(email: string, otp: string, expiresAt: number): void {
  const now = Date.now()

  const existingOtp = db.prepare(`
    SELECT created_at FROM email_otps WHERE email = ?
  `).get(email) as { created_at: number } | undefined

  if (existingOtp && (now - existingOtp.created_at) < 60000) {
    throw new Error('发送频率过高，请60秒后再试')
  }

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO email_otps (email, otp, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `)

  stmt.run(email, otp, expiresAt, now)
  logger.log(`📧 验证码已保存: ${email}`)
}

export function verifyOtp(email: string, otp: string): boolean {
  const now = Date.now()

  const stmt = db.prepare(`
    SELECT otp, expires_at FROM email_otps WHERE email = ? AND expires_at > ?
  `)

  const result = stmt.get(email, now) as { otp: string; expires_at: number } | undefined

  if (!result) {
    logger.log(`❌ 验证码不存在或已过期: ${email}`)
    return false
  }

  if (result.otp !== otp) {
    logger.log(`❌ 验证码错误: ${email}`)
    return false
  }

  db.prepare('DELETE FROM email_otps WHERE email = ?').run(email)
  logger.log(`✅ 验证码验证成功: ${email}`)
  return true
}

export function cleanExpiredOtps(): number {
  const now = Date.now()
  const stmt = db.prepare('DELETE FROM email_otps WHERE expires_at < ?')
  const result = stmt.run(now)
  logger.log(`🧹 清理过期验证码: ${result.changes} 条`)
  return result.changes
}
