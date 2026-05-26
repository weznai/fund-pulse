<template>
  <div class="credit-page">
    <div class="page-header">
      <h2 class="page-title">积分管理</h2>
      <p class="page-desc">管理用户智能分析积分</p>
    </div>

    <div class="content-body">
      <!-- 搜索栏 -->
      <div class="filter-section">
        <div class="filter-row">
          <div class="filter-item">
            <label>关键字</label>
            <input
              v-model="keyword"
              @keyup.enter="loadList"
              placeholder="搜索用户ID/类型..."
              class="filter-input"
            />
          </div>
          <div class="filter-actions">
            <button class="btn btn-primary" @click="loadList">查询</button>
            <button class="btn btn-secondary" @click="resetSearch">重置</button>
          </div>
        </div>
      </div>

      <!-- 统计摘要 -->
      <div class="stats-row" v-if="stats">
        <div class="stat-card">
          <span class="stat-value">{{ stats.total }}</span>
          <span class="stat-label">总用户数</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ stats.registeredCount }}</span>
          <span class="stat-label">注册用户</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ stats.guestCount }}</span>
          <span class="stat-label">游客</span>
        </div>
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
                  <th>ID</th>
                  <th>用户ID</th>
                  <th>用户类型</th>
                  <th>当前积分</th>
                  <th>累计使用次数</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in list" :key="row.id">
                  <td class="col-id">{{ row.id }}</td>
                  <td class="col-userid">{{ row.user_id }}</td>
                  <td>
                    <span class="type-badge" :class="row.user_type === 'registered' ? 'registered' : 'guest'">
                      {{ row.user_type === 'registered' ? '注册用户' : '游客' }}
                    </span>
                  </td>
                  <td>
                    <span class="credits-value">{{ row.credits ?? '-' }}</span>
                  </td>
                  <td>{{ row.total_usage }}</td>
                  <td class="col-time">{{ formatTime(row.created_at) }}</td>
                  <td>
                    <button class="btn btn-sm btn-primary" @click="openAdjustDialog(row)">调整积分</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="empty-state" v-else>
            <span>暂无积分数据</span>
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

    <!-- 调整积分对话框 -->
    <div class="dialog-overlay" v-if="adjustDialog.visible" @click.self="adjustDialog.visible = false">
      <div class="dialog-box">
        <div class="dialog-header">
          <h3>调整积分</h3>
          <button class="dialog-close" @click="adjustDialog.visible = false">&times;</button>
        </div>
        <div class="dialog-body">
          <div class="dialog-field">
            <label>用户ID</label>
            <span class="field-value">{{ adjustDialog.userId }}</span>
          </div>
          <div class="dialog-field">
            <label>当前积分</label>
            <span class="field-value credits-current">{{ adjustDialog.currentCredits }}</span>
          </div>
          <div class="dialog-field">
            <label>调整量（正数增加，负数减少）</label>
            <input
              v-model.number="adjustDialog.amount"
              type="number"
              class="filter-input"
              placeholder="输入调整量"
            />
          </div>
          <div class="dialog-field" v-if="adjustDialog.amount !== 0 && adjustDialog.amount !== null">
            <label>调整后积分</label>
            <span class="field-value credits-preview">{{ adjustDialog.currentCredits + (adjustDialog.amount || 0) }}</span>
          </div>
          <div class="dialog-field">
            <label>备注原因（可选）</label>
            <input
              v-model="adjustDialog.reason"
              class="filter-input"
              placeholder="输入调整原因..."
            />
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn btn-secondary" @click="adjustDialog.visible = false">取消</button>
          <button class="btn btn-primary" :disabled="adjusting" @click="submitAdjust">
            {{ adjusting ? '提交中...' : '确认调整' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const loading = ref(false)
const adjusting = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const keyword = ref('')

const stats = ref<{ total: number; registeredCount: number; guestCount: number } | null>(null)

const adjustDialog = ref({
  visible: false,
  userId: '',
  currentCredits: 0,
  amount: 0 as number | null,
  reason: ''
})

const totalPages = computed(() => Math.ceil(total.value / pageSize))

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString('zh-CN', { hour12: false })
}

function resetSearch() {
  keyword.value = ''
  page.value = 1
  loadList()
}

function openAdjustDialog(row: any) {
  adjustDialog.value = {
    visible: true,
    userId: row.user_id,
    currentCredits: row.credits ?? 0,
    amount: 0,
    reason: ''
  }
}

async function loadList() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    params.set('page', String(page.value))
    params.set('pageSize', String(pageSize))
    if (keyword.value.trim()) params.set('keyword', keyword.value.trim())

    const token = localStorage.getItem('admin_token')
    const resp = await fetch(`/api/admin/credits?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await resp.json()
    list.value = data.list || []
    total.value = data.total || 0
    stats.value = {
      total: data.total || 0,
      registeredCount: data.registeredCount || 0,
      guestCount: data.guestCount || 0
    }
  } catch (e) {
    console.error('获取积分列表失败:', e)
  }
  loading.value = false
}

async function submitAdjust() {
  const dlg = adjustDialog.value
  if (dlg.amount === null || dlg.amount === 0) return

  adjusting.value = true
  try {
    const token = localStorage.getItem('admin_token')
    const newCredits = dlg.currentCredits + dlg.amount
    const resp = await fetch(`/api/admin/credits/${encodeURIComponent(dlg.userId)}/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        credits: newCredits,
        reason: dlg.reason || undefined
      })
    })
    const data = await resp.json()
    if (data.success) {
      dlg.visible = false
      loadList()
    } else {
      alert(data.error || '调整失败')
    }
  } catch (e) {
    console.error('调整积分失败:', e)
    alert('调整积分失败')
  }
  adjusting.value = false
}

onMounted(loadList)
</script>

<style scoped>
.credit-page { max-width: 1200px; }

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
.filter-input {
  padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 6px;
  font-size: 13px; min-width: 180px; background: #fff;
}
.filter-actions { display: flex; gap: 8px; margin-left: auto; }

.btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px; border: none; border-radius: 6px;
  font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s;
}
.btn-secondary { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
.btn-secondary:hover { background: #e2e8f0; }
.btn-primary { background: #3b82f6; color: #fff; }
.btn-primary:hover { background: #2563eb; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm { padding: 4px 10px; font-size: 12px; }

/* 统计摘要 */
.stats-row {
  display: flex; gap: 16px;
}
.stat-card {
  flex: 1; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
  padding: 16px 20px; display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.stat-value { font-size: 24px; font-weight: 700; color: #1e3a5f; }
.stat-label { font-size: 12px; color: #64748b; font-weight: 500; }

/* 表格 */
.table-section { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; }
.table-container { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th {
  background: #f8fafc; padding: 10px 12px; text-align: left;
  font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; white-space: nowrap;
}
.data-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: top; }

.col-id { font-weight: 600; color: #64748b; white-space: nowrap; }
.col-userid { font-family: monospace; font-size: 12px; color: #334155; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.col-time { white-space: nowrap; font-size: 12px; color: #64748b; }

.type-badge {
  display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500;
}
.type-badge.registered { background: #dbeafe; color: #1e40af; }
.type-badge.guest { background: #f1f5f9; color: #64748b; }

.credits-value { font-weight: 600; color: #1e3a5f; }

.loading-state, .empty-state {
  display: flex; align-items: center; justify-content: center;
  gap: 8px; padding: 40px; color: #94a3b8; font-size: 14px;
}

/* 分页 */
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

/* 对话框 */
.dialog-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.dialog-box {
  background: #fff; border-radius: 12px; width: 440px; max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
}
.dialog-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid #e5e7eb;
}
.dialog-header h3 { margin: 0; font-size: 16px; color: #1e3a5f; }
.dialog-close {
  background: none; border: none; font-size: 20px; color: #94a3b8; cursor: pointer;
  padding: 0; line-height: 1;
}
.dialog-close:hover { color: #475569; }
.dialog-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.dialog-field { display: flex; flex-direction: column; gap: 4px; }
.dialog-field label { font-size: 12px; color: #64748b; font-weight: 500; }
.dialog-field .filter-input { min-width: unset; width: 100%; }
.field-value { font-size: 14px; color: #334155; font-weight: 500; }
.credits-current { color: #3b82f6; }
.credits-preview { color: #3b82f6; font-weight: 700; }
.dialog-footer {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 12px 20px; border-top: 1px solid #e5e7eb;
}
</style>
