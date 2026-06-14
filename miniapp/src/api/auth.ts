import { post, get, BASE_URL, getClientId, getSessionToken } from '@/utils/request'
import { setSessionToken, clearSessionToken } from '@/utils/request'
import type { UserPreferences } from './user'

export interface UserInfo {
  id: string
  username: string
  email: string
}

export interface SessionInfo {
  isLoggedIn: boolean
  userId: string
  type: string
  label: string
  user: UserInfo | null
}

export interface WechatLoginResult {
  success: boolean
  message: string
  token?: string
  user?: UserInfo
}

export async function wechatLogin(code: string): Promise<WechatLoginResult> {
  const data: any = await post('/api/auth/wechat-login', { code })
  if (data.success && data.token) {
    setSessionToken(data.token)
  }
  return data
}

export async function checkSession(): Promise<SessionInfo> {
  return get('/api/auth/session')
}

export async function logout(): Promise<void> {
  try {
    await post('/api/auth/logout')
  } finally {
    clearSessionToken()
  }
}

export async function getAnalysisUsage(): Promise<{ allowed: boolean; credits: number; userType: string }> {
  return get('/api/analysis/usage')
}

export async function lookupFunds(codes: string[]): Promise<Array<{ code: string; name: string; type: string; found: boolean }>> {
  return post('/api/analysis/lookup', { codes })
}

export async function streamAnalysis(
  codes: string[],
  period: string,
  onChunk: (content: string) => void,
  onDone: () => void,
  onError: (error: string) => void
): Promise<void> {
  try {
    const res: any = await new Promise((resolve, reject) => {
      uni.request({
        url: `${BASE_URL}/api/analysis/stream`,
        method: 'POST',
        data: { codes, period },
        header: {
          'Content-Type': 'application/json',
          'X-Client-Id': getClientId(),
          'Authorization': getSessionToken() ? `Bearer ${getSessionToken()}` : ''
        },
        responseType: 'text',
        success: (r: any) => resolve(r),
        fail: (err: any) => reject(err)
      })
    })

    if (res.statusCode !== 200) {
      let errMsg = '分析请求失败'
      try {
        const errData = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
        errMsg = errData.error || errMsg
      } catch { /* ignore */ }
      onError(errMsg)
      return
    }

    const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
    const lines = text.split('\n')
    for (const line of lines) {
      if (!line.trim().startsWith('data:')) continue
      const jsonStr = line.trim().slice(5).trim()
      if (jsonStr === '[DONE]') break
      try {
        const parsed = JSON.parse(jsonStr)
        if (parsed.error) {
          onError(parsed.error)
          return
        }
        if (parsed.type === 'content') {
          onChunk(parsed.content)
        }
      } catch {
        // skip
      }
    }
    onDone()
  } catch (err: any) {
    onError(err.errMsg || '请求失败')
  }
}
