<template>
  <div class="report-page">
    <div class="page-header">
      <h2 class="page-title">报告管理</h2>
      <p class="page-desc">管理股票智能分析报告，过期报告自动清理（7天）</p>
    </div>

    <div class="content-body">
      <!-- 统计摘要 -->
      <div class="stats-row" v-if="stats">
        <div class="stat-card">
          <span class="stat-value">{{ stats.total }}</span>
          <span class="stat-label">报告总数</span>
        </div>
        <div class="stat-card stat-buy">
          <span class="stat-value">{{ stats.buyCount }}</span>
          <span class="stat-label">买入</span>
        </div>
        <div class="stat-card stat-hold">
          <span class="stat-value">{{ stats.holdCount }}</span>
          <span class="stat-label">持有</span>
        </div>
        <div class="stat-card stat-sell">
          <span class="stat-value">{{ stats.sellCount }}</span>
          <span class="stat-label">卖出</span>
        </div>
        <div class="stat-card stat-expired" :class="{ 'has-expired': stats.expiredCount > 0 }">
          <span class="stat-value">{{ stats.expiredCount }}</span>
          <span class="stat-label">已过期</span>
        </div>
      </div>

      <!-- 搜索栏 -->
      <div class="filter-section">
        <div class="filter-row">
          <div class="filter-item">
            <label>关键字</label>
            <input v-model="keyword" @keyup.enter="resetAndLoad" placeholder="股票代码/名称..." class="filter-input" />
          </div>
          <div class="filter-item">
            <label>决策</label>
            <select v-model="decision" class="filter-input filter-select" @change="resetAndLoad">
              <option value="">全部</option>
              <option value="BUY">买入</option>
              <option value="SELL">卖出</option>
              <option value="HOLD">持有</option>
            </select>
          </div>
          <div class="filter-item">
            <label>开始日期</label>
            <input v-model="startDate" type="date" class="filter-input filter-date" @change="resetAndLoad" />
          </div>
          <div class="filter-item">
            <label>结束日期</label>
            <input v-model="endDate" type="date" class="filter-input filter-date" @change="resetAndLoad" />
          </div>
          <div class="filter-actions">
            <button class="btn btn-primary" @click="resetAndLoad">查询</button>
            <button class="btn btn-secondary" @click="resetSearch">重置</button>
            <button class="btn btn-danger" v-if="stats && stats.expiredCount > 0" @click="cleanupExpired">清理过期 ({{ stats.expiredCount }})</button>
          </div>
        </div>
      </div>

      <!-- 批量操作 -->
      <div class="batch-bar" v-if="selectedIds.size > 0">
        <span>已选 {{ selectedIds.size }} 项</span>
        <button class="btn btn-danger btn-sm" @click="batchDelete">批量删除</button>
        <button class="btn btn-secondary btn-sm" @click="selectedIds.clear()">取消</button>
      </div>

      <!-- 数据表格 -->
      <div class="table-section">
        <div class="loading-state" v-if="loading">
          <span class="spinner"></span>
          <span>加载中...</span>
        </div>

        <template v-else>
          <div class="table-container" v-if="list.length > 0">
            <table class="data-table">
              <thead>
                <tr>
                  <th class="col-check"><input type="checkbox" :checked="allChecked" @change="toggleAll" /></th>
                  <th>ID</th>
                  <th>股票</th>
                  <th>决策</th>
                  <th>用户</th>
                  <th>生成时间</th>
                  <th>过期时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in list" :key="row.id" :class="{ 'row-expired': isExpired(row.expires_at) }">
                  <td class="col-check"><input type="checkbox" :checked="selectedIds.has(row.id)" @change="toggleRow(row.id)" /></td>
                  <td class="col-id">{{ row.id }}</td>
                  <td>
                    <div class="stock-cell">
                      <span class="stock-name-text">{{ row.stock_name }}</span>
                      <span class="stock-code-text">{{ row.stock_code }}</span>
                    </div>
                  </td>
                  <td>
                    <span class="decision-tag" :class="row.decision.toLowerCase()">
                      {{ row.decision === 'BUY' ? '买入' : row.decision === 'SELL' ? '卖出' : '持有' }}
                    </span>
                  </td>
                  <td class="col-user">{{ row.username || '-' }}</td>
                  <td class="col-time">{{ row.created_at }}</td>
                  <td class="col-time" :class="{ 'text-expired': isExpired(row.expires_at) }">{{ row.expires_at }}</td>
                  <td>
                    <div class="action-cell">
                      <a :href="row.url" target="_blank" class="btn btn-sm btn-link">查看</a>
                      <button class="btn btn-sm btn-danger" @click="deleteReport(row)">删除</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="empty-state" v-else>
            <span>暂无报告数据</span>
          </div>

          <div class="pagination" v-if="total > pageSize">
            <button class="page-btn" :disabled="page <= 1" @click="page--; loadList()">上一页</button>
            <span class="page-info">{{ page }} / {{ totalPages }}</span>
            <button class="page-btn" :disabled="page >= totalPages" @click="page++; loadList()">下一页</button>
            <span class="total-info">共 {{ total }} 条</span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface ReportRow {
  id: number
  stock_code: string
  stock_name: string
  decision: string
  file_path: string
  url: string
  user_id: string
  username: string
  created_at: string
  expires_at: string
}

const loading = ref(false)
const list = ref<ReportRow[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const keyword = ref('')
const decision = ref('')
const startDate = ref('')
const endDate = ref('')
const selectedIds = ref(new Set<number>())

const stats = ref<{ total: number; buyCount: number; sellCount: number; holdCount: number; expiredCount: number } | null>(null)

const totalPages = computed(() => Math.ceil(total.value / pageSize))
const allChecked = computed(() => list.value.length > 0 && list.value.every(r => selectedIds.value.has(r.id)))

function isExpired(expiresAt: string): boolean {
  const now = new Date().toLocaleDateString('sv-SE') + ' ' + new Date().toTimeString().slice(0, 8)
  return expiresAt < now
}

function resetSearch() {
  keyword.value = ''
  decision.value = ''
  startDate.value = ''
  endDate.value = ''
  resetAndLoad()
}

function resetAndLoad() {
  page.value = 1
  loadList()
}

function toggleAll() {
  if (allChecked.value) {
    selectedIds.value.clear()
  } else {
    list.value.forEach(r => selectedIds.value.add(r.id))
  }
}

function toggleRow(id: number) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
}

async function loadList() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    params.set('page', String(page.value))
    params.set('pageSize', String(pageSize))
    if (keyword.value.trim()) params.set('keyword', keyword.value.trim())
    if (decision.value) params.set('decision', decision.value)
    if (startDate.value) params.set('startDate', startDate.value)
    if (endDate.value) params.set('endDate', endDate.value)

    const token = localStorage.getItem('admin_token')
    const resp = await fetch(`/api/admin/reports?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await resp.json()
    list.value = data.list || []
    total.value = data.total || 0
  } catch (e) {
    console.error('获取报告列表失败:', e)
  }
  loading.value = false
}

async function loadStats() {
  try {
    const token = localStorage.getItem('admin_token')
    const resp = await fetch('/api/admin/reports/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await resp.json()
    stats.value = data
  } catch (e) {
    console.error('获取报告统计失败:', e)
  }
}

async function deleteReport(row: ReportRow) {
  if (!confirm(`确认删除报告「${row.stock_name}(${row.stock_code})」？`)) return
  try {
    const token = localStorage.getItem('admin_token')
    const resp = await fetch(`/api/admin/reports/${row.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await resp.json()
    if (data.success) {
      loadList()
      loadStats()
    } else {
      alert(data.error || '删除失败')
    }
  } catch (e) {
    console.error('删除报告失败:', e)
    alert('删除失败')
  }
}

async function batchDelete() {
  const ids = Array.from(selectedIds.value)
  if (ids.length === 0) return
  if (!confirm(`确认删除选中的 ${ids.length} 个报告？`)) return
  try {
    const token = localStorage.getItem('admin_token')
    const resp = await fetch('/api/admin/reports/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ ids })
    })
    const data = await resp.json()
    if (data.success) {
      selectedIds.value.clear()
      loadList()
      loadStats()
    } else {
      alert(data.error || '批量删除失败')
    }
  } catch (e) {
    console.error('批量删除失败:', e)
    alert('批量删除失败')
  }
}

async function cleanupExpired() {
  if (!confirm('确认清理所有过期报告？此操作不可恢复。')) return
  try {
    const token = localStorage.getItem('admin_token')
    const resp = await fetch('/api/admin/reports/cleanup', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await resp.json()
    if (data.success) {
      alert(`已清理 ${data.deleted} 个过期报告`)
      loadList()
      loadStats()
    } else {
      alert(data.error || '清理失败')
    }
  } catch (e) {
    console.error('清理过期报告失败:', e)
    alert('清理失败')
  }
}

onMounted(() => {
  loadList()
  loadStats()
})
</script>

<style scoped>
.report-page { max-width: 1200px; }

.page-header { margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; }
.page-title { font-size: 18px; font-weight: 600; color: #2563eb; margin: 0 0 8px 0; }
.page-desc { font-size: 14px; color: #64748b; margin: 0; }

.content-body { display: flex; flex-direction: column; gap: 16px; }

.stats-row { display: flex; gap: 12px; flex-wrap: wrap; }
.stat-card {
  flex: 1; min-width: 100px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
  padding: 14px 16px; display: flex; flex-direction: column; align-items: center; gap: 2px;
}
.stat-value { font-size: 24px; font-weight: 700; color: #2563eb; }
.stat-label { font-size: 12px; color: #64748b; font-weight: 500; }
.stat-buy .stat-value { color: #2563EB; }
.stat-sell .stat-value { color: #DC2626; }
.stat-hold .stat-value { color: #D97706; }
.stat-expired .stat-value { color: #94A3B8; }
.stat-expired.has-expired .stat-value { color: #EF4444; }

.filter-section {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 20px;
}
.filter-row { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.filter-item { display: flex; flex-direction: column; gap: 4px; }
.filter-item label { font-size: 12px; color: #64748b; font-weight: 500; }
.filter-input {
  padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 6px;
  font-size: 13px; min-width: 160px; background: #fff;
}
.filter-select { min-width: 100px; }
.filter-date { min-width: 140px; }
.filter-actions { display: flex; gap: 8px; margin-left: auto; }

.btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px; border: none; border-radius: 6px;
  font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; text-decoration: none;
}
.btn-secondary { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
.btn-secondary:hover { background: #e2e8f0; }
.btn-primary { background: #3b82f6; color: #fff; }
.btn-primary:hover { background: #2563eb; }
.btn-danger { background: #ef4444; color: #fff; }
.btn-danger:hover { background: #dc2626; }
.btn-link { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
.btn-link:hover { background: #dbeafe; }
.btn-sm { padding: 4px 10px; font-size: 12px; }

.batch-bar {
  display: flex; align-items: center; gap: 10px;
  background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px;
  padding: 8px 16px; font-size: 13px; color: #92400e; font-weight: 500;
}

.table-section { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; }
.table-container { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th {
  background: #f8fafc; padding: 10px 12px; text-align: left;
  font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; white-space: nowrap;
}
.data-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: middle; }
.data-table tr.row-expired { opacity: 0.55; }

.col-check { width: 36px; text-align: center; }
.col-check input { cursor: pointer; }
.col-id { font-weight: 600; color: #64748b; white-space: nowrap; }
.col-user { font-size: 12px; color: #64748b; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.col-time { white-space: nowrap; font-size: 12px; color: #64748b; }
.text-expired { color: #ef4444; }

.stock-cell { display: flex; flex-direction: column; gap: 2px; }
.stock-name-text { font-weight: 600; color: #1e293b; }
.stock-code-text { font-size: 11px; color: #94a3b8; font-family: monospace; }

.decision-tag {
  display: inline-block; padding: 2px 10px; border-radius: 5px; font-size: 11px; font-weight: 700;
}
.decision-tag.buy { background: #dbeafe; color: #1e40af; }
.decision-tag.sell { background: #fee2e2; color: #991b1b; }
.decision-tag.hold { background: #fef3c7; color: #92400e; }

.action-cell { display: flex; gap: 6px; }

.loading-state, .empty-state {
  display: flex; align-items: center; justify-content: center;
  gap: 8px; padding: 40px; color: #94a3b8; font-size: 14px;
}

.pagination {
  display: flex; align-items: center; justify-content: center;
  gap: 12px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #f1f5f9;
}
.page-btn {
  padding: 6px 14px; border: 1px solid #e2e8f0; border-radius: 6px;
  background: #fff; font-size: 13px; cursor: pointer; color: #475569; transition: all 0.2s;
}
.page-btn:hover:not(:disabled) { background: #f1f5f9; }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.page-info { font-size: 13px; color: #64748b; }
.total-info { font-size: 12px; color: #94a3b8; }

.spinner {
  width: 16px; height: 16px; border: 2px solid #e2e8f0;
  border-top-color: #3b82f6; border-radius: 50%;
  animation: spin 0.6s linear infinite; display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
