<template>
  <view class="page">
    <view class="form-card">
      <view class="form-header">
        <text class="form-title">建议与反馈</text>
        <text class="form-desc">您的反馈对我们非常重要</text>
      </view>
      <textarea
        class="suggestion-input"
        v-model="content"
        placeholder="请输入您的建议或问题..."
        :maxlength="500"
      />
      <view class="char-count">
        <text class="count-text">{{ content.length }}/500</text>
      </view>
      <view class="btn-submit" :class="{ disabled: !content.trim() }" @tap="submit">
        <text class="btn-text">提交反馈</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { post } from '@/utils/request'

const content = ref('')

async function submit() {
  if (!content.value.trim()) {
    uni.showToast({ title: '请输入内容', icon: 'none' })
    return
  }
  try {
    await post('/api/suggestions', { content: content.value.trim() })
    uni.showToast({ title: '提交成功，感谢反馈', icon: 'success' })
    content.value = ''
  } catch {
    uni.showToast({ title: '提交失败', icon: 'none' })
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f6fa;
  padding: 24rpx;
}

.form-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.form-header {
  margin-bottom: 24rpx;
}

.form-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #111827;
  margin-bottom: 8rpx;
}

.form-desc {
  font-size: 24rpx;
  color: #94a3b8;
}

.suggestion-input {
  width: 100%;
  height: 320rpx;
  padding: 24rpx;
  background: #f8fafc;
  border: 1rpx solid #e5e7eb;
  border-radius: 16rpx;
  font-size: 28rpx;
  margin-bottom: 12rpx;
}

.char-count {
  text-align: right;
  margin-bottom: 24rpx;
}

.count-text {
  font-size: 22rpx;
  color: #c0c8d8;
}

.btn-submit {
  background: linear-gradient(135deg, #4f46e5, #6366f1);
  border-radius: 14rpx;
  padding: 26rpx 0;
  text-align: center;
  box-shadow: 0 4rpx 16rpx rgba(79, 70, 229, 0.3);
}

.btn-submit.disabled {
  opacity: 0.5;
}

.btn-text {
  color: #fff;
  font-size: 30rpx;
  font-weight: 600;
}
</style>
