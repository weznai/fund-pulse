import { Router, Request, Response } from 'express'
import { logger } from '../logger.js'
import { code2Session } from '../services/wechat.js'
import {
  UserIdType,
  getUserByOpenId,
  createWechatUser,
  updateUserLastActive,
  setRegisteredUser
} from '../db/index.js'
import { signToken } from '../middleware/userSession.js'

const router = Router()

router.post('/wechat-login', async (req: Request, res: Response) => {
  try {
    const { code } = req.body

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, message: '缺少微信登录code' })
    }

    const wxResult = await code2Session(code)

    if (wxResult.errcode || !wxResult.openid) {
      return res.status(400).json({
        success: false,
        message: wxResult.errmsg || '微信登录失败'
      })
    }

    let user = getUserByOpenId(wxResult.openid)

    if (!user) {
      user = createWechatUser(wxResult.openid)
      logger.log(`👤 新微信用户注册: ${user.username}`)
    }

    if (user.disabled) {
      return res.status(403).json({ success: false, message: '账号已被禁用' })
    }

    updateUserLastActive(user.id)
    setRegisteredUser(user.id, user.username)

    const token = signToken(user.id)

    res.json({
      success: true,
      message: '登录成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    })
  } catch (error) {
    logger.error('微信登录失败:', error)
    res.status(500).json({ success: false, message: '微信登录失败' })
  }
})

export default router
