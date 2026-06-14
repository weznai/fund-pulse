import axios from 'axios'
import { logger } from '../logger.js'

const WX_APPID = process.env.WX_APPID || ''
const WX_SECRET = process.env.WX_SECRET || ''

interface WxSessionResult {
  openid?: string
  session_key?: string
  unionid?: string
  errcode?: number
  errmsg?: string
}

export async function code2Session(code: string): Promise<WxSessionResult> {
  if (!WX_SECRET) {
    const mockOpenid = 'dev_' + code.substring(0, 16)
    logger.log(`🔧 开发模式：跳过微信验证，使用模拟 openid=${mockOpenid}`)
    return { openid: mockOpenid, session_key: 'dev_session_key' }
  }

  if (!WX_APPID) {
    logger.error('❌ 微信小程序配置缺失: WX_APPID 未设置')
    return { errcode: -1, errmsg: '服务器配置错误' }
  }

  const url = 'https://api.weixin.qq.com/sns/jscode2session'
  try {
    const response = await axios.get(url, {
      params: {
        appid: WX_APPID,
        secret: WX_SECRET,
        js_code: code,
        grant_type: 'authorization_code'
      },
      timeout: 10000
    })

    const data = response.data as WxSessionResult

    if (data.errcode) {
      logger.error(`❌ 微信登录失败: ${data.errcode} - ${data.errmsg}`)
      return data
    }

    logger.log(`✅ 微信 code2Session 成功: openid=${data.openid?.substring(0, 8)}...`)
    return data
  } catch (error) {
    logger.error('❌ 微信 code2Session 请求失败:', error)
    return { errcode: -2, errmsg: '微信服务请求失败' }
  }
}
