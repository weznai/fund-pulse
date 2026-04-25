<template>
  <div class="visit-stats-page">
    <div class="page-header">
      <div class="page-header-row">
        <div class="page-header-left">
          <h2 class="page-title">访问管理</h2>
          <p class="page-desc">查看网站访问统计数据，包括PV/UV趋势和IP分布</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-secondary btn-sm" @click="loadStats" :disabled="loading">
            刷新
          </button>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <div class="stat-card today">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <polyline points="12 6 12 12 16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">今日 PV</span>
          <span class="stat-value">{{ stats.todayPv }}</span>
        </div>
      </div>
      <div class="stat-card uv">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">今日 UV</span>
          <span class="stat-value">{{ stats.todayUv }}</span>
        </div>
      </div>
      <div class="stat-card total">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">总 PV</span>
          <span class="stat-value">{{ stats.totalPv }}</span>
        </div>
      </div>
      <div class="stat-card total-uv">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2"/>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">总 UV</span>
          <span class="stat-value">{{ stats.totalUv }}</span>
        </div>
      </div>
    </div>

    <!-- 统计概览区域 -->
    <div class="section-header">
      <div class="section-header-left">
        <h3 class="section-title">统计概览</h3>
        <p class="section-desc">查看最近7天的访问趋势和IP分布情况</p>
      </div>
    </div>

    <!-- 图表区域 - 三列布局 -->
    <div class="charts-container-three">
      <!-- 最近7天数据表格 -->
      <div class="chart-card">
        <div class="chart-header">
          <h3>最近7天访问数据</h3>
        </div>
        <div class="chart-body table-body">
          <table class="data-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>PV</th>
                <th>UV</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in recentDaysData" :key="item.date">
                <td>{{ item.date }}</td>
                <td>{{ item.pv }}</td>
                <td>{{ item.uv }}</td>
              </tr>
              <tr v-if="recentDaysData.length === 0">
                <td colspan="3" class="empty-cell">暂无数据</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- PV/UV 趋势图 -->
      <div class="chart-card">
        <div class="chart-header">
          <h3>PV/UV 趋势（最近7天）</h3>
        </div>
        <div class="chart-body" ref="lineChartRef"></div>
      </div>

      <!-- IP 分布饼图 -->
      <div class="chart-card">
        <div class="chart-header">
          <h3>访问 IP 分布</h3>
        </div>
        <div class="chart-body" ref="pieChartRef"></div>
      </div>
    </div>

    <!-- 访问明细区域 -->
    <div class="section-header">
      <div class="section-header-left">
        <h3 class="section-title">访问明细</h3>
        <p class="section-desc">查看详细的访问记录和IP访问统计</p>
      </div>
      <button class="btn btn-danger btn-sm" @click="showCleanDialog = true">
        清理
      </button>
    </div>

    <!-- 访问记录和IP统计区域 -->
    <div class="logs-container">
      <!-- 左侧：访问记录列表 -->
      <div class="logs-card">
        <div class="logs-header">
          <h3>访问记录</h3>
          <div class="filter-group">
            <input
              type="date"
              v-model="logFilterDate"
              @change="loadVisitLogs"
              class="date-input"
            />
            <input
              type="text"
              v-model="logFilterIp"
              @keyup.enter="loadVisitLogs"
              placeholder="搜索IP"
              class="ip-input"
            />
            <button class="btn btn-secondary btn-sm" @click="loadVisitLogs">
              查询
            </button>
          </div>
        </div>
        <div class="logs-body">
          <table class="logs-table">
            <thead>
              <tr>
                <th>IP</th>
                <th>用户名</th>
                <th>日期</th>
                <th>时间</th>
                <th>路径</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in visitLogs" :key="log.id" class="clickable-row" @dblclick="showLogDetail(log)">
                <td class="ip-cell">{{ log.ip }}</td>
                <td>{{ log.username || '-' }}<span v-if="isCrawler(log)" class="crawler-badge">爬</span></td>
                <td>{{ log.visit_date }}</td>
                <td>{{ formatTime(log.visit_time) }}</td>
                <td class="path-cell">{{ log.path || '/' }}</td>
              </tr>
              <tr v-if="visitLogs.length === 0">
                <td colspan="5" class="empty-cell">暂无访问记录</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="logs-footer">
          <span class="page-info">共 {{ logsTotal }} 条，第 {{ logsPage }}/{{ logsTotalPages }} 页</span>
          <div class="pagination">
            <button class="page-btn" @click="goToPage(1)" :disabled="logsPage <= 1">首页</button>
            <button class="page-btn" @click="goToPage(logsPage - 1)" :disabled="logsPage <= 1">上一页</button>
            <button class="page-btn" @click="goToPage(logsPage + 1)" :disabled="logsPage >= logsTotalPages">下一页</button>
            <button class="page-btn" @click="goToPage(logsTotalPages)" :disabled="logsPage >= logsTotalPages">末页</button>
          </div>
        </div>
      </div>

      <!-- 右侧：IP统计图表 -->
      <div class="ip-stats-card">
        <div class="chart-header">
          <h3>IP 访问统计</h3>
          <select v-model="ipStatsDate" @change="loadIpStats" class="date-select">
            <option value="">全部</option>
            <option v-for="date in recentDates" :key="date" :value="date">{{ date }}</option>
          </select>
        </div>
        <div class="ip-stats-body" ref="ipBarChartRef"></div>
      </div>
    </div>

    <!-- 清理确认弹窗 -->
    <div class="modal-overlay" v-if="showCleanDialog" @click.self="showCleanDialog = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>清理访问记录</h3>
          <button class="modal-close" @click="showCleanDialog = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="clean-section">
            <p>按IP清理：删除 <code>delete_visit_ip</code> 中指定IP的记录。</p>
          </div>
          <div class="clean-divider"></div>
          <div class="clean-section">
            <p>按用户清理：删除 <code>delete_visit_user</code> 中指定用户的记录。</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-sm" @click="showCleanDialog = false">取消</button>
          <button class="btn btn-danger btn-sm" @click="cleanVisitUsers" :disabled="cleaning" style="margin-right: 8px;">
            {{ cleaning ? '清理中...' : '按用户清理' }}
          </button>
          <button class="btn btn-danger btn-sm" @click="cleanVisitIps" :disabled="cleaning">
            {{ cleaning ? '清理中...' : '按IP清理' }}
          </button>
        </div>
      </div>
    </div>

    <!-- IP信息弹窗 -->
    <div class="modal-overlay" v-if="showIpDialog" @click.self="showIpDialog = false">
      <div class="modal-content ip-info-modal">
        <div class="modal-header">
          <h3>IP 访问检测 - {{ ipInfoIp }}</h3>
          <button class="modal-close" @click="showIpDialog = false">&times;</button>
        </div>
        <div class="modal-body" v-if="ipInfoLoading">
          <div class="ip-info-loading">查询中...</div>
        </div>
        <div class="modal-body" v-else-if="ipInfoData">
          <div class="ip-info-grid">
            <div class="ip-info-row"><span class="ip-info-label">归属地</span><span class="ip-info-value">{{ [ipInfoData.country, ipInfoData.regionName, ipInfoData.city].filter(Boolean).join(' · ') || '-' }}</span></div>
            <div class="ip-info-row"><span class="ip-info-label">ISP</span><span class="ip-info-value">{{ ipInfoData.isp || '-' }}</span></div>
            <div class="ip-info-row"><span class="ip-info-label">组织</span><span class="ip-info-value">{{ ipInfoData.org || '-' }}</span></div>
            <div class="ip-info-row"><span class="ip-info-label">AS</span><span class="ip-info-value">{{ ipInfoData.as || '-' }}</span></div>
          </div>
          <div class="ip-info-risk" v-if="ipInfoData.proxy || ipInfoData.hosting">
            <div class="risk-warning">
              <span class="risk-icon">⚠</span>
              <span>风控预警</span>
            </div>
            <div class="risk-tags">
              <span class="risk-tag" v-if="ipInfoData.proxy">代理/VPN</span>
              <span class="risk-tag" v-if="ipInfoData.hosting">数据中心/机房</span>
            </div>
          </div>
          <div class="ip-info-safe" v-else>
            <span class="safe-icon">✓</span> 未检测到风险标签
          </div>
        </div>
        <div class="modal-body" v-else>
          <div class="ip-info-error">查询失败，请稍后重试</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-sm" @click="showIpDialog = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 访问记录详情弹窗 -->
    <div class="modal-overlay" v-if="showLogDetailDialog" @click.self="showLogDetailDialog = false">
      <div class="modal-content log-detail-modal">
        <div class="modal-header">
          <h3>访问记录详情</h3>
          <button class="modal-close" @click="showLogDetailDialog = false">&times;</button>
        </div>
        <div class="modal-body" v-if="selectedLog">
          <div class="log-detail-grid">
            <div class="log-detail-row">
              <span class="log-detail-label">IP</span>
              <span class="log-detail-value ip-cell">{{ selectedLog.ip }}</span>
            </div>
            <div class="log-detail-row">
              <span class="log-detail-label">用户名</span>
              <span class="log-detail-value">{{ selectedLog.username || '-' }}</span>
            </div>
            <div class="log-detail-row">
              <span class="log-detail-label">用户ID</span>
              <span class="log-detail-value">{{ selectedLog.user_id || '-' }}</span>
            </div>
            <div class="log-detail-row">
              <span class="log-detail-label">路径</span>
              <span class="log-detail-value">{{ selectedLog.path || '/' }}</span>
            </div>
            <div class="log-detail-row">
              <span class="log-detail-label">日期</span>
              <span class="log-detail-value">{{ selectedLog.visit_date }}</span>
            </div>
            <div class="log-detail-row">
              <span class="log-detail-label">时间</span>
              <span class="log-detail-value">{{ formatTimeFull(selectedLog.visit_time) }}</span>
            </div>
            <div class="log-detail-row">
              <span class="log-detail-label">Referer</span>
              <span class="log-detail-value break-all">{{ selectedLog.referer || '-' }}</span>
            </div>
            <div class="log-detail-row">
              <span class="log-detail-label">User Agent</span>
              <span class="log-detail-value break-all">{{ selectedLog.user_agent || '-' }}</span>
            </div>
            <template v-if="parsedReqSource">
              <div class="log-detail-section">请求来源信息</div>
              <div class="log-detail-row">
                <span class="log-detail-label">设备</span>
                <span class="log-detail-value">{{ parsedReqSource.device || '-' }}</span>
              </div>
              <div class="log-detail-row">
                <span class="log-detail-label">系统</span>
                <span class="log-detail-value">{{ parsedReqSource.os || '-' }}</span>
              </div>
              <div class="log-detail-row">
                <span class="log-detail-label">浏览器</span>
                <span class="log-detail-value">{{ parsedReqSource.browser || '-' }}</span>
              </div>
              <div class="log-detail-row">
                <span class="log-detail-label">语言</span>
                <span class="log-detail-value">{{ parsedReqSource.lang || '-' }}</span>
              </div>
              <div class="log-detail-row">
                <span class="log-detail-label">方法</span>
                <span class="log-detail-value">{{ parsedReqSource.method || '-' }}</span>
              </div>
            </template>
            <div class="log-detail-section">风险分析</div>
            <div v-if="riskAnalysis.risks.length === 0" class="risk-safe-box">
              <span class="safe-icon">✓</span> 未检测到风险
            </div>
            <div v-else :class="['risk-result-box', `risk-${riskAnalysis.level}`]">
              <div class="risk-result-header">
                <span class="risk-icon">⚠</span>
                <span>检测到 {{ riskAnalysis.risks.length }} 项风险</span>
              </div>
              <div class="risk-list">
                <div v-for="(risk, idx) in riskAnalysis.risks" :key="idx" class="risk-item">
                  <span :class="['risk-level-tag', `tag-${risk.level}`]">{{ risk.level === 'high' ? '高危' : '中危' }}</span>
                  <span class="risk-type">{{ risk.type }}</span>
                  <span class="risk-desc">{{ risk.desc }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-sm" @click="showLogDetailDialog = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div class="loading-overlay" v-if="loading">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import axios from 'axios'
import * as echarts from 'echarts'

const loading = ref(false)
const showCleanDialog = ref(false)
const cleaning = ref(false)
const showIpDialog = ref(false)
const ipInfoIp = ref('')
const ipInfoLoading = ref(false)
const ipInfoData = ref<any>(null)
const lineChartRef = ref<HTMLElement | null>(null)
const pieChartRef = ref<HTMLElement | null>(null)
const ipBarChartRef = ref<HTMLElement | null>(null)

let lineChart: echarts.ECharts | null = null
let pieChart: echarts.ECharts | null = null
let ipBarChart: echarts.ECharts | null = null

interface DailyData {
  date: string
  pv: number
  uv: number
}

interface VisitStats {
  totalPv: number
  totalUv: number
  todayPv: number
  todayUv: number
  recentDays: DailyData[]
  ipDistribution: Array<{ ip: string; count: number }>
}

interface VisitLog {
  id: number
  ip: string
  path: string | null
  user_agent: string | null
  referer: string | null
  user_id: string | null
  visit_date: string
  visit_time: number
  req_source: string | null
  username: string | null
}

interface IpStat {
  ip: string
  count: number
}

const stats = ref<VisitStats>({
  totalPv: 0,
  totalUv: 0,
  todayPv: 0,
  todayUv: 0,
  recentDays: [],
  ipDistribution: []
})

// 访问日志相关
const visitLogs = ref<VisitLog[]>([])
const logsPage = ref(1)
const logsTotal = ref(0)
const logsTotalPages = ref(0)
const logFilterDate = ref('')
const logFilterIp = ref('')

// IP统计相关
const ipStats = ref<IpStat[]>([])
const ipStatsDate = ref('')

const showLogDetailDialog = ref(false)
const selectedLog = ref<VisitLog | null>(null)
const parsedReqSource = computed(() => {
  if (!selectedLog.value?.req_source) return null
  try {
    return JSON.parse(selectedLog.value.req_source)
  } catch {
    return null
  }
})

interface RiskItem {
  level: 'high' | 'medium' | 'low'
  type: string
  desc: string
}

const riskAnalysis = computed(() => {
  const log = selectedLog.value
  if (!log) return { risks: [] as RiskItem[], level: 'safe' as string }

  const risks: RiskItem[] = []
  const ua = (log.user_agent || '').toLowerCase()
  const path = (log.path || '/').toLowerCase()
  const req = parsedReqSource.value

  const crawlerKeywords = ['bot', 'crawler', 'spider', 'curl', 'wget', 'python-requests', 'python-urllib', 'scrapy', 'httpclient', 'okhttp', 'java/', 'apache-httpclient', 'go-http-client', 'node-fetch', 'axios/']
  for (const kw of crawlerKeywords) {
    if (ua.includes(kw)) {
      risks.push({ level: 'high', type: '爬虫/自动化工具', desc: `User-Agent 包含特征关键词: ${kw}` })
      break
    }
  }

  if (!log.user_agent || log.user_agent.trim() === '') {
    risks.push({ level: 'high', type: '无 User-Agent', desc: '请求未携带 User-Agent，通常为脚本或扫描器' })
  }

  if (ua.length > 0 && ua.length < 15) {
    risks.push({ level: 'medium', type: '异常 User-Agent', desc: `User-Agent 过短或异常: "${log.user_agent}"` })
  }

  const attackPatterns = [
    { pattern: /\.\.\//, name: '路径遍历', desc: '检测到路径遍历攻击特征(../)' },
    { pattern: /(<script|javascript:|onerror\s*=)/i, name: 'XSS 注入', desc: '检测到跨站脚本攻击特征' },
    { pattern: /(union\s+select|drop\s+table|or\s+1\s*=\s*1|--)/i, name: 'SQL 注入', desc: '检测到 SQL 注入攻击特征' },
    { pattern: /(\.env|wp-config|\.git|\.svn|web\.config)/i, name: '敏感文件探测', desc: '尝试访问敏感配置文件' },
    { pattern: /(\/admin|\/phpmyadmin|\/wp-admin|\/manager)/i, name: '后台路径扫描', desc: '尝试探测后台管理入口' },
  ]
  for (const { pattern, name, desc } of attackPatterns) {
    if (pattern.test(path)) {
      risks.push({ level: 'high', type: name, desc })
    }
  }

  if (req) {
    const method = (req.method || '').toUpperCase()
    if (['PUT', 'DELETE', 'PATCH', 'OPTIONS'].includes(method)) {
      risks.push({ level: 'medium', type: '非常规 HTTP 方法', desc: `使用了 ${method} 方法` })
    }
  }

  if (log.referer) {
    const refLower = log.referer.toLowerCase()
    if (refLower.includes('<script') || refLower.includes('javascript:')) {
      risks.push({ level: 'high', type: 'Referer 注入', desc: 'Referer 头中包含可疑脚本内容' })
    }
  }

  const level = risks.some(r => r.level === 'high') ? 'danger' : risks.some(r => r.level === 'medium') ? 'warning' : 'safe'
  return { risks, level }
})

// 计算最近7天日期列表
const recentDates = computed(() => {
  const dates: string[] = []
  for (let i = 0; i < 30; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    dates.push(date.toISOString().split('T')[0])
  }
  return dates
})

// 计算最近7天数据（带百分比，按日期从新到旧排列）
const recentDaysData = computed(() => {
  const totalPv = stats.value.recentDays.reduce((sum, d) => sum + d.pv, 0)
  return [...stats.value.recentDays]
    .sort((a, b) => b.date.localeCompare(a.date)) // 按日期从新到旧排列
    .map(d => ({
      ...d,
      percentage: totalPv > 0 ? (d.pv / totalPv) * 100 : 0
    }))
})

// 加载统计数据
async function loadStats() {
  loading.value = true
  try {
    const token = localStorage.getItem('admin_token')
    const response = await axios.get('/api/admin/visit-stats', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    stats.value = response.data
    updateCharts()
  } catch (error) {
    console.error('加载统计数据失败:', error)
  } finally {
    loading.value = false
  }
}

// 加载访问日志
async function loadVisitLogs() {
  try {
    const token = localStorage.getItem('admin_token')
    const params: Record<string, any> = { page: logsPage.value, pageSize: 15 }
    if (logFilterDate.value) params.date = logFilterDate.value
    if (logFilterIp.value) params.ip = logFilterIp.value

    const response = await axios.get('/api/admin/visit-logs', {
      headers: { Authorization: `Bearer ${token}` },
      params
    })

    visitLogs.value = response.data.logs
    logsTotal.value = response.data.total
    logsPage.value = response.data.page
    logsTotalPages.value = response.data.totalPages
  } catch (error) {
    console.error('加载访问日志失败:', error)
  }
}

// 跳转到指定页
function goToPage(page: number) {
  logsPage.value = page
  loadVisitLogs()
}

// 格式化时间
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const crawlerKeywords = ['bot', 'crawler', 'spider', 'curl', 'wget', 'python-requests', 'python-urllib', 'scrapy', 'httpclient', 'okhttp', 'java/', 'apache-httpclient', 'go-http-client', 'node-fetch', 'axios/']

function isCrawler(log: VisitLog): boolean {
  const ua = (log.user_agent || '').toLowerCase()
  return crawlerKeywords.some(kw => ua.includes(kw))
}

function formatTimeFull(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function showLogDetail(log: VisitLog) {
  selectedLog.value = log
  showLogDetailDialog.value = true
}

// 加载IP统计
async function loadIpStats() {
  try {
    const token = localStorage.getItem('admin_token')
    const params: Record<string, any> = { limit: 15 }
    if (ipStatsDate.value) params.date = ipStatsDate.value

    const response = await axios.get('/api/admin/ip-stats', {
      headers: { Authorization: `Bearer ${token}` },
      params
    })

    ipStats.value = response.data
    updateIpBarChart()
  } catch (error) {
    console.error('加载IP统计失败:', error)
  }
}

async function cleanVisitIps() {
  cleaning.value = true
  try {
    const token = localStorage.getItem('admin_token')
    const response = await axios.post('/api/admin/clean-visit-ips', {}, {
      headers: { Authorization: `Bearer ${token}` }
    })
    alert(`清理完成，共删除 ${response.data.deleted} 条记录`)
    showCleanDialog.value = false
    loadVisitLogs()
    loadStats()
    loadIpStats()
  } catch (error: any) {
    alert(error.response?.data?.error || '清理失败')
  } finally {
    cleaning.value = false
  }
}

async function cleanVisitUsers() {
  cleaning.value = true
  try {
    const token = localStorage.getItem('admin_token')
    const response = await axios.post('/api/admin/clean-visit-users', {}, {
      headers: { Authorization: `Bearer ${token}` }
    })
    alert(`清理完成，共删除 ${response.data.deleted} 条记录`)
    showCleanDialog.value = false
    loadVisitLogs()
    loadStats()
    loadIpStats()
  } catch (error: any) {
    alert(error.response?.data?.error || '清理失败')
  } finally {
    cleaning.value = false
  }
}

async function lookupIp(ip: string) {
  ipInfoIp.value = ip
  ipInfoLoading.value = true
  ipInfoData.value = null
  showIpDialog.value = true
  try {
    const token = localStorage.getItem('admin_token')
    const response = await axios.get(`/api/admin/ip-info/${ip}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    ipInfoData.value = response.data
  } catch {
    ipInfoData.value = null
  } finally {
    ipInfoLoading.value = false
  }
}

// 初始化图表
function initCharts() {
  if (lineChartRef.value) {
    lineChart = echarts.init(lineChartRef.value)
  }
  if (pieChartRef.value) {
    pieChart = echarts.init(pieChartRef.value)
  }
  if (ipBarChartRef.value) {
    ipBarChart = echarts.init(ipBarChartRef.value)
    ipBarChart.on('dblclick', (params: any) => {
      if (params.name) {
        lookupIp(params.name)
      }
    })
  }
  updateCharts()
}

// 更新图表
function updateCharts() {
  updateLineChart()
  updatePieChart()
}

// 更新折线图
function updateLineChart() {
  if (!lineChart) return

  const dates = stats.value.recentDays.map(d => d.date.slice(5)) // 只显示 MM-DD
  const pvData = stats.value.recentDays.map(d => d.pv)
  const uvData = stats.value.recentDays.map(d => d.uv)

  lineChart.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      }
    },
    legend: {
      data: ['PV', 'UV'],
      top: 10
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: 50,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
      axisLine: {
        lineStyle: {
          color: '#e2e8f0'
        }
      },
      axisLabel: {
        color: '#64748b'
      }
    },
    yAxis: {
      type: 'value',
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      splitLine: {
        lineStyle: {
          color: '#f1f5f9'
        }
      },
      axisLabel: {
        color: '#64748b'
      }
    },
    series: [
      {
        name: 'PV',
        type: 'line',
        smooth: true,
        data: pvData,
        lineStyle: {
          width: 3,
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#1e3a5f' },
            { offset: 1, color: '#3b82f6' }
          ])
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(30, 58, 95, 0.3)' },
            { offset: 1, color: 'rgba(30, 58, 95, 0.05)' }
          ])
        },
        itemStyle: {
          color: '#1e3a5f'
        }
      },
      {
        name: 'UV',
        type: 'line',
        smooth: true,
        data: uvData,
        lineStyle: {
          width: 3,
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#10b981' },
            { offset: 1, color: '#34d399' }
          ])
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
            { offset: 1, color: 'rgba(16, 185, 129, 0.05)' }
          ])
        },
        itemStyle: {
          color: '#10b981'
        }
      }
    ]
  }, true)
}

// 更新饼图
function updatePieChart() {
  if (!pieChart) return

  const data = stats.value.ipDistribution.slice(0, 10).map(item => ({
    name: item.ip,
    value: item.count
  }))

  pieChart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: 20,
      top: 'center',
      textStyle: {
        color: '#64748b',
        fontSize: 12
      }
    },
    series: [
      {
        name: 'IP分布',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: data,
        color: ['#1e3a5f', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316']
      }
    ]
  }, true)
}

// 更新IP统计柱状图
function updateIpBarChart() {
  if (!ipBarChart) return

  const ips = [...ipStats.value].reverse().map(item => item.ip)
  const counts = [...ipStats.value].reverse().map(item => item.count)

  ipBarChart.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: 20,
      containLabel: true
    },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#f1f5f9' } },
      axisLabel: { color: '#64748b' }
    },
    yAxis: {
      type: 'category',
      data: ips,
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisTick: { show: false },
      axisLabel: {
        color: '#64748b',
        fontSize: 11
      }
    },
    series: [{
      type: 'bar',
      data: counts,
      barWidth: 12,
      itemStyle: {
        borderRadius: [0, 4, 4, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: '#3b82f6' },
          { offset: 1, color: '#1e3a5f' }
        ])
      }
    }]
  }, true)
}

// 处理窗口大小变化
function handleResize() {
  lineChart?.resize()
  pieChart?.resize()
  ipBarChart?.resize()
}

onMounted(() => {
  initCharts()
  loadStats()
  loadVisitLogs()
  loadIpStats()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  lineChart?.dispose()
  pieChart?.dispose()
  ipBarChart?.dispose()
})
</script>

<style scoped>
.visit-stats-page {
  padding: 0;
  position: relative;
}

.page-header {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.page-header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.page-header-left {
  display: flex;
  flex-direction: column;
}

.page-header-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.page-header-actions .btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #1e3a5f;
  margin: 0 0 8px 0;
}

.page-desc {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

/* 统计卡片 */
.stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon svg {
  width: 24px;
  height: 24px;
}

.stat-card.today .stat-icon {
  background: linear-gradient(135deg, #1e3a5f 0%, #3b82f6 100%);
  color: #fff;
}

.stat-card.uv .stat-icon {
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  color: #fff;
}

.stat-card.total .stat-icon {
  background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
  color: #fff;
}

.stat-card.total-uv .stat-icon {
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
  color: #fff;
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 13px;
  color: #64748b;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
}

/* 区块标题头 */
.section-header {
  margin: 24px 0 16px 0;
  padding-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.section-header-left {
  display: flex;
  flex-direction: column;
}

.section-header:first-of-type {
  margin-top: 0;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e3a5f;
  margin: 0 0 4px 0;
}

.section-desc {
  font-size: 13px;
  color: #64748b;
  margin: 0;
}

/* 图表区域 - 三列布局 */
.charts-container-three {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.charts-container-three .chart-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.charts-container-three .chart-header {
  padding: 12px 16px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.charts-container-three .chart-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.charts-container-three .chart-body {
  height: 380px;
  padding: 12px;
}

.charts-container-three .table-body {
  height: auto;
  max-height: 380px;
  overflow-y: auto;
  padding: 0;
}

.charts-container-three .data-table {
  width: 100%;
  border-collapse: collapse;
}

.charts-container-three .data-table th,
.charts-container-three .data-table td {
  padding: 14px 16px;
  text-align: left;
}

.charts-container-three .data-table th {
  background: #f8fafc;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

.charts-container-three .data-table td {
  border-bottom: 1px solid #f1f5f9;
  font-size: 13px;
  color: #334155;
}

.charts-container-three .data-table tbody tr:hover {
  background: #f8fafc;
}

.charts-container-three .empty-cell {
  text-align: center;
  color: #94a3b8;
  padding: 20px !important;
}

.charts-container-three .table-actions {
  display: flex;
  gap: 6px;
}

.charts-container-three .btn-sm {
  padding: 4px 8px;
  font-size: 11px;
}

/* 图表区域 - 两列布局（保留给其他地方使用） */
.charts-container {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.chart-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.chart-header {
  padding: 16px 20px;
  border-bottom: 1px solid #f1f5f9;
}

.chart-header h3 {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.chart-body {
  height: 300px;
  padding: 16px;
}

/* 数据表格 */
.data-table-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #f1f5f9;
}

.table-header h3 {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.table-actions {
  display: flex;
  gap: 10px;
}

.btn-warning {
  background: #f59e0b;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.2s;
}

.btn-warning:hover:not(:disabled) {
  background: #d97706;
}

.btn-warning:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.table-body {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 14px 20px;
  text-align: left;
}

.data-table th {
  background: #f8fafc;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.data-table td {
  border-bottom: 1px solid #f1f5f9;
  font-size: 14px;
  color: #334155;
}

.data-table tbody tr:hover {
  background: #f8fafc;
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.empty-cell {
  text-align: center;
  color: #94a3b8;
  padding: 40px 20px !important;
}

/* 进度条 */
.progress-bar {
  width: 100%;
  max-width: 200px;
  height: 20px;
  background: #f1f5f9;
  border-radius: 10px;
  position: relative;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #1e3a5f 0%, #3b82f6 100%);
  border-radius: 10px;
  transition: width 0.3s ease;
}

.progress-text {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  font-weight: 600;
  color: #1e293b;
}

/* 按钮 */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn svg {
  width: 16px;
  height: 16px;
}

.btn-secondary {
  background: #f1f5f9;
  color: #475569;
}

.btn-secondary:hover:not(:disabled) {
  background: #e2e8f0;
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 加载状态 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  z-index: 10;
  border-radius: 12px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e2e8f0;
  border-top-color: #1e3a5f;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 访问记录和IP统计区域 */
.logs-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-top: 20px;
}

.logs-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.logs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #f1f5f9;
  flex-wrap: wrap;
  gap: 12px;
}

.logs-header h3 {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.date-input,
.ip-input {
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  color: #334155;
}

.date-input:focus,
.ip-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.ip-input {
  width: 120px;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.logs-body {
  max-height: 400px;
  overflow-y: auto;
}

.logs-table {
  width: 100%;
  border-collapse: collapse;
}

.logs-table th,
.logs-table td {
  padding: 10px 16px;
  text-align: left;
  border-bottom: 1px solid #f1f5f9;
}

.logs-table th {
  background: #f8fafc;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  position: sticky;
  top: 0;
}

.logs-table td {
  font-size: 13px;
  color: #334155;
}

.logs-table tbody tr:hover {
  background: #f8fafc;
}

.ip-cell {
  font-family: monospace;
  color: #1e3a5f !important;
}

.path-cell {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logs-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid #f1f5f9;
  background: #f8fafc;
}

.page-info {
  font-size: 13px;
  color: #64748b;
}

.pagination {
  display: flex;
  gap: 6px;
}

.page-btn {
  padding: 4px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: #fff;
  color: #475569;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* IP统计卡片 */
.ip-stats-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.ip-stats-card .chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.date-select {
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  color: #334155;
  cursor: pointer;
}

.date-select:focus {
  outline: none;
  border-color: #3b82f6;
}

.ip-stats-body {
  height: 400px;
  padding: 16px;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

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
  z-index: 100;
}

.modal-content {
  background: #fff;
  border-radius: 12px;
  width: 420px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #f1f5f9;
}

.modal-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  font-size: 20px;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px 8px;
}

.modal-close:hover {
  color: #64748b;
}

.modal-body {
  padding: 20px;
}

.modal-body p {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #334155;
}

.modal-body code {
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
  color: #1e3a5f;
}

.modal-body .text-muted {
  color: #94a3b8;
  font-size: 13px;
}

.clean-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  margin: 0 0 6px;
}
.clean-divider {
  height: 1px;
  background: #E2E8F0;
  margin: 14px 0;
}
.crawler-badge {
  display: inline-block;
  margin-left: 4px;
  padding: 0 4px;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  background: #EF4444;
  border-radius: 3px;
  line-height: 16px;
  vertical-align: middle;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 20px;
  border-top: 1px solid #f1f5f9;
}

.ip-info-modal {
  width: 480px;
}

.ip-info-loading,
.ip-info-error {
  text-align: center;
  padding: 20px;
  color: #94a3b8;
  font-size: 14px;
}

.ip-info-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.ip-info-row {
  display: flex;
  align-items: center;
  font-size: 14px;
}

.ip-info-label {
  width: 60px;
  flex-shrink: 0;
  color: #64748b;
  font-weight: 500;
}

.ip-info-value {
  color: #334155;
  word-break: break-all;
}

.ip-info-risk {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 12px 16px;
}

.risk-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #dc2626;
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 8px;
}

.risk-icon {
  font-size: 16px;
}

.risk-tags {
  display: flex;
  gap: 8px;
}

.risk-tag {
  background: #dc2626;
  color: #fff;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.ip-info-safe {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 12px 16px;
  color: #16a34a;
  font-size: 14px;
}

.safe-icon {
  font-weight: 700;
  font-size: 16px;
}

/* 响应式 */
@media (max-width: 1400px) {
  .charts-container-three {
    grid-template-columns: 1fr;
  }

  .charts-container-three .chart-body {
    height: 250px;
  }
}

@media (max-width: 1200px) {
  .charts-container {
    grid-template-columns: 1fr;
  }

  .logs-container {
    grid-template-columns: 1fr;
  }
}

.clickable-row {
  cursor: pointer;
  transition: background 0.15s;
}

.clickable-row:hover {
  background: #f0f7ff !important;
}

.log-detail-modal {
  width: 540px;
}

.log-detail-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.log-detail-row {
  display: flex;
  align-items: flex-start;
  font-size: 14px;
}

.log-detail-label {
  width: 90px;
  flex-shrink: 0;
  color: #64748b;
  font-weight: 500;
}

.log-detail-value {
  color: #334155;
  word-break: break-all;
}

.log-detail-section {
  font-size: 13px;
  font-weight: 600;
  color: #1e3a5f;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f1f5f9;
}

.break-all {
  word-break: break-all;
}

.risk-safe-box {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 10px 14px;
  color: #16a34a;
  font-size: 13px;
}

.risk-result-box {
  border-radius: 8px;
  padding: 12px 14px;
}

.risk-result-box.risk-danger {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.risk-result-box.risk-warning {
  background: #fffbeb;
  border: 1px solid #fde68a;
}

.risk-result-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 10px;
}

.risk-danger .risk-result-header {
  color: #dc2626;
}

.risk-warning .risk-result-header {
  color: #d97706;
}

.risk-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.risk-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
}

.risk-level-tag {
  flex-shrink: 0;
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
}

.risk-level-tag.tag-high {
  background: #dc2626;
}

.risk-level-tag.tag-medium {
  background: #f59e0b;
}

.risk-type {
  flex-shrink: 0;
  font-weight: 500;
  color: #334155;
}

.risk-desc {
  color: #64748b;
}

@media (max-width: 900px) {
  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .stats-cards {
    grid-template-columns: 1fr;
  }

  .stat-value {
    font-size: 24px;
  }
}
</style>
