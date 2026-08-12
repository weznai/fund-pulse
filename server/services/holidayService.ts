import { Router, Request, Response, NextFunction } from 'express'
import { logger } from '../logger.js'
import { fetchHolidaysFromCDN, parseCDNDataToHolidays } from '../external/holiday.js'
import {
  getHolidaysByYear,
  getAllHolidays,
  upsertHolidays,
  deleteHolidaysByYear,
  getHolidayYears,
  getHolidayStats,
  isHoliday,
  isTradingDay,
  initHolidaysTable
} from '../db/holiday.js'

const tradingDayCache = new Map<string, boolean>()

export function checkTradingDay(date: string): boolean {
  const cached = tradingDayCache.get(date)
  if (cached !== undefined) return cached
  const result = isTradingDay(date)
  tradingDayCache.set(date, result)
  return result
}

// 同步指定年份的节假日数据（从 CDN 抓取并写入数据库）
// 供路由和 CLI 共用，单个年份失败不影响其他年份
async function syncYears(years: number[]): Promise<{ count: number; errors: string[] }> {
  let totalCount = 0
  const errors: string[] = []

  for (const year of years) {
    try {
      const cdnData = await fetchHolidaysFromCDN(year)
      if (!cdnData) {
        errors.push(year + ': fetch failed')
        continue
      }

      const holidays = parseCDNDataToHolidays(cdnData, year)
      if (holidays.length === 0) {
        errors.push(year + ': parse failed')
        continue
      }

      const count = upsertHolidays(holidays)
      totalCount += count
      logger.log('[Holiday] Sync ' + year + ': ' + count + ' records')
    } catch (e: any) {
      errors.push(year + ': ' + e.message)
    }
  }

  return { count: totalCount, errors }
}

export function setupHolidayRoutes(validateAdminToken: (req: Request, res: Response, next: NextFunction) => void) {
  const router = Router()

  router.get('/stats', validateAdminToken, (req, res) => {
    try {
      const stats = getHolidayStats()
      res.json(stats)
    } catch (error) {
      logger.error('Get holiday stats failed:', error)
      res.status(500).json({ error: 'Get stats failed' })
    }
  })

  router.get('/years', validateAdminToken, (req, res) => {
    try {
      const years = getHolidayYears()
      res.json(years)
    } catch (error) {
      logger.error('Get years failed:', error)
      res.status(500).json({ error: 'Get years failed' })
    }
  })

  router.get('/:year', validateAdminToken, (req, res) => {
    try {
      const year = parseInt(req.params.year)
      if (isNaN(year)) {
        return res.status(400).json({ error: 'Invalid year' })
      }
      const holidays = getHolidaysByYear(year)
      res.json(holidays)
    } catch (error) {
      logger.error('Get holidays failed:', error)
      res.status(500).json({ error: 'Get holidays failed' })
    }
  })

  router.get('/', validateAdminToken, (req, res) => {
    try {
      const holidays = getAllHolidays()
      res.json(holidays)
    } catch (error) {
      logger.error('Get all holidays failed:', error)
      res.status(500).json({ error: 'Get all holidays failed' })
    }
  })

  router.post('/sync/:year', validateAdminToken, async (req, res) => {
    try {
      const year = parseInt(req.params.year)
      if (isNaN(year)) {
        return res.status(400).json({ error: 'Invalid year' })
      }

      const { count, errors } = await syncYears([year])
      if (errors.length > 0) {
        return res.status(500).json({ error: errors[0] })
      }
      res.json({ success: true, count, message: 'Sync ' + count + ' records' })
    } catch (error) {
      logger.error('Sync holiday failed:', error)
      res.status(500).json({ error: 'Sync failed' })
    }
  })

  router.post('/sync-batch', validateAdminToken, async (req, res) => {
    try {
      const currentYear = new Date().getFullYear()
      const years = req.body.years || [currentYear - 1, currentYear, currentYear + 1, currentYear + 2]

      const { count, errors } = await syncYears(years)
      res.json({
        success: true,
        count,
        errors: errors.length > 0 ? errors : undefined,
        message: 'Sync ' + count + ' records' + (errors.length > 0 ? ', ' + errors.length + ' failed' : '')
      })
    } catch (error) {
      logger.error('Batch sync failed:', error)
      res.status(500).json({ error: 'Batch sync failed' })
    }
  })

  router.delete('/:year', validateAdminToken, (req, res) => {
    try {
      const year = parseInt(req.params.year)
      if (isNaN(year)) {
        return res.status(400).json({ error: 'Invalid year' })
      }

      const count = deleteHolidaysByYear(year)
      logger.log('[Holiday] Delete ' + year + ': ' + count + ' records')
      res.json({ success: true, count })
    } catch (error) {
      logger.error('Delete holiday failed:', error)
      res.status(500).json({ error: 'Delete failed' })
    }
  })

  return router
}

export function setupPublicHolidayRoutes() {
  const publicRouter = Router()

  publicRouter.get('/is-trading-day/:date', (req, res) => {
    try {
      const { date } = req.params
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'Invalid date format' })
      }
      const result = checkTradingDay(date)
      res.json({ date, isTradingDay: result })
    } catch (error) {
      logger.error('Check trading day failed:', error)
      res.status(500).json({ error: 'Check trading day failed' })
    }
  })

  publicRouter.get('/check/:date', (req, res) => {
    try {
      const { date } = req.params
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'Invalid date format' })
      }
      const holiday = isHoliday(date)
      res.json({ date, holiday })
    } catch (error) {
      logger.error('Check holiday failed:', error)
      res.status(500).json({ error: 'Check holiday failed' })
    }
  })

  return publicRouter
}

// CLI 入口：独立运行同步节假日数据
// 用法：tsx server/service/syncHolidays.ts
// 同步范围：去年、今年、明年、后年
export async function runSyncCli() {
  initHolidaysTable()
  const currentYear = new Date().getFullYear()
  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2]

  logger.log('Syncing holidays for years:', years.join(', '))
  const { count, errors } = await syncYears(years)

  logger.log('=== Summary ===')
  logger.log('Total synced:', count, 'records')
  if (errors.length > 0) {
    logger.log('Errors:', errors.length)
    errors.forEach(e => logger.log('  -', e))
  }

  logger.log('=== Current Stats ===')
  const stats = getHolidayStats()
  logger.log('Stats:', stats)
}
