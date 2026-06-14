import { defineStore } from 'pinia'
import { ref } from 'vue'
import { wechatLogin as wxLogin, checkSession, logout as apiLogout } from '@/api/auth'
import { clearSessionToken } from '@/utils/request'
import type { UserInfo } from '@/api/auth'

export const useAuthStore = defineStore('auth', () => {
  const isLoggedIn = ref(false)
  const user = ref<UserInfo | null>(null)
  const loading = ref(false)

  async function wechatLogin() {
    loading.value = true
    try {
      const loginRes = await new Promise<UniApp.LoginRes>((resolve, reject) => {
        uni.login({
          provider: 'weixin',
          success: resolve,
          fail: reject
        })
      })

      const result = await wxLogin(loginRes.code)
      if (result.success && result.user) {
        isLoggedIn.value = true
        user.value = result.user
      }
      return result
    } catch (e: any) {
      console.error('微信登录失败:', e)
      return { success: false, message: e.message || '登录失败' }
    } finally {
      loading.value = false
    }
  }

  async function checkUserSession() {
    loading.value = true
    try {
      const data = await checkSession()
      if (data.isLoggedIn && data.user) {
        isLoggedIn.value = true
        user.value = data.user
      } else {
        isLoggedIn.value = false
        user.value = null
      }
    } catch {
      isLoggedIn.value = false
      user.value = null
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      await apiLogout()
    } finally {
      clearSessionToken()
      isLoggedIn.value = false
      user.value = null
    }
  }

  return {
    isLoggedIn,
    user,
    loading,
    wechatLogin,
    checkUserSession,
    logout
  }
})
