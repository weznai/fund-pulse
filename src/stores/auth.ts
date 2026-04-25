import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const AUTH_SESSION_KEY = 'auth_session'
const AUTH_USER_KEY = 'auth_user'

// 延迟获取 fundStore，避免循环引用
let fundStoreInstance: ReturnType<typeof import('./fund').useFundStore> | null = null
async function getFundStore() {
  if (!fundStoreInstance) {
    const { useFundStore } = await import('./fund')
    fundStoreInstance = useFundStore()
  }
  return fundStoreInstance
}

export interface User {
  id: string
  username: string
  email: string
}

export const useAuthStore = defineStore('auth', () => {
  const isLoggedIn = ref<boolean>(false)
  const user = ref<User | null>(null)
  const loading = ref<boolean>(false)

  // 计算属性：获取用户名或邮箱
  const username = computed(() => user.value?.username || null)
  const email = computed(() => user.value?.email || null)

  // 检查用户名是否可用
  async function checkUsername(usernameValue: string): Promise<{ available: boolean; message: string }> {
    try {
      const response = await fetch(`/api/auth/check-username?username=${encodeURIComponent(usernameValue)}`)
      const data = await response.json()
      return { available: data.available, message: data.message || '' }
    } catch (error) {
      console.error('检查用户名失败:', error)
      return { available: false, message: '检查用户名失败' }
    }
  }

  // 检查邮箱是否可用
  async function checkEmail(emailValue: string): Promise<{ available: boolean; message: string }> {
    try {
      const response = await fetch(`/api/auth/check-email?email=${encodeURIComponent(emailValue)}`)
      const data = await response.json()
      return { available: data.available, message: data.message || '' }
    } catch (error) {
      console.error('检查邮箱失败:', error)
      return { available: false, message: '检查邮箱失败' }
    }
  }

  // 发送注册验证码
  async function sendRegisterOtp(
    usernameValue: string,
    emailAddress: string,
    passwordValue: string
  ): Promise<{ success: boolean; message: string; directSuccess?: boolean }> {
    loading.value = true

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: usernameValue,
          email: emailAddress,
          password: passwordValue
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        if (data.user) {
          isLoggedIn.value = true
          user.value = data.user
          saveSessionToStorage(emailAddress, data.user)
          await loadUserDataFromServer()
          return { success: true, message: data.message || '注册成功', directSuccess: true }
        }
        return { success: true, message: data.message || '验证码已发送' }
      } else {
        return { success: false, message: data.message || '发送验证码失败' }
      }
    } catch (error) {
      console.error('发送注册验证码失败:', error)
      return { success: false, message: '发送验证码失败，请稍后重试' }
    } finally {
      loading.value = false
    }
  }

  // 完成注册（验证邮箱）
  async function verifyRegister(
    usernameValue: string,
    emailAddress: string,
    passwordValue: string,
    otpValue: string
  ): Promise<{ success: boolean; message: string }> {
    loading.value = true

    try {
      const response = await fetch('/api/auth/register/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: usernameValue,
          email: emailAddress,
          password: passwordValue,
          otp: otpValue
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // 更新 state
        isLoggedIn.value = true
        user.value = data.user

        saveSessionToStorage(emailAddress, data.user)

        await loadUserDataFromServer()

        return { success: true, message: data.message || '注册成功' }
      } else {
        return { success: false, message: data.message || '注册失败' }
      }
    } catch (error) {
      console.error('完成注册失败:', error)
      return { success: false, message: '注册失败，请稍后重试' }
    } finally {
      loading.value = false
    }
  }

  // 用户登录（用户名或邮箱 + 密码）
  async function login(
    identifier: string,
    passwordValue: string
  ): Promise<{ success: boolean; message: string }> {
    loading.value = true

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          identifier,
          password: passwordValue
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // 更新 state
        isLoggedIn.value = true
        user.value = data.user

        saveSessionToStorage(identifier, data.user)

        await loadUserDataFromServer()

        return { success: true, message: data.message || '登录成功' }
      } else {
        return { success: false, message: data.message || '登录失败' }
      }
    } catch (error) {
      console.error('登录失败:', error)
      return { success: false, message: '登录失败，请稍后重试' }
    } finally {
      loading.value = false
    }
  }

  async function loadUserDataFromServer(): Promise<void> {
    try {
      const fundStore = await getFundStore()
      await fundStore.loadFromDatabase()
      fundStore.fetchFavorites()
      console.log('✅ 从服务端加载用户数据完成')
    } catch (error) {
      console.error('加载用户数据失败:', error)
    }
  }

  

  // 登出
  async function logout(): Promise<void> {
    loading.value = true

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
    } catch (error) {
      console.error('登出请求失败:', error)
    } finally {
      loading.value = false
    }

    // 清除 localStorage 中的会话
    clearSessionFromStorage()

    // 重置 state
    resetState()

    // 切换回本地存储模式
    try {
      const fundStore = await getFundStore()
      await fundStore.switchToLocalMode()
      fundStore.fetchFavorites()
    } catch (error) {
      console.error('切换到本地模式失败:', error)
    }
  }

  // 修改密码（需要验证原密码）
  async function changePassword(
    identifier: string,
    oldPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    loading.value = true

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          identifier,
          oldPassword,
          newPassword
        })
      })

      const data = await response.json()

      return { success: response.ok && data.success, message: data.message || (response.ok ? '密码修改成功' : '密码修改失败') }
    } catch (error) {
      console.error('修改密码失败:', error)
      return { success: false, message: '修改密码失败，请稍后重试' }
    } finally {
      loading.value = false
    }
  }

  // 忘记密码（发送验证码）
  async function forgotPassword(email: string): Promise<{ success: boolean; message: string; skipVerify?: boolean }> {
    loading.value = true

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      return { 
        success: response.ok && data.success, 
        message: data.message || (response.ok ? '验证码已发送' : '发送验证码失败'),
        skipVerify: data.skipVerify
      }
    } catch (error) {
      console.error('忘记密码失败:', error)
      return { success: false, message: '发送验证码失败，请稍后重试' }
    } finally {
      loading.value = false
    }
  }

  // 重置密码（验证邮箱验证码）
  async function resetPassword(
    email: string,
    otp: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    loading.value = true

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          otp,
          newPassword
        })
      })

      const data = await response.json()

      return { success: response.ok && data.success, message: data.message || (response.ok ? '密码重置成功' : '密码重置失败') }
    } catch (error) {
      console.error('重置密码失败:', error)
      return { success: false, message: '重置密码失败，请稍后重试' }
    } finally {
      loading.value = false
    }
  }

  // 检查会话状态
  async function checkSession(): Promise<void> {
    loading.value = true

    const clientId = localStorage.getItem('client_id')

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      if (clientId) {
        headers['X-Client-Id'] = clientId
      }

      const response = await fetch('/api/auth/session', {
        method: 'GET',
        headers,
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()

        if (data.isLoggedIn && data.user) {
          isLoggedIn.value = true
          user.value = data.user
          saveSessionToStorage(data.user.email, data.user)
        } else {
          clearSessionFromStorage()
          resetState()
        }
      } else {
        clearSessionFromStorage()
        resetState()
      }
    } catch (error) {
      console.error('检查会话状态失败:', error)
      const storedSession = getSessionFromStorage()
      if (storedSession) {
        isLoggedIn.value = true
        user.value = storedSession.user
      } else {
        resetState()
      }
    } finally {
      loading.value = false
    }
  }

  // 保存会话到 localStorage
  function saveSessionToStorage(identifier: string, userData: User): void {
    try {
      localStorage.setItem(AUTH_SESSION_KEY, identifier)
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData))
    } catch (error) {
      console.error('保存会话到 localStorage 失败:', error)
    }
  }

  // 从 localStorage 获取会话
  function getSessionFromStorage(): { identifier: string; user: User } | null {
    try {
      const identifier = localStorage.getItem(AUTH_SESSION_KEY)
      const userStr = localStorage.getItem(AUTH_USER_KEY)

      if (identifier && userStr) {
        return {
          identifier,
          user: JSON.parse(userStr)
        }
      }
      return null
    } catch (error) {
      console.error('从 localStorage 获取会话失败:', error)
      return null
    }
  }

  // 清除 localStorage 中的会话
  function clearSessionFromStorage(): void {
    try {
      localStorage.removeItem(AUTH_SESSION_KEY)
      localStorage.removeItem(AUTH_USER_KEY)
    } catch (error) {
      console.error('清除 localStorage 会话失败:', error)
    }
  }

  // 重置 state
  function resetState(): void {
    isLoggedIn.value = false
    user.value = null
    loading.value = false
  }

  return {
    isLoggedIn,
    user,
    username,
    email,
    loading,
    checkUsername,
    checkEmail,
    sendRegisterOtp,
    verifyRegister,
    login,
    logout,
    checkSession,
    changePassword,
    forgotPassword,
    resetPassword
  }
})
