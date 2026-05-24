import { Router, Request, Response } from 'express'
import { logger } from '../logger.js'
import {
  ensureSuggestionsTable,
  createSuggestion,
  getSuggestionList,
  getAdminSuggestionList,
  getSuggestionById,
  updateSuggestionStatus,
  deleteSuggestion
} from '../db/suggestion.js'
import { generateSuggestionSummary } from '../services/suggestionService.js'
import { validateAdminToken } from '../middleware/auth.js'

const router = Router()

function parseIntSafe(value: unknown, defaultValue: number, min = 1, max?: number): number {
  const num = parseInt(String(value), 10)
  if (isNaN(num)) return defaultValue
  if (num < min) return defaultValue
  if (max !== undefined && num > max) return defaultValue
  return num
}

router.post('/suggestions', (req: Request, res: Response) => {
  try {
    ensureSuggestionsTable()
    const { content } = req.body

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: '请输入建议或问题内容' })
    }

    if (content.length > 500) {
      return res.status(400).json({ error: '内容不能超过500字' })
    }

    const suggestion = createSuggestion(content.trim())

    generateSuggestionSummary(suggestion.id, content.trim()).catch(err => {
      logger.error(`异步摘要生成异常 #${suggestion.id}:`, err)
    })

    res.json({ success: true, suggestion })
  } catch (error) {
    logger.error('创建建议失败:', error)
    res.status(500).json({ error: '提交失败，请稍后重试' })
  }
})

router.get('/suggestions', (req: Request, res: Response) => {
  try {
    ensureSuggestionsTable()
    const page = parseIntSafe(req.query.page, 1, 1)
    const pageSize = parseIntSafe(req.query.pageSize, 10, 1, 50)
    const status = req.query.status as string | undefined

    const result = getSuggestionList({ page, pageSize, status })
    res.json(result)
  } catch (error) {
    logger.error('获取建议列表失败:', error)
    res.status(500).json({ error: '获取列表失败' })
  }
})

router.get('/admin/suggestions', validateAdminToken, (req: Request, res: Response) => {
  try {
    ensureSuggestionsTable()
    const page = parseIntSafe(req.query.page, 1, 1)
    const pageSize = parseIntSafe(req.query.pageSize, 20, 1, 100)
    const status = req.query.status as string | undefined

    const result = getAdminSuggestionList({ page, pageSize, status })
    res.json(result)
  } catch (error) {
    logger.error('管理端获取建议列表失败:', error)
    res.status(500).json({ error: '获取列表失败' })
  }
})

router.put('/admin/suggestions/:id/status', validateAdminToken, (req: Request, res: Response) => {
  try {
    ensureSuggestionsTable()
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      return res.status(400).json({ error: '无效的建议ID' })
    }

    const { status } = req.body
    if (!status || !['pending', 'processing', 'completed', 'rejected'].includes(status)) {
      return res.status(400).json({ error: '无效的状态值' })
    }

    const suggestion = getSuggestionById(id)
    if (!suggestion) {
      return res.status(404).json({ error: '建议不存在' })
    }

    const success = updateSuggestionStatus(id, status as any)
    res.json({ success })
  } catch (error) {
    logger.error('更新建议状态失败:', error)
    res.status(500).json({ error: '更新失败' })
  }
})

router.delete('/admin/suggestions/:id', validateAdminToken, (req: Request, res: Response) => {
  try {
    ensureSuggestionsTable()
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      return res.status(400).json({ error: '无效的建议ID' })
    }

    const suggestion = getSuggestionById(id)
    if (!suggestion) {
      return res.status(404).json({ error: '建议不存在' })
    }

    const success = deleteSuggestion(id)
    res.json({ success })
  } catch (error) {
    logger.error('删除建议失败:', error)
    res.status(500).json({ error: '删除失败' })
  }
})

export default router
