<template>
  <div class="admin-layout" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <!-- 头部 -->
    <header class="admin-header">
      <div class="header-left">
        <div class="logo">
          <svg viewBox="0 0 24 24" fill="none" class="logo-icon">
            <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="logo-text">基金管理后台</span>
        </div>
      </div>
      <div class="header-right">
        <button class="logout-btn" @click="handleLogout">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1-2-2h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="16 17 21 12 16 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          退出
        </button>
        <a href="/" class="back-link">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2-2H5a2 2 0 0 1-2-2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          首页
        </a>
      </div>
    </header>

    <div class="admin-body">
      <!-- 左侧菜单 -->
      <aside class="admin-sidebar">
        <!-- 侧边栏标题区域 -->
        <div class="sidebar-header">
          <span class="sidebar-title" v-show="!sidebarCollapsed">管理员</span>
          <button class="sidebar-collapse-btn" @click="toggleSidebar" :title="sidebarCollapsed ? '展开菜单' : '收起菜单'">
            <svg viewBox="0 0 24 24" fill="none">
              <path v-if="!sidebarCollapsed" d="M11 19l-7-7 7-7M18 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path v-else d="M13 5l7 7-7 7M6 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <nav class="sidebar-nav">
          <router-link
            v-for="item in menuItems"
            :key="item.path"
            :to="item.path"
            class="nav-item"
            :class="{ active: isActive(item.path) }"
            :title="item.title"
          >
            <component :is="item.icon" class="nav-icon" />
            <span class="nav-text">{{ item.title }}</span>
          </router-link>
        </nav>
      </aside>

      <!-- 右侧内容区 -->
      <main class="admin-content">
        <!-- 面包屑导航 -->
        <div class="breadcrumb-wrapper">
          <nav class="breadcrumb">
            <span class="breadcrumb-item">
              <svg viewBox="0 0 24 24" fill="none" class="breadcrumb-icon">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2-2H5a2 2 0 0 1-2-2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              首页
            </span>
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-item active">{{ currentPageTitle }}</span>
          </nav>
        </div>
        <!-- 页面内容 -->
        <div class="page-wrapper">
          <router-view />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

let originalFavicon: string | null = null

onMounted(() => {
  const link: HTMLLinkElement | null = document.querySelector("link[rel='icon']")
  if (link) {
    originalFavicon = link.href
    link.href = '/admin-favicon.svg'
  }
})

onUnmounted(() => {
  const link: HTMLLinkElement | null = document.querySelector("link[rel='icon']")
  if (link && originalFavicon) {
    link.href = originalFavicon
  }
})

// 侧边栏折叠状态
const sidebarCollapsed = ref(false)

// 切换侧边栏折叠状态
function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

// 菜单项
const menuItems = [
  {
    path: '/admin/fund-manage',
    title: '基金管理',
    icon: {
      render() {
        return h('svg', { viewBox: '0 0 24 24', fill: 'none' }, [
          h('rect', {
            x: '3',
            y: '3',
            width: '18',
            height: '18',
            rx: '3',
            stroke: 'currentColor',
            'stroke-width': '1.8',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round'
          }),
          h('path', {
            d: 'M7 8h10M7 12h6M7 16h8',
            stroke: 'currentColor',
            'stroke-width': '1.8',
            'stroke-linecap': 'round'
          }),
          h('circle', {
            cx: '17',
            cy: '15',
            r: '4',
            fill: 'currentColor',
            'fill-opacity': '0.15',
            stroke: 'currentColor',
            'stroke-width': '1.5'
          }),
          h('path', {
            d: 'M15.5 15 1 2-2',
            stroke: 'currentColor',
            'stroke-width': '1.5',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round'
          })
        ])
      }
    }
  },
  {
    path: '/admin/user-manage',
    title: '用户管理',
    icon: {
      render() {
        return h('svg', { viewBox: '0 0 24 24', fill: 'none' }, [
          h('circle', {
            cx: '12',
            cy: '7',
            r: '4',
            fill: 'currentColor',
            'fill-opacity': '0.15',
            stroke: 'currentColor',
            'stroke-width': '1.8'
          }),
          h('path', {
            d: 'M5.5 21v-2a4 4 0 0 1 4-4h5a4 4 0 0 1 4 4v2',
            stroke: 'currentColor',
            'stroke-width': '1.8',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round'
          }),
          h('circle', {
            cx: '18',
            cy: '11',
            r: '2.5',
            fill: 'currentColor',
            'fill-opacity': '0.1',
            stroke: 'currentColor',
            'stroke-width': '1.5'
          }),
          h('path', {
            d: 'M20 17v2',
            stroke: 'currentColor',
            'stroke-width': '1.5',
            'stroke-linecap': 'round'
          })
        ])
      }
    }
  },
  {
    path: '/admin/system-params',
    title: '参数管理',
    icon: {
      render() {
        return h('svg', { viewBox: '0 0 24 24', fill: 'none' }, [
          h('circle', {
            cx: '12',
            cy: '12',
            r: '3',
            stroke: 'currentColor',
            'stroke-width': '1.8'
          }),
          h('path', {
            d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z',
            stroke: 'currentColor',
            'stroke-width': '1.5',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round'
          })
        ])
      }
    }
  },
  {
    path: '/admin/visit-stats',
    title: '访问管理',
    icon: {
      render() {
        return h('svg', { viewBox: '0 0 24 24', fill: 'none' }, [
          h('path', {
            d: 'M3 3v18h18',
            stroke: 'currentColor',
            'stroke-width': '1.8',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round'
          }),
          h('path', {
            d: 'M3 9h18M3 15h18',
            stroke: 'currentColor',
            'stroke-width': '1.5',
            'stroke-linecap': 'round'
          }),
          h('circle', {
            cx: '12',
            cy: '12',
            r: '3',
            fill: 'currentColor',
            'fill-opacity': '0.2'
          })
        ])
      }
    }
  },
  {
    path: '/admin/task-manage',
    title: '任务管理',
    icon: {
      render() {
        return h('svg', { viewBox: '0 0 24 24', fill: 'none' }, [
          h('rect', {
            x: '3',
            y: '4',
            width: '18',
            height: '18',
            rx: '2',
            stroke: 'currentColor',
            'stroke-width': '1.8'
          }),
          h('line', {
            x1: '16',
            y1: '2',
            x2: '16',
            y2: '6',
            stroke: 'currentColor',
            'stroke-width': '1.8',
            'stroke-linecap': 'round'
          }),
          h('line', {
            x1: '8',
            y1: '2',
            x2: '8',
            y2: '6',
            stroke: 'currentColor',
            'stroke-width': '1.8',
            'stroke-linecap': 'round'
          }),
          h('line', {
            x1: '3',
            y1: '10',
            x2: '21',
            y2: '10',
            stroke: 'currentColor',
            'stroke-width': '1.8'
          }),
          h('path', {
            d: 'M8 14l2 2 4-4',
            stroke: 'currentColor',
            'stroke-width': '1.8',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round'
          })
        ])
      }
    }
  }
]

const isActive = (path: string) => {
  return route.path === path || route.path.startsWith(path + '/')
}

const currentPageTitle = computed(() => {
  const item = menuItems.find(m => m.path === route.path || route.path.startsWith(m.path + '/'))
  return item?.title || '管理后台'
})

// 退出登录
function handleLogout() {
  localStorage.removeItem('admin_token')
  router.push('/admin/login')
}
</script>

<style scoped>
.admin-layout {
  min-height: 100vh;
  background: linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%);
}

/* 头部 */
.admin-header {
  height: 64px;
  background: #1e3a5f;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  width: 28px;
  height: 28px;
  color: #fff;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.85);
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.3);
  font-size: 14px;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.logout-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.logout-btn svg {
  width: 16px;
  height: 16px;
}

.back-link {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.85);
  text-decoration: none;
  font-size: 14px;
  padding: 8px 16px;
  border-radius: 6px;
  transition: all 0.2s;
}

.back-link:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.back-link svg {
  width: 16px;
  height: 16px;
}

/* 主体区域 */
.admin-body {
  display: flex;
  padding-top: 64px;
  min-height: calc(100vh - 64px);
}

/* 侧边栏 */
.admin-sidebar {
  width: 220px;
  background: #fff;
  border-right: 1px solid #e5e7eb;
  position: fixed;
  top: 64px;
  left: 0;
  bottom: 0;
  overflow-y: auto;
  transition: width 0.3s ease;
}

/* 折叠状态下的侧边栏 */
.sidebar-collapsed .admin-sidebar {
  width: 64px;
}

.sidebar-collapsed .nav-text {
  display: none;
}

.sidebar-collapsed .nav-item {
  justify-content: center;
  padding: 12px;
}

/* 折叠状态下显示 tooltip */
.sidebar-collapsed .nav-item {
  position: relative;
}

.sidebar-collapsed .nav-item:hover::after {
  content: attr(title);
  position: absolute;
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-left: 8px;
  padding: 6px 12px;
  background: #1e3a5f;
  color: #fff;
  font-size: 13px;
  border-radius: 4px;
  white-space: nowrap;
  z-index: 1000;
}

/* 侧边栏标题区域 */
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
  min-height: 56px;
}

.sidebar-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e3a5f;
  white-space: nowrap;
}

.sidebar-collapse-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.sidebar-collapse-btn:hover {
  background: #e2e8f0;
  border-color: #cbd5e1;
}

.sidebar-collapse-btn svg {
  width: 16px;
  height: 16px;
  color: #475569;
}

/* 折叠状态下的标题区域 */
.sidebar-collapsed .sidebar-header {
  justify-content: center;
  padding: 12px;
}

.sidebar-nav {
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  color: #475569;
  text-decoration: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.nav-item:hover {
  background: #f1f5f9;
  color: #1e3a5f;
}

.nav-item.active {
  background: #e0f2fe;
  color: #1e3a5f;
}

.nav-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: #3b82f6;
}

/* 内容区 */
.admin-content {
  flex: 1;
  margin-left: 220px;
  padding: 24px;
  min-height: calc(100vh - 64px);
  overflow-y: auto;
  height: calc(100vh - 64px);
  transition: margin-left 0.3s ease;
}

/* 折叠状态下的内容区 */
.sidebar-collapsed .admin-content {
  margin-left: 64px;
}

/* 面包屑导航 */
.breadcrumb-wrapper {
  position: relative;
  background: #fff;
  padding: 12px 24px;
  border-bottom: 1px solid #e5e7eb;
  border-radius: 12px;
  margin-bottom: 20px;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.breadcrumb-icon {
  width: 16px;
  height: 16px;
  color: #64748b;
}

.breadcrumb-item {
  color: #64748b;
  font-weight: 500;
}

.breadcrumb-item.active {
  color: #1e3a5f;
  font-weight: 600;
}

.breadcrumb-separator {
  color: #94a3b8;
  margin: 0 4px;
}

.page-wrapper {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 滚动条样式 */
.admin-content::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.admin-content::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.admin-content::-webkit-scrollbar-track {
  background: #f1f5f9;
}

/* 鼠标悬停时滚动条 */

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.breadcrumb-icon {
  width: 16px;
  height: 16px;
  color: #64748b;
}

.breadcrumb-item {
  color: #64748b;
  font-weight: 500;
}

.breadcrumb-item.active {
  color: #1e3a5f;
  font-weight: 600;
}

.breadcrumb-separator {
  color: #94a3b8;
  margin: 0 4px;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
