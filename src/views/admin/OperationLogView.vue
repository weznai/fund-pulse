<template>
  <div class="oplog-page">
    <div class="page-header">
      <h2 class="page-title">操作流水</h2>
      <p class="page-desc">查看系统操作流水记录</p>
    </div>

    <div class="content-body">
      <div class="filter-section">
        <div class="filter-row">
          <div class="filter-item">
            <label>功能</label>
            <select v-model="filters.action" @change="loadList" class="filter-select">
              <option value="">全部</option>
              <option value="smart_analysis">智能分析</option>
            </select>
          </div>
          <div class="filter-item">
            <label>用户</label>
            <input v-model="filters.username" @keyup.enter="loadList" placeholder="搜索用户..." class="filter-input" />
          </div>
          <div class="filter-item">
            <label>开始日期</label>
            <input v-model="filters.startDate" type="date" @change="loadList" class="filter-input" />
          </div>
          <div class="filter-item">
            <label>结束日期</label>
            <input v-model="filters.endDate" type="date" @change="loadList" class="filter-input" />
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

        <template v-else>
          <div class="table-container" v-if="logs.length > 0">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>用户</th>
                  <th>IP</th>
                  <th>功能</th>
                  <th>描述</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="log in logs" :key="log.id">
                  <td class="col-id">{{ log.id }}</td>
                  <td>
                    <span class="submitter-badge" :class="log.username === '访客' ? 'guest' : 'registered'">{{ log.username }}</span>
                  </td>
                  <td class="col-ip">{{ log.ip }}</td>
                  <td>
                    <span class="action-badge">{{ getActionLabel(log.action) }}</span>
                  </td>
                  <td class="col-desc">{{ log.description }}</td>
                  <td class="col-time">{{ formatTime(log.created_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="empty-state" v-else>
            <span>暂无操作日志</span>
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

const loading = ref(false)
const logs = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20

const filters = ref({
  action: '',
  username: '',
  startDate: '',
  endDate: ''
})

const totalPages = computed(() => Math.ceil(total.value / pageSize))

function getActionLabel(action: string): string {
  const map: Record<string, string> = { smart_analysis: '智能分析' }
  return map[action] || action
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

function resetFilters() {
  filters.value = { action: '', username: '', startDate: '', endDate: '' }
  page.value = 1
  loadList()
}

async function loadList() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    params.set('page', String(page.value))
    params.set('pageSize', String(pageSize))
    if (filters.value.action) params.set('action', filters.value.action)
    if (filters.value.username) params.set('username', filters.value.username)
    if (filters.value.startDate) params.set('startDate', filters.value.startDate)
    if (filters.value.endDate) params.set('endDate', filters.value.endDate)

    const token = localStorage.getItem('admin_token')
    const resp = await fetch(`/api/admin/operation-logs?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await resp.json()
    logs.value = data.logs || []
    total.value = data.total || 0
  } catch (e) {
    console.error('获取操作日志失败:', e)
  }
  loading.value = false
}

onMounted(loadList)
</script>

<style scoped>
.oplog-page { max-width: 1200px; }

.page-header { margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; }
.page-title { font-size: 18px; font-weight: 600; color: #1e3a5f; margin: 0 0 8px 0; }
.page-desc { font-size: 14px; color: #64748b; margin: 0; }

.content-body { display: flex; flex-direction: column; gap: 16px; }

.filter-section {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 20px;
}
.filter-row { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.filter-item { display: flex; flex-direction: column; gap: 4px; }
.filter-item label { font-size: 12px; color: #64748b; font-weight: 500; }
.filter-input, .filter-select {
  padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 6px;
  font-size: 13px; min-width: 140px; background: #fff;
}
.filter-actions { display: flex; gap: 8px; margin-left: auto; }

.btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px; border: none; border-radius: 6px;
  font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s;
}
.btn-secondary { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
.btn-secondary:hover { background: #e2e8f0; }

.table-section { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; }
.table-container { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th {
  background: #f8fafc; padding: 10px 12px; text-align: left;
  font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; white-space: nowrap;
}
.data-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: top; }

.col-id { font-weight: 600; color: #64748b; white-space: nowrap; }
.col-ip { font-family: monospace; font-size: 12px; color: #64748b; white-space: nowrap; }
.col-desc { max-width: 350px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.col-time { white-space: nowrap; font-size: 12px; color: #64748b; }

.submitter-badge {
  display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500;
}
.submitter-badge.registered { background: #dbeafe; color: #1e40af; }
.submitter-badge.guest { background: #f1f5f9; color: #64748b; }
.action-badge {
  display: inline-block; padding: 2px 8px; border-radius: 10px;
  font-size: 11px; font-weight: 500; background: #ede9fe; color: #5b21b6;
}

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
