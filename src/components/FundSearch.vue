<template>
  <div class="search-box" ref="searchBoxRef">
    <div class="search-input-wrapper">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
        <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <input
        v-model="keyword"
        type="text"
        placeholder="搜索基金代码或名称..."
        @input="handleSearch"
        class="search-input"
      />
      <button v-if="keyword" @click="clearSearch" class="clear-btn">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    
    <div v-if="loading && showDropdown" class="search-dropdown">
      <div class="search-loading">
        <div class="spinner-small"></div>
        <span>搜索中...</span>
      </div>
    </div>
    
    <div v-else-if="results.length > 0 && showDropdown" class="search-dropdown">
      <div class="results-header">
        <span>搜索结果</span>
        <span class="results-count">{{ results.length }} 个基金</span>
      </div>
      <div
        v-for="result in results"
        :key="result.code"
        class="search-result-item"
      >
        <div class="result-main">
          <span class="result-name">{{ result.name }}</span>
          <span class="result-code">{{ result.code }}</span>
        </div>
        <div class="result-footer">
          <span class="result-type">{{ result.type }}</span>
          <button
            class="add-favorite-btn"
            @click.stop="addToFavorite(result)"
            :title="isFavorite(result.code) ? '已在自选中' : '添加到自选'"
            :disabled="isFavorite(result.code)"
          >
            <svg viewBox="0 0 24 24" fill="none">
              <path v-if="isFavorite(result.code)" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" stroke="currentColor" stroke-width="2"/>
              <path v-else d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
    
    <div v-else-if="keyword && !loading && showDropdown" class="search-dropdown">
      <div class="search-empty">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
          <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M8 11h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span>未找到相关基金</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { searchFunds } from '@/api/fund'
import { useFundStore } from '@/stores/fund'
import type { SearchResult } from '@/types'

const store = useFundStore()
const keyword = ref('')
const results = ref<SearchResult[]>([])
const loading = ref(false)
const showDropdown = ref(false)
const searchBoxRef = ref<HTMLElement | null>(null)
let searchTimer: number | null = null

const emit = defineEmits<{
  select: [code: string]
}>()

function handleClickOutside(event: MouseEvent) {
  if (searchBoxRef.value && !searchBoxRef.value.contains(event.target as Node)) {
    showDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

async function handleSearch() {
  if (!keyword.value.trim()) {
    results.value = []
    showDropdown.value = false
    return
  }

  showDropdown.value = true

  if (searchTimer) {
    clearTimeout(searchTimer)
  }

  searchTimer = window.setTimeout(async () => {
    loading.value = true
    try {
      results.value = await searchFunds(keyword.value)
    } catch (error) {
      console.error('Search error:', error)
      results.value = []
    } finally {
      loading.value = false
    }
  }, 300)
}

function clearSearch() {
  keyword.value = ''
  results.value = []
  showDropdown.value = false
}

function isFavorite(code: string): boolean {
  return store.isFavorite(code)
}

function addToFavorite(result: SearchResult) {
  if (!isFavorite(result.code)) {
    store.addFavorite(result.code, result.name)
    store.fetchFavorites()
    emit('select', result.code)
  }
}
</script>

<style scoped>
.search-box {
  position: relative;
  width: 100%;
  max-width: 700px;
  margin: 0 auto;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 20px;
  width: 20px;
  height: 20px;
  color: #64748b;
  pointer-events: none;
  z-index: 2;
}

.search-input {
  width: 100%;
  padding: 16px 50px 16px 52px;
  border: 1px solid #D1D5DB;
  border-radius: 12px;
  outline: none;
  background: white;
  color: #1F2937;
  font-size: 14px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.search-input:focus {
  background: white;
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.search-input::placeholder {
  color: #9CA3AF;
}

.clear-btn {
  position: absolute;
  right: 16px;
  width: 28px;
  height: 28px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 2;
}

.clear-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.clear-btn svg {
  width: 14px;
  height: 14px;
  color: #94a3b8;
}

.search-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  max-height: 400px;
  overflow-y: auto;
  z-index: 100;
}

.search-loading,
.search-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  color: #6B7280;
  background: white;
  border-radius: 12px;
  margin-top: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.spinner-small {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(234, 179, 8, 0.2);
  border-top-color: #eab308;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.search-empty svg {
  width: 24px;
  height: 24px;
  color: #9CA3AF;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid #F3F4F6;
  font-size: 13px;
  color: #6B7280;
  font-weight: 500;
  position: sticky;
  top: 0;
  background: white;
}

.results-count {
  color: #64748b;
  font-size: 12px;
}

.search-result-item {
  padding: 16px 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid #F3F4F6;
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background: #F9FAFB;
}

.result-main {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.result-name {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.result-code {
  font-size: 11px;
  color: #6B7280;
  background: #F3F4F6;
  padding: 3px 8px;
  border-radius: 6px;
  font-weight: 500;
}

.result-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.result-type {
  font-size: 12px;
  color: #3B82F6;
  font-weight: 500;
}

.add-favorite-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: #9CA3AF;
  transition: all 0.2s;
}

.add-favorite-btn:hover:not(:disabled) {
  background: #FEF3C7;
  color: #F59E0B;
}

.add-favorite-btn:disabled {
  color: #F59E0B;
  cursor: default;
}

.add-favorite-btn svg {
  width: 18px;
  height: 18px;
}

@media (max-width: 768px) {
  .search-input {
    padding: 16px 46px 16px 48px;
    font-size: 16px;
  }

  .search-result-item {
    padding: 14px 16px;
  }

  .result-name {
    font-size: 14px;
  }
}
</style>
