import crypto from 'crypto'
import { userRepository } from '../db/index.js'
import { hashPassword, verifyPassword, isOldPasswordHash, verifyOldMD5Password } from './password.js'
import { ValidationError, UnauthorizedError, NotFoundError } from '../utils/errors.js'
import type { User } from '../../types/index.js'

export class AuthService {
  async register(userData: {
    username: string
    email: string
    password: string
    emailVerified?: boolean
  }): Promise<User> {
    if (userRepository.existsByUsername(userData.username)) {
      throw new ValidationError('用户名已被使用')
    }
    
    if (userRepository.existsByEmail(userData.email)) {
      throw new ValidationError('邮箱已被注册')
    }
    
    const hashedPassword = hashPassword(userData.password)
    
    const user = userRepository.create({
      username: userData.username,
      email: userData.email,
      password: hashedPassword,
      emailVerified: userData.emailVerified || false
    })
    
    if (!user) {
      throw new ValidationError('创建用户失败')
    }
    
    return user
  }

  async login(identifier: string, password: string): Promise<User> {
    const user = userRepository.findByUsernameOrEmail(identifier)
    
    if (!user) {
      throw new ValidationError('用户不存在')
    }
    
    let passwordValid = false
    if (user.password) {
      if (isOldPasswordHash(user.password)) {
        passwordValid = verifyOldMD5Password(password, user.password)
        if (passwordValid) {
          const hashedPassword = hashPassword(password)
          userRepository.updatePassword(user.id, hashedPassword)
        }
      } else {
        passwordValid = verifyPassword(password, user.password)
      }
    }
    
    if (!passwordValid) {
      throw new ValidationError('密码错误')
    }
    
    if (user.disabled) {
      throw new UnauthorizedError('该账号已被禁用，请联系管理员')
    }
    
    userRepository.updateLastActive(user.id)
    
    return user
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<boolean> {
    const user = userRepository.findById(userId)
    
    if (!user) {
      throw new NotFoundError('用户不存在')
    }
    
    let passwordValid = false
    if (user.password) {
      if (isOldPasswordHash(user.password)) {
        passwordValid = verifyOldMD5Password(oldPassword, user.password)
      } else {
        passwordValid = verifyPassword(oldPassword, user.password)
      }
    }
    
    if (!passwordValid) {
      throw new ValidationError('原密码错误')
    }
    
    const hashedPassword = hashPassword(newPassword)
    return userRepository.updatePassword(userId, hashedPassword)
  }

  verifyEmail(userId: string): boolean {
    return userRepository.verifyEmail(userId)
  }
}

export function generateToken(userId: string): string {
  const payload = JSON.stringify({
    userId,
    timestamp: Date.now(),
    random: crypto.randomBytes(16).toString('hex')
  })
  
  const signature = crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'your-secret-key-change-in-production')
    .update(payload)
    .digest('hex')
  
  return Buffer.from(`${payload}.${signature}`).toString('base64')
}

export function verifyToken(token: string): { userId: string; timestamp: number } | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString()
    const [payload, signature] = decoded.split('.')
    
    if (!payload || !signature) return null
    
    const expectedSignature = crypto
      .createHmac('sha256', process.env.JWT_SECRET || 'your-secret-key-change-in-production')
      .update(payload)
      .digest('hex')
    
    if (signature !== expectedSignature) return null
    
    const data = JSON.parse(payload)
    
    if (Date.now() - data.timestamp > 7 * 24 * 60 * 60 * 1000) {
      return null
    }
    
    return data
  } catch {
    return null
  }
}
