/**
 * 数据访问层 - Repository 模式
 * 
 * 职责：封装数据库操作，提供类型安全的数据访问接口
 * 位置：db/repositories.ts（从 repositories/ 合并而来）
 */

import db from './connection.js'
import { getCurrentUserId } from './connection.js'
import type { User, UserFund, FundInfo } from '../../types/index.js'
import { DatabaseError, NotFoundError } from '../utils/errors.js'
import { getLocalDate } from './connection.js'

/**
 * 基础 Repository 类
 * 提供通用的数据库访问方法和错误处理
 */
export class BaseRepository {
  protected get db() {
    return db
  }

  protected get currentUserId(): string {
    return getCurrentUserId().id
  }

  protected handleDbError(operation: string, error: unknown): never {
    throw new DatabaseError(`${operation}失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 用户数据访问
 */
export class UserRepository extends BaseRepository {
  findById(id: string): User | undefined {
    try {
      const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?')
      return stmt.get(id) as User | undefined
    } catch (error) {
      this.handleDbError('查询用户', error)
    }
  }

  findByUsername(username: string): User | undefined {
    try {
      const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?')
      return stmt.get(username) as User | undefined
    } catch (error) {
      this.handleDbError('查询用户', error)
    }
  }

  findByEmail(email: string): User | undefined {
    try {
      const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?')
      return stmt.get(email) as User | undefined
    } catch (error) {
      this.handleDbError('查询用户', error)
    }
  }

  findByUsernameOrEmail(identifier: string): User | undefined {
    try {
      const stmt = this.db.prepare('SELECT * FROM users WHERE username = ? OR email = ?')
      return stmt.get(identifier, identifier) as User | undefined
    } catch (error) {
      this.handleDbError('查询用户', error)
    }
  }

  existsByUsername(username: string): boolean {
    try {
      const stmt = this.db.prepare('SELECT 1 FROM users WHERE username = ?')
      return !!stmt.get(username)
    } catch (error) {
      this.handleDbError('检查用户名', error)
    }
  }

  existsByEmail(email: string): boolean {
    try {
      const stmt = this.db.prepare('SELECT 1 FROM users WHERE email = ?')
      return !!stmt.get(email)
    } catch (error) {
      this.handleDbError('检查邮箱', error)
    }
  }

  create(userData: Partial<User> & { username: string; email: string; password: string }): User {
    try {
      const now = Date.now()
      const stmt = this.db.prepare(`
        INSERT INTO users (id, username, email, password, type, label, email_verified, created_at, last_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      
      const id = `user_${now}_${Math.random().toString(36).substr(2, 9)}`
      stmt.run(
        id,
        userData.username,
        userData.email,
        userData.password,
        userData.type || 'email',
        userData.label || userData.username,
        userData.emailVerified ? 1 : 0,
        now,
        now
      )
      
      return this.findById(id)!
    } catch (error) {
      this.handleDbError('创建用户', error)
    }
  }

  updateLastActive(userId: string): void {
    try {
      const stmt = this.db.prepare('UPDATE users SET last_active = ? WHERE id = ?')
      stmt.run(Date.now(), userId)
    } catch (error) {
      this.handleDbError('更新用户活跃时间', error)
    }
  }

  updatePassword(userId: string, hashedPassword: string): boolean {
    try {
      const stmt = this.db.prepare('UPDATE users SET password = ? WHERE id = ?')
      const result = stmt.run(hashedPassword, userId)
      return result.changes > 0
    } catch (error) {
      this.handleDbError('更新密码', error)
    }
  }

  verifyEmail(userId: string): boolean {
    try {
      const stmt = this.db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?')
      const result = stmt.run(userId)
      return result.changes > 0
    } catch (error) {
      this.handleDbError('验证邮箱', error)
    }
  }

  setDisabled(userId: string, disabled: boolean): boolean {
    try {
      const stmt = this.db.prepare('UPDATE users SET disabled = ? WHERE id = ?')
      const result = stmt.run(disabled ? 1 : 0, userId)
      return result.changes > 0
    } catch (error) {
      this.handleDbError('设置用户禁用状态', error)
    }
  }

  findAll(page: number = 1, pageSize: number = 20): { users: User[]; total: number } {
    try {
      const offset = (page - 1) * pageSize
      
      const countStmt = this.db.prepare('SELECT COUNT(*) as total FROM users')
      const { total } = countStmt.get() as { total: number }
      
      const stmt = this.db.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?')
      const users = stmt.all(pageSize, offset) as User[]
      
      return { users, total }
    } catch (error) {
      this.handleDbError('查询用户列表', error)
    }
  }
}

/**
 * 用户基金数据访问
 */
export class UserFundRepository extends BaseRepository {
  findByCode(fundCode: string): UserFund | undefined {
    try {
      const stmt = this.db.prepare(
        'SELECT * FROM user_funds WHERE user_id = ? AND fund_code = ? AND (status IS NULL OR status != ?)'
      )
      return stmt.get(this.currentUserId, fundCode, 'd') as UserFund | undefined
    } catch (error) {
      this.handleDbError('查询用户基金', error)
    }
  }

  findAll(): UserFund[] {
    try {
      const stmt = this.db.prepare(
        "SELECT * FROM user_funds WHERE user_id = ? AND (status IS NULL OR status != 'd') ORDER BY added_at DESC"
      )
      return stmt.all(this.currentUserId) as UserFund[]
    } catch (error) {
      this.handleDbError('查询用户基金列表', error)
    }
  }

  findHeld(): UserFund[] {
    try {
      const stmt = this.db.prepare(
        "SELECT * FROM user_funds WHERE user_id = ? AND is_held = 1 AND (status IS NULL OR status != 'd') ORDER BY added_at DESC"
      )
      return stmt.all(this.currentUserId) as UserFund[]
    } catch (error) {
      this.handleDbError('查询持仓基金', error)
    }
  }

  findByCodes(codes: string[]): Map<string, UserFund> {
    if (codes.length === 0) return new Map()
    
    try {
      const placeholders = codes.map(() => '?').join(',')
      const stmt = this.db.prepare(`
        SELECT * FROM user_funds 
        WHERE user_id = ? AND fund_code IN (${placeholders}) 
        AND (status IS NULL OR status != 'd')
      `)
      
      const results = stmt.all(this.currentUserId, ...codes) as UserFund[]
      const map = new Map<string, UserFund>()
      results.forEach(fund => map.set(fund.fundCode, fund))
      
      return map
    } catch (error) {
      this.handleDbError('批量查询基金', error)
    }
  }

  add(fundCode: string, fundName?: string): boolean {
    try {
      const now = Date.now()
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO user_funds (user_id, fund_code, fund_name, is_held, status, share, cost, amount, added_at)
        VALUES (?, ?, ?, 0, 'a', 0, 0, 0, ?)
      `)
      const result = stmt.run(this.currentUserId, fundCode, fundName || '', now)
      return result.changes > 0
    } catch (error) {
      this.handleDbError('添加基金', error)
    }
  }

  addBatch(funds: Array<{ code: string; name?: string; isHeld?: boolean }>): number {
    try {
      const now = Date.now()
      const today = getLocalDate()
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO user_funds (user_id, fund_code, fund_name, is_held, status, share, cost, amount, added_at, settled, last_settled_date)
        VALUES (?, ?, ?, ?, 'a', 0, 0, 0, ?, 0, ?)
      `)
      
      const transaction = this.db.transaction(() => {
        let count = 0
        for (const fund of funds) {
          const result = stmt.run(
            this.currentUserId, 
            fund.code, 
            fund.name || '', 
            fund.isHeld ? 1 : 0, 
            now,
            today
          )
          if (result.changes > 0) count++
        }
        return count
      })
      
      return transaction() as number
    } catch (error) {
      this.handleDbError('批量添加基金', error)
    }
  }

  delete(fundCode: string): boolean {
    try {
      const stmt = this.db.prepare('DELETE FROM user_funds WHERE user_id = ? AND fund_code = ?')
      const result = stmt.run(this.currentUserId, fundCode)
      return result.changes > 0
    } catch (error) {
      this.handleDbError('删除基金', error)
    }
  }

  updateHolding(
    fundCode: string, 
    fundName: string, 
    share: number, 
    cost: number, 
    amount: number
  ): boolean {
    try {
      const today = getLocalDate()
      const stmt = this.db.prepare(`
        INSERT INTO user_funds (user_id, fund_code, fund_name, is_held, share, cost, amount, holding_date, added_at, settled, last_settled_date)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, 0, ?)
        ON CONFLICT(user_id, fund_code) DO UPDATE SET
          fund_name = excluded.fund_name,
          is_held = 1,
          share = excluded.share,
          cost = excluded.cost,
          amount = excluded.amount,
          holding_date = excluded.holding_date,
          settled = 0,
          last_settled_date = excluded.last_settled_date
      `)
      
      const now = Date.now()
      const result = stmt.run(
        this.currentUserId,
        fundCode,
        fundName,
        share,
        cost,
        amount,
        today,
        now,
        today
      )
      
      return result.changes > 0
    } catch (error) {
      this.handleDbError('更新持仓', error)
    }
  }

  removeHolding(fundCode: string): boolean {
    try {
      const stmt = this.db.prepare(`
        UPDATE user_funds 
        SET is_held = 0, share = 0, cost = 0, amount = 0, holding_date = NULL
        WHERE user_id = ? AND fund_code = ?
      `)
      const result = stmt.run(this.currentUserId, fundCode)
      return result.changes > 0
    } catch (error) {
      this.handleDbError('取消持仓', error)
    }
  }

  exists(fundCode: string): boolean {
    try {
      const stmt = this.db.prepare('SELECT 1 FROM user_funds WHERE user_id = ? AND fund_code = ?')
      return !!stmt.get(this.currentUserId, fundCode)
    } catch (error) {
      this.handleDbError('检查基金是否存在', error)
    }
  }

  isHeld(fundCode: string): boolean {
    try {
      const stmt = this.db.prepare('SELECT 1 FROM user_funds WHERE user_id = ? AND fund_code = ? AND is_held = 1')
      return !!stmt.get(this.currentUserId, fundCode)
    } catch (error) {
      this.handleDbError('检查基金是否持仓', error)
    }
  }
}

/**
 * 基金信息数据访问
 */
export class FundInfoRepository extends BaseRepository {
  findByCode(code: string): FundInfo | undefined {
    try {
      const stmt = this.db.prepare('SELECT * FROM fund_info WHERE code = ?')
      return stmt.get(code) as FundInfo | undefined
    } catch (error) {
      this.handleDbError('查询基金信息', error)
    }
  }

  findByCodes(codes: string[]): Map<string, FundInfo> {
    if (codes.length === 0) return new Map()
    
    try {
      const placeholders = codes.map(() => '?').join(',')
      const stmt = this.db.prepare(`SELECT * FROM fund_info WHERE code IN (${placeholders})`)
      
      const results = stmt.all(...codes) as FundInfo[]
      const map = new Map<string, FundInfo>()
      results.forEach(info => map.set(info.code, info))
      
      return map
    } catch (error) {
      this.handleDbError('批量查询基金信息', error)
    }
  }

  save(fundInfo: Partial<FundInfo> & { code: string }): boolean {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO fund_info (code, name, ftype, fund_company, fund_manager, establish_date, fund_scale, benchmark, is_recommend)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET
          name = excluded.name,
          ftype = excluded.ftype,
          fund_company = excluded.fund_company,
          fund_manager = excluded.fund_manager,
          establish_date = excluded.establish_date,
          fund_scale = excluded.fund_scale,
          benchmark = excluded.benchmark,
          is_recommend = excluded.is_recommend
      `)
      
      const result = stmt.run(
        fundInfo.code,
        fundInfo.name,
        fundInfo.ftype,
        fundInfo.fund_company,
        fundInfo.fund_manager,
        fundInfo.establish_date,
        fundInfo.fund_scale,
        fundInfo.benchmark,
        fundInfo.is_recommend ? 1 : 0
      )
      
      return result.changes > 0
    } catch (error) {
      this.handleDbError('保存基金信息', error)
    }
  }

  saveBatch(funds: Array<Partial<FundInfo> & { code: string }>): number {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO fund_info (code, name, ftype, fund_company, fund_manager, establish_date, fund_scale, benchmark, is_recommend)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET
          name = excluded.name,
          ftype = excluded.ftype,
          fund_company = excluded.fund_company,
          fund_manager = excluded.fund_manager,
          establish_date = excluded.establish_date,
          fund_scale = excluded.fund_scale,
          benchmark = excluded.benchmark,
          is_recommend = excluded.is_recommend
      `)
      
      const transaction = this.db.transaction(() => {
        let count = 0
        for (const fund of funds) {
          const result = stmt.run(
            fund.code,
            fund.name,
            fund.ftype,
            fund.fund_company,
            fund.fund_manager,
            fund.establish_date,
            fund.fund_scale,
            fund.benchmark,
            fund.is_recommend ? 1 : 0
          )
          if (result.changes > 0) count++
        }
        return count
      })
      
      return transaction() as number
    } catch (error) {
      this.handleDbError('批量保存基金信息', error)
    }
  }

  getRecommendCodes(): string[] {
    try {
      const stmt = this.db.prepare('SELECT code FROM fund_info WHERE is_recommend = 1')
      const results = stmt.all() as Array<{ code: string }>
      return results.map(r => r.code)
    } catch (error) {
      this.handleDbError('获取推荐基金代码', error)
    }
  }

  delete(code: string): boolean {
    try {
      const stmt = this.db.prepare('DELETE FROM fund_info WHERE code = ?')
      const result = stmt.run(code)
      return result.changes > 0
    } catch (error) {
      this.handleDbError('删除基金信息', error)
    }
  }
}

// 导出单例实例，便于全局使用
export const userRepository = new UserRepository()
export const userFundRepository = new UserFundRepository()
export const fundInfoRepository = new FundInfoRepository()
