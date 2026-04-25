import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import axios from 'axios'

// 获取或创建客户端唯一ID
function getClientId(): string {
  let clientId = localStorage.getItem('client_id')
  if (!clientId) {
    // 生成新的客户端ID: C- 开头表示客户端生成
    clientId = 'C-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9)
    localStorage.setItem('client_id', clientId)
    console.log('🆔 生成新客户端ID:', clientId)
  }
  return clientId
}

// 配置 axios 默认行为
axios.interceptors.request.use(
  (config) => {
    // 为用户相关API添加客户端ID
    if (config.url?.startsWith('/api/')) {
      config.headers['X-Client-Id'] = getClientId()
    }

    // 如果是管理后台 API，添加认证 token
    if (config.url?.startsWith('/api/admin') && !config.url.includes('/login')) {
      const token = localStorage.getItem('admin_token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器：处理 401 错误
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 如果是管理后台 API 返回 401，清除 token 并跳转到登录页
      if (error.config?.url?.startsWith('/api/admin')) {
        localStorage.removeItem('admin_token')
        window.location.href = '/admin/login'
      }
    }
    return Promise.reject(error)
  }
)

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
