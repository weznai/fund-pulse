<template>
  <div class="fund-detail">
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner">
        <div class="spinner-ring"></div>
        <div class="spinner-ring"></div>
        <div class="spinner-ring"></div>
      </div>
      <p>加载中...</p>
    </div>
    
    <div v-else-if="error" class="error-state">
      <div class="error-icon">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <p class="error-title">加载失败</p>
      <p class="error-text">{{ error }}</p>
      <button @click="fetchDetail" class="retry-btn">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        重试
      </button>
    </div>

    <div v-else-if="fund" class="detail-content">
      <header class="detail-header">
        <button @click="goBack" class="back-btn">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>返回</span>
        </button>
        <div class="header-info">
          <h1 class="fund-title">{{ fund.name }}</h1>
          <span class="fund-code">{{ fund.code }}</span>
        </div>
        <button 
          class="favorite-btn" 
          @click="toggleFavorite"
          :class="{ active: isFavorite }"
        >
          <svg v-if="isFavorite" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          <span>{{ isFavorite ? '已自选' : '加自选' }}</span>
        </button>
      </header>

      <div class="main-info">
        <div class="nav-section">
          <div class="nav-card">
            <div class="nav-label">单位净值</div>
            <div class="nav-value">{{ fund.nav.toFixed(4) }}</div>
          </div>
          <div class="nav-card">
            <div class="nav-label">累计净值</div>
            <div class="nav-value">{{ fund.accNav.toFixed(4) }}</div>
          </div>
          <div class="nav-card highlight">
            <div class="nav-label">日涨跌幅</div>
            <div class="nav-value" :class="growthClass">
              <svg v-if="fund.dayGrowth > 0" viewBox="0 0 24 24" fill="none">
                <path d="M23 6l-9.5 9.5-5-5L1 18M17 6h6v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <svg v-else-if="fund.dayGrowth < 0" viewBox="0 0 24 24" fill="none">
                <path d="M23 18l-9.5-9.5-5 5L1 6M17 18h6v-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              {{ growthText }}
            </div>
          </div>
        </div>
      </div>

      <div class="info-section">
        <div class="section-header">
          <div class="section-icon">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h3>基本信息</h3>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">基金类型</span>
            <span class="info-value">{{ fund.type }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">基金经理</span>
            <span class="info-value">{{ fund.manager }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">基金规模</span>
            <span class="info-value">{{ fund.size }}亿元</span>
          </div>
          <div class="info-item">
            <span class="info-label">成立日期</span>
            <span class="info-value">{{ fund.establishDate }}</span>
          </div>
          <div class="info-item full-width">
            <span class="info-label">业绩比较基准</span>
            <span class="info-value">{{ fund.benchmark }}</span>
          </div>
        </div>
      </div>

      <div class="info-section">
        <div class="section-header">
          <div class="section-icon">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M3 3v18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M7 16l4-4 4 4 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h3>实时估值走势</h3>
          <div v-if="estimateCacheInfo" class="cache-badge">
            <svg viewBox="0 0 24 24" fill="none" class="cache-icon">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>{{ estimateCacheInfo.date }}</span>
          </div>
        </div>
        <div class="chart-container">
          <div v-if="estimateLoading" class="chart-loading">
            <div class="loading-spinner">
              <div class="spinner-ring"></div>
              <div class="spinner-ring"></div>
              <div class="spinner-ring"></div>
            </div>
            <p>加载中...</p>
          </div>
          <div v-else-if="estimateData.length > 0" class="chart-wrapper">
            <div class="chart-summary">
              <span class="summary-label">估算涨跌幅</span>
              <span class="summary-value" :class="estimateChange >= 0 ? 'positive' : 'negative'">
                {{ estimateChange >= 0 ? '+' : '' }}{{ estimateChange.toFixed(2) }}%
              </span>
            </div>
            <div ref="estimateChartRef" class="trend-chart"></div>
          </div>
          <div v-else class="chart-empty">
            <div class="empty-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M3 3v18h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M7 16l4-4 4 4 5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <p>暂无实时估值数据</p>
            <p class="hint">非交易时间或数据源暂时不可用</p>
          </div>
        </div>
      </div>

      <div class="info-section">
        <div class="section-header">
          <div class="section-icon">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h3>业绩走势</h3>
        </div>
        <div class="chart-container">
          <div v-if="historyLoading" class="chart-loading">
            <div class="loading-spinner">
              <div class="spinner-ring"></div>
              <div class="spinner-ring"></div>
              <div class="spinner-ring"></div>
            </div>
            <p>加载中...</p>
          </div>
          <div v-else-if="historyData.length > 0" class="chart-wrapper">
            <div class="chart-summary">
              <span class="summary-label">{{ periodOptions.find(p => p.value === selectedPeriod)?.label }}涨跌幅</span>
              <span class="summary-value" :class="totalChange >= 0 ? 'positive' : 'negative'">
                {{ totalChange >= 0 ? '+' : '' }}{{ totalChange.toFixed(2) }}%
              </span>
            </div>
            <div ref="historyChartRef" class="trend-chart"></div>
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
          <div v-else class="chart-empty">
            <div class="empty-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M3 3v18h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M7 16l4-4 4 4 5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <p>暂无业绩走势数据</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import * as echarts from 'echarts'
import { fundApi } from '@/api/fund'
import { useFundStore } from '@/stores/fund'
import { useEstimateCache } from '@/composables/useEstimateCache'
import type { FundDetail } from '@/types'

const route = useRoute()
const router = useRouter()
const store = useFundStore()
const { getEstimateCache, setEstimateCache, getCacheInfo } = useEstimateCache()

const fund = ref<FundDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const isFavorite = computed(() => fund.value ? store.isFavorite(fund.value.code) : false)

const growthClass = computed(() => {
  if (!fund.value) return {}
  return {
    positive: fund.value.dayGrowth > 0,
    negative: fund.value.dayGrowth < 0,
    neutral: fund.value.dayGrowth === 0
  }
})

const growthText = computed(() => {
  if (!fund.value) return '0.00%'
  const prefix = fund.value.dayGrowth > 0 ? '+' : ''
  return `${prefix}${fund.value.dayGrowth.toFixed(2)}%`
})

const estimateData = ref<Array<{ time: string; value: number; percent: number }>>([])
const estimateLoading = ref(false)
const estimateChartRef = ref<HTMLDivElement | null>(null)
let estimateChartInstance: echarts.ECharts | null = null
const estimateCacheInfo = ref<{ date: string; dataCount: number } | null>(null)

const historyData = ref<Array<{ date: string; nav: number; accNav: number; growth: number }>>([])
const historyLoading = ref(false)
const historyChartRef = ref<HTMLDivElement | null>(null)
let historyChartInstance: echarts.ECharts | null = null

const selectedPeriod = ref('1')
const periodOptions = [
  { label: '近1月', value: '1' },
  { label: '近3月', value: '3' },
  { label: '近6月', value: '6' },
  { label: '近1年', value: '12' },
  { label: '近3年', value: '36' }
]

const estimateChange = computed(() => {
  if (estimateData.value.length === 0) return 0
  return estimateData.value[estimateData.value.length - 1].percent
})

const totalChange = computed(() => {
  if (historyData.value.length < 2) return 0
  const first = historyData.value[0].nav
  const last = historyData.value[historyData.value.length - 1].nav
  return ((last - first) / first) * 100
})

async function fetchDetail() {
  const code = route.params.code as string
  loading.value = true
  error.value = null
  
  try {
    fund.value = await fundApi.getDetail(code)
    if (!fund.value) {
      error.value = '未找到该基金信息'
    }
  } catch (e) {
    error.value = '获取基金详情失败'
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function fetchEstimateData() {
  if (!fund.value) return
  estimateLoading.value = true
  
  try {
    const { data: response } = await axios.get(`/api/fund/estimate/${fund.value.code}`)
    
    let actualData = response
    let isHistoryData = false
    let historyDate = ''
    
    if (response && typeof response === 'object' && 'data' in response) {
      actualData = response.data
      isHistoryData = response.isHistory || false
      historyDate = response.date || ''
    }
    
    if (actualData && actualData.length > 0) {
      estimateData.value = actualData
      setEstimateCache(fund.value.code, actualData)
      if (isHistoryData && historyDate) {
        estimateCacheInfo.value = { date: historyDate, dataCount: actualData.length }
      } else {
        estimateCacheInfo.value = getCacheInfo(fund.value.code)
      }
      await nextTick()
      setTimeout(() => drawEstimateChart(), 100)
    } else {
      const cached = getEstimateCache(fund.value.code)
      if (cached && cached.length > 0) {
        estimateData.value = cached
        estimateCacheInfo.value = getCacheInfo(fund.value.code)
        await nextTick()
        setTimeout(() => drawEstimateChart(), 100)
      } else {
        estimateData.value = []
      }
    }
  } catch (error) {
    console.error('获取实时估值失败:', error)
    const cached = getEstimateCache(fund.value.code)
    if (cached) {
      estimateData.value = cached
      estimateCacheInfo.value = getCacheInfo(fund.value.code)
      await nextTick()
      setTimeout(() => drawEstimateChart(), 100)
    }
  } finally {
    estimateLoading.value = false
  }
}

async function fetchHistoryData() {
  if (!fund.value) return
  historyLoading.value = true
  
  try {
    const { data } = await axios.get(`/api/fund/history/${fund.value.code}`, {
      params: { period: selectedPeriod.value }
    })
    historyData.value = data
    if (data.length > 0) {
      await nextTick()
      setTimeout(() => drawHistoryChart(), 100)
    }
  } catch (error) {
    console.error('获取历史净值失败:', error)
    historyData.value = []
  } finally {
    historyLoading.value = false
  }
}

function changePeriod(period: string) {
  selectedPeriod.value = period
  fetchHistoryData()
}

function drawEstimateChart() {
  if (!estimateChartRef.value || estimateData.value.length === 0) return
  
  if (estimateChartInstance) {
    estimateChartInstance.dispose()
    estimateChartInstance = null
  }
  
  estimateChartInstance = echarts.init(estimateChartRef.value)
  
  const data = estimateData.value.filter(d => {
    const mins = parseInt(d.time.split(':')[0]) * 60 + parseInt(d.time.split(':')[1])
    return !(mins >= 12 * 60 + 5 && mins <= 12 * 60 + 55)
  })
  const lineColor = estimateChange.value >= 0 ? '#f87171' : '#4ade80'
  
  const option: echarts.EChartsOption = {
    animation: false,
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: data.map(d => d.time),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#64748b',
        fontSize: 11,
        interval: Math.floor(data.length / 5)
      }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)', type: 'dashed' } },
      axisLabel: {
        color: '#64748b',
        fontSize: 11,
        formatter: (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
      }
    },
    series: [{
      type: 'line',
      data: data.map(d => d.percent),
      smooth: true,
      symbol: 'none',
      lineStyle: { color: lineColor, width: 2 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: `${lineColor}40` },
          { offset: 1, color: `${lineColor}00` }
        ])
      }
    }],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#f8fafc', fontSize: 12 },
      formatter: (params: any) => {
        const idx = params[0].dataIndex
        const d = data[idx]
        return `${d.time}<br/>估算净值: ${d.value.toFixed(4)}<br/>涨跌幅: ${d.percent >= 0 ? '+' : ''}${d.percent.toFixed(2)}%`
      }
    }
  }
  
  estimateChartInstance.setOption(option)
  estimateChartInstance.resize()
}

function drawHistoryChart() {
  if (!historyChartRef.value || historyData.value.length < 2) return
  
  if (historyChartInstance) {
    historyChartInstance.dispose()
    historyChartInstance = null
  }
  
  historyChartInstance = echarts.init(historyChartRef.value)
  
  const data = historyData.value
  const firstNav = data[0].nav
  const growthData = data.map(d => ((d.nav - firstNav) / firstNav) * 100)
  const lineColor = totalChange.value >= 0 ? '#f87171' : '#4ade80'
  const currentYear = new Date().getFullYear().toString()
  
  const option: echarts.EChartsOption = {
    animation: false,
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: data.map(d => d.date),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#64748b',
        fontSize: 11,
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
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)', type: 'dashed' } },
      axisLabel: {
        color: '#64748b',
        fontSize: 11,
        formatter: (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
      }
    },
    series: [{
      type: 'line',
      data: growthData,
      smooth: false,
      symbol: 'none',
      lineStyle: { color: lineColor, width: 2 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: `${lineColor}40` },
          { offset: 1, color: `${lineColor}00` }
        ])
      }
    }],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#f8fafc', fontSize: 12 },
      formatter: (params: any) => {
        const idx = params[0].dataIndex
        const d = data[idx]
        const accGrowth = growthData[idx]
        return `${d.date}<br/>净值: ${d.nav.toFixed(4)}<br/>日涨跌: ${d.growth >= 0 ? '+' : ''}${d.growth}%<br/>累计: ${accGrowth >= 0 ? '+' : ''}${accGrowth.toFixed(2)}%`
      }
    }
  }
  
  historyChartInstance.setOption(option)
  historyChartInstance.resize()
}

function goBack() {
  router.push('/')
}

function toggleFavorite() {
  if (!fund.value) return
  
  if (isFavorite.value) {
    const isHeldFund = store.isHeld(fund.value.code)
    const message = isHeldFund 
      ? '该基金当前为持仓状态，删除后将同时清除持仓信息！\n\n确定要从自选中移除这只基金吗？'
      : '确定要从自选中移除这只基金吗？'
    if (confirm(message)) {
      store.removeFavorite(fund.value.code)
    }
  } else {
    store.addFavorite(fund.value.code, fund.value.name)
  }
}

onMounted(async () => {
  await fetchDetail()
  if (fund.value) {
    fetchEstimateData()
    fetchHistoryData()
  }
})

onUnmounted(() => {
  if (estimateChartInstance) {
    estimateChartInstance.dispose()
    estimateChartInstance = null
  }
  if (historyChartInstance) {
    historyChartInstance.dispose()
    historyChartInstance = null
  }
})
</script>

<style scoped>
.fund-detail {
  min-height: 100vh;
  background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
  padding: 24px;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
  padding: 40px 20px;
}

.loading-spinner {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
}

.spinner-ring {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(234, 179, 8, 0.3);
  border-top-color: #eab308;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner-ring:nth-child(2) {
  animation-delay: 0.15s;
}

.spinner-ring:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.loading-state p {
  color: #94a3b8;
  font-size: 15px;
  margin: 0;
}

.error-icon {
  width: 64px;
  height: 64px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f87171;
  margin-bottom: 16px;
}

.error-icon svg {
  width: 32px;
  height: 32px;
}

.error-title {
  font-size: 18px;
  font-weight: 600;
  color: #f8fafc;
  margin: 0 0 8px 0;
}

.error-text {
  font-size: 14px;
  color: #94a3b8;
  margin: 0 0 24px 0;
}

.retry-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #eab308 0%, #ca8a04 100%);
  color: #0f172a;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(234, 179, 8, 0.25);
}

.retry-btn svg {
  width: 18px;
  height: 18px;
}

.retry-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(234, 179, 8, 0.35);
}

.detail-content {
  max-width: 1000px;
  margin: 0 auto;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  color: #94a3b8;
  transition: all 0.3s ease;
}

.back-btn svg {
  width: 18px;
  height: 18px;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #f8fafc;
}

.header-info {
  flex: 1;
  min-width: 0;
}

.fund-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: #f8fafc;
}

.fund-code {
  font-size: 13px;
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.08);
  padding: 4px 12px;
  border-radius: 6px;
}

.favorite-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  color: #94a3b8;
  transition: all 0.3s ease;
}

.favorite-btn svg {
  width: 18px;
  height: 18px;
}

.favorite-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #f8fafc;
}

.favorite-btn.active {
  background: rgba(234, 179, 8, 0.1);
  border-color: rgba(234, 179, 8, 0.3);
  color: #eab308;
}

.favorite-btn.active:hover {
  background: rgba(234, 179, 8, 0.15);
}

.main-info {
  margin-bottom: 32px;
}

.nav-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.nav-card {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 24px;
  border-radius: 16px;
  transition: all 0.3s ease;
}

.nav-card:hover {
  border-color: rgba(255, 255, 255, 0.15);
}

.nav-card.highlight {
  border-color: rgba(234, 179, 8, 0.3);
  background: linear-gradient(135deg, rgba(234, 179, 8, 0.08) 0%, rgba(234, 179, 8, 0.02) 100%);
}

.nav-label {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 12px;
  font-weight: 500;
}

.nav-value {
  font-size: 28px;
  font-weight: 700;
  color: #f8fafc;
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-value svg {
  width: 24px;
  height: 24px;
}

.nav-value.positive {
  color: #f87171;
}

.nav-value.negative {
  color: #4ade80;
}

.info-section {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.section-icon {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, rgba(234, 179, 8, 0.2) 0%, rgba(234, 179, 8, 0.1) 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #eab308;
}

.section-icon svg {
  width: 18px;
  height: 18px;
}

.info-section h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #f8fafc;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-item.full-width {
  grid-column: 1 / -1;
}

.info-label {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
}

.info-value {
  font-size: 15px;
  color: #e2e8f0;
  font-weight: 500;
}

.chart-container {
  position: relative;
  min-height: 280px;
}

.chart-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  gap: 16px;
}

.chart-loading .loading-spinner {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

.chart-loading p {
  color: #94a3b8;
  font-size: 14px;
  margin: 0;
}

.chart-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chart-summary {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 4px;
}

.summary-label {
  font-size: 12px;
  color: #64748b;
}

.summary-value {
  font-size: 14px;
  font-weight: 600;
  font-family: 'SF Mono', Consolas, monospace;
}

.summary-value.positive {
  color: #f87171;
}

.summary-value.negative {
  color: #4ade80;
}

.trend-chart {
  width: 100%;
  height: 250px;
}

.chart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  padding: 40px 20px;
  text-align: center;
}

.empty-icon {
  width: 64px;
  height: 64px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  color: #475569;
}

.empty-icon svg {
  width: 32px;
  height: 32px;
}

.chart-empty p {
  color: #94a3b8;
  font-size: 14px;
  margin: 0 0 8px 0;
}

.chart-empty .hint {
  font-size: 12px;
  color: #475569;
}

.period-tabs {
  display: flex;
  justify-content: center;
  gap: 8px;
  padding-top: 12px;
}

.period-btn {
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  color: #94a3b8;
  transition: all 0.2s ease;
}

.period-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #f8fafc;
}

.period-btn.active {
  background: rgba(234, 179, 8, 0.15);
  border-color: rgba(234, 179, 8, 0.3);
  color: #eab308;
}

.cache-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  padding: 4px 10px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 6px;
  font-size: 11px;
  color: #60a5fa;
}

.cache-icon {
  width: 14px;
  height: 14px;
}

@media (max-width: 768px) {
  .fund-detail {
    padding: 16px;
  }

  .detail-header {
    flex-wrap: wrap;
    gap: 16px;
  }

  .back-btn span {
    display: none;
  }

  .favorite-btn span {
    display: none;
  }

  .fund-title {
    font-size: 22px;
  }

  .nav-value {
    font-size: 24px;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
