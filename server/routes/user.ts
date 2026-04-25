import { Router, Request, Response } from 'express'
import { logger } from '../logger.js'
import {
  UserIdType, UserId, generateSessionId,
  getCurrentUserId, setCurrentUserId,
  setRegisteredUser,
  getAllUsers, getUserIdFromClientId, userContext,
  getUserFunds, getHeldFunds, getFavoriteFunds,
  addUserFund, deleteUserFund, setHolding, removeHolding,
  addUserFundsBatch, isFundInUserList, isFundHeld,
  getUserPreferences, saveUserPreferences,
  getHoldings, saveHolding, deleteHolding, saveHoldingsBatch,
  getFundInfo, saveFundInfo, batchSaveFundInfo
} from '../db/index.js'
import { fetchFundDetailFromApi } from '../services/fundService.js'
import { getClientUserId, setSessionCookie, ensureUserSession, isRegisteredUser } from '../middleware/userSession.js'

const router = Router()

router.get('/current', (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId()
    res.json(userId)
  } catch (error) {
    logger.error('获取用户信息失败:', error)
    res.status(500).json({ error: '获取用户信息失败' })
  }
})

router.post('/login/phone', (req: Request, res: Response) => {
  try {
    const { phone, label } = req.body
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: '手机号格式错误' })
    }
    setRegisteredUser(phone, label || phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'))
    const userId = getCurrentUserId()
    setSessionCookie(res, userId.id)
    res.json({ success: true, userId })
  } catch (error) {
    logger.error('设置手机号用户失败:', error)
    res.status(500).json({ error: '设置手机号用户失败' })
  }
})

router.post('/login/email', (req: Request, res: Response) => {
  try {
    const { email, label } = req.body
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: '邮箱格式错误' })
    }
    setRegisteredUser(email, label || email)
    const userId = getCurrentUserId()
    setSessionCookie(res, userId.id)
    res.json({ success: true, userId })
  } catch (error) {
    logger.error('设置邮箱用户失败:', error)
    res.status(500).json({ error: '设置邮箱用户失败' })
  }
})

router.post('/login/custom', (req: Request, res: Response) => {
  try {
    const { customId, label } = req.body
    if (!customId || typeof customId !== 'string') {
      return res.status(400).json({ error: '自定义ID格式错误' })
    }
    setRegisteredUser(customId, label || customId)
    const userId = getCurrentUserId()
    setSessionCookie(res, userId.id)
    res.json({ success: true, userId })
  } catch (error) {
    logger.error('设置自定义用户失败:', error)
    res.status(500).json({ error: '设置自定义用户失败' })
  }
})

router.post('/reset', (req: Request, res: Response) => {
  try {
    const newSessionId = generateSessionId()
    const newUserId: UserId = {
      id: newSessionId,
      type: UserIdType.GUEST,
      label: '访客'
    }
    setCurrentUserId(newUserId)
    res.json({ success: true, userId: newUserId })
  } catch (error) {
    logger.error('重置用户失败:', error)
    res.status(500).json({ error: '重置用户失败' })
  }
})

router.get('/funds', (req: Request, res: Response) => {
  try {
    const { userId, isNew } = getClientUserId(req)
    if (isNew) setSessionCookie(res, userId.id)

    if (!isRegisteredUser(userId)) {
      return res.json([])
    }

    const fundsMap = getUserFunds()
    const fundsArray = Array.from(fundsMap.values())
    res.json(fundsArray)
  } catch (error) {
    logger.error('获取用户基金失败:', error)
    res.status(500).json({ error: '获取用户基金失败' })
  }
})

router.get('/funds/held', (req: Request, res: Response) => {
  try {
    const { userId, isNew } = getClientUserId(req)
    if (isNew) setSessionCookie(res, userId.id)

    if (!isRegisteredUser(userId)) {
      return res.json([])
    }

    const fundsMap = getHeldFunds()
    const fundsArray = Array.from(fundsMap.values())
    res.json(fundsArray)
  } catch (error) {
    logger.error('获取持仓基金失败:', error)
    res.status(500).json({ error: '获取持仓基金失败' })
  }
})

router.get('/funds/favorites', (req: Request, res: Response) => {
  try {
    const userId = ensureUserSession(req, res)

    if (!isRegisteredUser(userId)) {
      return res.json([])
    }

    const fundsMap = getFavoriteFunds()
    const fundsArray = Array.from(fundsMap.values())
    res.json(fundsArray)
  } catch (error) {
    logger.error('获取自选基金失败:', error)
    res.status(500).json({ error: '获取自选基金失败' })
  }
})

router.post('/funds', async (req: Request, res: Response) => {
  try {
    const userId = ensureUserSession(req, res)
    const { fundCode, fundName } = req.body

    const existing = getFundInfo(fundCode)
    if (!existing) {
      const detail = await fetchFundDetailFromApi(fundCode)
      if (detail && detail.name) {
        saveFundInfo({ code: fundCode, name: detail.name, ...detail })
      } else if (fundName) {
        saveFundInfo({ code: fundCode, name: fundName })
      }
    }

    if (!isRegisteredUser(userId)) {
      return res.json({ success: true, tempUser: true })
    }

    const success = addUserFund(fundCode, fundName)

    res.json({ success })
  } catch (error) {
    logger.error('添加基金失败:', error)
    res.status(500).json({ error: '添加基金失败' })
  }
})

router.post('/funds/batch', async (req: Request, res: Response) => {
  try {
    const userId = ensureUserSession(req, res)
    const { funds } = req.body
    logger.log(`📥 批量添加基金请求 - 用户: ${userId.id} (${userId.type}), 基金数量: ${funds?.length}`)

    const fundsToAddToInfo: Array<{ code: string; name: string }> = []
    for (const fund of funds) {
      const existing = getFundInfo(fund.code)
      if (!existing) {
        const detail = await fetchFundDetailFromApi(fund.code)
        if (detail && detail.name) {
          fundsToAddToInfo.push({ code: fund.code, name: detail.name, ...detail } as any)
        } else if (fund.name || fund.fundName) {
          fundsToAddToInfo.push({ code: fund.code, name: fund.name || fund.fundName })
        }
      }
    }
    if (fundsToAddToInfo.length > 0) {
      batchSaveFundInfo(fundsToAddToInfo)
      logger.log(`📥 保存到 fund_info 表: ${fundsToAddToInfo.length} 条`)
    }

    if (!isRegisteredUser(userId)) {
      logger.log(`📥 临时用户，跳过 user_funds 写入`)
      return res.json({ success: true, count: funds?.length || 0, tempUser: true })
    }

    const normalizedFunds = funds.map((f: any) => ({ code: f.code, name: f.fundName || f.name }))
    const count = addUserFundsBatch(normalizedFunds)
    logger.log(`📥 写入 user_funds 表: ${count} 条`)

    res.json({ success: true, count })
  } catch (error) {
    logger.error('批量添加基金失败:', error)
    res.status(500).json({ error: '批量添加基金失败' })
  }
})

router.delete('/funds/:code', (req: Request, res: Response) => {
  try {
    const userId = ensureUserSession(req, res)

    if (!isRegisteredUser(userId)) {
      return res.json({ success: true, tempUser: true })
    }

    const { code } = req.params
    const success = deleteUserFund(code)
    res.json({ success })
  } catch (error) {
    logger.error('删除基金失败:', error)
    res.status(500).json({ error: '删除基金失败' })
  }
})

router.post('/funds/:code/holding', (req: Request, res: Response) => {
  try {
    const userId = ensureUserSession(req, res)

    if (!isRegisteredUser(userId)) {
      return res.json({ success: true, tempUser: true })
    }

    const { code } = req.params
    const { fundName, share, cost, amount } = req.body
    const result = setHolding(code, fundName, share, cost, amount)
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error })
    }
    res.json({ success: true, holding: result.holding })
  } catch (error) {
    logger.error('设置持仓失败:', error)
    res.status(500).json({ error: '设置持仓失败' })
  }
})

router.delete('/funds/:code/holding', (req: Request, res: Response) => {
  try {
    const userId = ensureUserSession(req, res)

    if (!isRegisteredUser(userId)) {
      return res.json({ success: true, tempUser: true })
    }

    const { code } = req.params
    const success = removeHolding(code)
    res.json({ success })
  } catch (error) {
    logger.error('取消持仓失败:', error)
    res.status(500).json({ error: '取消持仓失败' })
  }
})

router.get('/funds/:code/check', (req: Request, res: Response) => {
  try {
    const userId = ensureUserSession(req, res)

    if (!isRegisteredUser(userId)) {
      return res.json({ inList: false, isHeld: false })
    }

    const { code } = req.params
    const inList = isFundInUserList(code)
    const isHeld = isFundHeld(code)
    res.json({ inList, isHeld })
  } catch (error) {
    logger.error('检查基金失败:', error)
    res.status(500).json({ error: '检查基金失败' })
  }
})

router.get('/preferences', (req: Request, res: Response) => {
  try {
    const userId = ensureUserSession(req, res)

    if (!isRegisteredUser(userId)) {
      return res.json({
        userId: userId.id,
        hideAmount: false,
        viewMode: 'list',
        sortField: 'dayGrowth',
        sortDirection: 'desc',
        filterMode: 'all',
        migratedFromLocal: false,
        lastUpdated: Date.now(),
        isTempUser: true
      })
    }

    const prefs = getUserPreferences()
    res.json(prefs)
  } catch (error) {
    logger.error('获取用户偏好失败:', error)
    res.status(500).json({ error: '获取用户偏好失败' })
  }
})

router.post('/preferences', (req: Request, res: Response) => {
  try {
    const userId = ensureUserSession(req, res)

    if (!isRegisteredUser(userId)) {
      return res.json({ success: true, tempUser: true })
    }

    saveUserPreferences(req.body)
    const updated = getUserPreferences()
    res.json({ success: true, preferences: updated })
  } catch (error) {
    logger.error('保存用户偏好失败:', error)
    res.status(500).json({ error: '保存用户偏好失败' })
  }
})

export const migrateFromLocalHandler = (req: Request, res: Response) => {
  try {
    const { favoriteFunds, heldFunds, holdings, hideAmount, viewMode, sortField, sortDirection } = req.body

    const userId = ensureUserSession(req, res)

    if (!isRegisteredUser(userId)) {
      return res.json({
        success: false,
        message: '临时用户无需迁移数据',
        isTempUser: true
      })
    }

    logger.log('🔄 开始从浏览器缓存迁移数据...')

    const currentPrefs = getUserPreferences()

    if (currentPrefs.migratedFromLocal) {
      logger.log('⚠️ 用户已经迁移过，仅合并新数据')

      if (Array.isArray(favoriteFunds) && favoriteFunds.length > 0) {
        const currentFunds = getUserFunds()
        const currentCodes = new Set(currentFunds.keys())
        for (const code of favoriteFunds) {
          if (!currentCodes.has(code)) {
            addUserFund(code)
          }
        }
      }

      if (holdings && typeof holdings === 'object') {
        const currentHoldings = getHoldings()
        for (const [code, h] of Object.entries(holdings)) {
          if (!currentHoldings.has(code)) {
            saveHolding(h as any)
          }
        }
      }

      return res.json({
        success: true,
        message: '数据已合并',
        alreadyMigrated: true
      })
    }

    saveUserPreferences({
      hideAmount: Boolean(hideAmount),
      viewMode: viewMode || 'list',
      sortField: sortField || 'dayGrowth',
      sortDirection: sortDirection || 'desc',
      migratedFromLocal: true
    })

    if (Array.isArray(favoriteFunds) && favoriteFunds.length > 0) {
      const heldSet = new Set(Array.isArray(heldFunds) ? heldFunds : [])
      const fundsToAdd = favoriteFunds.map(code => ({
        code,
        isHeld: heldSet.has(code)
      }))
      addUserFundsBatch(fundsToAdd)
    }

    if (holdings && typeof holdings === 'object') {
      const holdingsMap = new Map<string, any>()
      for (const [code, h] of Object.entries(holdings)) {
        holdingsMap.set(code, h)
      }
      saveHoldingsBatch(holdingsMap)
    }

    logger.log('✅ 数据迁移完成')

    res.json({
      success: true,
      message: '数据迁移成功',
      alreadyMigrated: false
    })
  } catch (error) {
    logger.error('数据迁移失败:', error)
    res.status(500).json({ error: '数据迁移失败' })
  }
}

router.get('/holdings', (req: Request, res: Response) => {
  try {
    const userId = ensureUserSession(req, res)

    if (!isRegisteredUser(userId)) {
      return res.json([])
    }

    const holdingsMap = getHoldings()
    const holdingsArray = Array.from(holdingsMap.values())
    res.json(holdingsArray)
  } catch (error) {
    logger.error('获取持仓数据失败:', error)
    res.status(500).json({ error: '获取持仓数据失败' })
  }
})

router.post('/holdings', (req: Request, res: Response) => {
  try {
    const userId = ensureUserSession(req, res)
    logger.log(`[POST /holdings] userId=${userId.id} type=${userId.type} body=${JSON.stringify(req.body)}`)

    if (!isRegisteredUser(userId)) {
      return res.json({ success: true, tempUser: true })
    }

    const holding = req.body
    const result = saveHolding(holding)
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error })
    }
    res.json({ success: true, holding: result.holding })
  } catch (error: any) {
    logger.error('保存持仓失败:', error)
    res.status(500).json({ error: '保存持仓失败', detail: error?.message })
  }
})

router.delete('/holdings/:code', (req: Request, res: Response) => {
  try {
    const userId = ensureUserSession(req, res)

    if (!isRegisteredUser(userId)) {
      return res.json({ success: true, tempUser: true })
    }

    const { code } = req.params
    deleteHolding(code)
    res.json({ success: true })
  } catch (error) {
    logger.error('删除持仓失败:', error)
    res.status(500).json({ error: '删除持仓失败' })
  }
})

export default router
