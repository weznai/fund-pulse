import { Response } from 'express'

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: {
    code: string
    message: string
    details?: any
  }
  timestamp: string
}

export class ResponseHandler {
  static success<T>(res: Response, data?: T, message?: string, statusCode: number = 200): void {
    const response: ApiResponse<T> = {
      success: true,
      timestamp: new Date().toISOString()
    }
    
    if (data !== undefined) response.data = data
    if (message) response.message = message
    
    res.status(statusCode).json(response)
  }

  static created<T>(res: Response, data?: T, message?: string): void {
    this.success(res, data, message, 201)
  }

  static error(
    res: Response, 
    statusCode: number, 
    code: string, 
    message: string, 
    details?: any
  ): void {
    const response: ApiResponse = {
      success: false,
      error: { code, message, details },
      timestamp: new Date().toISOString()
    }
    
    res.status(statusCode).json(response)
  }

  static paginated<T>(
    res: Response, 
    data: T[], 
    total: number, 
    page: number, 
    pageSize: number
  ): void {
    this.success(res, {
      items: data,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    })
  }
}
