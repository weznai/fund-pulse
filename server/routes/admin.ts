import { Router, Request, Response } from 'express'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { logger } from '../logger.js'
import {
  UserIdType, UserId, getCurrentUserId, userContext, getUserIdFromClientId,
  getAllUsers, getUserFunds, getHoldings, getUserPreferences,
  getLocalDate, settleHoldingProfit, updateSettlementStatus,
  resetFundTodayStatus,
  updateUserLabel, isUserLabelExists,
  getSystemParam, getAllSystemParams, setSystemParam, deleteSystemParam,
  getFundInfo, getFundInfoList, saveFundInfo, updateFundInfoField, updateFundInfoRecommend,
  deleteFundInfo, batchSaveFundInfo, getAllFundInfoCodes,
  ensureVisitLogsTable, getVisitStats, migrateStatsToDatabase,
  getVisitLogs, getIpStats, deleteVisitLogsByIps, deleteVisitLogsByUserIds,
  getTaskList, createTask, updateTask, getTaskById,
  setUserDisabled,
  TaskType, TaskStatus,
  FundInfo,
  getOperationLogList,
  getProviders, getProviderById, addProvider, updateProvider, deleteProvider,
  getModelsByProvider, getAllModels, addModel, updateModel, deleteModel,
  getSceneMappings, setSceneMapping
} from '../db/index.js'
import { setRegisteredUser } from '../db/index.js'
import db from '../db/index.js'
import { fetchFundDetailFromApi, fetchFundBasicInfoFromSearchApi } from '../services/fundService.js'
import { validateAdminToken, handleAdminLogin } from '../middleware/auth.js'
import { manualSettlement } from '../scheduled/settlement.js'
import { refreshFundToday } from '../scheduled/estimate.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()

function syncUserFundsName(code: string, name: string): void {
  if (!name) return
  const stmt = db.prepare(
    `UPDATE user_funds SET fund_name = ? WHERE fund_code = ? AND (fund_name IS NULL OR fund_name = '' OR fund_name = fund_code)`
  )
  const result = stmt.run(name, code)
  if (result.changes > 0) {
    logger.log(`同步 user_funds 名称: ${code} -> ${name}, 更新 ${result.changes} 条`)
  }
}

function fixAllUserFundsNames(): number {
  const rows = db.prepare(
    `SELECT uf.fund_code, fi.name FROM user_funds uf
     JOIN fund_info fi ON uf.fund_code = fi.code
     WHERE uf.fund_name IS NULL OR uf.fund_name = '' OR uf.fund_name = uf.fund_code`
  ).all() as { fund_code: string; name: string }[]
  if (rows.length === 0) return 0
  const stmt = db.prepare('UPDATE user_funds SET fund_name = ? WHERE fund_code = ? AND (fund_name IS NULL OR fund_name = \'\' OR fund_name = fund_code)')
  let count = 0
  for (const row of rows) {
    const result = stmt.run(row.name, row.fund_code)
    count += result.changes
  }
  logger.log(`修复 user_funds 名称: 共 ${count} 条`)
  return count
}

function parseIntSafe(value: unknown, defaultValue: number, min = 1, max?: number): number {
  const num = parseInt(String(value), 10)
  if (isNaN(num)) return defaultValue
  if (num < min) return defaultValue
  if (max !== undefined && num > max) return defaultValue
  return num
}

function parseString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function parseOptionalInt(value: unknown, min = 0, max = 1): number | undefined {
  if (typeof value !== 'string') return undefined
  const num = parseInt(value, 10)
  if (isNaN(num)) return undefined
  if (num < min || num > max) return undefined
  return num
}

router.post('/login', handleAdminLogin)

router.get('/visit-stats', validateAdminToken, (req: Request, res: Response) => {
  ensureVisitLogsTable()
  const visitStats = getVisitStats()
  res.json(visitStats)
})

router.post('/migrate-stats', validateAdminToken, (req: Request, res: Response) => {
  try {
    const statsFile = path.join(__dirname, '..', 'stats.json')

    if (!fs.existsSync(statsFile)) {
      res.status(400).json({ error: 'stats.json 文件不存在' })
      return
    }

    const statsData = JSON.parse(fs.readFileSync(statsFile, 'utf-8'))
    const result = migrateStatsToDatabase(statsData)

    res.json({
      success: true,
      message: `迁移完成: ${result.migrated} 条记录, 跳过 ${result.skipped} 条`,
      ...result
    })
  } catch (error) {
    logger.error('迁移访问数据失败:', error)
    res.status(500).json({ error: '迁移失败' })
  }
})

router.get('/visit-logs', validateAdminToken, (req: Request, res: Response) => {
  try {
    const page = parseIntSafe(req.query.page, 1, 1)
    const pageSize = parseIntSafe(req.query.pageSize, 20, 1, 100)
    const date = parseString(req.query.date)
    const ip = parseString(req.query.ip)

    const result = getVisitLogs({ page, pageSize, date, ip })
    res.json(result)
  } catch (error) {
    logger.error('获取访问日志失败:', error)
    res.status(500).json({ error: '获取访问日志失败' })
  }
})

router.get('/ip-stats', validateAdminToken, (req: Request, res: Response) => {
  try {
    const date = req.query.date as string | undefined
    const limit = parseInt(req.query.limit as string) || 20

    const stats = getIpStats({ date, limit })
    res.json(stats)
  } catch (error) {
    logger.error('获取IP统计失败:', error)
    res.status(500).json({ error: '获取IP统计失败' })
  }
})

router.post('/clean-visit-ips', validateAdminToken, (req: Request, res: Response) => {
  try {
    const paramValue = getSystemParam('delete_visit_ip')
    if (!paramValue) {
      return res.status(400).json({ error: '参数表未配置 delete_visit_ip' })
    }

    const ips = paramValue.split(/[,\|\t]+/).map((ip: string) => ip.trim()).filter((ip: string) => ip.length > 0)
    if (ips.length === 0) {
      return res.status(400).json({ error: '未指定有效的IP地址' })
    }

    const deleted = deleteVisitLogsByIps(ips)
    res.json({ success: true, deleted, ips })
  } catch (error) {
    logger.error('清理访问IP失败:', error)
    res.status(500).json({ error: '清理访问IP失败' })
  }
})

router.post('/clean-visit-users', validateAdminToken, (req: Request, res: Response) => {
  try {
    const paramValue = getSystemParam('delete_visit_user')
    if (!paramValue) {
      return res.status(400).json({ error: '参数表未配置 delete_visit_user' })
    }

    const userIds = paramValue.split(/[,\|\t]+/).map((s: string) => s.trim()).filter((s: string) => s.length > 0)
    if (userIds.length === 0) {
      return res.status(400).json({ error: '未指定有效的用户名' })
    }

    const deleted = deleteVisitLogsByUserIds(userIds)
    res.json({ success: true, deleted, userIds })
  } catch (error) {
    logger.error('清理访问用户失败:', error)
    res.status(500).json({ error: '清理访问用户失败' })
  }
})

router.get('/ip-info/:ip', validateAdminToken, async (req: Request, res: Response) => {
  try {
    const ip = req.params.ip
    const response = await axios.get(`http://ip-api.com/json/${ip}?lang=zh-CN&fields=status,message,country,regionName,city,isp,org,as,proxy,hosting`)
    res.json(response.data)
  } catch (error) {
    logger.error('查询IP信息失败:', error)
    res.status(500).json({ error: '查询IP信息失败' })
  }
})

router.get('/system-params', validateAdminToken, (req: Request, res: Response) => {
  try {
    const params = getAllSystemParams()
    res.json(params)
  } catch (error) {
    logger.error('获取系统参数失败:', error)
    res.status(500).json({ error: '获取系统参数失败' })
  }
})

router.get('/system-params/:key', validateAdminToken, (req: Request, res: Response) => {
  try {
    const value = getSystemParam(req.params.key)
    if (value === null) {
      return res.status(404).json({ error: '参数不存在' })
    }
    res.json({ key: req.params.key, value })
  } catch (error) {
    logger.error('获取系统参数失败:', error)
    res.status(500).json({ error: '获取系统参数失败' })
  }
})

router.post('/system-params', validateAdminToken, (req: Request, res: Response) => {
  try {
    const { key, value, remark } = req.body
    if (!key || value === undefined) {
      return res.status(400).json({ error: '缺少参数' })
    }
    setSystemParam(key, value, remark)
    res.json({ success: true })
  } catch (error) {
    logger.error('设置系统参数失败:', error)
    res.status(500).json({ error: '设置系统参数失败' })
  }
})

router.delete('/system-params/:key', validateAdminToken, (req: Request, res: Response) => {
  try {
    const deleted = deleteSystemParam(req.params.key)
    if (!deleted) {
      return res.status(404).json({ error: '参数不存在' })
    }
    res.json({ success: true })
  } catch (error) {
    logger.error('删除系统参数失败:', error)
    res.status(500).json({ error: '删除系统参数失败' })
  }
})

router.get('/tasks', validateAdminToken, (req: Request, res: Response) => {
  try {
    const limit = parseIntSafe(req.query.limit, 20, 1, 500)
    const offset = parseIntSafe(req.query.offset, 0, 0, 1000)
    const taskType = req.query.taskType as TaskType | undefined
    const status = req.query.status as TaskStatus | undefined
    const taskDate = parseString(req.query.taskDate)

    const result = getTaskList({ limit, offset, taskType, status, taskDate })
    res.json(result)
  } catch (error) {
    logger.error('获取任务列表失败:', error)
    res.status(500).json({ error: '获取任务列表失败' })
  }
})

router.post('/tasks/:id/run', validateAdminToken, async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.id)
    if (isNaN(taskId)) {
      return res.status(400).json({ error: '无效的任务ID' })
    }

    const task = getTaskById(taskId)
    if (!task) {
      return res.status(404).json({ error: '任务不存在' })
    }

    if (task.status === 'running') {
      return res.status(400).json({ error: '任务正在执行中' })
    }

    updateTask(taskId, { status: 'running', startTime: Date.now() })

    if (task.taskType === 'settlement') {
      const result = await manualSettlement(task.taskDate)
      updateTask(taskId, {
        status: 'completed',
        endTime: Date.now(),
        description: `Settled ${result.settled} funds`
      })
      res.json({ success: true, message: `结算完成，共处理 ${result.settled} 个基金`, result })
    } else {
      res.status(400).json({ error: '不支持的任务类型' })
    }
  } catch (error) {
    logger.error('手动执行任务失败:', error)
    res.status(500).json({ error: '手动执行任务失败' })
  }
})

router.post('/tasks', validateAdminToken, (req: Request, res: Response) => {
  try {
    const { taskName, taskType, taskDate } = req.body

    if (!taskName || !taskDate) {
      return res.status(400).json({ error: '缺少必要参数' })
    }

    const task = createTask({
      taskName,
      taskType: taskType || 'settlement',
      taskDate
    })

    res.json({ success: true, task })
  } catch (error) {
    logger.error('创建任务失败:', error)
    res.status(500).json({ error: '创建任务失败' })
  }
})

router.post('/tasks/:id/terminate', validateAdminToken, (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.id)
    if (isNaN(taskId)) {
      return res.status(400).json({ error: '无效的任务ID' })
    }

    const updated = updateTask(taskId, {
      status: 'terminated',
      endTime: Date.now()
    })

    if (!updated) {
      return res.status(404).json({ error: '任务不存在' })
    }

    res.json({ success: true })
  } catch (error) {
    logger.error('终止任务失败:', error)
    res.status(500).json({ error: '终止任务失败' })
  }
})

router.get('/users', validateAdminToken, (req: Request, res: Response) => {
  try {
    const users = getAllUsers()

    const usersWithStats = users.map(user => {
      try {
        const targetUserId: UserId = {
          id: user.id,
          type: UserIdType.REGISTERED,
          label: user.label || undefined
        }
        const result = userContext.run(targetUserId, () => {
          const userFunds = getUserFunds()
          const holdings = getHoldings()

          let favoriteCount = 0
          let heldCount = 0
          userFunds.forEach((fund) => {
            favoriteCount++
            if (fund.isHeld) heldCount++
          })

          return {
            id: user.id,
            type: user.type,
            email: user.email,
            label: user.label,
            disabled: Boolean(user.disabled),
            createdAt: user.created_at,
            lastActive: user.last_active,
            favoriteCount,
            heldCount,
            holdingCount: holdings.size
          }
        })
        return result
      } catch (err) {
        logger.error(`处理用户 ${user.id} 统计失败:`, err)
        return {
          id: user.id,
          type: user.type,
          email: user.email,
          label: user.label,
          disabled: Boolean(user.disabled),
          createdAt: user.created_at,
          lastActive: user.last_active,
          favoriteCount: 0,
          heldCount: 0,
          holdingCount: 0
        }
      }
    })

    res.json(usersWithStats)
  } catch (error) {
    logger.error('获取用户列表失败:', error)
    res.status(500).json({ error: '获取用户列表失败' })
  }
})

router.get('/users/:userId/holdings', validateAdminToken, (req: Request, res: Response) => {
  try {
    const { userId } = req.params
    logger.log(`[获取用户持仓] 接收到的 userId: ${userId}`)
    
    const targetUserId = getUserIdFromClientId(userId) || getCurrentUserId()
    logger.log(`[获取用户持仓] 解析后的 targetUserId:`, targetUserId)

    const holdings = userContext.run(targetUserId, () => {
      const holdingsMap = getHoldings()
      logger.log(`[获取用户持仓] 查询到的持仓数量: ${holdingsMap.size}`)
      return Array.from(holdingsMap.values())
    })

    res.json(holdings)
  } catch (error) {
    logger.error('获取用户持仓失败:', error)
    res.status(500).json({ error: '获取用户持仓失败' })
  }
})

router.get('/users/:userId/preferences', validateAdminToken, (req: Request, res: Response) => {
  try {
    const { userId } = req.params
    const targetUserId = getUserIdFromClientId(userId) || getCurrentUserId()

    const prefs = userContext.run(targetUserId, () => {
      return getUserPreferences()
    })

    res.json(prefs)
  } catch (error) {
    logger.error('获取用户偏好失败:', error)
    res.status(500).json({ error: '获取用户偏好失败' })
  }
})

router.post('/users/:userId/holdings/:fundCode/settle', validateAdminToken, (req: Request, res: Response) => {
  try {
    const { userId, fundCode } = req.params
    const settleDate = (req.body as { date?: string }).date || getLocalDate()
    const targetUserId = getUserIdFromClientId(userId) || getCurrentUserId()

    const result = userContext.run(targetUserId, () => {
      const fundData = db.prepare(`
        SELECT nav, day_growth FROM fund_time_trend
        WHERE code = ? AND date = ?
      `).get(fundCode, settleDate) as { nav: number; day_growth: number } | undefined

      if (!fundData || fundData.nav === null || fundData.day_growth === null) {
        return { noData: true }
      }

      const settleResult = settleHoldingProfit(fundCode, { nav: fundData.nav, dayGrowth: fundData.day_growth }, { settleDate })

      if (settleResult.settled) {
        updateSettlementStatus(fundCode, settleDate, 1)
      }

      return { ...settleResult, noData: false }
    })

    if (result.noData) {
      res.status(400).json({ error: `${settleDate} 净值数据不存在，无法结算` })
      return
    }

    res.json({ success: true, ...result })
  } catch (error) {
    logger.error('管理端单基金结算失败:', error)
    res.status(500).json({ error: '结算失败' })
  }
})

router.post('/funds/:fundCode/refresh-today', validateAdminToken, async (req: Request, res: Response) => {
  try {
    const { fundCode } = req.params
    const targetDate = (req.body as { date?: string }).date || getLocalDate()

    const users = getAllUsers()
    let resetCount = 0
    for (const user of users) {
      const targetUserId: UserId = {
        id: user.id,
        type: UserIdType.REGISTERED,
        label: user.label || undefined
      }
      userContext.run(targetUserId, () => {
        const stmt = db.prepare(`
          UPDATE user_funds SET settled = 0
          WHERE fund_code = ? AND is_held = 1 AND amount > 0
            AND (settle_date = ? OR settle_date IS NULL)
        `)
        const result = stmt.run(fundCode, targetDate)
        resetCount += result.changes
      })
    }

    resetFundTodayStatus(fundCode, targetDate)
    logger.log(`🔄 刷新 ${fundCode} (${targetDate}): 重置 ${resetCount} 个用户持仓状态`)

    const refreshResult = await refreshFundToday(fundCode, targetDate)
    res.json(refreshResult)
  } catch (error) {
    logger.error('刷新基金数据失败:', error)
    res.status(500).json({ error: '刷新失败' })
  }
})

router.get('/users/:userId/funds', validateAdminToken, (req: Request, res: Response) => {
  try {
    const { userId } = req.params
    const targetUserId = getUserIdFromClientId(userId) || getCurrentUserId()

    const fundsArray = userContext.run(targetUserId, () => {
      const fundsMap = getUserFunds()
      return Array.from(fundsMap.values())
    })

    res.json(fundsArray)
  } catch (error) {
    logger.error('获取用户基金失败:', error)
    res.status(500).json({ error: '获取用户基金失败' })
  }
})

router.put('/users/:userId/label', validateAdminToken, (req: Request, res: Response) => {
  try {
    const { userId } = req.params
    const { label } = req.body

    if (typeof label !== 'string') {
      return res.status(400).json({ error: '用户名格式错误' })
    }

    if (label && label.trim()) {
      if (isUserLabelExists(label, userId)) {
        return res.status(400).json({ error: '用户名已存在' })
      }
    }

    const success = updateUserLabel(userId, label)
    if (success) {
      res.json({ success: true, label: label?.trim() || null })
    } else {
      res.status(404).json({ error: '用户不存在' })
    }
  } catch (error) {
    logger.error('更新用户名失败:', error)
    res.status(500).json({ error: '更新用户名失败' })
  }
})

router.put('/users/:userId/disabled', validateAdminToken, (req: Request, res: Response) => {
  try {
    const { userId } = req.params
    const { disabled } = req.body

    if (typeof disabled !== 'boolean') {
      return res.status(400).json({ error: '参数格式错误' })
    }

    const success = setUserDisabled(userId, disabled)
    if (success) {
      res.json({ success: true, disabled })
    } else {
      res.status(404).json({ error: '用户不存在' })
    }
  } catch (error) {
    logger.error('更新用户状态失败:', error)
    res.status(500).json({ error: '更新用户状态失败' })
  }
})

router.get('/fund-info', validateAdminToken, (req: Request, res: Response) => {
  try {
    const { keyword, ftype, isRecommend, page, pageSize } = req.query

    const result = getFundInfoList({
      keyword: keyword as string,
      ftype: ftype as string,
      isRecommend: parseOptionalInt(isRecommend, 0, 1),
      page: page ? parseIntSafe(page, 1, 1) : undefined,
      pageSize: pageSize ? parseIntSafe(pageSize, 20, 1, 100) : undefined
    })

    res.json(result)
  } catch (error) {
    logger.error('获取基金列表失败:', error)
    res.status(500).json({ error: '获取基金列表失败' })
  }
})

router.get('/fund-info/:code', validateAdminToken, (req: Request, res: Response) => {
  try {
    const fund = getFundInfo(req.params.code)
    if (!fund) {
      return res.status(404).json({ error: '基金不存在' })
    }
    res.json(fund)
  } catch (error) {
    logger.error('获取基金详情失败:', error)
    res.status(500).json({ error: '获取基金详情失败' })
  }
})

router.post('/fund-info', validateAdminToken, async (req: Request, res: Response) => {
  try {
    const { code, name, pinyin, ftype, fund_company, fund_manager, establish_date, fund_scale, benchmark } = req.body

    if (!code || !name) {
      return res.status(400).json({ error: '缺少基金代码或名称' })
    }

    let fundData: Partial<FundInfo> & { code: string; name: string } = { code, name }

    const detail = await fetchFundDetailFromApi(code)
    if (detail) {
      fundData = {
        ...fundData,
        name: detail.name || name,
        pinyin: pinyin || detail.pinyin,
        ftype: ftype || detail.ftype,
        fund_company: fund_company || detail.fund_company,
        fund_manager: fund_manager || detail.fund_manager,
        establish_date: establish_date || detail.establish_date,
        fund_scale: fund_scale || detail.fund_scale,
        benchmark: benchmark || detail.benchmark
      }
    }

    const success = saveFundInfo(fundData)
    res.json({ success, fund: getFundInfo(code) })
  } catch (error) {
    logger.error('添加基金失败:', error)
    res.status(500).json({ error: '添加基金失败' })
  }
})

router.post('/fund-info/batch', validateAdminToken, async (req: Request, res: Response) => {
  try {
    const { codes } = req.body as { codes: string[] }
    logger.log(`[批量导入] 收到请求, codes: ${JSON.stringify(codes)}`)

    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return res.status(400).json({ error: '缺少基金代码列表' })
    }

    const validCodes = codes.filter(code => /^\d{6}$/.test(code))
    logger.log(`[批量导入] 有效代码: ${validCodes.join(', ')}`)
    if (validCodes.length === 0) {
      return res.status(400).json({ error: '没有有效的基金代码' })
    }

    const funds: Array<Partial<FundInfo> & { code: string; name: string }> = []

    for (const code of validCodes) {
      logger.log(`[批量导入] 正在获取 ${code} 详情...`)
      const detail = await fetchFundDetailFromApi(code)
      logger.log(`[批量导入] ${code} 详情结果: ${JSON.stringify(detail)}`)
      if (detail && detail.name) {
        funds.push({
          code,
          name: detail.name,
          ftype: detail.ftype,
          fund_company: detail.fund_company,
          fund_manager: detail.fund_manager,
          establish_date: detail.establish_date,
          fund_scale: detail.fund_scale,
          benchmark: detail.benchmark
        })
      } else {
        const basicInfo = await fetchFundBasicInfoFromSearchApi(code)
        if (basicInfo && basicInfo.name) {
          funds.push({
            code: basicInfo.code,
            name: basicInfo.name,
            ftype: basicInfo.ftype
          })
        } else {
          logger.log(`[批量导入] ${code} 获取详情失败，跳过`)
        }
      }
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    logger.log(`[批量导入] 获取到 ${funds.length} 只基金详情，准备写入数据库`)
    logger.log(`[批量导入] funds: ${JSON.stringify(funds)}`)
    const imported = batchSaveFundInfo(funds)
    logger.log(`[批量导入] 写入完成，成功 ${imported} 条`)
    res.json({ success: true, imported, total: validCodes.length, fetched: funds.length })
  } catch (error: any) {
    logger.error('[批量导入] 失败:', error)
    logger.error('[批量导入] 错误堆栈:', error?.stack)
    res.status(500).json({ error: '批量导入失败: ' + (error?.message || error) })
  }
})

router.put('/fund-info/:code/recommend', validateAdminToken, (req: Request, res: Response) => {
  try {
    const { is_recommend } = req.body
    const success = updateFundInfoRecommend(req.params.code, is_recommend ? 1 : 0)
    if (!success) {
      return res.status(404).json({ error: '基金不存在' })
    }
    res.json({ success: true })
  } catch (error) {
    logger.error('更新推荐状态失败:', error)
    res.status(500).json({ error: '更新推荐状态失败' })
  }
})

router.put('/fund-info/batch-recommend', validateAdminToken, (req: Request, res: Response) => {
  try {
    const { codes, is_recommend } = req.body as { codes: string[]; is_recommend: number }

    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return res.status(400).json({ error: '缺少基金代码列表' })
    }

    let successCount = 0
    for (const code of codes) {
      const success = updateFundInfoRecommend(code, is_recommend ? 1 : 0)
      if (success) successCount++
    }

    res.json({ success: true, updated: successCount, total: codes.length })
  } catch (error) {
    logger.error('批量更新推荐状态失败:', error)
    res.status(500).json({ error: '批量更新推荐状态失败' })
  }
})

router.post('/fund-info/:code/sync', validateAdminToken, async (req: Request, res: Response) => {
  try {
    const code = req.params.code
    const existing = getFundInfo(code)
    if (!existing) {
      return res.status(404).json({ error: '基金不存在' })
    }

    let detail: any = await fetchFundDetailFromApi(code)

    if (!detail || !detail.name) {
      const basicInfo = await fetchFundBasicInfoFromSearchApi(code)
      if (basicInfo && basicInfo.name) {
        detail = basicInfo
      } else {
        return res.status(400).json({ error: '未获取到基金详情' })
      }
    }

    const fundData: Partial<FundInfo> & { code: string; name: string } = {
      code,
      name: detail.name,
      ftype: detail.ftype,
      fund_company: detail.fund_company,
      fund_manager: detail.fund_manager,
      establish_date: detail.establish_date,
      fund_scale: detail.fund_scale,
      benchmark: detail.benchmark,
      is_recommend: existing.is_recommend
    }

    saveFundInfo(fundData, true)
    syncUserFundsName(code, fundData.name)
    const updatedFund = getFundInfo(code)
    res.json({ success: true, fund: updatedFund })
  } catch (error) {
    logger.error('同步基金失败:', error)
    res.status(500).json({ error: '同步基金失败' })
  }
})

router.put('/fund-info/:code', validateAdminToken, (req: Request, res: Response) => {
  try {
    const code = req.params.code
    const existing = getFundInfo(code)
    if (!existing) {
      return res.status(404).json({ error: '基金不存在' })
    }
    const { data_source, data_extra, ftype, fund_company, fund_manager, benchmark } = req.body
    const fields: Record<string, any> = {}
    if (data_source !== undefined) fields.data_source = data_source
    if (data_extra !== undefined) fields.data_extra = data_extra
    if (ftype !== undefined) fields.ftype = ftype
    if (fund_company !== undefined) fields.fund_company = fund_company
    if (fund_manager !== undefined) fields.fund_manager = fund_manager
    if (benchmark !== undefined) fields.benchmark = benchmark
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: '没有需要更新的字段' })
    }
    updateFundInfoField(code, fields)
    const updated = getFundInfo(code)
    res.json({ success: true, fund: updated })
  } catch (error) {
    logger.error('更新基金失败:', error)
    res.status(500).json({ error: '更新基金失败' })
  }
})

router.delete('/fund-info/:code', validateAdminToken, (req: Request, res: Response) => {
  try {
    const success = deleteFundInfo(req.params.code)
    if (!success) {
      return res.status(404).json({ error: '基金不存在' })
    }
    res.json({ success: true })
  } catch (error) {
    logger.error('删除基金失败:', error)
    res.status(500).json({ error: '删除基金失败' })
  }
})

router.post('/fund-info/batch-delete', validateAdminToken, (req: Request, res: Response) => {
  try {
    const { codes } = req.body as { codes: string[] }

    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return res.status(400).json({ error: '缺少基金代码列表' })
    }

    let deletedCount = 0
    for (const code of codes) {
      const success = deleteFundInfo(code)
      if (success) deletedCount++
    }

    res.json({ success: true, deleted: deletedCount, total: codes.length })
  } catch (error) {
    logger.error('批量删除基金失败:', error)
    res.status(500).json({ error: '批量删除基金失败' })
  }
})

router.post('/fund-info/sync', validateAdminToken, async (req: Request, res: Response) => {
  try {
    const codes = getAllFundInfoCodes()
    logger.log(`开始同步基金信息，共 ${codes.length} 只基金: ${codes.join(', ')}`)
    let updated = 0
    let failed = 0

    for (const code of codes) {
      try {
        const detail = await fetchFundDetailFromApi(code)
        if (detail && detail.name) {
          const existing = getFundInfo(code)
          if (existing) {
            const fundData: Partial<FundInfo> & { code: string; name: string } = {
              code,
              name: detail.name,
              ftype: detail.ftype,
              fund_company: detail.fund_company,
              fund_manager: detail.fund_manager,
              establish_date: detail.establish_date,
              fund_scale: detail.fund_scale,
              benchmark: detail.benchmark,
              is_recommend: existing.is_recommend
            }

            saveFundInfo(fundData, true)
            syncUserFundsName(code, detail.name)
            updated++
            logger.log(`同步基金 ${code}: ${detail.name} 成功`)
          }
        } else {
          failed++
          logger.error(`同步基金 ${code} 失败: 未获取到详情`)
        }
      } catch (err) {
        failed++
        logger.error(`同步基金 ${code} 异常:`, err)
      }
      await new Promise(resolve => setTimeout(resolve, 300))
    }

    logger.log(`同步完成: 更新 ${updated}, 失败 ${failed}, 总数 ${codes.length}`)
    const fixedNames = fixAllUserFundsNames()
    res.json({ success: true, updated, failed, total: codes.length, fixedNames })
  } catch (error) {
    logger.error('同步基金信息失败:', error)
    res.status(500).json({ error: '同步基金信息失败' })
  }
})

// ---- Operation Logs ----
router.get('/operation-logs', validateAdminToken, (req: Request, res: Response) => {
  try {
    const page = parseIntSafe(req.query.page, 1, 1)
    const pageSize = parseIntSafe(req.query.pageSize, 20, 1, 100)
    const result = getOperationLogList({
      page,
      pageSize,
      action: parseString(req.query.action as string),
      username: parseString(req.query.username as string),
      startDate: parseString(req.query.startDate as string),
      endDate: parseString(req.query.endDate as string)
    })
    res.json(result)
  } catch (error) {
    logger.error('获取操作日志失败:', error)
    res.status(500).json({ error: '获取操作日志失败' })
  }
})

// ---- Model Management ----
router.get('/model/providers', validateAdminToken, (_req: Request, res: Response) => {
  try {
    res.json(getProviders())
  } catch (error) {
    logger.error('获取模型提供商失败:', error)
    res.status(500).json({ error: '获取模型提供商失败' })
  }
})

router.post('/model/providers', validateAdminToken, (req: Request, res: Response) => {
  try {
    const { name, api_base, api_key } = req.body
    if (!name || !api_base) return res.status(400).json({ error: '缺少必要参数' })
    const provider = addProvider({ name, api_base, api_key: api_key || '' })
    res.json({ success: true, provider })
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) return res.status(400).json({ error: '提供商名称已存在' })
    logger.error('添加模型提供商失败:', error)
    res.status(500).json({ error: '添加模型提供商失败' })
  }
})

router.put('/model/providers/:id', validateAdminToken, (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) return res.status(400).json({ error: '无效的ID' })
    updateProvider(id, req.body)
    res.json({ success: true })
  } catch (error) {
    logger.error('更新模型提供商失败:', error)
    res.status(500).json({ error: '更新模型提供商失败' })
  }
})

router.delete('/model/providers/:id', validateAdminToken, (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) return res.status(400).json({ error: '无效的ID' })
    const ok = deleteProvider(id)
    if (!ok) return res.status(400).json({ error: '该提供商下仍有模型，无法删除' })
    res.json({ success: true })
  } catch (error) {
    logger.error('删除模型提供商失败:', error)
    res.status(500).json({ error: '删除模型提供商失败' })
  }
})

router.get('/model/models', validateAdminToken, (_req: Request, res: Response) => {
  try {
    res.json(getAllModels())
  } catch (error) {
    logger.error('获取模型列表失败:', error)
    res.status(500).json({ error: '获取模型列表失败' })
  }
})

router.get('/model/providers/:id/models', validateAdminToken, (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) return res.status(400).json({ error: '无效的ID' })
    res.json(getModelsByProvider(id))
  } catch (error) {
    logger.error('获取模型列表失败:', error)
    res.status(500).json({ error: '获取模型列表失败' })
  }
})

router.post('/model/models', validateAdminToken, (req: Request, res: Response) => {
  try {
    const { provider_id, model_id, model_name } = req.body
    if (!provider_id || !model_id || !model_name) return res.status(400).json({ error: '缺少必要参数' })
    addModel({ provider_id, model_id, model_name })
    res.json({ success: true })
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) return res.status(400).json({ error: '该模型已存在' })
    logger.error('添加模型失败:', error)
    res.status(500).json({ error: '添加模型失败' })
  }
})

router.put('/model/models/:id', validateAdminToken, (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) return res.status(400).json({ error: '无效的ID' })
    updateModel(id, req.body)
    res.json({ success: true })
  } catch (error) {
    logger.error('更新模型失败:', error)
    res.status(500).json({ error: '更新模型失败' })
  }
})

router.delete('/model/models/:id', validateAdminToken, (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) return res.status(400).json({ error: '无效的ID' })
    const ok = deleteModel(id)
    if (!ok) return res.status(404).json({ error: '模型不存在' })
    res.json({ success: true })
  } catch (error) {
    logger.error('删除模型失败:', error)
    res.status(500).json({ error: '删除模型失败' })
  }
})

router.get('/model/scenes', validateAdminToken, (_req: Request, res: Response) => {
  try {
    res.json(getSceneMappings())
  } catch (error) {
    logger.error('获取场景映射失败:', error)
    res.status(500).json({ error: '获取场景映射失败' })
  }
})

router.put('/model/scenes/:scene', validateAdminToken, (req: Request, res: Response) => {
  try {
    const { scene_name, model_id, provider_id } = req.body
    if (!model_id || !provider_id) return res.status(400).json({ error: '缺少必要参数' })
    setSceneMapping({ scene: req.params.scene, scene_name: scene_name || req.params.scene, model_id, provider_id })
    res.json({ success: true })
  } catch (error) {
    logger.error('更新场景映射失败:', error)
    res.status(500).json({ error: '更新场景映射失败' })
  }
})

export default router
