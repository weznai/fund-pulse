<template>
  <view class="page">
    <view class="fund-info-bar">
      <view class="fund-icon">
        <text class="fund-icon-text">{{ fundName.charAt(0) }}</text>
      </view>
      <view class="fund-detail">
        <text class="fund-name">{{ fundName }}</text>
        <text class="fund-code">{{ fundCode }}</text>
      </view>
    </view>

    <view class="form-section">
      <view class="form-group">
        <text class="form-label">持仓金额（元）</text>
        <view class="input-wrap">
          <text class="input-prefix">¥</text>
          <input
            class="form-input"
            type="digit"
            v-model="amount"
            placeholder="请输入持仓金额"
          />
        </view>
      </view>

      <view class="form-group" v-if="currentAmount > 0 && diff !== null">
        <view class="diff-badge" :class="{ increase: diff > 0, decrease: diff < 0 }">
          <text class="diff-text">{{ diff > 0 ? '加仓' : '减仓' }} ¥{{ Math.abs(diff).toFixed(2) }}</text>
        </view>
      </view>

      <view class="quick-amounts">
        <view
          v-for="val in quickAmounts"
          :key="val"
          class="quick-btn"
          @tap="amount = val.toString()"
        >
          <text class="quick-text">{{ val >= 10000 ? (val / 10000) + '万' : val }}</text>
        </view>
      </view>

      <view class="form-actions">
        <view class="btn btn-cancel" @tap="goBack">
          <text class="btn-text">取消</text>
        </view>
        <view v-if="currentAmount > 0" class="btn btn-danger" @tap="clearHolding">
          <text class="btn-text">清除持仓</text>
        </view>
        <view class="btn btn-primary" @tap="saveHolding">
          <text class="btn-text">保存</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useFundStore } from '@/stores/fund'

const store = useFundStore()
const fundCode = ref('')
const fundName = ref('')
const amount = ref('')
const currentAmount = ref(0)

const quickAmounts = [1000, 5000, 10000, 50000, 100000]

const diff = computed(() => {
  const val = parseFloat(amount.value) || 0
  return val - currentAmount.value
})

onLoad((options) => {
  if (options?.code) fundCode.value = options.code
  if (options?.name) fundName.value = decodeURIComponent(options.name)

  const h = store.getHolding(fundCode.value)
  if (h) {
    amount.value = h.amount.toString()
    currentAmount.value = h.amount
  }
})

async function saveHolding() {
  const val = parseFloat(amount.value)
  if (!val || val <= 0) {
    uni.showToast({ title: '请输入有效金额', icon: 'none' })
    return
  }
  try {
    const fund = store.favoriteFunds.find(f => f.code === fundCode.value)
    const nav = fund?.nav || 1
    await store.setHoldingAmount(fundCode.value, fundName.value, val, nav)
    uni.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => goBack(), 500)
  } catch {
    uni.showToast({ title: '保存失败', icon: 'none' })
  }
}

async function clearHolding() {
  uni.showModal({
    title: '确认清除',
    content: '确定要清除该基金的持仓信息吗？',
    success: async (res) => {
      if (res.confirm) {
        await store.removeHolding(fundCode.value)
        uni.showToast({ title: '已清除', icon: 'success' })
        setTimeout(() => goBack(), 500)
      }
    }
  })
}

function goBack() {
  uni.navigateBack()
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f6fa;
}

.fund-info-bar {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 32rpx;
  background: #fff;
  border-bottom: 1rpx solid #f1f5f9;
}

.fund-icon {
  width: 72rpx;
  height: 72rpx;
  background: linear-gradient(135deg, #4f46e5, #6366f1);
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fund-icon-text {
  font-size: 32rpx;
  font-weight: 700;
  color: #fff;
}

.fund-detail {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.fund-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #111827;
}

.fund-code {
  font-size: 24rpx;
  color: #94a3b8;
}

.form-section {
  padding: 32rpx;
}

.form-group {
  margin-bottom: 24rpx;
}

.form-label {
  display: block;
  font-size: 26rpx;
  color: #374151;
  margin-bottom: 12rpx;
  font-weight: 500;
}

.input-wrap {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 20rpx 24rpx;
  background: #fff;
  border: 1rpx solid #e5e7eb;
  border-radius: 14rpx;
}

.input-prefix {
  font-size: 32rpx;
  font-weight: 600;
  color: #94a3b8;
}

.form-input {
  flex: 1;
  font-size: 32rpx;
  font-weight: 600;
  color: #111827;
}

.diff-badge {
  display: inline-flex;
  padding: 8rpx 20rpx;
  border-radius: 10rpx;
}

.diff-badge.increase {
  background: #fef2f2;
}

.diff-badge.decrease {
  background: #f0fdf4;
}

.diff-text {
  font-size: 24rpx;
  font-weight: 500;
}

.diff-badge.increase .diff-text {
  color: #ef4444;
}

.diff-badge.decrease .diff-text {
  color: #10b981;
}

.quick-amounts {
  display: flex;
  gap: 12rpx;
  margin-bottom: 40rpx;
  flex-wrap: wrap;
}

.quick-btn {
  padding: 12rpx 24rpx;
  background: #f1f5f9;
  border-radius: 10rpx;
}

.quick-text {
  font-size: 24rpx;
  color: #475569;
  font-weight: 500;
}

.form-actions {
  display: flex;
  gap: 16rpx;
}

.btn {
  flex: 1;
  text-align: center;
  padding: 22rpx 0;
  border-radius: 14rpx;
}

.btn-text {
  font-size: 28rpx;
  font-weight: 500;
}

.btn-cancel {
  background: #f1f5f9;
}

.btn-cancel .btn-text {
  color: #64748b;
}

.btn-danger {
  background: #fef2f2;
}

.btn-danger .btn-text {
  color: #dc2626;
}

.btn-primary {
  background: linear-gradient(135deg, #4f46e5, #6366f1);
  box-shadow: 0 4rpx 12rpx rgba(79, 70, 229, 0.3);
}

.btn-primary .btn-text {
  color: #fff;
  font-weight: 600;
}
</style>
