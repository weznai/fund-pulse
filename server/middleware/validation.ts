import { Request, Response, NextFunction } from 'express'
import { ValidationError } from '../utils/errors.js'

import { sanitizeInput as sanitizeString } from '../utils/sanitizer.js'

export function validate(validators: Array<(req: Request) => void>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      for (const validator of validators) {
        await validator(req)
      }
      next()
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }
      throw new ValidationError('输入验证失败', error)
    }
  }
}

export const commonValidations = {
  email: (field: string = 'email') => ({
    isEmail: {
      errorMessage: '邮箱格式不正确'
    },
    normalizeEmail: true,
    trim: true
  }),
  
  password: (field: string = 'password', minLength: number = 6) => ({
    isLength: {
      options: { min: minLength },
      errorMessage: `密码长度至少${minLength}位`
    },
    trim: true
  }),
  
  username: (field: string = 'username') => ({
    isLength: {
      options: { min: 1, max: 20 },
      errorMessage: '用户名长度1-20个字符'
    },
    matches: {
      options: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/,
      errorMessage: '用户名只能包含字母、数字、下划线或中文'
    },
    trim: true
  }),
  
  fundCode: (field: string = 'fundCode') => ({
    matches: {
      options: /^[0-9]{6}$/,
      errorMessage: '基金代码必须是6位数字'
    },
    trim: true
  }),
  
  positiveNumber: (field: string) => ({
    isFloat: {
      options: { min: 0 },
      errorMessage: `${field}必须为正数`
    }
  }),
  
  page: () => ({
    optional: true,
    isInt: {
      options: { min: 1 },
      errorMessage: '页码必须为正整数'
    },
    toInt: true
  }),
  
  pageSize: () => ({
    optional: true,
    isInt: {
      options: { min: 1, max: 100 },
      errorMessage: '每页数量必须在1-100之间'
    },
    toInt: true
  })
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim()
}

export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const result: any = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeInput(value)
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value)
    } else {
      result[key] = value
    }
  }
  return result
}
