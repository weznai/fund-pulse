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
      path: '/news',
      name: 'news',
      component: () => import('@/views/NewsView.vue')
    },
    {
      path: '/news/:id',
      name: 'news-detail',
      component: () => import('@/views/NewsDetailView.vue')
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('@/views/DisclaimerView.vue')
    },
    {
      path: '/agreement',
      name: 'agreement',
      component: () => import('@/views/AgreementView.vue')
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
          redirect: '/admin/dashboard'
        },
        {
          path: 'dashboard',
          name: 'admin-dashboard',
          component: () => import('@/views/admin/DashboardView.vue')
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
          path: 'estimate-source',
          name: 'admin-estimate-source',
          component: () => import('@/views/admin/EstimateSourceView.vue')
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
        },
        {
          path: 'report-manage',
          name: 'admin-report-manage',
          component: () => import('@/views/admin/ReportManageView.vue')
        },
        {
          path: 'news-manage',
          name: 'admin-news-manage',
          component: () => import('@/views/admin/NewsManageView.vue')
        },
        {
          path: 'admin-accounts',
          name: 'admin-admin-accounts',
          component: () => import('@/views/admin/AdminAccountManageView.vue')
        },
        {
          path: 'system-update',
          name: 'admin-system-update',
          component: () => import('@/views/admin/SystemUpdateView.vue')
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

// 各后台角色的访问首页（未配置的角色拥有全部权限）
const ADMIN_ROLE_HOME: Record<string, string> = {
  news: '/admin/news-manage'
}

function getAdminRole(): string {
  try {
    return JSON.parse(localStorage.getItem('admin_user') || '{}')?.role || 'super'
  } catch {
    return 'super'
  }
}

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('admin_token')

  // /zx/ 子站（wezin.cn/zx/ 资讯站）默认落地资讯页
  if (to.path === '/' && import.meta.env.BASE_URL.startsWith('/zx')) {
    return next('/news')
  }

  if (to.meta.requiresAuth && !token) {
    return next({
      name: 'admin-login',
      query: { redirect: to.fullPath }
    })
  }

  // 受限角色（如 news）只能访问自己的首页，其余一律重定向回去
  const roleHome = ADMIN_ROLE_HOME[getAdminRole()]
  if (roleHome && to.path.startsWith('/admin') && to.path !== '/admin/login'
    && to.path !== roleHome && !to.path.startsWith(roleHome + '/')) {
    return next(roleHome)
  }

  if (to.meta.guest && token) {
    next(ADMIN_ROLE_HOME[getAdminRole()] || '/admin/fund-manage')
  } else {
    next()
  }
})

router.afterEach((to) => {
  if (to.path.startsWith('/admin')) return
  recordVisit(to.path)
})

export default router
