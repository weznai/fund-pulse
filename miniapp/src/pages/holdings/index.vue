<template>
  <view class="page">
    <view class="header">
      <view class="header-bg"></view>
      <view class="header-content">
        <text class="header-title">持仓管理</text>
        <text class="header-count">{{ heldFunds.length }}只基金</text>
      </view>
    </view>

    <view v-if="heldFunds.length > 0" class="summary">
      <view class="summary-card card-amount">
        <text class="summary-icon">💰</text>
        <view class="summary-info">
          <text class="summary-label">总持仓</text>
          <text class="summary-value">{{ store.hideAmount ? '****' : totalAmount }}</text>
        </view>
      </view>
      <view class="summary-card card-cost">
        <text class="summary-icon">📊</text>
        <view class="summary-info">
          <text class="summary-label">总成本</text>
          <text class="summary-value">{{ store.hideAmount ? '****' : totalCost }}</text>
        </view>
      </view>
      <view :class="['summary-card', totalProfit >= 0 ? 'card-profit-up' : 'card-profit-down']">
        <text class="summary-icon">{{ totalProfit >= 0 ? '📈' : '📉' }}</text>
        <view class="summary-info">
          <text class="summary-label">累计收益</text>
          <text class="summary-value">
            {{ totalProfit >= 0 ? '+' : '' }}{{ totalProfit }}
          </text>
        </view>
      </view>
    </view>

    <view v-if="heldFunds.length === 0" class="empty">
      <view class="empty-icon-wrap">
        <text class="empty-icon">💼</text>
      </view>
      <text class="empty-text">暂无持仓基金</text>
      <text class="empty-hint">在首页长按基金可设置持仓</text>
    </view>

    <scroll-view v-else class="holding-scroll" scroll-y enhanced :show-scrollbar="false">
      <view class="holding-list">
        <view
          v-for="fund in heldFunds"
          :key="fund.code"
          class="holding-item"
        >
          <view class="holding-header">
            <view class="holding-info">
              <text class="holding-name">{{ fund.name }}</text>
              <text class="holding-code">{{ fund.code }}</text>
            </view>
            <view class="holding-actions">
              <view class="action-btn edit" @tap="editHolding(fund.code, fund.name)">
                <text class="action-text">编辑</text>
              </view>
              <view class="action-btn danger" @tap="confirmRemoveHolding(fund.code)">
                <text class="action-text">清除</text>
              </view>
            </view>
          </view>
          <view class="holding-body">
            <view class="holding-field">
              <text class="field-label">持仓金额</text>
              <text class="field-value">{{ store.hideAmount ? '****' : ('¥' + (store.getHolding(fund.code)?.amount || 0).toFixed(2)) }}</text>
            </view>
            <view class="holding-field">
              <text class="field-label">估算净值</text>
              <text class="field-value">{{ (fund.gsz || fund.nav || 0).toFixed(4) }}</text>
            </view>
            <view class="holding-field">
              <text class="field-label">估算涨幅</text>
              <text :class="['field-value', (fund.gszzl ?? fund.dayGrowth ?? 0) >= 0 ? 'profit-up' : 'profit-down']">
                {{ formatGrowth(fund.gszzl ?? fund.dayGrowth ?? 0) }}
              </text>
            </view>
            <view class="holding-field">
              <text class="field-label">估算收益</text>
              <text :class="['field-value', calcEstimateProfit(fund) >= 0 ? 'profit-up' : 'profit-down']">
                {{ calcEstimateProfit(fund) >= 0 ? '+' : '' }}¥{{ Math.abs(calcEstimateProfit(fund)).toFixed(2) }}
              </text>
            </view>
          </view>
          <view v-if="!store.hideAmount && store.getHolding(fund.code)?.amount > 0" class="holding-bar">
            <view
              class="bar-fill"
              :class="calcEstimateProfit(fund) >= 0 ? 'bar-up' : 'bar-down'"
              :style="{ width: getBarWidth(fund) + '%' }"
            ></view>
          </view>
        </view>
      </view>
      <view class="bottom-safe"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useFundStore } from '@/stores/fund'
import type { Fund } from '@/api/fund'

const store = useFundStore()

const heldFunds = computed<Fund[]>(() => {
  return store.sortedFavorites.filter(f => store.isHeld(f.code))
})

const totalAmount = computed(() => {
  let sum = 0
  for (const f of heldFunds.value) {
    const h = store.getHolding(f.code)
    if (h) sum += h.amount
  }
  return '¥' + sum.toFixed(2)
})

const totalCost = computed(() => {
  let sum = 0
  for (const f of heldFunds.value) {
    const h = store.getHolding(f.code)
    if (h?.totalCost) sum += h.totalCost
    else if (h?.cost && h?.share) sum += h.cost * h.share
  }
  return '¥' + sum.toFixed(2)
})

const totalProfit = computed(() => {
  let sum = 0
  for (const f of heldFunds.value) {
    const h = store.getHolding(f.code)
    if (!h) continue
    if (h.accumulatedProfit != null) {
      sum += h.accumulatedProfit
    } else if (h.totalCost && h.totalCost > 0) {
      sum += h.amount - h.totalCost
    }
  }
  return Math.round(sum * 100) / 100
})

function calcEstimateProfit(fund: Fund): number {
  const h = store.getHolding(fund.code)
  if (!h || h.amount <= 0) return 0
  const growth = fund.gszzl ?? fund.dayGrowth ?? 0
  return Math.round(h.amount * growth / 100 * 100) / 100
}

function getBarWidth(fund: Fund): number {
  const profit = Math.abs(calcEstimateProfit(fund))
  const maxProfit = Math.max(...heldFunds.value.map(f => Math.abs(calcEstimateProfit(f))), 1)
  return Math.min((profit / maxProfit) * 100, 100)
}

function formatGrowth(val: number): string {
  return (val >= 0 ? '+' : '') + val.toFixed(2) + '%'
}

function editHolding(code: string, name: string) {
  uni.navigateTo({ url: `/pages/holdings/edit?code=${code}&name=${encodeURIComponent(name)}` })
}

async function confirmRemoveHolding(code: string) {
  uni.showModal({
    title: '确认清除',
    content: '确定要清除该基金的持仓信息吗？',
    success: async (res) => {
      if (res.confirm) {
        await store.removeHolding(code)
        await store.fetchFavorites()
      }
    }
  })
}

onMounted(() => {
  store.refreshHoldings()
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
  padding: 0 32rpx 36rpx;
}

.header-bg {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  border-radius: 0 0 32rpx 32rpx;
}

.header-content {
  position: relative;
  padding-top: calc(var(--status-bar-height, 0px) + 36rpx);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #fff;
}

.header-count {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.15);
  padding: 6rpx 20rpx;
  border-radius: 20rpx;
}

.summary {
  display: flex;
  gap: 12rpx;
  margin: -20rpx 24rpx 24rpx;
  position: relative;
  z-index: 5;
}

.summary-card {
  flex: 1;
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.summary-icon {
  font-size: 32rpx;
}

.summary-info {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.summary-label {
  font-size: 20rpx;
  color: #94a3b8;
}

.summary-value {
  font-size: 24rpx;
  font-weight: 700;
  color: #0f172a;
  font-family: 'SF Mono', Consolas, monospace;
}

.card-profit-up .summary-value {
  color: #ef4444;
}

.card-profit-down .summary-value {
  color: #10b981;
}

.profit-up { color: #ef4444; }
.profit-down { color: #10b981; }

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
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
  font-size: 30rpx;
  color: #6b7280;
  font-weight: 500;
  margin-bottom: 12rpx;
}

.empty-hint {
  font-size: 24rpx;
  color: #9ca3af;
}

.holding-scroll {
  flex: 1;
  padding: 0 24rpx;
}

.holding-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.holding-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx 28rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.holding-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.holding-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #111827;
}

.holding-code {
  font-size: 22rpx;
  color: #9ca3af;
  margin-top: 4rpx;
}

.holding-actions {
  display: flex;
  gap: 16rpx;
}

.action-btn {
  padding: 8rpx 20rpx;
  border-radius: 8rpx;
  background: #f1f5f9;
}

.action-btn.edit {
  background: #eff6ff;
}

.action-btn.danger {
  background: #fef2f2;
}

.action-text {
  font-size: 24rpx;
  font-weight: 500;
}

.action-btn.edit .action-text {
  color: #3b82f6;
}

.action-btn.danger .action-text {
  color: #ef4444;
}

.holding-body {
  display: flex;
  flex-wrap: wrap;
}

.holding-field {
  width: 50%;
  padding: 8rpx 0;
}

.field-label {
  font-size: 22rpx;
  color: #94a3b8;
  display: block;
  margin-bottom: 4rpx;
}

.field-value {
  font-size: 28rpx;
  font-weight: 600;
  color: #111827;
  display: block;
  font-family: 'SF Mono', Consolas, monospace;
}

.holding-bar {
  height: 6rpx;
  background: #f1f5f9;
  border-radius: 3rpx;
  margin-top: 16rpx;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 3rpx;
  transition: width 0.3s;
}

.bar-up {
  background: linear-gradient(90deg, #ef4444, #f87171);
}

.bar-down {
  background: linear-gradient(90deg, #10b981, #34d399);
}

.bottom-safe {
  height: 180rpx;
}
</style>
