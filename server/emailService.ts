import crypto from 'crypto'
import nodemailer from 'nodemailer'
import { getSystemParam, setSystemParam } from './db.js'

// 默认邮件配置（仅用于初始化）
const DEFAULT_EMAIL_CONFIG = {
  service: 'qq',
  host: 'smtp.qq.com',
  port: 465,
  secure: true
}

// 获取邮件配置
function getEmailConfig() {
  const user = getSystemParam('email_user')
  const pass = getSystemParam('email_pass')
  
  if (!user || !pass) {
    return null
  }
  
  return {
    ...DEFAULT_EMAIL_CONFIG,
    auth: { user, pass }
  }
}

// 创建邮件传输器
function createTransporter() {
  const config = getEmailConfig()
  if (!config) {
    return null
  }
  
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    connectionTimeout: 10000,
    socketTimeout: 10000
  })
}

// 检查邮件服务是否已配置
export function isEmailConfigured(): boolean {
  const user = getSystemParam('email_user')
  const pass = getSystemParam('email_pass')
  return !!(user && pass)
}

// 配置邮件服务
export function configureEmailService(user: string, pass: string): void {
  setSystemParam('email_user', user, '发件邮箱地址')
  setSystemParam('email_pass', pass, '邮箱授权码')
  console.log('✅ 邮件服务配置已保存')
}

/**
 * 发送验证码邮件
 */
export async function sendOtpEmail(to: string, otp: string, type: 'login' | 'register' | 'verify' | 'reset' = 'login'): Promise<{ success: boolean; error?: string }> {
  const config = getEmailConfig()
  if (!config) {
    return { success: false, error: '邮件服务未配置，请先在系统参数中配置邮箱信息' }
  }
  
  try {
    const transporter = createTransporter()
    if (!transporter) {
      return { success: false, error: '创建邮件传输器失败' }
    }
    
    await transporter.verify()
    console.log('SMTP连接验证成功')

    const titles: Record<string, string> = {
      login: '您的登录验证码',
      register: '您的注册验证码',
      verify: '您的邮箱验证码',
      reset: '您的重置密码验证码'
    }

    const descriptions: Record<string, string> = {
      login: '您好，您正在登录实时基金跟踪系统，您的验证码是：',
      register: '您好，感谢您注册实时基金跟踪系统，请使用以下验证码完成注册：',
      verify: '您好，您正在验证邮箱地址，您的验证码是：',
      reset: '您好，您正在重置密码，请使用以下验证码：'
    }

    const mailOptions = {
      from: '"实时基金跟踪系统" <' + config.auth.user + '>',
      to: to,
      subject: titles[type] || '您的验证码',
      html: '<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:16px;background:#f5f5f5"><div style="background:white;padding:24px 20px;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,0.08)"><h3 style="color:#333;margin:0 0 16px 0;font-size:16px">' + (titles[type] || '验证码') + '</h3><p style="color:#666;font-size:13px;margin:0 0 16px 0">' + (descriptions[type] || '您的验证码是：') + '</p><div style="background:#f8f9fa;color:#333;font-size:20px;font-weight:600;padding:12px 16px;text-align:center;border-radius:4px;letter-spacing:4px;border:1px solid #e0e0e0;margin-bottom:16px">' + otp + '</div><p style="color:#999;font-size:12px;margin:0 0 8px 0">验证码有效期为5分钟，请尽快使用。</p><p style="color:#999;font-size:12px;margin:0 0 16px 0">如果您没有进行此操作，请忽略此邮件。</p><hr style="border:none;border-top:1px solid #eee;margin:0 0 12px 0"><p style="color:#bbb;font-size:11px;text-align:center;margin:0">此邮件由系统自动发送，请勿回复</p></div></div>'
    }

    await transporter.sendMail(mailOptions)
    console.log('验证码邮件已发送到: ' + to)
    return { success: true }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('发送验证码邮件失败:', errorMessage)
    return { success: false, error: errorMessage }
  }
}

/**
 * 验证邮箱格式
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * 生成6位数字验证码
 */
export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}
