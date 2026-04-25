<template>
  <div v-if="visible" class="menu-overlay" @click="handleOverlayClick">
    <div class="user-menu" @click.stop>
      <div class="menu-header">
        <div class="user-info">
          <svg class="menu-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <div class="user-details">
            <div class="user-display-name">{{ username || email }}</div>
            <div v-if="username" class="user-email-sub">{{ email }}</div>
          </div>
        </div>
      </div>
      <div class="menu-divider"></div>
      <button class="menu-item revenue-analysis-btn" @click="goToRevenueAnalysis">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M3 17L9 11L13 15L21 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M17 7H21V11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>收益分析</span>
      </button>
      <button class="menu-item" @click="showChangePassword = true">
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="2"/>
        </svg>
        <span>修改密码</span>
      </button>
      <button class="menu-item" @click="showResetPassword = true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M23 4v6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>重置密码</span>
      </button>
      <div class="menu-divider"></div>
      <button class="menu-item logout" @click="handleLogout">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="16 17 21 12 16 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span>退出登录</span>
      </button>
    </div>

    <PasswordModal
      v-if="showChangePassword"
      mode="change"
      :identifier="email"
      @close="showChangePassword = false"
      @success="handlePasswordSuccess"
    />

    <PasswordModal
      v-if="showResetPassword"
      mode="reset"
      :identifier="email"
      @close="showResetPassword = false"
      @success="handlePasswordSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import PasswordModal from './PasswordModal.vue'

defineProps<{
  visible: boolean
  email: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const router = useRouter()
const authStore = useAuthStore()
const showChangePassword = ref(false)
const showResetPassword = ref(false)

const username = authStore.username

async function handleLogout() {
  await authStore.logout()
  emit('close')
}

function goToRevenueAnalysis() {
  emit('close')
  router.push('/revenue-analysis')
}

function handlePasswordSuccess() {
  showChangePassword.value = false
  showResetPassword.value = false
}

function handleOverlayClick() {
  if (showChangePassword.value || showResetPassword.value) return
  emit('close')
}
</script>

<style scoped>
.menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: transparent;
  z-index: 999;
}

.user-menu {
  position: absolute;
  top: 44px;
  right: 0;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  min-width: 200px;
  padding: 8px 0;
  animation: slideDown 0.15s ease;
  z-index: 1000;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.menu-header {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.menu-icon {
  width: 32px;
  height: 32px;
  color: white;
  background: #4F46E5;
  border-radius: 50%;
  padding: 6px;
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-display-name {
  font-size: 13px;
  color: #374151;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-email-sub {
  font-size: 11px;
  color: #9CA3AF;
}

.menu-divider {
  height: 1px;
  background: #E5E7EB;
  margin: 4px 0;
}

.menu-item {
  width: 100%;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
  transition: background 0.15s ease;
  text-align: left;
}

.menu-item:hover {
  background: #F3F4F6;
}

.menu-item svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.menu-item.logout {
  color: #DC2626;
}

.menu-item.logout:hover {
  background: #FEF2F2;
}

.menu-item.revenue-analysis-btn {
  color: #4F46E5;
}

.menu-item.revenue-analysis-btn:hover {
  background: #EEF2FF;
}

.menu-item.revenue-analysis-btn svg {
  color: #6366F1;
}
</style>
