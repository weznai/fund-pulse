<template>
  <view class="page">
    <view class="hero">
      <view class="hero-bg"></view>
      <view class="hero-content">
        <view class="app-icon">
          <text class="app-icon-text">F</text>
        </view>
        <text class="app-name">Fund Pulse</text>
        <text class="app-version">v1.0.0</text>
        <text class="app-slogan">实时基金跟踪工具</text>
      </view>
    </view>

    <view class="features">
      <view class="feature-item">
        <view class="feature-icon" style="background: #fef2f2;">
          <text style="color: #ef4444;">📈</text>
        </view>
        <view class="feature-info">
          <text class="feature-name">实时估值</text>
          <text class="feature-desc">盘中实时估值，涨跌一目了然</text>
        </view>
      </view>
      <view class="feature-item">
        <view class="feature-icon" style="background: #eff6ff;">
          <text style="color: #3b82f6;">💰</text>
        </view>
        <view class="feature-info">
          <text class="feature-name">持仓管理</text>
          <text class="feature-desc">轻松管理持仓，收益实时计算</text>
        </view>
      </view>
      <view class="feature-item">
        <view class="feature-icon" style="background: #f0fdf4;">
          <text style="color: #10b981;">🤖</text>
        </view>
        <view class="feature-info">
          <text class="feature-name">智能分析</text>
          <text class="feature-desc">AI 驱动的基金智能分析报告</text>
        </view>
      </view>
    </view>

    <view class="info-section">
      <view class="info-item">
        <text class="info-label">数据来源</text>
        <text class="info-value">东方财富</text>
      </view>
      <view class="info-item">
        <text class="info-label">开发者</text>
        <text class="info-value">wezin</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f6fa;
}

.hero {
  position: relative;
  padding: 0 32rpx 60rpx;
}

.hero-bg {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  border-radius: 0 0 40rpx 40rpx;
}

.hero-content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: calc(var(--status-bar-height, 0px) + 60rpx);
}

.app-icon {
  width: 120rpx;
  height: 120rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
  backdrop-filter: blur(10px);
  border: 2rpx solid rgba(255, 255, 255, 0.3);
}

.app-icon-text {
  font-size: 56rpx;
  font-weight: 800;
  color: #fff;
}

.app-name {
  font-size: 40rpx;
  font-weight: 700;
  color: #fff;
  margin-bottom: 8rpx;
}

.app-version {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 16rpx;
}

.app-slogan {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.8);
}

.features {
  margin: -24rpx 24rpx 24rpx;
  background: #fff;
  border-radius: 20rpx;
  padding: 8rpx 0;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  position: relative;
  z-index: 5;
}

.feature-item {
  display: flex;
  align-items: center;
  padding: 24rpx 28rpx;
  border-bottom: 1rpx solid #f8fafc;
}

.feature-item:last-child {
  border-bottom: none;
}

.feature-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  margin-right: 20rpx;
}

.feature-info {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.feature-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #111827;
}

.feature-desc {
  font-size: 24rpx;
  color: #94a3b8;
}

.info-section {
  margin: 0 24rpx;
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx 28rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f8fafc;
}

.info-item:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 26rpx;
  color: #94a3b8;
}

.info-value {
  font-size: 26rpx;
  color: #374151;
  font-weight: 500;
}
</style>
