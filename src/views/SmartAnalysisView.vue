<template>
  <div class="page">
    <header class="header">
      <div class="header-inner">
        <div class="brand">
          <button class="back-btn" @click="$router.push('/')">
            <svg viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="logo-dot"></div>
          <h1 class="title">智能分析</h1>
        </div>
        <div class="header-right">
          <div class="usage-pill" :class="{ warn: usage.used >= usage.limit }">
            <span class="usage-dot"></span>
            今日 {{ usage.used }}/{{ usage.limit }} 次
          </div>
          <div v-if="usage.userType === 'guest'" class="upgrade-tag" @click="$router.push('/login')">
            <svg viewBox="0 0 24 24" fill="none"><path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            升级解锁9次
          </div>
        </div>
      </div>
    </header>

    <div class="container">
      <div class="tabs-bar">
        <button class="tab" :class="{ active: activeTab === 'single' }" @click="activeTab = 'single'">
          <svg viewBox="0 0 24 24" fill="none"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          基金分析
        </button>
        <button class="tab" :class="{ active: activeTab === 'compare' }" @click="activeTab = 'compare'">
          <svg viewBox="0 0 24 24" fill="none"><path d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
多基金对比
        </button>
      </div>

      <!-- ====== Single Fund ====== -->
      <template v-if="activeTab === 'single'">
        <div class="card">
          <div class="card-header">
            <span>查询基金</span>
          </div>
          <div class="search-box">
            <svg class="s-icon" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            <input v-model="singleKeyword" placeholder="输入基金代码或名称搜索..." @input="handleSingleSearch" @keydown.enter="handleSingleLookup" class="s-input" />
            <button v-if="singleKeyword && !singleLookupLoading" class="s-lookup-btn" @click="handleSingleLookup" title="精确查询">
              <svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button v-if="singleKeyword" @click="singleKeyword=''; singleResults=[]; singleErrorMsg=''" class="s-clear">
              <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div v-if="singleSearching || singleLookupLoading" class="search-hint"><div class="spinner-xs"></div> 搜索中...</div>
          <div v-else-if="singleResults.length > 0" class="dropdown">
            <div v-for="r in singleResults" :key="r.code" class="dd-item" @click="selectSingleFund(r)">
              <div class="dd-info">
                <span class="dd-name">{{ r.name }}</span>
                <span class="dd-code">{{ r.code }}</span>
                <span class="dd-type">{{ r.type }}</span>
              </div>
              <span class="dd-action" :class="{ picked: singleFund?.code === r.code }">{{ singleFund?.code === r.code ? '已选' : '选择' }}</span>
            </div>
          </div>
          <div v-else-if="singleKeyword && singleSearched && !singleSearching" class="no-result">
            <span>未找到匹配基金，</span>
            <button class="no-result-btn" @click="handleSingleLookup">精确查询「{{ singleKeyword }}」</button>
          </div>
        </div>

        <div v-if="singleFund" class="card fund-info-card">
          <div class="confirm-banner">
            <div class="confirm-info">
              <div class="confirm-main">
                <span class="confirm-name">{{ singleFund.name }}</span>
                <span class="confirm-code">{{ singleFund.code }}</span>
                <span class="confirm-type">{{ singleFund.type }}</span>
              </div>
              <div class="confirm-sub">
                <template v-if="singleChartData">最新净值 {{ singleLatestNav }} | 近1年 {{ singleYearReturn }}</template>
                <template v-else>加载走势数据中...</template>
              </div>
            </div>
          </div>

          <div v-if="singleChartLoading" class="chart-loading">
            <div class="spinner-xs"></div> 加载走势数据...
          </div>
          <div v-else-if="singleChartData" class="single-chart-wrap" ref="singleChartRef"></div>

          <div v-if="singleChartData" class="period-row">
            <span class="period-label">分析周期</span>
            <button v-for="p in periods" :key="p.value" class="period-btn" :class="{ active: singlePeriod === p.value }" @click="singlePeriod = p.value">{{ p.label }}</button>
          </div>
          <div v-if="singleChartData" class="action-row center">
            <button class="ai-btn" :disabled="analyzing || usage.used >= usage.limit" @click="confirmSingleAnalysis">
              <svg v-if="!analyzing" viewBox="0 0 24 24" fill="none" class="btn-svg"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <div v-else class="spinner-xs white"></div>
              {{ analyzing ? 'AI 分析中...' : 'AI 智能分析' }}
            </button>
          </div>
          <div v-if="usage.userType === 'guest' && usage.used >= usage.limit" class="upgrade-banner" @click="$router.push('/login')">
            <svg viewBox="0 0 24 24" fill="none"><path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>今日体验次数已用完，<b>登录后每日可享 9 次分析</b></span>
            <svg viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
        </div>

        <div v-if="singleErrorMsg" class="err-tip">
          <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          {{ singleErrorMsg }}
        </div>

        <div v-if="analysisResult || analyzing" class="card result-card">
          <div class="result-top">
            <div class="result-label">
              <svg viewBox="0 0 24 24" fill="none" class="card-icon"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              分析报告
            </div>
            <button v-if="analysisResult && !analyzing" class="copy-btn" @click="doCopy(analysisResult)">
              <svg viewBox="0 0 24 24" fill="none"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              复制
            </button>
          </div>
          <div class="result-body">
            <div v-if="analyzing && !analysisResult" class="loading-state">
              <div class="dots"><span></span><span></span><span></span></div>
              <p>AI 正在分析...</p>
            </div>
            <div v-else class="md" v-html="renderedResult"></div>
            <div v-if="analyzing && analysisResult" class="cursor-wrap"><span class="cursor"></span></div>
          </div>
        </div>
      </template>

      <!-- ====== Compare ====== -->
      <template v-if="activeTab === 'compare'">
        <div class="card">
          <div class="card-header">
            <svg viewBox="0 0 24 24" fill="none" class="card-icon"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            <span>添加基金</span>
            <span class="card-hint">搜索或批量输入，最多6只</span>
          </div>

          <div class="input-toggle">
            <button class="toggle-btn" :class="{ active: cmpInputMode === 'search' }" @click="cmpInputMode = 'search'">搜索添加</button>
            <button class="toggle-btn" :class="{ active: cmpInputMode === 'batch' }" @click="cmpInputMode = 'batch'">批量输入</button>
          </div>

          <div v-if="cmpInputMode === 'search'" class="search-box">
            <svg class="s-icon" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            <input v-model="cmpKeyword" placeholder="搜索基金代码或名称..." @input="handleCmpSearch" class="s-input" />
            <button v-if="cmpKeyword" @click="cmpKeyword=''; cmpResults=[]" class="s-clear">
              <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div v-else class="batch-area">
            <textarea v-model="batchInput" class="batch-input" placeholder="输入基金代码，支持空格、逗号或换行分隔&#10;例如：000001 000002 000003&#10;或每行一个代码" rows="3"></textarea>
            <button class="batch-btn" :disabled="!batchInput.trim() || batchLoading" @click="handleBatchAdd">
              <div v-if="batchLoading" class="spinner-xs"></div>
              <svg v-else viewBox="0 0 24 24" fill="none" class="btn-svg"><path d="M12 4v16m8-8H4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              添加
            </button>
          </div>

          <div v-if="batchErrors.length > 0" class="batch-errors">
            <div v-for="(e, i) in batchErrors" :key="i" class="batch-err">{{ e }}</div>
          </div>

          <div v-if="cmpSearching" class="search-hint"><div class="spinner-xs"></div> 搜索中...</div>
          <div v-else-if="cmpResults.length > 0" class="dropdown">
            <div v-for="r in cmpResults" :key="r.code" class="dd-item" @click="addCompareFund(r)">
              <div class="dd-info">
                <span class="dd-name">{{ r.name }}</span>
                <span class="dd-code">{{ r.code }}</span>
                <span class="dd-type">{{ r.type }}</span>
              </div>
              <span class="dd-action" :class="{ picked: isCmpAdded(r.code) }">{{ isCmpAdded(r.code) ? '已添加' : '+ 添加' }}</span>
            </div>
          </div>

          <div v-if="cmpFunds.length > 0" class="tags-area">
            <div class="tags-label">已选 ({{ cmpFunds.length }}/6)</div>
            <div class="tags">
              <div v-for="(f, i) in cmpFunds" :key="f.code" class="tag">
                <span class="tag-name">{{ f.name }}</span>
                <span class="tag-code">{{ f.code }}</span>
                <button class="tag-x" @click="cmpFunds.splice(i, 1)">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="cmpFunds.length >= 2" class="card">
          <div class="card-header">
            <svg viewBox="0 0 24 24" fill="none" class="card-icon"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>对比设置</span>
          </div>
          <div class="period-row" style="padding-bottom: 14px;">
            <button v-for="p in periods" :key="p.value" class="period-btn" :class="{ active: cmpPeriod === p.value }" @click="cmpPeriod = p.value; loadCompareChart()">{{ p.label }}</button>
          </div>
        </div>

        <div v-if="chartData" class="card">
          <div class="card-header">
            <svg viewBox="0 0 24 24" fill="none" class="card-icon"><path d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>对比走势图</span>
          </div>
          <div class="chart-wrap" ref="chartRef"></div>
          <div class="chart-footer">
            <button class="ai-btn" :disabled="comparing || usage.used >= usage.limit" @click="confirmCompareAnalysis">
              <svg v-if="!comparing" viewBox="0 0 24 24" fill="none" class="btn-svg"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <div v-else class="spinner-xs white"></div>
              {{ comparing ? 'AI 分析中...' : 'AI 智能分析' }}
            </button>
          </div>
          <div v-if="usage.userType === 'guest' && usage.used >= usage.limit" class="upgrade-banner" @click="$router.push('/login')">
            <svg viewBox="0 0 24 24" fill="none"><path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>今日体验次数已用完，<b>登录后每日可享 9 次分析</b></span>
            <svg viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
        </div>

        <div v-if="cmpErrorMsg" class="err-tip">
          <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          {{ cmpErrorMsg }}
        </div>

        <div v-if="cmpResult || comparing" class="card result-card">
          <div class="result-top">
            <div class="result-label">
              <svg viewBox="0 0 24 24" fill="none" class="card-icon"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              对比分析报告
            </div>
            <button v-if="cmpResult && !comparing" class="copy-btn" @click="doCopy(cmpResult)">
              <svg viewBox="0 0 24 24" fill="none"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              复制
            </button>
          </div>
          <div class="result-body">
            <div v-if="comparing && !cmpResult" class="loading-state">
              <div class="dots"><span></span><span></span><span></span></div>
              <p>AI 正在分析...</p>
            </div>
            <div v-else class="md" v-html="renderedCmpResult"></div>
            <div v-if="comparing && cmpResult" class="cursor-wrap"><span class="cursor"></span></div>
          </div>
        </div>
      </template>

      <!-- Confirm Dialog -->
      <Teleport to="body">
        <div v-if="confirmDialog.show" class="modal-mask" @click.self="confirmDialog.show = false">
          <div class="modal-box">
            <div class="modal-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <h3 class="modal-title">确认 AI 分析</h3>
            <div class="modal-body">
              <p>{{ confirmDialog.message }}</p>
              <div class="modal-funds">
                <span v-for="f in confirmDialog.funds" :key="f.code" class="modal-tag">{{ f.name }}（{{ f.code }}）</span>
              </div>
              <div class="modal-period">
                <svg viewBox="0 0 24 24" fill="none"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                {{ confirmDialog.periodLabel }}
              </div>
              <div class="modal-warn">将消耗 1 次分析机会（剩余 {{ usage.limit - usage.used }} 次）</div>
              <div v-if="usage.userType === 'guest'" class="modal-upgrade" @click="confirmDialog.show = false; $router.push('/login')">
                <svg viewBox="0 0 24 24" fill="none"><path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                登录后每日可享 <b>9 次</b> AI 分析
              </div>
            </div>
            <div class="modal-actions">
              <button class="modal-btn cancel" @click="confirmDialog.show = false">取消</button>
              <button class="modal-btn ok" @click="confirmDialog.onConfirm()">确认分析</button>
            </div>
          </div>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch, reactive } from 'vue'
import * as echarts from 'echarts'
import { searchFunds } from '@/api/fund'
import { getAnalysisUsage, streamAnalysis, getNavHistory, lookupFunds } from '@/api/analysis'
import type { SearchResult } from '@/types'
import type { FundNavHistory } from '@/api/analysis'

interface Usage { allowed: boolean; used: number; limit: number; userType: 'guest' | 'registered' }

const usage = ref<Usage>({ allowed: true, used: 0, limit: 3, userType: 'guest' })
const activeTab = ref<'single' | 'compare'>('single')
const periods = [
  { value: '1m', label: '近1月' },
  { value: '3m', label: '近3月' },
  { value: '1y', label: '近1年' }
]
const periodLabels: Record<string, string> = { '1m': '近1个月', '3m': '近3个月', '1y': '近1年' }

// --- Single ---
const singleKeyword = ref('')
const singleResults = ref<SearchResult[]>([])
const singleSearching = ref(false)
const singleSearched = ref(false)
const singleLookupLoading = ref(false)
const singleFund = ref<SearchResult | null>(null)
const singlePeriod = ref('1m')
const analyzing = ref(false)
const analysisResult = ref('')
const singleErrorMsg = ref('')
const singleChartLoading = ref(false)
const singleChartData = ref<FundNavHistory | null>(null)
const singleChartRef = ref<HTMLElement | null>(null)
let singleChartInstance: echarts.ECharts | null = null
const singleLatestNav = ref('')
const singleYearReturn = ref('')

// --- Compare ---
const cmpInputMode = ref<'search' | 'batch'>('search')
const cmpKeyword = ref('')
const cmpResults = ref<SearchResult[]>([])
const cmpSearching = ref(false)
const cmpFunds = ref<SearchResult[]>([])
const cmpPeriod = ref('1m')
const comparing = ref(false)
const cmpResult = ref('')
const cmpErrorMsg = ref('')
const chartLoading = ref(false)
const chartData = ref<Record<string, FundNavHistory> | null>(null)
const chartRef = ref<HTMLElement | null>(null)
let chartInstance: echarts.ECharts | null = null

const batchInput = ref('')
const batchLoading = ref(false)
const batchErrors = ref<string[]>([])

const COLORS = ['#2563EB', '#DC2626', '#7C3AED', '#059669', '#D97706', '#0891B2']

const CACHE_KEY = 'smart_analysis_cache'

interface AnalysisCache {
  activeTab: 'single' | 'compare'
  single: {
    fund: SearchResult | null
    period: string
    analysisResult: string
    chartData: FundNavHistory | null
    latestNav: string
    yearReturn: string
  }
  compare: {
    funds: SearchResult[]
    period: string
    cmpResult: string
    chartData: Record<string, FundNavHistory> | null
  }
}

function saveCache() {
  const cache: AnalysisCache = {
    activeTab: activeTab.value,
    single: {
      fund: singleFund.value,
      period: singlePeriod.value,
      analysisResult: analysisResult.value,
      chartData: singleChartData.value,
      latestNav: singleLatestNav.value,
      yearReturn: singleYearReturn.value,
    },
    compare: {
      funds: cmpFunds.value,
      period: cmpPeriod.value,
      cmpResult: cmpResult.value,
      chartData: chartData.value,
    },
  }
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)) } catch { /* */ }
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AnalysisCache
  } catch { return null }
}

// --- Confirm Dialog ---
const confirmDialog = reactive({
  show: false,
  message: '',
  funds: [] as SearchResult[],
  periodLabel: '',
  onConfirm: () => {}
})

let singleTimer: number | null = null
let cmpTimer: number | null = null

onMounted(async () => {
  try { usage.value = await getAnalysisUsage() } catch { /* */ }

  const cache = loadCache()
  if (cache) {
    activeTab.value = cache.activeTab
    singleFund.value = cache.single.fund
    singlePeriod.value = cache.single.period
    analysisResult.value = cache.single.analysisResult
    singleChartData.value = cache.single.chartData
    singleLatestNav.value = cache.single.latestNav
    singleYearReturn.value = cache.single.yearReturn
    cmpFunds.value = cache.compare.funds
    cmpPeriod.value = cache.compare.period
    cmpResult.value = cache.compare.cmpResult
    chartData.value = cache.compare.chartData

    if (cache.single.fund && cache.single.chartData) {
      await nextTick()
      renderSingleChart()
    }
    if (cache.compare.funds.length >= 2 && cache.compare.chartData) {
      await nextTick()
      renderChart()
    }
  }
})

watch(
  [activeTab, singleFund, singlePeriod, analysisResult, singleChartData, singleLatestNav, singleYearReturn,
   cmpFunds, cmpPeriod, cmpResult, chartData],
  () => { saveCache() },
  { deep: true }
)

onUnmounted(() => {
  chartInstance?.dispose()
  singleChartInstance?.dispose()
})

// ---- search debounce ----
function debounceSearch(keyword: string, setter: (v: SearchResult[]) => void, loading: (v: boolean) => void, timerRef: 'singleTimer' | 'cmpTimer') {
  if (!keyword.trim()) { setter([]); return }
  if (timerRef === 'singleTimer' && singleTimer) clearTimeout(singleTimer)
  if (timerRef === 'cmpTimer' && cmpTimer) clearTimeout(cmpTimer)
  const timer = window.setTimeout(async () => {
    loading(true)
    try {
      const results = await searchFunds(keyword)
      setter(results)
      if (timerRef === 'singleTimer') {
        singleSearched.value = true
        if (results.length === 0) {
          loading(false)
          await handleSingleLookup()
          return
        }
      }
    } catch { setter([]) } finally { loading(false) }
  }, 300)
  if (timerRef === 'singleTimer') singleTimer = timer
  else cmpTimer = timer
}

function handleSingleSearch() { singleErrorMsg.value = ''; singleSearched.value = false; debounceSearch(singleKeyword.value, v => singleResults.value = v, v => singleSearching.value = v, 'singleTimer') }
function handleCmpSearch() { debounceSearch(cmpKeyword.value, v => cmpResults.value = v, v => cmpSearching.value = v, 'cmpTimer') }

function selectSingleFund(r: SearchResult) {
  singleFund.value = r; singleResults.value = []; singleKeyword.value = ''
  loadSingleChart(r.code)
}

async function handleSingleLookup() {
  const code = singleKeyword.value.trim()
  if (!code) return
  singleLookupLoading.value = true
  singleErrorMsg.value = ''
  try {
    const results = await lookupFunds([code])
    if (results.length > 0 && results[0].found) {
      const r = results[0]
      singleFund.value = { code: r.code, name: r.name, type: r.type, pinyin: '' }
      singleResults.value = []
      singleKeyword.value = ''
      loadSingleChart(r.code)
    } else {
      singleErrorMsg.value = `未找到基金 ${code}`
    }
  } catch {
    singleErrorMsg.value = '查询失败，请检查网络'
  }
  singleLookupLoading.value = false
}

async function loadSingleChart(code: string) {
  singleChartInstance?.dispose()
  singleChartInstance = null
  singleChartLoading.value = true
  singleChartData.value = null
  try {
    const data = await getNavHistory([code], '1y')
    if (data[code]) {
      singleChartData.value = data[code]
      const d = data[code].data
      if (d.length > 0) {
        const last = d[d.length - 1]
        singleLatestNav.value = last.nav.toFixed(4)
        const first = d[0]
        const ret = first.nav > 0 ? ((last.nav - first.nav) / first.nav * 100) : 0
        singleYearReturn.value = (ret >= 0 ? '+' : '') + ret.toFixed(2) + '%'
      }
      await nextTick()
      renderSingleChart()
    }
  } catch { /* */ }
  singleChartLoading.value = false
}

function getFilteredSingleData() {
  if (!singleChartData.value) return []
  const all = singleChartData.value.data
  if (singlePeriod.value === '1y') return all
  const now = new Date()
  let cutoff: Date
  if (singlePeriod.value === '1m') {
    cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
  } else {
    cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
  }
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return all.filter(d => d.date >= cutoffStr)
}

function renderSingleChart() {
  if (!singleChartRef.value || !singleChartData.value) return
  if (!singleChartInstance) singleChartInstance = echarts.init(singleChartRef.value)

  const data = getFilteredSingleData()
  if (data.length === 0) return
  const dates = data.map(d => d.date)
  const navs = data.map(d => d.nav)
  const growths = data.map(d => d.growth)
  const isMobile = window.innerWidth < 640
  const maxLabels = isMobile ? 4 : 8
  const sampleInterval = Math.max(1, Math.floor(dates.length / maxLabels))

  singleChartInstance.setOption({
    animation: false,
    grid: { left: 52, right: 16, top: 12, bottom: isMobile ? 40 : 28 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#E5E7EB', borderWidth: 1,
      textStyle: { color: '#374151', fontSize: 12 },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return ''
        const di = params[0]?.dataIndex ?? 0
        const date = dates[di] || ''
        const nav = navs[di]
        const g = growths[di]
        return `<div style="font-size:11px;color:#9CA3AF;margin-bottom:6px">${date}</div>
          <div style="font-size:12px;line-height:2">净值 <b>${nav.toFixed(4)}</b></div>
          <div style="font-size:12px;line-height:2">涨跌幅 <b style="color:${g >= 0 ? '#DC2626' : '#16A34A'}">${g >= 0 ? '+' : ''}${g.toFixed(2)}%</b></div>`
      }
    },
    xAxis: {
      type: 'category', data: dates,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: {
        color: '#9CA3AF', fontSize: isMobile ? 9 : 10,
        interval: sampleInterval - 1,
        rotate: isMobile ? 45 : (dates.length > 60 ? 30 : 0),
        formatter: (v: string) => isMobile ? v.slice(5) : v
      },
      splitLine: { show: false }
    },
    yAxis: [
      {
        type: 'value', position: 'left',
        axisLine: { show: false }, axisTick: { show: false },
        splitLine: { lineStyle: { color: '#F3F4F6', type: 'dashed' } },
        axisLabel: { color: '#9CA3AF', fontSize: 10, formatter: (v: number) => v.toFixed(2) }
      },
      {
        type: 'value', position: 'right',
        axisLine: { show: false }, axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { color: '#9CA3AF', fontSize: 10, formatter: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` }
      }
    ],
    series: [
      {
        name: '净值', type: 'line', smooth: true, symbol: 'none', yAxisIndex: 0,
        lineStyle: { width: 1, color: '#2563EB' },
        itemStyle: { color: '#2563EB' },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#2563EB20' },
          { offset: 1, color: '#2563EB03' }
        ]) },
        data: navs
      },
      {
        name: '涨跌幅', type: 'bar', yAxisIndex: 1, barWidth: data.length > 120 ? 1 : 2,
        itemStyle: { color: (params: any) => params.value >= 0 ? '#DC2626' : '#16A34A' },
        data: growths
      }
    ]
  }, true)
}

function isCmpAdded(code: string) { return cmpFunds.value.some(f => f.code === code) }
function addCompareFund(r: SearchResult) {
  if (!isCmpAdded(r.code) && cmpFunds.value.length < 6) {
    cmpFunds.value.push(r)
  }
}

// ---- batch add ----
async function handleBatchAdd() {
  const raw = batchInput.value.trim()
  if (!raw) return
  batchLoading.value = true
  batchErrors.value = []

  const tokens = raw.split(/[\s,，、\t\n]+/).filter(t => t.trim().length > 0)
  const uniqueTokens = [...new Set(tokens.map(t => t.trim()))]

  try {
    const results = await lookupFunds(uniqueTokens)
    for (const r of results) {
      if (cmpFunds.value.length >= 6) {
        batchErrors.value.push('最多只能添加6只基金')
        break
      }
      if (!r.found) {
        batchErrors.value.push(`${r.code} 未找到`)
        continue
      }
      if (isCmpAdded(r.code)) {
        batchErrors.value.push(`${r.code} 已存在`)
        continue
      }
      cmpFunds.value.push({ code: r.code, name: r.name, type: r.type, pinyin: '' })
    }
    if (batchErrors.value.length === 0) {
      batchInput.value = ''
    }
  } catch {
    batchErrors.value.push('查询失败，请检查网络')
  }
  batchLoading.value = false
}

// ---- markdown ----
function renderMd(md: string): string {
  let h = md
  h = h.replace(/^(\|.+\|)\n(\|[\s:|-]+\|)\n((?:\|.+\|\n?)*)/gm, (_match, headerRow: string, _sep: string, bodyRows: string) => {
    const parseCells = (row: string) => row.split('|').filter(c => c.trim() !== '').map(c => c.trim())
    const headers = parseCells(headerRow)
    const rows = bodyRows.trim().split('\n').filter(r => r.trim()).map(r => parseCells(r))
    let table = '<table><thead><tr>' + headers.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>'
    for (const row of rows) {
      table += '<tr>' + row.map(c => `<td>${c}</td>`).join('') + '</tr>'
    }
    table += '</tbody></table>'
    return table
  })
  h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  h = h.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  h = h.replace(/^# (.+)$/gm, '<h1>$1</h1>')
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  h = h.replace(/\*(.+?)\*/g, '<em>$1</em>')
  h = h.replace(/^- (.+)$/gm, '<li>$1</li>')
  h = h.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
  h = h.replace(/(<li>.*<\/li>\n?)+/gs, m => `<ul>${m}</ul>`)
  h = h.replace(/\n{2,}/g, '</p><p>')
  h = h.replace(/\n/g, '<br>')
  h = '<p>' + h + '</p>'
  h = h.replace(/<p><\/p>/g, '')
  h = h.replace(/<p>(<h[123]>)/g, '$1')
  h = h.replace(/(<\/h[123]>)<\/p>/g, '$1')
  h = h.replace(/<p>(<ul>)/g, '$1')
  h = h.replace(/(<\/ul>)<\/p>/g, '$1')
  h = h.replace(/<p>(<table>)/g, '$1')
  h = h.replace(/(<\/table>)<\/p>/g, '$1')
  return h
}

const renderedResult = computed(() => analysisResult.value ? renderMd(analysisResult.value) : '')
const renderedCmpResult = computed(() => cmpResult.value ? renderMd(cmpResult.value) : '')

// ---- confirm & analyze ----
function confirmSingleAnalysis() {
  if (!singleFund.value || analyzing.value) return
  confirmDialog.show = true
  confirmDialog.message = '将对以下基金进行 AI 智能分析'
  confirmDialog.funds = [singleFund.value]
  confirmDialog.periodLabel = periodLabels[singlePeriod.value]
  confirmDialog.onConfirm = () => {
    confirmDialog.show = false
    doSingleAnalysis()
  }
}

async function doSingleAnalysis() {
  if (!singleFund.value || analyzing.value) return
  analyzing.value = true; analysisResult.value = ''; singleErrorMsg.value = ''
  try {
    await streamAnalysis([singleFund.value.code], singlePeriod.value,
      c => { analysisResult.value += c },
      (u, l) => { usage.value.used = u; usage.value.limit = l },
      e => { singleErrorMsg.value = e; analyzing.value = false },
      () => { analyzing.value = false }
    )
  } catch (e: any) { singleErrorMsg.value = e?.message || '分析失败'; analyzing.value = false }
}

function confirmCompareAnalysis() {
  if (cmpFunds.value.length < 2 || comparing.value) return
  confirmDialog.show = true
  confirmDialog.message = `将对以下 ${cmpFunds.value.length} 只基金进行对比分析`
  confirmDialog.funds = [...cmpFunds.value]
  confirmDialog.periodLabel = periodLabels[cmpPeriod.value]
  confirmDialog.onConfirm = () => {
    confirmDialog.show = false
    doCompareAnalysis()
  }
}

async function doCompareAnalysis() {
  if (cmpFunds.value.length < 2 || comparing.value) return
  comparing.value = true; cmpResult.value = ''; cmpErrorMsg.value = ''
  try {
    await streamAnalysis(cmpFunds.value.map(f => f.code), cmpPeriod.value,
      c => { cmpResult.value += c },
      (u, l) => { usage.value.used = u; usage.value.limit = l },
      e => { cmpErrorMsg.value = e; comparing.value = false },
      () => { comparing.value = false }
    )
  } catch (e: any) { cmpErrorMsg.value = e?.message || '分析失败'; comparing.value = false }
}

// ---- compare chart ----
async function loadCompareChart() {
  if (cmpFunds.value.length < 2) return
  chartLoading.value = true; cmpErrorMsg.value = ''
  try {
    const codes = cmpFunds.value.map(f => f.code)
    chartData.value = await getNavHistory(codes, cmpPeriod.value)
    await nextTick()
    renderChart()
  } catch { cmpErrorMsg.value = '加载走势数据失败' }
  finally { chartLoading.value = false }
}

function renderChart() {
  if (!chartRef.value || !chartData.value) return
  if (!chartInstance) chartInstance = echarts.init(chartRef.value)

  const allDates = new Set<string>()
  const seriesList: echarts.SeriesOption[] = []
  let idx = 0

  for (const [code, fund] of Object.entries(chartData.value)) {
    const info = cmpFunds.value.find(f => f.code === code)
    const name = info?.name || fund.name
    fund.data.forEach(d => allDates.add(d.date))
    seriesList.push({
      name,
      type: 'line',
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 1, color: COLORS[idx % COLORS.length] },
      itemStyle: { color: COLORS[idx % COLORS.length] },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: COLORS[idx % COLORS.length] + '18' },
        { offset: 1, color: COLORS[idx % COLORS.length] + '03' }
      ]) },
      data: fund.data.map(d => d.growth)
    })
    idx++
  }

  const sortedDates = [...allDates].sort()
  const isMobile = window.innerWidth < 640
  const maxLabels = isMobile ? 4 : 8
  const sampleInterval = Math.max(1, Math.floor(sortedDates.length / maxLabels))

  chartInstance.setOption({
    animation: false,
    grid: { left: 52, right: 16, top: 36, bottom: isMobile ? 40 : 28 },
    legend: {
      top: 4, left: 'center', textStyle: { fontSize: 11, color: '#6B7280' },
      itemWidth: 14, itemHeight: 8, itemGap: 16
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#E5E7EB',
      borderWidth: 1,
      textStyle: { color: '#374151', fontSize: 12 },
      formatter: (params: any) => {
        if (!Array.isArray(params)) return ''
        const di = params[0]?.dataIndex
        const date = sortedDates[di] || ''
        let html = `<div style="font-size:11px;color:#9CA3AF;margin-bottom:6px">${date}</div>`
        for (const p of params) {
          const sign = p.value >= 0 ? '+' : ''
          html += `<div style="display:flex;justify-content:space-between;gap:16px;font-size:12px;line-height:2">
            <span><span style="color:${p.color}">●</span> ${p.seriesName}</span>
            <span style="font-weight:600;color:${p.value >= 0 ? '#DC2626' : '#16A34A'}">${sign}${p.value.toFixed(2)}%</span></div>`
        }
        return html
      }
    },
    xAxis: {
      type: 'category', data: sortedDates,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: {
        color: '#9CA3AF', fontSize: isMobile ? 9 : 10,
        interval: sampleInterval - 1,
        rotate: isMobile ? 45 : (sortedDates.length > 60 ? 30 : 0),
        formatter: (v: string) => isMobile ? v.slice(5) : v
      },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false }, axisTick: { show: false },
      splitLine: { lineStyle: { color: '#F3F4F6', type: 'dashed' } },
      axisLabel: { color: '#9CA3AF', fontSize: 10, formatter: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` }
    },
    series: seriesList
  }, true)
}

watch(singlePeriod, () => {
  if (singleChartData.value && singleChartRef.value) {
    renderSingleChart()
  }
})
watch(singleChartRef, (el) => {
  if (el && singleChartData.value) renderSingleChart()
  else if (!el) { singleChartInstance?.dispose(); singleChartInstance = null }
})
watch(chartRef, (el) => {
  if (el && chartData.value) renderChart()
  else if (!el) { chartInstance?.dispose(); chartInstance = null }
})

const resizeHandler = () => { singleChartInstance?.resize(); chartInstance?.resize() }
window.addEventListener('resize', resizeHandler)
onUnmounted(() => window.removeEventListener('resize', resizeHandler))

// ---- copy ----
async function doCopy(text: string) {
  try { await navigator.clipboard.writeText(text) } catch {
    const ta = document.createElement('textarea'); ta.value = text
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
  }
}
</script>

<style scoped>
.page { min-height: 100vh; background: linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 40%); }
.header {
  background: rgba(255,255,255,0.92); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(0,0,0,0.06); padding: 12px 0; position: sticky; top: 0; z-index: 100;
}
.header-inner { max-width: 860px; margin: 0 auto; padding: 0 20px; display: flex; justify-content: space-between; align-items: center; }
.brand { display: flex; align-items: center; gap: 10px; }
.back-btn {
  width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
  background: #F1F5F9; border: none; border-radius: 8px; cursor: pointer; color: #475569; transition: all 0.15s;
}
.back-btn:hover { background: #E2E8F0; color: #334155; }
.back-btn svg { width: 16px; height: 16px; }
.logo-dot {   width: 8px; height: 8px; background: linear-gradient(135deg, #BE123C, #F43F5E); border-radius: 50%; }
.title { font-size: 17px; font-weight: 700; color: #0F172A; margin: 0; letter-spacing: -0.02em; }
.usage-pill {
  display: flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 500;
  background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0;
}
.usage-pill.warn { background: #FEF2F2; color: #DC2626; border-color: #FECACA; }
.usage-dot { width: 6px; height: 6px; border-radius: 50%; background: #10B981; }
.usage-pill.warn .usage-dot { background: #EF4444; }

.container { max-width: 860px; margin: 0 auto; padding: 20px 20px 40px; }

.tabs-bar { display: flex; gap: 4px; margin-bottom: 16px; background: #F1F5F9; padding: 4px; border-radius: 10px; }
.tab {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 0; border: none; border-radius: 7px; background: transparent;
  color: #64748B; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s;
}
.tab svg { width: 15px; height: 15px; }
.tab:hover { color: #334155; }
.tab.active { background: white; color: #BE123C; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }

.card {
  background: white; border-radius: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.03);
  margin-bottom: 12px; overflow: hidden;
}
.card-header {
  display: flex; align-items: center; gap: 6px; padding: 14px 18px 0; font-size: 13px; font-weight: 600; color: #334155;
}
.card-icon { width: 16px; height: 16px; color: #E11D48; flex-shrink: 0; }
.card-hint { font-size: 11px; font-weight: 400; color: #94A3B8; margin-left: auto; }

.search-box { position: relative; margin: 10px 18px 14px; display: flex; align-items: center; }
.s-icon { position: absolute; left: 12px; width: 16px; height: 16px; color: #94A3B8; pointer-events: none; }
.s-input {
  width: 100%; padding: 9px 36px 9px 34px; border: 1px solid #E2E8F0; border-radius: 10px;
  outline: none; font-size: 13px; color: #1E293B; background: #FAFAFA; transition: all 0.2s;
}
.s-input:focus { border-color: #FB7185; background: white; box-shadow: 0 0 0 3px rgba(225,29,72,0.1); }
.s-input::placeholder { color: #94A3B8; }
.s-clear {
  position: absolute; right: 8px; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
  background: none; border: none; cursor: pointer; color: #94A3B8; border-radius: 5px;
}
.s-clear:hover { color: #64748B; }
.s-clear svg { width: 12px; height: 12px; }
.s-lookup-btn {
  position: absolute; right: 34px; width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; cursor: pointer; color: #E11D48; border-radius: 5px; transition: all 0.15s;
}
.s-lookup-btn:hover { color: #BE123C; }
.s-lookup-btn svg { width: 14px; height: 14px; }

.input-toggle {
  display: flex; gap: 4px; margin: 10px 18px 0; padding: 3px; background: #F1F5F9; border-radius: 7px;
}
.toggle-btn {
  flex: 1; padding: 5px 0; border: none; border-radius: 5px; background: transparent;
  color: #64748B; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; text-align: center;
}
.toggle-btn.active { background: white; color: #BE123C; box-shadow: 0 1px 2px rgba(0,0,0,0.06); }

.batch-area { display: flex; gap: 8px; margin: 10px 18px 14px; align-items: flex-start; }
.batch-input {
  flex: 1; padding: 8px 12px; border: 1px solid #93C5FD; border-radius: 10px;
  outline: none; font-size: 13px; color: #1E293B; background: #FAFAFA; resize: vertical;
  font-family: inherit; line-height: 1.6; transition: all 0.2s;
}
.batch-input:focus { border-color: #FB7185; background: white; box-shadow: 0 0 0 3px rgba(225,29,72,0.1); }
.batch-input::placeholder { color: #94A3B8; }
.batch-btn {
  display: flex; align-items: center; justify-content: center; gap: 5px;
  padding: 8px 16px; border: none; border-radius: 10px;
  background: #E11D48; color: white; font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.batch-btn:hover:not(:disabled) { background: #BE123C; }
.batch-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.batch-btn .btn-svg { width: 14px; height: 14px; }

.batch-errors { margin: 6px 18px 0; }
.batch-err { font-size: 11px; color: #EF4444; line-height: 1.6; }

.search-hint { display: flex; align-items: center; gap: 6px; padding: 8px 18px; font-size: 12px; color: #94A3B8; }
.spinner-xs {
  width: 14px; height: 14px; border: 2px solid rgba(225,29,72,0.15); border-top-color: #E11D48;
  border-radius: 50%; animation: spin 0.7s linear infinite;
}
.spinner-xs.white { border-color: rgba(255,255,255,0.3); border-top-color: white; }

.dropdown { margin: 6px 18px 12px; border: 1px solid #E2E8F0; border-radius: 10px; max-height: 200px; overflow-y: auto; }
.dd-item {
  display: flex; justify-content: space-between; align-items: center; padding: 8px 14px;
  cursor: pointer; transition: background 0.12s; border-bottom: 1px solid #F8FAFC;
}
.dd-item:last-child { border-bottom: none; }
.dd-item:hover { background: #FAFAFA; }
.dd-info { display: flex; align-items: center; gap: 8px; }
.dd-name { font-size: 13px; font-weight: 600; color: #1E293B; }
.dd-code { font-size: 10px; color: #64748B; background: #F1F5F9; padding: 1px 6px; border-radius: 4px; }
.dd-type { font-size: 10px; color: #E11D48; font-weight: 500; }
.dd-action { font-size: 12px; color: #E11D48; font-weight: 500; }
.dd-action.picked { color: #94A3B8; }

.no-result {
  display: flex; align-items: center; justify-content: center; gap: 4px;
  padding: 12px 18px; font-size: 13px; color: #94A3B8;
}
.no-result-btn {
  background: none; border: none; color: #E11D48; font-size: 13px;
  font-weight: 600; cursor: pointer; padding: 0; text-decoration: underline;
}
.no-result-btn:hover { color: #BE123C; }

.tags-area { padding: 0 18px 12px; margin-top: 8px; }
.tags-label { font-size: 11px; color: #94A3B8; margin-bottom: 6px; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tag {
  display: flex; align-items: center; gap: 5px; padding: 4px 8px 4px 10px;
  background: #FFF1F2; border: 1px solid #FECDD3; border-radius: 7px; font-size: 12px;
}
.tag-name { font-weight: 600; color: #9F1239; }
.tag-code { color: #E11D48; font-size: 10px; }
.tag-x {
  width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;
  background: rgba(225,29,72,0.1); border: none; border-radius: 50%; cursor: pointer; color: #E11D48; transition: all 0.12s;
}
.tag-x:hover { background: rgba(225,29,72,0.2); }
.tag-x svg { width: 10px; height: 10px; }

.fund-info-card { margin-top: 4px; }
.confirm-banner {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 12px 14px 0; margin: 0 18px; background: #FFF1F2; border: 1px solid #FECDD3; border-radius: 10px;
}
.confirm-info { flex: 1; }
.confirm-main { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.confirm-name { font-size: 14px; font-weight: 700; color: #9F1239; }
.confirm-code { font-size: 11px; color: #E11D48; background: white; padding: 1px 7px; border-radius: 4px; }
.confirm-type { font-size: 11px; color: #E11D48; font-weight: 500; }
.confirm-sub { font-size: 11px; color: #64748B; margin-top: 4px; }
.confirm-clear {
  width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
  background: rgba(225,29,72,0.1); border: none; border-radius: 50%; cursor: pointer; color: #E11D48; transition: all 0.12s; margin-left: 8px; flex-shrink: 0;
}
.confirm-clear:hover { background: rgba(225,29,72,0.2); }
.confirm-clear svg { width: 12px; height: 12px; }

.chart-loading { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 28px 0; color: #94A3B8; font-size: 13px; }
.single-chart-wrap { height: 260px; padding: 8px 10px 0; }

.period-label { font-size: 12px; color: #94A3B8; white-space: nowrap; display: flex; align-items: center; }

.period-row { display: flex; gap: 6px; padding: 10px 18px 0; align-items: center; }
.period-btn {
  flex: 1; padding: 7px 0; border: 1px solid #E2E8F0; border-radius: 8px;
  background: #FAFAFA; color: #64748B; font-size: 13px; font-weight: 500;
  cursor: pointer; transition: all 0.15s; text-align: center;
}
.period-btn:hover { border-color: #FECDD3; color: #E11D48; }
.period-btn.active { background: #E11D48; border-color: #E11D48; color: white; box-shadow: 0 2px 6px rgba(225,29,72,0.25); }

.action-row { display: flex; gap: 8px; padding: 14px 18px 16px; justify-content: center; }
.action-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  padding: 7px 18px; border: 1.5px solid #E2E8F0; border-radius: 8px;
  background: white; color: #475569; font-size: 13px; font-weight: 600;
  cursor: pointer; transition: all 0.15s;
}
.action-btn:hover:not(:disabled) { border-color: #FECDD3; color: #E11D48; }
.action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-svg { width: 16px; height: 16px; }

.chart-footer { display: flex; justify-content: center; padding: 4px 18px 14px; }
.ai-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 7px 16px; border: none; border-radius: 18px;
  background: linear-gradient(135deg, #BE123C, #F43F5E); color: white;
  font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(225,29,72,0.2);
}
.ai-btn:hover:not(:disabled) { box-shadow: 0 4px 14px rgba(225,29,72,0.3); transform: translateY(-1px); }
.ai-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; box-shadow: none; }
.ai-btn .btn-svg { width: 14px; height: 14px; }

.chart-wrap { height: 320px; padding: 8px 10px 10px; }

.err-tip {
  display: flex; align-items: center; gap: 8px; padding: 10px 16px; margin-bottom: 12px;
  background: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px; color: #DC2626; font-size: 13px;
}
.err-tip svg { width: 16px; height: 16px; flex-shrink: 0; }

.result-card { border: 1px solid rgba(225,29,72,0.15); }
.result-card .result-top {
  display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; border-bottom: 1px solid #F1F5F9;
}
.result-label { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #334155; }
.copy-btn {
  display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #F1F5F9;
  border: none; border-radius: 6px; font-size: 11px; color: #64748B; cursor: pointer; transition: all 0.12s;
}
.copy-btn:hover { background: #E2E8F0; color: #334155; }
.copy-btn svg { width: 13px; height: 13px; }
.result-body { padding: 16px 18px; min-height: 80px; }

.loading-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px 0; color: #94A3B8; font-size: 13px; }
.dots { display: flex; gap: 5px; }
.dots span { width: 8px; height: 8px; background: #E11D48; border-radius: 50%; animation: bounce 1.4s ease-in-out infinite both; }
.dots span:nth-child(1) { animation-delay: 0s; }
.dots span:nth-child(2) { animation-delay: 0.16s; }
.dots span:nth-child(3) { animation-delay: 0.32s; }
@keyframes bounce { 0%,80%,100%{transform:scale(0.5);opacity:0.3} 40%{transform:scale(1);opacity:1} }

.md { line-height: 1.8; color: #475569; font-size: 13px; }
.md :deep(h1) { font-size: 16px; font-weight: 700; color: #1E293B; margin: 16px 0 8px; }
.md :deep(h2) { font-size: 15px; font-weight: 700; color: #1E293B; margin: 14px 0 6px; }
.md :deep(h3) { font-size: 14px; font-weight: 600; color: #334155; margin: 10px 0 4px; }
.md :deep(strong) { color: #0F172A; font-weight: 600; }
.md :deep(ul) { margin: 6px 0; padding-left: 18px; }
.md :deep(li) { margin: 3px 0; }
.md :deep(table) { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
.md :deep(th) { background: #FFF1F2; color: #9F1239; font-weight: 600; text-align: left; padding: 8px 10px; border: 1px solid #FECDD3; }
.md :deep(td) { padding: 7px 10px; border: 1px solid #E2E8F0; color: #475569; }
.md :deep(tr:nth-child(even) td) { background: #FAFAFA; }
.md :deep(tr:hover td) { background: #FFF1F2; }

.cursor-wrap { display: inline-block; margin-left: 2px; }
.cursor { display: inline-block; width: 7px; height: 14px; background: #E11D48; border-radius: 1px; animation: blink 1s step-end infinite; vertical-align: text-bottom; }
@keyframes blink { 50%{opacity:0} }
@keyframes spin { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }

.modal-mask {
  position: fixed; inset: 0; background: rgba(15,23,42,0.4); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.modal-box {
  background: white; border-radius: 16px; width: 380px; max-width: 90vw; padding: 28px 24px 20px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15); animation: modalIn 0.2s ease;
}
@keyframes modalIn { from { opacity: 0; transform: translateY(12px) scale(0.97); } to { opacity: 1; transform: none; } }
.modal-icon-wrap {
  width: 44px; height: 44px; background: #FFF1F2; border-radius: 12px;
  display: flex; align-items: center; justify-content: center; margin: 0 auto 14px;
}
.modal-icon-wrap svg { width: 24px; height: 24px; color: #E11D48; }
.modal-title { text-align: center; font-size: 16px; font-weight: 700; color: #0F172A; margin: 0 0 14px; }
.modal-body { text-align: center; }
.modal-body > p { font-size: 13px; color: #64748B; margin: 0 0 12px; }
.modal-funds { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin-bottom: 10px; }
.modal-tag {
  font-size: 12px; color: #9F1239; background: #FFF1F2; border: 1px solid #FECDD3;
  padding: 3px 10px; border-radius: 6px; font-weight: 500;
}
.modal-period {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; color: #475569; background: #F8FAFC; padding: 4px 12px; border-radius: 6px;
}
.modal-period svg { width: 14px; height: 14px; color: #E11D48; }
.modal-warn { font-size: 11px; color: #F59E0B; margin-top: 10px; }
.modal-actions { display: flex; gap: 10px; margin-top: 20px; }
.modal-btn {
  flex: 1; padding: 10px 0; border: none; border-radius: 9px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.15s;
}
.modal-btn.cancel { background: #F1F5F9; color: #475569; }
.modal-btn.cancel:hover { background: #E2E8F0; }
.modal-btn.ok { background: #E11D48; color: white; box-shadow: 0 2px 8px rgba(225,29,72,0.25); }
.modal-btn.ok:hover { background: #BE123C; }

@media (max-width: 640px) {
  .container { padding: 14px 12px 32px; }
  .chart-wrap { height: 260px; }
  .action-row { flex-direction: column; }
  .period-row { gap: 4px; }
  .period-btn { padding: 6px 0; font-size: 12px; }
  .batch-area { flex-direction: column; }
  .batch-btn { width: 100%; justify-content: center; padding: 10px; }
  .ai-btn { max-width: 120px; width: 100%; }
}
</style>
