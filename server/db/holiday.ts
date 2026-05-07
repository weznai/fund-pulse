import db from './connection.js'

export interface Holiday {
  id?: number
  year: number
  date: string
  name: string
  type: 'holiday' | 'workday' | 'inLieuDay'
  created_at?: number
  updated_at?: number
}

export function initHolidaysTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      date TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_holidays_year ON holidays(year)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date)`)
}

export function getHolidaysByYear(year: number): Holiday[] {
  const stmt = db.prepare('SELECT * FROM holidays WHERE year = ? ORDER BY date ASC')
  const rows = stmt.all(year) as any[]
  return rows.map(row => ({
    id: row.id,
    year: row.year,
    date: row.date,
    name: row.name,
    type: row.type,
    created_at: row.created_at,
    updated_at: row.updated_at
  }))
}

export function getAllHolidays(): Holiday[] {
  const stmt = db.prepare('SELECT * FROM holidays ORDER BY year DESC, date ASC')
  const rows = stmt.all() as any[]
  return rows.map(row => ({
    id: row.id,
    year: row.year,
    date: row.date,
    name: row.name,
    type: row.type,
    created_at: row.created_at,
    updated_at: row.updated_at
  }))
}

export function upsertHolidays(holidays: Omit<Holiday, 'id' | 'created_at' | 'updated_at'>[]): number {
  const now = Date.now()
  const stmt = db.prepare(`
    INSERT INTO holidays (year, date, name, type, created_at, updated_at)
    VALUES (@year, @date, @name, @type, @now, @now)
    ON CONFLICT(date) DO UPDATE SET
      year = excluded.year,
      name = excluded.name,
      type = excluded.type,
      updated_at = excluded.updated_at
  `)
  
  const insertMany = db.transaction((items: any[]) => {
    for (const item of items) {
      stmt.run({ ...item, now })
    }
  })
  
  insertMany(holidays as any[])
  return holidays.length
}

export function deleteHolidaysByYear(year: number): number {
  const stmt = db.prepare('DELETE FROM holidays WHERE year = ?')
  const result = stmt.run(year)
  return result.changes
}

export function getHolidayYears(): number[] {
  const stmt = db.prepare('SELECT DISTINCT year FROM holidays ORDER BY year DESC')
  const rows = stmt.all() as { year: number }[]
  return rows.map(row => row.year)
}

export function getHolidayStats(): { year: number; holiday: number; workday: number; inLieuDay: number }[] {
  const stmt = db.prepare(`
    SELECT year, type, COUNT(*) as count 
    FROM holidays 
    GROUP BY year, type
  `)
  const rows = stmt.all() as { year: number; type: string; count: number }[]
  
  const statsMap = new Map<number, { year: number; holiday: number; workday: number; inLieuDay: number }>()
  
  for (const row of rows) {
    let stat = statsMap.get(row.year)
    if (!stat) {
      stat = { year: row.year, holiday: 0, workday: 0, inLieuDay: 0 }
      statsMap.set(row.year, stat)
    }
    if (row.type === 'holiday') stat.holiday = row.count
    else if (row.type === 'workday') stat.workday = row.count
    else if (row.type === 'inLieuDay') stat.inLieuDay = row.count
  }
  
  return Array.from(statsMap.values()).sort((a, b) => b.year - a.year)
}

export function isHoliday(date: string): Holiday | null {
  const stmt = db.prepare('SELECT * FROM holidays WHERE date = ?')
  const row = stmt.get(date) as any
  if (!row) return null
  return {
    id: row.id,
    year: row.year,
    date: row.date,
    name: row.name,
    type: row.type
  }
}

export function isTradingDay(date: string): boolean {
  const d = new Date(date)
  const dayOfWeek = d.getDay()
  const holiday = isHoliday(date)

  if (holiday) {
    return holiday.type === 'workday'
  }

  return dayOfWeek !== 0 && dayOfWeek !== 6
}
