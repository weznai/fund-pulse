<template>
  <view class="page">
    <view class="search-header">
      <view class="search-bar">
        <text class="search-icon">🔍</text>
        <input
          class="search-input"
          v-model="keyword"
          placeholder="输入基金代码或名称"
          confirm-type="search"
          :focus="true"
          @confirm="doSearch"
          @input="debouncedSearch"
        />
        <view v-if="keyword" class="clear-btn" @tap="clearKeyword">
          <text class="clear-text">✕</text>
        </view>
      </view>
    </view>

    <view v-if="results.length > 0" class="result-list">
      <view
        v-for="item in results"
        :key="item.code"
        class="result-item"
        @tap="handleSelect(item)"
      >
        <view class="result-left">
          <text class="result-name">{{ item.name }}</text>
          <text class="result-code">{{ item.code }}</text>
        </view>
        <view class="result-right">
          <text class="result-type">{{ item.type }}</text>
          <text class="add-text">+ 添加</text>
        </view>
      </view>
    </view>

    <view v-else-if="searched" class="empty">
      <view class="empty-icon-wrap">
        <text class="empty-icon">🔍</text>
      </view>
      <text class="empty-text">未找到相关基金</text>
      <text class="empty-hint">请检查基金代码或名称</text>
    </view>

    <view v-else-if="recentSearches.length > 0" class="recent-section">
      <view class="recent-header">
        <text class="recent-title">最近搜索</text>
        <view class="recent-clear" @tap="clearRecent">
          <text class="recent-clear-text">清除</text>
        </view>
      </view>
      <view class="recent-tags">
        <view
          v-for="item in recentSearches"
          :key="item"
          class="recent-tag"
          @tap="searchRecent(item)"
        >
          <text class="tag-text">{{ item }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { searchFunds } from '@/api/fund'
import { useFundStore } from '@/stores/fund'

const store = useFundStore()
const keyword = ref('')
const results = ref<Array<{ code: string; name: string; type: string }>>([])
const searched = ref(false)
const recentSearches = ref<string[]>([])
let timer: ReturnType<typeof setTimeout> | null = null

const RECENT_KEY = 'fund_recent_searches'

function loadRecent() {
  try {
    const data = uni.getStorageSync(RECENT_KEY)
    if (data) recentSearches.value = JSON.parse(data)
  } catch { /* ignore */ }
}

function saveRecent(keyword: string) {
  const list = recentSearches.value.filter(k => k !== keyword)
  list.unshift(keyword)
  recentSearches.value = list.slice(0, 10)
  uni.setStorageSync(RECENT_KEY, JSON.stringify(recentSearches.value))
}

function clearRecent() {
  recentSearches.value = []
  uni.removeStorageSync(RECENT_KEY)
}

function searchRecent(k: string) {
  keyword.value = k
  doSearch()
}

loadRecent()

function clearKeyword() {
  keyword.value = ''
  results.value = []
  searched.value = false
}

function debouncedSearch() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => doSearch(), 500)
}

async function doSearch() {
  if (!keyword.value.trim()) {
    results.value = []
    searched.value = false
    return
  }
  try {
    results.value = await searchFunds(keyword.value.trim())
    searched.value = true
    saveRecent(keyword.value.trim())
  } catch {
    results.value = []
    searched.value = true
  }
}

async function handleSelect(item: { code: string; name: string }) {
  await store.addFavorite(item.code, item.name)
  await store.fetchFavorites()
  uni.showToast({ title: '已添加', icon: 'success' })
  setTimeout(() => uni.navigateBack(), 500)
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f6fa;
}

.search-header {
  padding: 24rpx 24rpx 16rpx;
  background: #fff;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 20rpx;
  background: #f1f5f9;
  border-radius: 16rpx;
}

.search-icon {
  font-size: 28rpx;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  background: transparent;
}

.clear-btn {
  width: 40rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #d1d5db;
  border-radius: 50%;
}

.clear-text {
  font-size: 22rpx;
  color: #fff;
}

.result-list {
  padding: 16rpx 24rpx;
}

.result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx;
  background: #fff;
  border-radius: 14rpx;
  margin-bottom: 12rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.03);
}

.result-left {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.result-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #111827;
}

.result-code {
  font-size: 24rpx;
  color: #9ca3af;
}

.result-right {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.result-type {
  font-size: 22rpx;
  color: #6b7280;
  background: #f1f5f9;
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
}

.add-text {
  font-size: 24rpx;
  color: #4f46e5;
  font-weight: 500;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}

.empty-icon-wrap {
  width: 100rpx;
  height: 100rpx;
  background: #f1f5f9;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
}

.empty-icon {
  font-size: 48rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #6b7280;
  margin-bottom: 8rpx;
}

.empty-hint {
  font-size: 24rpx;
  color: #94a3b8;
}

.recent-section {
  padding: 24rpx;
}

.recent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.recent-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #374151;
}

.recent-clear {
  padding: 4rpx 12rpx;
}

.recent-clear-text {
  font-size: 24rpx;
  color: #94a3b8;
}

.recent-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.recent-tag {
  padding: 12rpx 24rpx;
  background: #fff;
  border-radius: 20rpx;
  box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.04);
}

.tag-text {
  font-size: 26rpx;
  color: #374151;
}
</style>
