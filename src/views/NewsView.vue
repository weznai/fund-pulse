<template>
  <div class="news-page">
    <header class="news-hero">
      <div class="hero-inner">
        <button class="back-btn" @click="$router.push('/')" title="返回首页" aria-label="返回首页">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="hero-text">
          <h1 class="hero-title">基金资讯</h1>
          <p class="hero-sub">市场动态 · 宏观分析 · 投资洞察</p>
        </div>
        <svg class="hero-deco" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 17L9 11L13 15L21 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M17 7H21V11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </header>

    <div class="news-container">
      <!-- 骨架屏 -->
      <div v-if="loading && articles.length === 0" class="skeleton-list" aria-label="加载中">
        <div v-for="n in 3" :key="n" class="skeleton-card">
          <div class="sk sk-date"></div>
          <div class="sk-body">
            <div class="sk sk-title"></div>
            <div class="sk sk-line"></div>
            <div class="sk sk-line short"></div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="articles.length === 0" class="empty-tip">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <p>暂无资讯，敬请期待</p>
        <button class="empty-btn" @click="$router.push('/')">返回首页</button>
      </div>

      <template v-else>
        <!-- 头条大卡（置顶优先，否则第一篇）——与普通卡片同款白卡，右上角 NEW 角标 -->
        <article
          v-if="featured"
          class="news-card featured"
          :style="{ animationDelay: '0ms' }"
          @click="$router.push(`/news/${featured.id}`)"
        >
          <span class="new-flag">NEW</span>
          <div class="date-block">
            <span class="date-day">{{ formatDay(featured.created_at) }}</span>
            <span class="date-month">{{ formatMonth(featured.created_at) }}</span>
          </div>
          <div class="card-main">
            <h2 class="card-title featured-title">
              {{ featured.title }}
              <span v-if="featured.pinned" class="badge-mini">顶</span>
            </h2>
            <p v-if="featured.summary" class="card-summary">{{ featured.summary }}</p>
            <div class="card-meta">
              <span v-if="featured.source" class="meta-chip">{{ featured.source }}</span>
              <span class="meta-views">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/>
                </svg>
                {{ featured.views }} 次阅读
              </span>
            </div>
          </div>
          <svg class="card-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </article>

        <!-- 普通列表 -->
        <article
          v-for="(item, idx) in restList"
          :key="item.id"
          class="news-card"
          :style="{ animationDelay: `${Math.min(idx + 1, 6) * 45}ms` }"
          @click="$router.push(`/news/${item.id}`)"
        >
          <div class="date-block">
            <span class="date-day">{{ formatDay(item.created_at) }}</span>
            <span class="date-month">{{ formatMonth(item.created_at) }}</span>
          </div>
          <div class="card-main">
            <h2 class="card-title">
              {{ item.title }}
              <span v-if="item.pinned" class="badge badge-mini">顶</span>
            </h2>
            <p v-if="item.summary" class="card-summary">{{ item.summary }}</p>
            <div class="card-meta">
              <span v-if="item.source" class="meta-chip">{{ item.source }}</span>
              <span class="meta-views">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/>
                </svg>
                {{ item.views }}
              </span>
            </div>
          </div>
          <svg class="card-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </article>

        <button v-if="hasMore" class="load-more-btn" :disabled="loading" @click="loadMore">
          <span v-if="loading" class="btn-spinner" aria-hidden="true"></span>
          {{ loading ? '加载中...' : '加载更多' }}
        </button>
        <p v-else-if="articles.length > 3" class="list-end">— 已经到底啦 —</p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

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

const featured = computed<NewsItem | null>(() => {
  if (articles.value.length === 0) return null
  if (page.value === 1) {
    const pinned = articles.value.find(a => a.pinned)
    return pinned || articles.value[0]
  }
  return null
})

const restList = computed<NewsItem[]>(() => {
  if (!featured.value) return articles.value
  return articles.value.filter(a => a.id !== featured.value!.id)
})

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

function formatDay(dt: string): string {
  return (dt || '').slice(8, 10) || '-'
}
function formatMonth(dt: string): string {
  const m = (dt || '').slice(5, 7)
  return m ? `${parseInt(m, 10)}月` : '-'
}

onMounted(fetchNews)
</script>

<style scoped>
.news-page {
  min-height: 100vh;
  background: #f4f6f9;
  padding-bottom: 64px;
}

/* ---------- Hero ---------- */
.news-hero {
  background: linear-gradient(180deg, #edf3fa 0%, #f4f6f9 100%);
  border-bottom: 1px solid #e2eaf3;
  padding: 18px 0 56px;
  position: relative;
  overflow: hidden;
}

.hero-inner {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  position: relative;
  z-index: 1;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid #d6dce4;
  border-radius: 12px;
  background: #ffffff;
  color: #475569;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
  flex-shrink: 0;
}
.back-btn:hover { background: #f1f5f9; }
.back-btn svg { width: 20px; height: 20px; }

.hero-text { min-width: 0; }

.hero-title {
  font-size: 22px;
  font-weight: 700;
  color: #1a2a3a;
  letter-spacing: 0.5px;
  margin: 0;
  line-height: 1.3;
}

.hero-sub {
  margin: 4px 0 0;
  font-size: 12.5px;
  color: #64707d;
  letter-spacing: 1px;
}

.hero-deco {
  width: 52px;
  height: 52px;
  color: #b7cde2;
  margin-left: auto;
  flex-shrink: 0;
}

/* ---------- 容器 ---------- */
.news-container {
  max-width: 960px;
  margin: -36px auto 0;
  padding: 0 16px;
  position: relative;
  z-index: 2;
}

/* ---------- 骨架屏 ---------- */
.skeleton-list { display: flex; flex-direction: column; gap: 12px; }
.skeleton-card {
  display: flex;
  gap: 16px;
  background: #fff;
  border-radius: 16px;
  padding: 18px 20px;
}
.sk { background: linear-gradient(90deg, #eef1f5 25%, #e2e7ee 50%, #eef1f5 75%); background-size: 200% 100%; animation: shimmer 1.3s ease-in-out infinite; border-radius: 8px; }
.sk-date { width: 52px; height: 52px; border-radius: 12px; flex-shrink: 0; }
.sk-body { flex: 1; display: flex; flex-direction: column; gap: 10px; }
.sk-title { height: 18px; width: 68%; }
.sk-line { height: 13px; width: 92%; }
.sk-line.short { width: 55%; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* ---------- 空状态 ---------- */
.empty-tip {
  background: #fff;
  border-radius: 18px;
  padding: 56px 20px;
  text-align: center;
  color: #94a3b8;
}
.empty-tip svg { width: 46px; height: 46px; margin-bottom: 10px; }
.empty-tip p { margin: 0 0 18px; font-size: 14px; }
.empty-btn {
  padding: 9px 28px;
  border: none;
  border-radius: 999px;
  background: #1a2a3a;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
}
.empty-btn:hover { background: #24425c; transform: translateY(-1px); }

/* ---------- 头条卡（普通白卡同款，标题更大 + NEW 角标） ---------- */
.news-card.featured {
  padding: 22px 24px;
  margin-bottom: 16px;
}

.card-title.featured-title {
  font-size: 17.5px;
}

.badge-mini {
  color: #b45309;
  background: #fef3c7;
  font-size: 10.5px;
  padding: 1px 6px;
  border-radius: 5px;
  flex-shrink: 0;
}

.new-flag {
  position: absolute;
  top: -8px;
  right: 14px;
  z-index: 3;
  padding: 3px 10px;
  border-radius: 999px;
  background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
}

/* ---------- 普通卡片 ---------- */
.news-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 18px;
  background: #fff;
  border-radius: 16px;
  padding: 18px 20px;
  margin-bottom: 12px;
  cursor: pointer;
  border: 1px solid #eef1f5;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  transition: transform 0.22s ease-out, box-shadow 0.22s ease-out, border-color 0.22s;
  animation: card-in 0.4s ease-out both;
}
.news-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.09);
  border-color: #e2e8f0;
}

@keyframes card-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.date-block {
  flex-shrink: 0;
  width: 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 6px 0;
  border-radius: 12px;
  background: #f4f6f9;
}
.date-day { font-size: 19px; font-weight: 700; color: #1e3a5f; line-height: 1.2; font-variant-numeric: tabular-nums; }
.date-month { font-size: 11px; color: #94a3b8; }

.card-main { flex: 1; min-width: 0; }

.card-title {
  font-size: 15.5px;
  font-weight: 600;
  color: #1f2933;
  line-height: 1.5;
  margin: 0 0 5px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.card-summary {
  font-size: 13px;
  color: #64707d;
  line-height: 1.65;
  margin: 0 0 9px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-meta { display: flex; align-items: center; gap: 12px; }

.meta-chip {
  font-size: 11.5px;
  font-weight: 500;
  color: #1e5490;
  background: #edf4fb;
  border-radius: 999px;
  padding: 2px 10px;
}

.meta-views {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #94a3b8;
}
.meta-views svg { width: 14px; height: 14px; }

.card-arrow {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  color: #cbd5e1;
  transition: color 0.2s, transform 0.2s;
}
.news-card:hover .card-arrow { color: #64748b; transform: translateX(2px); }

/* ---------- 加载更多 ---------- */
.load-more-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  margin-top: 10px;
  min-height: 46px;
  border: 1px solid #e2e8f0;
  border-radius: 13px;
  background: #fff;
  color: #475569;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}
.load-more-btn:hover:not(:disabled) { background: #f8fafc; border-color: #cbd5e1; }
.load-more-btn:disabled { color: #94a3b8; cursor: default; }

.btn-spinner {
  width: 15px;
  height: 15px;
  border-radius: 50%;
  border: 2px solid #e2e8f0;
  border-top-color: #1e5490;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.list-end {
  text-align: center;
  font-size: 12px;
  color: #b6c2d0;
  margin: 22px 0 0;
  letter-spacing: 1px;
}

/* ---------- 移动端 & 无障碍 ---------- */
@media (max-width: 480px) {
  .hero-title { font-size: 19px; }
  .news-card.featured { padding: 18px; }
  .card-title.featured-title { font-size: 16px; }
  .date-block { width: 46px; border-radius: 10px; }
  .date-day { font-size: 17px; }
}

@media (prefers-reduced-motion: reduce) {
  .news-card { animation: none; }
  .news-card, .load-more-btn, .empty-btn { transition: none; }
  .sk { animation: none; }
}
</style>
