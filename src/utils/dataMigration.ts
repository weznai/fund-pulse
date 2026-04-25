import type { StoredTempHolding } from '@/types/tempHolding'
import { isLegacyHolding, upgradeLegacyHolding } from '@/types/tempHolding'

/**
 * 数据迁移脚本
 *
 * 用于升级旧的临时客户数据到新的数据结构
 * 这个脚本只在客户端运行，不影响后端数据库
 */

const STORAGE_KEY = 'fund_holdings'
const STORAGE_VERSION_KEY = 'fund_holdings_version'
const CURRENT_VERSION = 'v2'

/**
 * 检查是否需要升级数据
 */
export function needsMigration(): boolean {
  const currentVersion = localStorage.getItem(STORAGE_VERSION_KEY)
  return currentVersion !== CURRENT_VERSION
}

/**
 * 执行数据迁移
 *
 * 返回升级的持仓数量
 */
export function migrateHoldings(): { upgraded: number; errors: string[] } {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    // 没有旧数据，标记为当前版本
    localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION)
    return { upgraded: 0, errors: [] }
  }

  try {
    const data = JSON.parse(raw)
    const entries = Object.entries(data)

    if (entries.length === 0) {
      localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION)
      return { upgraded: 0, errors: [] }
    }

    const upgradedData: Record<string, StoredTempHolding> = {}
    let upgradedCount = 0
    const errors: string[] = []

    for (const [code, holding] of entries) {
      try {
        // 检查是否为旧版本数据
        if (isLegacyHolding(holding)) {
          upgradedData[code] = upgradeLegacyHolding(holding)
          upgradedCount++
        } else {
          // 已经是新版本数据，直接保留
          upgradedData[code] = holding as StoredTempHolding
        }
      } catch (error) {
        errors.push(`迁移 ${code} 失败: ${error}`)
        // 保留旧数据，不删除
        upgradedData[code] = holding as StoredTempHolding
      }
    }

    // 保存升级后的数据
    localStorage.setItem(STORAGE_KEY, JSON.stringify(upgradedData))
    localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION)

    console.log(`✅ 数据迁移完成: 升级 ${upgradedCount} 条持仓，${errors.length} 个错误`)

    return { upgraded: upgradedCount, errors }
  } catch (error) {
    const errorMsg = `数据迁移失败: ${error}`
    console.error(errorMsg, error)
    return { upgraded: 0, errors: [errorMsg] }
  }
}

/**
 * 回滚迁移（保留旧版本数据）
 *
 * 注意：这个函数只在紧急情况下使用
 */
export function rollbackMigration(): boolean {
  try {
    const backupKey = `${STORAGE_KEY}_backup_${Date.now()}`
    const raw = localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      console.warn('没有数据可以回滚')
      return false
    }

    // 备份当前数据
    localStorage.setItem(backupKey, raw)

    // 移除版本标记，下次会重新检测
    localStorage.removeItem(STORAGE_VERSION_KEY)

    console.log(`⚠️ 已回滚迁移，备份保存在 ${backupKey}`)
    return true
  } catch (error) {
    console.error('回滚失败:', error)
    return false
  }
}
