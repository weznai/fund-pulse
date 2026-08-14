<template>
  <div class="user-manage-page">
    <div class="page-header">
      <h2 class="page-title">用户管理</h2>
      <p class="page-desc">查看系统中的所有用户及其持仓信息</p>
    </div>

    <div class="content-body">
      <!-- 搜索区域 -->
      <div class="search-section">
        <div class="search-form">
          <input
            v-model="searchKeyword"
            type="text"
            class="search-input"
            placeholder="搜索用户ID、用户名、邮箱..."
            @keyup.enter="searchUsers"
          />
          <button class="btn btn-primary" @click="searchUsers">
            搜索
          </button>
          <button class="btn btn-secondary" @click="resetSearch">
            重置
          </button>
        </div>
      </div>

      <!-- 用户列表 -->
      <div class="users-section">
        <div class="section-header">
          <h3>用户列表</h3>
          <span class="user-count">共 {{ filteredUsers.length }} 个用户</span>
        </div>

        <div class="loading-state" v-if="loading">
          <span class="spinner"></span>
          <span>加载中...</span>
        </div>

        <div class="error-state" v-else-if="loadError">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <p>{{ loadError }}</p>
        </div>

        <div class="table-container" v-else-if="filteredUsers.length > 0">
          <table class="data-table">
            <thead>
              <tr>
                <th>用户ID</th>
                <th>类型</th>
                <th>邮箱</th>
                <th>用户名</th>
                <th>自选基金</th>
                <th>持仓数量</th>
                <th class="sortable" :class="{ active: sortKey === 'createdAt' }" @click="toggleSort('createdAt')">
                  创建时间
                  <span class="sort-icon" v-if="sortKey === 'createdAt'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
                  <span class="sort-icon idle" v-else>⇅</span>
                </th>
                <th class="sortable" :class="{ active: sortKey === 'lastActive' }" @click="toggleSort('lastActive')">
                  最后活跃
                  <span class="sort-icon" v-if="sortKey === 'lastActive'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
                  <span class="sort-icon idle" v-else>⇅</span>
                </th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
                <tr v-for="user in filteredUsers" :key="user.id" :class="{ 'disabled-row': user.disabled }">
                <td class="user-id">
                  {{ user.id }}
                  <span v-if="user.disabled" class="disabled-tag">已禁用</span>
                </td>
                <td>
                  <span class="type-badge" :class="user.type">{{ getTypeLabel(user.type) }}</span>
                </td>
                <td class="user-email">{{ user.email || '-' }}</td>
                <td>
                  <span 
                    v-if="editingUserId !== user.id" 
                    class="editable-label"
                    @dblclick="startEditLabel(user)"
                    :title="'双击修改'"
                  >
                    {{ user.label || '-' }}
                  </span>
                  <input
                    v-else
                    ref="labelInputRef"
                    v-model="editingLabel"
                    class="label-input"
                    @blur="saveLabel(user)"
                    @keyup.enter="saveLabel(user)"
                    @keyup.escape="cancelEdit"
                  />
                </td>
                <td>{{ user.favoriteCount || 0 }}</td>
                <td>{{ user.holdingCount || 0 }}</td>
                <td>{{ formatDate(user.createdAt) }}</td>
                <td>{{ formatDate(user.lastActive) }}</td>
                <td>
                  <div class="action-buttons">
                    <button class="btn btn-sm btn-primary btn-view-holdings" @click="viewUserHoldings(user)">
                      持仓
                    </button>
                    <button
                      v-if="!user.disabled"
                      class="btn btn-sm btn-danger"
                      :disabled="togglingUserId === user.id"
                      @click="toggleUserDisabled(user, true)"
                    >
                      {{ togglingUserId === user.id ? '...' : '禁用' }}
                    </button>
                    <button
                      v-else
                      class="btn btn-sm btn-success"
                      :disabled="togglingUserId === user.id"
                      @click="toggleUserDisabled(user, false)"
                    >
                      {{ togglingUserId === user.id ? '...' : '启用' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="empty-state" v-else>
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <p>暂无用户数据</p>
        </div>
      </div>

      <!-- 统计信息 -->
      <div class="stats-section">
        <div class="stat-card">
          <div class="stat-icon users">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2"/>
              <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2"/>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.totalUsers }}</div>
            <div class="stat-label">总用户数</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon holdings">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2"/>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.totalHoldings }}</div>
            <div class="stat-label">总持仓数</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon active">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.activeUsers }}</div>
            <div class="stat-label">活跃用户 (7天内)</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()

const users = ref<any[]>([])
const searchKeyword = ref('')
const loading = ref(true)
const loadError = ref('')
const editingUserId = ref<string | null>(null)
const editingLabel = ref('')
const labelInputRef = ref<HTMLInputElement | null>(null)
const togglingUserId = ref<string | null>(null)
const sortKey = ref<'createdAt' | 'lastActive'>('lastActive')
const sortOrder = ref<'asc' | 'desc'>('desc')

const stats = computed(() => {
  const totalUsers = users.value.length
  const totalHoldings = users.value.reduce((sum, u) => sum + (u.holdingCount || 0), 0)
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const activeUsers = users.value.filter(u => (u.lastActive || 0) > sevenDaysAgo).length
  return { totalUsers, totalHoldings, activeUsers }
})

const filteredUsers = computed(() => {
  let result = users.value
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (keyword) {
    result = result.filter(user =>
      user.id.toLowerCase().includes(keyword) ||
      (user.label && user.label.toLowerCase().includes(keyword)) ||
      (user.email && user.email.toLowerCase().includes(keyword))
    )
  }
  const key = sortKey.value
  const dir = sortOrder.value === 'asc' ? 1 : -1
  result = [...result].sort((a, b) => {
    const va = a[key] || 0
    const vb = b[key] || 0
    if (va === vb) return 0
    return va > vb ? dir : -dir
  })
  return result
})

function toggleSort(key: 'createdAt' | 'lastActive') {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = 'desc'
  }
}

async function loadUsers() {
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await axios.get('/api/admin/users')
    users.value = data || []
  } catch (error: any) {
    console.error('加载用户列表失败:', error)
    loadError.value = error.response?.data?.error || '加载失败，请刷新重试'
  } finally {
    loading.value = false
  }
}

function searchUsers() {
}

function resetSearch() {
  searchKeyword.value = ''
}

function viewUserHoldings(user: any) {
  router.push(`/admin/user-holdings/${encodeURIComponent(user.id)}`)
}

function formatDate(timestamp: number) {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getTypeLabel(type: string) {
  const labels: Record<string, string> = {
    'machine': '机器',
    'phone': '手机',
    'email': '邮箱',
    'custom': '自定义'
  }
  return labels[type] || type
}

function startEditLabel(user: any) {
  editingUserId.value = user.id
  editingLabel.value = user.label || ''
  nextTick(() => {
    labelInputRef.value?.focus()
    labelInputRef.value?.select()
  })
}

async function saveLabel(user: any) {
  const newLabel = editingLabel.value.trim()
  
  if (newLabel === (user.label || '')) {
    cancelEdit()
    return
  }

  try {
    const { data } = await axios.put(`/api/admin/users/${user.id}/label`, { label: newLabel })
    if (data.success) {
      user.label = data.label
    }
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || '更新失败'
    alert(errorMsg)
  }
  
  cancelEdit()
}

async function toggleUserDisabled(user: any, disabled: boolean) {
  togglingUserId.value = user.id
  try {
    const { data } = await axios.put(`/api/admin/users/${user.id}/disabled`, { disabled })
    if (data.success) {
      user.disabled = disabled
    }
  } catch (error: any) {
    alert(error.response?.data?.error || '操作失败')
  } finally {
    togglingUserId.value = null
  }
}

function cancelEdit() {
  editingUserId.value = null
  editingLabel.value = ''
}

onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
.user-manage-page {
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

/* 搜索区域 */
.search-section {
  padding: 0;
}

.search-form {
  display: flex;
  gap: 8px;
  align-items: center;
}

.search-input {
  flex: 1;
  padding: 8px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  background: #fff;
  transition: all 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* 用户列表 */
.users-section {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.users-section:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.section-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-header h3::before {
  content: '';
  width: 4px;
  height: 18px;
  background: linear-gradient(180deg, #2563eb 0%, #3b82f6 100%);
  border-radius: 2px;
}

.user-count {
  font-size: 13px;
  font-weight: 600;
  color: #2563eb;
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
  padding: 6px 14px;
  border-radius: 20px;
}

/* 表格 */
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
  padding: 14px 18px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  color: #475569;
  font-weight: 600;
  border-bottom: 2px solid #e2e8f0;
  white-space: nowrap;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.data-table td {
  padding: 16px 18px;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
}

.data-table tbody tr {
  transition: all 0.2s;
}

.data-table tbody tr:hover {
  background: linear-gradient(135deg, #f8fafc 0%, #fff 100%);
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.data-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.data-table th.sortable:hover {
  color: #2563eb;
}

.data-table th.sortable.active {
  color: #2563eb;
}

.sort-icon {
  font-size: 12px;
  margin-left: 2px;
}

.sort-icon.idle {
  opacity: 0.3;
}

.user-id {
  font-family: 'SF Mono', Consolas, monospace;
  font-size: 13px;
  font-weight: 600;
  color: #2563eb;
  display: flex;
  align-items: center;
  gap: 6px;
}

.disabled-tag {
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  background: #fecaca;
  color: #dc2626;
}

.disabled-row {
  opacity: 0.6;
}

.disabled-row td {
  color: #94a3b8 !important;
}

.action-buttons {
  display: flex;
  gap: 6px;
}

.user-email {
  font-size: 13px;
  color: #64748b;
}

.editable-label {
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.editable-label:hover {
  background: #f1f5f9;
}

.label-input {
  padding: 4px 8px;
  border: 2px solid #3b82f6;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
  min-width: 80px;
}

.type-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.type-badge.machine {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  color: #1d4ed8;
}

.type-badge.phone {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  color: #166534;
}

.type-badge.email {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #92400e;
}

.type-badge.custom {
  background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%);
  color: #7c3aed;
}

/* 空状态 */
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

/* 错误状态 */
.error-state {
  text-align: center;
  padding: 48px 24px;
  color: #dc2626;
  background: #fef2f2;
  border-radius: 12px;
  margin: 20px 0;
}

.error-state svg {
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
  opacity: 0.7;
}

.error-state p {
  margin: 4px 0 0 0;
  font-size: 14px;
}

/* 加载状态 */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 64px 24px;
  color: #64748b;
}

/* 统计信息 */
.stats-section {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stat-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 18px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon svg {
  width: 26px;
  height: 26px;
}

.stat-icon.users {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  color: #2563eb;
}

.stat-card:has(.stat-icon.users)::before {
  background: linear-gradient(90deg, #2563eb, #3b82f6);
}

.stat-icon.holdings {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  color: #059669;
}

.stat-card:has(.stat-icon.holdings)::before {
  background: linear-gradient(90deg, #059669, #34d399);
}

.stat-icon.active {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #d97706;
}

.stat-card:has(.stat-icon.active)::before {
  background: linear-gradient(90deg, #d97706, #fbbf24);
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1;
  margin-bottom: 6px;
}

.stat-label {
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
}

/* 按钮 */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-sm {
  padding: 5px 10px;
  font-size: 12px;
}

.btn-primary {
  background: #3b82f6;
  color: #fff;
}

.btn-primary:hover{
  background: #2563eb;
}

.btn-view-holdings{
  background: #60a5fa;
  font-weight: normal;
}

.btn-view-holdings:hover{
  background: #3b82f6;
}

.btn-danger {
  background: #ef4444;
  color: #fff;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

.btn-success {
  background: #10b981;
  color: #fff;
}

.btn-success:hover:not(:disabled) {
  background: #059669;
}

.btn-danger:disabled, .btn-success:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #fff;
  color: #475569;
  border: 1px solid #e2e8f0;
}

.btn-secondary:hover{
  background: #f8fafc;
  border-color: #cbd5e1;
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

@media (max-width: 768px) {
  .stats-section {
    grid-template-columns: 1fr;
  }

  .search-form {
    flex-direction: column;
  }
}
</style>
