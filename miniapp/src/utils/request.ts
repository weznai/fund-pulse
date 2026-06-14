export const BASE_URL = 'https://fund.wezin.cn'

const SESSION_TOKEN_KEY = 'fund_session_token'
const CLIENT_ID_KEY = 'fund_client_id'

function generateClientId(): string {
  const random = Math.random().toString(36).substring(2, 10).toUpperCase()
  return `M-${random}`
}

export function getClientId(): string {
  let clientId = uni.getStorageSync(CLIENT_ID_KEY)
  if (!clientId) {
    clientId = generateClientId()
    uni.setStorageSync(CLIENT_ID_KEY, clientId)
  }
  return clientId
}

export function getSessionToken(): string {
  return uni.getStorageSync(SESSION_TOKEN_KEY) || ''
}

export function setSessionToken(token: string): void {
  uni.setStorageSync(SESSION_TOKEN_KEY, token)
}

export function clearSessionToken(): void {
  uni.removeStorageSync(SESSION_TOKEN_KEY)
}

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  header?: Record<string, string>
}

interface ApiResponse<T = any> {
  data: T
  statusCode: number
}

export function request<T = any>(options: RequestOptions): Promise<ApiResponse<T>> {
  return new Promise((resolve, reject) => {
    const header: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.header
    }

    header['X-Client-Id'] = getClientId()

    const token = getSessionToken()
    if (token) {
      header['Authorization'] = `Bearer ${token}`
    }

    uni.request({
      url: `${BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data,
      header,
      success: (res) => {
        if (res.statusCode === 401) {
          clearSessionToken()
          reject(new Error('Unauthorized'))
          return
        }
        resolve({
          data: res.data as T,
          statusCode: res.statusCode
        })
      },
      fail: (err) => {
        reject(new Error(err.errMsg || 'Network Error'))
      }
    })
  })
}

export function get<T = any>(url: string, data?: any): Promise<T> {
  return request<T>({ url, method: 'GET', data }).then(res => res.data)
}

export function post<T = any>(url: string, data?: any): Promise<T> {
  return request<T>({ url, method: 'POST', data }).then(res => res.data)
}

export function del<T = any>(url: string, data?: any): Promise<T> {
  return request<T>({ url, method: 'DELETE', data }).then(res => res.data)
}

export function put<T = any>(url: string, data?: any): Promise<T> {
  return request<T>({ url, method: 'PUT', data }).then(res => res.data)
}
