/**
 * 管理员账号路由（仅超管）
 *
 * 挂载 /api/admin/admin-users：
 *   GET    /                列表（keyword 筛选）
 *   POST   /                新建 { username, password, role, label }
 *   PUT    /:id             编辑 { role?, label?, password? }
 *   PUT    /:id/status      启用/禁用 { disabled }
 *   DELETE /:id             删除
 */

import { Router } from 'express'
import type { Request, Response } from 'express'
import { logger } from '../logger.js'
import { requireSuperAdmin } from '../middleware/auth.js'
import {
  ADMIN_ROLES,
  getAdminUserList,
  getAdminUserById,
  isAdminUsernameExists,
  createAdminUser,
  updateAdminUser,
  setAdminUserDisabled,
  deleteAdminUser,
  countEnabledAdminUsersByRole,
  type AdminRole
} from '../db/adminUser.js'
import { addOperationLog } from '../db/operationLog.js'

const router = Router()
router.use(requireSuperAdmin)

function parseRole(v: unknown): AdminRole | undefined {
  return v === 'super' || v === 'news' ? v : undefined
}

function logAction(req: Request, res: Response, action: string, description: string): void {
  const admin = res.locals.adminUser as { username: string } | undefined
  try {
    addOperationLog({
      username: admin?.username || 'admin',
      ip: req.ip || '',
      action,
      description
    })
  } catch { /* 日志失败不阻断 */ }
}

router.get('/', (req: Request, res: Response) => {
  try {
    const keyword = req.query.keyword ? String(req.query.keyword).trim() : undefined
    res.json({ list: getAdminUserList(keyword), roles: ADMIN_ROLES })
  } catch (error) {
    logger.error('获取管理员账号列表失败:', error)
    res.status(500).json({ error: '获取管理员账号列表失败' })
  }
})

router.post('/', (req: Request, res: Response) => {
  try {
    const username = String(req.body?.username || '').trim()
    const password = String(req.body?.password || '')
    const role = parseRole(req.body?.role)
    const label = String(req.body?.label || '').trim()

    if (!/^[a-zA-Z0-9_\-]{2,32}$/.test(username)) {
      return res.status(400).json({ error: '用户名需为 2-32 位字母/数字/下划线/中划线' })
    }
    if (username === 'admin') {
      return res.status(400).json({ error: 'admin 为内置超管保留名，请换一个用户名' })
    }
    if (password.length < 6 || password.length > 64) {
      return res.status(400).json({ error: '密码长度需为 6-64 位' })
    }
    if (!role) {
      return res.status(400).json({ error: '角色必须为 super 或 news' })
    }
    if (isAdminUsernameExists(username)) {
      return res.status(400).json({ error: `用户名 ${username} 已存在` })
    }

    const id = createAdminUser({ username, password, role, label })
    logAction(req, res, 'admin_user_create', `新建后台账号 ${username}（${ADMIN_ROLES[role]}）`)
    res.json({ success: true, id })
  } catch (error) {
    logger.error('新建管理员账号失败:', error)
    res.status(500).json({ error: '新建管理员账号失败' })
  }
})

router.put('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '无效的账号ID' })

    const existing = getAdminUserById(id)
    if (!existing) return res.status(404).json({ error: '账号不存在' })

    const data: { role?: AdminRole; label?: string; password?: string } = {}
    if (req.body?.role !== undefined) {
      const role = parseRole(req.body.role)
      if (!role) return res.status(400).json({ error: '角色必须为 super 或 news' })
      if (existing.role === 'super' && role !== 'super' && countEnabledAdminUsersByRole('super') <= 1) {
        return res.status(400).json({ error: '不能降级最后一个启用的超级管理员（admin 内置超管除外）' })
      }
      data.role = role
    }
    if (req.body?.label !== undefined) {
      const label = String(req.body.label).trim()
      if (label.length > 50) return res.status(400).json({ error: '备注最多50字' })
      data.label = label
    }
    if (req.body?.password !== undefined) {
      const password = String(req.body.password)
      if (password.length < 6 || password.length > 64) {
        return res.status(400).json({ error: '密码长度需为 6-64 位' })
      }
      data.password = password
    }

    const updated = updateAdminUser(id, data)
    logAction(req, res, 'admin_user_update', `编辑后台账号 ${existing.username}${data.password ? '（含重置密码）' : ''}`)
    res.json({ success: true, account: updated })
  } catch (error) {
    logger.error('编辑管理员账号失败:', error)
    res.status(500).json({ error: '编辑管理员账号失败' })
  }
})

router.put('/:id/status', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '无效的账号ID' })

    const existing = getAdminUserById(id)
    if (!existing) return res.status(404).json({ error: '账号不存在' })

    const disabled = !!req.body?.disabled
    if (disabled && existing.role === 'super' && countEnabledAdminUsersByRole('super') <= 1) {
      return res.status(400).json({ error: '不能禁用最后一个启用的超级管理员（admin 内置超管除外）' })
    }

    const account = setAdminUserDisabled(id, disabled)
    logAction(req, res, 'admin_user_status', `${disabled ? '禁用' : '启用'}后台账号 ${existing.username}`)
    res.json({ success: true, account })
  } catch (error) {
    logger.error('更新管理员账号状态失败:', error)
    res.status(500).json({ error: '更新管理员账号状态失败' })
  }
})

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '无效的账号ID' })

    const existing = getAdminUserById(id)
    if (!existing) return res.status(404).json({ error: '账号不存在' })
    if (existing.role === 'super' && countEnabledAdminUsersByRole('super') <= 1) {
      return res.status(400).json({ error: '不能删除最后一个启用的超级管理员（admin 内置超管除外）' })
    }

    deleteAdminUser(id)
    logAction(req, res, 'admin_user_delete', `删除后台账号 ${existing.username}`)
    res.json({ success: true })
  } catch (error) {
    logger.error('删除管理员账号失败:', error)
    res.status(500).json({ error: '删除管理员账号失败' })
  }
})

export default router
