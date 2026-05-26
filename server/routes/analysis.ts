import { Router, Request, Response } from 'express'
import axios from 'axios'
import { logger } from '../logger.js'
import { checkUsageLimit, streamAnalysis } from '../services/analysisService.js'
import { getNavHistoryRange } from '../db/navHistory.js'
import { getFundHistory } from '../external/eastmoney.js'
import { getFundInfo } from '../db/fundInfo.js'
import { addOperationLog } from '../db/operationLog.js'
import { getCurrentUserId } from '../db/connection.js'
import { runStockAnalysis, AGENT_ORDER, AGENT_CONFIGS } from '../trade_agent/index.js'
import { getStockInfo } from '../trade_agent/data/eastmoneyStock.js'
import { ensureAnalysisUsageTable, getAnalysisUsage, incrementAnalysisUsage } from '../db/analysisUsage.js'

const router = Router()

router.get('/analysis/usage', (_req: Request, res: Response) => {
  try {
    const usage = checkUsageLimit()
    res.json(usage)
  } catch (error) {
    logger.error('获取分析使用情况失败:', error)
    res.status(500).json({ error: '获取使用情况失败' })
  }
})

router.post('/analysis/lookup', async (req: Request, res: Response) => {
  try {
    const { codes } = req.body
    if (!codes || !Array.isArray(codes)) return res.json([])

    const results: Array<{ code: string; name: string; type: string; found: boolean }> = []

    for (const code of codes) {
      const trimmed = String(code).trim()
      const local = getFundInfo(trimmed)
      logger.log(`[lookup] code=${trimmed}, local=${local ? local.name : 'null'}`)
      if (local) {
        results.push({ code: trimmed, name: local.name, type: local.ftype || '', found: true })
        continue
      }

      try {
        const resp = await axios.get('https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx', {
          params: { m: 1, key: trimmed, pagesize: 5, _: Date.now() },
          headers: { 'Referer': 'https://fund.eastmoney.com/' },
          timeout: 8000
        })
        const items = resp.data?.Datas || []
        const exact = items.find((item: any) => item.CODE === trimmed)
        if (exact) {
          results.push({ code: trimmed, name: exact.NAME, type: exact.FundBaseInfo?.FTYPE || '', found: true })
        } else if (items.length > 0) {
          const first = items[0]
          results.push({ code: first.CODE, name: first.NAME, type: first.FundBaseInfo?.FTYPE || '', found: true })
        } else {
          results.push({ code: trimmed, name: '', type: '', found: false })
        }
      } catch (e: any) {
        logger.error(`[lookup] code=${trimmed} eastmoney error:`, e?.message || e)
        results.push({ code: trimmed, name: '', type: '', found: false })
      }
    }

    res.json(results)
  } catch (error) {
    logger.error('基金查询失败:', error)
    res.status(500).json({ error: '查询失败' })
  }
})

function getStartDate(period: string): string {
  const now = new Date()
  const months = period === '1m' ? 1 : period === '3m' ? 3 : period === '6m' ? 6 : 12
  const start = new Date(now.getFullYear(), now.getMonth() - months, now.getDate())
  return start.toLocaleDateString('sv-SE')
}

router.post('/analysis/nav-history', async (req: Request, res: Response) => {
  try {
    const { codes, period } = req.body
    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return res.json({})
    }

    const startDate = getStartDate(period || '1m')
    const result: Record<string, { name: string; data: Array<{ date: string; nav: number; growth: number }> }> = {}

    for (const code of codes) {
      const fundInfo = getFundInfo(code)
      const name = fundInfo?.name || `基金${code}`

      let navData = getNavHistoryRange(code, startDate)
      if (navData.length < 5) {
        try {
          const months = period === '1m' ? '1' : period === '3m' ? '3' : period === '6m' ? '6' : '12'
          const history = await getFundHistory(code, months)
          navData = history.map(h => ({ date: h.date, nav: h.nav, growth: h.growth }))
        } catch {
          navData = []
        }
      }

      if (navData.length > 0) {
        result[code] = {
          name,
          data: navData.map(d => ({ date: d.date, nav: d.nav, growth: d.growth }))
        }
      }
    }

    res.json(result)
  } catch (error) {
    logger.error('获取净值历史失败:', error)
    res.status(500).json({ error: '获取数据失败' })
  }
})

router.post('/analysis/stream', async (req: Request, res: Response) => {
  try {
    const { codes, period } = req.body

    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return res.status(400).json({ error: '请选择至少一只基金' })
    }

    if (codes.length > 6) {
      return res.status(400).json({ error: '最多支持6只基金对比' })
    }

    const validPeriods = ['1m', '3m', '6m', '1y']
    if (!period || !validPeriods.includes(period)) {
      return res.status(400).json({ error: '无效的时间范围' })
    }

    const usage = checkUsageLimit()
    if (!usage.allowed) {
      return res.status(429).json({ error: '积分不足，无法进行分析', credits: usage.credits })
    }

    const userId = getCurrentUserId()
    const ip = req.headers['x-forwarded-for'] as string || req.headers['x-real-ip'] as string || req.ip || ''
    const cleanIp = ip.split(',')[0].trim()
    const username = userId.label || userId.id
    const isComparison = codes.length > 1
    const actionLabel = isComparison ? '多基金对比分析' : '基金分析'
    const periodLabel = period === '1m' ? '近1月' : period === '3m' ? '近3月' : '近1年'
    addOperationLog({
      username,
      ip: cleanIp,
      action: 'smart_analysis',
      description: `${actionLabel}: ${codes.join(',')}, 周期: ${periodLabel}`,
      extra: JSON.stringify({ codes, period, userType: usage.userType })
    })

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    await streamAnalysis(res, codes, period)
  } catch (error) {
    logger.error('分析请求失败:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: '分析服务异常' })
    } else {
      res.end()
    }
  }
})

// ===== Stock Analysis Endpoints =====

router.get('/analysis/stock/agents', (_req: Request, res: Response) => {
  try {
    const agents = AGENT_ORDER.map(name => {
      const config = AGENT_CONFIGS[name]
      return { name: config.name, label: config.label, phase: config.phase }
    })
    res.json({ agents })
  } catch (error) {
    logger.error('获取智能体列表失败:', error)
    res.status(500).json({ error: '获取智能体列表失败' })
  }
})

router.post('/analysis/stock/lookup', async (req: Request, res: Response) => {
  try {
    const { stockCode } = req.body
    if (!stockCode || typeof stockCode !== 'string') {
      return res.status(400).json({ error: '请提供股票代码' })
    }
    const code = stockCode.trim()
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: '股票代码格式不正确（6位数字）' })
    }

    const info = await getStockInfo(code)
    if (!info) {
      return res.json({ found: false, code })
    }
    res.json({
      found: true,
      code: info.code,
      name: info.name,
      industry: info.industry,
      price: info.price,
      change: info.change,
      marketCap: info.marketCap,
      pe: info.pe,
      pb: info.pb,
      totalShares: info.totalShares,
      floatShares: info.floatShares,
    })
  } catch (error) {
    logger.error('股票查询失败:', error)
    res.status(500).json({ error: '查询失败' })
  }
})

router.post('/analysis/stock/stream', async (req: Request, res: Response) => {
  try {
    const { stockCode } = req.body

    if (!stockCode || typeof stockCode !== 'string') {
      return res.status(400).json({ error: '请提供股票代码' })
    }

    const code = stockCode.trim()
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: '股票代码格式不正确（6位数字）' })
    }

    // Check usage limit (shares the same usage counter as fund analysis)
    ensureAnalysisUsageTable()
    const userId = getCurrentUserId()
    const userType = userId.type === 'registered' ? 'registered' as const : 'guest' as const
    const usage = getAnalysisUsage(userId.id, userType)
    if (usage.credits < 10) {
      return res.status(429).json({ error: '积分不足，无法进行股票分析（需要10积分）', credits: usage.credits })
    }

    // Log operation
    const ip = req.headers['x-forwarded-for'] as string || req.headers['x-real-ip'] as string || req.ip || ''
    const cleanIp = ip.split(',')[0].trim()
    const username = userId.label || userId.id
    addOperationLog({
      username,
      ip: cleanIp,
      action: 'stock_analysis',
      description: `股票智能分析: ${code}`,
      extra: JSON.stringify({ stockCode: code, userType })
    })

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    // Deduct credits and notify client
    const deductResult = incrementAnalysisUsage(userId.id, 10)
    res.write(`data: ${JSON.stringify({ type: 'usage', credits: deductResult.remaining })}\n\n`)

    // Run the multi-agent analysis pipeline
    await runStockAnalysis(res, code)
  } catch (error) {
    logger.error('股票分析请求失败:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: '分析服务异常' })
    } else {
      try {
        res.write(`data: ${JSON.stringify({ type: 'error', error: '分析服务异常' })}\n\n`)
      } catch { /* */ }
      res.end()
    }
  }
})

export default router
