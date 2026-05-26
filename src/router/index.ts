import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/suggestions',
      name: 'suggestions',
      component: () => import('@/views/SuggestionView.vue')
    },
    {
      path: '/revenue-analysis',
      name: 'revenue-analysis',
      component: () => import('@/views/RevenueAnalysisView.vue')
    },
    {
      path: '/smart-analysis',
      name: 'smart-analysis',
      component: () => import('@/views/SmartAnalysisView.vue')
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('@/views/DisclaimerView.vue')
    },
    {
      path: '/admin/login',
      name: 'admin-login',
      component: () => import('@/views/admin/AdminLoginView.vue'),
      meta: { guest: true }
    },
    {
      path: '/admin',
      component: () => import('@/views/admin/AdminLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: '/admin/fund-manage'
        },
        {
          path: 'fund-manage',
          name: 'admin-fund-manage',
          component: () => import('@/views/admin/FundManageView.vue')
        },
        {
          path: 'user-manage',
          name: 'admin-user-manage',
          component: () => import('@/views/admin/UserManageView.vue')
        },
        {
          path: 'user-holdings/:userId',
          name: 'admin-user-holdings',
          component: () => import('@/views/admin/UserHoldingsView.vue')
        },
        {
          path: 'visit-stats',
          name: 'admin-visit-stats',
          component: () => import('@/views/admin/VisitStatsView.vue')
        },
        {
          path: 'system-params',
          name: 'admin-system-params',
          component: () => import('@/views/admin/SystemParamsView.vue')
        },
        {
          path: 'operation-logs',
          name: 'admin-operation-logs',
          component: () => import('@/views/admin/OperationLogView.vue')
        },
        {
          path: 'model-manage',
          name: 'admin-model-manage',
          component: () => import('@/views/admin/ModelManageView.vue')
        },

        {
          path: 'suggestion-manage',
          name: 'admin-suggestion-manage',
          component: () => import('@/views/admin/SuggestionManageView.vue')
        },
        {
          path: 'credit-manage',
          name: 'admin-credit-manage',
          component: () => import('@/views/admin/CreditManageView.vue')
        }
      ]
    }
  ]
})

let lastRecordedPath = ''
async function recordVisit(path: string) {
  if (path === lastRecordedPath) return
  lastRecordedPath = path
  
  let clientId = localStorage.getItem('client_id')
  if (!clientId) {
    clientId = 'C-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9)
    localStorage.setItem('client_id', clientId)
  }
  
  try {
    await fetch('/api/visit', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Client-Id': clientId
      },
      credentials: 'include',
      body: JSON.stringify({ path })
    })
  } catch (e) {
    console.error('记录访问失败:', e)
  }
}

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('admin_token')

  if (to.meta.requiresAuth && !token) {
    next({
      name: 'admin-login',
      query: { redirect: to.fullPath }
    })
  } else if (to.meta.guest && token) {
    next({ name: 'admin-fund-manage' })
  } else {
    next()
  }
})

router.afterEach((to) => {
  if (to.path.startsWith('/admin')) return
  recordVisit(to.path)
})

export default router
