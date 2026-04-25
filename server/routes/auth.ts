import { Router, Request, Response } from 'express'
import { logger } from '../logger.js'
import {
  UserIdType, UserId, generateSessionId,
  saveOtp, verifyOtp,
  isUsernameExists, isEmailExists,
  getUserByUsername, getUserByEmail, getUserByUsernameOrEmail, getUserById,
  createUser, verifyUserEmail, updateUserLastActive, updateUserPassword,
  setCurrentUserId, setRegisteredUser, getSystemParam
} from '../db/index.js'
import { sendOtpEmail, generateOtp, isValidEmail } from '../emailService.js'
import { setSessionCookie, ensureUserSession } from '../middleware/userSession.js'
import { hashPassword, verifyPassword, verifyOldMD5Password, isOldPasswordHash } from '../services/password.js'

const router = Router()

router.post('/send-otp', async (req: Request, res: Response) => {
  try {
    const { email } = req.body

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: '邮箱格式不正确' })
    }

    const otp = generateOtp()
    const expiresAt = Date.now() + 5 * 60 * 1000

    try {
      saveOtp(email, otp, expiresAt)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '保存验证码失败'
      return res.status(429).json({ success: false, message: errorMessage })
    }

    const result = await sendOtpEmail(email, otp)

    if (result.success) {
      res.json({ success: true, message: '验证码已发送到邮箱' })
    } else {
      logger.error('邮件发送错误:', result.error)
      res.status(500).json({ success: false, message: '发送验证码失败: ' + (result.error || '请稍后重试') })
    }
  } catch (error) {
    logger.error('发送验证码失败:', error)
    res.status(500).json({ success: false, message: '发送验证码失败' })
  }
})

router.get('/check-username', (req: Request, res: Response) => {
  try {
    const { username } = req.query

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ available: false, message: '用户名不能为空' })
    }

    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]{1,20}$/.test(username)) {
      return res.json({
        available: false,
        message: '用户名只能是1-20个字符，包含字母、数字、下划线或中文'
      })
    }

    const exists = isUsernameExists(username)
    res.json({ available: !exists, message: exists ? '用户名已被使用' : '用户名可用' })
  } catch (error) {
    logger.error('检查用户名失败:', error)
    res.status(500).json({ available: false, message: '检查用户名失败' })
  }
})

router.get('/check-email', (req: Request, res: Response) => {
  try {
    const { email } = req.query

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ available: false, message: '邮箱不能为空' })
    }

    if (!isValidEmail(email)) {
      return res.json({ available: false, message: '邮箱格式不正确' })
    }

    const exists = isEmailExists(email)
    res.json({ available: !exists, message: exists ? '邮箱已被注册' : '邮箱可用' })
  } catch (error) {
    logger.error('检查邮箱失败:', error)
    res.status(500).json({ available: false, message: '检查邮箱失败' })
  }
})

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ success: false, message: '用户名不能为空' })
    }
    if (!/^[a-zA-Z0-9_]{1,20}$/.test(username)) {
      return res.status(400).json({
        success: false,
        message: '用户名只能是1-20个字符，包含字母、数字或下划线'
      })
    }
    if (isUsernameExists(username)) {
      return res.status(400).json({ success: false, message: '用户名已被使用' })
    }

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: '邮箱不能为空' })
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: '邮箱格式不正确' })
    }
    if (isEmailExists(email)) {
      return res.status(400).json({ success: false, message: '邮箱已被注册' })
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: '密码不能为空' })
    }
    if (password.length < 4) {
      return res.status(400).json({ success: false, message: '密码至少需要4个字符' })
    }

    const emailVerify = (getSystemParam('email_verify') || 'Y').trim().toUpperCase()
    logger.log('📧 注册 email_verify 参数值:', emailVerify)

    if (emailVerify === 'N') {
      const hashedPassword = hashPassword(password)
      const user = createUser({ username, email, password: hashedPassword, emailVerified: true })

      setRegisteredUser(user.id, username)
      setSessionCookie(res, user.id)

      res.json({ success: true, message: '注册成功', user: { id: user.id, username, email } })
      return
    }

    const otp = generateOtp()
    const expiresAt = Date.now() + 5 * 60 * 1000

    try {
      saveOtp(email, otp, expiresAt)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '保存验证码失败'
      return res.status(429).json({ success: false, message: errorMessage })
    }

    const result = await sendOtpEmail(email, otp, 'register')

    if (result.success) {
      res.json({
        success: true,
        message: '验证码已发送到邮箱，请查收',
        pendingRegistration: { username, email }
      })
    } else {
      logger.error('邮件发送错误:', result.error)
      res.status(500).json({ success: false, message: '发送验证码失败: ' + (result.error || '请稍后重试') })
    }
  } catch (error) {
    logger.error('注册失败:', error)
    res.status(500).json({ success: false, message: '注册失败' })
  }
})

router.post('/register/verify', (req: Request, res: Response) => {
  try {
    const { username, email, password, otp } = req.body

    if (!username || !email || !password || !otp) {
      return res.status(400).json({ success: false, message: '请填写完整信息' })
    }

    if (!/^[a-zA-Z0-9_]{1,20}$/.test(username)) {
      return res.status(400).json({
        success: false,
        message: '用户名只能是1-20个字符，包含字母、数字或下划线'
      })
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: '邮箱格式不正确' })
    }

    const valid = verifyOtp(email, otp)

    if (!valid) {
      return res.status(401).json({ success: false, message: '验证码错误或已过期' })
    }

    if (isUsernameExists(username)) {
      return res.status(400).json({ success: false, message: '用户名已被使用' })
    }
    if (isEmailExists(email)) {
      return res.status(400).json({ success: false, message: '邮箱已被注册' })
    }

    const hashedPassword = hashPassword(password)
    const user = createUser({
      username,
      email,
      password: hashedPassword
    })

    verifyUserEmail(user.id)

    setRegisteredUser(user.id, username)

    setSessionCookie(res, user.id)

    res.json({
      success: true,
      message: '注册成功',
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    })
  } catch (error) {
    logger.error('完成注册失败:', error)
    res.status(500).json({ success: false, message: '注册失败' })
  }
})

router.post('/login', (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: '请输入用户名/邮箱和密码' })
    }

    const user = getUserByUsernameOrEmail(identifier)

    if (!user) {
      return res.status(401).json({ success: false, message: '用户不存在' })
    }

    let passwordValid = false
    if (user.password) {
      if (isOldPasswordHash(user.password)) {
        passwordValid = verifyOldMD5Password(password, user.password)
        if (passwordValid) {
          const hashedPassword = hashPassword(password)
          updateUserPassword(user.id, hashedPassword)
        }
      } else {
        passwordValid = verifyPassword(password, user.password)
      }
    }
    
    if (!passwordValid) {
      return res.status(401).json({ success: false, message: '密码错误' })
    }

    if (user.disabled) {
      return res.status(403).json({ success: false, message: '该账号已被禁用，请联系管理员' })
    }

    const emailVerifyLogin = (getSystemParam('email_verify') || 'Y').trim().toUpperCase()
    if (emailVerifyLogin === 'Y' && !user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: '请先验证邮箱',
        needVerification: true,
        email: user.email
      })
    }

    updateUserLastActive(user.id)

    setRegisteredUser(user.username, user.username)

    setSessionCookie(res, user.username)

    res.json({
      success: true,
      message: '登录成功',
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    })
  } catch (error) {
    logger.error('登录失败:', error)
    res.status(500).json({ success: false, message: '登录失败' })
  }
})

router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const { email } = req.body

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: '邮箱格式不正确' })
    }

    const user = getUserByEmail(email)

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' })
    }

    if (user.emailVerified) {
      return res.status(400).json({ success: false, message: '邮箱已验证，请直接登录' })
    }

    const otp = generateOtp()
    const expiresAt = Date.now() + 5 * 60 * 1000

    try {
      saveOtp(email, otp, expiresAt)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '保存验证码失败'
      return res.status(429).json({ success: false, message: errorMessage })
    }

    const result = await sendOtpEmail(email, otp, 'verify')

    if (result.success) {
      res.json({ success: true, message: '验证码已发送到邮箱' })
    } else {
      res.status(500).json({ success: false, message: '发送验证码失败' })
    }
  } catch (error) {
    logger.error('重新发送验证邮件失败:', error)
    res.status(500).json({ success: false, message: '发送验证邮件失败' })
  }
})

router.post('/verify-email', (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: '请输入邮箱和验证码' })
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: '邮箱格式不正确' })
    }

    const valid = verifyOtp(email, otp)

    if (!valid) {
      return res.status(401).json({ success: false, message: '验证码错误或已过期' })
    }

    const user = getUserByEmail(email)

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' })
    }

    verifyUserEmail(user.id)

    setRegisteredUser(user.id, user.username)

    setSessionCookie(res, user.id)

    res.json({
      success: true,
      message: '邮箱验证成功',
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    })
  } catch (error) {
    logger.error('验证邮箱失败:', error)
    res.status(500).json({ success: false, message: '验证邮箱失败' })
  }
})

router.get('/session', (req: Request, res: Response) => {
  try {
    const userId = ensureUserSession(req, res)

    let isLoggedIn = false
    let user: { id: string; username: string; email: string } | null = null

    if (userId.type === UserIdType.REGISTERED) {
      let dbUser = getUserByUsername(userId.id)
      if (!dbUser) {
        dbUser = getUserById(userId.id)
      }
      if (!dbUser) {
        dbUser = getUserByEmail(userId.id)
      }
      const emailVerifySession = (getSystemParam('email_verify') || 'Y').trim().toUpperCase()
      if (dbUser && !dbUser.disabled && (dbUser.emailVerified || emailVerifySession === 'N')) {
        isLoggedIn = true
        user = {
          id: dbUser.id,
          username: dbUser.username,
          email: dbUser.email
        }
      }
    }

    res.json({
      isLoggedIn,
      userId: userId.id,
      type: userId.type,
      label: userId.label,
      user
    })
  } catch (error) {
    logger.error('获取会话失败:', error)
    res.status(500).json({ error: '获取会话失败' })
  }
})

router.post('/logout', (req: Request, res: Response) => {
  try {
    const newSessionId = generateSessionId()
    res.cookie('session_id', newSessionId, {
      httpOnly: true,
      maxAge: 365 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    })

    setCurrentUserId({
      id: newSessionId,
      type: UserIdType.GUEST,
      label: '访客'
    })

    res.json({ success: true })
  } catch (error) {
    logger.error('登出失败:', error)
    res.status(500).json({ success: false, message: '登出失败' })
  }
})

router.post('/change-password', (req: Request, res: Response) => {
  try {
    const { identifier, oldPassword, newPassword } = req.body

    if (!identifier || !oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: '请填写完整信息' })
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ success: false, message: '新密码至少需要4个字符' })
    }

    const user = getUserByUsernameOrEmail(identifier)

    if (!user) {
      return res.status(401).json({ success: false, message: '用户不存在' })
    }

    let passwordValid = false
    if (user.password) {
      if (isOldPasswordHash(user.password)) {
        passwordValid = verifyOldMD5Password(oldPassword, user.password)
      } else {
        passwordValid = verifyPassword(oldPassword, user.password)
      }
    }
    
    if (!passwordValid) {
      return res.status(401).json({ success: false, message: '原密码错误' })
    }

    const hashedPassword = hashPassword(newPassword)
    const success = updateUserPassword(user.id, hashedPassword)

    if (success) {
      res.json({ success: true, message: '密码修改成功' })
    } else {
      res.status(500).json({ success: false, message: '密码修改失败' })
    }
  } catch (error) {
    logger.error('修改密码失败:', error)
    res.status(500).json({ success: false, message: '修改密码失败' })
  }
})

router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: '请输入有效的邮箱地址' })
    }

    const user = getUserByEmail(email)

    if (!user) {
      return res.status(404).json({ success: false, message: '该邮箱未注册' })
    }

    const emailVerify = (getSystemParam('email_verify') || 'Y').trim().toUpperCase()
    logger.log('📧 重置密码 email_verify 参数值:', emailVerify)

    if (emailVerify === 'N') {
      return res.json({ success: true, message: '邮件验证已禁用，请联系管理员重置密码', skipVerify: true })
    }

    const otp = generateOtp()
    const expiresAt = Date.now() + 5 * 60 * 1000

    try {
      saveOtp(email, otp, expiresAt)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '保存验证码失败'
      return res.status(429).json({ success: false, message: errorMessage })
    }

    const result = await sendOtpEmail(email, otp, 'reset')

    if (result.success) {
      res.json({ success: true, message: '验证码已发送到邮箱' })
    } else {
      res.status(500).json({ success: false, message: '发送验证码失败' })
    }
  } catch (error) {
    logger.error('忘记密码失败:', error)
    res.status(500).json({ success: false, message: '发送验证码失败' })
  }
})

router.post('/reset-password', (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body

    if (!email || !newPassword) {
      return res.status(400).json({ success: false, message: '请填写完整信息' })
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ success: false, message: '新密码至少需要4个字符' })
    }

    const user = getUserByEmail(email)

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' })
    }

    const emailVerify = (getSystemParam('email_verify') || 'Y').trim().toUpperCase()

    if (emailVerify !== 'N') {
      if (!otp) {
        return res.status(400).json({ success: false, message: '请填写验证码' })
      }
      const valid = verifyOtp(email, otp)
      if (!valid) {
        return res.status(401).json({ success: false, message: '验证码错误或已过期' })
      }
    }

    const hashedPassword = hashPassword(newPassword)
    const success = updateUserPassword(user.id, hashedPassword)

    if (success) {
      res.json({ success: true, message: '密码重置成功' })
    } else {
      res.status(500).json({ success: false, message: '密码重置失败' })
    }
  } catch (error) {
    logger.error('重置密码失败:', error)
    res.status(500).json({ success: false, message: '重置密码失败' })
  }
})

export default router
