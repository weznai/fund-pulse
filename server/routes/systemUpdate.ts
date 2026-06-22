import { Router, Request, Response } from 'express'
import { logger } from '../logger.js'
import { validateAdminToken } from '../middleware/auth.js'
import {
  getState,
  getDefaultShellInfo,
  getPackagesInfo,
  loadUpdateConfig,
  saveUpdateConfigFile,
  runUpdate,
  testGithubConnection,
  probeProxy,
  UpdateConfig,
} from '../services/systemUpdateService.js'

const router = Router()

const UPDATE_FIELDS: (keyof UpdateConfig)[] = [
  'github_enabled',
  'github_branch',
  'github_token',
  'download_dir',
  'deploy_excludes',
  'package_keep',
  'project_root',
  'app_port',
  'proxy',
  'build_enabled',
  'build_command',
  'build_cwd',
  'build_timeout',
  'install_enabled',
  'restart_command',
  'restart_script',
]

router.get('/update/status', validateAdminToken, (_req: Request, res: Response) => {
  try {
    const state = getState()
    const shellInfo = getDefaultShellInfo()
    const packagesInfo = getPackagesInfo()
    res.json({ success: true, data: { ...state, shell_info: shellInfo, packages_info: packagesInfo } })
  } catch (error) {
    logger.error('获取更新状态失败:', error)
    res.status(500).json({ error: '获取更新状态失败' })
  }
})

router.get('/update/config', validateAdminToken, (_req: Request, res: Response) => {
  try {
    const upd = { ...loadUpdateConfig() }
    if (upd.github_token) upd.github_token = '******'
    res.json({ success: true, data: upd })
  } catch (error) {
    logger.error('获取更新配置失败:', error)
    res.status(500).json({ error: '获取更新配置失败' })
  }
})

router.post('/update/config', validateAdminToken, (req: Request, res: Response) => {
  try {
    const body = req.body || {}
    const upd = loadUpdateConfig()
    const originalToken = upd.github_token
    for (const f of UPDATE_FIELDS) {
      if (body[f] !== undefined) {
        ;(upd as any)[f] = body[f]
      }
    }
    if (body.github_token === '******') {
      upd.github_token = originalToken
    }
    saveUpdateConfigFile(upd)
    res.json({ success: true, message: '更新配置已保存' })
  } catch (error) {
    logger.error('保存更新配置失败:', error)
    res.status(500).json({ error: '保存更新配置失败' })
  }
})

router.post('/update/run', validateAdminToken, (req: Request, res: Response) => {
  try {
    const mode = (req.body?.mode || 'full').trim()
    const upd = loadUpdateConfig()
    const state = getState()
    if (state.running) {
      return res.json({ success: false, message: '已有更新任务在执行中' })
    }
    runUpdate(upd, mode)
    res.json({ success: true, message: `更新任务已启动 (模式: ${mode})` })
  } catch (error) {
    logger.error('启动更新失败:', error)
    res.status(500).json({ error: String(error) || '启动更新失败' })
  }
})

router.post('/update/test-github', validateAdminToken, async (_req: Request, res: Response) => {
  try {
    const upd = loadUpdateConfig()
    const result = await testGithubConnection(upd)
    res.json({ success: true, data: result })
  } catch (error) {
    logger.error('测试 GitHub 连接失败:', error)
    res.status(500).json({ error: '测试连接失败' })
  }
})

router.get('/update/probe-proxy', validateAdminToken, (_req: Request, res: Response) => {
  try {
    const result = probeProxy()
    res.json({ success: true, data: result })
  } catch (error) {
    logger.error('探测代理失败:', error)
    res.status(500).json({ error: '探测代理失败' })
  }
})

router.get('/update/logs', validateAdminToken, (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: getState().logs })
  } catch (error) {
    logger.error('获取更新日志失败:', error)
    res.status(500).json({ error: '获取更新日志失败' })
  }
})

export default router
