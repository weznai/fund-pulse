<template>
  <div class="home">
    <header class="header">
      <div class="header-content">
        <div class="brand">
          <div class="title-wrapper">
            <div class="title-icon-wrapper">
              <svg class="title-icon" viewBox="0 0 24 24" fill="none">
                <path d="M3 17L9 11L13 15L21 7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M17 7H21V11" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h1 class="title">实时基金跟踪</h1>
          </div>
          <div class="last-update" v-if="store.lastUpdateTime">
            最后更新: {{ store.lastUpdateTime }}
          </div>
        </div>
        <div class="actions">
          <div class="view-mode-toggle">
            <button 
              class="view-mode-btn"
              :class="{ active: store.viewMode === 'list' }"
              @click="store.viewMode = 'list'"
              title="列表视图"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
            <button 
              class="view-mode-btn"
              :class="{ active: store.viewMode === 'grid' }"
              @click="store.viewMode = 'grid'"
              title="网格视图"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="7" height="7" stroke="currentColor" stroke-width="2"/>
                <rect x="14" y="3" width="7" height="7" stroke="currentColor" stroke-width="2"/>
                <rect x="3" y="14" width="7" height="7" stroke="currentColor" stroke-width="2"/>
                <rect x="14" y="14" width="7" height="7" stroke="currentColor" stroke-width="2"/>
              </svg>
            </button>
          </div>
          <button
            class="refresh-btn"
            @click="store.fetchFavorites"
            :disabled="store.loading"
            title="手动刷新数据"
          >
            <svg :class="{ spinning: store.loading }" viewBox="0 0 24 24" fill="none">
              <path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button
            class="user-btn"
            :class="{ 'logged-in': authStore.isLoggedIn }"
            @click="handleUserClick"
            :title="authStore.isLoggedIn ? `已登录: ${authStore.username || authStore.email}` : '点击登录'"
          >
            <svg v-if="!authStore.isLoggedIn" class="user-icon-outline" viewBox="0 0 24 24" fill="none">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2"/>
            </svg>
            <svg v-else class="user-icon-filled" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </button>
        </div>
      </div>
    </header>

    <div class="container">
      <div v-if="store.error" class="error-message">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span>{{ store.error }}</span>
      </div>

      <div v-if="store.loading && store.favorites.length === 0" class="loading-state">
        <div class="spinner"></div>
        <p>加载中...</p>
      </div>

      <div v-else-if="store.favorites.length === 0" class="empty-state">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <p>暂无自选基金</p>
      </div>

      <template v-else>
        <div class="search-section">
          <FundSearch @select="handleSearchSelect" />
        </div>
        
        <div class="fund-header">
          <div class="toolbar-stats">
            <div class="stat-card-group">
              <div class="stat-card">
                <span class="stat-label">持仓总额</span>
                <span class="stat-value">{{ store.hideAmount ? '********' : `¥${totalHoldingAmount.toFixed(2)}` }}</span>
              </div>
              <button 
                class="hide-amount-btn"
                @click="toggleHideAmount"
                :title="store.hideAmount ? '显示金额' : '隐藏金额'"
              >
                <svg v-if="store.hideAmount" viewBox="0 0 24 24" fill="none">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/>
                  <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
                </svg>
              </button>
            </div>
            <div class="stat-card">
              <span class="stat-label">当日总收益</span>
              <span class="stat-value" :class="{ 'stat-up': totalTodayProfit > 0, 'stat-down': totalTodayProfit < 0 }">
                {{ `${totalTodayProfit >= 0 ? '+' : ''}¥${totalTodayProfit.toFixed(2)}` }}
              </span>
            </div>
          </div>
        </div>
        <div class="fund-toolbar">
          <div class="toolbar-left">
            <h2 class="toolbar-title">
              基金列表
              <span class="count-badge" @dblclick="handleClearCache" title="双击清除缓存并恢复默认数据">
                {{ filteredFavorites.length }}只
              </span>
            </h2>
          </div>
          <button
            class="filter-btn"
            :class="{ active: store.filterMode === 'held' }"
            @click="toggleFilterMode"
            :title="store.filterMode === 'held' ? '显示全部' : '仅显示持有'"
          >
            持
          </button>
          <div class="toolbar-right">
            <button 
              v-if="store.viewMode !== 'list'"
              class="toolbar-btn"
              @click="store.toggleSortDirection"
              :title="store.sortDirection === 'desc' ? '当前：降序（点击切换升序）' : '当前：升序（点击切换降序）'"
            >
              <svg v-if="store.sortDirection === 'desc'" viewBox="0 0 24 24" fill="none">
                <path d="M3 4h13M3 8h9M3 12h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M17 8l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none">
                <path d="M3 4h13M3 8h9M3 12h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M17 16l4-4-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>排序</span>
            </button>
            <button 
              class="toolbar-btn"
              @click="showImportDialog = true"
              title="导入基金"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="7 10 12 15 17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <span>导入</span>
            </button>
            <button 
              class="toolbar-btn"
              @click="showExportDialog = true"
              title="导出基金"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="17 8 12 3 7 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <span>导出</span>
            </button>
          </div>
        </div>

        <div v-if="store.viewMode === 'list'" class="fund-list">
          <FundTablePC
            :funds="filteredTableRows"
            :sort-field="store.sortField"
            :sort-direction="store.sortDirection"
            :hide-amount="store.hideAmount"
            @row-click="handleRowClick"
            @delete="handleDeleteFromTable"
            @holding-click="handleHoldingClick"
            @sort="handleSort"
            @detail-click="handleDetailClick"
          />
        </div>

        <div v-else class="fund-grid">
          <FundCard
            v-for="fund in filteredFavorites"
            :key="fund.code"
            :fund="fund"
            mode="grid"
            @delete="handleDelete"
            @detail="handleGridDetail"
            @holding="handleGridHolding"
          />
        </div>
      </template>
    </div>

    <footer class="footer">
      <div class="footer-content">
        <!-- <div class="footer-stats">
          <span class="stats-label">访问统计</span>
          <span class="stats-divider">|</span>
          <span class="stats-item">PV <strong>{{ stats.totalPv }}</strong></span>
          <span class="stats-item">UV <strong>{{ stats.totalUv }}</strong></span>
        </div> -->
        <div class="footer-links">
          <router-link to="/suggestions" class="footer-link">建议与问题</router-link>
        </div>
        <div class="footer-copyright">© 2026  Powered by wezin</div>
      </div>
    </footer>

    <!-- 导入对话框 -->
    <div v-if="showImportDialog" class="modal-overlay">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>导入基金</h3>
          <button class="modal-close" @click="showImportDialog = false">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="import-mode-tabs">
            <button
              :class="['mode-tab', { active: importMode === 'withAmount' }]"
              @click="importMode = 'withAmount'"
            >有持仓金额</button>
            <button
              :class="['mode-tab', { active: importMode === 'codeOnly' }]"
              @click="importMode = 'codeOnly'"
            >仅基金代码</button>
          </div>

          <template v-if="importMode === 'withAmount'">
            <div class="import-examples">
              <div class="import-examples-left">
                <p><strong>格式：</strong></p>
                <p>• 基金代码,持有金额</p>
                <p>• 仅基金代码（每行一个）</p>
              </div>
              <div class="import-examples-right">
                <p><strong>示例：</strong></p>
                <div class="import-code-example">
                  000001,10000<br/>
                  000002,20000<br/>
                  000003
                </div>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="import-examples">
              <div class="import-examples-left">
                <p><strong>格式：</strong></p>
                <p>• 支持逗号、竖线、空格、换行等分隔</p>
              </div>
              <div class="import-examples-right">
                <p><strong>示例：</strong></p>
                <div class="import-code-example">
                  000001,000002,000003<br/>
                  或 000001|000002|000003
                </div>
              </div>
            </div>
          </template>

          <div class="import-file-section">
            <label class="import-file-label">
              <input type="file" @change="handleFileImport" accept=".txt,.csv" class="import-file-input" />
              <span class="import-file-btn">📁 选择文件</span>
            </label>
            <span class="import-file-hint">支持 .txt .csv 文件</span>
          </div>

          <textarea
            v-model="importText"
            class="import-textarea"
            :placeholder="importPlaceholder"
          ></textarea>
        </div>
        <div class="modal-footer">
          <button class="modal-btn cancel" @click="showImportDialog = false">取消</button>
          <button class="modal-btn confirm" @click="handleImport">导入</button>
        </div>
      </div>
    </div>

    <!-- 导出对话框 -->
    <div v-if="showExportDialog" class="modal-overlay">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>导出基金</h3>
          <button class="modal-close" @click="showExportDialog = false">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="import-mode-tabs">
            <button
              :class="['mode-tab', { active: exportMode === 'withAmount' }]"
              @click="exportMode = 'withAmount'"
            >有持仓金额</button>
            <button
              :class="['mode-tab', { active: exportMode === 'codeOnly' }]"
              @click="exportMode = 'codeOnly'"
            >仅基金代码</button>
          </div>

          <textarea
            class="import-textarea"
            :value="exportText"
            readonly
          ></textarea>
        </div>
        <div class="modal-footer">
          <button class="modal-btn cancel" @click="showExportDialog = false">关闭</button>
          <div class="modal-btn-group">
            <button class="modal-btn copy-btn" @click="handleCopyExport">
              <svg v-if="!exportCopied" viewBox="0 0 24 24" fill="none" width="16" height="16">
                <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" width="16" height="16">
                <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              {{ exportCopied ? '已复制' : '复制' }}
            </button>
            <button class="modal-btn confirm" @click="handleDownloadExport">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="7 10 12 15 17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              导出文件
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 持仓编辑对话框 -->
    <div v-if="showHoldingDialog" class="modal-overlay holding-overlay">
      <div class="modal holding-modal" @click.stop>
        <div class="modal-header">
          <h3>设置持仓 - {{ selectedFundName }}</h3>
          <button class="modal-close" @click="showHoldingDialog = false">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="holding-form">
            <div class="form-group">
              <label>持仓金额（元）</label>
              <input
                v-model.number="holdingForm.amount"
                type="number"
                step="0.01"
                placeholder="请输入持仓金额"
              />
              <span v-if="holdingDiff !== null" class="holding-diff" :class="{ 'increase': holdingDiff > 0, 'decrease': holdingDiff < 0 }">
                {{ holdingDiff > 0 ? '加仓' : '减仓' }} {{ Math.abs(holdingDiff).toFixed(2) }} 元
              </span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-btn danger" @click="handleClearHolding">清除</button>
          <div class="modal-btn-group">
            <button class="modal-btn cancel" @click="showHoldingDialog = false">取消</button>
            <button class="modal-btn confirm" @click="handleSaveHolding">保存</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 基金详情弹框 -->
    <FundDetailDialog
      :visible="showDetailDialog"
      :fund="detailFund"
      :hide-amount="store.hideAmount"
      @close="showDetailDialog = false"
      @edit-holding="handleEditHolding"
      @delete="handleDeleteFromDetail"
    />

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="modal confirm-modal" @click.stop>
        <div class="confirm-icon">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#EF4444" stroke-width="2"/>
            <path d="M12 8v4m0 4h.01" stroke="#EF4444" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="confirm-content">
          <h3 class="confirm-title">确认删除</h3>
          <p class="confirm-message">{{ deleteConfirmMessage }}</p>
        </div>
        <div class="confirm-actions">
          <button class="modal-btn cancel" @click="showDeleteConfirm = false">取消</button>
          <button class="modal-btn danger-solid" @click="confirmDelete">确认删除</button>
        </div>
      </div>
    </div>

    <!-- 登录弹窗 -->
    <LoginModal
      :visible="showLoginModal"
      @close="showLoginModal = false"
    />

    <!-- 用户菜单 -->
    <UserMenu
      v-if="showUserMenu"
      :visible="showUserMenu"
      :email="authStore.email || ''"
      @close="closeUserMenu"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import FundCard from '@/components/FundCard.vue'
import FundTablePC from '@/components/FundTablePC.vue'
import FundDetailDialog from '@/components/FundDetailDialog.vue'
import FundSearch from '@/components/FundSearch.vue'
import LoginModal from '@/components/LoginModal.vue'
import UserMenu from '@/components/UserMenu.vue'
import { useFundStore } from '@/stores/fund'
import { useAuthStore } from '@/stores/auth'
import type { FundTableRow, Fund } from '@/types'

interface DayStats {
  date: string
  pv: number
  uv: number
}

interface StatsData {
  totalPv: number
  totalUv: number
  todayPv: number
  todayUv: number
  last7Days: DayStats[]
}

const store = useFundStore()
const authStore = useAuthStore()
const showImportDialog = ref(false)
const showLoginModal = ref(false)
const showUserMenu = ref(false)
const importText = ref('')
const importMode = ref<'withAmount' | 'codeOnly'>('withAmount')

const importPlaceholder = computed(() => {
  return importMode.value === 'withAmount'
    ? '粘贴基金数据，或从文件导入\n\n示例：\n000001,10000\n000002,20000\n000003'
    : '粘贴基金代码，支持任意分隔符\n\n示例：\n000001,000002,000003\n或 000001|000002|000003'
})

const showHoldingDialog = ref(false)
const showExportDialog = ref(false)
const exportMode = ref<'withAmount' | 'codeOnly'>('withAmount')
const exportCopied = ref(false)

const exportText = computed(() => {
  if (exportMode.value === 'codeOnly') {
    return store.favoriteCodes.join(',')
  }
  const lines: string[] = []
  for (const code of store.favoriteCodes) {
    const holding = store.holdings.getHolding(code)
    const amount = holding?.amount || 0
    if (amount > 0) {
      lines.push(`${code},${amount}`)
    } else {
      lines.push(code)
    }
  }
  return lines.join('\n')
})
const showDetailDialog = ref(false)
const showDeleteConfirm = ref(false)
const deleteConfirmMessage = ref('')
const deleteCallback = ref<(() => void) | null>(null)
const detailFund = ref<FundTableRow | null>(null)
const selectedFundCode = ref('')
const selectedFundName = ref('')
const holdingForm = ref({ amount: 0 })
const originalAmount = ref(0)
const stats = ref<StatsData>({
  totalPv: 0,
  totalUv: 0,
  todayPv: 0,
  todayUv: 0,
  last7Days: []
})

const holdingDiff = computed(() => {
  const diff = holdingForm.value.amount - originalAmount.value
  if (diff === 0 || isNaN(diff)) return null
  return diff
})

const filteredFavorites = computed(() => {
  if (store.filterMode === 'held') {
    return store.sortedFavorites.filter(fund => store.isHeld(fund.code))
  }
  return store.sortedFavorites
})

const filteredTableRows = computed(() => {
  return filteredFavorites.value.map(fund => store.convertToTableRow(fund))
})

const totalHoldingAmount = computed(() => {
  return filteredFavorites.value.reduce((total, fund) => {
    const holding = store.holdings.getHolding(fund.code)
    return total + (holding ? holding.amount : 0)
  }, 0)
})

const totalTodayProfit = computed(() => {
  const today = new Date().toLocaleDateString('sv-SE')
  return filteredFavorites.value.reduce((total, fund) => {
    const holding = store.holdings.getHolding(fund.code)
    if (!holding || holding.amount <= 0) return total
    
    const jzrq = fund.jzrq || ''
    const gztime = fund.gztime ? fund.gztime.slice(0, 10) : ''
    
    let growth: number | null = null
    
    // 优先用当天的数据
    if (jzrq === today && fund.dayGrowth != null) {
      growth = fund.dayGrowth
    } else if (gztime === today && fund.gszzl != null) {
      growth = fund.gszzl
    }

    // 如果今天没有数据,用最近的数据(不严格检查日期)
    if (growth === null) {
      if (fund.gszzl != null) {
        growth = fund.gszzl
      } else if (fund.dayGrowth != null) {
        growth = fund.dayGrowth
      }
    }

    if (growth !== null) {
      return total + (holding.amount * growth / 100)
    }

    // 兜底：用结算收益
    if (holding.lastSettledDate && holding.currentDayProfit != null && holding.lastSettledDate === today) {
      return total + holding.currentDayProfit
    }

    return total
  }, 0)
})

onMounted(async () => {
  console.log('🚀 HomeView mounted, initializing store...')
  store.init()
  
  try {
    const { data } = await axios.get<StatsData>('/api/stats')
    stats.value = data
  } catch (e) {
    console.error('Failed to fetch stats:', e)
  }
})

onUnmounted(() => {
  store.stopPolling()
})

function toggleHideAmount() {
  store.toggleHideAmount()
}

function toggleFilterMode() {
  const newMode = store.filterMode === 'held' ? 'all' : 'held'
  store.setFilterMode(newMode)
}

const handleUserClick = () => {
  if (authStore.isLoggedIn) {
    // 已登录，显示用户菜单
    showUserMenu.value = !showUserMenu.value
  } else {
    // 未登录，显示登录弹窗
    showLoginModal.value = true
  }
}

const closeUserMenu = () => {
  showUserMenu.value = false
}

function handleDelete(code: string) {
  const isHeldFund = store.isHeld(code)
  deleteConfirmMessage.value = isHeldFund 
    ? '该基金当前为持仓状态，删除后将同时清除持仓信息！'
    : '确定要从自选中移除这只基金吗？'
  deleteCallback.value = () => {
    store.removeFavorite(code)
  }
  showDeleteConfirm.value = true
}

function handleDeleteFromTable(row: FundTableRow) {
  const isHeldFund = store.isHeld(row.code)
  deleteConfirmMessage.value = isHeldFund 
    ? '该基金当前为持仓状态，删除后将同时清除持仓信息！'
    : '确定要从自选中移除这只基金吗？'
  deleteCallback.value = () => {
    store.removeFavorite(row.code)
  }
  showDeleteConfirm.value = true
}

function handleRowClick(row: FundTableRow) {
  detailFund.value = row
  showDetailDialog.value = true
}

function handleHoldingClick(row: FundTableRow) {
  showHoldingDialog.value = true
  selectedFundCode.value = row.code
  selectedFundName.value = row.fundName
  
  const holding = store.holdings.getHolding(row.code)
  if (holding) {
    holdingForm.value.amount = holding.amount
    originalAmount.value = holding.amount
  } else {
    holdingForm.value.amount = 0
    originalAmount.value = 0
  }
}

function handleDetailClick(row: FundTableRow) {
  detailFund.value = row
  showDetailDialog.value = true
}

function handleGridDetail(fund: Fund) {
  const row = store.convertToTableRow(fund)
  detailFund.value = row
  showDetailDialog.value = true
}

function handleGridHolding(fund: Fund) {
  showHoldingDialog.value = true
  selectedFundCode.value = fund.code
  selectedFundName.value = fund.name
  
  const holding = store.holdings.getHolding(fund.code)
  if (holding) {
    holdingForm.value.amount = holding.amount
    originalAmount.value = holding.amount
  } else {
    holdingForm.value.amount = 0
    originalAmount.value = 0
  }
}

function handleEditHolding(row: FundTableRow) {
  handleHoldingClick(row)
}

function handleDeleteFromDetail(row: FundTableRow) {
  const isHeldFund = store.isHeld(row.code)
  deleteConfirmMessage.value = isHeldFund 
    ? '该基金当前为持仓状态，删除后将同时清除持仓信息！'
    : '确定要从自选中移除这只基金吗？'
  deleteCallback.value = () => {
    store.removeFavorite(row.code)
    showDetailDialog.value = false
  }
  showDeleteConfirm.value = true
}

function confirmDelete() {
  if (deleteCallback.value) {
    deleteCallback.value()
    deleteCallback.value = null
  }
  showDeleteConfirm.value = false
}

  async function handleSaveHolding() {
    try {
      if (holdingForm.value.amount > 0) {
        const fund = store.favoriteFunds.find(f => f.code === selectedFundCode.value)
        const currentNav = fund?.nav || 1
        
        await store.holdings.setHoldingByAmount(
          selectedFundCode.value,
          selectedFundName.value,
          holdingForm.value.amount,
          currentNav
        )
        
        if (store.useDatabase) {
          await store.holdings.loadFromDatabase()
        }
      } else {
        await store.holdings.removeHolding(selectedFundCode.value)
      }
      showHoldingDialog.value = false
      
      if (detailFund.value && detailFund.value.code === selectedFundCode.value) {
        const fund = store.favoriteFunds.find(f => f.code === selectedFundCode.value)
        if (fund) {
          detailFund.value = store.convertToTableRow(fund)
        }
      }
    } catch (error: any) {
      console.error('保存持仓失败:', error)
      alert('保存失败: ' + (error?.response?.data?.error || error?.message || '未知错误'))
    }
  }

  async function handleClearHolding() {
    try {
      await store.holdings.removeHolding(selectedFundCode.value)
      showHoldingDialog.value = false
    } catch (error: any) {
      console.error('清除持仓失败:', error)
      alert('清除失败: ' + (error?.response?.data?.error || error?.message || '未知错误'))
    }
  }

function handleSearchSelect(_code: string) {
  store.fetchFavorites()
}

function handleCopyExport() {
  navigator.clipboard.writeText(exportText.value).then(() => {
    exportCopied.value = true
    setTimeout(() => { exportCopied.value = false }, 2000)
  })
}

function handleDownloadExport() {
  const ext = exportMode.value === 'codeOnly' ? 'txt' : 'csv'
  const blob = new Blob([exportText.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `基金列表_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}

async function handleImport() {
  const importedFunds: Array<{ code: string; amount: number }> = []

  if (importMode.value === 'codeOnly') {
    const codes = importText.value.match(/\d{6}/g) || []
    const uniqueCodes = [...new Set(codes)]
    for (const code of uniqueCodes) {
      importedFunds.push({ code, amount: 0 })
    }
  } else {
    const lines = importText.value.split('\n')

    for (let line of lines) {
      line = line.trim()
      if (!line || line.startsWith('#')) continue

      let parts: string[] = []
      if (line.includes('|')) {
        parts = line.split('|').map(p => p.trim())
      } else if (line.includes('\t')) {
        parts = line.split('\t').map(p => p.trim())
      } else if (line.includes(',')) {
        parts = line.split(',').map(p => p.trim())
      } else if (line.includes(' ')) {
        parts = line.split(/\s+/).map(p => p.trim())
      } else {
        parts = [line]
      }

      if (parts.length === 0) continue

      const code = parts[0]
      if (!/^\d{6}$/.test(code)) continue

      const amount = parseFloat(parts[1]) || 0

      importedFunds.push({ code, amount })
    }
  }
  
  console.log('📥 导入解析结果:', importedFunds.length, '只基金')
  console.log('📥 当前 favoriteCodes:', store.favoriteCodes.length, '只:', store.favoriteCodes.slice(0, 5).join(','), '...')
  console.log('📥 useDatabase:', store.useDatabase)
  console.log('📥 页面显示基金数:', store.favoriteFunds.length, '只')
  
  if (importedFunds.length === 0) {
    alert(importMode.value === 'withAmount'
      ? '未找到有效的基金数据\n\n格式：基金代码,持有金额\n或仅基金代码（每行一个）'
      : '未找到有效的基金代码\n\n请输入6位基金代码，支持任意分隔符')
    return
  }
  
  const newFunds = importedFunds.filter(f => !store.favoriteCodes.includes(f.code))
  const fundsWithAmount = importedFunds.filter(f => f.amount > 0)
  
  console.log('📥 newFunds:', newFunds.length, '只')
  console.log('📥 fundsWithAmount:', fundsWithAmount.length, '只')
  
  if (store.useDatabase) {
    if (newFunds.length > 0) {
      const fundsToAdd = newFunds.map(f => ({ code: f.code }))
      await store.addFavoritesBatch(fundsToAdd)
    }
    
    for (const { code, amount } of fundsWithAmount) {
      const fund = store.favoriteFunds.find(f => f.code === code)
      const currentNav = fund?.nav || fund?.gsz || 1
      const fundName = fund?.name || code
      await store.holdings.setHoldingByAmount(code, fundName, amount, currentNav)
    }
    
    store.fetchFavorites()
  } else {
    for (const { code, amount } of importedFunds) {
      const exists = store.favoriteCodes.includes(code)
      
      if (!exists) {
        store.addFavorite(code)
      }
      
      if (amount > 0) {
        const fund = store.favoriteFunds.find(f => f.code === code)
        const currentNav = fund?.nav || fund?.gsz || 1
        const fundName = fund?.name || code
        store.holdings.setHoldingByAmount(code, fundName, amount, currentNav)
      }
    }
    
    store.fetchFavorites()
  }
  
  showImportDialog.value = false
  importText.value = ''
  
  const addedCount = newFunds.length
  const updatedCount = fundsWithAmount.length
  alert(`导入成功！\n\n新增基金：${addedCount} 只\n更新持仓：${updatedCount} 只`)
}

function handleFileImport(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target?.result as string
    importText.value = content
  }
  
  if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
    reader.readAsText(file, 'UTF-8')
  } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
    alert('暂不支持Excel文件，请将Excel另存为CSV或TXT格式后再导入')
    target.value = ''
  } else {
    reader.readAsText(file, 'UTF-8')
  }
  
  target.value = ''
}

function handleSort(field: string) {
  store.setSortField(field)
}

// 双击"基金只数"清除缓存并恢复默认数据
function handleClearCache() {
  const message = '是否需要清理浏览器缓存数据？\n\n此操作将：\n• 清除所有本地存储的基金列表\n• 清除持仓数据\n• 清除估值缓存\n\n确定要继续吗？'

  if (confirm(message)) {
    try {
      // 清除所有相关的localStorage数据
      const keysToRemove = [
        'favoriteFunds',
        'favoriteFundsVersion',
        'heldFunds',
        'fund_holdings',
        'fund_estimate_cache'
      ]

      keysToRemove.forEach(key => {
        localStorage.removeItem(key)
      })

      // 重新初始化store（这会恢复默认基金列表）
      store.init()

      console.log('✅ 已清除缓存并恢复默认数据')
      alert('缓存已清除，将从服务器重新加载数据！')

      // 重新获取数据
      store.fetchFavorites()
    } catch (error) {
      console.error('清除缓存失败:', error)
      alert('清除缓存失败，请重试')
    }
  }
}
</script>

<style scoped>
.home {
  min-height: 100vh;
  background: #F9FAFB;
  overflow-x: hidden;
}

.header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-bottom: 1px solid #E5E7EB;
  padding: 16px 0;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.brand {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.title-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-icon-wrapper {
  width: 32px;
  height: 32px;
  background: #EF4444;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
}

.title-icon {
  width: 18px;
  height: 18px;
}

.title {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.last-update {
  font-size: 12px;
  color: #9CA3AF;
}

.actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.view-mode-toggle {
  display: flex;
  gap: 4px;
  background: #F3F4F6;
  padding: 4px;
  border-radius: 8px;
}

.view-mode-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: #6B7280;
  transition: all 0.2s;
}

.view-mode-btn svg {
  width: 16px;
  height: 16px;
}

.view-mode-btn:hover {
  background: white;
  color: #374151;
}

.view-mode-btn.active {
  background: white;
  color: #EF4444;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.refresh-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  color: #374151;
  transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: #F3F4F6;
  color: #111827;
}

.refresh-btn svg {
  width: 14px;
  height: 14px;
}

.refresh-btn svg.spinning {
  animation: spin 1s linear infinite;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.user-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: #9CA3AF;
  transition: all 0.2s;
}

.user-btn:not(.logged-in) {
  border: 1px solid #D1D5DB;
  background: #F3F4F6;
}

.user-btn.logged-in {
  border: none;
  background: transparent;
}

.user-btn:hover {
  background: #F3F4F6;
  color: #374151;
}

.user-btn svg {
  width: 16px;
  height: 16px;
}

.user-icon-outline {
  color: #9CA3AF;
}

.user-icon-filled {
  color: #4F46E5;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 20px;
}

.search-section {
  margin-bottom: 20px;
}

.filter-btn {
  width: 22px;
  height: 22px;
  border: 1.5px solid #D1D5DB;
  border-radius: 50%;
  background: white;
  color: #6B7280;
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.filter-btn:hover {
  background: #F9FAFB;
  border-color: #D1D5DB;
  color: #374151;
}

.filter-btn.active {
  background: #3B82F6;
  border-color: #3B82F6;
  color: white;
}

.fund-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 6px 0;
  gap: 16px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.fund-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.search-section {
  margin-bottom: 16px;
  display: flex;
  justify-content: center;
}

.toolbar-stats {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  justify-content: space-between;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%);
  border: 1px solid #E2E8F0;
  border-radius: 8px;
}

.stat-card-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-label {
  font-size: 12px;
  color: #64748B;
  font-weight: 500;
  white-space: nowrap;
}

.stat-value {
  font-size: 14px;
  font-weight: 700;
  color: #0F172A;
  font-family: 'SF Mono', Consolas, monospace;
  white-space: nowrap;
}

.stat-value.stat-up {
  color: #EF4444;
}

.stat-value.stat-down {
  color: #10B981;
}

.hide-amount-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%);
  color: #64748B;
  cursor: pointer;
  border-radius: 8px;
  border: 1px solid #E2E8F0;
  transition: all 0.2s;
}

.hide-amount-btn:hover {
  background: #E2E8F0;
  color: #475569;
}

.hide-amount-btn svg {
  width: 16px;
  height: 16px;
}

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  background: #EFF6FF;
  color: #3B82F6;
  font-size: 12px;
  font-weight: 600;
  border-radius: 12px;
  margin-left: 8px;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s;
}

.count-badge:hover {
  background: #DBEAFE;
  transform: scale(1.05);
}

.count-badge:active {
  transform: scale(0.98);
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 4px 8px;
  background: white;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  cursor: pointer;
  color: #6B7280;
  font-size: 11px;
  font-weight: 500;
  transition: all 0.2s;
}

.toolbar-btn svg {
  width: 12px;
  height: 12px;
}

.toolbar-btn:hover {
  background: #F9FAFB;
  border-color: #D1D5DB;
  color: #374151;
}

.toolbar-btn:active {
  transform: translateY(0.5px);
}

.error-message {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #FEF2F2;
  border: 1px solid #FEE2E2;
  border-radius: 8px;
  color: #DC2626;
  margin-bottom: 24px;
}

.error-message svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.loading-state {
  text-align: center;
  padding: 80px 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #E5E7EB;
  border-top-color: #3B82F6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

.loading-state p {
  font-size: 13px;
  color: #6B7280;
  margin: 0;
}

.empty-state {
  text-align: center;
  padding: 80px 20px;
}

.empty-state svg {
  width: 64px;
  height: 64px;
  color: #D1D5DB;
  margin-bottom: 16px;
}

.empty-state p {
  color: #6B7280;
  margin: 0;
}

.fund-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fund-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

@media (max-width: 768px) {
  .header-content {
    flex-wrap: nowrap;
  }
  
  .brand {
    flex: 1;
  }
  
  .actions {
    display: flex;
    flex-wrap: nowrap;
    gap: 8px;
  }
  
  .container {
    padding: 16px 12px;
  }
  
  .fund-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  
  .toolbar-title {
    font-size: 14px;
  }
  
  .toolbar-btn {
    padding: 4px 8px;
    font-size: 11px;
    gap: 3px;
  }
  
  .toolbar-btn svg {
    width: 12px;
    height: 12px;
  }
  
  .toolbar-btn span {
    font-size: 10px;
  }
  
  .fund-toolbar {
    gap: 8px;
  }
  
  .fund-header {
    margin-bottom: 6px;
  }
  
  .toolbar-stats {
    gap: 8px;
  }
  
  .stat-card {
    padding: 6px 10px;
    gap: 6px;
  }
  
  .stat-label {
    font-size: 10px;
  }
  
  .stat-value {
    font-size: 12px;
  }
  
  .filter-btn {
    width: 24px;
    height: 24px;
    border: 1px solid #D1D5DB;
    border-radius: 50%;
    background: white;
    color: #374151;
    cursor: pointer;
    font-size: 11px;
    transition: all 0.2s;
  }

  .filter-btn:hover {
    background: #F9FAFB;
    border-color: #9CA3AF;
  }

  .filter-btn.active {
    background: #3B82F6;
    border-color: #3B82F6;
    color: white;
  }
}

/* Modal Styles */
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
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #E5E7EB;
}

.modal-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: #6B7280;
  transition: all 0.2s;
}

.modal-close:hover {
  background: #F3F4F6;
  color: #111827;
}

.modal-close svg {
  width: 20px;
  height: 20px;
}

.modal-body {
  padding: 24px;
  flex: 1;
  overflow-y: auto;
}

.modal-tip {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #6B7280;
}

.import-mode-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 16px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #D1D5DB;
}

.mode-tab {
  flex: 1;
  padding: 8px 16px;
  border: none;
  background: #F9FAFB;
  font-size: 13px;
  font-weight: 500;
  color: #6B7280;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-tab:first-child {
  border-right: 1px solid #D1D5DB;
}

.mode-tab.active {
  background: #4F46E5;
  color: #fff;
}

.mode-tab:hover:not(.active) {
  background: #E5E7EB;
}

.import-examples {
  display: flex;
  gap: 20px;
  margin: 0 0 16px 0;
  padding: 12px;
  background: #F9FAFB;
  border-radius: 6px;
  font-size: 12px;
  color: #6B7280;
  line-height: 1.8;
}

.import-examples-left {
  flex: 1;
}

.import-examples-right {
  flex: 1;
}

.import-section-title {
  font-weight: 600;
  color: #374151;
  margin-bottom: 4px;
}

.import-code-example {
  font-family: 'Courier New', monospace;
  background: white;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #E5E7EB;
  line-height: 1.6;
}

.import-examples p {
  margin: 2px 0;
}

.import-file-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.import-file-label {
  position: relative;
  cursor: pointer;
}

.import-file-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.import-file-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: white;
  border: 1px solid #D1D5DB;
  border-radius: 6px;
  font-size: 13px;
  color: #374151;
  transition: all 0.2s;
}

.import-file-btn:hover {
  background: #F9FAFB;
  border-color: #9CA3AF;
}

.import-file-hint {
  font-size: 12px;
  color: #9CA3AF;
}

.import-textarea {
  width: 100%;
  min-height: 200px;
  padding: 12px;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  font-size: 13px;
  font-family: 'Courier New', monospace;
  resize: vertical;
  outline: none;
  transition: all 0.2s;
}

.import-textarea:focus {
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid #E5E7EB;
  justify-content: space-between;
}

.modal-btn-group {
  display: flex;
  gap: 12px;
}

.modal-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-btn.cancel {
  background: #F3F4F6;
  color: #6B7280;
}

.modal-btn.cancel:hover {
  background: #E5E7EB;
}

.modal-btn.confirm {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #3B82F6;
  color: white;
}

.modal-btn.confirm:hover {
  background: #2563EB;
}

.modal-btn.copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #F3F4F6;
  color: #6B7280;
}

.modal-btn.copy-btn:hover {
  background: #E5E7EB;
}

.modal-btn.danger {
  background: #FEE2E2;
  color: #DC2626;
}

.modal-btn.danger:hover {
  background: #FECACA;
}

.modal-btn.danger-solid {
  background: #EF4444;
  color: white;
}

.modal-btn.danger-solid:hover {
  background: #DC2626;
}

.confirm-modal {
  max-width: 400px;
  padding: 0;
  text-align: center;
}

.confirm-icon {
  padding: 24px 24px 16px;
}

.confirm-icon svg {
  width: 56px;
  height: 56px;
}

.confirm-content {
  padding: 0 24px 8px;
}

.confirm-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.confirm-message {
  margin: 0;
  font-size: 14px;
  color: #6B7280;
  line-height: 1.6;
}

.confirm-actions {
  display: flex;
  gap: 12px;
  padding: 20px 24px 24px;
  justify-content: center;
}

.footer {
  border-top: 1px solid #E5E7EB;
  padding: 20px 0;
  margin-top: 40px;
  background: white;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  text-align: center;
}

.footer-links {
  margin-bottom: 6px;
}

.footer-link {
  font-size: 11px;
  color: #1D4ED8;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
}

.footer-link:hover {
  color: #1E40AF;
  text-decoration: underline;
}

.footer-stats {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  font-size: 12px;
  color: #6B7280;
}

.stats-label {
  font-weight: 500;
}

.stats-divider {
  color: #D1D5DB;
}

.stats-item {
  padding: 3px 8px;
  border: 1px solid #E5E7EB;
  border-radius: 4px;
  background: #FAFAFA;
  font-size: 12px;
}

.stats-item strong {
  color: #111827;
  margin-left: 3px;
}

.footer-copyright {
  font-size: 13px;
  color: #9CA3AF;
}

.holding-modal {
  max-width: 400px;
}

.holding-overlay {
  z-index: 1100;
}

.holding-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.form-group input {
  padding: 10px 12px;
  border: 1px solid #D1D5DB;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.holding-diff {
  font-size: 12px;
  font-weight: 400;
}

.holding-diff.increase {
  color: #EF4444;
}

.holding-diff.decrease {
  color: #22C55E;
}

.detail-modal {
  max-width: 500px;
}

.detail-fund-code {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #E5E7EB;
}

.code-label {
  font-size: 13px;
  color: #6B7280;
}

.code-value {
  font-size: 14px;
  font-weight: 600;
  color: #3B82F6;
  font-family: 'SF Mono', Consolas, monospace;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: #F9FAFB;
  border-radius: 8px;
}

.detail-label {
  font-size: 12px;
  color: #6B7280;
}

.detail-value {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
  font-family: 'SF Mono', Consolas, monospace;
}

.detail-value.up {
  color: #EF4444;
}

.detail-value.down {
  color: #10B981;
}

.detail-date {
  font-size: 11px;
  color: #9CA3AF;
}

.detail-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #E5E7EB;
}

.detail-action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  background: white;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  transition: all 0.2s;
}

.detail-action-btn svg {
  width: 16px;
  height: 16px;
}

.detail-action-btn:hover {
  background: #F9FAFB;
  border-color: #D1D5DB;
}

.detail-action-btn.danger {
  color: #EF4444;
}

.detail-action-btn.danger:hover {
  background: #FEF2F2;
  border-color: #FEE2E2;
}

.detail-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #E5E7EB;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-header h4 {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.section-tip {
  font-size: 11px;
  color: #9CA3AF;
}

.period-tabs {
  display: flex;
  gap: 4px;
}

.period-tab {
  padding: 4px 10px;
  background: #F3F4F6;
  border: 1px solid #E5E7EB;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  color: #6B7280;
  transition: all 0.2s;
}

.period-tab:hover {
  background: #E5E7EB;
}

.period-tab.active {
  background: #3B82F6;
  border-color: #3B82F6;
  color: white;
}

.chart-container {
  position: relative;
  height: 150px;
  background: #F9FAFB;
  border-radius: 8px;
  border: 1px solid #E5E7EB;
  margin-bottom: 8px;
}

.trend-chart {
  width: 100%;
  height: 100%;
}

.chart-loading,
.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 12px;
  color: #9CA3AF;
}

.chart-summary {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.summary-label {
  font-size: 12px;
  color: #6B7280;
}

.summary-value {
  font-size: 14px;
  font-weight: 600;
  font-family: 'SF Mono', Consolas, monospace;
}

.summary-value.up {
  color: #EF4444;
}

.summary-value.down {
  color: #10B981;
}

.holdings-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.holding-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #F9FAFB;
  border-radius: 6px;
}

.holding-index {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #E5E7EB;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #6B7280;
}

.holding-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.holding-code {
  font-size: 11px;
  color: #9CA3AF;
  font-family: 'SF Mono', Consolas, monospace;
}

.holding-ratio {
  font-size: 12px;
  font-weight: 600;
  color: #3B82F6;
}

.holdings-loading,
.holdings-empty {
  padding: 20px;
  text-align: center;
  font-size: 12px;
  color: #9CA3AF;
}

.detail-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.detail-tab {
  padding: 8px 16px;
  background: #F3F4F6;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #6B7280;
  transition: all 0.2s;
}

.detail-tab:hover {
  background: #E5E7EB;
}

.detail-tab.active {
  background: #3B82F6;
  border-color: #3B82F6;
  color: white;
}

.tab-content {
  margin-top: 8px;
}

.holdings-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.holdings-table th,
.holdings-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid #E5E7EB;
}

.holdings-table th {
  background: #F9FAFB;
  font-weight: 600;
  color: #374151;
}

.holdings-table td {
  color: #374151;
}

.holdings-table .ratio-cell {
  color: #3B82F6;
  font-weight: 600;
}
</style>
