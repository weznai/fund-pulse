<template>
  <div class="user-holdings-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">用户持仓详情</h2>
        <p class="page-desc">查看用户 {{ userId }} 的持仓信息</p>
      </div>
      <div class="header-right">
        <button class="refresh-btn" @click="loadUserData" :disabled="loading">
          <svg viewBox="0 0 24 24" fill="none" :class="{ 'spinning': loading }">
            <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          刷新
        </button>
        <button class="back-btn" @click="goBack">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          返回列表
        </button>
      </div>
    </div>

    <div class="content-body">
      <!-- 用户信息 -->
      <div class="user-info-section">
        <div class="info-card">
          <div class="info-label">用户ID</div>
          <div class="info-value">{{ userId }}</div>
        </div>
        <div class="info-card">
          <div class="info-label">用户类型</div>
          <div class="info-value">{{ getTypeLabel(userInfo?.type || '-') }}</div>
        </div>
        <div class="info-card" v-if="userInfo?.label">
          <div class="info-label">用户标签</div>
          <div class="info-value">{{ userInfo.label }}</div>
        </div>
      </div>

      <!-- 持仓列表 -->
      <div class="holdings-section">
        <div class="section-header">
          <h3>持仓列表</h3>
          <span class="holding-count">共 {{ holdings.length }} 个持仓</span>
        </div>

        <div class="table-container" v-if="!loading && holdings.length > 0">
          <table class="data-table">
            <thead>
              <tr>
                <th>基金代码</th>
                <th>基金名称</th>
                <th>份额</th>
                <th>持有金额</th>
                <th>持有日期</th>
                <th>结算状态</th>
                <th>最后结算日</th>
                <th>当日收益</th>
                <th>累计收益</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="holding in holdings" :key="holding.fundCode">
                <td class="fund-code">{{ holding.fundCode }}</td>
                <td>{{ holding.fundName || '-' }}</td>
                <td>{{ holding.share ? holding.share.toFixed(2) : '-' }}</td>
                <td>{{ holding.amount ? holding.amount.toFixed(2) : '-' }}</td>
                <td>{{ holding.holdingDate ? formatDateShort(holding.holdingDate) : '-' }}</td>
                <td>
                  <span class="badge" :class="holding.settled ? 'settled' : 'pending'">
                    {{ holding.settled ? '已结算' : '待结算' }}
                  </span>
                </td>
                <td>
                  <span v-if="holding.settleDate">{{ formatDateShort(holding.settleDate) }}</span>
                  <span v-else class="no-settle-date">-</span>
                </td>
                <td :class="holding.currentDayProfit >= 0 ? 'positive' : holding.currentDayProfit < 0 ? 'negative' : ''">
                  {{ holding.currentDayProfit !== undefined && holding.currentDayProfit !== null ? (holding.currentDayProfit >= 0 ? '+' : '') + holding.currentDayProfit.toFixed(2) : '-' }}
                </td>
                <td :class="holding.accumulatedProfit >= 0 ? 'positive' : holding.accumulatedProfit < 0 ? 'negative' : ''">
                  {{ holding.accumulatedProfit ? (holding.accumulatedProfit >= 0 ? '+' : '') + holding.accumulatedProfit.toFixed(2) : '-' }}
                </td>
                <td>
                  <div class="action-btns">
                    <button
                      class="refresh-fund-btn"
                      @click="refreshFund(holding)"
                      :disabled="refreshing === holding.fundCode"
                    >
                      {{ refreshing === holding.fundCode ? '更新中...' : '更新' }}
                    </button>
                    <button
                      class="settle-btn"
                      @click="settleFund(holding)"
                      :disabled="settling === holding.fundCode"
                      :class="{ settled: holding.settled }"
                    >
                      {{ settling === holding.fundCode ? '结算中...' : (holding.settled ? '已结算' : '结算') }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="summary-row">
                <td colspan="3" class="summary-label">汇总</td>
                <td class="summary-value">{{ totalAmount.toFixed(2) }}</td>
                <td colspan="3"></td>
                <td class="summary-value" :class="totalDailyProfit >= 0 ? 'positive' : 'negative'">
                  {{ totalDailyProfit >= 0 ? '+' : '' }}{{ totalDailyProfit.toFixed(2) }}
                </td>
                <td class="summary-value" :class="totalAccumulatedProfit >= 0 ? 'positive' : 'negative'">
                  {{ totalAccumulatedProfit >= 0 ? '+' : '' }}{{ totalAccumulatedProfit.toFixed(2) }}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="empty-state" v-else-if="!loading && holdings.length === 0">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M21 14l-7-5-7-5V5a2 2 0 0 1 2 2h10a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="7 3 7 8 15 8 15 8 22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <p>该用户暂无持仓</p>
        </div>

        <div class="loading-state" v-if="loading">
          <span class="spinner"></span>
          <span>加载中...</span>
        </div>
      </div>

      <!-- 自选基金 -->
      <div class="favorites-section" v-if="!loading && favoriteFunds.length > 0">
        <div class="section-header">
          <h3>自选基金</h3>
          <span class="fund-count">共 {{ favoriteFunds.length }} 只基金</span>
        </div>

        <div class="favorites-list">
          <div class="favorite-item" v-for="fund in favoriteFunds" :key="fund.fundCode">
            <span class="fund-code">{{ fund.fundCode }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'

const route = useRoute()
const router = useRouter()

const userId = ref('')
const userInfo = ref<any>(null)
const holdings = ref<any[]>([])
const favoriteFunds = ref<any[]>([])
const loading = ref(true)
const settling = ref<string | null>(null)
const refreshing = ref<string | null>(null)

function getOperateDate(holding: any): string {
  return holding.settleDate || new Date().toISOString().slice(0, 10)
}

const totalDailyProfit = computed(() => {
  return holdings.value.reduce((sum, h) => sum + (h.currentDayProfit || 0), 0)
})

const totalAccumulatedProfit = computed(() => {
  return holdings.value.reduce((sum, h) => sum + (h.accumulatedProfit || 0), 0)
})

const totalAmount = computed(() => {
  return holdings.value.reduce((sum, h) => sum + (h.amount || 0), 0)
})

// 获取用户ID从路由参数
onMounted(() => {
  if (route.params.userId) {
    userId.value = route.params.userId as string
    loadUserData()
  }
})

// 加载用户数据
async function loadUserData() {
  loading.value = true
  try {
    // 获取用户信息 - 使用管理API
    const usersRes = await axios.get('/api/admin/users')
    const user = usersRes.data.find((u: any) => u.id === userId.value)
    if (user) {
      userInfo.value = user
    }

    // 获取用户持仓 - 使用管理API获取指定用户的持仓
    const holdingsData = await axios.get(`/api/admin/users/${userId.value}/holdings`)
    console.log('持仓数据:', holdingsData.data)
    holdings.value = holdingsData.data || []

    // 获取用户基金列表
    const fundsData = await axios.get(`/api/admin/users/${userId.value}/funds`)
    console.log('基金数据:', fundsData.data)
    favoriteFunds.value = fundsData.data || []
  } catch (error) {
    console.error('加载用户数据失败:', error)
  } finally {
    loading.value = false
  }
}

// 获取类型标签
function getTypeLabel(type: string) {
  const labels: Record<string, string> =  {
    'machine': '机器',
    'phone': '手机',
    'email': '邮箱',
    'custom': '自定义'
  }
  return labels[type] || type
}

// 格式化日期（只显示日期）
function formatDateShort(dateStr: string) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

// 返回上一页
function goBack() {
  router.push('/admin/user-manage')
}

// 单基金结算
async function settleFund(holding: any) {
  const date = getOperateDate(holding)
  if (!confirm(`确定要结算 ${holding.fundCode} (${holding.fundName}) 的 ${date} 数据吗？`)) {
    return
  }

  settling.value = holding.fundCode
  try {
    await axios.post(`/api/admin/users/${userId.value}/holdings/${holding.fundCode}/settle`, { date })
    alert('结算成功')
    await loadUserData()
  } catch (error: any) {
    console.error('结算失败:', error)
    alert(error.response?.data?.error || '结算失败')
  } finally {
    settling.value = null
  }
}

async function refreshFund(holding: any) {
  const date = getOperateDate(holding)
  if (!confirm(`确定要刷新 ${holding.fundCode} (${holding.fundName}) 的 ${date} 数据并重新结算吗？`)) {
    return
  }

  refreshing.value = holding.fundCode
  try {
    const { data } = await axios.post(`/api/admin/funds/${holding.fundCode}/refresh-today`, { date })
    alert(data.message || '刷新成功')
    await loadUserData()
  } catch (error: any) {
    console.error('刷新失败:', error)
    alert(error.response?.data?.error || '刷新失败')
  } finally {
    refreshing.value = null
  }
}
</script>

<style scoped>
.user-holdings-page {
  padding: 24px;
}

.page-header {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #E5E7EB;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.page-desc {
  font-size: 14px;
  color: #6B7280;
  margin: 0;
}

.content-body {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 用户信息 */
.user-info-section {
  background: #fff;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  gap: 24px;
}

.info-card {
  flex: 1;
}

.info-label {
  font-size: 12px;
  color: #6B7280;
  margin-bottom: 4px;
}

.info-value {
  font-size: 14px;
  color: #111827;
  font-weight: 500;
}

/* 持仓列表 */
.holdings-section {
  background: #fff;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  padding: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.holding-count {
  font-size: 13px;
  color: #6B7280;
  background: #F3F4F6;
  padding: 4px 10px;
  border-radius: 12px;
}

/* 自选基金 */
.favorites-section {
  background: #fff;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  padding: 20px;
}

.fund-count {
  font-size: 13px;
  color: #6B7280;
  background: #F3F4F6;
  padding: 4px 10px;
  border-radius: 12px;
}

.favorites-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.favorite-item {
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  min-width: 100px;
}

.favorite-item .fund-code {
  font-family: 'SF Mono', Consolas, monospace;
  font-weight: 500;
  color: #1e3a5f;
  font-size: 13px;
}

.favorite-item .fund-name {
  font-size: 12px;
  color: #6B7280;
  margin-top: 4px;
}

/* 表格 */
.table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th {
  background: #F9FAFB;
  padding: 10px 12px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #E5E7EB;
  white-space: nowrap;
  font-size: 12px;
}

.data-table td {
  padding: 8px 12px;
  border-bottom: 1px solid #E5E7EB;
  color: #374151;
}

.data-table tbody tr:hover {
  background: #F9FAFB;
}

.summary-row {
  background: #F0F4FF;
  font-weight: 600;
}

.summary-row td {
  border-bottom: none;
  padding: 10px 12px;
  color: #1e3a5f;
}

.summary-label {
  text-align: right;
  font-size: 13px;
}

.summary-value {
  font-family: 'SF Mono', Consolas, monospace;
  font-size: 13px;
}

.user-id {
  font-family: 'SF Mono', Consolas, monospace;
  font-weight: 500;
}

.fund-code {
  font-family: 'SF Mono', Consolas, monospace;
  font-weight: 500;
}

/* 徽章 */
.badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.badge.settled {
  background: #D1FAE5;
  color: #065F46;
}

.badge.pending {
  background: #FEF3C7;
  color: #92400E;
}

.no-settle-date {
  color: #9CA3AF;
  font-size: 12px;
}

.positive {
  color: #10B981;
}

.negative {
  color: #EF4444;
}

/* 猉钮样式 */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.btn-primary {
  background: #1e3a5f;
  color: #fff;
}

.btn-primary:hover {
  background: #2d5a87;
}

.btn-secondary {
  background: #fff;
  color: #374151;
  border: 1px solid #D1D5DB;
}

.btn-secondary:hover {
  background: #F9FAFB;
  border-color: #9CA3AF;
}

/* 返回按钮样式 */
.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: linear-gradient(135deg, #fff 0%, #f8fafc 100%);
  color: #1e3a5f;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.back-btn:hover {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-color: #cbd5e1;
}

.back-btn svg {
  width: 14px;
  height: 14px;
}

/* 刷新按钮样式 */
.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: #3B82F6;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.refresh-btn:hover:not(:disabled) {
  background: #2563EB;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-btn svg {
  width: 14px;
  height: 14px;
}

.refresh-btn svg.spinning {
  animation: spin 1s linear infinite;
}

.header-right {
  display: flex;
  gap: 10px;
  align-items: center;
}

/* 结算按钮样式 */
.settle-btn {
  padding: 2px 6px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  background: #3B82F6;
  color: #fff;
  min-width: 52px;
  text-align: center;
}

.settle-btn:hover:not(:disabled) {
  background: #2563EB;
}

.settle-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.settle-btn.settled {
  background: #10B981;
  cursor: default;
}

.action-btns {
  display: flex;
  gap: 6px;
}

.refresh-fund-btn {
  padding: 2px 6px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  background: #F59E0B;
  color: #fff;
  min-width: 52px;
  text-align: center;
}

.refresh-fund-btn:hover:not(:disabled) {
  background: #D97706;
}

.refresh-fund-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #9CA3AF;
}

.empty-state svg {
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}

/* 加载状态 */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  color: #6B7280;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #E5E7EB;
  border-top-color: #1e3a5f;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
