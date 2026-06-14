<template>
  <view class="page">
    <view class="profile-header">
      <view class="profile-bg"></view>
      <view class="profile-content">
        <view class="avatar" @tap="handleLogin">
          <text class="avatar-text">{{ avatarText }}</text>
        </view>
        <text class="username">{{ displayUsername }}</text>
        <view class="login-badge">
          <text class="login-badge-text">{{ isLoggedIn ? '已登录' : '点击登录' }}</text>
        </view>
      </view>
    </view>

    <view class="stats-row">
      <view class="stat-item">
        <text class="stat-value">{{ favoriteCount }}</text>
        <text class="stat-label">自选</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-value">{{ holdingCount }}</text>
        <text class="stat-label">持仓</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-value">{{ isLoggedIn ? 'VIP' : '--' }}</text>
        <text class="stat-label">等级</text>
      </view>
    </view>

    <view class="menu-section">
      <view class="menu-item" @tap="goAbout">
        <view class="menu-icon-wrap" style="background: #eff6ff;">
          <text class="menu-icon-text" style="color: #3b82f6;">ℹ</text>
        </view>
        <text class="menu-label">关于</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="goSuggestions">
        <view class="menu-icon-wrap" style="background: #fef3c7;">
          <text class="menu-icon-text" style="color: #f59e0b;">✉</text>
        </view>
        <text class="menu-label">建议与反馈</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <view v-if="isLoggedIn" class="logout-section">
      <view class="btn-logout" @tap="handleLogout">
        <text class="logout-text">退出登录</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import { useFundStore } from '@/stores/fund'

const authStore = useAuthStore()
const fundStore = useFundStore()

const isLoggedIn = computed(() => authStore.isLoggedIn)
const displayUsername = computed(() => {
  if (authStore.user?.username) return authStore.user.username
  if (authStore.user?.email) return authStore.user.email
  return '未登录'
})
const avatarText = computed(() => {
  if (authStore.user?.username) return authStore.user.username.charAt(0).toUpperCase()
  if (authStore.user?.email) return authStore.user.email.charAt(0).toUpperCase()
  return '?'
})

const favoriteCount = computed(() => fundStore.favoriteCodes.length)
const holdingCount = computed(() => {
  let count = 0
  for (const code of fundStore.favoriteCodes) {
    if (fundStore.isHeld(code)) count++
  }
  return count
})

async function handleLogin() {
  if (isLoggedIn.value) return
  const result = await authStore.wechatLogin()
  if (result.success) {
    uni.showToast({ title: '登录成功', icon: 'success' })
  } else {
    uni.showToast({ title: result.message || '登录失败', icon: 'none' })
  }
}

async function handleLogout() {
  uni.showModal({
    title: '确认退出',
    content: '确定要退出登录吗？',
    success: async (res) => {
      if (res.confirm) {
        await authStore.logout()
        uni.showToast({ title: '已退出', icon: 'success' })
      }
    }
  })
}

function goAbout() {
  uni.navigateTo({ url: '/pages/mine/about' })
}

function goSuggestions() {
  uni.navigateTo({ url: '/pages/mine/suggestions' })
}

onShow(() => {
  authStore.checkUserSession()
})
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f6fa;
}

.profile-header {
  position: relative;
  padding: 0 32rpx 48rpx;
}

.profile-bg {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  border-radius: 0 0 40rpx 40rpx;
}

.profile-content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: calc(var(--status-bar-height, 0px) + 60rpx);
}

.avatar {
  width: 128rpx;
  height: 128rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
  border: 4rpx solid rgba(255, 255, 255, 0.3);
}

.avatar-text {
  font-size: 52rpx;
  font-weight: 700;
  color: #fff;
}

.username {
  font-size: 34rpx;
  font-weight: 600;
  color: #fff;
  margin-bottom: 12rpx;
}

.login-badge {
  background: rgba(255, 255, 255, 0.15);
  padding: 6rpx 24rpx;
  border-radius: 20rpx;
}

.login-badge-text {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.8);
}

.stats-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 48rpx;
  background: #fff;
  margin: -24rpx 24rpx 24rpx;
  border-radius: 20rpx;
  padding: 28rpx 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  position: relative;
  z-index: 5;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.stat-value {
  font-size: 32rpx;
  font-weight: 700;
  color: #111827;
  font-family: 'SF Mono', Consolas, monospace;
}

.stat-label {
  font-size: 22rpx;
  color: #94a3b8;
}

.stat-divider {
  width: 1rpx;
  height: 48rpx;
  background: #f1f5f9;
}

.menu-section {
  margin: 0 24rpx;
  background: #fff;
  border-radius: 20rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 32rpx 28rpx;
  border-bottom: 1rpx solid #f8fafc;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-icon-wrap {
  width: 56rpx;
  height: 56rpx;
  border-radius: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
}

.menu-icon-text {
  font-size: 28rpx;
  font-weight: 700;
}

.menu-label {
  font-size: 28rpx;
  color: #111827;
  flex: 1;
}

.menu-arrow {
  font-size: 32rpx;
  color: #d1d5db;
}

.logout-section {
  margin: 48rpx 24rpx;
}

.btn-logout {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx 0;
  text-align: center;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.logout-text {
  color: #ef4444;
  font-size: 30rpx;
  font-weight: 500;
}
</style>
