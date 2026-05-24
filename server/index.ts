import './config/index.js'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { logger } from './logger.js'
import { initDatabase, closeDatabase, fixUsersDataIntegrity, ensureVisitLogsTable, getAllUsers } from './db.js'
import { startScheduledSettlement } from './scheduled/settlement.js'
import { startScheduledEstimateWithUserFunds, startIndexEstimate } from './scheduled/estimate.js'
import { initHolidaysTable } from './db/holiday.js'
import { setupHolidayRoutes, setupPublicHolidayRoutes } from './services/holidayService.js'
import { validateAdminToken } from './middleware/auth.js'
import { trackVisit } from './middleware/visitTracker.js'
import { getClientUserId, setSessionCookie } from './middleware/userSession.js'
import { userContext } from './db.js'
import { ensureOperationLogTable } from './db/operationLog.js'
import { ensureModelConfigTable } from './db/modelConfig.js'
import { seedDefaultData } from './model_config.js'

import fundRoutes from './routes/fund.js'
import authRoutes from './routes/auth.js'
import userRoutes, { migrateFromLocalHandler } from './routes/user.js'
import holdingsRoutes from './routes/holdings.js'
import adminRoutes from './routes/admin.js'
import visitRoutes from './routes/visit.js'
import cacheRoutes from './routes/cache.js'
import suggestionRoutes from './routes/suggestion.js'
import analysisRoutes from './routes/analysis.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3010

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

initDatabase()
fixUsersDataIntegrity()
ensureVisitLogsTable()
ensureOperationLogTable()
ensureModelConfigTable()
seedDefaultData()

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use(trackVisit)

app.use((req, res, next) => {
  const { userId, isNew } = getClientUserId(req)
  if (isNew) {
    setSessionCookie(res, userId.id)
  }
  userContext.run(userId, () => {
    next()
  })
})

initHolidaysTable()

const stopSettlementTask = startScheduledSettlement()
logger.log('⏰ 已启动定时任务（8:00初始化结算状态，18:00后获取净值时自动结算）')

app.use('/api/admin/holidays', setupHolidayRoutes(validateAdminToken))
app.use('/api/holidays', setupPublicHolidayRoutes())

app.use('/api', fundRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/user', userRoutes)
app.use('/api/holdings', holdingsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api', visitRoutes)
app.use('/api/cache', cacheRoutes)
app.use('/api', suggestionRoutes)
app.use('/api', analysisRoutes)

app.use('/api/users', (req, res) => {
  try {
    const users = getAllUsers()
    res.json(users)
  } catch (error) {
    logger.error('获取用户列表失败:', error)
    res.status(500).json({ error: '获取用户列表失败' })
  }
})

app.post('/api/migrate/from-local', migrateFromLocalHandler)

app.use(express.static(path.join(__dirname, 'dist')))

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  logger.log(`✅ 服务器运行在 http://localhost:${PORT}`)
  logger.log(`📡 静态文件: ${path.join(__dirname, 'dist')}`)
  logger.log(`📡 API 代理: /api/*`)

  startScheduledEstimateWithUserFunds()
  startIndexEstimate()
})

process.on('SIGINT', () => {
  logger.log('\n收到 SIGINT 信号，正在关闭服务器...')
  closeDatabase()
  process.exit(0)
})

process.on('SIGTERM', () => {
  logger.log('\n收到 SIGTERM 信号，正在关闭服务器...')
  closeDatabase()
  process.exit(0)
})
