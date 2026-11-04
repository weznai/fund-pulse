<template>
  <div class="news-detail-page">
    <header class="detail-header">
      <button class="back-btn" @click="$router.back()" title="返回">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <h1 class="detail-header-title">资讯详情</h1>
    </header>

    <div class="detail-container">
      <div v-if="loading" class="loading-tip">加载中...</div>

      <div v-else-if="error" class="error-tip">
        <p>{{ error }}</p>
        <button class="retry-btn" @click="fetchDetail">重试</button>
      </div>

      <template v-else-if="article">
        <div class="detail-info">
          <h2 class="detail-title">
            <span v-if="article.pinned" class="pin-badge">置顶</span>
            {{ article.title }}
          </h2>
          <div class="detail-meta">
            <span>{{ article.created_at?.slice(0, 10) }}</span>
            <span v-if="article.source">{{ article.source }}</span>
            <span>{{ article.views }} 次阅读</span>
          </div>
        </div>

        <iframe
          class="detail-frame"
          :srcdoc="article.content_html"
          sandbox=""
          referrerpolicy="no-referrer"
          title="资讯正文"
        ></iframe>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

interface NewsArticle {
  id: number
  title: string
  summary: string
  content_html: string
  source: string
  pinned: number
  views: number
  created_at: string
}

const route = useRoute()
const article = ref<NewsArticle | null>(null)
const loading = ref(false)
const error = ref('')

async function fetchDetail() {
  const id = route.params.id
  if (!id) return
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`/api/news/${id}`)
    if (!res.ok) {
      error.value = res.status === 404 ? '资讯不存在或已下架' : '加载失败'
      article.value = null
      return
    }
    const data: NewsArticle = await res.json()
    article.value = data
    document.title = `${data.title} - 基金资讯`
  } catch (e) {
    error.value = '网络错误，加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(fetchDetail)
</script>

<style scoped>
.news-detail-page {
  min-height: 100vh;
  background: #f6f7f9;
  padding-bottom: 48px;
}

.detail-header {
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

.detail-header-title {
  font-size: 18px;
  font-weight: 700;
  color: #1f2933;
}

.detail-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px 16px 0;
}

.loading-tip {
  text-align: center;
  color: #94a3b8;
  padding: 60px 0;
  font-size: 14px;
}

.error-tip {
  text-align: center;
  color: #94a3b8;
  padding: 60px 0;
  font-size: 14px;
}
.retry-btn {
  margin-top: 12px;
  padding: 8px 24px;
  border: 1px solid #e4e8ee;
  border-radius: 10px;
  background: #fff;
  color: #475569;
  cursor: pointer;
}

.detail-info {
  background: #fff;
  border: 1px solid #e4e8ee;
  border-radius: 14px 14px 0 0;
  padding: 22px 24px 16px;
}

.detail-title {
  font-size: 20px;
  font-weight: 700;
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

.detail-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 10px;
  font-size: 12px;
  color: #94a3b8;
}

.detail-frame {
  display: block;
  width: 100%;
  height: 82vh;
  border: 1px solid #e4e8ee;
  border-top: none;
  border-radius: 0 0 14px 14px;
  background: #f6f7f9;
}

@media (max-width: 640px) {
  .detail-frame { height: 75vh; }
}
</style>
