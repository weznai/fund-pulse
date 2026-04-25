import { Request, Response, NextFunction } from 'express'
import { AppError, ValidationError, UnauthorizedError, DatabaseError } from '../utils/errors.js'
import { ResponseHandler } from '../utils/response.js'
import { logger } from '../logger.js'

export function globalErrorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    return next(err)
  }

  let statusCode = 500
  let errorCode = 'INTERNAL_ERROR'
  let message = '服务器内部错误'
  let details: any = undefined

  if (err instanceof AppError) {
    statusCode = err.statusCode
    errorCode = err.code || errorCode
    message = err.message
    details = err.details
  } else if (err.name === 'SyntaxError' && 'body' in err) {
    statusCode = 400
    errorCode = 'INVALID_JSON'
    message = 'JSON格式错误'
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401
    errorCode = 'UNAUTHORIZED'
    message = '未授权访问'
  }

  if (statusCode >= 500) {
    logger.error('服务器错误:', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      body: req.body,
      query: req.query
    })
  } else {
    logger.log(`客户端错误 [${statusCode}]: ${message}`, {
      path: req.path,
      method: req.method
    })
  }

  if (process.env.NODE_ENV === 'production') {
    details = undefined
    if (statusCode >= 500) {
      message = '服务器内部错误'
    }
  }

  ResponseHandler.error(res, statusCode, errorCode, message, details)
}

export function notFoundHandler(req: Request, res: Response): void {
  ResponseHandler.error(res, 404, 'NOT_FOUND', `路径 ${req.method} ${req.path} 不存在`)
}

export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
