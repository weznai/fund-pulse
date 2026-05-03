import { Router, Request, Response } from 'express'
import { logger } from '../logger.js'
import {
  getLocalDate, getCurrentUserId, setCurrentUserId, userContext,
  updateHoldingCurrentProfit, settleHoldingProfit,
  getHoldingProfitHistory, getHoldingProfitStats, getAllProfitHistory,
  getHeldFundTotalAmount, executeBatchSettlement, getUnsettledHoldings,
  getUserIdFromClientId, getHeldFunds, getGlobalEstimateCache, getLatestGlobalEstimateCache,
  getDailyProfit, getDailyProfitByDateRange, getLatestDailyProfit, getDailyProfitSummaries
} from '../db/index.js'
import { getClientUserId, isRegisteredUser } from '../middleware/userSession.js'
import { checkTradingDay } from '../services/holidayService.js'

const router = Router()

router.post('/:code/profit', (req: Request, res: Response) => {
  try {
    const { code } = req.params
    const { currentProfit, profitRate, profitType } = req.body

    updateHoldingCurrentProfit(
      code,
      req.body.fundName || '',
      currentProfit || 0,
      profitRate || 0,
      profitType || 'estimate'
    )

    res.json({ success: true })
  } catch (error) {
    logger.error('更新持仓收益失败:', error)
    res.status(500).json({ error: '更新持仓收益失败' })
  }
})

router.post('/:code/settle', (req: Request, res: Response) => {
  try {
    const { code } = req.params
    const { nav, dayGrowth } = req.body

    const result = settleHoldingProfit(code, { nav, dayGrowth })
    res.json(result)
  } catch (error) {
    logger.error('持仓结算失败:', error)
    res.status(500).json({ error: '持仓结算失败' })
  }
})

router.get('/:code/profit-history', (req: Request, res: Response) => {
  try {
    const { code } = req.params
    const { userId, isNew } = getClientUserId(req)
    if (isNew || !isRegisteredUser(userId)) {
      res.json([])
      return
    }
    setCurrentUserId(userId)
    const history = getHoldingProfitHistory(code)
    res.json(history)
  } catch (error) {
    logger.error('获取持仓收益历史失败:', error)
    res.status(500).json({ error: '获取持仓收益历史失败' })
  }
})

router.get('/profit-stats', (req: Request, res: Response) => {
  try {
    const { code } = req.query
    const { userId, isNew } = getClientUserId(req)
    if (isNew || !isRegisteredUser(userId)) {
      res.json({ totalProfit: 0, totalProfitRate: 0, settledDays: 0, historyRecords: 0 })
      return
    }
    setCurrentUserId(userId)
    const stats = getHoldingProfitStats(code as string)
    res.json(stats)
  } catch (error) {
    logger.error('获取持仓收益统计失败:', error)
    res.status(500).json({ error: '获取持仓收益统计失败' })
  }
})

router.get('/profit-analysis', (req: Request, res: Response) => {
  try {
    const { userId, isNew } = getClientUserId(req)
    if (isNew || !isRegisteredUser(userId)) {
      res.json({ loggedIn: false })
      return
    }

    setCurrentUserId(userId)
    const history = getAllProfitHistory()
    const totalHoldingAmount = getHeldFundTotalAmount()
    const today = getLocalDate()
    const todayIsTradingDay = checkTradingDay(today)

    const holdings = getHeldFunds()
    let todayProfit = 0
    let todayProfitRate = 0
    let todayProfitCount = 0

    for (const [code, fund] of holdings) {
      if (!fund.amount || fund.amount <= 0) continue

      const alreadyInHistory = history.some(h => h.profitDate === today && h.fundCode === code)
      if (alreadyInHistory) continue

      let growth: number | null = null
      const cached = getGlobalEstimateCache(code, today)
      if (cached) {
        if (cached.isUpdated && cached.dayGrowth != null) {
          growth = cached.dayGrowth
        } else if (cached.gszzl != null) {
          growth = cached.gszzl
        } else if (cached.dayGrowth != null) {
          growth = cached.dayGrowth
        }
      }

      if (growth === null) {
        const latestCached = getLatestGlobalEstimateCache(code, today)
        if (latestCached) {
          if (latestCached.isUpdated && latestCached.dayGrowth != null) {
            growth = latestCached.dayGrowth
          } else if (latestCached.gszzl != null) {
            growth = latestCached.gszzl
          } else if (latestCached.dayGrowth != null) {
            growth = latestCached.dayGrowth
          }
        }
      }

      if (growth === null) continue

      const profit = Math.round(fund.amount * (growth / 100) * 100) / 100
      todayProfit += profit
      todayProfitRate += growth
      todayProfitCount++

      history.unshift({
        profitDate: today,
        fundCode: code,
        fundName: fund.fundName,
        dayProfit: profit,
        dayProfitRate: Math.round(growth * 100) / 100,
        openingAmount: fund.amount,
        closingAmount: Math.round((fund.amount + profit) * 100) / 100
      })
    }

    res.json({ loggedIn: true, history, totalHoldingAmount, todayIsTradingDay })
  } catch (error) {
    logger.error('获取收益分析失败:', error)
    res.status(500).json({ error: '获取收益分析失败' })
  }
})

router.post('/settle-batch', (req: Request, res: Response) => {
  try {
    const { userId } = getClientUserId(req)
    setCurrentUserId(userId)
    logger.log(`🔄 结算请求: userId=${userId.id}`)

    const result = executeBatchSettlement()
    logger.log(`✅ 结算完成: processed=${result.processed}, profits=${result.profits.length}`)
    res.json({
      success: true,
      message: `批量结算完成`,
      ...result
    })
  } catch (error) {
    logger.error('批量持仓结算失败:', error)
    res.status(500).json({ error: '批量持仓结算失败' })
  }
})

router.get('/unsettled', (req: Request, res: Response) => {
  try {
    const { userId } = getClientUserId(req)
    setCurrentUserId(userId)
    const targetDate = getLocalDate()
    const unsettled = getUnsettledHoldings(targetDate)

    res.json({
      userId: userId.id,
      targetDate,
      unsettledCount: unsettled.length,
      holdings: unsettled
    })
  } catch (error) {
    res.status(500).json({ error: String(error) })
  }
})

router.get('/timeshare', (req: Request, res: Response) => {
  try {
    const { userId, isNew } = getClientUserId(req)
    if (isNew || !isRegisteredUser(userId)) {
      return res.json({ loggedIn: false })
    }

    setCurrentUserId(userId)
    const today = getLocalDate()

    const holdings = getHeldFunds()
    
    if (holdings.size === 0) {
      return res.json({ 
        loggedIn: true, 
        hasData: false,
        message: '暂无持仓基金'
      })
    }

    const timePoints = [
      '09:30', '09:35', '09:40', '09:45', '09:50', '09:55',
      '10:00', '10:05', '10:10', '10:15', '10:20', '10:25', '10:30', '10:35', '10:40', '10:45', '10:50', '10:55',
      '11:00', '11:05', '11:10', '11:15', '11:20', '11:25', '11:30',
      '13:00', '13:05', '13:10', '13:15', '13:20', '13:25', '13:30', '13:35', '13:40', '13:45', '13:50', '13:55',
      '14:00', '14:05', '14:10', '14:15', '14:20', '14:25', '14:30', '14:35', '14:40', '14:45', '14:50', '14:55', '15:00',
      '15:05', '15:10', '15:15', '15:20', '15:25', '15:30', '15:35', '15:40', '15:45', '15:50', '15:55', '16:00'
    ]
    
    let totalAmount = 0
    let totalProfit = 0
    const timeMap = new Map<string, { weightedPercent: number; totalWeight: number }>()
    let effectiveDate = today

    for (const [code, fund] of holdings) {
      if (!fund.amount || fund.amount <= 0) continue

      if (fund.settled && fund.currentDayProfit != null) {
        totalProfit += fund.currentDayProfit
      }

      const weight = (fund.currentDayProfit != null && fund.settled)
        ? fund.amount - fund.currentDayProfit
        : fund.amount
      
      let cached = getGlobalEstimateCache(code, today)
      
      if (!cached || !cached.data) {
        cached = getLatestGlobalEstimateCache(code, today)
      }
      if (!cached || !cached.data) {
        cached = getLatestGlobalEstimateCache(code)
      }
      
      if (!cached) continue
      
      if (cached.date && cached.date !== today) {
        if (effectiveDate === today) {
          effectiveDate = cached.date
        }
      }
      
      let timeshare: Array<{ time: string; value: number; percent: number }> = []
      let finalPercent = cached.dayGrowth ?? cached.gszzl ?? 0
      
      if (cached.data) {
        try {
          const parsedData = JSON.parse(cached.data)
          if (Array.isArray(parsedData) && parsedData.length > 0) {
            timeshare = parsedData
            
            const lastPoint = parsedData[parsedData.length - 1]
            if (lastPoint && typeof lastPoint.percent === 'number') {
              finalPercent = lastPoint.percent
            }
          }
        } catch {
        }
      }
      
      const filledTimeshare: Array<{ time: string; percent: number }> = []
      const dataMap = new Map<string, number>()
      
      for (const point of timeshare) {
        dataMap.set(point.time, point.percent)
      }
      
      let lastValidPercent: number | null = null
      let firstValidIndex = -1
      
      for (let i = 0; i < timePoints.length; i++) {
        const time = timePoints[i]
        if (dataMap.has(time)) {
          firstValidIndex = i
          lastValidPercent = dataMap.get(time)!
          break
        }
      }
      
      if (firstValidIndex === -1) {
        for (const time of timePoints) {
          filledTimeshare.push({ time, percent: finalPercent })
        }
      } else {
        for (let i = 0; i < firstValidIndex; i++) {
          filledTimeshare.push({ time: timePoints[i], percent: lastValidPercent! })
        }
        
        for (let i = firstValidIndex; i < timePoints.length; i++) {
          const time = timePoints[i]
          
          if (dataMap.has(time)) {
            lastValidPercent = dataMap.get(time)!
            filledTimeshare.push({ time, percent: lastValidPercent })
          } else {
            let nextValidPercent: number | null = null
            let nextValidIndex = -1
            
            for (let j = i + 1; j < timePoints.length; j++) {
              if (dataMap.has(timePoints[j])) {
                nextValidPercent = dataMap.get(timePoints[j])!
                nextValidIndex = j
                break
              }
            }
            
            if (nextValidPercent !== null && lastValidPercent !== null) {
              const prevIndex = filledTimeshare.length - 1
              const totalSteps = nextValidIndex - prevIndex
              const currentStep = i - prevIndex
              const interpolated = lastValidPercent + (nextValidPercent - lastValidPercent) * (currentStep / totalSteps)
              filledTimeshare.push({ time, percent: Math.round(interpolated * 100) / 100 })
            } else {
              filledTimeshare.push({ time, percent: lastValidPercent ?? finalPercent })
            }
          }
        }
      }
      
      totalAmount += fund.amount
      
      for (const point of filledTimeshare) {
        const existing = timeMap.get(point.time) || { weightedPercent: 0, totalWeight: 0 }
        existing.weightedPercent += point.percent * weight
        existing.totalWeight += weight
        timeMap.set(point.time, existing)
      }
    }

    if (totalAmount === 0) {
      return res.json({
        loggedIn: true,
        hasData: false,
        message: '暂无分时数据'
      })
    }

    const weightedTimeshare = Array.from(timeMap.entries())
      .map(([time, data]) => ({
        time,
        percent: Math.round((data.weightedPercent / data.totalWeight) * 100) / 100
      }))
      .sort((a, b) => a.time.localeCompare(b.time))

    const actualRate = totalProfit !== 0
      ? Math.round(totalProfit / (totalAmount - totalProfit) * 10000) / 100
      : 0

    if (weightedTimeshare.length > 0 && actualRate !== 0) {
      weightedTimeshare[weightedTimeshare.length - 1] = {
        ...weightedTimeshare[weightedTimeshare.length - 1],
        percent: actualRate
      }
    }

    res.json({
      loggedIn: true,
      hasData: true,
      timeshare: weightedTimeshare,
      date: effectiveDate,
      isHistory: effectiveDate !== today,
      fundCount: holdings.size,
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      actualRate
    })
  } catch (error) {
    logger.error('获取持仓分时数据失败:', error)
    res.status(500).json({ error: '获取持仓分时数据失败' })
  }
})

router.get('/daily-profit', (req: Request, res: Response) => {
  try {
    const { userId, isNew } = getClientUserId(req)
    if (isNew || !isRegisteredUser(userId)) {
      return res.json({ loggedIn: false })
    }

    setCurrentUserId(userId)
    const date = req.query.date as string | undefined

    const record = getDailyProfit(date)

    if (!record) {
      return res.json({ loggedIn: true, hasData: false, message: '暂无分时收益数据' })
    }

    res.json({
      loggedIn: true,
      hasData: true,
      data: {
        profitDate: record.profitDate,
        openingAmount: record.openingAmount,
        timeProfitData: record.timeProfitData,
        finalRate: record.finalRate,
        finalProfit: record.finalProfit,
        finalAmount: record.finalAmount,
        settled: record.settled
      }
    })
  } catch (error) {
    logger.error('获取每日分时收益失败:', error)
    res.status(500).json({ error: '获取每日分时收益失败' })
  }
})

router.get('/daily-profit/history', (req: Request, res: Response) => {
  try {
    const { userId, isNew } = getClientUserId(req)
    if (isNew || !isRegisteredUser(userId)) {
      return res.json({ loggedIn: false })
    }

    setCurrentUserId(userId)
    const startDate = req.query.startDate as string
    const endDate = req.query.endDate as string

    if (!startDate || !endDate) {
      return res.status(400).json({ error: '需要 startDate 和 endDate 参数' })
    }

    const records = getDailyProfitByDateRange(startDate, endDate)

    res.json({
      loggedIn: true,
      hasData: records.length > 0,
      data: records.map(r => ({
        profitDate: r.profitDate,
        openingAmount: r.openingAmount,
        timeProfitData: r.timeProfitData,
        finalRate: r.finalRate,
        finalProfit: r.finalProfit,
        finalAmount: r.finalAmount,
        settled: r.settled
      }))
    })
  } catch (error) {
    logger.error('获取历史分时收益失败:', error)
    res.status(500).json({ error: '获取历史分时收益失败' })
  }
})

router.get('/daily-profit/profit-trend', (req: Request, res: Response) => {
  try {
    const { userId, isNew } = getClientUserId(req)
    if (isNew || !isRegisteredUser(userId)) {
      return res.json({ loggedIn: false })
    }

    setCurrentUserId(userId)
    const period = (req.query.period as string) || 'year'
    const today = getLocalDate()

    let startDate: string
    let endDate: string = today

    const now = new Date()
    switch (period) {
      case 'month': {
        startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
        break
      }
      case 'year': {
        startDate = `${now.getFullYear()}-01-01`
        break
      }
      case 'all': {
        startDate = '2000-01-01'
        break
      }
      default: {
        startDate = `${now.getFullYear()}-01-01`
        break
      }
    }

    const summaries = getDailyProfitSummaries(startDate, endDate)

    res.json({
      loggedIn: true,
      hasData: summaries.length > 0,
      period,
      data: summaries
    })
  } catch (error) {
    logger.error('获取收益走势数据失败:', error)
    res.status(500).json({ error: '获取收益走势数据失败' })
  }
})

export default router
