<template>
  <div class="fund-manage-page">
    <div class="page-header">
      <h2 class="page-title">基金管理</h2>
    </div>

    <div class="tabs">
      <div class="tabs-left">
        <button class="tab-btn active">
          <svg viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2"/>
            <path d="M7 8h10M7 12h6M7 16h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          基金信息
        </button>
      </div>
    </div>

    <div class="tab-content">
      <div class="toolbar">
        <div class="search-box">
          <input v-model="searchKeyword" type="text" class="search-input" placeholder="搜索本地基金（代码/名称）" @keyup.enter="searchLocal" />
          <button class="btn btn-secondary" @click="searchLocal">本地搜索</button>
          <button class="btn btn-secondary" @click="refreshList" title="刷新">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            刷新
          </button>
        </div>
        <div class="action-buttons">
          <button class="btn btn-primary" @click="showAddModal = true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
              <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            外部查询
          </button>
          <button class="btn btn-secondary" @click="showBatchModal = true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="7 10 12 15 17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            导入
          </button>
          <button class="btn btn-secondary" @click="syncAllFunds" :disabled="syncing">
            <svg viewBox="0 0 24 24" fill="none" v-if="!syncing">
              <path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="spinner" v-if="syncing"></span>
            同步
          </button>
        </div>
      </div>

      <div class="stats-bar">
        <span class="stat-item"><span class="stat-label">总基金数</span><span class="stat-value">{{ totalCount }}</span></span>
        <span class="stat-item"><span class="stat-label">推荐基金</span><span class="stat-value">{{ recommendCount }}</span></span>
        <span class="stat-item" v-if="selectedCodes.size > 0"><span class="stat-label">已选择</span><span class="stat-value">{{ selectedCodes.size }}</span></span>
      </div>

      <div class="batch-actions" v-if="selectedCodes.size > 0">
        <button class="btn btn-sm btn-primary" @click="batchSetRecommend(1)">批量推荐</button>
        <button class="btn btn-sm btn-secondary" @click="batchSetRecommend(0)">取消推荐</button>
        <button class="btn btn-sm btn-danger" @click="batchDelete">批量删除</button>
        <button class="btn btn-sm btn-secondary" @click="selectedCodes.clear()">取消选择</button>
      </div>

      <div class="fund-table-wrapper">
        <table class="fund-table">
          <thead>
            <tr>
              <th class="checkbox-cell">
                <input type="checkbox" :checked="isAllSelected" :indeterminate="isPartialSelected" @change="toggleSelectAll" />
              </th>
              <th>代码</th>
              <th>名称</th>
              <th>类型</th>
              <th>基金公司</th>
              <th>规模(亿)</th>
              <th>推荐</th>
              <th class="action-header">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="8" class="loading-cell"><span class="spinner large"></span><span>加载中...</span></td>
            </tr>
            <tr v-else-if="fundList.length === 0">
              <td colspan="8" class="empty-cell"><span>暂无基金数据</span></td>
            </tr>
            <tr v-else v-for="fund in fundList" :key="fund.code" @dblclick="viewDetail(fund)" style="cursor: pointer;">
              <td class="checkbox-cell" @click.stop>
                <input type="checkbox" :checked="selectedCodes.has(fund.code)" @change="toggleSelect(fund.code)" />
              </td>
              <td class="code-cell">{{ fund.code }}</td>
              <td class="name-cell">{{ fund.name }}</td>
              <td><span class="type-tag" v-if="fund.ftype">{{ fund.ftype }}</span></td>
              <td>{{ fund.fund_company || '-' }}</td>
              <td>{{ fund.fund_scale || '-' }}</td>
              <td>
                <button class="recommend-btn" :class="{ active: fund.is_recommend }" @click="toggleRecommend(fund)">
                  <svg viewBox="0 0 24 24" fill="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" stroke-width="2"/>
                  </svg>
                </button>
              </td>
              <td>
                <div class="action-cell">
                  <button class="btn-text" @click="syncSingleFund(fund)" :disabled="fund.syncing">
                    <span class="spinner" v-if="fund.syncing"></span>
                    <svg viewBox="0 0 24 24" fill="none" v-else>
                      <path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    同步
                  </button>
                  <span class="action-divider">|</span>
                  <button class="btn-text" @click="viewDetail(fund)">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/>
                      <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    详情
                  </button>
                  <span class="action-divider">|</span>
                  <button class="btn-icon danger" @click="deleteFund(fund)" title="删除">
                    <svg viewBox="0 0 24 24" fill="none">
                      <polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2"/>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination" v-if="totalPages > 1">
        <button class="btn-page" :disabled="page === 1" @click="page--; loadFunds()">上一页</button>
        <span class="page-info">{{ page }} / {{ totalPages }}</span>
        <button class="btn-page" :disabled="page >= totalPages" @click="page++; loadFunds()">下一页</button>
      </div>
    </div>

    <div class="modal-overlay" v-if="showAddModal" @click.self="showAddModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>外部查询添加</h3>
          <button class="modal-close" @click="showAddModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="search-form">
            <input v-model="externalKeyword" type="text" class="search-input" placeholder="输入基金代码或名称" @keyup.enter="searchExternal" :disabled="externalSearching" />
            <button class="btn btn-primary" @click="searchExternal" :disabled="externalSearching || !externalKeyword.trim()">
              <span class="spinner" v-if="externalSearching"></span>
              {{ externalSearching ? '搜索中...' : '搜索' }}
            </button>
          </div>
          <div class="search-results" v-if="externalResults.length > 0">
            <div class="result-item" v-for="fund in externalResults" :key="fund.code">
              <div class="result-info">
                <span class="result-code">{{ fund.code }}</span>
                <span class="result-name">{{ fund.name }}</span>
                <span class="result-type" v-if="fund.ftype">{{ fund.ftype }}</span>
              </div>
              <button class="btn btn-sm btn-success" @click="addToLocal(fund)" :disabled="fund.adding">
                <span class="spinner" v-if="fund.adding"></span>
                {{ fund.adding ? '添加中...' : '添加' }}
              </button>
            </div>
          </div>
          <div class="no-results" v-else-if="externalSearched && !externalSearching">未找到匹配的基金</div>
        </div>
      </div>
    </div>

    <div class="modal-overlay" v-if="showBatchModal" @click.self="showBatchModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>批量导入</h3>
          <button class="modal-close" @click="showBatchModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>基金代码（多个代码用逗号或换行分隔）</label>
            <textarea v-model="batchCodes" class="batch-textarea" placeholder="请输入基金代码" rows="6"></textarea>
          </div>
          <div class="batch-preview" v-if="parsedBatchCodes.length > 0">
            <span class="preview-label">识别到 {{ parsedBatchCodes.length }} 个代码</span>
            <div class="preview-codes">
              <span class="code-tag" v-for="code in parsedBatchCodes.slice(0, 20)" :key="code">{{ code }}</span>
              <span class="code-tag more" v-if="parsedBatchCodes.length > 20">+{{ parsedBatchCodes.length - 20 }}</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showBatchModal = false">取消</button>
          <button class="btn btn-primary" @click="batchImport" :disabled="batching || parsedBatchCodes.length === 0">
            <span class="spinner" v-if="batching"></span>
            {{ batching ? '导入中...' : '开始导入' }}
          </button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" v-if="showDetailModal" @click.self="showDetailModal = false">
      <div class="modal modal-lg">
        <div class="modal-header">
          <h3>基金详情</h3>
          <button class="modal-close" @click="showDetailModal = false">×</button>
        </div>
        <div class="modal-body" v-if="detailFund">
          <div class="detail-grid">
            <div class="detail-item"><span class="detail-label">基金代码</span><span class="detail-value">{{ detailFund.code }}</span></div>
            <div class="detail-item"><span class="detail-label">基金名称</span><span class="detail-value">{{ detailFund.name }}</span></div>
            <div class="detail-item"><span class="detail-label">基金类型</span><span class="detail-value">{{ detailFund.ftype || '-' }}</span></div>
            <div class="detail-item"><span class="detail-label">基金公司</span><span class="detail-value">{{ detailFund.fund_company || '-' }}</span></div>
            <div class="detail-item"><span class="detail-label">基金经理</span><span class="detail-value">{{ detailFund.fund_manager || '-' }}</span></div>
            <div class="detail-item"><span class="detail-label">成立日期</span><span class="detail-value">{{ detailFund.establish_date || '-' }}</span></div>
            <div class="detail-item"><span class="detail-label">基金规模</span><span class="detail-value">{{ detailFund.fund_scale ? detailFund.fund_scale + ' 亿' : '-' }}</span></div>
            <div class="detail-item"><span class="detail-label">业绩比较基准</span><span class="detail-value">{{ detailFund.benchmark || '-' }}</span></div>
            <div class="detail-item"><span class="detail-label">状态</span><span class="detail-value">{{ detailFund.status }}</span></div>
            <div class="detail-item"><span class="detail-label">是否推荐</span><span class="detail-value">{{ detailFund.is_recommend ? '是' : '否' }}</span></div>
            <div class="detail-item"><span class="detail-label">创建时间</span><span class="detail-value">{{ formatTime(detailFund.created_at) }}</span></div>
            <div class="detail-item"><span class="detail-label">更新时间</span><span class="detail-value">{{ formatTime(detailFund.updated_at) }}</span></div>
          </div>
        </div>
      </div>
    </div>

    <div class="toast success" v-if="showSuccess">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" stroke-width="2"/>
        <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" stroke-width="2"/>
      </svg>
      {{ successMessage }}
    </div>

    <div class="toast error" v-if="showError">
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
        <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2"/>
      </svg>
      {{ errorMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'



interface FundInfo {
  code: string
  name: string
  pinyin?: string
  ftype?: string
  fund_company?: string
  fund_manager?: string
  establish_date?: string
  fund_scale?: number
  benchmark?: string
  status: string
  is_recommend: number
  created_at: number
  updated_at: number
  syncing?: boolean
}

interface ExternalFund {
  code: string
  name: string
  ftype?: string
  adding?: boolean
}

const fundList = ref<FundInfo[]>([])
const loading = ref(false)
const searchKeyword = ref('')
const page = ref(1)
const pageSize = 20
const totalCount = ref(0)
const recommendCount = ref(0)
const totalPages = computed(() => Math.ceil(totalCount.value / pageSize))

const selectedCodes = ref<Set<string>>(new Set())
const isAllSelected = computed(() => fundList.value.length > 0 && fundList.value.every(f => selectedCodes.value.has(f.code)))
const isPartialSelected = computed(() => {
  const selected = fundList.value.filter(f => selectedCodes.value.has(f.code)).length
  return selected > 0 && selected < fundList.value.length
})

const syncing = ref(false)
const showAddModal = ref(false)
const externalKeyword = ref('')
const externalSearching = ref(false)
const externalSearched = ref(false)
const externalResults = ref<ExternalFund[]>([])

const showBatchModal = ref(false)
const batchCodes = ref('')
const batching = ref(false)
const parsedBatchCodes = computed(() => {
  const codes = batchCodes.value.match(/\d{6}/g) || []
  return [...new Set(codes)]
})

const showDetailModal = ref(false)
const detailFund = ref<FundInfo | null>(null)

const showSuccess = ref(false)
const successMessage = ref('')
const showError = ref(false)
const errorMessage = ref('')

onMounted(async () => {
  await loadFunds()
})

async function loadFunds() {
  loading.value = true
  try {
    const { data } = await axios.get('/api/admin/fund-info', { params: { keyword: searchKeyword.value, page: page.value, pageSize } })
    fundList.value = data.list || []
    totalCount.value = data.total || 0
    recommendCount.value = data.recommendCount || 0
  } catch (error) {
    showErrorMessage('加载失败')
  } finally {
    loading.value = false
  }
}

function searchLocal() {
  page.value = 1
  loadFunds()
}

function refreshList() {
  searchKeyword.value = ''
  page.value = 1
  loadFunds()
}

async function searchExternal() {
  const keyword = externalKeyword.value.trim()
  if (!keyword || externalSearching.value) return
  externalSearching.value = true
  externalSearched.value = false
  externalResults.value = []
  try {
    const { data } = await axios.get('/api/eastmoney/FundSearch.ashx', { params: { key: keyword, pagesize: 20 } })
    externalResults.value = (data.Datas || []).map((item: any) => ({ code: item.code, name: item.name, ftype: item.type, adding: false }))
    externalSearched.value = true
  } catch (error) {
    showErrorMessage('搜索失败')
  } finally {
    externalSearching.value = false
  }
}

async function addToLocal(fund: ExternalFund) {
  fund.adding = true
  try {
    const { data } = await axios.post('/api/admin/fund-info', { code: fund.code, name: fund.name, ftype: fund.ftype })
    if (data.success) {
      showSuccessMessage('添加成功')
      loadFunds()
    } else {
      showErrorMessage(data.error || '添加失败')
    }
  } catch (error: any) {
    showErrorMessage(error.response?.data?.error || '添加失败')
  } finally {
    fund.adding = false
  }
}

async function batchImport() {
  if (batching.value || parsedBatchCodes.value.length === 0) return
  batching.value = true
  try {
    const { data } = await axios.post('/api/admin/fund-info/batch', { codes: parsedBatchCodes.value })
    showSuccessMessage(`成功导入 ${data.imported || 0} 只基金`)
    showBatchModal.value = false
    batchCodes.value = ''
    loadFunds()
  } catch (error: any) {
    showErrorMessage(error.response?.data?.error || '导入失败')
  } finally {
    batching.value = false
  }
}

  async function syncAllFunds() {
    if (syncing.value) return
    syncing.value = true
    try {
      const { data } = await axios.post('/api/admin/fund-info/sync')
      const msg = data.failed > 0 
        ? `同步完成，更新 ${data.updated} 只，失败 ${data.failed} 只` 
        : `同步完成，更新 ${data.updated} 只基金`
      showSuccessMessage(msg)
      loadFunds()
    } catch (error: any) {
      showErrorMessage(error.response?.data?.error || '同步失败')
    } finally {
      syncing.value = false
    }
  }

async function toggleRecommend(fund: FundInfo) {
  try {
    const newValue = fund.is_recommend ? 0 : 1
    await axios.put(`/api/admin/fund-info/${fund.code}/recommend`, { is_recommend: newValue })
    fund.is_recommend = newValue
    recommendCount.value += newValue ? 1 : -1
    showSuccessMessage(newValue ? '已设为推荐' : '已取消推荐')
  } catch (error: any) {
    showErrorMessage(error.response?.data?.error || '操作失败')
  }
}

function toggleSelect(code: string) {
  if (selectedCodes.value.has(code)) {
    selectedCodes.value.delete(code)
  } else {
    selectedCodes.value.add(code)
  }
}

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedCodes.value.clear()
  } else {
    fundList.value.forEach(f => selectedCodes.value.add(f.code))
  }
}

async function batchSetRecommend(isRecommend: number) {
  if (selectedCodes.value.size === 0) return
  try {
    const codes = Array.from(selectedCodes.value)
    const { data } = await axios.put('/api/admin/fund-info/batch-recommend', { codes, is_recommend: isRecommend })
    showSuccessMessage(`${isRecommend ? '批量推荐' : '取消推荐'}成功 ${data.updated} 只基金`)
    selectedCodes.value.clear()
    loadFunds()
  } catch (error: any) {
    showErrorMessage(error.response?.data?.error || '操作失败')
  }
}

async function syncSingleFund(fund: FundInfo) {
  fund.syncing = true
  try {
    const { data } = await axios.post(`/api/admin/fund-info/${fund.code}/sync`)
    if (data.success) {
      Object.assign(fund, data.fund)
      showSuccessMessage(`${fund.code} 同步成功`)
    } else {
      showErrorMessage(data.error || '同步失败')
    }
  } catch (error: any) {
    showErrorMessage(error.response?.data?.error || '同步失败')
  } finally {
    fund.syncing = false
  }
}

function viewDetail(fund: FundInfo) {
  detailFund.value = fund
  showDetailModal.value = true
}

async function deleteFund(fund: FundInfo) {
  if (!confirm(`确定要删除基金 ${fund.code} ${fund.name} 吗？`)) return
  try {
    await axios.delete(`/api/admin/fund-info/${fund.code}`)
    showSuccessMessage('删除成功')
    loadFunds()
  } catch (error: any) {
    showErrorMessage(error.response?.data?.error || '删除失败')
  }
}

async function batchDelete() {
  if (selectedCodes.value.size === 0) return
  const codes = Array.from(selectedCodes.value)
  if (!confirm(`确定要删除选中的 ${codes.length} 只基金吗？`)) return
  
  try {
    const { data } = await axios.post('/api/admin/fund-info/batch-delete', { codes })
    showSuccessMessage(`成功删除 ${data.deleted} 只基金`)
    selectedCodes.value.clear()
    loadFunds()
  } catch (error: any) {
    showErrorMessage(error.response?.data?.error || '删除失败')
  }
}

function formatTime(timestamp: number) {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString()
}

function showSuccessMessage(msg: string) {
  successMessage.value = msg
  showSuccess.value = true
  setTimeout(() => { showSuccess.value = false }, 3000)
}

function showErrorMessage(msg: string) {
  errorMessage.value = msg
  showError.value = true
  setTimeout(() => { showError.value = false }, 5000)
}
</script>

<style scoped>
.fund-manage-page { padding: 0; }

.page-header { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; }
.page-title { font-size: 18px; font-weight: 600; color: #1e3a5f; margin: 0 0 8px 0; }
.page-desc { font-size: 14px; color: #64748b; margin: 0; }

.tabs { display: flex; align-items: center; margin-bottom: 20px; }
.tabs-left { display: flex; gap: 8px; }
.tab-btn { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; font-size: 14px; font-weight: 500; color: #64748b; cursor: pointer; transition: all 0.2s; }
.tab-btn svg { width: 16px; height: 16px; }
.tab-btn:hover { border-color: #3b82f6; color: #3b82f6; }
.tab-btn.active { border-color: #3b82f6; background: #3b82f6; color: #fff; }

.tab-content { animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.content-body { display: flex; flex-direction: column; gap: 20px; }

.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.section-header h3 { font-size: 16px; font-weight: 600; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 8px; }
.section-header h3::before { content: ''; width: 4px; height: 18px; background: linear-gradient(180deg, #1e3a5f 0%, #3b82f6 100%); border-radius: 2px; }
.header-actions { display: flex; gap: 10px; }
.header-right { display: flex; align-items: center; gap: 12px; }

.add-section, .edit-section, .preview-section { background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
.add-section { padding: 0; background: transparent; border: none; box-shadow: none; }

.add-form { display: flex; gap: 12px; }
.fund-input { flex: 1; padding: 14px 18px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 15px; }
.fund-input:focus { outline: none; border-color: #3b82f6; }

.search-results { margin-top: 16px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
.search-result-item { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid #f1f5f9; }
.search-result-item:last-child { border-bottom: none; }
.search-result-item:hover { background: #f8fafc; }
.fund-info { display: flex; align-items: center; gap: 14px; }
.fund-info .fund-code { font-family: 'SF Mono', Consolas, monospace; font-weight: 600; color: #1e3a5f; font-size: 14px; }
.fund-info .fund-name { color: #334155; font-size: 14px; }
.fund-info .fund-type { font-size: 11px; color: #64748b; background: #f1f5f9; padding: 3px 10px; border-radius: 20px; }
.no-results { margin-top: 16px; text-align: center; padding: 24px; color: #94a3b8; background: #f8fafc; border-radius: 12px; }

.edit-section { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); }
.form-group { margin-bottom: 0; }
.form-group label { display: block; font-size: 14px; font-weight: 600; color: #334155; margin-bottom: 10px; }
.fund-textarea { width: 100%; padding: 16px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 14px; font-family: 'SF Mono', Consolas, monospace; resize: vertical; }
.fund-textarea:focus { outline: none; border-color: #3b82f6; }
.form-hint { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 13px; color: #64748b; padding: 10px 14px; background: rgba(59,130,246,0.05); border-radius: 8px; }

.fund-count { font-size: 13px; font-weight: 600; color: #1e3a5f; background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%); padding: 6px 14px; border-radius: 20px; }
.fund-list { display: flex; flex-wrap: wrap; gap: 10px; }
.fund-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; }
.fund-item:hover { border-color: #cbd5e1; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.fund-index { width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #1e3a5f 0%, #3b82f6 100%); border-radius: 4px; font-size: 10px; font-weight: 600; color: #fff; }
.fund-code { font-size: 13px; font-weight: 600; color: #1e3a5f; font-family: 'SF Mono', Consolas, monospace; }
.fund-name-preview { font-size: 12px; color: #64748b; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.btn-remove { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-radius: 6px; cursor: pointer; color: #94a3b8; }
.btn-remove:hover { background: #fee2e2; color: #ef4444; }
.btn-remove svg { width: 14px; height: 14px; }

.empty-state { text-align: center; padding: 48px 24px; color: #94a3b8; }
.empty-state svg { width: 56px; height: 56px; margin-bottom: 16px; opacity: 0.5; }
.empty-state p { margin: 0; font-size: 14px; }

.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
.search-box { display: flex; gap: 8px; }
.search-input { padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; width: 280px; }
.search-input:focus { outline: none; border-color: #3b82f6; }
.action-buttons { display: flex; gap: 8px; }

.stats-bar { display: flex; gap: 24px; margin-bottom: 16px; padding: 12px 16px; background: #f8fafc; border-radius: 8px; }
.stat-item { display: flex; align-items: center; gap: 8px; }
.stat-label { font-size: 13px; color: #64748b; }
.stat-value { font-size: 16px; font-weight: 600; color: #1e3a5f; }

.batch-actions { display: flex; gap: 8px; margin-bottom: 12px; padding: 10px 16px; background: #e0f2fe; border-radius: 8px; }

.checkbox-cell { width: 40px; text-align: center; }
.checkbox-cell input { width: 16px; height: 16px; cursor: pointer; }

.fund-table-wrapper { background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
.fund-table { width: 100%; border-collapse: collapse; }
.fund-table th, .fund-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #f1f5f9; }
.fund-table th { background: #f8fafc; font-weight: 600; font-size: 13px; color: #475569; }
.fund-table td { font-size: 14px; color: #334155; }
.code-cell { font-family: 'SF Mono', Consolas, monospace; font-weight: 600; color: #1e3a5f; }
.name-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.type-tag { display: inline-block; padding: 2px 8px; background: #e0f2fe; color: #0369a1; border-radius: 4px; font-size: 12px; }
.recommend-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: transparent; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; color: #94a3b8; }
.recommend-btn:hover { border-color: #fbbf24; color: #fbbf24; }
.recommend-btn.active { background: #fef3c7; border-color: #fbbf24; color: #f59e0b; }
.recommend-btn svg { width: 16px; height: 16px; }
.action-cell { display: flex; gap: 8px; align-items: center; justify-content: center; }
.action-divider { color: #cbd5e1; font-size: 12px; }
.action-header { width: 250px; }
.btn-icon { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: transparent; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; color: #3b82f6; transition: all 0.2s; }
.btn-icon.danger { color: #ef4444; }
.btn-icon:hover { background: #dbeafe; color: #3b82f6; border-color: #93c5fd; }
.btn-icon.danger:hover { background: #fee2e2; color: #ef4444; border-color: #fecaca; }
.btn-icon svg { width: 14px; height: 14px; }
.btn-text { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; background: transparent; border: none; border-radius: 4px; cursor: pointer; color: #3b82f6; font-size: 13px; transition: all 0.2s; }
.btn-text:hover { background: #dbeafe; }
.btn-text:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-text svg { width: 14px; height: 14px; }
.loading-cell, .empty-cell { text-align: center !important; padding: 48px !important; color: #94a3b8; }

.pagination { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 20px; }
.btn-page { padding: 8px 16px; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; cursor: pointer; }
.btn-page:hover:not(:disabled) { background: #f8fafc; border-color: #cbd5e1; }
.btn-page:disabled { opacity: 0.5; cursor: not-allowed; }
.page-info { font-size: 14px; color: #64748b; }

.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); border-radius: 20px; width: 90%; max-width: 480px; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1); }
.modal-lg { max-width: 680px; max-height: 120vh; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; background: linear-gradient(135deg, #1e3a5f 0%, #3b82f6 100%); }
.modal-header h3 { font-size: 14px; font-weight: 600; color: #fff; margin: 0; }
.modal-close { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.15); border: none; border-radius: 6px; cursor: pointer; color: #fff; font-size: 16px; transition: all 0.2s; }
.modal-close:hover { background: rgba(255,255,255,0.25); }
.modal-body { padding: 20px; overflow-y: auto; flex: 1; }
.modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 20px; border-top: 1px solid #e2e8f0; background: #f8fafc; }

.search-form { display: flex; gap: 8px; margin-bottom: 16px; }
.search-form .search-input { flex: 1; }
.result-item { display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid #f1f5f9; }
.result-item:last-child { border-bottom: none; }
.result-info { display: flex; align-items: center; gap: 10px; }
.result-code { font-family: 'SF Mono', Consolas, monospace; font-weight: 600; color: #1e3a5f; font-size: 13px; }
.result-name { font-size: 14px; color: #334155; }
.result-type { font-size: 11px; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; }

.batch-textarea { width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: 'SF Mono', Consolas, monospace; resize: vertical; }
.batch-preview { background: #f8fafc; border-radius: 8px; padding: 12px; }
.preview-label { font-size: 13px; color: #64748b; margin-bottom: 8px; display: block; }
.preview-codes { display: flex; flex-wrap: wrap; gap: 6px; }
.code-tag { padding: 4px 8px; background: #e0f2fe; color: #0369a1; border-radius: 4px; font-size: 12px; font-family: 'SF Mono', Consolas, monospace; }
.code-tag.more { background: #fef3c7; color: #92400e; }

.confirm-fund-info { background: #f8fafc; border-radius: 12px; padding: 18px; margin-bottom: 16px; }
.confirm-row { display: flex; margin-bottom: 10px; }
.confirm-row:last-child { margin-bottom: 0; }
.confirm-label { width: 80px; color: #64748b; font-size: 14px; }
.confirm-value { color: #1e293b; font-size: 14px; font-weight: 600; }
.confirm-hint { font-size: 14px; color: #475569; margin: 0; text-align: center; }

.detail-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.detail-item { display: flex; flex-direction: column; gap: 4px; padding: 12px; background: #fff; border-radius: 10px; border: 1px solid #e2e8f0; transition: all 0.2s; }
.detail-item:hover { border-color: #3b82f6; box-shadow: 0 4px 12px rgba(59,130,246,0.1); }
.detail-item:nth-child(odd):last-child { grid-column: span 2; }
.detail-label { font-size: 12px; color: #64748b; font-weight: 500; }
.detail-value { font-size: 14px; color: #1e293b; font-weight: 600; }

.btn { display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 6px 12px; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; }
.btn svg { width: 14px; height: 14px; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.btn-primary { background: linear-gradient(135deg, #1e3a5f 0%, #3b82f6 100%); color: #fff; }
.btn-primary:hover:not(:disabled) { transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-secondary { background: #fff; color: #475569; border: 1px solid #e2e8f0; }
.btn-secondary:hover:not(:disabled) { background: #f8fafc; border-color: #cbd5e1; }
.btn-success { background: linear-gradient(135deg, #10b981 0%, #34d399 100%); color: #fff; }
.btn-danger { background: linear-gradient(135deg, #ef4444 0%, #f87171 100%); color: #fff; }
.btn-danger:hover { transform: translateY(-1px); }
.btn-save-config { background: linear-gradient(135deg, #64748b 0%, #94a3b8 100%); }

.spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
.spinner.large { width: 24px; height: 24px; border-width: 3px; border-top-color: #3b82f6; border-color: #e2e8f0; }
@keyframes spin { to { transform: rotate(360deg); } }

.toast { position: fixed; bottom: 24px; right: 24px; display: flex; align-items: center; gap: 10px; padding: 14px 24px; border-radius: 12px; font-size: 14px; font-weight: 600; z-index: 1001; box-shadow: 0 10px 25px rgba(0,0,0,0.15); }
.toast.success { background: linear-gradient(135deg, #10b981 0%, #34d399 100%); color: #fff; }
.toast.error { background: linear-gradient(135deg, #ef4444 0%, #f87171 100%); color: #fff; }
.toast svg { width: 20px; height: 20px; }
</style>
