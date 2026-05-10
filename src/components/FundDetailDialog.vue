<template>
  <div v-if="visible" class="modal-overlay">
    <div class="modal detail-modal" @click.stop>
      <div class="modal-header">
        <h3>{{ fund?.fundName }}</h3>
        <button class="modal-close" @click="$emit('close')">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="modal-body" v-if="fund">
        <div class="detail-fund-code">
          <div class="code-section">
            <span class="code-label">基金代码</span>
            <span class="code-value">{{ fund.code }}</span>
          </div>
          <button class="inline-delete-btn" @click="$emit('delete', fund)" title="删除基金">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">昨日涨幅</span>
            <div class="detail-value-row">
              <span class="detail-value" :class="getValueClass(fund.yesterdayChangeValue)">
                {{ fund.yesterdayChangePercent }}
              </span>
              <span v-if="fund.yesterdayDate" class="detail-date">{{ fund.yesterdayDate }}</span>
            </div>
          </div>
          <div class="detail-item">
            <span class="detail-label">估值涨幅</span>
            <div class="detail-value-row">
              <span class="detail-value" :class="getValueClass(fund.estimateChangeValue)">
                {{ fund.estimateChangePercent }}
              </span>
              <span v-if="fund.estimateTime" class="detail-date">{{ fund.estimateTime }}</span>
            </div>
          </div>
          <div class="detail-item">
            <span class="detail-label">最新净值</span>
            <div class="detail-value-row">
              <span class="detail-value">{{ fund.latestNav }}</span>
              <span v-if="fund.latestNavDate" class="detail-date">{{ fund.latestNavDate }}</span>
            </div>
          </div>
          <div class="detail-item">
            <span class="detail-label">估算净值</span>
            <div class="detail-value-row">
              <span class="detail-value" :class="getValueClass(fund.estimateChangeValue)">
                {{ fund.estimateNav }}
              </span>
              <span v-if="fund.estimateNavDate" class="detail-date">{{ fund.estimateNavDate }}</span>
            </div>
          </div>
          <div class="detail-item">
            <span class="detail-label">当日收益</span>
            <div class="detail-value-row">
              <span class="detail-value" :class="getValueClass(actualTodayProfit)">
                {{ actualTodayProfitText || '—' }}
              </span>
              <span v-if="actualTodayProfitPercent" class="detail-percent" :class="getValueClass(actualEstimateGrowth)">
                {{ actualTodayProfitPercent }}
              </span>
            </div>
          </div>
          <div class="detail-item">
            <div class="detail-label-row">
              <span class="detail-label">持仓金额</span>
              <span v-if="fund.holdingProfitPercent" class="holding-profit-rate" :class="getValueClass(fund.holdingProfitValue)">
                {{ fund.holdingProfitPercent }}
              </span>
            </div>
            <div class="detail-value-row">
              <span class="detail-value" :class="{ 'not-set': !fund.holdingAmountValue }">
                {{ hideAmount && fund.holdingAmountValue ? '********' : (fund.holdingAmountValue ? `¥${fund.holdingAmountValue.toFixed(2)}` : '未设置') }}
              </span>
              <button class="inline-gear-btn" @click="$emit('edit-holding', fund)" title="设置持仓">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" stroke-width="2"/>
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" stroke-width="2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-tabs">
            <button 
              :class="['detail-tab', { active: activeTab === 'estimate' }]"
              @click="activeTab = 'estimate'"
            >
              分时走势
            </button>
            <button 
              :class="['detail-tab', { active: activeTab === 'trend' }]"
              @click="activeTab = 'trend'"
            >
              业绩走势
            </button>
            <button
              :class="['detail-tab', { active: activeTab === 'holdings' }]"
              @click="activeTab = 'holdings'"
            >
              重仓股票
            </button>
            <button
              :class="['detail-tab', { active: activeTab === 'profit' }]"
              @click="activeTab = 'profit'"
            >
              历史收益
            </button>
          </div>

          <div v-show="activeTab === 'estimate'" class="tab-content">
            <div class="chart-header">
              <div v-if="estimateData.length > 0" class="chart-summary">
                <span class="summary-label">估算涨跌幅</span>
                <template v-if="estimateIsUpdated && finalPercent !== null">
                  <span class="summary-value" :class="getValueClass(estimateChange)">
                    {{ estimateChange >= 0 ? '+' : '' }}{{ estimateChange.toFixed(2) }}%
                  </span>
                  <span class="summary-separator">|</span>
                  <span class="summary-label-final">更新值</span>
                  <span class="summary-value" :class="getValueClass(finalPercent)">
                    {{ finalPercent >= 0 ? '+' : '' }}{{ finalPercent.toFixed(2) }}%
                  </span>
                </template>
                <span v-else class="summary-value" :class="getValueClass(estimateChange)">
                  {{ estimateChange >= 0 ? '+' : '' }}{{ estimateChange.toFixed(2) }}%
                </span>
              </div>
              <div v-if="estimateCacheInfo" class="cache-badge">
                <svg viewBox="0 0 24 24" fill="none" class="cache-icon">
                  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>{{ estimateCacheInfo.date }}</span>
              </div>
            </div>
            <div class="chart-container">
              <div v-if="estimateLoading" class="chart-loading">加载中...</div>
              <div v-else-if="estimateData.length > 0" ref="estimateChartRef" class="trend-chart"></div>
              <div v-else class="chart-empty">
                <div class="empty-icon">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M3 3v18h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M7 16l4-4 4 4 5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <p>暂无实时估值数据</p>
                <p class="empty-hint">非交易时间或数据源暂时不可用</p>
              </div>
            </div>
          </div>

          <div v-show="activeTab === 'trend'" class="tab-content">
            <div class="chart-header">
              <div v-if="historyData.length > 0" class="chart-summary">
                <span class="summary-label">{{ periodOptions.find(p => p.value === selectedPeriod)?.label }}涨跌幅</span>
                <span class="summary-value" :class="getValueClass(totalChange)">
                  {{ totalChange >= 0 ? '+' : '' }}{{ totalChange.toFixed(2) }}%
                </span>
              </div>
            </div>
            <div class="chart-container">
              <div v-if="chartLoading" class="chart-loading">加载中...</div>
              <div v-else-if="historyData.length >= 2" ref="chartRef" class="trend-chart"></div>
              <div v-else class="chart-empty">
                <div class="empty-icon">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M3 3v18h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M7 16l4-4 4 4 5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <p>暂无历史净值数据</p>
              </div>
            </div>
            <div class="chart-footer">
              <div class="period-tabs">
                <button 
                  v-for="p in periodOptions" 
                  :key="p.value"
                  :class="['period-btn', { active: selectedPeriod === p.value }]"
                  @click="changePeriod(p.value)"
                >
                  {{ p.label }}
                </button>
              </div>
            </div>
          </div>

          <div v-show="activeTab === 'holdings'" class="holdings-content">
            <div v-if="holdingsLoading" class="holdings-loading">加载中...</div>
            <div v-else-if="holdingsData.length > 0" class="holdings-table-wrapper">
              <table class="holdings-table">
                <thead>
                  <tr>
                    <th class="col-index">序号</th>
                    <th>股票代码</th>
                    <th>股票名称</th>
                    <th>涨跌幅</th>
                    <th>占比</th>
                  </tr>
                </thead>
              </table>
              <div class="holdings-tbody-wrapper">
                <table class="holdings-table">
                  <tbody>
                    <tr v-for="(stock, index) in holdingsData" :key="index">
                      <td class="col-index">{{ index + 1 }}</td>
                      <td>{{ stock.code }}</td>
                      <td>{{ stock.name }}</td>
                      <td class="change-cell" :class="changeClass(stock.change)">{{ stock.change }}</td>
                      <td class="ratio-cell">{{ stock.ratio }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div v-else class="holdings-empty">暂无重仓股数据</div>
          </div>

          <!-- 巻加历史收益内容 -->
          <div v-show="activeTab === 'profit'" class="profit-content">
            <!-- 未登录提示 -->
            <div v-if="!authStore.isLoggedIn" class="profit-login-tip" @click="$emit('login')">
              <div class="profit-login-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <p><span class="profit-highlight">登录</span>后可查看历史收益</p>
              <p class="profit-hint">记录您的持仓收益变化</p>
            </div>

            <!-- 历史收益数据 -->
            <div v-else class="profit-data-wrapper">
              <div v-if="profitHistoryLoading" class="profit-loading">加载中...</div>
              <template v-else-if="profitHistoryData.length > 0">
                <div v-if="profitViewMode === 'table'" class="profit-table-wrapper">
                  <table class="profit-table">
                    <thead>
                      <tr>
                        <th class="col-date">日期</th>
                        <th class="col-nav">净值</th>
                        <th class="col-rate">涨跌幅</th>
                        <th class="col-profit">收益金额</th>
                      </tr>
                    </thead>
                  </table>
                  <div class="profit-tbody-wrapper">
                    <table class="profit-table">
                      <tbody>
                        <tr v-for="(item, index) in profitHistoryData" :key="index">
                          <td class="col-date">{{ item.profitDate }}</td>
                          <td class="col-nav">{{ item.nav?.toFixed(4) ?? '—' }}</td>
                          <td class="col-rate" :class="getValueClass(item.dayProfitRate)">
                            {{ item.dayProfitRate >= 0 ? '+' : '' }}{{ item.dayProfitRate.toFixed(2) }}%
                          </td>
                          <td class="col-profit" :class="getValueClass(item.dayProfit)">
                            ¥{{ item.dayProfit.toFixed(2) }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div v-else ref="profitChartRef" class="profit-trend-chart"></div>
              </template>
              <div v-else class="profit-empty">
                <div class="empty-icon">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M8 12h-4V6a2 2 0 2 2 2 0 1 1 0 1 0 1.414 0 2.828 4.5 2.828 4.5 1.414 2.12-4.12h-1.414h6a1.414 6.414h2.414h2.172l.172-4.172 4.172-6.172-3.05-3.05-3.05z" stroke="currentColor" stroke-width="2"/>
                  </svg>
                </div>
                <p>暂无历史收益数据</p>
                <p v-if="!authStore.isLoggedIn" class="empty-hint">登录后可查看持仓收益记录</p>
              </div>
              <div v-if="profitHistoryData.length > 0" class="profit-footer-bar">
                <button :class="['profit-footer-btn', { active: profitViewMode === 'table' }]" @click="switchProfitView('table')">收益记录</button>
                <button :class="['profit-footer-btn', { active: profitViewMode === 'trend' }]" @click="switchProfitView('trend')">累计走势</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import axios from 'axios'
import * as echarts from 'echarts'
import type { FundTableRow } from '@/types'
import { useEstimateCache } from '@/composables/useEstimateCache'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  visible: boolean
  fund: FundTableRow | null
  hideAmount: boolean
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'edit-holding', fund: FundTableRow): void
  (e: 'delete', fund: FundTableRow): void
  (e: 'login'): void
}>()

const { getEstimateCache, setEstimateCache, getCacheInfo } = useEstimateCache()
const authStore = useAuthStore()

const activeTab = ref('estimate')
const selectedPeriod = ref('1')
const periodOptions = [
  { label: '近1月', value: '1' },
  { label: '近3月', value: '3' },
  { label: '近6月', value: '6' },
  { label: '近1年', value: '12' },
  { label: '近3年', value: '36' },
  { label: '成立以来', value: 'all' }
]

const historyData = ref<Array<{ date: string; nav: number; accNav: number; growth: number }>>([])
const chartLoading = ref(false)
const chartRef = ref<HTMLDivElement | null>(null)
let chartInstance: echarts.ECharts | null = null

const estimateData = ref<Array<{ time: string; value: number; percent: number }>>([])
const estimateLoading = ref(false)
const estimateChartRef = ref<HTMLDivElement | null>(null)
let estimateChartInstance: echarts.ECharts | null = null
const estimateCacheInfo = ref<{ date: string; dataCount: number } | null>(null)
const estimateIsUpdated = ref(false)
const finalNav = ref<number | null>(null)
const finalGrowth = ref<number | null>(null)

const holdingsData = ref<Array<{ name: string; code: string; ratio: string; change: string }>>([])
const holdingsLoading = ref(false)

// 历史收益相关
const profitHistoryData = ref<Array<{
  profitDate: string
  nav?: number
  dayProfitRate: number
  dayProfit: number
}>>([])
const profitHistoryLoading = ref(false)
const profitViewMode = ref<'table' | 'trend'>('table')
const profitChartRef = ref<HTMLDivElement | null>(null)
let profitChartInstance: echarts.ECharts | null = null

const profitCumulativeData = computed(() => {
  const data = [...profitHistoryData.value].sort((a, b) => a.profitDate.localeCompare(b.profitDate))
  let cumSum = 0
  return data.map(item => {
    cumSum = Math.round((cumSum + item.dayProfit) * 100) / 100
    return { date: item.profitDate, profit: cumSum }
  })
})

const totalChange = computed(() => {
  if (historyData.value.length < 2) return 0
  const first = historyData.value[0].nav
  const last = historyData.value[historyData.value.length - 1].nav
  return ((last - first) / first) * 100
})

const estimateChange = computed(() => {
  if (estimateData.value.length === 0) return finalGrowth.value ?? 0
  return estimateData.value[estimateData.value.length - 1].percent
})

const finalPercent = computed(() => {
  return finalGrowth.value
})

const actualEstimateGrowth = computed(() => {
  return props.fund?.todayProfitGrowthValue ?? estimateChange.value
})

const actualTodayProfit = computed(() => {
  if (props.fund?.todayProfitValue != null && !props.fund.isHistoryProfit) {
    return props.fund.todayProfitValue
  }
  if (!props.fund || !props.fund.holdingAmountValue || actualEstimateGrowth.value === 0) return null
  return Math.round(props.fund.holdingAmountValue * (actualEstimateGrowth.value / 100) * 100) / 100
})

const actualTodayProfitText = computed(() => {
  const profit = actualTodayProfit.value
  if (profit === null) return props.fund?.todayProfit || null
  return `${profit > 0 ? '+' : ''}¥${Math.abs(profit).toFixed(2)}`
})

const actualTodayProfitPercent = computed(() => {
  const g = actualEstimateGrowth.value
  if (g === 0) return props.fund?.todayProfitPercent || null
  return `${g > 0 ? '+' : ''}${g.toFixed(2)}%`
})

function getValueClass(value: number | null): string {
  if (value === null || value === 0) return ''
  return value > 0 ? 'up' : 'down'
}

function changePeriod(period: string) {
  selectedPeriod.value = period
  fetchHistoryData()
}

async function fetchHistoryData() {
  if (!props.fund) return
  chartLoading.value = true
  try {
    const { data } = await axios.get(`/api/fund/history/${props.fund.code}`, {
      params: { period: selectedPeriod.value }
    })
    historyData.value = data
    if (data.length > 0) {
      await nextTick()
      setTimeout(() => drawChart(), 100)
    }
  } catch (error) {
    console.error('获取历史净值失败:', error)
    historyData.value = []
  } finally {
    chartLoading.value = false
  }
}

async function fetchEstimateData() {
  if (!props.fund) return
  estimateLoading.value = true
  try {
    const { data: response } = await axios.get(`/api/fund/estimate/${props.fund.code}`)
    
    let actualData = response
    let isHistoryData = false
    let historyDate = ''
    
    if (response && typeof response === 'object' && 'data' in response) {
      actualData = response.data
      isHistoryData = response.isHistory || false
      historyDate = response.date || ''
      estimateIsUpdated.value = !!response.isUpdated
      finalNav.value = response.finalNav ?? null
      finalGrowth.value = response.finalGrowth ?? null
    } else {
      estimateIsUpdated.value = false
      finalNav.value = null
      finalGrowth.value = null
    }
    
    if (actualData && actualData.length > 0) {
      estimateData.value = actualData
      setEstimateCache(props.fund.code, actualData)
      if (isHistoryData && historyDate) {
        estimateCacheInfo.value = { date: historyDate, dataCount: actualData.length }
      } else {
        estimateCacheInfo.value = getCacheInfo(props.fund.code)
      }
      await nextTick()
      setTimeout(() => drawEstimateChart(), 100)
    } else {
      const cached = getEstimateCache(props.fund.code)
      if (cached && cached.length > 0) {
        estimateData.value = cached
        estimateIsUpdated.value = false
        finalNav.value = null
        finalGrowth.value = null
        estimateCacheInfo.value = getCacheInfo(props.fund.code)
        await nextTick()
        setTimeout(() => drawEstimateChart(), 100)
      } else {
        estimateData.value = []
      }
    }
  } catch (error) {
    console.error('获取实时估值失败:', error)
    const cached = getEstimateCache(props.fund.code)
    if (cached && cached.length > 0) {
      estimateData.value = cached
      estimateIsUpdated.value = false
      finalNav.value = null
      finalGrowth.value = null
      estimateCacheInfo.value = getCacheInfo(props.fund.code)
      await nextTick()
      setTimeout(() => drawEstimateChart(), 100)
    }
  } finally {
    estimateLoading.value = false
  }
}

async function fetchHoldingsData() {
  if (!props.fund) return
  holdingsLoading.value = true
  try {
    const { data } = await axios.get(`/api/fund/holdings/${props.fund.code}`)
    holdingsData.value = data
  } catch (error) {
    console.error('获取重仓股失败:', error)
    holdingsData.value = []
  } finally {
    holdingsLoading.value = false
  }
}

function changeClass(change: string) {
  if (!change || change === '-' || change === '--') return ''
  if (change.startsWith('-')) return 'change-down'
  if (change.startsWith('+') || parseFloat(change) > 0) return 'change-up'
  return ''
}

// 获取历史收益数据
async function fetchProfitHistoryData() {
  if (!props.fund) return
  profitHistoryLoading.value = true
  try {
    const { data } = await axios.get(`/api/holdings/${props.fund.code}/profit-history`)
    profitHistoryData.value = data
  } catch (error) {
    console.error('获取历史收益失败:', error)
    profitHistoryData.value = []
  } finally {
    profitHistoryLoading.value = false
  }
}

function switchProfitView(mode: 'table' | 'trend') {
  profitViewMode.value = mode
  if (mode === 'trend' && profitCumulativeData.value.length > 0) {
    nextTick(() => drawProfitTrendChart())
  }
}

function drawProfitTrendChart() {
  const container = profitChartRef.value
  if (!container) return

  if (profitChartInstance) {
    try {
      if (!container.contains(profitChartInstance.getDom())) {
        profitChartInstance.dispose()
        profitChartInstance = null
      }
    } catch {
      profitChartInstance?.dispose()
      profitChartInstance = null
    }
  }

  if (!profitChartInstance) {
    profitChartInstance = echarts.init(container)
  }

  const data = profitCumulativeData.value
  if (data.length === 0) return

  const dates = data.map(d => {
    const parts = d.date.split('-')
    return `${parts[1]}-${parts[2]}`
  })
  const values = data.map(d => d.profit)
  const lastVal = values[values.length - 1]

  const dataMin = Math.min(...values)
  const dataMax = Math.max(...values)
  let yMin = dataMin
  let yMax = dataMax
  if (yMin === yMax) {
    yMin -= 1
    yMax += 1
  }

  const targetSplitCount = 5
  const rawInterval = (yMax - yMin) / targetSplitCount
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)))
  const residual = rawInterval / magnitude
  let niceInterval: number
  if (residual <= 1) niceInterval = magnitude
  else if (residual <= 2) niceInterval = 2 * magnitude
  else if (residual <= 5) niceInterval = 5 * magnitude
  else niceInterval = 10 * magnitude

  yMin = Math.floor(yMin / niceInterval) * niceInterval
  yMax = Math.ceil(yMax / niceInterval) * niceInterval
  const splitCount = Math.round((yMax - yMin) / niceInterval)

  const showZeroLine = dataMin < 0 && dataMax > 0
  const lineColor = lastVal >= 0 ? '#EF4444' : '#10B981'

  const option: echarts.EChartsOption = {
    title: {
      show: true,
      text: `{label|累计收益}  {value|${lastVal >= 0 ? '+' : ''}${lastVal.toFixed(2)}}`,
      right: 15,
      top: 0,
      textStyle: {
        rich: {
          label: {
            fontSize: 10,
            color: '#6B7280',
            fontFamily: 'SF Mono, Consolas, monospace'
          },
          value: {
            fontSize: 12,
            fontWeight: 'bold',
            color: lineColor,
            fontFamily: 'SF Mono, Consolas, monospace'
          }
        }
      }
    },
    animation: false,
    grid: { left: 55, right: 15, top: 28, bottom: 30 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#9CA3AF',
        fontSize: 10,
        interval: data.length <= 10 ? 0 : Math.ceil(data.length / 6) - 1,
        rotate: data.length > 15 ? 45 : 0
      },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      min: yMin,
      max: yMax,
      splitNumber: splitCount,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#E5E7EB' } },
      axisLabel: {
        color: '#6B7280',
        fontSize: 11,
        formatter: (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(0)}`
      }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      borderWidth: 0,
      padding: [10, 14],
      textStyle: { color: '#fff', fontSize: 13 },
      formatter: (params: any) => {
        if (!Array.isArray(params)) return ''
        const idx = params[0]?.dataIndex
        const dateStr = data[idx]?.date || ''
        const val = params[0]?.value
        if (val == null) return ''
        const sign = val >= 0 ? '+' : ''
        const color = val >= 0 ? '#EF4444' : '#10B981'
        return `<div style="font-size:10px;color:#9CA3AF;margin-bottom:4px">${dateStr}</div>
                <div style="font-size:12px;color:${color}">累计 ${sign}¥${val.toFixed(2)}</div>`
      }
    },
    series: [
      {
        name: '累计收益',
        type: 'line',
        data: values,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: lineColor, width: 1.2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: lineColor + '30' },
            { offset: 1, color: lineColor + '05' }
          ])
        },
        connectNulls: true,
        ...(showZeroLine
          ? { markLine: { silent: true, symbol: 'none', label: { show: false }, data: [{ yAxis: 0 }], lineStyle: { color: '#9CA3AF', width: 1, type: 'dashed' } } }
          : {}),
      },
      {
        name: '终点标记',
        type: 'line',
        data: values.map((v, i) => i === values.length - 1 ? v : null),
        smooth: false,
        symbol: 'circle',
        symbolSize: 5,
        showSymbol: true,
        lineStyle: { width: 0 },
        itemStyle: { color: lineColor },
        tooltip: { show: false }
      }
    ]
  }

  profitChartInstance.setOption(option, true)
}

function drawChart() {
  if (!chartRef.value || historyData.value.length < 2) return
  
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
  
  chartInstance = echarts.init(chartRef.value)
  
  const data = historyData.value
  const firstNav = data[0].nav
  const growthData = data.map(d => ((d.nav - firstNav) / firstNav) * 100)
  const lineColor = totalChange.value >= 0 ? '#EF4444' : '#10B981'
  const currentYear = new Date().getFullYear().toString()
  
  const option: echarts.EChartsOption = {
    animation: false,
    grid: { left: 45, right: 15, top: 15, bottom: 25 },
    xAxis: {
      type: 'category',
      data: data.map(d => d.date),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#9CA3AF',
        fontSize: 10,
        interval: Math.floor(data.length / 5),
        rotate: data.length > 60 ? 45 : 0,
        formatter: (value: string) => {
          if (!value) return value
          const parts = value.split('-')
          if (parts.length === 3 && parts[0] === currentYear) {
            return `${parts[1]}-${parts[2]}`
          }
          return value
        }
      }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#E5E7EB', type: 'dashed' } },
      axisLabel: {
        color: '#9CA3AF',
        fontSize: 10,
        formatter: (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
      }
    },
    series: [{
      type: 'line',
      data: growthData,
      smooth: false,
      symbol: 'none',
      lineStyle: { color: lineColor, width: 1.2 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: `${lineColor}40` },
          { offset: 1, color: `${lineColor}00` }
        ])
      }
    }],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.7)',
      borderColor: 'transparent',
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: (params: any) => {
        const idx = params[0].dataIndex
        const d = data[idx]
        const accGrowth = growthData[idx]
        return `${d.date}<br/>净值: ${d.nav.toFixed(4)}<br/>日涨跌: ${d.growth >= 0 ? '+' : ''}${d.growth}%<br/>累计: ${accGrowth >= 0 ? '+' : ''}${accGrowth.toFixed(2)}%`
      }
    }
  }
  
  chartInstance.setOption(option)
  chartInstance.resize()
}

function drawEstimateChart() {
  if (!estimateChartRef.value || (estimateData.value.length === 0 && !estimateIsUpdated.value)) return
  
  if (estimateChartInstance) {
    estimateChartInstance.dispose()
    estimateChartInstance = null
  }
  
  estimateChartInstance = echarts.init(estimateChartRef.value)
  
  const data = estimateData.value
  const hasFinal = estimateIsUpdated.value && finalGrowth.value !== null
  const lineColor = (hasFinal ? finalGrowth.value! : estimateChange.value) >= 0 ? '#EF4444' : '#10B981'
  
  const filteredData = data.filter(d => {
    const mins = parseInt(d.time.split(':')[0]) * 60 + parseInt(d.time.split(':')[1])
    if (mins >= 12 * 60 + 5 && mins <= 12 * 60 + 55) return false
    return true
  })

  if (filteredData.length === 0 && hasFinal) {
    const val = finalGrowth.value!
    const xLabels = ['09:30', '11:30', '13:00', '15:00']
    const seriesData = xLabels.map(() => val)
    
    estimateChartInstance.setOption({
    animation: false,
      grid: { left: 45, right: 15, top: 15, bottom: 25 },
      xAxis: {
        type: 'category',
        data: xLabels,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#9CA3AF', fontSize: 10 }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#E5E7EB', type: 'dashed' } },
        axisLabel: {
          color: '#9CA3AF',
          fontSize: 10,
          formatter: (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
        }
      },
      series: [{
        type: 'line',
        data: seriesData,
        smooth: false,
        symbol: 'none',
        lineStyle: { color: lineColor, width: 1.2, type: 'dashed' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${lineColor}20` },
            { offset: 1, color: `${lineColor}00` }
          ])
        },
        markPoint: {
          data: [{ coord: [xLabels.length - 1, val] }],
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: { color: lineColor },
          label: {
            show: true,
            position: 'right',
            formatter: `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`,
            color: lineColor,
            fontSize: 11,
            fontWeight: 600
          }
        }
      }],
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderColor: 'transparent',
        textStyle: { color: '#fff', fontSize: 12 },
        formatter: () => {
          const navStr = finalNav.value != null ? finalNav.value.toFixed(4) : '—'
          return `净值: ${navStr} (${val >= 0 ? '+' : ''}${val.toFixed(2)}%)`
        }
      }
    })
    estimateChartInstance.resize()
    return
  }

  if (filteredData.length === 0) return
  
  const xAxisData = filteredData.map(d => d.time)
  const seriesData = filteredData.map(d => d.percent)
  
  const series: any[] = [{
    type: 'line',
    data: seriesData,
    smooth: true,
    symbol: 'none',
    lineStyle: { color: lineColor, width: 1.2 },
    areaStyle: {
      color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: `${lineColor}40` },
        { offset: 1, color: `${lineColor}00` }
      ])
    }
  }]
  
  if (hasFinal && seriesData.length > 0) {
    const lastIndex = seriesData.length - 1
    const estimateLast = seriesData[lastIndex]
    
    series.push({
      type: 'line',
      data: [
        [lastIndex, estimateLast],
        [lastIndex, finalGrowth.value!]
      ],
      symbol: 'none',
      lineStyle: { color: lineColor, width: 1.2 }
    })

    series.push({
      type: 'line',
      data: [[lastIndex, finalGrowth.value!]],
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 0 },
      itemStyle: { color: lineColor },
      label: {
        show: true,
        position: 'left',
        formatter: `${finalGrowth.value! >= 0 ? '+' : ''}${finalGrowth.value!.toFixed(2)}%`,
        color: lineColor,
        fontSize: 11,
        fontWeight: 600
      }
    })
  }
  
  const lastEstimateValue = filteredData.length > 0 
    ? filteredData[filteredData.length - 1].value 
    : 0
  
  const option: echarts.EChartsOption = {
    animation: false,
    grid: { left: 45, right: 15, top: 15, bottom: 25 },
    xAxis: {
      type: 'category',
      data: xAxisData,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#9CA3AF',
        fontSize: 10,
        interval: Math.floor(xAxisData.length / 5)
      }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#E5E7EB', type: 'dashed' } },
      axisLabel: {
        color: '#9CA3AF',
        fontSize: 10,
        formatter: (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
      }
    },
    series,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.7)',
      borderColor: 'transparent',
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: (params: any) => {
        if (!params || params.length === 0) return ''
        const idx = params[0].dataIndex
        if (idx >= filteredData.length) return ''
        
        const d = filteredData[idx]
        let result = `${d.time}<br/>净值: ${d.value.toFixed(4)} (${d.percent >= 0 ? '+' : ''}${d.percent.toFixed(2)}%)`
        
        if (hasFinal && d.time === '16:00') {
          const navStr = finalNav.value != null ? finalNav.value.toFixed(4) : '—'
          result = `16:00<br/>估值: ${lastEstimateValue.toFixed(4)} (${d.percent >= 0 ? '+' : ''}${d.percent.toFixed(2)}%)<br/>最终: ${navStr} (${finalGrowth.value! >= 0 ? '+' : ''}${finalGrowth.value!.toFixed(2)}%)`
        }
        return result
      }
    }
  }
  
  estimateChartInstance.setOption(option)
  estimateChartInstance.resize()
}

watch(() => props.visible, (val) => {
  if (val && props.fund) {
    profitHistoryData.value = []
    profitViewMode.value = 'table'
    activeTab.value = 'estimate'
    fetchHistoryData()
    fetchHoldingsData()
    fetchEstimateData()
  } else {
    if (chartInstance) {
      chartInstance.dispose()
      chartInstance = null
    }
    if (estimateChartInstance) {
      estimateChartInstance.dispose()
      estimateChartInstance = null
    }
    if (profitChartInstance) {
      profitChartInstance.dispose()
      profitChartInstance = null
    }
  }
})

watch(activeTab, (val) => {
  if (chartInstance) {
    setTimeout(() => chartInstance?.resize(), 50)
  }
  if (val === 'estimate' && estimateChartInstance) {
    setTimeout(() => estimateChartInstance?.resize(), 50)
  }
  if (val === 'profit' && authStore.isLoggedIn && props.fund) {
    fetchProfitHistoryData()
  }
  if (val === 'profit' && profitViewMode.value === 'trend') {
    setTimeout(() => {
      profitChartInstance?.resize()
      drawProfitTrendChart()
    }, 50)
  }
})
</script>

<style scoped>
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
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
}

.detail-modal {
  max-width: 560px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #E5E7EB;
}

.modal-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #6B7280;
  border-radius: 6px;
}

.modal-close:hover {
  background: #F3F4F6;
}

.modal-close svg {
  width: 18px;
  height: 18px;
}

.modal-body {
  padding: 20px;
}

.code-label {
  font-size: 12px;
  font-weight: 600;
  color: #6B7280;
}

.code-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.code-value {
  font-size: 13px;
  font-weight: 600;
  color: #3B82F6;
  font-family: 'SF Mono', Consolas, monospace;
}

.holding-profit-rate {
  font-size: 11px;
  font-weight: 600;
  font-family: 'SF Mono', Consolas, monospace;
}

.holding-profit-rate.up {
  color: #EF4444;
}

.holding-profit-rate.down {
  color: #10B981;
}

.detail-fund-code {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #E5E7EB;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 10px;
  background: #F9FAFB;
  border-radius: 6px;
}

.detail-label {
  font-size: 10px;
  color: #6B7280;
}

.detail-label-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.detail-value {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
  font-family: 'SF Mono', Consolas, monospace;
}

.detail-value.not-set {
  font-size: 12px;
  font-weight: 500;
  color: #9CA3AF;
}

.detail-value.up {
  color: #EF4444;
}

.detail-value.down {
  color: #10B981;
}

.detail-date {
  font-size: 10px;
  color: #9CA3AF;
}

.detail-value-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.detail-percent {
  font-size: 11px;
  font-weight: 600;
  font-family: 'SF Mono', Consolas, monospace;
}

.detail-percent.up {
  color: #EF4444;
}

.detail-percent.down {
  color: #10B981;
}

.inline-gear-btn {
  width: 18px;
  height: 18px;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #9CA3AF;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.inline-gear-btn:hover {
  color: #3B82F6;
}

.inline-gear-btn svg {
  width: 14px;
  height: 14px;
}

.inline-delete-btn {
  width: 24px;
  height: 24px;
  margin-left: 8px;
  padding: 0;
  background: #FEE2E2;
  border: none;
  cursor: pointer;
  color: #EF4444;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.detail-fund-code:not(:has(.holding-profit-section)) .inline-delete-btn {
  margin-left: auto;
}

.inline-delete-btn:hover {
  background: #FECACA;
  color: #DC2626;
}

.inline-delete-btn svg {
  width: 14px;
  height: 14px;
}

.detail-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #E5E7EB;
}

.detail-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.detail-tab {
  padding: 6px 14px;
  background: #F3F4F6;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
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
  min-height: 180px;
}

.holdings-content {
  max-height: 280px;
  overflow-y: auto;
}

.holdings-loading,
.holdings-empty {
  padding: 40px 20px;
  text-align: center;
  font-size: 12px;
  color: #9CA3AF;
}

.holdings-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.holdings-table thead {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #F3F4F6;
}

.holdings-table th,
.holdings-table td {
  padding: 8px 10px;
  text-align: left;
  border-bottom: 1px solid #E5E7EB;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.holdings-table th:nth-child(1),
.holdings-table td:nth-child(1) {
  width: 60px;
  text-align: center;
}

.holdings-table th:nth-child(2),
.holdings-table td:nth-child(2) {
  width: 80px;
}

.holdings-table th:nth-child(3),
.holdings-table td:nth-child(3) {
  width: auto;
}

.holdings-table th:nth-child(4),
.holdings-table td:nth-child(4) {
  width: 85px;
  text-align: right;
}

.holdings-table th:nth-child(5),
.holdings-table td:nth-child(5) {
  width: 80px;
  text-align: right;
}

.holdings-table th {
  background: #F9FAFB;
  font-weight: 600;
  color: #374151;
}

.holdings-table td {
  color: #374151;
}

.holdings-table .change-cell {
  font-weight: 600;
}

.holdings-table .change-up {
  color: #DC2626;
}

.holdings-table .change-down {
  color: #16A34A;
}

.ratio-cell {
  color: #3B82F6;
  font-weight: 600;
}

.trend-chart {
  width: 100%;
  height: 200px;
}

.chart-container {
  position: relative;
  min-height: 200px;
}

.chart-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #9CA3AF;
  font-size: 13px;
}

.chart-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 8px;
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
  min-height: 20px;
}

.chart-summary {
  display: flex;
  align-items: center;
  gap: 4px;
}

.summary-label {
  font-size: 10px;
  color: #9CA3AF;
}

.summary-value {
  font-size: 11px;
  font-weight: 600;
  font-family: 'SF Mono', Consolas, monospace;
}

.summary-value.up {
  color: #EF4444;
}

.summary-value.down {
  color: #10B981;
}

.summary-separator {
  color: #9CA3AF;
  margin: 0 4px;
  font-size: 8px;
  vertical-align: middle;
}

.summary-label-final {
  font-size: 10px;
  color: #9CA3AF;
  margin-right: 4px;
}

.period-tabs {
  display: flex;
  gap: 6px;
}

.period-btn {
  padding: 4px 10px;
  font-size: 11px;
  background: #F3F4F6;
  border: 1px solid #E5E7EB;
  border-radius: 4px;
  cursor: pointer;
  color: #6B7280;
  transition: all 0.2s;
}

.period-btn:hover {
  background: #E5E7EB;
}

.period-btn.active {
  background: #3B82F6;
  border-color: #3B82F6;
  color: white;
}

.chart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: 40px 20px;
  color: #9CA3AF;
}

.empty-icon {
  width: 48px;
  height: 48px;
  background: #F3F4F6;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
}

.empty-icon svg {
  width: 24px;
  height: 24px;
  color: #9CA3AF;
}

.chart-empty p {
  margin: 4px 0;
  font-size: 13px;
}

.cache-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 4px;
  font-size: 10px;
  color: #3B82F6;
}

.cache-icon {
  width: 12px;
  height: 12px;
}

.empty-hint {
  font-size: 11px !important;
  color: #9CA3AF;
}

/* 巻加历史收益相关样式 */
.profit-content {
  max-height: 280px;
  overflow-y: auto;
}

.profit-footer-bar {
  display: flex;
  justify-content: center;
  margin-top: 12px;
  background: #F3F4F6;
  padding: 3px;
  border-radius: 8px;
  width: fit-content;
  margin-left: auto;
  margin-right: auto;
}

.profit-footer-btn {
  padding: 4px 14px;
  font-size: 11px;
  font-weight: 500;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: #6B7280;
  transition: all 0.2s;
}

.profit-footer-btn:hover {
  color: #374151;
}

.profit-footer-btn.active {
  background: white;
  color: #111827;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.profit-trend-chart {
  height: 220px;
  background: #FAFAFA;
  border-radius: 8px;
}

.profit-loading,
.profit-empty {
  padding: 40px 20px;
  text-align: center;
  font-size: 12px;
  color: #9CA3AF;
}

.profit-login-tip {
  padding: 20px;
  text-align: center;
  color: #9CA3AF;
  background: #FFFDF5;
  border: 1px solid #FEF3C7;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.profit-login-tip:hover {
  background: #FFFBEB;
}

.profit-login-icon {
  width: 48px;
  height: 48px;
  background: #F3F4F6;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
}

.profit-login-icon svg {
  width: 24px;
  height: 24px;
  color: #9CA3AF;
}

.profit-login-tip p {
  margin: 4px 0;
  font-size: 13px;
  color: #374151;
}

.profit-highlight {
  font-weight: 600;
}

.profit-hint {
  font-size: 11px !important;
  color: #9CA3AF;
}

.profit-table-wrapper {
  max-height: 240px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.profit-tbody-wrapper {
  flex: 1;
  overflow-y: auto;
  max-height: 200px;
}

.profit-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.profit-table thead {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #F3F4F6;
}

.profit-table th,
.profit-table td {
  padding: 8px 10px;
  text-align: left;
  border-bottom: 1px solid #E5E7EB;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profit-table th:nth-child(1),
.profit-table td:nth-child(1) {
  width: 65px;
  text-align: center;
}

.profit-table th:nth-child(2),
.profit-table td:nth-child(2) {
  width: 65px;
  text-align: center;
}

.profit-table th:nth-child(3),
.profit-table td:nth-child(3) {
  width: 65px;
  text-align: center;
}

.profit-table th:nth-child(4),
.profit-table td:nth-child(4) {
  width: 85px;
  text-align: center;
}

.profit-table th {
  background: #F9FAFB;
  font-weight: 600;
  color: #374151;
}

.profit-table td {
  color: #374151;
}

.profit-table .col-rate.up,
.profit-table .col-profit.up {
  color: #EF4444;
}

.profit-table .col-rate.down,
.profit-table .col-profit.down {
  color: #10B981;
}

.profit-table .col-nav {
  font-family: 'SF Mono', Consolas, monospace;
}

.profit-table .col-rate.up {
  color: #EF4444;
}

.profit-table .col-profit.down {
  color: #10B981;
}

.profit-tbody-wrapper {
  max-height: 200px;
  overflow-y: auto;
}
</style>
