<template>
  <view class="page">
    <view class="detail-header">
      <view class="header-bg"></view>
      <view class="header-content">
        <text class="detail-name">{{ fund?.name || '加载中...' }}</text>
        <text class="detail-code">{{ fund?.code || '' }}</text>
      </view>
    </view>

    <view v-if="fund" class="detail-body">
      <view class="nav-section">
        <view class="nav-card">
          <text class="nav-label">最新净值</text>
          <text class="nav-value">{{ fund.nav?.toFixed(4) || '--' }}</text>
          <text class="nav-date">{{ fund.jzrq || fund.lastUpdate || '' }}</text>
        </view>
        <view class="nav-card">
          <text class="nav-label">估算净值</text>
          <text class="nav-value">{{ fund.gsz?.toFixed(4) || '--' }}</text>
          <text class="nav-date">{{ fund.gztime || '' }}</text>
        </view>
      </view>

      <view class="growth-section">
        <view class="growth-card">
          <text class="growth-label">当日涨跌</text>
          <text :class="['growth-value', (fund.dayGrowth ?? 0) >= 0 ? 'profit-up' : 'profit-down']">
            {{ formatGrowth(fund.dayGrowth) }}
          </text>
        </view>
        <view class="growth-card">
          <text class="growth-label">估值涨跌</text>
          <text :class="['growth-value', (fund.gszzl ?? 0) >= 0 ? 'profit-up' : 'profit-down']">
            {{ formatGrowth(fund.gszzl) }}
          </text>
        </view>
      </view>

      <view class="section-block">
        <view class="section-title-row">
          <view class="section-dot"></view>
          <text class="section-title">业绩走势</text>
        </view>
        <view class="period-tabs">
          <view
            v-for="p in periodOptions"
            :key="p.value"
            :class="['period-tab', { active: selectedPeriod === p.value }]"
            @tap="changePeriod(p.value)"
          >
            <text class="period-text">{{ p.label }}</text>
          </view>
        </view>
        <view v-if="historyLoading" class="chart-loading">
          <view class="loading-spinner">
            <view class="spinner-dot" v-for="i in 3" :key="i"></view>
          </view>
          <text class="chart-loading-text">加载中...</text>
        </view>
        <view v-else-if="historyData.length > 1" class="chart-wrap">
          <view class="chart-summary">
            <text class="summary-label">{{ periodOptions.find(p => p.value === selectedPeriod)?.label }}涨跌幅</text>
            <text :class="['summary-value', totalChange >= 0 ? 'profit-up' : 'profit-down']">
              {{ totalChange >= 0 ? '+' : '' }}{{ totalChange.toFixed(2) }}%
            </text>
          </view>
          <canvas :id="'historyChart'" canvas-id="historyChart" class="chart-canvas" @touchstart="onChartTouch" @touchmove="onChartTouch" @touchend="onChartTouchEnd"></canvas>
          <view v-if="tooltip.show" class="chart-tooltip" :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }">
            <text class="tooltip-date">{{ tooltip.date }}</text>
            <text class="tooltip-nav">净值: {{ tooltip.nav }}</text>
            <text :class="['tooltip-growth', tooltip.growth >= 0 ? 'profit-up' : 'profit-down']">
              {{ tooltip.growth >= 0 ? '+' : '' }}{{ tooltip.growth }}%
            </text>
          </view>
        </view>
        <view v-else class="chart-empty">
          <text class="empty-text">暂无业绩数据</text>
        </view>
      </view>

      <view v-if="holding" class="section-block">
        <view class="section-title-row">
          <view class="section-dot green"></view>
          <text class="section-title">持仓信息</text>
        </view>
        <view class="holding-grid">
          <view class="holding-field">
            <text class="field-label">持仓金额</text>
            <text class="field-value">{{ '¥' + (holding.amount || 0).toFixed(2) }}</text>
          </view>
          <view class="holding-field">
            <text class="field-label">总成本</text>
            <text class="field-value">{{ holding.totalCost ? '¥' + holding.totalCost.toFixed(2) : '--' }}</text>
          </view>
          <view class="holding-field">
            <text class="field-label">累计收益</text>
            <text :class="['field-value', holding.accumulatedProfit != null && holding.accumulatedProfit >= 0 ? 'profit-up' : 'profit-down']">
              {{ holding.accumulatedProfit != null ? (holding.accumulatedProfit >= 0 ? '+' : '') + '¥' + holding.accumulatedProfit.toFixed(2) : '--' }}
            </text>
          </view>
          <view class="holding-field">
            <text class="field-label">收益率</text>
            <text :class="['field-value', holdingProfitRate >= 0 ? 'profit-up' : 'profit-down']">
              {{ holdingProfitRate >= 0 ? '+' : '' }}{{ holdingProfitRate.toFixed(2) }}%
            </text>
          </view>
        </view>
      </view>

      <view class="actions">
        <view class="btn btn-primary" @tap="editHolding">
          <text>{{ holding ? '编辑持仓' : '设置持仓' }}</text>
        </view>
        <view class="btn btn-danger" @tap="confirmDelete">
          <text>删除基金</text>
        </view>
      </view>

      <view class="bottom-safe"></view>
    </view>

    <view v-else class="loading-page">
      <view class="loading-spinner">
        <view class="spinner-dot" v-for="i in 3" :key="i"></view>
      </view>
      <text class="loading-text">加载中...</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useFundStore } from '@/stores/fund'
import { get } from '@/utils/request'
import type { Fund } from '@/api/fund'
import type { Holding } from '@/api/user'

const store = useFundStore()
const fundCode = ref('')
const fund = ref<Fund | null>(null)
const holding = ref<Holding | null>(null)

const historyData = ref<Array<{ date: string; nav: number; growth: number }>>([])
const historyLoading = ref(false)
const selectedPeriod = ref('1')

const periodOptions = [
  { label: '近1月', value: '1' },
  { label: '近3月', value: '3' },
  { label: '近6月', value: '6' },
  { label: '近1年', value: '12' },
]

const tooltip = ref<{ show: boolean; x: number; y: number; date: string; nav: string; growth: string }>({
  show: false, x: 0, y: 0, date: '', nav: '', growth: ''
})

const totalChange = computed(() => {
  if (historyData.value.length < 2) return 0
  const first = historyData.value[0].nav
  const last = historyData.value[historyData.value.length - 1].nav
  return ((last - first) / first) * 100
})

const holdingProfitRate = computed(() => {
  if (!holding.value) return 0
  const h = holding.value
  if (h.totalCost && h.totalCost > 0 && h.accumulatedProfit != null) {
    return (h.accumulatedProfit / h.totalCost) * 100
  }
  return 0
})

function formatGrowth(val: number | undefined): string {
  if (val == null) return '--'
  return (val >= 0 ? '+' : '') + val.toFixed(2) + '%'
}

onLoad((options) => {
  if (options?.code) fundCode.value = options.code
})

onMounted(() => {
  const f = store.favoriteFunds.find(f => f.code === fundCode.value)
  if (f) fund.value = f
  holding.value = store.getHolding(fundCode.value) || null
  fetchHistory()
})

async function fetchHistory() {
  historyLoading.value = true
  try {
    const data: any = await get('/api/fund/history/' + fundCode.value, { period: selectedPeriod.value })
    historyData.value = Array.isArray(data) ? data : []
    if (historyData.value.length > 1) {
      await nextTick()
      setTimeout(() => drawChart(), 100)
    }
  } catch {
    historyData.value = []
  } finally {
    historyLoading.value = false
  }
}

function changePeriod(period: string) {
  selectedPeriod.value = period
  fetchHistory()
}

function drawChart() {
  const data = historyData.value
  if (data.length < 2) return

  const query = uni.createSelectorQuery()
  query.select('.chart-canvas').boundingCanvas()
  query.exec((res) => {
    if (!res || !res[0]) return
    const canvas = res[0] as any
    if (!canvas) return

    const ctx = uni.createCanvasContext('historyChart')
    const dpr = uni.getSystemInfoSync().pixelRatio || 2
    const width = canvas.width
    const height = canvas.height

    const padding = { left: 50, right: 20, top: 20, bottom: 30 }
    const chartW = width - padding.left - padding.right
    const chartH = height - padding.top - padding.bottom

    const growthData = data.map(d => {
      const first = data[0].nav
      return first > 0 ? ((d.nav - first) / first) * 100 : 0
    })

    const minVal = Math.min(...growthData)
    const maxVal = Math.max(...growthData)
    const range = maxVal - minVal || 1
    const yMin = minVal - range * 0.1
    const yMax = maxVal + range * 0.1
    const yRange = yMax - yMin

    ctx.setStrokeStyle(growthData[growthData.length - 1] >= 0 ? '#ef4444' : '#10b981')
    ctx.setLineWidth(2)
    ctx.beginPath()

    const points: { x: number; y: number }[] = []
    for (let i = 0; i < growthData.length; i++) {
      const x = padding.left + (i / (growthData.length - 1)) * chartW
      const y = padding.top + (1 - (growthData[i] - yMin) / yRange) * chartH
      points.push({ x, y })
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH)
    const lineColor = growthData[growthData.length - 1] >= 0 ? '#ef4444' : '#10b981'
    gradient.addColorStop(0, lineColor + '40')
    gradient.addColorStop(1, lineColor + '00')
    ctx.setFillStyle(gradient)
    ctx.beginPath()
    ctx.moveTo(points[0].x, padding.top + chartH)
    for (const p of points) {
      ctx.lineTo(p.x, p.y)
    }
    ctx.lineTo(points[points.length - 1].x, padding.top + chartH)
    ctx.closePath()
    ctx.fill()

    ctx.setFontSize(9)
    ctx.setFillStyle('#94a3b8')
    const labelCount = 5
    for (let i = 0; i <= labelCount; i++) {
      const val = yMin + (yRange * i / labelCount)
      const y = padding.top + (1 - i / labelCount) * chartH
      ctx.fillText((val >= 0 ? '+' : '') + val.toFixed(1) + '%', 2, y + 3)
    }

    const xLabelInterval = Math.max(1, Math.floor(data.length / 5))
    for (let i = 0; i < data.length; i += xLabelInterval) {
      const x = padding.left + (i / (growthData.length - 1)) * chartW
      const label = data[i].date.slice(5)
      ctx.fillText(label, x - 15, padding.top + chartH + 18)
    }

    ctx.draw()
  })
}

function onChartTouch(e: any) {
  const touch = e.touches?.[0]
  if (!touch || historyData.value.length < 2) return

  const query = uni.createSelectorQuery()
  query.select('.chart-canvas').boundingClientRect()
  query.exec((res) => {
    if (!res || !res[0]) return
    const rect = res[0] as any
    const x = touch.clientX - rect.left
    const padding = { left: 50, right: 20 }
    const chartW = rect.width - padding.left - padding.right
    const ratio = (x - padding.left) / chartW
    const idx = Math.round(ratio * (historyData.value.length - 1))
    if (idx < 0 || idx >= historyData.value.length) return

    const d = historyData.value[idx]
    const first = historyData.value[0].nav
    const growth = first > 0 ? ((d.nav - first) / first) * 100 : 0

    tooltip.value = {
      show: true,
      x: Math.min(touch.clientX - rect.left, rect.width - 140),
      y: Math.max(touch.clientY - rect.top - 80, 0),
      date: d.date,
      nav: d.nav.toFixed(4),
      growth: growth.toFixed(2)
    }
  })
}

function onChartTouchEnd() {
  tooltip.value.show = false
}

function editHolding() {
  const name = fund.value?.name || fundCode.value
  uni.navigateTo({ url: `/pages/holdings/edit?code=${fundCode.value}&name=${encodeURIComponent(name)}` })
}

function confirmDelete() {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除 ${fund.value?.name || fundCode.value} 吗？`,
    success: async (res) => {
      if (res.confirm) {
        await store.removeFavorite(fundCode.value)
        uni.navigateBack()
      }
    }
  })
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f6fa;
}

.detail-header {
  position: relative;
  padding: 0 32rpx 40rpx;
}

.header-bg {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  border-radius: 0 0 32rpx 32rpx;
}

.header-content {
  position: relative;
  padding-top: calc(var(--status-bar-height, 0px) + 40rpx);
  display: flex;
  flex-direction: column;
}

.detail-name {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: #fff;
  margin-bottom: 8rpx;
}

.detail-code {
  display: block;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.7);
}

.detail-body {
  padding: 0 24rpx;
  margin-top: -16rpx;
}

.nav-section {
  display: flex;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.nav-card {
  flex: 1;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.nav-label {
  display: block;
  font-size: 22rpx;
  color: #94a3b8;
  margin-bottom: 12rpx;
  font-weight: 500;
}

.nav-value {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: #0f172a;
  font-family: 'SF Mono', Consolas, monospace;
}

.nav-date {
  display: block;
  font-size: 20rpx;
  color: #b0b8c9;
  margin-top: 8rpx;
}

.growth-section {
  display: flex;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.growth-card {
  flex: 1;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.growth-label {
  display: block;
  font-size: 22rpx;
  color: #94a3b8;
  margin-bottom: 12rpx;
  font-weight: 500;
}

.growth-value {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  font-family: 'SF Mono', Consolas, monospace;
}

.profit-up { color: #ef4444; }
.profit-down { color: #10b981; }

.section-block {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.section-title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 24rpx;
}

.section-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: #4f46e5;
}

.section-dot.green {
  background: #10b981;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #111827;
}

.period-tabs {
  display: flex;
  gap: 12rpx;
  margin-bottom: 24rpx;
}

.period-tab {
  padding: 10rpx 24rpx;
  background: #f1f5f9;
  border-radius: 20rpx;
}

.period-tab.active {
  background: #4f46e5;
}

.period-text {
  font-size: 24rpx;
  color: #64748b;
  font-weight: 500;
}

.period-tab.active .period-text {
  color: #fff;
}

.chart-wrap {
  position: relative;
}

.chart-summary {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.summary-label {
  font-size: 22rpx;
  color: #94a3b8;
}

.summary-value {
  font-size: 26rpx;
  font-weight: 700;
  font-family: 'SF Mono', Consolas, monospace;
}

.chart-canvas {
  width: 100%;
  height: 400rpx;
}

.chart-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 0;
}

.loading-spinner {
  display: flex;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.spinner-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: #4f46e5;
  animation: bounce 1.4s infinite ease-in-out both;
}

.spinner-dot:nth-child(1) { animation-delay: -0.32s; }
.spinner-dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.chart-loading-text {
  font-size: 24rpx;
  color: #94a3b8;
}

.chart-empty {
  padding: 40rpx 0;
  text-align: center;
}

.empty-text {
  font-size: 26rpx;
  color: #94a3b8;
}

.chart-tooltip {
  position: absolute;
  background: rgba(15, 23, 42, 0.92);
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  z-index: 10;
  pointer-events: none;
}

.tooltip-date {
  font-size: 20rpx;
  color: #94a3b8;
}

.tooltip-nav {
  font-size: 22rpx;
  color: #e2e8f0;
  font-family: 'SF Mono', Consolas, monospace;
}

.tooltip-growth {
  font-size: 22rpx;
  font-weight: 600;
  font-family: 'SF Mono', Consolas, monospace;
}

.holding-grid {
  display: flex;
  flex-wrap: wrap;
}

.holding-field {
  width: 50%;
  padding: 12rpx 0;
}

.field-label {
  display: block;
  font-size: 22rpx;
  color: #94a3b8;
  margin-bottom: 6rpx;
}

.field-value {
  font-size: 28rpx;
  font-weight: 600;
  color: #111827;
  font-family: 'SF Mono', Consolas, monospace;
}

.actions {
  display: flex;
  gap: 16rpx;
  margin-top: 8rpx;
}

.btn {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  border-radius: 14rpx;
  font-size: 28rpx;
  font-weight: 600;
}

.btn-primary {
  background: #4f46e5;
  color: #fff;
}

.btn-danger {
  background: #fef2f2;
  color: #dc2626;
}

.loading-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 200rpx 0;
}

.loading-text {
  font-size: 28rpx;
  color: #94a3b8;
  margin-top: 16rpx;
}

.bottom-safe {
  height: 120rpx;
}
</style>
