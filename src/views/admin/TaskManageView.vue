<template>
  <div class="task-manage-page">
    <div class="page-header">
      <h2 class="page-title">任务管理</h2>
      <p class="page-desc">管理系统定时任务执行</p>
    </div>

    <div class="content-body">
      <!-- 筛选区域 -->
      <div class="filter-section">
        <div class="filter-row">
          <div class="filter-item">
            <label>任务类型</label>
            <select v-model="filters.taskType" class="form-select" @change="loadTasks">
              <option value="">全部</option>
              <option value="settlement">结算任务</option>
              <option value="sync">同步任务</option>
              <option value="backup">备份任务</option>
              <option value="cleanup">清理任务</option>
            </select>
          </div>
          <div class="filter-item">
            <label>任务状态</label>
            <select v-model="filters.status" class="form-select" @change="loadTasks">
              <option value="">全部</option>
              <option value="pending">等待中</option>
              <option value="running">执行中</option>
              <option value="completed">已完成</option>
              <option value="terminated">已终止</option>
            </select>
          </div>
          <div class="filter-item">
            <label>任务日期</label>
            <input v-model="filters.taskDate" type="date" class="form-input" @change="loadTasks" />
          </div>
          <div class="filter-actions">
            <button class="btn btn-secondary" @click="resetFilters">重置</button>
            <button class="btn btn-primary" @click="showCreateModal = true">
              <svg viewBox="0 0 24 24" fill="none" class="btn-icon">
                <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              创建任务
            </button>
          </div>
        </div>
      </div>

      <!-- 任务列表 -->
      <div class="tasks-section">
        <div class="loading-state" v-if="loading">
          <span class="spinner"></span>
          <span>加载中...</span>
        </div>

        <div class="table-container" v-else-if="tasks.length > 0">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>任务名称</th>
                <th>任务类型</th>
                <th>任务日期</th>
                <th>状态</th>
                <th>执行次数</th>
                <th>描述</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="task in tasks" :key="task.id">
                <td class="task-id">{{ task.id }}</td>
                <td class="task-name">{{ task.taskName }}</td>
                <td>
                  <span class="type-badge" :class="task.taskType">{{ getTypeName(task.taskType) }}</span>
                </td>
                <td>{{ task.taskDate }}</td>
                <td>
                  <span class="status-badge" :class="task.status">{{ getStatusName(task.status) }}</span>
                </td>
                <td>{{ task.executeCount }}</td>
                <td class="task-desc">{{ task.description || '-' }}</td>
                <td>{{ formatTime(task.createdAt) }}</td>
                <td>
                  <div class="action-btns">
                    <button
                      v-if="task.status === 'pending' || task.status === 'running'"
                      class="btn btn-sm btn-run"
                      @click="runTask(task)"
                      :disabled="runningTaskId === task.id"
                    >
                      {{ runningTaskId === task.id ? '执行中...' : '执行' }}
                    </button>
                    <button
                      v-if="task.status === 'pending' || task.status === 'running'"
                      class="btn btn-sm btn-danger"
                      @click="terminateTask(task)"
                    >
                      终止
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="empty-state" v-else>
          <svg viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
            <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2"/>
          </svg>
          <p>暂无任务记录</p>
        </div>

        <!-- 分页 -->
        <div class="pagination" v-if="total > pageSize">
          <button class="page-btn" :disabled="page === 1" @click="page--">上一页</button>
          <span class="page-info">{{ page }} / {{ totalPages }}</span>
          <button class="page-btn" :disabled="page >= totalPages" @click="page++">下一页</button>
        </div>
      </div>
    </div>

    <!-- 创建任务弹窗 -->
    <div class="modal-overlay" v-if="showCreateModal" @click.self="showCreateModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>创建任务</h3>
          <button class="modal-close" @click="showCreateModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>任务名称</label>
            <input v-model="createForm.taskName" type="text" class="form-input" placeholder="请输入任务名称" />
          </div>
          <div class="form-group">
            <label>任务类型</label>
            <select v-model="createForm.taskType" class="form-select">
              <option value="settlement">结算任务</option>
              <option value="sync">同步任务</option>
              <option value="backup">备份任务</option>
              <option value="cleanup">清理任务</option>
            </select>
          </div>
          <div class="form-group">
            <label>任务日期</label>
            <input v-model="createForm.taskDate" type="date" class="form-input" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showCreateModal = false">取消</button>
          <button class="btn btn-primary" @click="createTask" :disabled="!createForm.taskName || !createForm.taskDate">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'

interface Task {
  id: number
  taskName: string
  taskType: string
  taskDate: string
  status: string
  executeCount: number
  description?: string
  startTime?: number
  endTime?: number
  createdAt: number
  updatedAt: number
}

const loading = ref(false)
const tasks = ref<Task[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const runningTaskId = ref<number | null>(null)
const showCreateModal = ref(false)

const filters = ref({
  taskType: '',
  status: '',
  taskDate: ''
})

const createForm = ref({
  taskName: '',
  taskType: 'settlement',
  taskDate: new Date().toISOString().split('T')[0]
})

const totalPages = computed(() => Math.ceil(total.value / pageSize))

async function loadTasks() {
  loading.value = true
  try {
    const params: any = {
      limit: pageSize,
      offset: (page.value - 1) * pageSize
    }
    if (filters.value.taskType) params.taskType = filters.value.taskType
    if (filters.value.status) params.status = filters.value.status
    if (filters.value.taskDate) params.taskDate = filters.value.taskDate

    const { data } = await axios.get('/api/admin/tasks', { params })
    tasks.value = data.tasks || []
    total.value = data.total || 0
  } catch (error) {
    console.error('加载任务列表失败:', error)
  } finally {
    loading.value = false
  }
}

async function runTask(task: Task) {
  if (!confirm(`确定要手动执行任务 "${task.taskName}" 吗？`)) return

  runningTaskId.value = task.id
  try {
    const { data } = await axios.post(`/api/admin/tasks/${task.id}/run`, {
      taskType: task.taskType,
      date: task.taskDate
    })
    alert(data.message || '任务执行成功')
    loadTasks()
  } catch (error: any) {
    alert(error.response?.data?.error || '任务执行失败')
  } finally {
    runningTaskId.value = null
  }
}

async function terminateTask(task: Task) {
  if (!confirm(`确定要终止任务 "${task.taskName}" 吗？`)) return

  try {
    await axios.post(`/api/admin/tasks/${task.id}/terminate`)
    loadTasks()
  } catch (error: any) {
    alert(error.response?.data?.error || '终止任务失败')
  }
}

async function createTask() {
  if (!createForm.value.taskName || !createForm.value.taskDate) return

  try {
    await axios.post('/api/admin/tasks', createForm.value)
    showCreateModal.value = false
    createForm.value = {
      taskName: '',
      taskType: 'settlement',
      taskDate: new Date().toISOString().split('T')[0]
    }
    loadTasks()
  } catch (error: any) {
    alert(error.response?.data?.error || '创建任务失败')
  }
}

function resetFilters() {
  filters.value = { taskType: '', status: '', taskDate: '' }
  page.value = 1
  loadTasks()
}

function getTypeName(type: string): string {
  const types: Record<string, string> = {
    settlement: '结算',
    sync: '同步',
    backup: '备份',
    cleanup: '清理'
  }
  return types[type] || type
}

function getStatusName(status: string): string {
  const statuses: Record<string, string> = {
    pending: '等待中',
    running: '执行中',
    completed: '已完成',
    terminated: '已终止'
  }
  return statuses[status] || status
}

function formatTime(timestamp: number): string {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

watch(page, () => {
  loadTasks()
})

onMounted(() => {
  loadTasks()
})
</script>

<style scoped>
.task-manage-page {
  padding: 0;
}

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
  gap: 20px;
}

.filter-section {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 20px 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.filter-row {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-item label {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
}

.filter-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.tasks-section {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.table-container {
  overflow-x: auto;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.data-table th {
  text-align: left;
  padding: 14px 16px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  color: #475569;
  font-weight: 600;
  border-bottom: 2px solid #e2e8f0;
  font-size: 13px;
  white-space: nowrap;
}

.data-table td {
  padding: 14px 16px;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
}

.data-table tbody tr:hover {
  background: #f8fafc;
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.task-id {
  font-family: 'SF Mono', Consolas, monospace;
  font-size: 13px;
  color: #64748b;
}

.task-name {
  font-weight: 600;
  color: #2563eb;
}

.task-desc {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.type-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.type-badge.settlement {
  background: #dbeafe;
  color: #1d4ed8;
}

.type-badge.sync {
  background: #dcfce7;
  color: #16a34a;
}

.type-badge.backup {
  background: #fef3c7;
  color: #d97706;
}

.type-badge.cleanup {
  background: #f3e8ff;
  color: #9333ea;
}

.status-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.status-badge.pending {
  background: #f1f5f9;
  color: #475569;
}

.status-badge.running {
  background: #dbeafe;
  color: #1d4ed8;
}

.status-badge.completed {
  background: #dcfce7;
  color: #16a34a;
}

.status-badge.terminated {
  background: #fee2e2;
  color: #dc2626;
}

.action-btns {
  display: flex;
  gap: 8px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.page-btn {
  padding: 8px 16px;
  border: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 8px;
  font-size: 14px;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: #64748b;
}

.empty-state {
  text-align: center;
  padding: 64px 24px;
  color: #94a3b8;
}

.empty-state svg {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: 15px;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 64px 24px;
  color: #64748b;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.btn-icon {
  width: 16px;
  height: 16px;
}

.btn-primary {
  background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
  color: #fff;
  box-shadow: 0 2px 8px rgba(30, 58, 95, 0.3);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(30, 58, 95, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary {
  background: #fff;
  color: #475569;
  border: 1px solid #e2e8f0;
}

.btn-secondary:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.btn-run {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  color: #16a34a;
}

.btn-run:hover {
  background: linear-gradient(135deg, #bbf7d0 0%, #86efac 100%);
}

.btn-danger {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  color: #dc2626;
}

.btn-danger:hover {
  background: linear-gradient(135deg, #fecaca 0%, #fca5a5 100%);
}

.form-select,
.form-input {
  padding: 10px 14px;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
  transition: all 0.2s;
  min-width: 150px;
}

.form-select:focus,
.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e2e8f0;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #fff;
  border-radius: 16px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #2563eb;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #94a3b8;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.modal-close:hover {
  color: #64748b;
}

.modal-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #475569;
}

.modal-body .form-input,
.modal-body .form-select {
  width: 100%;
  box-sizing: border-box;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  background: #f8fafc;
  border-radius: 0 0 16px 16px;
}
</style>
