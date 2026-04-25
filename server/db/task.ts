import db from './connection.js'
import { logger } from '../logger.js'

export type TaskType = 'settlement' | 'sync' | 'backup' | 'cleanup'
export type TaskStatus = 'pending' | 'running' | 'completed' | 'terminated'

export interface Task {
  id?: number
  taskName: string
  taskType: TaskType
  taskDate: string
  status: TaskStatus
  startTime?: number
  endTime?: number
  description?: string
  executeCount: number
  createdAt: number
  updatedAt: number
}

export function ensureTasksTable(): void {
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='fund_tasks'
  `).get() as { name: string } | undefined

  if (!tableExists) {
    logger.log('Creating fund_tasks table...')
    db.exec(`
      CREATE TABLE fund_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_name TEXT NOT NULL,
        task_type TEXT NOT NULL DEFAULT 'settlement',
        task_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        start_time INTEGER,
        end_time INTEGER,
        description TEXT,
        execute_count INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)
    db.exec('CREATE INDEX IF NOT EXISTS idx_fund_tasks_date ON fund_tasks(task_date)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_fund_tasks_status ON fund_tasks(status)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_fund_tasks_type ON fund_tasks(task_type)')
    logger.log('fund_tasks table created')
  }
}

export function createTask(task: {
  taskName: string
  taskType: TaskType
  taskDate: string
}): Task {
  const now = Date.now()
  const stmt = db.prepare(`
    INSERT INTO fund_tasks (task_name, task_type, task_date, status, execute_count, created_at, updated_at)
    VALUES (?, ?, ?, 'pending', 0, ?, ?)
  `)
  const result = stmt.run(task.taskName, task.taskType, task.taskDate, now, now)

  const created: Task = {
    id: result.lastInsertRowid as number,
    taskName: task.taskName,
    taskType: task.taskType,
    taskDate: task.taskDate,
    status: 'pending',
    executeCount: 0,
    createdAt: now,
    updatedAt: now
  }

  logger.log(`Task created: ${task.taskName} (${task.taskDate}, type: ${task.taskType})`)
  return created
}

export function getTask(taskDate: string, taskType: TaskType): Task | null {
  const stmt = db.prepare(`
    SELECT * FROM fund_tasks WHERE task_date = ? AND task_type = ?
  `)
  const result = stmt.get(taskDate, taskType) as any

  if (result) {
    return {
      id: result.id,
      taskName: result.task_name,
      taskType: result.task_type,
      taskDate: result.task_date,
      status: result.status,
      startTime: result.start_time,
      endTime: result.end_time,
      description: result.description,
      executeCount: result.execute_count,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    }
  }
  return null
}

export function getActiveTask(taskDate: string, taskType: TaskType): Task | null {
  const stmt = db.prepare(`
    SELECT * FROM fund_tasks
    WHERE task_date = ? AND task_type = ? AND status IN ('pending', 'running')
  `)
  const result = stmt.get(taskDate, taskType) as any

  if (result) {
    return {
      id: result.id,
      taskName: result.task_name,
      taskType: result.task_type,
      taskDate: result.task_date,
      status: result.status,
      startTime: result.start_time,
      endTime: result.end_time,
      description: result.description,
      executeCount: result.execute_count,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    }
  }
  return null
}

export function updateTask(id: number, updates: {
  status?: TaskStatus
  startTime?: number
  endTime?: number
  description?: string
}): boolean {
  const now = Date.now()
  const fields: string[] = ['updated_at = ?']
  const values: any[] = [now]

  if (updates.status !== undefined) {
    fields.push('status = ?')
    values.push(updates.status)
  }
  if (updates.startTime !== undefined) {
    fields.push('start_time = ?')
    values.push(updates.startTime)
  }
  if (updates.endTime !== undefined) {
    fields.push('end_time = ?')
    values.push(updates.endTime)
  }
  if (updates.description !== undefined) {
    fields.push('description = ?')
    values.push(updates.description)
  }

  values.push(id)
  const stmt = db.prepare(`UPDATE fund_tasks SET ${fields.join(', ')} WHERE id = ?`)
  const result = stmt.run(...values)

  return result.changes > 0
}

export function incrementTaskExecuteCount(id: number): number {
  const now = Date.now()
  const stmt = db.prepare(`
    UPDATE fund_tasks
    SET execute_count = execute_count + 1, updated_at = ?
    WHERE id = ?
  `)
  stmt.run(now, id)

  const task = db.prepare('SELECT execute_count FROM fund_tasks WHERE id = ?').get(id) as any
  return task ? task.execute_count : 0
}

export function getTaskList(options: {
  limit?: number
  offset?: number
  taskType?: TaskType
  status?: TaskStatus
  taskDate?: string
} = {}): { tasks: Task[]; total: number } {
  ensureTasksTable()
  const { limit = 20, offset = 0, taskType, status, taskDate } = options

  let whereClauses: string[] = []
  let params: any[] = []

  if (taskType) {
    whereClauses.push('task_type = ?')
    params.push(taskType)
  }
  if (status) {
    whereClauses.push('status = ?')
    params.push(status)
  }
  if (taskDate) {
    whereClauses.push('task_date = ?')
    params.push(taskDate)
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM fund_tasks ${whereClause}`)
  const countResult = countStmt.get(...params) as { total: number }
  const total = countResult.total

  const listStmt = db.prepare(`
    SELECT * FROM fund_tasks ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `)
  const results = listStmt.all(...params, limit, offset) as any[]

  const tasks: Task[] = results.map(row => ({
    id: row.id,
    taskName: row.task_name,
    taskType: row.task_type,
    taskDate: row.task_date,
    status: row.status,
    startTime: row.start_time,
    endTime: row.end_time,
    description: row.description,
    executeCount: row.execute_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))

  return { tasks, total }
}

export function getTaskById(id: number): Task | null {
  const stmt = db.prepare('SELECT * FROM fund_tasks WHERE id = ?')
  const result = stmt.get(id) as any

  if (result) {
    return {
      id: result.id,
      taskName: result.task_name,
      taskType: result.task_type,
      taskDate: result.task_date,
      status: result.status,
      startTime: result.start_time,
      endTime: result.end_time,
      description: result.description,
      executeCount: result.execute_count,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    }
  }
  return null
}
