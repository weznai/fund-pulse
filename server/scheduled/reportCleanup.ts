import { logger } from '../logger.js'
import { deleteExpiredReports } from '../db/report.js'
import { deleteReportFile, cleanupEmptyDirs } from '../services/reportService.js'

let cleanupTimer: ReturnType<typeof setInterval> | null = null

export function startReportCleanup(): void {
  runCleanup()

  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 3, 0, 0)
  const delay = next.getTime() - now.getTime()

  setTimeout(() => {
    runCleanup()
    cleanupTimer = setInterval(runCleanup, 24 * 60 * 60 * 1000)
  }, delay)

  logger.log('⏰ 报告清理定时任务已启动（每天凌晨3点执行）')
}

export function stopReportCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
  }
}

function runCleanup(): void {
  try {
    const result = deleteExpiredReports()
    for (const report of result.reports) {
      deleteReportFile(report.file_path)
    }
    cleanupEmptyDirs()
    if (result.deleted > 0) {
      logger.log(`[reportCleanup] 已自动清理 ${result.deleted} 个过期报告`)
    }
  } catch (err) {
    logger.error('[reportCleanup] 清理过期报告失败:', err)
  }
}
