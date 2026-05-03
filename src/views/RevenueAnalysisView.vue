<template>
  <div class="revenue-page">
    <header class="header">
      <div class="header-content">
        <div class="brand">
          <button class="back-btn" @click="$router.push('/')">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <h1 class="title">收益分析</h1>
        </div>
        <div v-if="authStore.isLoggedIn" class="header-user">
          <div class="header-avatar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="7" r="4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <span class="header-username">{{ authStore.username || authStore.email }}</span>
        </div>
      </div>
    </header>

    <div v-if="!authStore.isLoggedIn" class="container">
      <div class="login-prompt">
        <div class="login-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="12" cy="7" r="4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h2 class="login-title">需要登录后查看</h2>
        <p class="login-desc">注册登录后即可查看持仓收益分析数据</p>
        <button class="login-btn" @click="$router.push('/')">返回首页登录</button>
      </div>
    </div>

    <div v-else class="container">
      <div class="summary-cards">
        <div class="summary-card card-profit">
          <div class="card-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="card-body">
            <span class="card-label">当日总收益</span>
            <span class="card-value" :class="todayProfitClass">
              {{ todayProfit >= 0 ? '+' : '' }}¥{{ todayProfit.toFixed(2) }}
            </span>
          </div>
        </div>
        <div class="summary-card card-holding card-clickable" @click="openHoldingPie">
          <div class="card-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="card-body">
            <span class="card-label">持仓总额</span>
            <span class="card-value">¥{{ totalHoldingAmount.toFixed(2) }}</span>
          </div>
        </div>
        <div class="summary-card card-accumulated">
          <div class="card-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M3 17L9 11L13 15L21 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M17 7H21V11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="card-body">
            <span class="card-label">
              累计收益
              <span v-if="!isLoggedIn" class="temp-badge">临时</span>
            </span>
            <span class="card-value" :class="accumulatedProfitClass">
              {{ accumulatedProfit >= 0 ? '+' : '' }}¥{{ accumulatedProfit.toFixed(2) }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="!initialLoading" class="timeshare-section">
        <div class="timeshare-header">
          <h3 class="timeshare-title">收益走势</h3>
          <div class="timeshare-legend-row">
            <div v-if="selectedTrendPeriod === 'today'" class="timeshare-legend">
              <span class="legend-item">
                <span class="legend-line legend-holding"></span>
                持仓收益率
                <span v-if="latestHoldingPercent !== 0" class="legend-value" :class="latestHoldingPercent >= 0 ? 'up' : 'down'">
                  {{ latestHoldingPercent >= 0 ? '+' : '' }}{{ latestHoldingPercent.toFixed(2) }}%
                </span>
              </span>
              <span class="legend-item">
                <span class="legend-line legend-index"></span>
                上证指数
                <span v-if="latestIndexPercent !== 0" class="legend-value" :class="latestIndexPercent >= 0 ? 'up' : 'down'">
                  {{ latestIndexPercent >= 0 ? '+' : '' }}{{ latestIndexPercent.toFixed(2) }}%
                </span>
              </span>
            </div>
            <div v-else class="timeshare-legend">
              <span class="legend-item">
                <span class="legend-line" style="background: #6366F1;"></span>
                累计收益
              </span>
            </div>
            <div class="timeshare-meta-row">
              <span v-if="selectedTrendPeriod === 'today' && timeshareDateInfo" class="timeshare-date-info">
                {{ timeshareDateInfo }}
              </span>
              <span v-if="selectedTrendPeriod === 'today' && (holdingIsHistory || indexIsHistory)" class="timeshare-history-badge">分时数据</span>
              <span v-if="selectedTrendPeriod !== 'today'" class="timeshare-date-info">{{ trendPeriodLabel }}累计收益走势</span>
            </div>
          </div>
        </div>
        <div class="timeshare-chart" ref="timeshareChartRef"></div>
        <div v-if="selectedTrendPeriod === 'today' && timeshareHasData" class="timeshare-footer" :class="currentFooterClass">
          <div class="footer-item">
            <span class="footer-label">持仓收益率</span>
            <span class="footer-value" :class="latestHoldingPercent >= 0 ? 'up' : 'down'">
              {{ latestHoldingPercent >= 0 ? '+' : '' }}{{ latestHoldingPercent.toFixed(2) }}%
            </span>
          </div>
          <div class="footer-item">
            <span class="footer-label">超额收益</span>
            <span class="footer-value" :class="currentExcessReturn >= 0 ? 'up' : 'down'">
              {{ currentExcessReturn >= 0 ? '+' : '' }}{{ currentExcessReturn.toFixed(2) }}%
            </span>
          </div>
        </div>
        <div v-else-if="selectedTrendPeriod !== 'today' && profitTrendData.length > 0" class="timeshare-footer" :class="trendTotalProfit >= 0 ? 'footer-up' : 'footer-down'">
          <div class="footer-item">
            <span class="footer-label">{{ trendPeriodLabel }}累计收益</span>
            <span class="footer-value" :class="trendTotalProfit >= 0 ? 'up' : 'down'">
              {{ trendTotalProfit >= 0 ? '+' : '' }}¥{{ trendTotalProfit.toFixed(2) }}
            </span>
          </div>
          <div class="footer-item">
            <span class="footer-label">交易天数</span>
            <span class="footer-value" style="color: #374151;">
              {{ profitTrendData.length }}
            </span>
          </div>
        </div>
        <div v-if="timeshareLoading || profitTrendLoading" class="timeshare-loading">
          <div class="spinner"></div>
          <p>{{ profitTrendLoading ? '加载收益数据...' : '加载分时数据...' }}</p>
        </div>
        <div v-else-if="selectedTrendPeriod === 'today' && !timeshareHasData" class="timeshare-empty">
          <p>{{ timeshareMessage || '暂无分时数据' }}</p>
        </div>
        <div v-else-if="selectedTrendPeriod !== 'today' && profitTrendData.length === 0" class="timeshare-empty">
          <p>暂无收益数据</p>
        </div>
        <div class="timeshare-period-bar">
          <button
            v-for="p in trendPeriodOptions"
            :key="p.value"
            :class="['trend-period-btn', { active: selectedTrendPeriod === p.value }]"
            @click="switchTrendPeriod(p.value)"
          >{{ p.label }}</button>
        </div>
      </div>

      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>加载中...</p>
      </div>

      <template v-else>
        <div class="main-section">
          <h3 class="timeshare-title" style="margin-bottom: 12px;">收益日历</h3>
          <div class="section-toolbar">
            <div class="period-tabs">
              <button
                v-for="p in periodOptions"
                :key="p.value"
                :class="['period-btn', { active: selectedPeriod === p.value }]"
                @click="selectedPeriod = p.value"
              >
                {{ p.label }}
              </button>
            </div>
            <div class="nav-group">
              <button class="nav-btn" @click="prevMonth">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <span class="calendar-title">{{ calendarTitle }}</span>
              <button class="nav-btn" @click="nextMonth" :disabled="isCurrentMonth">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="calendar-month-summary">
            <span class="month-summary-label">{{ selectedPeriod === 'day' ? '本月合计' : '当前合计' }}</span>
            <span class="month-summary-value" :class="getValueClass(summaryProfit)">
              {{ summaryProfit >= 0 ? '+' : '' }}¥{{ summaryProfit.toFixed(2) }}
            </span>
            <span class="month-summary-count">{{ summaryDays }}个交易日</span>
          </div>

          <div v-if="selectedPeriod === 'day'">
            <div class="weekday-header">
              <span v-for="d in weekdays" :key="d" class="weekday-label">{{ d }}</span>
            </div>
            <div class="calendar-body">
              <div
                v-for="(cell, idx) in calendarCells"
                :key="idx"
                :class="[
                  'calendar-cell',
                  {
                    'calendar-empty': cell.isEmpty,
                    'has-profit': !cell.isEmpty && cell.profit !== null && cell.profit !== 0,
                    'profit-up': !cell.isEmpty && cell.profit !== null && cell.profit > 0,
                    'profit-down': !cell.isEmpty && cell.profit !== null && cell.profit < 0,
                    'today': !cell.isEmpty && cell.isToday,
                    'calendar-selected': !cell.isEmpty && selectedCalendarKey === cell.date
                  }
                ]"
                @click="!cell.isEmpty && cell.profit !== null ? selectCalendarItem(cell.date) : undefined"
                @mouseenter="cell.isEmpty ? null : hoveredCell = cell"
                @mouseleave="cell.isEmpty ? null : hoveredCell = null"
              >
                <template v-if="!cell.isEmpty">
                  <span class="cell-day">{{ cell.day }}</span>
                  <span v-if="cell.isHoliday" class="cell-holiday">休</span>
                  <span v-else-if="cell.profit !== null && cell.profit !== 0" class="cell-profit" :class="getValueClass(cell.profit)">
                    {{ cell.profit > 0 ? '+' : '' }}{{ cell.profit.toFixed(2) }}
                  </span>
                  <span v-else-if="cell.profit === 0" class="cell-profit zero">0</span>
                </template>
              </div>
            </div>

            <div class="cell-tooltip-wrapper">
              <div v-if="hoveredCell && hoveredCell.profit !== null" class="cell-tooltip" :class="{ 'tooltip-up': hoveredCell.profit > 0, 'tooltip-down': hoveredCell.profit < 0 }">
                <span class="tooltip-date">{{ hoveredCell.date }}</span>
                <span class="tooltip-profit" :class="getValueClass(hoveredCell.profit)">
                  {{ hoveredCell.profit >= 0 ? '+' : '' }}¥{{ hoveredCell.profit.toFixed(2) }}
                </span>
                <span v-if="hoveredCell.rate !== null" class="tooltip-rate" :class="getValueClass(hoveredCell.rate)">
                  {{ hoveredCell.rate >= 0 ? '+' : '' }}{{ hoveredCell.rate.toFixed(2) }}%
                </span>
              </div>
            </div>
          </div>

          <div v-else-if="selectedPeriod === 'month' && groupedData.length > 0" class="month-grid">
              <div
                v-for="group in groupedData"
                :key="group.key"
                class="month-card"
                :class="{
                  'card-up': group.totalProfit > 0,
                  'card-down': group.totalProfit < 0,
                  'card-selected': selectedCalendarKey === group.key
                }"
                @click="selectCalendarItem(group.key)"
              >
              <span class="month-card-title">{{ group.label }}</span>
              <span class="month-card-profit" :class="getValueClass(group.totalProfit)">
                {{ group.totalProfit >= 0 ? '+' : '' }}¥{{ group.totalProfit.toFixed(2) }}
              </span>
              <div class="month-card-footer">
                <span class="month-card-rate" :class="getValueClass(group.totalProfitRate)">
                  {{ group.totalProfitRate >= 0 ? '+' : '' }}{{ group.totalProfitRate.toFixed(2) }}%
                </span>
                <span class="month-card-count">{{ group.count }}笔</span>
              </div>
            </div>
          </div>

          <div v-else-if="selectedPeriod === 'year' && groupedData.length > 0" class="year-grid">
              <div
                v-for="group in groupedData"
                :key="group.key"
                class="year-card"
                :class="{
                  'card-up': group.totalProfit > 0,
                  'card-down': group.totalProfit < 0,
                  'card-selected': selectedCalendarKey === group.key
                }"
                @click="selectCalendarItem(group.key)"
              >
              <span class="year-card-title">{{ group.label }}</span>
              <span class="year-card-profit" :class="getValueClass(group.totalProfit)">
                {{ group.totalProfit >= 0 ? '+' : '' }}¥{{ group.totalProfit.toFixed(2) }}
              </span>
              <div class="year-card-footer">
                <span class="year-card-rate" :class="getValueClass(group.totalProfitRate)">
                  {{ group.totalProfitRate >= 0 ? '+' : '' }}{{ group.totalProfitRate.toFixed(2) }}%
                </span>
                <span class="year-card-count">{{ group.count }}笔</span>
              </div>
            </div>
          </div>

          <div v-else class="empty-inline">
            <p>暂无收益数据</p>
          </div>

          <div v-if="selectedCalendarKey && detailFunds.length > 0" class="detail-section">
            <div class="detail-header">
              <div class="detail-title-row">
                <h4 class="detail-title">{{ selectedCalendarLabel }} 基金收益明细</h4>
                <span class="detail-total" :class="getValueClass(detailTotalProfit)">
                  {{ detailTotalProfit >= 0 ? '+' : '' }}¥{{ detailTotalProfit.toFixed(2) }}
                </span>
              </div>
              <div class="detail-tabs">
                <button
                  :class="['detail-tab', { active: detailSortBy === 'profit' }]"
                  @click="detailSortBy = 'profit'"
                >
                  <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                    <path d="M3 17L9 11L13 15L21 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  收益金额
                </button>
                <button class="detail-tab disabled" disabled>
                  <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                    <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  持仓比例
                  <span class="tab-badge">待开发</span>
                </button>
              </div>
            </div>
            <div class="detail-list">
              <div class="detail-list-header">
                <span class="detail-col-code">基金码</span>
                <span class="detail-col-name">基金名称</span>
                <span class="detail-col-profit">收益金额</span>
              </div>
              <div
                v-for="fund in detailFunds"
                :key="fund.fundCode"
                class="detail-row"
              >
                <span class="detail-fund-code">{{ fund.fundCode }}</span>
                <span class="detail-fund-name" :title="fund.fundName">{{ fund.fundName }}</span>
                <div class="detail-fund-profit-wrap">
                  <span class="detail-fund-profit" :class="getValueClass(fund.totalProfit)">
                    {{ fund.totalProfit >= 0 ? '+' : '' }}{{ fund.totalProfit.toFixed(2) }}
                  </span>
                  <div class="profit-bar-bg">
                    <div
                      class="profit-bar"
                      :class="fund.totalProfit >= 0 ? 'bar-up' : 'bar-down'"
                      :style="{ width: getProfitBarWidth(fund.totalProfit) + '%' }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <div v-if="showHoldingPie" class="pie-modal-overlay" @click.self="closeHoldingPie">
      <div class="pie-modal" @click.stop>
        <div class="pie-modal-header">
          <h3 class="pie-modal-title">持仓比例</h3>
          <div class="pie-modal-total">
            <span class="pie-total-label">持仓总额</span>
            <span class="pie-total-value">¥{{ totalHoldingAmount.toFixed(2) }}</span>
          </div>
          <button class="pie-modal-close" @click="closeHoldingPie">&times;</button>
        </div>
        <div class="pie-chart-container" ref="pieChartRef"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import * as echarts from 'echarts'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { useFundStore } from '@/stores/fund'

const authStore = useAuthStore()
const fundStore = useFundStore()

const loading = ref(true)
const initialLoading = ref(true)
const showHoldingPie = ref(false)
const pieChartRef = ref<HTMLDivElement | null>(null)
let pieChartInstance: echarts.ECharts | null = null
const totalHoldingAmount = computed(() => {
  return fundStore.sortedFavorites.reduce((total, fund) => {
    const holding = fundStore.holdings.getHolding(fund.code)
    return total + (holding ? holding.amount : 0)
  }, 0)
})
const accumulatedProfit = ref(0)
const selectedPeriod = ref('day')
const viewYear = ref(new Date().getFullYear())
const viewMonth = ref(new Date().getMonth())
const hoveredCell = ref<CalendarCell | null>(null)
const selectedCalendarKey = ref<string | null>(null)
const detailSortBy = ref<'profit' | 'holding'>('profit')

const weekdays = ['一', '二', '三', '四', '五']

const periodOptions = [
  { label: '按日', value: 'day' },
  { label: '按月', value: 'month' },
  { label: '按年', value: 'year' }
]

interface ProfitRecord {
  profitDate: string
  fundCode: string
  fundName: string
  dayProfit: number
  dayProfitRate: number
  openingAmount: number
  closingAmount: number
}

interface GroupedData {
  key: string
  label: string
  totalProfit: number
  totalProfitRate: number
  count: number
}

interface FundDetail {
  fundCode: string
  fundName: string
  totalProfit: number
}

interface CalendarCell {
  isEmpty?: boolean
  day: number
  date: string
  isToday: boolean
  profit: number | null
  rate: number | null
  isHoliday?: boolean
}

interface TimesharePoint {
  time: string
  percent: number
}

const timeshareChartRef = ref<HTMLDivElement | null>(null)
let chartInstance: echarts.ECharts | null = null
let timeshareRequestId = 0
let dataRequestId = 0
const timeshareLoading = ref(false)
const timeshareHasData = ref(false)
const timeshareMessage = ref('')
const hoveredTimePoint = ref<{ time: string; holdingPercent: number | null; indexPercent: number | null } | null>(null)

const holdingTimeshare = ref<TimesharePoint[]>([])
const indexTimeshare = ref<TimesharePoint[]>([])

const holdingDate = ref('')
const indexDate = ref('')
const holdingIsHistory = ref(false)
const indexIsHistory = ref(false)

const selectedTrendPeriod = ref('today')
const trendPeriodOptions = [
  { label: '当天', value: 'today' },
  { label: '本月', value: 'month' },
  { label: '今年', value: 'year' },
  { label: '全部', value: 'all' }
]

interface ProfitTrendItem {
  date: string
  totalProfit: number
}
const profitTrendData = ref<ProfitTrendItem[]>([])
const profitTrendLoading = ref(false)

const trendTotalProfit = computed(() => {
  return Math.round(profitTrendData.value.reduce((sum, d) => sum + d.totalProfit, 0) * 100) / 100
})

const trendPeriodLabel = computed(() => {
  switch (selectedTrendPeriod.value) {
    case 'today': return '当天'
    case 'month': return '本月'
    case 'year': return '今年'
    case 'all': return '全部'
    default: return '当日'
  }
})

const tradingTimePoints = [
  '09:30', '09:35', '09:40', '09:45', '09:50', '09:55',
  '10:00', '10:05', '10:10', '10:15', '10:20', '10:25', '10:30', '10:35', '10:40', '10:45', '10:50', '10:55',
  '11:00', '11:05', '11:10', '11:15', '11:20', '11:25', '11:30',
  '13:00', '13:05', '13:10', '13:15', '13:20', '13:25', '13:30', '13:35', '13:40', '13:45', '13:50', '13:55',
  '14:00', '14:05', '14:10', '14:15', '14:20', '14:25', '14:30', '14:35', '14:40', '14:45', '14:50', '14:55', '15:00',
  '15:05', '15:10', '15:15', '15:20', '15:25', '15:30', '15:35', '15:40', '15:45', '15:50', '15:55', '16:00'
]

function getCurrentTimeStr(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function getCurrentTimeIndex(): number {
  const currentTime = getCurrentTimeStr()
  let idx = -1
  for (let i = 0; i < tradingTimePoints.length; i++) {
    if (tradingTimePoints[i] <= currentTime) {
      idx = i
    } else {
      break
    }
  }
  return idx
}

const isHistoryTimeshare = computed(() => holdingIsHistory.value || indexIsHistory.value)

function filterToCurrentTime(data: TimesharePoint[]): TimesharePoint[] {
  if (isHistoryTimeshare.value) return data
  const idx = getCurrentTimeIndex()
  if (idx < 0) return []
  const cutoffTime = tradingTimePoints[idx]
  return data.filter(p => p.time <= cutoffTime)
}

const todayStr = new Date().toLocaleDateString('sv-SE')
const tradingDayStr = computed(() => fundStore.tradingDay || todayStr)

const holdingTimeshareVisible = computed(() => {
  if (holdingTimeshare.value.length === 0) return []
  return filterToCurrentTime(holdingTimeshare.value)
})
const indexTimeshareVisible = computed(() => {
  if (indexTimeshare.value.length === 0) return []
  return filterToCurrentTime(indexTimeshare.value)
})

const latestHoldingPercent = computed(() => {
  const visible = holdingTimeshareVisible.value
  if (visible.length === 0) {
    if (holdingTimeshare.value.length === 0) return 0
    return holdingTimeshare.value[holdingTimeshare.value.length - 1].percent
  }
  return visible[visible.length - 1].percent
})

const latestIndexPercent = computed(() => {
  const visible = indexTimeshareVisible.value
  if (visible.length === 0) {
    if (indexTimeshare.value.length === 0) return 0
    return indexTimeshare.value[indexTimeshare.value.length - 1].percent
  }
  return visible[visible.length - 1].percent
})

const currentExcessReturn = computed(() => {
  return latestHoldingPercent.value - latestIndexPercent.value
})

const currentFooterClass = computed(() => {
  if (latestHoldingPercent.value > 0) return 'footer-up'
  if (latestHoldingPercent.value < 0) return 'footer-down'
  return ''
})

const timeshareDateInfo = computed(() => {
  const date = indexDate.value || holdingDate.value
  if (!date) return ''
  const isHistory = holdingIsHistory.value || indexIsHistory.value
  const prefix = isHistory ? '交易日 ' : ''
  return `${prefix}${date}`
})

const profitHistory = ref<ProfitRecord[]>([])
const todayIsTradingDay = ref(true)

const dailyProfitMap = computed(() => {
  const map = new Map<string, { profit: number; rate: number }>()
  for (const r of profitHistory.value) {
    if (r.profitDate === todayStr) continue
    const existing = map.get(r.profitDate)
    if (existing) {
      existing.profit += r.dayProfit
      existing.rate = (existing.rate + r.dayProfitRate) / 2
    } else {
      map.set(r.profitDate, { profit: r.dayProfit, rate: r.dayProfitRate })
    }
  }

  const sameMonth = tradingDayStr.value.substring(0, 7) === todayStr.substring(0, 7)
  if (tradingDayStr.value !== todayStr && sameMonth && profitHistory.value.length > 0) {
    const historyForToday = profitHistory.value
      .filter(r => r.profitDate === tradingDayStr.value)
    if (historyForToday.length > 0) {
      const profit = historyForToday.reduce((s, r) => s + r.dayProfit, 0)
      const rate = historyForToday.reduce((s, r) => s + r.dayProfitRate, 0) / historyForToday.length
      map.set(todayStr, { profit, rate })
    }
  } else if (tradingDayStr.value === todayStr) {
    const realtime = todayProfit.value
    if (realtime !== 0) {
      map.set(todayStr, { profit: realtime, rate: 0 })
    }
  }

  return map
})

/**
 * 计算临时用户的累计收益
 *
 * 公式：Σ((当前净值 - 成本价) * 份额)
 */
function calculateTempTotalProfit(): number {
  return fundStore.sortedFavorites.reduce((total, fund) => {
    const holding = fundStore.holdings.getHolding(fund.code)
    if (!holding || !holding.share || !holding.cost || !fund.nav) return total

    const profit = (fund.nav - holding.cost) * holding.share
    return total + profit
  }, 0)
}

const todayProfit = computed(() => {
  const settledDate = tradingDayStr.value

  if (settledDate !== todayStr && profitHistory.value.length > 0) {
    const historyProfit = profitHistory.value
      .filter(r => r.profitDate === settledDate)
      .reduce((sum, r) => sum + r.dayProfit, 0)
    if (historyProfit !== 0) return historyProfit
  }

  return fundStore.sortedFavorites.reduce((total, fund) => {
    const holding = fundStore.holdings.getHolding(fund.code)
    if (!holding || holding.amount <= 0) return total

    if (holding.settled && holding.currentDayProfit != null && holding.lastSettledDate === settledDate) {
      return total + holding.currentDayProfit
    }

    if (holding.currentDayProfit != null && holding.lastSettledDate === settledDate) {
      return total + holding.currentDayProfit
    }

    const jzrq = fund.jzrq || ''
    const gztime = fund.gztime ? fund.gztime.slice(0, 10) : ''

    let growth: number | null = null

    if (jzrq === settledDate && fund.dayGrowth != null) {
      growth = fund.dayGrowth
    } else if (gztime === settledDate && fund.gszzl != null) {
      growth = fund.gszzl
    }

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

    if (holding.lastSettledDate && holding.currentDayProfit != null) {
      return total + holding.currentDayProfit
    }

    return total
  }, 0)
})

const todayProfitClass = computed(() => {
  if (todayProfit.value > 0) return 'value-up'
  if (todayProfit.value < 0) return 'value-down'
  return ''
})

const accumulatedProfitClass = computed(() => {
  if (accumulatedProfit.value > 0) return 'value-up'
  if (accumulatedProfit.value < 0) return 'value-down'
  return ''
})

const isLoggedIn = computed(() => {
  // 通过 userStore 或其他方式判断用户是否登录
  // 这里暂时使用 localStorage 判断（临时客户使用 localStorage）
  const useDatabase = fundStore.useDatabase
  return useDatabase === true
})

const calendarTitle = computed(() => `${viewYear.value}年${viewMonth.value + 1}月`)

const isCurrentMonth = computed(() => {
  const now = new Date()
  return viewYear.value === now.getFullYear() && viewMonth.value === now.getMonth()
})

function prevMonth() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11
    viewYear.value--
  } else {
    viewMonth.value--
  }
}

function nextMonth() {
  if (viewMonth.value === 11) {
    viewMonth.value = 0
    viewYear.value++
  } else {
    viewMonth.value++
  }
}

function formatDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const monthTotalProfit = computed(() => {
  const prefix = `${viewYear.value}-${String(viewMonth.value + 1).padStart(2, '0')}`
  let total = 0
  for (const [date, data] of dailyProfitMap.value) {
    if (date.startsWith(prefix)) total += data.profit
  }
  return Math.round(total * 100) / 100
})

const monthTradingDays = computed(() => {
  const prefix = `${viewYear.value}-${String(viewMonth.value + 1).padStart(2, '0')}`
  let count = 0
  for (const date of dailyProfitMap.value.keys()) {
    if (date.startsWith(prefix)) count++
  }
  return count
})

const summaryProfit = computed(() => {
  if (selectedPeriod.value === 'day') return monthTotalProfit.value
  return groupedData.value.reduce((sum, g) => sum + g.totalProfit, 0)
})

const summaryDays = computed(() => {
  if (selectedPeriod.value === 'day') return monthTradingDays.value
  return groupedData.value.length
})

const calendarCells = computed<CalendarCell[]>(() => {
  const y = viewYear.value
  const m = viewMonth.value
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const cells: CalendarCell[] = []

  const firstDayDow = new Date(y, m, 1).getDay()
  let leadingCells = 0
  if (firstDayDow >= 1 && firstDayDow <= 5) {
    leadingCells = firstDayDow - 1
  }
  for (let i = 0; i < leadingCells; i++) {
    cells.push({ isEmpty: true, day: 0, date: '', isToday: false, profit: null, rate: null })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = formatDateStr(y, m, d)
    const dow = new Date(y, m, d).getDay()
    if (dow === 0 || dow === 6) continue
    const profitData = dailyProfitMap.value.get(date)
    const cellIsHoliday = date === todayStr && !todayIsTradingDay.value
    cells.push({
      day: d,
      date,
      isToday: date === todayStr,
      profit: cellIsHoliday ? null : (profitData ? Math.round(profitData.profit * 100) / 100 : null),
      rate: profitData ? Math.round(profitData.rate * 100) / 100 : null,
      isHoliday: cellIsHoliday
    })
  }

  const remainder = cells.length % 5
  if (remainder > 0) {
    for (let i = 0; i < 5 - remainder; i++) {
      cells.push({ isEmpty: true, day: 0, date: '', isToday: false, profit: null, rate: null })
    }
  }

  return cells
})

function getGroupKey(dateStr: string, period: string): string {
  const d = new Date(dateStr)
  switch (period) {
    case 'day': return dateStr
    case 'month': return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    case 'year': return `${d.getFullYear()}`
    default: return dateStr
  }
}

function formatGroupLabel(key: string, period: string): string {
  switch (period) {
    case 'day': return key
    case 'month': return key + '月'
    case 'year': return key + '年'
    default: return key
  }
}

const groupedData = computed<GroupedData[]>(() => {
  const period = selectedPeriod.value
  const groups = new Map<string, { profit: number; rate: number; count: number }>()
  for (const record of profitHistory.value) {
    const key = getGroupKey(record.profitDate, period)
    const existing = groups.get(key) || { profit: 0, rate: 0, count: 0 }
    existing.profit += record.dayProfit
    existing.rate += record.dayProfitRate
    existing.count += 1
    groups.set(key, existing)
  }
  const result: GroupedData[] = []
  for (const [key, data] of groups) {
    const avgRate = data.count > 0 ? data.rate / data.count : 0
    result.push({
      key,
      label: formatGroupLabel(key, period),
      totalProfit: Math.round(data.profit * 100) / 100,
      totalProfitRate: Math.round(avgRate * 100) / 100,
      count: data.count
    })
  }
  result.sort((a, b) => b.label.localeCompare(a.label))
  return result
})

function getValueClass(value: number | null): string {
  if (value === null || value === 0) return ''
  return value > 0 ? 'up' : 'down'
}

const selectedCalendarLabel = computed(() => {
  const key = selectedCalendarKey.value
  if (!key) return ''
  if (selectedPeriod.value === 'day') return key
  if (selectedPeriod.value === 'month') return key + '月'
  return key + '年'
})

const detailFunds = computed<FundDetail[]>(() => {
  const key = selectedCalendarKey.value
  if (!key) return []

  const period = selectedPeriod.value
  const fundMap = new Map<string, FundDetail>()

  for (const record of profitHistory.value) {
    const match = period === 'day'
      ? record.profitDate === key
      : record.profitDate.startsWith(key)

    if (!match) continue

    const existing = fundMap.get(record.fundCode)
    if (existing) {
      existing.totalProfit += record.dayProfit
    } else {
      fundMap.set(record.fundCode, {
        fundCode: record.fundCode,
        fundName: record.fundName,
        totalProfit: record.dayProfit
      })
    }
  }

  return Array.from(fundMap.values())
    .map(f => ({ ...f, totalProfit: Math.round(f.totalProfit * 100) / 100 }))
    .sort((a, b) => b.totalProfit - a.totalProfit)
})

const detailTotalProfit = computed(() => {
  return detailFunds.value.reduce((sum, f) => sum + f.totalProfit, 0)
})

function getProfitBarWidth(profit: number): number {
  const maxProfit = Math.max(...detailFunds.value.map(f => Math.abs(f.totalProfit)), 0)
  if (maxProfit === 0) return 0
  return Math.min((Math.abs(profit) / maxProfit) * 100, 100)
}

function selectCalendarItem(key: string) {
  if (selectedCalendarKey.value === key) {
    selectedCalendarKey.value = null
  } else {
    selectedCalendarKey.value = key
  }
}

const holdingPieData = computed(() => {
  const items: { name: string; value: number }[] = []
  for (const fund of fundStore.sortedFavorites) {
    const holding = fundStore.holdings.getHolding(fund.code)
    if (holding && holding.amount > 0) {
      items.push({ name: fund.name, value: Math.round(holding.amount * 100) / 100 })
    }
  }
  items.sort((a, b) => b.value - a.value)

  const total = items.reduce((sum, item) => sum + item.value, 0)
  if (total === 0) return items

  const result: { name: string; value: number }[] = []
  let otherValue = 0
  const maxCount = 20

  for (let i = 0; i < items.length; i++) {
    if (i < maxCount) {
      result.push(items[i])
    } else {
      otherValue += items[i].value
    }
  }

  if (otherValue > 0) {
    result.push({ name: '其他', value: Math.round(otherValue * 100) / 100 })
  }
  return result
})

const pieColors = [
  '#6366F1', '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#06B6D4',
  '#9CA3AF'
]

function drawPieChart() {
  const container = pieChartRef.value
  if (!container) return

  if (pieChartInstance) {
    try {
      if (!container.contains(pieChartInstance.getDom())) {
        pieChartInstance.dispose()
        pieChartInstance = null
      }
    } catch {
      pieChartInstance?.dispose()
      pieChartInstance = null
    }
  }

  if (!pieChartInstance) {
    pieChartInstance = echarts.init(container)
  }

  const data = holdingPieData.value
  const total = data.reduce((sum, d) => sum + d.value, 0)

  pieChartInstance.setOption({
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(17, 24, 39, 0.92)',
      borderColor: 'transparent',
      borderWidth: 0,
      padding: [10, 14],
      textStyle: { color: '#fff', fontSize: 13 },
      formatter: (params: any) => {
        const pct = total > 0 ? ((params.value / total) * 100).toFixed(2) : '0.00'
        return `<div style="font-weight:600;margin-bottom:4px">${params.name}</div>
                <div style="display:flex;justify-content:space-between;gap:20px">
                  <span style="color:#9CA3AF">金额</span>
                  <span style="font-family:'SF Mono',Consolas,monospace;font-weight:600">¥${params.value.toFixed(2)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;gap:20px">
                  <span style="color:#9CA3AF">占比</span>
                  <span style="font-weight:600">${pct}%</span>
                </div>`
      }
    },
    series: [{
      type: 'pie',
      radius: ['42%', '72%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 6,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: {
        show: true,
        formatter: (params: any) => {
          const pct = total > 0 ? ((params.value / total) * 100).toFixed(1) : '0.0'
          return `${params.name}\n${pct}%`
        },
        fontSize: 12,
        color: '#374151',
        lineHeight: 18
      },
      labelLine: {
        length: 12,
        length2: 16,
        lineStyle: { color: '#D1D5DB', width: 1 }
      },
      emphasis: {
        label: { fontSize: 14, fontWeight: 'bold' },
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.15)' }
      },
      data: data,
      color: pieColors
    }]
  }, true)
}

function openHoldingPie() {
  if (totalHoldingAmount.value <= 0) return
  showHoldingPie.value = true
  nextTick(() => drawPieChart())
}

function closeHoldingPie() {
  showHoldingPie.value = false
  if (pieChartInstance) {
    pieChartInstance.dispose()
    pieChartInstance = null
  }
}

async function fetchData() {
  const rid = ++dataRequestId
  loading.value = true
  try {
    const { data } = await axios.get('/api/holdings/profit-analysis')
    if (rid !== dataRequestId) return
    if (data.loggedIn) {
      profitHistory.value = data.history || []
      todayIsTradingDay.value = data.todayIsTradingDay !== false
      accumulatedProfit.value = profitHistory.value.reduce((sum, r) => sum + r.dayProfit, 0)
    } else {
      // 临时用户：前端计算累计收益（简化版，只显示累计收益，不显示历史）
      accumulatedProfit.value = calculateTempTotalProfit()
    }
  } catch (error) {
    if (rid !== dataRequestId) return
    console.error('获取收益分析数据失败:', error)
  } finally {
    if (rid === dataRequestId) {
      loading.value = false
    }
  }
}

async function fetchTimeshareData() {
  const rid = ++timeshareRequestId
  timeshareLoading.value = true

  try {
    const [holdingRes, indexRes] = await Promise.all([
      axios.get('/api/holdings/timeshare'),
      axios.get('/api/index/timeshare/000001')
    ])

    if (rid !== timeshareRequestId) return

    if (holdingRes.data.loggedIn && holdingRes.data.hasData) {
      holdingTimeshare.value = holdingRes.data.timeshare || []
      if (holdingRes.data.date) {
        holdingDate.value = holdingRes.data.date
      }
      holdingIsHistory.value = !!holdingRes.data.isHistory
    } else if (holdingRes.data.loggedIn) {
      holdingTimeshare.value = []
      holdingDate.value = ''
      holdingIsHistory.value = false
    }

    if (indexRes.data.success && indexRes.data.data) {
      indexTimeshare.value = indexRes.data.data || []
      if (indexRes.data.date) {
        indexDate.value = indexRes.data.date
      }
      indexIsHistory.value = !!indexRes.data.isHistory
    } else {
      indexTimeshare.value = []
      indexDate.value = ''
      indexIsHistory.value = false
    }

    if (holdingTimeshare.value.length > 0 || indexTimeshare.value.length > 0) {
      timeshareHasData.value = true
      timeshareMessage.value = ''
    } else {
      timeshareHasData.value = false
      timeshareMessage.value = holdingRes.data.message || '暂无分时数据'
    }
  } catch {
    if (rid !== timeshareRequestId) return
    if (!timeshareHasData.value) {
      timeshareMessage.value = '获取分时数据失败'
    }
  } finally {
    if (rid === timeshareRequestId) {
      timeshareLoading.value = false
    }
  }
}

async function fetchProfitTrend(period: string) {
  const rid = ++timeshareRequestId
  profitTrendLoading.value = true

  try {
    const { data } = await axios.get('/api/holdings/daily-profit/profit-trend', {
      params: { period }
    })
    if (rid !== timeshareRequestId) return

    if (data.loggedIn && data.hasData) {
      profitTrendData.value = data.data || []
    } else {
      profitTrendData.value = []
    }
  } catch {
    if (rid !== timeshareRequestId) return
    profitTrendData.value = []
  } finally {
    if (rid === timeshareRequestId) {
      profitTrendLoading.value = false
    }
  }
}

async function switchTrendPeriod(period: string) {
  if (selectedTrendPeriod.value === period) return
  selectedTrendPeriod.value = period

  if (period === 'today') {
    profitTrendData.value = []
    await fetchTimeshareData()
    await nextTick()
    drawIntradayChart()
  } else {
    await fetchProfitTrend(period)
    await nextTick()
    drawProfitTrendChart()
  }
}

function drawIntradayChart() {
  const container = timeshareChartRef.value
  if (!container) return

  if (chartInstance) {
    try {
      if (!container.contains(chartInstance.getDom())) {
        chartInstance.dispose()
        chartInstance = null
      }
    } catch {
      chartInstance?.dispose()
      chartInstance = null
    }
  }

  if (!chartInstance) {
    chartInstance = echarts.init(container)
    chartInstance.on('updateAxisPointer', (event: any) => {
      const xAxis = event.axesInfo?.[0]
      if (!xAxis) {
        hoveredTimePoint.value = null
        return
      }
      const dataIndex = event.dataIndex
      if (dataIndex == null) {
        hoveredTimePoint.value = null
        return
      }
      const holdingData = holdingTimeshareVisible.value
      const indexData = indexTimeshareVisible.value

      const timeSet = new Set<string>()
      holdingData.forEach(d => timeSet.add(d.time))
      indexData.forEach(d => timeSet.add(d.time))
      const allTimes = Array.from(timeSet).sort()

      if (dataIndex >= allTimes.length) {
        hoveredTimePoint.value = null
        return
      }
      const time = allTimes[dataIndex]
      const holdingPoint = holdingData.find(p => p.time === time)
      const indexPoint = indexData.find(p => p.time === time)
      hoveredTimePoint.value = {
        time,
        holdingPercent: holdingPoint ? holdingPoint.percent : null,
        indexPercent: indexPoint ? indexPoint.percent : null
      }
    })
  }

  const allVisible = [...holdingTimeshareVisible.value, ...indexTimeshareVisible.value]
  if (allVisible.length === 0) {
    if (chartInstance) {
      chartInstance.setOption({
        title: { text: '暂无分时数据', left: 'center', top: 'center', textStyle: { color: '#9CA3AF', fontSize: 14, fontWeight: 400 } },
        xAxis: { show: false },
        yAxis: { show: false },
        series: []
      }, true)
    }
    return
  }

  const dataMin = Math.min(...allVisible.map(d => d.percent))
  const dataMax = Math.max(...allVisible.map(d => d.percent))
  let minPercent = dataMin
  let maxPercent = dataMax
  if (minPercent === maxPercent) {
    minPercent -= 1
    maxPercent += 1
  }
  const yRange = maxPercent - minPercent
  const yPadding = yRange * 0.1
  minPercent -= yPadding
  maxPercent += yPadding

  const splitCount = 6
  const interval = Math.ceil((maxPercent - minPercent) / splitCount * 10) / 10
  minPercent = Math.floor(minPercent / interval) * interval
  maxPercent = minPercent + splitCount * interval

  if (maxPercent <= dataMax) maxPercent += interval
  if (minPercent >= dataMin) minPercent -= interval

  const showZeroLine = minPercent < 0 && maxPercent > 0

  const holdingData = holdingTimeshareVisible.value
  const indexData = indexTimeshareVisible.value

  const timeSet = new Set<string>()
  holdingData.forEach(d => timeSet.add(d.time))
  indexData.forEach(d => timeSet.add(d.time))
  const allTimes = Array.from(timeSet).sort()

  if (allTimes.length === 0) return

  const holdingMap = new Map(holdingData.map(d => [d.time, d.percent]))
  const indexMap = new Map(indexData.map(d => [d.time, d.percent]))

  const lastHolding = holdingData.length > 0 ? holdingData[holdingData.length - 1] : null
  const lastIndex = indexData.length > 0 ? indexData[indexData.length - 1] : null

  const option: echarts.EChartsOption = {
    animation: false,
    grid: { left: 50, right: 15, top: 20, bottom: 25 },
    xAxis: {
      type: 'category',
      data: allTimes,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#9CA3AF',
        fontSize: 10,
        interval: Math.ceil(allTimes.length / 6) - 1
      },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      min: minPercent,
      max: maxPercent,
      splitNumber: 6,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#E5E7EB' } },
      axisLabel: {
        color: '#6B7280',
        fontSize: 11,
        formatter: (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
      }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      borderWidth: 0,
      textStyle: { color: '#333', fontSize: 12 },
      formatter: (params: any) => {
        if (!Array.isArray(params)) return ''
        const time = params[0]?.axisValue || ''
        let html = `<div style="font-size:11px;color:#9CA3AF;margin-bottom:4px">${time}</div>`
        for (const p of params) {
          if (p.value == null || isNaN(p.value)) continue
          const color = p.seriesName === '持仓收益率'
            ? (p.value >= 0 ? '#EF4444' : '#10B981')
            : '#3B82F6'
          const sign = p.value >= 0 ? '+' : ''
          html += `<div style="display:flex;justify-content:space-between;gap:16px;font-size:12px;line-height:1.8">
            <span style="color:${color};display:inline-flex;align-items:center"><span style="font-size:8px">●</span>&nbsp;${p.seriesName}</span>
            <span style="color:${color};font-weight:500">${sign}${p.value.toFixed(2)}%</span>
          </div>`
        }
        return html
      }
    },
    series: [
      {
        name: '持仓收益率',
        type: 'line',
        data: allTimes.map(t => holdingMap.get(t) ?? null),
        smooth: false,
        symbol: 'none',
        lineStyle: { color: '#EF4444', width: 1.5 },
        connectNulls: true,
        ...(showZeroLine
          ? { markLine: { silent: true, symbol: 'none', label: { show: false }, data: [{ yAxis: 0 }], lineStyle: { color: '#9CA3AF', width: 1, type: 'dashed' } } }
          : {}),
      },
      {
        name: '上证指数',
        type: 'line',
        data: allTimes.map(t => indexMap.get(t) ?? null),
        smooth: false,
        symbol: 'none',
        lineStyle: { color: '#3B82F6', width: 1.5 },
        connectNulls: true
      },
      {
        name: '持仓终点',
        type: 'line',
        data: lastHolding ? allTimes.map(t => t === lastHolding.time ? lastHolding.percent : null) : [],
        smooth: false,
        symbol: 'circle',
        symbolSize: 4,
        showSymbol: true,
        lineStyle: { width: 0 },
        itemStyle: { color: lastHolding && lastHolding.percent >= 0 ? '#EF4444' : '#10B981' },
        tooltip: { show: false }
      },
      {
        name: '指数终点',
        type: 'line',
        data: lastIndex ? allTimes.map(t => t === lastIndex.time ? lastIndex.percent : null) : [],
        smooth: false,
        symbol: 'circle',
        symbolSize: 4,
        showSymbol: true,
        lineStyle: { width: 0 },
        itemStyle: { color: '#3B82F6' },
        tooltip: { show: false }
      }
    ]
  }

  chartInstance.setOption(option, true)
}

function drawProfitTrendChart() {
  const container = timeshareChartRef.value
  if (!container) return

  if (chartInstance) {
    try {
      if (!container.contains(chartInstance.getDom())) {
        chartInstance.dispose()
        chartInstance = null
      }
    } catch {
      chartInstance?.dispose()
      chartInstance = null
    }
  }

  if (!chartInstance) {
    chartInstance = echarts.init(container)
  }

  const data = profitTrendData.value
  if (data.length === 0) {
    chartInstance.setOption({
      title: {
        text: '暂无收益数据',
        left: 'center',
        top: 'center',
        textStyle: { color: '#9CA3AF', fontSize: 14, fontWeight: 400 }
      },
      xAxis: { show: false },
      yAxis: { show: false },
      series: []
    }, true)
    return
  }

  const dates = data.map(d => {
    const parts = d.date.split('-')
    if (selectedTrendPeriod.value === 'all' || selectedTrendPeriod.value === 'year') return `${parts[1]}-${parts[2]}`
    return `${parts[1]}-${parts[2]}`
  })
  const values = data.map(d => d.totalProfit)
  const lastVal = values[values.length - 1]

  const dataMin = Math.min(...values)
  const dataMax = Math.max(...values)
  let yMin = dataMin
  let yMax = dataMax
  if (yMin === yMax) {
    yMin -= 1
    yMax += 1
  }
  const yRange = yMax - yMin
  const yPadding = yRange * 0.1
  yMin -= yPadding
  yMax += yPadding

  const splitCount = 5
  const rawInterval = (yMax - yMin) / splitCount
  const interval = Math.ceil(rawInterval * 100) / 100
  yMin = Math.floor(yMin / interval) * interval
  yMax = yMin + splitCount * interval

  if (yMax <= dataMax) yMax += interval
  if (yMin >= dataMin) yMin -= interval
  const actualSplitCount = Math.round((yMax - yMin) / interval)

  const showZeroLine = dataMin < 0 && dataMax > 0
  const lineColor = lastVal >= 0 ? '#EF4444' : '#10B981'

  const option: echarts.EChartsOption = {
    animation: false,
    grid: { left: 60, right: 15, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#9CA3AF',
        fontSize: 10,
        interval: data.length <= 6 ? 0 : Math.ceil(data.length / 6) - 1,
        rotate: data.length > 15 ? 45 : 0
      },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      min: yMin,
      max: yMax,
      splitNumber: actualSplitCount,
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
      padding: [8, 12],
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: (params: any) => {
        if (!Array.isArray(params)) return ''
        const idx = params[0]?.dataIndex
        const dateStr = data[idx]?.date || ''
        const val = params[0]?.value
        if (val == null) return ''
        const sign = val >= 0 ? '+' : ''
        const color = val >= 0 ? '#EF4444' : '#10B981'
        return `<div style="font-size:10px;color:#9CA3AF;margin-bottom:4px">${dateStr}</div>
                <div style="font-size:11px;font-weight:600;color:${color}">累计 ${sign}¥${val.toFixed(2)}</div>`
      }
    },
    series: [
      {
        name: '累计收益',
        type: 'line',
        data: values,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: lineColor, width: 1.5 },
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

  chartInstance.setOption(option, true)
}

function handleResize() {
  chartInstance?.resize()
  pieChartInstance?.resize()
}

let refreshTimer: ReturnType<typeof setInterval> | null = null
let dataLoaded = false

function startRefresh() {
  stopRefresh()
  refreshTimer = setInterval(() => {
    if (authStore.isLoggedIn) {
      fetchData()
      if (selectedTrendPeriod.value === 'today') {
        fetchTimeshareData().then(() => drawIntradayChart())
      } else {
        fetchProfitTrend(selectedTrendPeriod.value).then(() => drawProfitTrendChart())
      }
    }
  }, 2 * 60 * 1000)
}

function stopRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

async function loadRevenueData() {
  if (dataLoaded) return
  dataLoaded = true

  loading.value = true
  initialLoading.value = true

  await fundStore.init()
  await Promise.all([fetchData(), fetchTimeshareData()])
  initialLoading.value = false
  await nextTick()
  drawIntradayChart()
  startRefresh()
}

onMounted(async () => {
  if (authStore.isLoggedIn) {
    await loadRevenueData()
  } else {
    loading.value = false
    initialLoading.value = false
  }

  window.addEventListener('resize', handleResize)
})

watch(() => authStore.isLoggedIn, async (newVal) => {
  if (newVal && !dataLoaded) {
    await loadRevenueData()
  }
})

watch(selectedPeriod, () => {
  selectedCalendarKey.value = null
})

watch([viewYear, viewMonth], () => {
  if (selectedPeriod.value === 'day') {
    selectedCalendarKey.value = null
  }
})

onBeforeUnmount(() => {
  stopRefresh()
  window.removeEventListener('resize', handleResize)
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
  if (pieChartInstance) {
    pieChartInstance.dispose()
    pieChartInstance = null
  }
})
</script>

<style scoped>
.revenue-page {
  min-height: 100vh;
  background: #F9FAFB;
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
  align-items: center;
  gap: 12px;
}
.back-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F3F4F6;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  color: #374151;
  transition: all 0.2s;
}
.back-btn:hover { background: #E5E7EB; }
.back-btn svg { width: 18px; height: 18px; }
.title { font-size: 18px; font-weight: 700; color: #111827; margin: 0; }
.header-user {
  display: flex;
  align-items: center;
  gap: 8px;
}
.header-avatar {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6366F1;
}
.header-avatar svg { width: 16px; height: 16px; }
.header-username {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.container { max-width: 1200px; margin: 0 auto; padding: 24px 20px; }
.login-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
}
.login-icon-wrap {
  width: 72px;
  height: 72px;
  background: linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}
.login-icon-wrap svg { width: 36px; height: 36px; color: #6366F1; }
.login-title { font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 8px; }
.login-desc { font-size: 14px; color: #6B7280; margin: 0 0 24px; }
.login-btn {
  padding: 12px 32px;
  background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}
.login-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
}
.summary-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
.summary-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border: 1px solid #F3F4F6;
  transition: all 0.2s;
}
.summary-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}
.summary-card.card-clickable { cursor: pointer; }
.summary-card.card-clickable:active { transform: translateY(0); }
.card-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.card-icon-wrap svg { width: 22px; height: 22px; }
.card-profit .card-icon-wrap { background: linear-gradient(135deg, #FEF3C7, #FDE68A); color: #D97706; }
.card-holding .card-icon-wrap { background: linear-gradient(135deg, #DBEAFE, #BFDBFE); color: #2563EB; }
.card-accumulated .card-icon-wrap { background: linear-gradient(135deg, #D1FAE5, #A7F3D0); color: #059669; }
.card-body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.card-label { font-size: 12px; color: #6B7280; font-weight: 500; }
.card-value { font-size: 20px; font-weight: 700; color: #111827; font-family: 'SF Mono', Consolas, monospace; white-space: nowrap; }
.card-value.value-up { color: #EF4444; }
.card-value.value-down { color: #10B981; }

.timeshare-section {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border: 1px solid #F3F4F6;
}
.timeshare-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 16px;
}
.timeshare-title {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}
.timeshare-legend {
  display: flex;
  gap: 16px;
  align-items: center;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6B7280;
}
.legend-line {
  width: 16px;
  height: 3px;
  border-radius: 2px;
}
.legend-holding { background: #EF4444; }
.legend-index { background: #3B82F6; }
.legend-value { font-size: 12px; font-weight: 600; }
.legend-value.up { color: #EF4444; }
.legend-value.down { color: #10B981; }
.timeshare-legend-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  flex-wrap: wrap;
  gap: 8px;
}
.timeshare-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.timeshare-date-info {
  font-size: 11px;
  color: #9CA3AF;
  font-weight: 600;
}
.timeshare-history-badge {
  display: inline-block;
  padding: 2px 8px;
  background: #FEF3C7;
  color: #D97706;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}
.timeshare-chart {
  position: relative;
  height: 280px;
  background: #FAFAFA;
  border-radius: 8px;
  overflow: hidden;
}
.timeshare-footer {
  display: flex;
  justify-content: space-around;
  padding: 14px 20px;
  margin-top: 16px;
  background: #F9FAFB;
  border-radius: 8px;
}
.timeshare-footer.footer-up { background: #FEF2F2; }
.timeshare-footer.footer-down { background: #ECFDF5; }
.footer-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.footer-label { font-size: 11px; color: #6B7280; font-weight: 500; }
.footer-value { font-size: 15px; font-weight: 700; font-family: 'SF Mono', Consolas, monospace; }
.footer-value.up { color: #EF4444; }
.footer-value.down { color: #10B981; }
.timeshare-loading,
.timeshare-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #9CA3AF;
}
.timeshare-loading .spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #E5E7EB;
  border-top-color: #6366F1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}
.timeshare-loading p,
.timeshare-empty p { font-size: 13px; margin: 0; }

.timeshare-period-bar {
  display: flex;
  justify-content: center;
  gap: 4px;
  margin-top: 16px;
  background: #F3F4F6;
  padding: 3px;
  border-radius: 8px;
  width: fit-content;
  margin-left: auto;
  margin-right: auto;
}
.trend-period-btn {
  padding: 5px 18px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  color: #6B7280;
  background: transparent;
  transition: all 0.2s;
}
.trend-period-btn:hover { background: white; color: #374151; }
.trend-period-btn.active { background: white; color: #111827; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

.main-section {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border: 1px solid #F3F4F6;
}
.section-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 12px;
}
.nav-group { display: flex; align-items: center; gap: 8px; }
.nav-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F3F4F6;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  color: #374151;
  transition: all 0.2s;
}
.nav-btn:hover:not(:disabled) { background: #E5E7EB; }
.nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.nav-btn svg { width: 16px; height: 16px; }
.calendar-title { font-size: 16px; font-weight: 700; color: #111827; }
.period-tabs { display: flex; gap: 4px; background: #F3F4F6; padding: 3px; border-radius: 8px; }
.period-btn {
  padding: 5px 14px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  color: #6B7280;
  background: transparent;
  transition: all 0.2s;
}
.period-btn:hover { background: white; color: #374151; }
.period-btn.active { background: white; color: #111827; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

.calendar-month-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #F9FAFB;
  border-radius: 8px;
  margin-bottom: 14px;
}
.month-summary-label { font-size: 12px; color: #6B7280; font-weight: 500; }
.month-summary-value { font-size: 15px; font-weight: 700; font-family: 'SF Mono', Consolas, monospace; color: #111827; }
.month-summary-value.up { color: #EF4444; }
.month-summary-value.down { color: #10B981; }
.month-summary-count { font-size: 11px; color: #9CA3AF; margin-left: auto; }

.weekday-header { display: grid; grid-template-columns: repeat(5, 1fr); margin-bottom: 4px; }
.weekday-label { text-align: center; font-size: 11px; font-weight: 600; color: #9CA3AF; padding: 6px 0; }
.calendar-body { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
.calendar-cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 56px;
  border-radius: 6px;
  border: 1px solid #F3F4F6;
  cursor: default;
  transition: all 0.15s;
  padding: 4px 2px;
}
.calendar-cell.has-profit { cursor: pointer; }
.calendar-cell.has-profit:hover { transform: scale(1.05); z-index: 2; }
.calendar-cell.profit-up { background: #FEF2F2; }
.calendar-cell.profit-up:hover { background: #FEE2E2; box-shadow: 0 4px 12px rgba(239,68,68,0.2); }
.calendar-cell.profit-down { background: #ECFDF5; }
.calendar-cell.profit-down:hover { background: #D1FAE5; box-shadow: 0 4px 12px rgba(16,185,129,0.2); }
.calendar-cell.today { box-shadow: inset 0 0 0 1px #EF4444; }
.calendar-cell.calendar-empty { border: none; background: transparent; min-height: 0; }
.calendar-cell.calendar-selected { box-shadow: inset 0 0 0 2px #6366F1 !important; z-index: 3; }
.calendar-cell.today.profit-down { box-shadow: inset 0 0 0 1px #10B981; }
.cell-day { font-size: 11px; font-weight: 600; color: #374151; line-height: 1; }
.cell-profit { font-size: 12px; font-weight: 600; font-family: 'SF Mono', Consolas, monospace; line-height: 1.2; margin-top: 3px; }
.cell-profit.up { color: #EF4444; }
.cell-profit.down { color: #10B981; }
.cell-profit.zero { color: #9CA3AF; }
.cell-holiday {
  font-size: 11px;
  font-weight: 600;
  color: #9CA3AF;
  margin-top: 3px;
  line-height: 1.2;
}

.cell-tooltip-wrapper {
  height: 44px;
  margin-top: 10px;
  display: flex;
  align-items: center;
}
.cell-tooltip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: #111827;
  border-radius: 8px;
  font-size: 12px;
  color: white;
  animation: fadeIn 0.15s ease;
}
.cell-tooltip.tooltip-up { background: #EF4444; color: #FFFFFF; }
.cell-tooltip.tooltip-down { background: #10B981; color: #FFFFFF; }
.cell-tooltip .tooltip-date { font-weight: 600; color: rgba(255,255,255,0.85); }
.cell-tooltip .tooltip-profit { font-weight: 700; font-family: 'SF Mono', Consolas, monospace; font-size: 14px; color: #FFFFFF; }
.tooltip-rate { font-family: 'SF Mono', Consolas, monospace; color: rgba(255,255,255,0.6); }
@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }

.loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; }
.spinner { width: 40px; height: 40px; border: 3px solid #E5E7EB; border-top-color: #6366F1; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 16px; }
.loading-state p { font-size: 13px; color: #6B7280; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.empty-inline { text-align: center; padding: 40px 20px; color: #9CA3AF; font-size: 13px; }
.empty-inline p { margin: 0; }

.month-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.month-card {
  background: white;
  border-radius: 10px;
  padding: 16px;
  border: 1px solid #F3F4F6;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: all 0.2s;
  cursor: pointer;
}
.month-card:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.month-card.card-up { border-left: 3px solid #EF4444; }
.month-card.card-down { border-left: 3px solid #10B981; }
.month-card.card-selected { box-shadow: 0 0 0 2px #6366F1 !important; border-color: #6366F1 !important; }
.month-card-title { font-size: 13px; font-weight: 600; color: #374151; }
.month-card-profit { font-size: 17px; font-weight: 700; font-family: 'SF Mono', Consolas, monospace; color: #111827; }
.month-card-profit.up { color: #EF4444; }
.month-card-profit.down { color: #10B981; }
.month-card-footer { display: flex; justify-content: space-between; align-items: center; }
.month-card-rate { font-size: 11px; font-family: 'SF Mono', Consolas, monospace; color: #6B7280; }
.month-card-rate.up { color: #EF4444; }
.month-card-rate.down { color: #10B981; }
.month-card-count { font-size: 10px; color: #9CA3AF; padding: 1px 6px; background: #F3F4F6; border-radius: 8px; }

.year-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
.year-card {
  background: white;
  border-radius: 10px;
  padding: 20px;
  border: 1px solid #F3F4F6;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.2s;
  cursor: pointer;
}
.year-card:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.year-card.card-up { border-left: 3px solid #EF4444; }
.year-card.card-down { border-left: 3px solid #10B981; }
.year-card.card-selected { box-shadow: 0 0 0 2px #6366F1 !important; border-color: #6366F1 !important; }
.year-card-title { font-size: 14px; font-weight: 700; color: #111827; }
.year-card-profit { font-size: 20px; font-weight: 700; font-family: 'SF Mono', Consolas, monospace; color: #111827; }
.year-card-profit.up { color: #EF4444; }
.year-card-profit.down { color: #10B981; }
.year-card-footer { display: flex; justify-content: space-between; align-items: center; }
.year-card-rate { font-size: 12px; font-family: 'SF Mono', Consolas, monospace; color: #6B7280; }
.year-card-rate.up { color: #EF4444; }
.year-card-rate.down { color: #10B981; }
.year-card-count { font-size: 10px; color: #9CA3AF; padding: 1px 6px; background: #F3F4F6; border-radius: 8px; }

.detail-section {
  margin-top: 20px;
  border-top: 1px solid #F3F4F6;
  padding-top: 20px;
  animation: slideUp 0.25s ease;
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.detail-header { margin-bottom: 16px; }
.detail-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.detail-title { font-size: 14px; font-weight: 600; color: #374151; margin: 0; }
.detail-total {
  font-size: 16px;
  font-weight: 700;
  font-family: 'SF Mono', Consolas, monospace;
  color: #111827;
}
.detail-total.up { color: #EF4444; }
.detail-total.down { color: #10B981; }
.detail-tabs { display: flex; gap: 8px; }
.detail-tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  color: #6B7280;
  background: white;
  transition: all 0.2s;
}
.detail-tab:hover:not(.disabled) { border-color: #6366F1; color: #6366F1; }
.detail-tab.active { background: #EEF2FF; border-color: #6366F1; color: #4F46E5; font-weight: 600; }
.detail-tab.disabled { opacity: 0.5; cursor: not-allowed; background: #F9FAFB; }
.tab-badge {
  font-size: 9px;
  padding: 1px 4px;
  background: #FEF3C7;
  color: #D97706;
  border-radius: 3px;
  font-weight: 500;
}
.detail-list {
  background: #F9FAFB;
  border-radius: 10px;
  overflow: hidden;
}
.detail-list-header {
  display: grid;
  grid-template-columns: 80px 1fr 140px;
  padding: 10px 16px;
  font-size: 11px;
  font-weight: 600;
  color: #9CA3AF;
  letter-spacing: 0.5px;
}
.detail-row {
  display: grid;
  grid-template-columns: 80px 1fr 140px;
  padding: 12px 16px;
  align-items: center;
  background: white;
  border-top: 1px solid #F3F4F6;
  transition: background 0.15s;
}
.detail-row:hover { background: #FAFAFA; }
.detail-fund-code {
  font-size: 12px;
  font-family: 'SF Mono', Consolas, monospace;
  color: #9CA3AF;
  font-weight: 500;
}
.detail-fund-name {
  font-size: 13px;
  color: #374151;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 12px;
}
.detail-fund-profit-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
.detail-fund-profit {
  font-size: 14px;
  font-weight: 700;
  font-family: 'SF Mono', Consolas, monospace;
  color: #111827;
}
.detail-fund-profit.up { color: #EF4444; }
.detail-fund-profit.down { color: #10B981; }
.profit-bar-bg {
  width: 80px;
  height: 3px;
  background: #F3F4F6;
  border-radius: 2px;
  overflow: hidden;
}
.profit-bar { height: 100%; border-radius: 2px; transition: width 0.3s ease; }
.profit-bar.bar-up { background: linear-gradient(90deg, #FCA5A5, #EF4444); }
.profit-bar.bar-down { background: linear-gradient(90deg, #6EE7B7, #10B981); }

.pie-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  animation: fadeIn 0.2s ease;
}
.pie-modal {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 520px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 4px 16px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  animation: modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes modalSlideUp {
  from { opacity: 0; transform: translateY(20px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.pie-modal-header {
  display: flex;
  align-items: center;
  padding: 20px 24px 0;
  gap: 12px;
}
.pie-modal-title {
  font-size: 17px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}
.pie-modal-total {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  background: #F0F9FF;
  border-radius: 8px;
}
.pie-total-label { font-size: 11px; color: #6B7280; font-weight: 500; }
.pie-total-value {
  font-size: 14px;
  font-weight: 700;
  font-family: 'SF Mono', Consolas, monospace;
  color: #2563EB;
}
.pie-modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F3F4F6;
  border: none;
  border-radius: 8px;
  font-size: 20px;
  color: #6B7280;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  line-height: 1;
}
.pie-modal-close:hover { background: #E5E7EB; color: #374151; }
.pie-chart-container {
  width: 100%;
  height: 320px;
  padding: 12px;
}

@media (max-width: 768px) {
  .header { padding: 12px 0; }
  .header-content { padding: 0 12px; }
  .brand { gap: 8px; }
  .back-btn { width: 28px; height: 28px; }
  .back-btn svg { width: 16px; height: 16px; }
  .title { font-size: 16px; }
  .header-avatar { width: 26px; height: 26px; }
  .header-avatar svg { width: 14px; height: 14px; }
  .header-username { font-size: 12px; max-width: 80px; }
  .container { padding: 12px; }
  .login-prompt { padding: 48px 16px; }
  .login-icon-wrap { width: 56px; height: 56px; border-radius: 16px; margin-bottom: 16px; }
  .login-icon-wrap svg { width: 28px; height: 28px; }
  .login-title { font-size: 17px; }
  .login-desc { font-size: 13px; margin-bottom: 20px; }
  .login-btn { padding: 10px 28px; font-size: 14px; border-radius: 8px; }
  .summary-cards { display: flex; gap: 8px; margin-bottom: 16px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding-bottom: 2px; }
  .summary-cards::-webkit-scrollbar { display: none; }
  .summary-card { flex: 0 0 auto; min-width: calc(50% - 4px); padding: 12px; gap: 10px; border-radius: 10px; }
  .card-icon-wrap { width: 32px; height: 32px; border-radius: 8px; }
  .card-icon-wrap svg { width: 16px; height: 16px; }
  .card-label { font-size: 10px; display: flex; align-items: center; gap: 4px; }
  .temp-badge {
    font-size: 9px;
    padding: 1px 4px;
    background: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
    border-radius: 3px;
    font-weight: 500;
  }
  .card-value { font-size: 14px; }
  .timeshare-section { padding: 14px; margin-bottom: 16px; }
  .timeshare-header { gap: 10px; margin-bottom: 12px; }
  .timeshare-title { font-size: 14px; }
  .timeshare-legend { gap: 10px; }
  .legend-item { font-size: 11px; }
  .legend-line { width: 12px; height: 2px; }
  .timeshare-date-info { font-size: 10px; }
  .timeshare-history-badge { font-size: 10px; padding: 1px 6px; }
  .timeshare-chart { height: 220px; }
  .timeshare-footer { padding: 10px 14px; margin-top: 12px; }
  .footer-label { font-size: 10px; }
  .footer-value { font-size: 13px; }
  .main-section { padding: 14px; }
  .section-toolbar { margin-bottom: 10px; gap: 8px; flex-wrap: wrap; }
  .nav-btn { width: 28px; height: 28px; }
  .nav-btn svg { width: 14px; height: 14px; }
  .calendar-title { font-size: 14px; }
  .period-tabs { gap: 2px; padding: 2px; }
  .period-btn { padding: 4px 10px; font-size: 11px; }
  .calendar-month-summary { padding: 8px 10px; gap: 8px; margin-bottom: 10px; }
  .month-summary-label { font-size: 11px; }
  .month-summary-value { font-size: 13px; }
  .month-summary-count { font-size: 10px; }
  .weekday-label { font-size: 10px; padding: 4px 0; }
  .calendar-body { gap: 3px; }
  .calendar-cell { min-height: 44px; border-radius: 4px; padding: 3px 1px; }
  .cell-day { font-size: 10px; }
  .cell-profit { font-size: 10px; }
  .cell-tooltip-wrapper { height: 36px; margin-top: 8px; }
  .cell-tooltip { padding: 8px 10px; gap: 8px; font-size: 11px; }
  .tooltip-profit { font-size: 12px; }
  .loading-state { padding: 48px 16px; }
  .spinner { width: 32px; height: 32px; margin-bottom: 12px; }
  .loading-state p { font-size: 12px; }
  .month-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .month-card { padding: 12px; }
  .month-card-profit { font-size: 14px; }
  .year-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .year-card { padding: 14px; }
  .year-card-profit { font-size: 16px; }
  .detail-section { margin-top: 16px; padding-top: 16px; }
  .detail-title { font-size: 13px; }
  .detail-total { font-size: 14px; }
  .detail-tabs { gap: 6px; }
  .detail-tab { padding: 5px 10px; font-size: 11px; }
  .detail-list-header { grid-template-columns: 64px 1fr 110px; padding: 8px 12px; }
  .detail-row { grid-template-columns: 64px 1fr 110px; padding: 10px 12px; }
  .detail-fund-code { font-size: 11px; }
  .detail-fund-name { font-size: 12px; }
  .detail-fund-profit { font-size: 12px; }
  .profit-bar-bg { width: 60px; }
  .pie-modal { max-width: 100%; border-radius: 12px; }
  .pie-modal-header { padding: 16px 16px 0; }
  .pie-modal-title { font-size: 15px; }
  .pie-total-value { font-size: 13px; }
  .pie-chart-container { height: 320px; padding: 8px; }
}
@media (max-width: 380px) {
  .summary-card { min-width: calc(55% - 4px); }
  .card-value { font-size: 13px; }
  .period-btn { padding: 4px 8px; font-size: 11px; }
  .calendar-cell { min-height: 38px; }
  .month-grid { grid-template-columns: 1fr 1fr; }
  .year-grid { grid-template-columns: 1fr; }
}
</style>
