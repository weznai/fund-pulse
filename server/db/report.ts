import db from './connection.js'
import { logger } from '../logger.js'

const REPORT_EXPIRE_DAYS = 7

export function ensureReportsTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_analysis_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_code TEXT NOT NULL,
      stock_name TEXT NOT NULL,
      decision TEXT NOT NULL DEFAULT '',
      file_path TEXT NOT NULL,
      url TEXT NOT NULL,
      user_id TEXT NOT NULL DEFAULT '',
      username TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      expires_at TEXT NOT NULL
    )
  `)

  // Migration: add risk_report column if not exists
  try {
    db.exec(`ALTER TABLE stock_analysis_reports ADD COLUMN risk_report TEXT NOT NULL DEFAULT ''`)
    logger.log('[report] 已添加 risk_report 列')
  } catch { /* column already exists */ }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_report_stock_code ON stock_analysis_reports (stock_code)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_report_created ON stock_analysis_reports (created_at)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_report_expires ON stock_analysis_reports (expires_at)`)
}

export interface StockReportRecord {
  id: number
  stock_code: string
  stock_name: string
  decision: string
  file_path: string
  url: string
  user_id: string
  username: string
  created_at: string
  expires_at: string
  risk_report: string
}

export function createReport(data: {
  stock_code: string
  stock_name: string
  decision: string
  file_path: string
  url: string
  user_id: string
  username: string
  risk_report?: string
}): number {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + REPORT_EXPIRE_DAYS * 24 * 60 * 60 * 1000)
  const expiresAtStr = expiresAt.toLocaleDateString('sv-SE') + ' ' + expiresAt.toTimeString().slice(0, 8)

  const result = db.prepare(
    `INSERT INTO stock_analysis_reports (stock_code, stock_name, decision, file_path, url, user_id, username, expires_at, risk_report)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    data.stock_code,
    data.stock_name,
    data.decision,
    data.file_path,
    data.url,
    data.user_id,
    data.username,
    expiresAtStr,
    data.risk_report || ''
  )
  return result.lastInsertRowid as number
}

export function getReportById(id: number): StockReportRecord | undefined {
  return db.prepare('SELECT * FROM stock_analysis_reports WHERE id = ?').get(id) as StockReportRecord | undefined
}

export interface ReportListQuery {
  page: number
  pageSize: number
  keyword?: string
  decision?: string
  startDate?: string
  endDate?: string
}

export function getReportList(query: ReportListQuery): {
  list: StockReportRecord[]
  total: number
} {
  const conditions: string[] = []
  const params: any[] = []

  if (query.keyword) {
    conditions.push('(stock_code LIKE ? OR stock_name LIKE ?)')
    params.push(`%${query.keyword}%`, `%${query.keyword}%`)
  }
  if (query.decision) {
    conditions.push('decision = ?')
    params.push(query.decision)
  }
  if (query.startDate) {
    conditions.push("date(created_at) >= ?")
    params.push(query.startDate)
  }
  if (query.endDate) {
    conditions.push("date(created_at) <= ?")
    params.push(query.endDate)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM stock_analysis_reports ${where}`).get(...params) as { total: number }

  const offset = (query.page - 1) * query.pageSize
  const list = db.prepare(
    `SELECT * FROM stock_analysis_reports ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, query.pageSize, offset) as StockReportRecord[]

  return { list, total: countRow.total }
}

export function getExpiredReports(): StockReportRecord[] {
  const now = new Date().toLocaleDateString('sv-SE') + ' ' + new Date().toTimeString().slice(0, 8)
  return db.prepare('SELECT * FROM stock_analysis_reports WHERE expires_at < ?').all(now) as StockReportRecord[]
}

export function deleteReport(id: number): StockReportRecord | null {
  const report = getReportById(id)
  if (!report) return null
  db.prepare('DELETE FROM stock_analysis_reports WHERE id = ?').run(id)
  return report
}

export function deleteReportsBatch(ids: number[]): { deleted: number; reports: StockReportRecord[] } {
  const reports: StockReportRecord[] = []
  let deleted = 0
  for (const id of ids) {
    const report = deleteReport(id)
    if (report) {
      reports.push(report)
      deleted++
    }
  }
  return { deleted, reports }
}

export function deleteExpiredReports(): { deleted: number; reports: StockReportRecord[] } {
  const expired = getExpiredReports()
  if (expired.length === 0) return { deleted: 0, reports: [] }

  const ids = expired.map(r => r.id)
  const placeholders = ids.map(() => '?').join(',')
  db.prepare(`DELETE FROM stock_analysis_reports WHERE id IN (${placeholders})`).run(...ids)
  logger.log(`[reportCleanup] 已删除 ${expired.length} 条过期报告`)
  return { deleted: expired.length, reports: expired }
}

export function getReportStats(): {
  total: number
  buyCount: number
  sellCount: number
  holdCount: number
  expiredCount: number
} {
  const total = (db.prepare('SELECT COUNT(*) as cnt FROM stock_analysis_reports').get() as { cnt: number }).cnt
  const buyCount = (db.prepare("SELECT COUNT(*) as cnt FROM stock_analysis_reports WHERE decision = 'BUY'").get() as { cnt: number }).cnt
  const sellCount = (db.prepare("SELECT COUNT(*) as cnt FROM stock_analysis_reports WHERE decision = 'SELL'").get() as { cnt: number }).cnt
  const holdCount = (db.prepare("SELECT COUNT(*) as cnt FROM stock_analysis_reports WHERE decision = 'HOLD'").get() as { cnt: number }).cnt

  const now = new Date().toLocaleDateString('sv-SE') + ' ' + new Date().toTimeString().slice(0, 8)
  const expiredCount = (db.prepare('SELECT COUNT(*) as cnt FROM stock_analysis_reports WHERE expires_at < ?').get(now) as { cnt: number }).cnt

  return { total, buyCount, sellCount, holdCount, expiredCount }
}

export function getLatestRiskReport(stockCode: string): { decision: string; riskReport: string; createdAt: string } | null {
  const row = db.prepare(
    `SELECT decision, risk_report, created_at FROM stock_analysis_reports
     WHERE stock_code = ? AND risk_report != ''
     ORDER BY created_at DESC LIMIT 1`
  ).get(stockCode) as { decision: string; risk_report: string; created_at: string } | undefined
  return row ? { decision: row.decision, riskReport: row.risk_report, createdAt: row.created_at } : null
}
