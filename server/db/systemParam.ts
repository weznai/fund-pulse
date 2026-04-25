import db from './connection.js'

export interface SystemParam {
  key: string
  value: string
  remark?: string
}

export function getSystemParam(key: string): string | null {
  const stmt = db.prepare('SELECT value FROM system_params WHERE key = ?')
  const result = stmt.get(key) as { value: string } | undefined
  return result?.value || null
}

export function setSystemParam(key: string, value: string, remark?: string): void {
  const stmt = db.prepare(`
    INSERT INTO system_params (key, value, remark)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = ?, remark = ?
  `)
  stmt.run(key, value, remark || null, value, remark || null)
}

export function deleteSystemParam(key: string): boolean {
  const stmt = db.prepare('DELETE FROM system_params WHERE key = ?')
  const result = stmt.run(key)
  return result.changes > 0
}

export function getAllSystemParams(): SystemParam[] {
  const stmt = db.prepare('SELECT * FROM system_params ORDER BY key')
  const results = stmt.all() as any[]
  return results.map(r => ({
    key: r.key,
    value: r.value,
    remark: r.remark || undefined
  }))
}

export function setSystemParams(params: Array<{ key: string; value: string; remark?: string }>): void {
  const stmt = db.prepare(`
    INSERT INTO system_params (key, value, remark)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = ?, remark = ?
  `)

  const setMany = db.transaction((items: typeof params) => {
    for (const p of items) {
      stmt.run(p.key, p.value, p.remark || null, p.value, p.remark || null)
    }
  })

  setMany(params)
}
