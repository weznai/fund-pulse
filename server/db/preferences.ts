import db from './connection.js'
import { getCurrentUserId } from './connection.js'
import { getUserFunds, addUserFund } from './userFund.js'
import { getTradingDay } from './system.js'
import { logger } from '../logger.js'

export interface UserPreferences {
  userId: string
  favoriteFunds: string[]
  heldFunds: string[]
  hideAmount: boolean
  viewMode: 'grid' | 'list'
  sortField: string
  sortDirection: 'desc' | 'asc'
  filterMode: 'all' | 'held'
  migratedFromLocal: boolean
  lastUpdated: number
  tradingDay: string
}

export function getUserPreferences(): UserPreferences {
  const userId = getCurrentUserId().id
  const stmt = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?')
  const result = stmt.get(userId) as any

  const userFunds = getUserFunds()
  const favoriteFunds: string[] = []
  const heldFunds: string[] = []

  userFunds.forEach((fund, code) => {
    favoriteFunds.push(code)
    if (fund.isHeld) {
      heldFunds.push(code)
    }
  })

  if (result) {
    return {
      userId: result.user_id,
      favoriteFunds,
      heldFunds,
      hideAmount: Boolean(result.hide_amount),
      viewMode: result.view_mode || 'list',
      sortField: result.sort_field || 'dayGrowth',
      sortDirection: result.sort_direction || 'desc',
      filterMode: result.filter_mode || 'all',
      migratedFromLocal: Boolean(result.migrated_from_local),
      lastUpdated: result.last_updated,
      tradingDay: getTradingDay()
    }
  }

  return {
    userId,
    favoriteFunds,
    heldFunds,
    hideAmount: false,
    viewMode: 'list',
    sortField: 'dayGrowth',
    sortDirection: 'desc',
    filterMode: 'all',
    migratedFromLocal: false,
    lastUpdated: Date.now(),
    tradingDay: getTradingDay()
  }
}

export function saveUserPreferences(prefs: Partial<UserPreferences> & { userId?: string }): void {
  const userId = prefs.userId || getCurrentUserId().id
  const existing = getUserPreferences()

  const merged: UserPreferences = {
    ...existing,
    ...prefs,
    userId,
    lastUpdated: Date.now()
  }

  if (prefs.favoriteFunds !== undefined) {
    syncUserFundsFromPreferences(userId, merged.favoriteFunds, merged.heldFunds)
  }

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO user_preferences (
      user_id, favorite_funds, held_funds, hide_amount,
      view_mode, sort_field, sort_direction, filter_mode, migrated_from_local, last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    merged.userId,
    '[]',
    '[]',
    merged.hideAmount ? 1 : 0,
    merged.viewMode,
    merged.sortField,
    merged.sortDirection,
    merged.filterMode || 'all',
    merged.migratedFromLocal ? 1 : 0,
    merged.lastUpdated
  )

  logger.log('💾 用户偏好已保存')
}

function syncUserFundsFromPreferences(userId: string, favoriteFunds: string[], heldFunds: string[]): void {
  const now = Date.now()
  const existingFunds = getUserFunds()
  const existingCodes = new Set(existingFunds.keys())
  const newCodesSet = new Set(favoriteFunds)

  for (const code of favoriteFunds) {
    if (!existingCodes.has(code)) {
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO user_funds (user_id, fund_code, fund_name, is_held, share, cost, amount, added_at)
        VALUES (?, ?, '', ?, 0, 0, 0, ?)
      `)
      const isHeld = heldFunds.includes(code) ? 1 : 0
      stmt.run(userId, code, isHeld, now)
    } else {
      const isHeld = heldFunds.includes(code) ? 1 : 0
      const stmt = db.prepare(`UPDATE user_funds SET is_held = ? WHERE user_id = ? AND fund_code = ?`)
      stmt.run(isHeld, userId, code)
    }
  }

  for (const code of existingCodes) {
    if (!newCodesSet.has(code)) {
      const stmt = db.prepare(`DELETE FROM user_funds WHERE user_id = ? AND fund_code = ?`)
      stmt.run(userId, code)
    }
  }

  logger.log(`🔄 同步 user_funds 表: ${favoriteFunds.length} 只基金`)
}
