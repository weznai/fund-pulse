<template>
  <div class="suggestion-page">
    <header class="page-header">
      <div class="header-content">
        <button class="back-btn" @click="goBack">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>返回</span>
        </button>
        <h1 class="page-title">建议与问题</h1>
        <div class="header-actions">
          <button class="submit-btn" @click="showForm = !showForm">
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
              <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            {{ showForm ? '查看列表' : '提建议' }}
          </button>
          <button v-if="!showForm" class="refresh-btn" :disabled="loading" @click="fetchList">
            <svg viewBox="0 0 24 24" fill="none" width="12" height="12" :class="{ spinning: loading }">
              <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </header>

    <div class="page-container">
      <div v-if="showForm" class="form-section">
        <div class="form-card">
          <h3 class="form-title">提交建议或问题</h3>
          <p class="form-hint">您的反馈对我们非常重要，请详细描述您的建议或遇到的问题（最多500字）</p>
          <textarea
            v-model="content"
            class="form-textarea"
            :maxlength="500"
            placeholder="请描述您的建议或问题..."
            rows="8"
          ></textarea>
          <div class="form-footer">
            <span class="char-count" :class="{ warn: content.length > 450 }">{{ content.length }}/500</span>
            <button class="submit-action-btn" :disabled="submitting || !content.trim()" @click="handleSubmit">
              <span v-if="submitting" class="btn-spinner"></span>
              {{ submitting ? '提交中...' : '提交' }}
            </button>
          </div>
        </div>
      </div>

      <div v-else class="list-section">
        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <p>加载中...</p>
        </div>

        <div v-else-if="list.length === 0" class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" width="48" height="48">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#D1D5DB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <p>暂无建议或问题</p>
          <button class="empty-submit-btn" @click="showForm = true">提交第一条建议</button>
        </div>

        <div v-else class="suggestion-list">
          <div v-for="item in list" :key="item.id" class="suggestion-item">
            <div class="item-header">
              <span class="item-summary" :class="{ 'placeholder': item.summary === '更新中...' }">
                {{ item.summary }}
              </span>
              <span class="item-status" :class="statusClass(item.status)">{{ statusLabel(item.status) }}</span>
            </div>
            <div class="item-content">{{ item.content }}</div>
            <div class="item-meta">
              <span class="meta-item">#{{ item.id }}</span>
              <span class="meta-divider">·</span>
              <span class="meta-item">{{ item.submitter_label }}</span>
              <span class="meta-divider">·</span>
              <span class="meta-item">{{ formatTime(item.created_at) }}</span>
              <template v-if="item.processed_at">
                <span class="meta-divider">·</span>
                <span class="meta-item">处理: {{ formatTime(item.processed_at) }}</span>
              </template>
            </div>
          </div>
        </div>

        <div v-if="total > pageSize" class="pagination">
          <button class="page-btn" :disabled="page <= 1" @click="page--; fetchList()">上一页</button>
          <span class="page-info">{{ page }} / {{ totalPages }}</span>
          <button class="page-btn" :disabled="page >= totalPages" @click="page++; fetchList()">下一页</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

interface SuggestionItem {
  id: number
  summary: string
  content: string
  status: string
  processed_at: number | null
  created_at: number
  updated_at: number
  submitter_label: string
}

const router = useRouter()
const showForm = ref(false)
const content = ref('')
const submitting = ref(false)
const loading = ref(false)
const list = ref<SuggestionItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 10

const totalPages = computed(() => Math.ceil(total.value / pageSize))

onMounted(() => { fetchList() })

async function fetchList() {
  loading.value = true
  try {
    const { data } = await axios.get('/api/suggestions', { params: { page: page.value, pageSize } })
    list.value = data.list || []
    total.value = data.total || 0
  } catch (e) {
    console.error('获取建议列表失败:', e)
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  if (!content.value.trim() || submitting.value) return
  submitting.value = true
  try {
    await axios.post('/api/suggestions', { content: content.value.trim() })
    content.value = ''
    showForm.value = false
    page.value = 1
    await fetchList()
  } catch (e: any) {
    alert(e?.response?.data?.error || '提交失败')
  } finally {
    submitting.value = false
  }
}

function goBack() {
  router.push('/')
}

function statusLabel(status: string) {
  const map: Record<string, string> = { pending: '待处理', processing: '处理中', completed: '已完成', rejected: '已拒绝' }
  return map[status] || status
}

function statusClass(status: string) {
  const map: Record<string, string> = { pending: 'status-pending', processing: 'status-processing', completed: 'status-completed', rejected: 'status-rejected' }
  return map[status] || ''
}

function formatTime(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style scoped>
.suggestion-page {
  min-height: 100vh;
  background: #F9FAFB;
}

.page-header {
  background: white;
  border-bottom: 1px solid #E5E7EB;
  padding: 16px 0;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.header-content {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: transparent;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  cursor: pointer;
  color: #374151;
  font-size: 13px;
  transition: all 0.2s;
}

.back-btn svg { width: 16px; height: 16px; }
.back-btn:hover { background: #F3F4F6; }

.page-title {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  cursor: pointer;
  color: #6B7280;
  transition: all 0.2s;
  padding: 0;
}

.refresh-btn:hover:not(:disabled) {
  color: #374151;
}

.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  cursor: pointer;
  color: #6B7280;
  transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: #F3F4F6;
  color: #374151;
}

.refresh-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.refresh-btn svg {
  transition: transform 0.3s;
}

.refresh-btn svg.spinning {
  animation: spin 0.8s linear infinite;
}

.submit-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 16px;
  background: #3B82F6;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: white;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}

.submit-btn:hover { background: #2563EB; }

.page-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 20px;
}

.form-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  border: 1px solid #E5E7EB;
}

.form-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 8px;
}

.form-hint {
  font-size: 13px;
  color: #6B7280;
  margin: 0 0 16px;
  line-height: 1.5;
}

.form-textarea {
  width: 100%;
  min-height: 180px;
  padding: 12px;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  font-size: 14px;
  resize: vertical;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
  line-height: 1.6;
}

.form-textarea:focus {
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}

.char-count {
  font-size: 12px;
  color: #9CA3AF;
}

.char-count.warn { color: #EF4444; }

.submit-action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 24px;
  background: #3B82F6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.submit-action-btn:hover:not(:disabled) { background: #2563EB; }
.submit-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.loading-state {
  text-align: center;
  padding: 80px 20px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #E5E7EB;
  border-top-color: #3B82F6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 12px;
}

.loading-state p { color: #6B7280; font-size: 13px; margin: 0; }

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-state p { color: #6B7280; margin: 12px 0; font-size: 14px; }

.empty-submit-btn {
  padding: 8px 20px;
  background: #3B82F6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.empty-submit-btn:hover { background: #2563EB; }

.suggestion-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.suggestion-item {
  background: white;
  border-radius: 10px;
  padding: 16px 20px;
  border: 1px solid #E5E7EB;
  transition: box-shadow 0.2s;
}

.suggestion-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.item-summary {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-summary.placeholder { color: #9CA3AF; font-style: italic; }

.item-status {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
  margin-left: 12px;
}

.status-pending { background: #FEF3C7; color: #92400E; }
.status-processing { background: #DBEAFE; color: #1E40AF; }
.status-completed { background: #D1FAE5; color: #065F46; }
.status-rejected { background: #FEE2E2; color: #991B1B; }

.item-content {
  font-size: 13px;
  color: #4B5563;
  line-height: 1.6;
  margin-bottom: 10px;
  white-space: pre-wrap;
  word-break: break-all;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 0;
  font-size: 11px;
  color: #9CA3AF;
}

.meta-item { white-space: nowrap; }
.meta-divider { margin: 0 6px; }

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 24px;
}

.page-btn {
  padding: 6px 16px;
  background: white;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #374151;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) { background: #F3F4F6; }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.page-info {
  font-size: 13px;
  color: #6B7280;
}

@media (max-width: 768px) {
  .header-content { padding: 0 12px; }
  .page-title { font-size: 15px; }
  .page-container { padding: 16px 12px; }
  .form-card { padding: 16px; }
  .suggestion-item { padding: 12px 14px; }
  .item-summary { font-size: 14px; }
}
</style>
