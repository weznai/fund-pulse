/**
 * SQL 注入防护中间件
 * 
 * 职责：验证和清理用户输入， */

import { Request, Response, NextFunction } from 'express'
import { detectSqlInjection } from '../utils/sqlSecurity.js'
import { ValidationError } from '../utils/errors.js'

function sanitizeObject(obj: unknown, path = 'body'): void {
  if (obj === null || obj === undefined) return

  if (typeof obj === 'string') {
    const result = detectSqlInjection(obj)
    if (!result.isSafe) {
      throw new ValidationError(`${path} 包含不安全字符`)
    }
    return
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      sanitizeObject(item, `${path}[${index}]`)
    })
    return
  }

  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      sanitizeObject(value, `${path}.${key}`)
    }
  }
}

/**
 * 输入验证和清理中间件
 */
export function inputSanitizer(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // 检查查询参数
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        const result = detectSqlInjection(value)
        if (!result.isSafe) {
          throw new ValidationError(`查询参数 ${key} 包含不安全字符`)
        }
      }
    }
  }

  // 检查请求体
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body)
  }

  next()
}
