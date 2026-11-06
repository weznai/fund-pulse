<template>
  <div class="dashboard-page">
    <div class="page-header">
      <h2 class="page-title">仪表盘</h2>
      <p class="page-desc">运营总览：用户、访问、资讯、智能分析与持仓核心指标</p>
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
        <div class="card c-blue">
          <div class="card-title">总用户数</div>
          <div class="card-value">{{ d.user.total }}</div>
        </div>
        <div class="card c-green">
          <div class="card-title">今日新增用户</div>
          <div class="card-value">{{ d.user.todayNew }}</div>
        </div>
        <div class="card c-cyan">
          <div class="card-title">今日访问量（PV）</div>
          <div class="card-value">{{ d.visit.todayPv }}</div>
        </div>
        <div class="card c-teal">
          <div class="card-title">今日访客数（UV）</div>
          <div class="card-value">{{ d.visit.todayUv }}</div>
        </div>
        <div class="card c-amber">
          <div class="card-title">近7日活跃用户</div>
          <div class="card-value">{{ d.user.active7d }}</div>
        </div>
        <div class="card c-purple">
          <div class="card-title">文章总阅读量</div>
          <div class="card-value">{{ d.news.totalViews }}</div>
        </div>
        <div class="card c-indigo">
          <div class="card-title">智能分析使用次数</div>
          <div class="card-value">{{ d.ai.totalCalls }}</div>
        </div>
        <div class="card c-rose">
          <div class="card-title">用户持仓基金数</div>
          <div class="card-value">{{ d.fund.holdings }}</div>
        </div>
      </div>

      <!-- 图表 -->
      <div class="charts">
        <div class="chart-box wide">
          <h3>近 180 天访问趋势</h3>
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
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import axios from 'axios'
import * as echarts from 'echarts'

const loading = ref(true)
const loadError = ref('')
const d = ref<any>(null)

const trendRef = ref<HTMLElement | null>(null)
const typeRef = ref<HTMLElement | null>(null)
const newsRef = ref<HTMLElement | null>(null)

let charts: echarts.ECharts[] = []

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

  const axisStyle = { color: '#64748b' }

  if (trendRef.value) {
    const c = echarts.init(trendRef.value)
    charts.push(c)
    c.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['PV', 'UV'], right: 10, top: 0 },
      grid: { left: 46, right: 20, top: 34, bottom: 28 },
      xAxis: {
        type: 'category',
        data: d.value.visit.trend180.map((r: any) => r.date.slice(5)),
        axisLabel: { color: '#64748b', interval: 14 },
        axisTick: { alignWithLabel: false }
      },
      yAxis: { type: 'value', minInterval: 1, axisLabel: axisStyle, splitLine: { lineStyle: { color: '#f1f5f9' } } },
      series: [
        {
          name: 'PV',
          type: 'line',
          smooth: true,
          symbolSize: 6,
          data: d.value.visit.trend180.map((r: any) => r.pv),
          itemStyle: { color: '#3b82f6' },
          areaStyle: { color: 'rgba(59,130,246,0.08)' },
          lineStyle: { width: 2.5 }
        },
        {
          name: 'UV',
          type: 'line',
          smooth: true,
          symbolSize: 6,
          data: d.value.visit.trend180.map((r: any) => r.uv),
          itemStyle: { color: '#10b981' },
          lineStyle: { width: 2.5 }
        }
      ]
    })
  }

  if (typeRef.value) {
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

  if (newsRef.value) {
    const top = [...d.value.news.top].reverse()
    const c = echarts.init(newsRef.value)
    charts.push(c)
    c.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 8, right: 40, top: 10, bottom: 10, containLabel: true },
      xAxis: { type: 'value', minInterval: 1, axisLabel: axisStyle, splitLine: { lineStyle: { color: '#f1f5f9' } } },
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
}

function disposeCharts() {
  charts.forEach(c => c.dispose())
  charts = []
}

function onResize() {
  charts.forEach(c => c.resize())
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
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #2563eb;
  margin: 0 0 8px 0;
}

.page-desc {
  font-size: 14px;
  color: #64748b;
  margin: 0;
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
  padding: 18px;
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

.card.c-blue::before { background: linear-gradient(90deg, #2563eb, #60a5fa); }
.card.c-green::before { background: linear-gradient(90deg, #059669, #34d399); }
.card.c-amber::before { background: linear-gradient(90deg, #d97706, #fbbf24); }
.card.c-purple::before { background: linear-gradient(90deg, #7c3aed, #a78bfa); }
.card.c-cyan::before { background: linear-gradient(90deg, #0891b2, #22d3ee); }
.card.c-teal::before { background: linear-gradient(90deg, #0d9488, #2dd4bf); }
.card.c-indigo::before { background: linear-gradient(90deg, #4f46e5, #818cf8); }
.card.c-rose::before { background: linear-gradient(90deg, #db2777, #f472b6); }

.card-title {
  font-size: 13px;
  color: #475569;
  font-weight: 600;
  margin-bottom: 10px;
}

.card-value {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1;
}

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
