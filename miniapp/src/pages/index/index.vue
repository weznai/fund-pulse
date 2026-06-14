<template>
  <view class="page">
    <view class="header">
      <view class="header-bg"></view>
      <view class="header-content">
        <view class="header-left">
          <view class="title-icon">
            <text class="icon-text">F</text>
          </view>
          <text class="title">实时基金跟踪</text>
        </view>
        <view class="header-right">
          <view class="refresh-btn" :class="{ spinning: isLoading }" @tap="handleRefresh">
            <text class="refresh-icon">↻</text>
          </view>
        </view>
      </view>
    </view>

    <view class="stats-section">
      <view class="stats-row">
        <view class="stat-main">
          <text class="stat-label">持仓总额</text>
          <text class="stat-value">{{ hideAmount ? '****' : totalAmount }}</text>
        </view>
        <view class="stat-main">
          <text class="stat-label">当日收益</text>
          <text :class="['stat-value', totalProfit >= 0 ? 'profit-up' : 'profit-down']">
            {{ totalProfit >= 0 ? '+' : '' }}{{ totalProfit }}
          </text>
        </view>
        <view class="hide-btn" @tap="toggleHideAmount">
          <text class="hide-text">{{ hideAmount ? '显示' : '隐藏' }}</text>
        </view>
      </view>
    </view>

    <view class="toolbar">
      <view class="search-bar" @tap="goSearch">
        <text class="search-icon">🔍</text>
        <text class="search-placeholder">搜索基金代码/名称</text>
      </view>
      <view class="toolbar-actions">
        <view :class="['filter-btn', { active: filterMode === 'held' }]" @tap="toggleFilter">
          <text class="filter-text">持</text>
        </view>
        <view class="sort-btn" @tap="toggleSort">
          <text class="sort-text">{{ sortDirection === 'desc' ? '↓' : '↑' }}</text>
        </view>
      </view>
    </view>

    <view v-if="isLoading && fundList.length === 0" class="loading">
      <view class="loading-spinner">
        <view class="spinner-dot" v-for="i in 3" :key="i"></view>
      </view>
      <text class="loading-text">加载中...</text>
    </view>

    <view v-else-if="filteredFundList.length === 0" class="empty">
      <view class="empty-icon-wrap">
        <text class="empty-icon">📊</text>
      </view>
      <text class="empty-text">{{ fundList.length === 0 ? '暂无自选基金' : '暂无持仓基金' }}</text>
      <text class="empty-hint" v-if="fundList.length === 0" @tap="goSearch">点击搜索添加基金</text>
    </view>

    <scroll-view v-else class="fund-scroll" scroll-y enhanced :show-scrollbar="false">
      <view class="fund-list">
        <view
          v-for="item in filteredFundList"
          :key="item.code"
          class="fund-item"
          @tap="goDetail(item.code)"
          @longpress="showActions(item)"
        >
          <view class="fund-left">
            <view class="fund-info">
              <text class="fund-name">{{ item.name }}</text>
              <text class="fund-code">{{ item.code }}</text>
            </view>
          </view>
          <view class="fund-right">
            <text :class="['fund-growth', item.growth >= 0 ? 'profit-up' : 'profit-down']">
              {{ item.growthStr }}
            </text>
            <text class="fund-nav">{{ item.navStr }}</text>
            <text class="fund-estimate-time">{{ item.timeStr }}</text>
          </view>
          <view v-if="item.heldAmount > 0" class="fund-holding">
            <text class="holding-amount">{{ hideAmount ? '****' : item.heldAmountStr }}</text>
            <text :class="['holding-profit', item.heldProfit >= 0 ? 'profit-up' : 'profit-down']">
              {{ item.heldProfitStr }}
            </text>
          </view>
        </view>
      </view>
      <view class="bottom-safe"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useFundStore } from '@/stores/fund'
import type { Fund } from '@/api/fund'

const store = useFundStore()

const isLoading = ref(false)
const hideAmount = computed(() => store.hideAmount)
const filterMode = ref<'all' | 'held'>('all')
const sortDirection = computed(() => store.sortDirection)

interface FundItem {
  code: string
  name: string
  growth: number
  growthStr: string
  navStr: string
  timeStr: string
  heldAmount: number
  heldAmountStr: string
  heldProfit: number
  heldProfitStr: string
}

function toItem(fund: Fund): FundItem {
  const today = new Date().toLocaleDateString('sv-SE')
  let growth = 0
  if (fund.jzrq === today && fund.dayGrowth != null) growth = fund.dayGrowth
  else {
    const gt = fund.gztime ? fund.gztime.slice(0, 10) : ''
    if (gt === today && fund.gszzl != null) growth = fund.gszzl
    else growth = fund.dayGrowth ?? fund.gszzl ?? 0
  }

  const h = store.getHolding(fund.code)
  const heldAmount = h ? h.amount : 0
  let heldProfit = 0
  if (h && heldAmount > 0) {
    if (h.settled && h.currentDayProfit != null && h.settleDate === today) {
      heldProfit = h.currentDayProfit
    } else {
      heldProfit = Math.round(heldAmount * growth / 100 * 100) / 100
    }
  }

  return {
    code: fund.code,
    name: fund.name,
    growth,
    growthStr: (growth >= 0 ? '+' : '') + growth.toFixed(2) + '%',
    navStr: (fund.gsz || fund.nav || 0).toFixed(4),
    timeStr: fund.gztime ? fund.gztime.slice(0, 16) : '',
    heldAmount,
    heldAmountStr: '¥' + heldAmount.toFixed(2),
    heldProfit,
    heldProfitStr: (heldProfit >= 0 ? '+' : '') + '¥' + Math.abs(heldProfit).toFixed(2)
  }
}

const fundList = computed<FundItem[]>(() => store.sortedFavorites.map(toItem))

const filteredFundList = computed(() => {
  if (filterMode.value === 'held') {
    return fundList.value.filter(item => item.heldAmount > 0)
  }
  return fundList.value
})

const totalAmount = computed(() => {
  let sum = 0
  for (const item of fundList.value) sum += item.heldAmount
  return '¥' + sum.toFixed(2)
})

const totalProfit = computed(() => {
  let sum = 0
  for (const item of fundList.value) sum += item.heldProfit
  return Math.round(sum * 100) / 100
})

function toggleHideAmount() {
  store.hideAmount = !store.hideAmount
}

function toggleFilter() {
  filterMode.value = filterMode.value === 'all' ? 'held' : 'all'
}

function toggleSort() {
  store.toggleSortDirection()
}

function handleRefresh() {
  store.fetchFavorites(true)
}

function goSearch() {
  uni.navigateTo({ url: '/pages/index/search' })
}

function goDetail(code: string) {
  uni.navigateTo({ url: '/pages/index/detail?code=' + code })
}

function showActions(fund: FundItem) {
  const held = store.isHeld(fund.code)
  const items = held ? ['设置持仓', '删除基金'] : ['删除基金']
  uni.showActionSheet({
    itemList: items,
    success: (res) => {
      if (held) {
        if (res.tapIndex === 0) goSetHolding(fund.code, fund.name)
        else if (res.tapIndex === 1) confirmDelete(fund.code, fund.name)
      } else {
        if (res.tapIndex === 0) confirmDelete(fund.code, fund.name)
      }
    }
  })
}

function goSetHolding(code: string, name: string) {
  uni.navigateTo({ url: '/pages/holdings/edit?code=' + code + '&name=' + encodeURIComponent(name) })
}

function confirmDelete(code: string, name: string) {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除 ' + name + '(' + code + ') 吗？',
    success: async (res) => {
      if (res.confirm) await store.removeFavorite(code)
    }
  })
}

onShow(async () => {
  isLoading.value = true
  try {
    await store.init()
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f6fa;
  display: flex;
  flex-direction: column;
}

.header {
  position: relative;
  z-index: 10;
}

.header-bg {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #6366f1 100%);
}

.header-content {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx 32rpx;
  padding-top: calc(var(--status-bar-height, 0px) + 28rpx);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.title-icon {
  width: 52rpx;
  height: 52rpx;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
}

.icon-text {
  font-size: 28rpx;
  font-weight: 800;
  color: #fff;
}

.title {
  font-size: 34rpx;
  font-weight: 700;
  color: #fff;
  letter-spacing: 1rpx;
}

.refresh-btn {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 50%;
}

.refresh-icon {
  font-size: 36rpx;
  color: #fff;
}

.spinning .refresh-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.stats-section {
  margin: -24rpx 24rpx 0;
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx 32rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.08);
  position: relative;
  z-index: 5;
}

.stats-row {
  display: flex;
  align-items: center;
}

.stat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.stat-label {
  font-size: 22rpx;
  color: #94a3b8;
  font-weight: 500;
}

.stat-value {
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
  font-family: 'SF Mono', Consolas, monospace;
}

.profit-up {
  color: #ef4444;
}

.profit-down {
  color: #10b981;
}

.hide-btn {
  padding: 10rpx 24rpx;
  background: #f1f5f9;
  border-radius: 20rpx;
}

.hide-text {
  font-size: 22rpx;
  color: #64748b;
  font-weight: 500;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx 24rpx 0;
}

.search-bar {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 20rpx 24rpx;
  background: #fff;
  border-radius: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.search-icon {
  font-size: 28rpx;
}

.search-placeholder {
  font-size: 28rpx;
  color: #9ca3af;
}

.toolbar-actions {
  display: flex;
  gap: 12rpx;
}

.filter-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-radius: 14rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.filter-btn.active {
  background: #4f46e5;
}

.filter-btn.active .filter-text {
  color: #fff;
}

.filter-text {
  font-size: 24rpx;
  font-weight: 600;
  color: #64748b;
}

.sort-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-radius: 14rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.sort-text {
  font-size: 28rpx;
  font-weight: 700;
  color: #64748b;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 160rpx 0;
}

.loading-spinner {
  display: flex;
  gap: 12rpx;
  margin-bottom: 24rpx;
}

.spinner-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #4f46e5;
  animation: bounce 1.4s infinite ease-in-out both;
}

.spinner-dot:nth-child(1) { animation-delay: -0.32s; }
.spinner-dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.loading-text {
  color: #94a3b8;
  font-size: 28rpx;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 160rpx 0;
}

.empty-icon-wrap {
  width: 120rpx;
  height: 120rpx;
  background: #f1f5f9;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
}

.empty-icon {
  font-size: 56rpx;
}

.empty-text {
  color: #6b7280;
  font-size: 30rpx;
  font-weight: 500;
}

.empty-hint {
  color: #4f46e5;
  font-size: 26rpx;
  margin-top: 12rpx;
  font-weight: 500;
}

.fund-scroll {
  flex: 1;
  padding: 24rpx 24rpx 0;
}

.fund-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.fund-item {
  display: flex;
  align-items: center;
  padding: 28rpx 24rpx;
  background: #fff;
  border-radius: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.03);
}

.fund-left {
  flex: 1;
  min-width: 0;
}

.fund-info {
  display: flex;
  flex-direction: column;
}

.fund-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 280rpx;
}

.fund-code {
  font-size: 22rpx;
  color: #9ca3af;
  margin-top: 6rpx;
}

.fund-right {
  text-align: right;
  flex-shrink: 0;
}

.fund-growth {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  font-family: 'SF Mono', Consolas, monospace;
}

.fund-nav {
  display: block;
  font-size: 22rpx;
  color: #6b7280;
  margin-top: 6rpx;
  font-family: 'SF Mono', Consolas, monospace;
}

.fund-estimate-time {
  display: block;
  font-size: 20rpx;
  color: #b0b8c9;
  margin-top: 4rpx;
}

.fund-holding {
  margin-left: 24rpx;
  padding-left: 24rpx;
  border-left: 1rpx solid #f1f5f9;
  text-align: right;
  flex-shrink: 0;
}

.holding-amount {
  display: block;
  font-size: 24rpx;
  color: #374151;
  font-weight: 600;
  font-family: 'SF Mono', Consolas, monospace;
}

.holding-profit {
  display: block;
  font-size: 22rpx;
  margin-top: 6rpx;
  font-weight: 600;
  font-family: 'SF Mono', Consolas, monospace;
}

.bottom-safe {
  height: 180rpx;
}
</style>
