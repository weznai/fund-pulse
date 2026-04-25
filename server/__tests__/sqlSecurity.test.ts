import { describe, it, expect } from '@jest/globals'
import {
  validateFieldName,
  validateTableName,
  buildSafeInClause,
  buildOrderBy,
  SafeQueryBuilder,
  validateNumber,
  validatePagination,
  detectSqlInjection
} from '../utils/sqlSecurity.js'

describe('SQL Security Utils', () => {
  describe('validateFieldName', () => {
    it('应该接受合法的字段名', () => {
      expect(validateFieldName('user_id')).toBe(true)
      expect(validateFieldName('fund_code')).toBe(true)
      expect(validateFieldName('createdAt')).toBe(true)
      expect(validateFieldName('_test')).toBe(true)
    })

    it('应该拒绝非法的字段名', () => {
      expect(validateFieldName('')).toBe(false)
      expect(validateFieldName('user-id')).toBe(false)
      expect(validateFieldName('user.id')).toBe(false)
      expect(validateFieldName('123abc')).toBe(false)
      expect(validateFieldName('SELECT * FROM users')).toBe(false)
    })
  })

  describe('validateTableName', () => {
    it('应该接受合法的表名', () => {
      expect(validateTableName('users')).toBe(true)
      expect(validateTableName('user_funds')).toBe(true)
      expect(validateTableName('fund_cache')).toBe(true)
    })

    it('应该拒绝非法的表名', () => {
      expect(validateTableName('')).toBe(false)
      expect(validateTableName('user-funds')).toBe(false)
      expect(validateTableName('DROP TABLE users')).toBe(false)
    })
  })

  describe('buildSafeInClause', () => {
    it('应该生成安全的 IN 子句', () => {
      const { placeholders, params } = buildSafeInClause(['a', 'b', 'c'])
      expect(placeholders).toBe('?,?,?')
      expect(params).toEqual(['a', 'b', 'c'])
    })

    it('应该处理空数组', () => {
      const { placeholders, params } = buildSafeInClause([])
      expect(placeholders).toBe('')
      expect(params).toEqual([])
    })

    it('应该限制数组长度', () => {
      const largeArray = Array(1500).fill('x')
      expect(() => buildSafeInClause(largeArray)).toThrow('IN 查询最多支持 1000 个值')
    })
  })

  describe('buildOrderBy', () => {
    it('应该构建合法的 ORDER BY 子句', () => {
      expect(buildOrderBy('created_at', 'DESC')).toBe('created_at DESC')
      expect(buildOrderBy('name', 'asc')).toBe('name ASC')
    })

    it('应该拒绝非法的字段名', () => {
      expect(() => buildOrderBy('DROP TABLE users', 'ASC')).toThrow('无效的字段名')
    })

    it('应该拒绝非法的排序方向', () => {
      expect(() => buildOrderBy('created_at', 'RANDOM')).toThrow('无效的排序方向')
    })
  })

  describe('SafeQueryBuilder', () => {
    it('应该构建安全的 SELECT 查询', () => {
      const builder = new SafeQueryBuilder('users')
        .where('id', '=', 123)
        .where('status', '=', 'active')
        .orderBy('created_at', 'DESC')
        .limit(20)
        .offset(0)
      
      const { sql, params } = builder.buildSelect(['id', 'name', 'email'])
      
      expect(sql).toContain('SELECT id, name, email FROM users')
      expect(sql).toContain('WHERE id = ? AND status = ?')
      expect(sql).toContain('ORDER BY created_at DESC')
      expect(sql).toContain('LIMIT ?')
      expect(sql).toContain('OFFSET ?')
      expect(params).toEqual([123, 'active', 20, 0])
    })

    it('应该构建安全的 COUNT 查询', () => {
      const builder = new SafeQueryBuilder('users')
        .where('status', '=', 'active')
      
      const { sql, params } = builder.buildCount()
      
      expect(sql).toContain('SELECT COUNT(*) as count FROM users')
      expect(sql).toContain('WHERE status = ?')
      expect(params).toEqual(['active'])
    })

    it('应该构建安全的 DELETE 查询', () => {
      const builder = new SafeQueryBuilder('users')
        .where('id', '=', 123)
      
      const { sql, params } = builder.buildDelete()
      
      expect(sql).toContain('DELETE FROM users WHERE id = ?')
      expect(params).toEqual([123])
    })

    it('应该拒绝没有 WHERE 条件的 DELETE', () => {
      const builder = new SafeQueryBuilder('users')
      
      expect(() => builder.buildDelete()).toThrow('DELETE 查询必须包含 WHERE 条件')
    })

    it('应该拒绝非法的表名', () => {
      expect(() => new SafeQueryBuilder('DROP TABLE users')).toThrow('无效的表名')
    })

    it('应该拒绝非法的字段名', () => {
      expect(() => {
        new SafeQueryBuilder('users').where('DROP TABLE users', '=', 1)
      }).toThrow('无效的字段名')
    })
  })

  describe('validateNumber', () => {
    it('应该验证数字', () => {
      expect(validateNumber(123)).toBe(123)
      expect(validateNumber('456')).toBe(456)
      expect(validateNumber(0)).toBe(0)
    })

    it('应该验证范围', () => {
      expect(validateNumber(5, 1, 10)).toBe(5)
      expect(() => validateNumber(0, 1, 10)).toThrow('小于最小值')
      expect(() => validateNumber(11, 1, 10)).toThrow('大于最大值')
    })

    it('应该拒绝非数字', () => {
      expect(() => validateNumber('abc')).toThrow('无效的数字')
      expect(() => validateNumber(null)).toThrow('无效的数字')
      expect(() => validateNumber(undefined)).toThrow('无效的数字')
    })
  })

  describe('validatePagination', () => {
    it('应该验证分页参数', () => {
      const result = validatePagination(2, 10)
      expect(result).toEqual({
        page: 2,
        pageSize: 10,
        offset: 10
      })
    })

    it('应该使用默认值', () => {
      const result = validatePagination()
      expect(result).toEqual({
        page: 1,
        pageSize: 20,
        offset: 0
      })
    })

    it('应该限制页面大小', () => {
      expect(() => validatePagination(1, 200)).toThrow('大于最大值')
    })
  })

  describe('detectSqlInjection', () => {
    it('应该检测到 SQL 注入尝试', () => {
      const attacks = [
        "1' OR '1'='1",
        "1; DROP TABLE users--",
        "1 UNION SELECT * FROM users",
        "1; DELETE FROM users WHERE 1=1",
        "../../../etc/passwd"
      ]
      
      attacks.forEach(input => {
        const result = detectSqlInjection(input)
        expect(result.isSafe).toBe(false)
        expect(result.patterns.length).toBeGreaterThan(0)
      })
    })

    it('应该接受安全的输入', () => {
      const safeInputs = [
        "user123",
        "test@example.com",
        "13800138000",
        "fund_code_001"
      ]
      
      safeInputs.forEach(input => {
        const result = detectSqlInjection(input)
        expect(result.isSafe).toBe(true)
        expect(result.patterns).toHaveLength(0)
      })
    })
  })
})
