/**
 * SQL 安全工具类
 * 
 * 职责：
 * 1. SQL 注入检测和预防
 * 2. 输入验证和清理
 * 3. 安全的查询构建
 */

/**
 * SQL 注入危险字符模式
 */
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)\b)/gi,
  /(--)|(\/\*)|(\*\/)/g,
  /(\bOR\b|\bAND\b).*?=/gi,
  /['";\\]/g,
  /(xp_|sp_)/gi,
  /UNION.*SELECT/gi,
  /EXEC(\s|\+)+/gi
]

/**
 * 危险的 SQL 关键字（用于白名单验证）
 */
const ALLOWED_SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'IN', 'LIKE', 
  'ORDER', 'BY', 'LIMIT', 'OFFSET', 'ASC', 'DESC',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
  'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'DISTINCT',
  'JOIN', 'LEFT', 'RIGHT', 'INNER', 'ON', 'AS',
  'GROUP', 'HAVING', 'BETWEEN', 'IS', 'NULL', 'NOT'
])

/**
 * 验证字段名是否安全（只允许字母、数字、下划线）
 */
export function validateFieldName(fieldName: string): boolean {
  if (!fieldName || typeof fieldName !== 'string') {
    return false
  }
  
  // 只允许字母、数字、下划线
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fieldName)
}

/**
 * 验证表名是否安全
 */
export function validateTableName(tableName: string): boolean {
  if (!tableName || typeof tableName !== 'string') {
    return false
  }
  
  // 只允许字母、数字、下划线
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)
}

/**
 * 检测字符串是否包含 SQL 注入特征
 */
export function detectSqlInjection(input: string): {
  isSafe: boolean
  detectedPatterns: string[]
} {
  if (!input || typeof input !== 'string') {
    return { isSafe: true, detectedPatterns: [] }
  }

  const detectedPatterns: string[] = []
  
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      detectedPatterns.push(pattern.source)
    }
  }

  return {
    isSafe: detectedPatterns.length === 0,
    detectedPatterns
  }
}

/**
 * 清理字符串输入（移除危险字符）
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') {
    return ''
  }

  // 移除危险字符
  return input
    .replace(/['";\\]/g, '') // 移除引号和反斜杠
    .replace(/--/g, '')      // 移除 SQL 注释
    .replace(/\/\*/g, '')    // 移除块注释开始
    .replace(/\*\//g, '')    // 移除块注释结束
    .trim()
}

/**
 * 安全的 LIKE 查询值构建
 */
export function buildLikeValue(value: string, pattern: 'contains' | 'startsWith' | 'endsWith' = 'contains'): string {
  const sanitized = sanitizeString(value)
  
  // 转义 LIKE 特殊字符
  const escaped = sanitized
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
  
  switch (pattern) {
    case 'startsWith':
      return `${escaped}%`
    case 'endsWith':
      return `%${escaped}`
    case 'contains':
    default:
      return `%${escaped}%`
  }
}

/**
 * 安全的 IN 查询占位符构建
 */
export function buildInPlaceholders(count: number): string {
  if (count <= 0) {
    throw new Error('IN 查询至少需要一个值')
  }
  if (count > 1000) {
    throw new Error('IN 查询最多支持 1000 个值')
  }
  
  return Array(count).fill('?').join(',')
}

/**
 * 安全的 ORDER BY 字段构建
 */
export function buildOrderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): string {
  if (!validateFieldName(field)) {
    throw new Error(`无效的字段名: ${field}`)
  }
  
  const upperDirection = direction.toUpperCase()
  if (upperDirection !== 'ASC' && upperDirection !== 'DESC') {
    throw new Error(`无效的排序方向: ${direction}`)
  }
  
  return `${field} ${upperDirection}`
}

/**
 * 查询构建器
 */
export class SafeQueryBuilder {
  private table: string
  private conditions: string[] = []
  private params: any[] = []
  private orderByClause: string = ''
  private limitValue?: number
  private offsetValue?: number

  constructor(table: string) {
    if (!validateTableName(table)) {
      throw new Error(`无效的表名: ${table}`)
    }
    this.table = table
  }

  /**
   * 添加 WHERE 条件
   */
  where(field: string, operator: string, value: any): this {
    if (!validateFieldName(field)) {
      throw new Error(`无效的字段名: ${field}`)
    }
    
    // 验证操作符
    const allowedOperators = ['=', '!=', '<', '>', '<=', '>=', 'LIKE', 'IN', 'IS']
    if (!allowedOperators.includes(operator.toUpperCase())) {
      throw new Error(`不支持的操作符: ${operator}`)
    }
    
    this.conditions.push(`${field} ${operator} ?`)
    this.params.push(value)
    
    return this
  }

  /**
   * 添加 WHERE IN 条件
   */
  whereIn(field: string, values: any[]): this {
    if (!validateFieldName(field)) {
      throw new Error(`无效的字段名: ${field}`)
    }
    
    if (values.length === 0) {
      throw new Error('IN 查询至少需要一个值')
    }
    
    const placeholders = buildInPlaceholders(values.length)
    this.conditions.push(`${field} IN (${placeholders})`)
    this.params.push(...values)
    
    return this
  }

  /**
   * 添加 WHERE LIKE 条件
   */
  whereLike(field: string, value: string, pattern: 'contains' | 'startsWith' | 'endsWith' = 'contains'): this {
    if (!validateFieldName(field)) {
      throw new Error(`无效的字段名: ${field}`)
    }
    
    const likeValue = buildLikeValue(value, pattern)
    this.conditions.push(`${field} LIKE ?`)
    this.params.push(likeValue)
    
    return this
  }

  /**
   * 添加 AND 条件
   */
  andWhere(field: string, operator: string, value: any): this {
    return this.where(field, operator, value)
  }

  /**
   * 设置 ORDER BY
   */
  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.orderByClause = `ORDER BY ${buildOrderBy(field, direction)}`
    return this
  }

  /**
   * 设置 LIMIT
   */
  limit(limit: number): this {
    if (limit < 0) {
      throw new Error('LIMIT 不能为负数')
    }
    this.limitValue = limit
    return this
  }

  /**
   * 设置 OFFSET
   */
  offset(offset: number): this {
    if (offset < 0) {
      throw new Error('OFFSET 不能为负数')
    }
    this.offsetValue = offset
    return this
  }

  /**
   * 构建 SELECT 查询
   */
  buildSelect(fields: string[] = ['*']): { sql: string; params: any[] } {
    // 验证字段名
    if (fields.length > 0 && fields[0] !== '*') {
      for (const field of fields) {
        if (!validateFieldName(field)) {
          throw new Error(`无效的字段名: ${field}`)
        }
      }
    }
    
    const fieldList = fields.join(', ')
    let sql = `SELECT ${fieldList} FROM ${this.table}`
    
    if (this.conditions.length > 0) {
      sql += ` WHERE ${this.conditions.join(' AND ')}`
    }
    
    if (this.orderByClause) {
      sql += ` ${this.orderByClause}`
    }
    
    if (this.limitValue !== undefined) {
      sql += ` LIMIT ?`
      this.params.push(this.limitValue)
    }
    
    if (this.offsetValue !== undefined) {
      sql += ` OFFSET ?`
      this.params.push(this.offsetValue)
    }
    
    return { sql, params: this.params }
  }

  /**
   * 构建 COUNT 查询
   */
  buildCount(): { sql: string; params: any[] } {
    let sql = `SELECT COUNT(*) as count FROM ${this.table}`
    
    if (this.conditions.length > 0) {
      sql += ` WHERE ${this.conditions.join(' AND ')}`
    }
    
    return { sql, params: this.params }
  }

  /**
   * 构建 DELETE 查询
   */
  buildDelete(): { sql: string; params: any[] } {
    if (this.conditions.length === 0) {
      throw new Error('DELETE 查询必须包含 WHERE 条件')
    }
    
    const sql = `DELETE FROM ${this.table} WHERE ${this.conditions.join(' AND ')}`
    
    return { sql, params: this.params }
  }

  /**
   * 获取参数
   */
  getParams(): any[] {
    return this.params
  }
}

/**
 * 验证数字范围
 */
export function validateNumber(value: any, min?: number, max?: number): number {
  const num = Number(value)
  
  if (isNaN(num)) {
    throw new Error(`无效的数字: ${value}`)
  }
  
  if (min !== undefined && num < min) {
    throw new Error(`数字 ${num} 小于最小值 ${min}`)
  }
  
  if (max !== undefined && num > max) {
    throw new Error(`数字 ${num} 大于最大值 ${max}`)
  }
  
  return num
}

/**
 * 验证分页参数
 */
export function validatePagination(page?: any, pageSize?: any): { page: number; pageSize: number; offset: number } {
  const p = validateNumber(page || 1, 1, 10000)
  const ps = validateNumber(pageSize || 20, 1, 100)
  const offset = (p - 1) * ps
  
  return { page: p, pageSize: ps, offset }
}

/**
 * 日志记录（用于审计）
 */
export function logQuery(sql: string, params: any[], userId?: string): void {
  // 在生产环境中，可以将查询日志记录到文件或数据库
  if (process.env.NODE_ENV === 'development') {
    console.log('[SQL]', sql, params, userId ? `userId: ${userId}` : '')
  }
}
