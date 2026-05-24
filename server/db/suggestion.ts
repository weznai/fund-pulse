import db from './connection.js'
import { getCurrentUserId } from './connection.js'
import { logger } from '../logger.js'

export interface Suggestion {
  id: number
  summary: string
  content: string
  status: 'pending' | 'processing' | 'completed' | 'rejected'
  processed_at: number | null
  created_at: number
  updated_at: number
  submitter_id: string
  submitter_type: 'registered' | 'guest'
}

export interface SuggestionListResult {
  list: Array<{
    id: number
    summary: string
    content: string
    status: string
    processed_at: number | null
    created_at: number
    updated_at: number
    submitter_label: string
  }>
  total: number
}

export function ensureSuggestionsTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      summary TEXT NOT NULL DEFAULT '更新中...',
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'rejected')),
      processed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      submitter_id TEXT NOT NULL,
      submitter_type TEXT NOT NULL CHECK(submitter_type IN ('registered', 'guest'))
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_suggestions_created ON suggestions(created_at)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_suggestions_submitter ON suggestions(submitter_id)`)
}

export function createSuggestion(content: string): { id: number; summary: string; content: string; status: string; created_at: number; updated_at: number; submitter_label: string } {
  const userId = getCurrentUserId()
  const now = Date.now()

  const stmt = db.prepare(`
    INSERT INTO suggestions (content, status, created_at, updated_at, submitter_id, submitter_type)
    VALUES (?, 'pending', ?, ?, ?, ?)
  `)
  const result = stmt.run(content, now, now, userId.id, userId.type)

  return {
    id: Number(result.lastInsertRowid),
    summary: '更新中...',
    content,
    status: 'pending',
    created_at: now,
    updated_at: now,
    submitter_label: userId.type === 'registered' ? '用户' : '游客'
  }
}

export function updateSuggestionSummary(id: number, summary: string): boolean {
  const now = Date.now()
  const result = db.prepare(`
    UPDATE suggestions SET summary = ?, updated_at = ? WHERE id = ?
  `).run(summary, now, id)
  return result.changes > 0
}

export function updateSuggestionStatus(id: number, status: Suggestion['status']): boolean {
  const now = Date.now()
  const processedAt = (status === 'completed' || status === 'rejected') ? now : null
  const result = db.prepare(`
    UPDATE suggestions SET status = ?, updated_at = ?, processed_at = COALESCE(?, processed_at) WHERE id = ?
  `).run(status, now, processedAt, id)
  return result.changes > 0
}

export function getSuggestionById(id: number): Suggestion | undefined {
  return db.prepare(`SELECT * FROM suggestions WHERE id = ?`).get(id) as Suggestion | undefined
}

export function getSuggestionList(options: { page?: number; pageSize?: number; status?: string }): SuggestionListResult {
  const { page = 1, pageSize = 20, status } = options
  const offset = (page - 1) * pageSize

  let countSql = `SELECT COUNT(*) as total FROM suggestions`
  let listSql = `
    SELECT s.*, 
      CASE WHEN s.submitter_type = 'registered' THEN '用户' ELSE '游客' END as submitter_label
    FROM suggestions s
  `
  const params: any[] = []

  if (status) {
    countSql += ` WHERE status = ?`
    listSql += ` WHERE s.status = ?`
    params.push(status)
  }

  listSql += ` ORDER BY s.created_at DESC LIMIT ? OFFSET ?`

  const total = (db.prepare(countSql).get(...params) as any).total
  const list = db.prepare(listSql).all(...params, pageSize, offset) as any[]

  return { list, total }
}

export function deleteSuggestion(id: number): boolean {
  const result = db.prepare(`DELETE FROM suggestions WHERE id = ?`).run(id)
  return result.changes > 0
}

export function getAdminSuggestionList(options: { page?: number; pageSize?: number; status?: string }): SuggestionListResult & { list: any[] } {
  const { page = 1, pageSize = 20, status } = options
  const offset = (page - 1) * pageSize

  let countSql = `SELECT COUNT(*) as total FROM suggestions`
  let listSql = `SELECT * FROM suggestions`
  const params: any[] = []

  if (status) {
    countSql += ` WHERE status = ?`
    listSql += ` WHERE status = ?`
    params.push(status)
  }

  listSql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`

  const total = (db.prepare(countSql).get(...params) as any).total
  const list = db.prepare(listSql).all(...params, pageSize, offset) as any[]

  return { list, total }
}
