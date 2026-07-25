import db from './connection.js'
import { getLocalDate } from './connection.js'
import { logger } from '../logger.js'

export interface ReqSource {
  ts: string
  ip: string
  ua: string
  device: string
  os: string
  browser: string
  path: string
  referer: string
  lang: string
  method: string
}

export interface VisitLog {
  id?: number
  ip: string
  path?: string
  userAgent?: string
  referer?: string
  userId?: string
  visitDate: string
  visitTime: number
  reqSource?: ReqSource
}

export interface VisitStats {
  totalPv: number
  totalUv: number
  todayPv: number
  todayUv: number
  recentDays: Array<{
    date: string
    pv: number
    uv: number
  }>
  ipDistribution: Array<{
    ip: string
    count: number
  }>
}

export interface VisitLogFromDb {
  id: number
  ip: string
  path: string | null
  user_agent: string | null
  referer: string | null
  user_id: string | null
  visit_date: string
  visit_time: number
  req_source: string | null
  username: string | null
}

export interface VisitLogListResult {
  logs: VisitLogFromDb[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface IpStat {
  ip: string
  count: number
}

export function ensureVisitLogsTable(): void {
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='visit_logs'
  `).get() as { name: string } | undefined

  if (!tableExists) {
    logger.log('🔄 创建访问日志表...')
    db.exec(`
      CREATE TABLE visit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip TEXT NOT NULL,
        path TEXT,
        user_agent TEXT,
        referer TEXT,
        user_id TEXT,
        visit_date TEXT NOT NULL,
        visit_time INTEGER NOT NULL,
        req_source TEXT
      )
    `)
    db.exec('CREATE INDEX idx_visit_logs_date ON visit_logs(visit_date);')
    db.exec('CREATE INDEX idx_visit_logs_ip ON visit_logs(ip);')
    db.exec('CREATE INDEX idx_visit_logs_user ON visit_logs(user_id);')
    logger.log('✅ 访问日志表创建完成')
  } else {
    const columns = db.pragma('table_info(visit_logs)') as Array<{ name: string }>
    const hasReqSource = columns.some(col => col.name === 'req_source')
    if (!hasReqSource) {
      logger.log('🔄 添加 req_source 列到访问日志表...')
      db.exec('ALTER TABLE visit_logs ADD COLUMN req_source TEXT')
      logger.log('✅ req_source 列添加完成')
    }
  }
}

export function logVisit(log: Omit<VisitLog, 'id'>): void {
  const stmt = db.prepare(`
    INSERT INTO visit_logs (ip, path, user_agent, referer, user_id, visit_date, visit_time, req_source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    log.ip,
    log.path || null,
    log.userAgent || null,
    log.referer || null,
    log.userId || null,
    log.visitDate,
    log.visitTime,
    log.reqSource ? JSON.stringify(log.reqSource) : null
  )
}

export function getVisitStats(): VisitStats {
  const today = getLocalDate()

  const totalPvResult = db.prepare('SELECT COUNT(*) as count FROM visit_logs').get() as { count: number }
  const totalPv = totalPvResult.count

  const totalUvResult = db.prepare('SELECT COUNT(DISTINCT ip) as count FROM visit_logs').get() as { count: number }
  const totalUv = totalUvResult.count

  const todayPvResult = db.prepare('SELECT COUNT(*) as count FROM visit_logs WHERE visit_date = ?').get(today) as { count: number }
  const todayPv = todayPvResult.count

  const todayUvResult = db.prepare('SELECT COUNT(DISTINCT ip) as count FROM visit_logs WHERE visit_date = ?').get(today) as { count: number }
  const todayUv = todayUvResult.count

  const recentDays: Array<{ date: string; pv: number; uv: number }> = []
  for (let i = 29; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = getLocalDate(date)

    const pvResult = db.prepare('SELECT COUNT(*) as count FROM visit_logs WHERE visit_date = ?').get(dateStr) as { count: number }
    const uvResult = db.prepare('SELECT COUNT(DISTINCT ip) as count FROM visit_logs WHERE visit_date = ?').get(dateStr) as { count: number }

    recentDays.push({
      date: dateStr,
      pv: pvResult.count,
      uv: uvResult.count
    })
  }

  const ipDistribution = db.prepare(`
    SELECT ip, COUNT(*) as count
    FROM visit_logs
    GROUP BY ip
    ORDER BY count DESC
    LIMIT 10
  `).all() as Array<{ ip: string; count: number }>

  return {
    totalPv,
    totalUv,
    todayPv,
    todayUv,
    recentDays,
    ipDistribution
  }
}

export function getDailyVisitStats(days: number = 7): Array<{ date: string; pv: number; uv: number }> {
  const results: Array<{ date: string; pv: number; uv: number }> = []

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = getLocalDate(date)

    const pvResult = db.prepare('SELECT COUNT(*) as count FROM visit_logs WHERE visit_date = ?').get(dateStr) as { count: number }
    const uvResult = db.prepare('SELECT COUNT(DISTINCT ip) as count FROM visit_logs WHERE visit_date = ?').get(dateStr) as { count: number }

    results.push({
      date: dateStr,
      pv: pvResult.count,
      uv: uvResult.count
    })
  }

  return results
}

export function migrateStatsToDatabase(statsData: {
  totalPv: number
  totalUv: string[]
  today: string
  todayStats: { pv: number; uv: string[] }
  history: Record<string, { pv: number; uv: string[] }>
}): { migrated: number; skipped: number } {
  let migrated = 0
  let skipped = 0
  const now = Date.now()

  ensureVisitLogsTable()

  const existingCount = db.prepare('SELECT COUNT(*) as count FROM visit_logs').get() as { count: number }
  if (existingCount.count > 0) {
    logger.log('⚠️ 访问日志表已有数据，跳过迁移')
    return { migrated: 0, skipped: 1 }
  }

  for (const [date, dayStats] of Object.entries(statsData.history || {})) {
    const pvPerUv = dayStats.uv.length > 0 ? Math.ceil(dayStats.pv / dayStats.uv.length) : 1

    for (const ip of dayStats.uv) {
      for (let i = 0; i < pvPerUv; i++) {
        try {
          db.prepare(`
            INSERT INTO visit_logs (ip, path, user_agent, referer, user_id, visit_date, visit_time)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            ip,
            '/',
            'Migrated from stats.json',
            null,
            null,
            date,
            now - i * 1000
          )
          migrated++
        } catch (e) {
          skipped++
        }
      }
    }
  }

  if (statsData.todayStats && statsData.todayStats.pv > 0) {
    const pvPerUv = statsData.todayStats.uv.length > 0
      ? Math.ceil(statsData.todayStats.pv / statsData.todayStats.uv.length)
      : 1

    for (const ip of statsData.todayStats.uv) {
      for (let i = 0; i < pvPerUv; i++) {
        try {
          db.prepare(`
            INSERT INTO visit_logs (ip, path, user_agent, referer, user_id, visit_date, visit_time)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            ip,
            '/',
            'Migrated from stats.json',
            null,
            null,
            statsData.today,
            now - i * 1000
          )
          migrated++
        } catch (e) {
          skipped++
        }
      }
    }
  }

  logger.log(`✅ 迁移访问日志完成: ${migrated} 条记录, 跳过 ${skipped} 条`)
  return { migrated, skipped }
}

export function cleanExpiredVisitLogs(daysToKeep: number = 30): number {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
  const cutoffDateStr = getLocalDate(cutoffDate)

  const stmt = db.prepare('DELETE FROM visit_logs WHERE visit_date < ?')
  const result = stmt.run(cutoffDateStr)
  logger.log(`🧹 清理过期访问日志: ${result.changes} 条`)
  return result.changes
}

export function deleteVisitLogsByIps(ips: string[]): number {
  if (ips.length === 0) return 0
  const placeholders = ips.map(() => '?').join(',')
  const stmt = db.prepare(`DELETE FROM visit_logs WHERE ip IN (${placeholders})`)
  const result = stmt.run(...ips)
  logger.log(`🧹 清理指定IP访问记录: ${result.changes} 条, IP: ${ips.join(', ')}`)
  return result.changes
}

export function deleteVisitLogsByUserIds(userIds: string[]): number {
  if (userIds.length === 0) return 0
  const placeholders = userIds.map(() => '?').join(',')
  const stmt = db.prepare(`DELETE FROM visit_logs WHERE user_id IN (${placeholders})`)
  const result = stmt.run(...userIds)
  logger.log(`🧹 清理指定用户访问记录: ${result.changes} 条, 用户: ${userIds.join(', ')}`)
  return result.changes
}

export function getVisitLogs(options: {
  page?: number
  pageSize?: number
  date?: string
  ip?: string
} = {}): VisitLogListResult {
  const page = options.page || 1
  const pageSize = options.pageSize || 20
  const offset = (page - 1) * pageSize

  let whereClause = '1=1'
  const params: (string | number)[] = []

  if (options.date) {
    whereClause += ' AND v.visit_date = ?'
    params.push(options.date)
  }

  if (options.ip) {
    whereClause += ' AND v.ip LIKE ?'
    params.push(`%${options.ip}%`)
  }

  const countSql = `SELECT COUNT(*) as count FROM visit_logs v WHERE ${whereClause}`
  const countResult = db.prepare(countSql).get(...params) as { count: number }
  const total = countResult.count

  const dataSql = `SELECT v.*, u.username FROM visit_logs v LEFT JOIN users u ON v.user_id = u.id WHERE ${whereClause} ORDER BY v.visit_date DESC, v.visit_time DESC LIMIT ? OFFSET ?`
  const logs = db.prepare(dataSql).all(...params, pageSize, offset) as VisitLogFromDb[]

  return {
    logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  }
}

export function getIpStats(options: { date?: string; limit?: number } = {}): IpStat[] {
  const limit = options.limit || 20
  let sql = 'SELECT ip, COUNT(*) as count FROM visit_logs'
  const params: string[] = []

  if (options.date) {
    sql += ' WHERE visit_date = ?'
    params.push(options.date)
  }

  sql += ' GROUP BY ip ORDER BY count DESC LIMIT ?'

  return db.prepare(sql).all(...params, limit) as IpStat[]
}
