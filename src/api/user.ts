import axios from 'axios'

const API_BASE = '/api'
const CLIENT_ID_KEY = 'fund_client_id'

// 生成浏览器指纹
function generateBrowserFingerprint(): string {
  const components: string[] = []

  // 屏幕信息
  components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`)

  // 时区
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone)

  // 语言
  components.push(navigator.language)

  // 平台
  components.push(navigator.platform)

  // User Agent 的部分信息
  const ua = navigator.userAgent
  components.push(ua.includes('Mobile') ? 'mobile' : 'desktop')

  // Canvas 指纹
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillText('fingerprint', 2, 2)
      components.push(canvas.toDataURL().slice(-50))
    }
  } catch (e) {
    // 忽略
  }

  // WebGL 指纹
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (gl) {
      const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info')
      if (debugInfo) {
        components.push((gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL))
        components.push((gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
      }
    }
  } catch (e) {
    // 忽略
  }

  // 组合并哈希
  const fingerprint = components.join('|')
  return hashString(fingerprint)
}

// 简单哈希函数
function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36).toUpperCase()
}

// 获取或创建客户端ID
export function getClientId(): string {
  // 尝试从 localStorage 获取
  let clientId = localStorage.getItem(CLIENT_ID_KEY)

  if (!clientId) {
    // 生成新的客户端ID：B-指纹-随机数
    const fingerprint = generateBrowserFingerprint()
    const random = Math.random().toString(36).substring(2, 10).toUpperCase()
    clientId = `B-${fingerprint}-${random}`
    localStorage.setItem(CLIENT_ID_KEY, clientId)
  }

  return clientId
}

// 用户基金接口
export interface UserFund {
  fundCode: string
  fundName: string
  isHeld: boolean
  share: number
  cost: number
  amount: number
  holdingDate?: string
  settled?: boolean
  lastSettledDate?: string
  accumulatedProfit?: number
  currentDayProfit?: number
  currentDayProfitRate?: number
  profitType?: 'estimate' | 'final'
  lastProfitDate?: string
  addedAt: number
}

// 用户偏好接口（不包含基金列表，基金列表从 user_funds API 获取）
export interface UserPreferences {
  userId: string
  hideAmount: boolean
  viewMode: 'grid' | 'list'
  sortField: string
  sortDirection: 'desc' | 'asc'
  filterMode: 'all' | 'held'
  migratedFromLocal: boolean
  lastUpdated: number
  isTempUser?: boolean  // 是否是临时用户
}

// 持仓接口
export interface Holding {
  fundCode: string
  fundName: string
  share: number
  cost: number
  amount: number
  holdingDate: string
}

// 获取用户偏好
export async function getUserPreferences(): Promise<UserPreferences> {
  const clientId = getClientId()
  const response = await axios.get<UserPreferences>(`${API_BASE}/user/preferences`, {
    headers: { 'X-Client-Id': clientId }
  })
  return response.data
}

// 保存用户偏好
export async function saveUserPreferences(prefs: Partial<UserPreferences>): Promise<UserPreferences> {
  const clientId = getClientId()
  const response = await axios.post<{ success: boolean; preferences: UserPreferences }>(
    `${API_BASE}/user/preferences`,
    prefs,
    { headers: { 'X-Client-Id': clientId } }
  )
  return response.data.preferences
}

// 从浏览器缓存迁移数据到数据库
export async function migrateFromLocal(data: {
  favoriteFunds?: string[]
  heldFunds?: string[]
  holdings?: Record<string, Holding>
  hideAmount?: boolean
  viewMode?: 'grid' | 'list'
  sortField?: string
  sortDirection?: 'desc' | 'asc'
}): Promise<{ success: boolean; message: string; alreadyMigrated: boolean }> {
  const clientId = getClientId()
  const response = await axios.post(`${API_BASE}/migrate/from-local`, data, {
    headers: { 'X-Client-Id': clientId }
  })
  return response.data
}

// 获取持仓数据
export async function getHoldings(): Promise<Holding[]> {
  const clientId = getClientId()
  const response = await axios.get<Holding[]>(`${API_BASE}/user/holdings`, {
    headers: { 'X-Client-Id': clientId }
  })
  return response.data
}

export interface SaveHoldingResponse {
  success: boolean
  error?: string
  holding?: {
    fundCode: string
    amount: number
    share?: number
    cost?: number
    totalCost?: number
    settled: boolean
    lastSettledDate: string
    currentDayProfit: number
    accumulatedProfit: number
  }
}

// 保存单个持仓
export async function saveHolding(holding: Holding): Promise<SaveHoldingResponse> {
  const clientId = getClientId()
  const response = await axios.post(`${API_BASE}/user/holdings`, holding, {
    headers: { 'X-Client-Id': clientId }
  })
  return response.data
}

// 删除持仓
export async function deleteHolding(code: string): Promise<{ success: boolean }> {
  const clientId = getClientId()
  const response = await axios.delete(`${API_BASE}/user/holdings/${code}`, {
    headers: { 'X-Client-Id': clientId }
  })
  return response.data
}

// 获取用户所有基金
export async function getUserFunds(): Promise<UserFund[]> {
  const clientId = getClientId()
  const response = await axios.get<UserFund[]>(`${API_BASE}/user/funds`, {
    headers: { 'X-Client-Id': clientId }
  })
  return response.data
}

// 添加基金到自选
export async function addUserFund(fundCode: string, fundName?: string): Promise<{ success: boolean }> {
  const clientId = getClientId()
  const response = await axios.post(`${API_BASE}/user/funds`, { fundCode, fundName }, {
    headers: { 'X-Client-Id': clientId }
  })
  return response.data
}

// 批量添加基金
export async function addUserFundsBatch(funds: Array<{ code: string; fundName?: string }>): Promise<{ success: boolean; count: number }> {
  const clientId = getClientId()
  const response = await axios.post(`${API_BASE}/user/funds/batch`, { funds }, {
    headers: { 'X-Client-Id': clientId }
  })
  return response.data
}

// 删除基金
export async function deleteUserFund(fundCode: string): Promise<{ success: boolean }> {
  const clientId = getClientId()
  const response = await axios.delete<{ success: boolean }>(`${API_BASE}/user/funds/${fundCode}`, {
    headers: { 'X-Client-Id': clientId }
  })
  return response.data
}

// 获取推荐基金列表
export async function getRecommendFunds(): Promise<{ codes: string[] }> {
  const response = await axios.get<{ codes: string[] }>(`${API_BASE}/recommend-funds`)
  return response.data
}
