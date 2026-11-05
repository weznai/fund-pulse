<template>
  <div class="news-detail-page">
    <header class="detail-hero">
      <div class="hero-inner">
        <button class="back-btn" @click="$router.back()" title="返回" aria-label="返回">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <span class="hero-label">资讯详情</span>
      </div>
    </header>

    <div class="detail-container">
      <!-- 骨架屏 -->
      <div v-if="loading" class="skeleton-box" aria-label="加载中">
        <div class="sk sk-title"></div>
        <div class="sk sk-chip"></div>
        <div class="sk sk-frame"></div>
      </div>

      <!-- 错误 -->
      <div v-else-if="error" class="error-tip">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.6"/>
          <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <p>{{ error }}</p>
        <button class="retry-btn" @click="fetchDetail">重试</button>
      </div>

      <template v-else-if="article">
        <div class="detail-info">
          <h1 class="detail-title">
            <span v-if="article.pinned" class="pin-badge">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              置顶
            </span>
            {{ article.title }}
          </h1>
          <div class="detail-meta">
            <span class="meta-chip">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.8"/>
                <path d="M8 3v4M16 3v4M3 10h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
              {{ formatDate(article.created_at) }}
            </span>
            <span v-if="article.source" class="meta-chip">{{ article.source }}</span>
            <span class="meta-views">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/>
              </svg>
              {{ article.views }} 次阅读
            </span>
          </div>
        </div>

        <div class="frame-card">
          <iframe
            class="detail-frame"
            :srcdoc="article.content_html"
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            referrerpolicy="no-referrer"
            title="资讯正文"
          ></iframe>
        </div>

        <button class="back-list-btn" @click="$router.push('/news')">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          返回资讯列表
        </button>
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

function formatDate(dt: string): string {
  return (dt || '').slice(0, 10)
}

onMounted(fetchDetail)
</script>

<style scoped>
.news-detail-page {
  min-height: 100vh;
  background: #f4f6f9;
  padding-bottom: 56px;
}

/* ---------- Hero ---------- */
.detail-hero {
  background: linear-gradient(180deg, #edf3fa 0%, #f4f6f9 100%);
  border-bottom: 1px solid #e2eaf3;
  padding: 14px 0 44px;
}

.hero-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 1px solid #d6dce4;
  border-radius: 11px;
  background: #ffffff;
  color: #475569;
  cursor: pointer;
  transition: background 0.2s;
}
.back-btn:hover { background: #f1f5f9; }
.back-btn svg { width: 19px; height: 19px; }

.hero-label {
  color: #1a2a3a;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 2px;
}

/* ---------- 容器 ---------- */
.detail-container {
  max-width: 1400px;
  margin: -28px auto 0;
  padding: 0 16px;
  position: relative;
  z-index: 2;
}

/* ---------- 骨架屏 ---------- */
.skeleton-box { display: flex; flex-direction: column; gap: 14px; }
.sk { background: linear-gradient(90deg, #eef1f5 25%, #e2e7ee 50%, #eef1f5 75%); background-size: 200% 100%; animation: shimmer 1.3s ease-in-out infinite; border-radius: 8px; }
.sk-title { height: 26px; width: 62%; margin: 8px 4px 0; }
.sk-chip { height: 24px; width: 220px; margin-left: 4px; border-radius: 999px; }
.sk-frame { height: 420px; border-radius: 18px; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* ---------- 错误 ---------- */
.error-tip {
  background: #fff;
  border-radius: 18px;
  padding: 56px 20px;
  text-align: center;
  color: #94a3b8;
}
.error-tip svg { width: 42px; height: 42px; margin-bottom: 10px; }
.error-tip p { margin: 0 0 18px; font-size: 14px; }
.retry-btn {
  min-height: 40px;
  padding: 8px 30px;
  border: none;
  border-radius: 999px;
  background: #1a2a3a;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}
.retry-btn:hover { background: #24425c; }

/* ---------- 信息头 ---------- */
.detail-info {
  background: #fff;
  border-radius: 18px 18px 0 0;
  padding: 24px 26px 18px;
  border-bottom: 1px solid #eef1f5;
}

.detail-title {
  font-size: 21px;
  font-weight: 700;
  color: #1a2a3a;
  line-height: 1.55;
  margin: 0 0 14px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-wrap: wrap;
}

.pin-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  font-size: 11.5px;
  font-weight: 600;
  color: #b45309;
  background: #fef3c7;
  border-radius: 6px;
  padding: 3px 9px;
  margin-top: 4px;
}
.pin-badge svg { width: 12px; height: 12px; }

.detail-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
  color: #1e5490;
  background: #edf4fb;
  border-radius: 999px;
  padding: 4px 12px;
}
.meta-chip svg { width: 13px; height: 13px; }

.meta-views {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #94a3b8;
  padding: 4px 6px;
}
.meta-views svg { width: 14px; height: 14px; }

/* ---------- 正文 ---------- */
.frame-card {
  background: #fff;
  border-radius: 0 0 18px 18px;
  overflow: hidden;
  box-shadow: 0 8px 26px rgba(15, 23, 42, 0.07);
}

.detail-frame {
  display: block;
  width: 100%;
  height: 82vh;
  border: none;
  background: #f6f7f9;
}

.back-list-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  min-height: 46px;
  margin-top: 18px;
  border: 1px solid #e2e8f0;
  border-radius: 13px;
  background: #fff;
  color: #475569;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}
.back-list-btn:hover { background: #f8fafc; border-color: #cbd5e1; }
.back-list-btn svg { width: 16px; height: 16px; }

/* ---------- 移动端 & 无障碍 ---------- */
@media (max-width: 640px) {
  .detail-title { font-size: 18px; }
  .detail-info { padding: 20px 18px 15px; }
  .detail-frame { height: 74vh; }
}

@media (prefers-reduced-motion: reduce) {
  .sk { animation: none; }
}
</style>
