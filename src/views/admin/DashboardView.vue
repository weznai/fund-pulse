<template>
  <div class="dashboard-page">
    <div class="page-header">
      <h2 class="page-title">仪表盘</h2>
      <div class="header-right">
        <span v-if="d" class="upd-time">更新于 {{ fmtTime(d.generatedAt) }}</span>
        <button class="btn-refresh" @click="loadData">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          刷新
        </button>
      </div>
    </div>

    <div class="loading-state" v-if="loading">
      <span class="spinner"></span>
      <span>加载中...</span>
    </div>

    <div class="error-state" v-else-if="loadError">
      <p>{{ loadError }}</p>
      <button class="btn btn-primary" @click="loadData">重试</button>
    </div>

    <template v-else>
      <!-- 指标卡 -->
      <div class="cards">
        <div v-for="c in cardList" :key="c.label" class="card" :class="c.cls">
          <div class="card-icon" v-html="c.icon"></div>
          <div class="card-body">
            <div class="card-value">{{ c.value }}</div>
            <div class="card-title">{{ c.label }}</div>
          </div>
        </div>
      </div>

      <!-- 图表 -->
      <div class="charts">
        <div class="chart-box wide">
          <div class="chart-head">
            <h3>访问趋势</h3>
            <div class="range-switch">
              <button :class="{ active: range === 180 }" @click="setRange(180)">180天</button>
              <button :class="{ active: range === 90 }" @click="setRange(90)">90天</button>
              <button :class="{ active: range === 60 }" @click="setRange(60)">60天</button>
            </div>
          </div>
          <div ref="trendRef" class="chart tall"></div>
        </div>
        <div class="chart-box">
          <h3>用户类型分布</h3>
          <div ref="typeRef" class="chart"></div>
        </div>
        <div class="chart-box">
          <h3>文章阅读 TOP5</h3>
          <div ref="newsRef" class="chart"></div>
        </div>
      </div>

      <!-- 最新注册 -->
      <div class="recent-box">
        <div class="section-header">
          <h3>最新注册用户</h3>
        </div>
        <table class="data-table">
          <thead>
            <tr><th>用户ID</th><th>类型</th><th>邮箱</th><th>备注</th><th>注册时间</th></tr>
          </thead>
          <tbody>
            <tr v-for="u in d.user.recent" :key="u.id" :class="{ 'disabled-row': u.disabled }">
              <td class="user-id">{{ u.id }}</td>
              <td><span class="type-badge" :class="u.type">{{ typeLabel(u.type) }}</span></td>
              <td class="user-email">{{ u.email || '-' }}</td>
              <td>{{ u.label || '-' }}</td>
              <td>{{ fmtTime(u.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import axios from 'axios'
import * as echarts from 'echarts'

const loading = ref(true)
const loadError = ref('')
const d = ref<any>(null)

const trendRef = ref<HTMLElement | null>(null)
const typeRef = ref<HTMLElement | null>(null)
const newsRef = ref<HTMLElement | null>(null)

const range = ref(180)
let charts: echarts.ECharts[] = []
let trendChart: echarts.ECharts | null = null

function setRange(r: number) {
  if (range.value === r) return
  range.value = r
  renderTrendChart()
}

const svgWrap = (paths: string) => `<svg viewBox="0 0 24 24" fill="none">${paths}</svg>`

const ICONS = {
  users: svgWrap('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2"/>'),
  userPlus: svgWrap('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2"/><path d="M19 8v6M22 11h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  eye: svgWrap('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>'),
  visitor: svgWrap('<circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  activity: svgWrap('<path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  doc: svgWrap('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'),
  spark: svgWrap('<path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'),
  fund: svgWrap('<rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2"/><path d="M7 15l3.5-4 3 3L17 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>')
}

const cardList = computed(() => {
  if (!d.value) return []
  const n = (v: number) => (v ?? 0).toLocaleString()
  return [
    { label: '总用户数', value: n(d.value.user.total), cls: 'c-blue', icon: ICONS.users },
    { label: '今日新增用户', value: n(d.value.user.todayNew), cls: 'c-green', icon: ICONS.userPlus },
    { label: '今日访问量（PV）', value: n(d.value.visit.todayPv), cls: 'c-cyan', icon: ICONS.eye },
    { label: '今日访客数（UV）', value: n(d.value.visit.todayUv), cls: 'c-teal', icon: ICONS.visitor },
    { label: '近7日活跃用户', value: n(d.value.user.active7d), cls: 'c-amber', icon: ICONS.activity },
    { label: '文章总阅读量', value: n(d.value.news.totalViews), cls: 'c-purple', icon: ICONS.doc },
    { label: '智能分析使用次数', value: n(d.value.ai.totalCalls), cls: 'c-indigo', icon: ICONS.spark },
    { label: '用户持仓基金数', value: n(d.value.fund.holdings), cls: 'c-rose', icon: ICONS.fund }
  ]
})

async function loadData() {
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await axios.get('/api/admin/dashboard')
    d.value = data
    loading.value = false
    await nextTick()
    renderCharts()
  } catch (error: any) {
    loadError.value = error.response?.data?.error || '加载失败，请刷新重试'
  } finally {
    loading.value = false
  }
}

function renderCharts() {
  disposeCharts()
  if (!d.value) return
  renderTrendChart()
  renderTypeChart()
  renderNewsChart()
}

function renderTrendChart() {
  if (!trendRef.value || !d.value) return
  trendChart?.dispose()
  trendChart = echarts.init(trendRef.value)

  const rows = d.value.visit.trend180.slice(-range.value)
  const axisStyle = { color: '#64748b' }

  trendChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['PV', 'UV'], right: 10, top: 0 },
    grid: { left: 46, right: 20, top: 34, bottom: 28 },
    xAxis: {
      type: 'category',
      data: rows.map((r: any) => r.date.slice(5)),
      axisLabel: { color: '#64748b', interval: Math.max(0, Math.floor(rows.length / 13)) },
      axisTick: { alignWithLabel: false }
    },
    yAxis: { type: 'value', minInterval: 1, axisLabel: axisStyle, splitLine: { lineStyle: { color: '#f1f5f9' } } },
    series: [
      {
        name: 'PV',
        type: 'line',
        smooth: true,
        symbolSize: 6,
        data: rows.map((r: any) => r.pv),
        itemStyle: { color: '#3b82f6' },
        areaStyle: { color: 'rgba(59,130,246,0.08)' },
        lineStyle: { width: 2.5 }
      },
      {
        name: 'UV',
        type: 'line',
        smooth: true,
        symbolSize: 6,
        data: rows.map((r: any) => r.uv),
        itemStyle: { color: '#10b981' },
        lineStyle: { width: 2.5 }
      }
    ]
  })
}

function renderTypeChart() {
  if (!typeRef.value) return
  const typeNames: Record<string, string> = { machine: '机器', phone: '手机', email: '邮箱', custom: '自定义' }
  const c = echarts.init(typeRef.value)
  charts.push(c)
  c.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, icon: 'circle', textStyle: { color: '#64748b' } },
    series: [
      {
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['50%', '44%'],
        label: { show: false },
        data: d.value.user.byType.map((t: any) => ({
          name: typeNames[t.type] || t.type,
          value: t.c
        }))
      }
    ],
    color: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']
  })
}

function renderNewsChart() {
  if (!newsRef.value) return
  const top = [...d.value.news.top].reverse()
  const c = echarts.init(newsRef.value)
  charts.push(c)
  c.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 8, right: 40, top: 10, bottom: 10, containLabel: true },
    xAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#f1f5f9' } }
    },
    yAxis: {
      type: 'category',
      data: top.map((a: any) => (a.title.length > 12 ? a.title.slice(0, 12) + '…' : a.title)),
      axisLabel: { color: '#475569', width: 96, overflow: 'truncate' }
    },
    series: [
      {
        type: 'bar',
        barWidth: 14,
        itemStyle: { color: '#8b5cf6', borderRadius: [0, 7, 7, 0] },
        label: { show: true, position: 'right', color: '#64748b' },
        data: top.map((a: any) => a.views)
      }
    ]
  })
}

function disposeCharts() {
  charts.forEach(c => c.dispose())
  charts = []
  trendChart?.dispose()
  trendChart = null
}

function onResize() {
  charts.forEach(c => c.resize())
  trendChart?.resize()
}

function typeLabel(type: string) {
  const labels: Record<string, string> = { machine: '机器', phone: '手机', email: '邮箱', custom: '自定义' }
  return labels[type] || type
}

function fmtTime(ts: number) {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(() => {
  loadData()
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  disposeCharts()
})
</script>

<style scoped>
.dashboard-page {
  padding: 0;
}

.page-header {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #2563eb;
  margin: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.upd-time {
  font-size: 12.5px;
  color: #94a3b8;
}

.btn-refresh {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  color: #475569;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-refresh:hover {
  border-color: #3b82f6;
  color: #2563eb;
}

.btn-refresh svg {
  width: 14px;
  height: 14px;
}

/* 指标卡 */
.cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 20px;
}

.card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 18px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  position: relative;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
}

.card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-icon svg {
  width: 24px;
  height: 24px;
}

.card-body {
  min-width: 0;
}

.card-title {
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
  white-space: nowrap;
}

.card-value {
  font-size: 26px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.15;
  margin-bottom: 4px;
  font-variant-numeric: tabular-nums;
}

.card.c-blue::before { background: linear-gradient(90deg, #2563eb, #60a5fa); }
.card.c-blue .card-icon { background: #dbeafe; color: #2563eb; }
.card.c-green::before { background: linear-gradient(90deg, #059669, #34d399); }
.card.c-green .card-icon { background: #dcfce7; color: #059669; }
.card.c-amber::before { background: linear-gradient(90deg, #d97706, #fbbf24); }
.card.c-amber .card-icon { background: #fef3c7; color: #d97706; }
.card.c-purple::before { background: linear-gradient(90deg, #7c3aed, #a78bfa); }
.card.c-purple .card-icon { background: #ede9fe; color: #7c3aed; }
.card.c-cyan::before { background: linear-gradient(90deg, #0891b2, #22d3ee); }
.card.c-cyan .card-icon { background: #cffafe; color: #0891b2; }
.card.c-teal::before { background: linear-gradient(90deg, #0d9488, #2dd4bf); }
.card.c-teal .card-icon { background: #ccfbf1; color: #0d9488; }
.card.c-indigo::before { background: linear-gradient(90deg, #4f46e5, #818cf8); }
.card.c-indigo .card-icon { background: #e0e7ff; color: #4f46e5; }
.card.c-rose::before { background: linear-gradient(90deg, #db2777, #f472b6); }
.card.c-rose .card-icon { background: #fce7f3; color: #db2777; }

/* 图表 */
.charts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

.chart-box.wide {
  grid-column: 1 / -1;
}

.chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.chart-head h3 {
  margin-bottom: 0;
}

.range-switch {
  display: flex;
  gap: 4px;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 3px;
}

.range-switch button {
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 12.5px;
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.range-switch button:hover {
  color: #2563eb;
}

.range-switch button.active {
  background: #fff;
  color: #2563eb;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.1);
}

.chart-box {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 20px;
}

.chart-box h3 {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.chart-box h3::before {
  content: '';
  width: 4px;
  height: 16px;
  background: linear-gradient(180deg, #2563eb 0%, #3b82f6 100%);
  border-radius: 2px;
}

.chart {
  width: 100%;
  height: 260px;
}

.chart.tall {
  height: 280px;
}

/* 最新注册 */
.recent-box {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 20px 24px;
}

.section-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 16px 0;
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

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.data-table th {
  text-align: left;
  padding: 12px 14px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  color: #475569;
  font-weight: 600;
  border-bottom: 2px solid #e2e8f0;
  white-space: nowrap;
  font-size: 13px;
}

.data-table td {
  padding: 13px 14px;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
}

.data-table tbody tr:hover {
  background: #f8fafc;
}

.user-id {
  font-family: 'SF Mono', Consolas, monospace;
  font-size: 13px;
  font-weight: 600;
  color: #2563eb;
}

.user-email {
  font-size: 13px;
  color: #64748b;
}

.disabled-row td {
  color: #94a3b8 !important;
}

.type-badge {
  display: inline-flex;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.type-badge.machine { background: #dbeafe; color: #1d4ed8; }
.type-badge.phone { background: #dcfce7; color: #166534; }
.type-badge.email { background: #fef3c7; color: #92400e; }
.type-badge.custom { background: #f3e8ff; color: #7c3aed; }

/* 状态 */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 80px 24px;
  color: #64748b;
}

.error-state {
  text-align: center;
  padding: 48px 24px;
  color: #dc2626;
  background: #fef2f2;
  border-radius: 12px;
}

.btn {
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.btn-primary {
  background: #3b82f6;
  color: #fff;
  margin-top: 8px;
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

@media (max-width: 1200px) {
  .cards { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
  .cards { grid-template-columns: repeat(2, 1fr); }
  .charts { grid-template-columns: 1fr; }
}
</style>
