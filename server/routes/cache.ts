import { Router, Request, Response } from 'express'
import { logger } from '../logger.js'
import { getCacheStats, getGlobalCacheStats, clearAllCache } from '../db/index.js'

const router = Router()

router.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = getCacheStats()
    res.json(stats)
  } catch (error) {
    logger.error('获取缓存统计失败:', error)
    res.status(500).json({ error: '获取缓存统计失败' })
  }
})

router.get('/global/stats', (req: Request, res: Response) => {
  try {
    const globalStats = getGlobalCacheStats()
    res.json(globalStats)
  } catch (error) {
    logger.error('获取全局缓存统计失败:', error)
    res.status(500).json({ error: '获取全局缓存统计失败' })
  }
})

router.delete('/all', (req: Request, res: Response) => {
  try {
    clearAllCache()
    res.json({ success: true, message: '已清空所有缓存' })
  } catch (error) {
    logger.error('清空缓存失败:', error)
    res.status(500).json({ error: '清空缓存失败' })
  }
})

export default router
