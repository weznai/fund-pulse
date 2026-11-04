import db from './connection.js'
import { logger } from '../logger.js'

/**
 * 资讯文章表
 * status: 'draft' = 草稿, 'published' = 已发布
 * content_html 存整篇 HTML 文档（含样式），前端用 iframe srcdoc 渲染，样式天然隔离
 */
export function ensureNewsTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS news_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      content_html TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      pinned INTEGER NOT NULL DEFAULT 0,
      views INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_news_status ON news_articles (status)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_news_created ON news_articles (created_at)`)
}

export interface NewsArticle {
  id: number
  title: string
  summary: string
  content_html: string
  source: string
  status: 'draft' | 'published'
  pinned: number
  views: number
  created_at: string
  updated_at: string
}

export type NewsArticleSummary = Omit<NewsArticle, 'content_html'>

export interface NewsListQuery {
  page: number
  pageSize: number
  keyword?: string
  /** undefined = 全部（管理端）；'published' = 仅已发布（用户端） */
  status?: 'draft' | 'published'
  /** 列表默认不返回大字段 content_html */
  includeContent?: boolean
}

const SUMMARY_FIELDS = 'id, title, summary, source, status, pinned, views, created_at, updated_at'

export function getNewsList(query: NewsListQuery): { list: NewsArticleSummary[] | NewsArticle[]; total: number } {
  const conditions: string[] = []
  const params: any[] = []

  if (query.keyword) {
    conditions.push('(title LIKE ? OR summary LIKE ?)')
    params.push(`%${query.keyword}%`, `%${query.keyword}%`)
  }
  if (query.status) {
    conditions.push('status = ?')
    params.push(query.status)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM news_articles ${where}`).get(...params) as { total: number }

  const fields = query.includeContent ? '*' : SUMMARY_FIELDS
  const offset = (query.page - 1) * query.pageSize
  const list = db.prepare(
    `SELECT ${fields} FROM news_articles ${where} ORDER BY pinned DESC, created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, query.pageSize, offset)

  return { list: list as NewsArticleSummary[] | NewsArticle[], total: countRow.total }
}

export function getNewsById(id: number, opts?: { publishedOnly?: boolean }): NewsArticle | undefined {
  const where = opts?.publishedOnly ? 'WHERE id = ? AND status = \'published\'' : 'WHERE id = ?'
  return db.prepare(`SELECT * FROM news_articles ${where}`).get(id) as NewsArticle | undefined
}

export function incrementNewsViews(id: number): void {
  db.prepare('UPDATE news_articles SET views = views + 1 WHERE id = ?').run(id)
}

export interface NewsInput {
  title: string
  summary?: string
  content_html: string
  source?: string
  status?: 'draft' | 'published'
  pinned?: boolean
}

export function createNews(data: NewsInput): number {
  const result = db.prepare(
    `INSERT INTO news_articles (title, summary, content_html, source, status, pinned)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    data.title,
    data.summary || '',
    data.content_html,
    data.source || '',
    data.status || 'draft',
    data.pinned ? 1 : 0
  )
  logger.log(`[资讯] 新建文章: ${data.title} (#${result.lastInsertRowid})`)
  return result.lastInsertRowid as number
}

export function updateNews(id: number, data: Partial<NewsInput>): NewsArticle | null {
  const existing = getNewsById(id)
  if (!existing) return null

  const sets: string[] = []
  const params: any[] = []

  if (data.title !== undefined) { sets.push('title = ?'); params.push(data.title) }
  if (data.summary !== undefined) { sets.push('summary = ?'); params.push(data.summary) }
  if (data.content_html !== undefined) { sets.push('content_html = ?'); params.push(data.content_html) }
  if (data.source !== undefined) { sets.push('source = ?'); params.push(data.source) }
  if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status) }
  if (data.pinned !== undefined) { sets.push('pinned = ?'); params.push(data.pinned ? 1 : 0) }

  if (sets.length > 0) {
    sets.push("updated_at = datetime('now', 'localtime')")
    db.prepare(`UPDATE news_articles SET ${sets.join(', ')} WHERE id = ?`).run(...params, id)
  }
  return getNewsById(id) || null
}

export function setNewsStatus(id: number, status: 'draft' | 'published'): NewsArticle | null {
  return updateNews(id, { status })
}

export function deleteNewsById(id: number): NewsArticle | null {
  const existing = getNewsById(id)
  if (!existing) return null
  db.prepare('DELETE FROM news_articles WHERE id = ?').run(id)
  logger.log(`[资讯] 删除文章: ${existing.title} (#${id})`)
  return existing
}

export function deleteNewsBatch(ids: number[]): { deleted: number; notFound: number[] } {
  let deleted = 0
  const notFound: number[] = []
  const deleteMany = db.transaction((idList: number[]) => {
    for (const id of idList) {
      const info = db.prepare('DELETE FROM news_articles WHERE id = ?').run(id)
      if (info.changes > 0) {
        deleted++
      } else {
        notFound.push(id)
      }
    }
  })
  deleteMany(ids)
  logger.log(`[资讯] 批量删除: 成功 ${deleted}/${ids.length}`)
  return { deleted, notFound }
}

export function getNewsStats(): { total: number; published: number; draft: number } {
  const total = (db.prepare('SELECT COUNT(*) as cnt FROM news_articles').get() as { cnt: number }).cnt
  const published = (db.prepare("SELECT COUNT(*) as cnt FROM news_articles WHERE status = 'published'").get() as { cnt: number }).cnt
  return { total, published, draft: total - published }
}
