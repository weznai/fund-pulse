<template>
  <div class="suggestion-manage-page">
    <div class="page-header">
      <h2 class="page-title">建议管理</h2>
      <p class="page-desc">查看和处理用户提交的建议与问题</p>
    </div>

    <div class="content-body">
      <div class="filter-section">
        <div class="filter-row">
          <div class="stat-chip" :class="{ active: filters.status === '' }" @click="filters.status = ''; loadList()">
            <span>全部</span><strong>{{ total }}</strong>
          </div>
          <div class="stat-chip stat-chip-pending" :class="{ active: filters.status === 'pending' }" @click="filters.status = 'pending'; loadList()">
            <span>待处理</span><strong>{{ statusCounts.pending || 0 }}</strong>
          </div>
          <div class="stat-chip stat-chip-processing" :class="{ active: filters.status === 'processing' }" @click="filters.status = 'processing'; loadList()">
            <span>处理中</span><strong>{{ statusCounts.processing || 0 }}</strong>
          </div>
          <div class="stat-chip stat-chip-completed" :class="{ active: filters.status === 'completed' }" @click="filters.status = 'completed'; loadList()">
            <span>已完成</span><strong>{{ statusCounts.completed || 0 }}</strong>
          </div>
          <div class="stat-chip stat-chip-rejected" :class="{ active: filters.status === 'rejected' }" @click="filters.status = 'rejected'; loadList()">
            <span>已拒绝</span><strong>{{ statusCounts.rejected || 0 }}</strong>
          </div>
          <div class="filter-actions">
            <button class="btn btn-secondary" @click="resetFilters">重置</button>
            <button class="btn btn-secondary" @click="loadList">刷新</button>
          </div>
        </div>
      </div>

      <div class="table-section">
        <div class="loading-state" v-if="loading">
          <span class="spinner"></span>
          <span>加载中...</span>
        </div>

        <div class="table-container" v-else-if="list.length > 0">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>摘要</th>
                <th>内容</th>
                <th>状态</th>
                <th>提交人</th>
                <th>提交时间</th>
                <th>处理时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in list" :key="item.id">
                <td class="col-id">{{ item.id }}</td>
                <td class="col-summary" :class="{ placeholder: item.summary === '更新中...' }">{{ item.summary }}</td>
                <td class="col-content">
                  <span class="content-text" :class="{ expanded: expandedId === item.id }">{{ item.content }}</span>
                  <button v-if="item.content.length > 50 && expandedId !== item.id" class="expand-btn" @click="expandedId = item.id">展开</button>
                  <button v-if="expandedId === item.id" class="expand-btn" @click="expandedId = null">收起</button>
                </td>
                <td>
                  <span class="status-badge" :class="'status-' + item.status">{{ statusName(item.status) }}</span>
                </td>
                <td class="col-submitter">
                  <span class="submitter-badge" :class="item.submitter_type">{{ item.submitter_type === 'registered' ? '用户' : '游客' }}</span>
                </td>
                <td class="col-time">{{ formatTime(item.created_at) }}</td>
                <td class="col-time">{{ item.processed_at ? formatTime(item.processed_at) : '-' }}</td>
                <td>
                  <div class="action-btns">
                    <select class="status-select" :value="item.status" @change="updateStatus(item.id, ($event.target as HTMLSelectElement).value)">
                      <option value="pending">待处理</option>
                      <option value="processing">处理中</option>
                      <option value="completed">已完成</option>
                      <option value="rejected">已拒绝</option>
                    </select>
                    <button class="btn-delete" @click="confirmDelete(item.id)" title="删除">✕</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="empty-state" v-else>
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <p>暂无建议记录</p>
        </div>

        <div class="pagination" v-if="total > pageSize">
          <button class="page-btn" :disabled="page === 1" @click="page--; loadList()">上一页</button>
          <span class="page-info">{{ page }} / {{ totalPages }}</span>
          <button class="page-btn" :disabled="page >= totalPages" @click="page++; loadList()">下一页</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'

interface SuggestionItem {
  id: number
  summary: string
  content: string
  status: string
  processed_at: number | null
  created_at: number
  updated_at: number
  submitter_id: string
  submitter_type: string
}

const loading = ref(false)
const list = ref<SuggestionItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const expandedId = ref<number | null>(null)

const filters = ref({ status: '' })

const statusCounts = ref<Record<string, number>>({})

const totalPages = computed(() => Math.ceil(total.value / pageSize))

async function loadList() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize }
    if (filters.value.status) params.status = filters.value.status
    const { data } = await axios.get('/api/admin/suggestions', { params })
    list.value = data.list || []
    total.value = data.total || 0
    computeCounts()
  } catch (e) {
    console.error('加载建议列表失败:', e)
  } finally {
    loading.value = false
  }
}

function computeCounts() {
  const counts: Record<string, number> = {}
  for (const item of list.value) {
    counts[item.status] = (counts[item.status] || 0) + 1
  }
  statusCounts.value = counts
}

async function updateStatus(id: number, status: string) {
  try {
    await axios.put(`/api/admin/suggestions/${id}/status`, { status })
    loadList()
  } catch (e: any) {
    alert(e?.response?.data?.error || '更新失败')
  }
}

function resetFilters() {
  filters.value = { status: '' }
  page.value = 1
  loadList()
}

async function confirmDelete(id: number) {
  if (!confirm('确定要删除这条建议吗？此操作不可恢复。')) return
  try {
    await axios.delete(`/api/admin/suggestions/${id}`)
    loadList()
  } catch (e: any) {
    alert(e?.response?.data?.error || '删除失败')
  }
}

function statusName(status: string) {
  const map: Record<string, string> = { pending: '待处理', processing: '处理中', completed: '已完成', rejected: '已拒绝' }
  return map[status] || status
}

function formatTime(ts: number): string {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

watch(page, () => { loadList() })
onMounted(() => { loadList() })
</script>

<style scoped>
.suggestion-manage-page { padding: 0; }

.page-header {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #2563eb;
  margin: 0 0 8px 0;
}

.page-desc {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.content-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-section {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px 20px;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s;
  background: #f8fafc;
  user-select: none;
}

.stat-chip span { font-weight: 400; color: #64748b; }
.stat-chip strong { font-weight: 600; color: #2563eb; }

.stat-chip:hover { background: #f1f5f9; border-color: #cbd5e1; }

.stat-chip.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #fff;
}

.stat-chip.active span,
.stat-chip.active strong { color: #fff; }

.stat-chip-pending.active { background: #f59e0b; border-color: #f59e0b; }
.stat-chip-processing.active { background: #3b82f6; border-color: #3b82f6; }
.stat-chip-completed.active { background: #10b981; border-color: #10b981; }
.stat-chip-rejected.active { background: #ef4444; border-color: #ef4444; }

.filter-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary { background: #3b82f6; color: #fff; }
.btn-primary:hover { background: #2563eb; }
.btn-secondary { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
.btn-secondary:hover { background: #e2e8f0; }

.table-section {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
}

.table-container { overflow-x: auto; }

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th {
  background: #f8fafc;
  padding: 10px 12px;
  text-align: left;
  font-weight: 600;
  color: #475569;
  border-bottom: 2px solid #e2e8f0;
  white-space: nowrap;
}

.data-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
  vertical-align: top;
}

.col-id { font-weight: 600; color: #64748b; white-space: nowrap; }
.col-summary { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.col-summary.placeholder { color: #94a3b8; font-style: italic; }

.col-content { max-width: 250px; }
.content-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
}
.content-text.expanded {
  -webkit-line-clamp: unset;
  white-space: pre-wrap;
}

.expand-btn {
  background: none;
  border: none;
  color: #3b82f6;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 0;
}

.col-submitter { white-space: nowrap; }
.submitter-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.submitter-badge.registered { background: #dbeafe; color: #1e40af; }
.submitter-badge.guest { background: #f1f5f9; color: #64748b; }

.col-time { white-space: nowrap; font-size: 12px; color: #64748b; }

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.status-pending { background: #fef3c7; color: #92400e; }
.status-processing { background: #dbeafe; color: #1e40af; }
.status-completed { background: #d1fae5; color: #065f46; }
.status-rejected { background: #fee2e2; color: #991b1b; }

.status-select {
  padding: 4px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  background: #fff;
}

.action-btns { display: flex; gap: 4px; align-items: center; }

.btn-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid #fecaca;
  border-radius: 4px;
  background: #fef2f2;
  color: #dc2626;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-delete:hover { background: #fee2e2; border-color: #f87171; }

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px;
  color: #64748b;
  font-size: 14px;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.empty-state {
  text-align: center;
  padding: 40px;
  color: #94a3b8;
}

.empty-state svg { width: 40px; height: 40px; margin-bottom: 12px; }
.empty-state p { font-size: 14px; }

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f1f5f9;
}

.page-btn {
  padding: 6px 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #475569;
}

.page-btn:hover:not(:disabled) { background: #e2e8f0; }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.page-info { font-size: 13px; color: #64748b; }
</style>
