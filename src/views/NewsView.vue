<template>
  <div class="news-page">
    <header class="news-header">
      <button class="back-btn" @click="$router.push('/')" title="返回首页">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <h1 class="news-title">基金资讯</h1>
    </header>

    <div class="news-container">
      <div v-if="loading && articles.length === 0" class="loading-tip">加载中...</div>

      <div v-else-if="articles.length === 0" class="empty-tip">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 002-2V9m-4 11l-2 2m2-2a2 2 0 002 2m-2-2v-7a2 2 0 012-2h1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <p>暂无资讯</p>
      </div>

      <template v-else>
        <article
          v-for="item in articles"
          :key="item.id"
          class="news-card"
          @click="$router.push(`/news/${item.id}`)"
        >
          <div class="card-main">
            <h2 class="card-title">
              <span v-if="item.pinned" class="pin-badge">置顶</span>
              {{ item.title }}
            </h2>
            <p v-if="item.summary" class="card-summary">{{ item.summary }}</p>
            <div class="card-meta">
              <span>{{ formatDate(item.created_at) }}</span>
              <span v-if="item.source" class="meta-source">{{ item.source }}</span>
              <span>{{ item.views }} 次阅读</span>
            </div>
          </div>
          <svg class="card-arrow" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </article>

        <button v-if="hasMore" class="load-more-btn" :disabled="loading" @click="loadMore">
          {{ loading ? '加载中...' : '加载更多' }}
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface NewsItem {
  id: number
  title: string
  summary: string
  source: string
  pinned: number
  views: number
  created_at: string
}

const PAGE_SIZE = 20
const articles = ref<NewsItem[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const hasMore = ref(false)

async function fetchNews() {
  if (loading.value) return
  loading.value = true
  try {
    const res = await fetch(`/api/news?page=${page.value}&pageSize=${PAGE_SIZE}`)
    const data = await res.json()
    if (Array.isArray(data.list)) {
      articles.value = page.value === 1 ? data.list : articles.value.concat(data.list)
      total.value = data.total || 0
      hasMore.value = articles.value.length < total.value
    }
  } catch (e) {
    console.error('获取资讯列表失败:', e)
  } finally {
    loading.value = false
  }
}

function loadMore() {
  page.value++
  fetchNews()
}

function formatDate(dt: string): string {
  return (dt || '').slice(0, 10)
}

onMounted(fetchNews)
</script>

<style scoped>
.news-page {
  min-height: 100vh;
  background: #f6f7f9;
  padding-bottom: 48px;
}

.news-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid #e4e8ee;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: #f1f5f9;
  color: #475569;
  cursor: pointer;
  transition: background 0.2s;
}
.back-btn:hover { background: #e2e8f0; }
.back-btn svg { width: 20px; height: 20px; }

.news-title {
  font-size: 18px;
  font-weight: 700;
  color: #1f2933;
}

.news-container {
  max-width: 720px;
  margin: 0 auto;
  padding: 20px 16px 0;
}

.loading-tip, .empty-tip {
  text-align: center;
  color: #94a3b8;
  padding: 60px 0;
  font-size: 14px;
}
.empty-tip svg { width: 44px; height: 44px; margin-bottom: 8px; }

.news-card {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid #e4e8ee;
  border-radius: 14px;
  padding: 18px 20px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.2s;
}
.news-card:hover {
  box-shadow: 0 4px 16px rgba(31, 41, 51, 0.08);
  transform: translateY(-1px);
}

.card-main { flex: 1; min-width: 0; }

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2933;
  line-height: 1.5;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.pin-badge {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: #b9770e;
  background: #fef5e7;
  border-radius: 4px;
  padding: 1px 6px;
}

.card-summary {
  margin-top: 6px;
  font-size: 13px;
  color: #64707d;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
  font-size: 12px;
  color: #94a3b8;
}
.meta-source::before { content: '·'; margin-right: 12px; color: #cbd5e1; }

.card-arrow {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  color: #cbd5e1;
}

.load-more-btn {
  display: block;
  width: 100%;
  margin-top: 8px;
  padding: 12px;
  border: 1px solid #e4e8ee;
  border-radius: 12px;
  background: #fff;
  color: #475569;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}
.load-more-btn:hover:not(:disabled) { background: #f8fafc; }
.load-more-btn:disabled { color: #94a3b8; cursor: default; }
</style>
