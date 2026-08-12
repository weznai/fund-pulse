<template>
  <div class="estimate-source-page">
    <div class="page-header">
      <h2 class="page-title">数据源配置</h2>
      <p class="page-subtitle">管理盘中估值的数据源，支持多源切换、健康检查、基金级配置和实时对比</p>
    </div>

    <!-- 统计概览 -->
    <div class="stats-row">
      <div class="stat-card stat-total">
        <div class="stat-icon-wrap"><span class="stat-icon">∑</span></div>
        <div class="stat-body">
          <div class="stat-value">{{ adapters.length }}</div>
          <div class="stat-label">数据源总数</div>
        </div>
      </div>
      <div class="stat-card stat-enabled">
        <div class="stat-icon-wrap"><span class="stat-icon">●</span></div>
        <div class="stat-body">
          <div class="stat-value">{{ enabledCount }}</div>
          <div class="stat-label">已启用</div>
        </div>
      </div>
      <div class="stat-card stat-healthy">
        <div class="stat-icon-wrap"><span class="stat-icon">✓</span></div>
        <div class="stat-body">
          <div class="stat-value">{{ healthyCount }}</div>
          <div class="stat-label">健康正常</div>
        </div>
      </div>
      <div class="stat-card stat-default">
        <div class="stat-icon-wrap"><span class="stat-icon">★</span></div>
        <div class="stat-body">
          <div class="stat-value text-ellipsis" :title="adapterShortName(defaultSource)">{{ adapterShortName(defaultSource) }}</div>
          <div class="stat-label">全局默认源</div>
        </div>
      </div>
    </div>

    <div class="tabs">
      <button :class="['tab', { active: activeTab === 'sources' }]" @click="activeTab = 'sources'">数据源管理</button>
      <button :class="['tab', { active: activeTab === 'funds' }]" @click="activeTab = 'funds'">基金级配置</button>
      <button :class="['tab', { active: activeTab === 'compare' }]" @click="activeTab = 'compare'">实时对比</button>
    </div>

    <!-- ============ Tab 1: 数据源管理 ============ -->
    <div class="content-body" v-show="activeTab === 'sources'">
      <!-- 全局配置 -->
      <div class="section-card">
        <div class="section-header">
          <h3>全局配置</h3>
          <button class="btn btn-secondary btn-sm" @click="loadConfig" :disabled="loadingConfig">
            {{ loadingConfig ? '加载中...' : '刷新' }}
          </button>
        </div>

        <div class="config-row">
          <div class="config-item">
            <label class="config-label">默认数据源</label>
            <div class="source-pick-group">
              <button
                v-for="a in adapters"
                :key="a.id"
                :class="['source-pick', { active: defaultSource === a.id, unavailable: isSourceUnavailable(a.id) }]"
                :title="isSourceUnavailable(a.id) ? `${a.name}（失效：${healthMap[a.id]?.message || '无响应'}）` : a.name"
                @click="defaultSource = a.id; saveDefaultSource()"
              >
                <span :class="['source-pick-dot', a.category, { fail: isSourceUnavailable(a.id) }]"></span>
                <span class="source-pick-name">{{ adapterShortLabel(a.id) }}</span>
                <span :class="['source-pick-cat', a.category]">{{ a.category === 'timeseries' ? '分时' : '单点' }}</span>
                <span v-if="isSourceUnavailable(a.id)" class="source-pick-status">失效</span>
              </button>
            </div>
            <span class="config-hint">所有未单独配置的基金默认走此源</span>
          </div>
        </div>

        <div class="config-row">
          <div class="config-item config-item-chain">
            <label class="config-label">降级链</label>
            <div class="chain-list">
              <div class="chain-item" v-for="(id, idx) in fallbackChain" :key="id">
                <span class="chain-index">{{ idx + 1 }}</span>
                <span class="chain-name">{{ adapterName(id) }}</span>
                <span class="chain-code">{{ id }}</span>
                <div class="chain-ops">
                  <button class="chain-op" :disabled="idx === 0" @click="moveChain(idx, -1)" title="上移">↑</button>
                  <button class="chain-op" :disabled="idx === fallbackChain.length - 1" @click="moveChain(idx, 1)" title="下移">↓</button>
                  <button class="chain-op chain-op-del" @click="removeChain(idx)" title="移除">×</button>
                </div>
              </div>
              <div class="chain-empty" v-if="fallbackChain.length === 0">降级链为空，请添加数据源</div>
            </div>
            <div class="chain-add" v-if="chainCandidates.length > 0">
              <select class="form-select form-select-sm" v-model="chainAddId">
                <option value="">+ 添加数据源到降级链</option>
                <option v-for="id in chainCandidates" :key="id" :value="id">{{ adapterName(id) }}</option>
              </select>
              <button class="btn btn-primary btn-sm" :disabled="!chainAddId" @click="addChain">添加</button>
            </div>
            <button class="btn btn-secondary btn-sm chain-save" @click="saveFallbackChain">保存降级链</button>
          </div>
        </div>
      </div>

      <!-- 数据源卡片 -->
      <div class="section-card">
        <div class="section-header">
          <h3>数据源状态</h3>
          <div class="header-ops">
            <button class="btn btn-secondary btn-sm" @click="healthCheckAll" :disabled="healthCheckingAll">
              {{ healthCheckingAll ? '检测中...' : '全部检测' }}
            </button>
            <button class="btn btn-secondary btn-sm" @click="loadAdapters">刷新</button>
          </div>
        </div>

        <div class="loading-state" v-if="loadingAdapters">
          <span class="spinner"></span>
          <span>加载中...</span>
        </div>

        <div class="adapter-grid" v-else>
          <div :class="['adapter-card', { disabled: !a.enabled }]" v-for="a in adapters" :key="a.id">
            <div class="adapter-card-header">
              <div class="adapter-title-row">
                <span :class="['health-dot', healthStatusClass(a.id)]" :title="healthStatusText(a.id)"></span>
                <span class="adapter-name">{{ a.name }}</span>
                <span :class="['category-badge', a.category]">{{ a.category === 'timeseries' ? '分时' : '单点' }}</span>
              </div>
              <label class="switch">
                <input type="checkbox" :checked="a.enabled" @change="toggleEnabled(a.id, ($event.target as HTMLInputElement).checked)" />
                <span class="switch-slider"></span>
              </label>
            </div>
            <div class="adapter-id">{{ a.id }}</div>
            <div class="adapter-desc">{{ a.description }}</div>
            <div class="adapter-health" v-if="healthMap[a.id]">
              <span :class="['health-tag', healthMap[a.id].ok ? 'ok' : 'fail']">
                {{ healthMap[a.id].ok ? '正常' : '异常' }}
              </span>
              <span class="health-latency" v-if="healthMap[a.id].latency != null">{{ healthMap[a.id].latency }}ms</span>
              <span class="health-msg" v-if="healthMap[a.id].message">{{ healthMap[a.id].message }}</span>
            </div>
            <div class="adapter-actions">
              <button class="btn btn-sm btn-secondary" @click="healthCheckOne(a.id)" :disabled="healthChecking[a.id]">
                {{ healthChecking[a.id] ? '检测中...' : '健康检查' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ============ Tab 2: 基金级配置 ============ -->
    <div class="content-body" v-show="activeTab === 'funds'">
      <div class="section-card">
        <div class="section-header">
          <h3>基金级数据源</h3>
          <div class="header-ops">
            <input class="search-input" v-model="fundKeyword" placeholder="搜索代码/名称/拼音" @keyup.enter="searchFunds" />
            <button class="btn btn-primary btn-sm" @click="searchFunds">搜索</button>
          </div>
        </div>

        <div class="config-hint-block">
          单只基金可指定独立的数据源；设为"跟随全局"则使用全局默认源。
          <span class="config-hint-tip">提示：通过"实时对比"工具找出某只基金最准的数据源后再配置。</span>
        </div>

        <div class="loading-state" v-if="loadingFunds">
          <span class="spinner"></span>
          <span>加载中...</span>
        </div>

        <div class="table-container" v-else-if="funds.length > 0">
          <table class="data-table">
            <thead>
              <tr>
                <th>代码</th>
                <th>名称</th>
                <th>类型</th>
                <th>当前命中</th>
                <th>数据源</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="f in funds" :key="f.code">
                <td class="mono">{{ f.code }}</td>
                <td>{{ f.name }}</td>
                <td>{{ f.ftype || '-' }}</td>
                <td>
                  <span class="hit-tag" :title="`命中来源：${resolveLabel(f.resolvedFrom)}`">
                    {{ f.primaryId ? adapterShortName(f.primaryId) : '-' }}
                    <span class="hit-from">{{ resolveLabel(f.resolvedFrom) }}</span>
                  </span>
                </td>
                <td>
                  <div class="fund-source-chips">
                    <button
                      :class="['fund-chip', { active: !f.estimate_source }]"
                      @click="setFundSource(f.code, '')"
                      title="跟随全局默认源"
                    >全局</button>
                    <button
                      v-for="a in adapters"
                      :key="a.id"
                      :class="['fund-chip', a.category, { active: f.estimate_source === a.id }]"
                      @click="setFundSource(f.code, a.id)"
                      :title="a.name"
                    >{{ adapterShortLabel(a.id) }}</button>
                  </div>
                </td>
                <td>
                  <button
                    class="btn btn-sm btn-link"
                    v-if="f.estimate_source"
                    @click="setFundSource(f.code, '')"
                  >清除</button>
                  <button class="btn btn-sm btn-link" @click="goCompare(f.code)">对比</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="empty-state" v-else>
          <p>暂无基金数据</p>
        </div>

        <div class="pagination" v-if="fundsTotal > fundsPageSize">
          <button class="page-btn" :disabled="fundsPage <= 1" @click="changePage(fundsPage - 1)">上一页</button>
          <span class="page-info">{{ fundsPage }} / {{ Math.ceil(fundsTotal / fundsPageSize) }}（共 {{ fundsTotal }} 条）</span>
          <button class="page-btn" :disabled="fundsPage * fundsPageSize >= fundsTotal" @click="changePage(fundsPage + 1)">下一页</button>
        </div>
      </div>
    </div>

    <!-- ============ Tab 3: 实时对比 ============ -->
    <div class="content-body" v-show="activeTab === 'compare'">
      <div class="section-card">
        <div class="section-header">
          <h3>实时对比工具</h3>
        </div>

        <div class="compare-input-row">
          <input class="search-input compare-input" v-model="compareCode" placeholder="输入基金代码，如 110022" @keyup.enter="runCompare" />
          <button class="btn btn-primary btn-sm" @click="runCompare" :disabled="comparing || !compareCode.trim()">
            {{ comparing ? '对比中...' : '开始对比' }}
          </button>
        </div>

        <div class="config-hint-block">
          并行查询所有数据源的单点估值，对比 gsz（估算净值）和 gszzl（估算涨跌幅），
          找出最接近实际涨幅的数据源。建议在交易时段使用。
        </div>

        <!-- 最近对比历史 -->
        <div class="compare-history" v-if="compareHistory.length > 0">
          <span class="history-label">最近对比：</span>
          <button
            class="history-chip"
            v-for="h in compareHistory"
            :key="h.code"
            @click="replayHistory(h.code)"
            :title="h.name || h.code"
          >
            <span class="history-code">{{ h.code }}</span>
            <span class="history-name" v-if="h.name">{{ h.name }}</span>
          </button>
          <button class="history-clear" @click="clearHistory" title="清空历史">清空</button>
        </div>

        <div class="loading-state" v-if="comparing">
          <span class="spinner"></span>
          <span>正在查询各数据源...</span>
        </div>

        <!-- 当前对比的基金信息 -->
        <div class="compare-fund-info" v-if="compareResults.length > 0 && compareCurrentCode">
          <span class="fund-info-label">当前对比：</span>
          <span class="fund-info-code">{{ compareCurrentCode }}</span>
          <span class="fund-info-name" v-if="compareCurrentName">{{ compareCurrentName }}</span>
          <span class="fund-info-name fund-info-empty" v-else>（未知基金，未在基金库中）</span>
        </div>

        <div class="compare-results" v-if="compareResults.length > 0">
          <div class="compare-summary" v-if="compareBest">
            <span class="summary-label">最接近均值的数据源：</span>
            <span class="summary-value">{{ adapterShortName(compareBest.adapterId) }}</span>
            <span class="summary-detail">gsz={{ compareBest.point?.gsz }} / gszzl={{ compareBest.point?.gszzl }}%</span>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>数据源</th>
                  <th>类别</th>
                  <th>状态</th>
                  <th>估算净值 (gsz)</th>
                  <th>估算涨跌 (gszzl)</th>
                  <th>基准净值 (nav)</th>
                  <th>估值时间</th>
                  <th>延迟</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="r in compareResults"
                  :key="r.adapterId"
                  :class="{ 'row-best': compareBest && r.adapterId === compareBest.adapterId }"
                >
                  <td>
                    <div class="cell-adapter">
                      <span :class="['enabled-dot', r.enabled ? 'on' : 'off']"></span>
                      {{ r.adapterName }}
                    </div>
                  </td>
                  <td>{{ r.category === 'timeseries' ? '分时' : '单点' }}</td>
                  <td>
                    <span :class="['status-tag', r.point ? 'ok' : 'fail']">
                      {{ r.point ? '有数据' : (r.error || '无数据') }}
                    </span>
                  </td>
                  <td class="mono">{{ r.point?.gsz?.toFixed(4) ?? '-' }}</td>
                  <td :class="['mono', 'pct', r.point && r.point.gszzl > 0 ? 'up' : r.point && r.point.gszzl < 0 ? 'down' : '']">
                    {{ r.point ? (r.point.gszzl > 0 ? '+' : '') + r.point.gszzl.toFixed(2) + '%' : '-' }}
                  </td>
                  <td class="mono">{{ r.point?.nav?.toFixed(4) ?? '-' }}</td>
                  <td class="mono">{{ r.point?.gztime || '-' }}</td>
                  <td class="mono">{{ r.latency }}ms</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="empty-state" v-else-if="!comparing && compareTouched">
          <p>该基金暂无任何数据源返回估值数据</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

interface AdapterInfo {
  id: string
  name: string
  category: 'timeseries' | 'point'
  description: string
  enabled: boolean
}

interface HealthInfo {
  ok: boolean
  latency?: number
  message?: string
  checkedAt: number
}

interface CompareResult {
  adapterId: string
  adapterName: string
  category: string
  enabled: boolean
  latency: number
  point: { nav: number; gsz: number; gszzl: number; gztime: string } | null
  error: string | null
}

interface FundRow {
  code: string
  name: string
  ftype?: string
  estimate_source?: string | null
  primaryId?: string
  resolvedFrom?: string
}

const activeTab = ref('sources')

const adapters = ref<AdapterInfo[]>([])
const healthMap = ref<Record<string, HealthInfo>>({})
const defaultSource = ref('')
const fallbackChain = ref<string[]>([])

const loadingAdapters = ref(false)
const loadingConfig = ref(false)
const healthChecking = ref<Record<string, boolean>>({})
const healthCheckingAll = ref(false)

const chainAddId = ref('')

// ---- 统计概览 ----
const enabledCount = computed(() => adapters.value.filter(a => a.enabled).length)
const healthyCount = computed(() => {
  let n = 0
  for (const a of adapters.value) {
    const h = healthMap.value[a.id]
    if (h && h.ok) n++
  }
  return n
})

// ---- 工具函数 ----
function adapterName(id: string): string {
  return adapters.value.find(a => a.id === id)?.name || id
}
function adapterShortName(id: string): string {
  const a = adapters.value.find(x => x.id === id)
  return a ? `${a.name} (${id})` : id
}
/** 表格 chip 用的超简称 */
function adapterShortLabel(id: string): string {
  const map: Record<string, string> = {
    sina_v1: '新浪分时',
    sina_v2: '新浪分时2',
    sina_point: '新波单点',
    tiantian: '天天基金'
  }
  return map[id] || id
}
/** 数据源是否已检测且失效 */
function isSourceUnavailable(id: string): boolean {
  const h = healthMap.value[id]
  return h != null && !h.ok
}
function resolveLabel(from?: string): string {
  if (from === 'override') return '指定'
  if (from === 'fund') return '基金级'
  if (from === 'global') return '全局'
  return ''
}
function healthStatusClass(id: string): string {
  const h = healthMap.value[id]
  if (!h) return 'unknown'
  return h.ok ? 'ok' : 'fail'
}
function healthStatusText(id: string): string {
  const h = healthMap.value[id]
  if (!h) return '未检测'
  return `${h.ok ? '正常' : '异常'}${h.latency != null ? ` ${h.latency}ms` : ''}${h.message ? ' ' + h.message : ''}`
}

// ---- 加载 ----
async function loadAdapters() {
  loadingAdapters.value = true
  try {
    const { data } = await axios.get('/api/admin/estimate-sources')
    adapters.value = data
    // 同步健康状态
    for (const a of data) {
      const h = (a as any).health
      if (h) healthMap.value[a.id] = h
    }
  } catch (e: any) {
    alert(e.response?.data?.error || '加载数据源失败')
  } finally {
    loadingAdapters.value = false
  }
}

async function loadConfig() {
  loadingConfig.value = true
  try {
    const { data } = await axios.get('/api/admin/estimate-sources/config')
    defaultSource.value = data.defaultSource
    fallbackChain.value = data.fallbackChain || []
    if (adapters.value.length === 0) {
      adapters.value = data.adapters
    }
  } catch (e: any) {
    alert(e.response?.data?.error || '加载配置失败')
  } finally {
    loadingConfig.value = false
  }
}

// ---- 全局配置 ----
async function saveDefaultSource() {
  try {
    await axios.put('/api/admin/estimate-sources/default', { id: defaultSource.value })
  } catch (e: any) {
    alert(e.response?.data?.error || '设置默认源失败')
    await loadConfig()
  }
}

const chainCandidates = computed(() => {
  return adapters.value
    .filter(a => a.enabled && !fallbackChain.value.includes(a.id))
    .map(a => a.id)
})

function moveChain(idx: number, delta: number) {
  const newIdx = idx + delta
  if (newIdx < 0 || newIdx >= fallbackChain.value.length) return
  const arr = [...fallbackChain.value]
  ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
  fallbackChain.value = arr
}
function removeChain(idx: number) {
  fallbackChain.value = fallbackChain.value.filter((_, i) => i !== idx)
}
function addChain() {
  if (!chainAddId.value) return
  fallbackChain.value = [...fallbackChain.value, chainAddId.value]
  chainAddId.value = ''
}
async function saveFallbackChain() {
  try {
    const { data } = await axios.put('/api/admin/estimate-sources/fallback-chain', { chain: fallbackChain.value })
    fallbackChain.value = data.fallbackChain
  } catch (e: any) {
    alert(e.response?.data?.error || '保存降级链失败')
    await loadConfig()
  }
}

// ---- 启用状态 ----
async function toggleEnabled(id: string, enabled: boolean) {
  try {
    await axios.put(`/api/admin/estimate-sources/${id}/enabled`, { enabled })
    const a = adapters.value.find(x => x.id === id)
    if (a) a.enabled = enabled
  } catch (e: any) {
    alert(e.response?.data?.error || '切换状态失败')
    await loadAdapters()
  }
}

// ---- 健康检查 ----
async function healthCheckOne(id: string) {
  healthChecking.value[id] = true
  try {
    const { data } = await axios.post(`/api/admin/estimate-sources/${id}/health-check`)
    healthMap.value[id] = data.health
  } catch (e: any) {
    alert(e.response?.data?.error || '健康检查失败')
  } finally {
    healthChecking.value[id] = false
  }
}
async function healthCheckAll() {
  healthCheckingAll.value = true
  try {
    const { data } = await axios.post('/api/admin/estimate-sources/health-check-all')
    healthMap.value = { ...healthMap.value, ...data }
  } catch (e: any) {
    alert(e.response?.data?.error || '批量健康检查失败')
  } finally {
    healthCheckingAll.value = false
  }
}

// ---- 基金级配置 ----
const funds = ref<FundRow[]>([])
const fundsTotal = ref(0)
const fundsPage = ref(1)
const fundsPageSize = ref(20)
const fundKeyword = ref('')
const loadingFunds = ref(false)

async function loadFunds() {
  loadingFunds.value = true
  try {
    const { data } = await axios.get('/api/admin/fund-info', {
      params: { page: fundsPage.value, pageSize: fundsPageSize.value, keyword: fundKeyword.value || undefined }
    })
    const list: any[] = data.list || []
    // 批量查询每只基金的命中数据源（并行，限制并发避免压力）
    const results = await Promise.all(list.map(async (f) => {
      try {
        const { data: res } = await axios.get(`/api/admin/estimate-sources/fund/${f.code}`)
        return {
          code: f.code,
          name: f.name,
          ftype: f.ftype,
          estimate_source: f.estimate_source ?? null,
          primaryId: res.primaryId,
          resolvedFrom: res.resolvedFrom
        } as FundRow
      } catch {
        return {
          code: f.code,
          name: f.name,
          ftype: f.ftype,
          estimate_source: f.estimate_source ?? null
        } as FundRow
      }
    }))
    funds.value = results
    fundsTotal.value = data.total || 0
  } catch (e: any) {
    alert(e.response?.data?.error || '加载基金列表失败')
  } finally {
    loadingFunds.value = false
  }
}

function searchFunds() {
  fundsPage.value = 1
  loadFunds()
}
function changePage(p: number) {
  fundsPage.value = p
  loadFunds()
}

async function setFundSource(code: string, source: string) {
  try {
    await axios.put(`/api/admin/estimate-sources/fund/${code}`, { source: source || null })
    const f = funds.value.find(x => x.code === code)
    if (f) {
      f.estimate_source = source || null
      // 重新查询命中
      try {
        const { data } = await axios.get(`/api/admin/estimate-sources/fund/${code}`)
        f.primaryId = data.primaryId
        f.resolvedFrom = data.resolvedFrom
      } catch {}
    }
  } catch (e: any) {
    alert(e.response?.data?.error || '设置基金数据源失败')
  }
}

function goCompare(code: string) {
  compareCode.value = code
  activeTab.value = 'compare'
  runCompare()
}

// ---- 实时对比 ----
const compareCode = ref('')
const compareResults = ref<CompareResult[]>([])
const comparing = ref(false)
const compareTouched = ref(false)
// 当前对比的基金信息（名称从后端返回）
const compareCurrentCode = ref('')
const compareCurrentName = ref('')

// 最近对比历史（localStorage 持久化，最多 5 条）
const COMPARE_HISTORY_KEY = 'estimate_compare_history'
const COMPARE_HISTORY_MAX = 5

interface CompareHistoryItem {
  code: string
  name: string
}

const compareHistory = ref<CompareHistoryItem[]>([])

function loadCompareHistory() {
  try {
    const raw = localStorage.getItem(COMPARE_HISTORY_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) {
        compareHistory.value = arr.filter((x: any) => x && typeof x.code === 'string').slice(0, COMPARE_HISTORY_MAX)
      }
    }
  } catch { /* ignore */ }
}

function saveCompareHistory(code: string, name: string) {
  // 去重后放到顶部
  const filtered = compareHistory.value.filter(x => x.code !== code)
  // 如果本次没拿到名称，尝试沿用历史里的名称
  const finalName = name || filtered.find(x => x.code === code)?.name || ''
  filtered.unshift({ code, name: finalName })
  compareHistory.value = filtered.slice(0, COMPARE_HISTORY_MAX)
  try {
    localStorage.setItem(COMPARE_HISTORY_KEY, JSON.stringify(compareHistory.value))
  } catch { /* ignore */ }
}

function clearHistory() {
  compareHistory.value = []
  try { localStorage.removeItem(COMPARE_HISTORY_KEY) } catch { /* ignore */ }
}

function replayHistory(code: string) {
  compareCode.value = code
  runCompare()
}

async function runCompare() {
  if (!compareCode.value.trim()) return
  const code = compareCode.value.trim()
  comparing.value = true
  compareTouched.value = true
  compareResults.value = []
  compareCurrentCode.value = code
  compareCurrentName.value = ''
  try {
    const { data } = await axios.post('/api/admin/estimate-sources/compare', { code })
    compareResults.value = data.results || []
    compareCurrentName.value = data.name || compareHistory.value.find(x => x.code === code)?.name || ''
    // 对比成功后写入历史
    saveCompareHistory(code, compareCurrentName.value)
  } catch (e: any) {
    alert(e.response?.data?.error || '对比失败')
  } finally {
    comparing.value = false
  }
}

const compareBest = computed(() => {
  const valid = compareResults.value.filter(r => r.point && r.point.gsz > 0)
  if (valid.length === 0) return null
  // 取 gszzl 中位数最接近的数据源（简单启发式：最接近所有有效源均值）
  const zzls = valid.map(r => r.point!.gszzl)
  const avg = zzls.reduce((s, v) => s + v, 0) / zzls.length
  let best = valid[0]
  let bestDiff = Infinity
  for (const r of valid) {
    const diff = Math.abs(r.point!.gszzl - avg)
    if (diff < bestDiff) {
      bestDiff = diff
      best = r
    }
  }
  return best
})

onMounted(async () => {
  loadCompareHistory()
  await Promise.all([loadAdapters(), loadConfig()])
  loadFunds()
})
</script>

<style scoped>
.estimate-source-page {
  padding: 0;
}

.page-header {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
}
.page-title {
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 600;
  color: #2563eb;
}
.page-subtitle {
  margin: 0;
  font-size: 14px;
  color: #64748b;
}

/* 统计概览 */
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}
.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  transition: all 0.2s;
}
.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}
.stat-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  flex-shrink: 0;
}
.stat-total .stat-icon-wrap { background: linear-gradient(135deg, #2563eb, #3b82f6); color: #fff; }
.stat-enabled .stat-icon-wrap { background: linear-gradient(135deg, #10b981, #34d399); color: #fff; }
.stat-healthy .stat-icon-wrap { background: linear-gradient(135deg, #059669, #10b981); color: #fff; }
.stat-default .stat-icon-wrap { background: linear-gradient(135deg, #f59e0b, #fbbf24); color: #fff; }
.stat-icon { font-size: 20px; font-weight: 700; }
.stat-body { display: flex; flex-direction: column; min-width: 0; }
.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.2;
}
.stat-default .stat-value { font-size: 14px; }
.text-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stat-label {
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
}

.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 20px;
}
.tab {
  padding: 8px 18px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  color: #64748b;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}
.tab:hover { color: #2563eb; }
.tab.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
  font-weight: 600;
}

.content-body { display: block; }

.section-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 18px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.section-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
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
.header-ops {
  display: flex;
  gap: 8px;
  align-items: center;
}

.config-row { margin-bottom: 28px; }
.config-item { display: flex; flex-direction: column; gap: 6px; max-width: 760px; }
.config-item-chain { max-width: none; }
.config-label {
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
}
.config-hint {
  font-size: 12px;
  color: #94a3b8;
}

/* 全局默认源按钮组（segmented control） */
.source-pick-group {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
}
.source-pick {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px 16px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
  min-width: 0;
  overflow: hidden;
  position: relative;
}
.source-pick.active::after {
  content: '✓';
  position: absolute;
  top: 3px;
  right: 8px;
  font-size: 13px;
  font-weight: 700;
  color: #2563eb;
}
.source-pick:hover {
  border-color: #93c5fd;
  background: #eff6ff;
}
.source-pick.active {
  border-color: #2563eb;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  box-shadow: 0 2px 8px rgba(37,99,235,0.15);
}
.source-pick-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.source-pick-dot.timeseries { background: #3b82f6; }
.source-pick-dot.point { background: #f59e0b; }
.source-pick-dot.fail { background: #ef4444 !important; }
.source-pick.unavailable {
  background: #f8fafc;
  border-color: #e2e8f0;
  opacity: 0.6;
}
.source-pick.unavailable .source-pick-name { color: #94a3b8; }
.source-pick-status {
  font-size: 10px;
  font-weight: 600;
  color: #ef4444;
  background: #fee2e2;
  padding: 1px 5px;
  border-radius: 3px;
}
.source-pick-name {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
}
.source-pick.active .source-pick-name { color: #1d4ed8; }
.source-pick-cat {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 600;
}
.source-pick-cat.timeseries { background: #dbeafe; color: #2563eb; }
.source-pick-cat.point { background: #fef3c7; color: #d97706; }

/* 基金级配置表格 chip 组 */
.fund-source-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.fund-chip {
  padding: 3px 9px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  border-radius: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.12s;
}
.fund-chip:hover {
  border-color: #93c5fd;
  color: #2563eb;
}
.fund-chip.active {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
.fund-chip.timeseries.active { background: #2563eb; border-color: #2563eb; }
.fund-chip.point.active { background: #d97706; border-color: #d97706; }

.form-select, .form-input, .search-input {
  padding: 7px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
  color: #1e293b;
  transition: border-color 0.15s;
}
.form-select-sm { padding: 5px 10px; font-size: 12px; }
.form-select:focus, .search-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }

.chain-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
.chain-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  transition: all 0.15s;
}
.chain-item:hover { background: #f1f5f9; }
.chain-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: #fff;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}
.chain-name { font-size: 13px; font-weight: 600; color: #1e293b; }
.chain-code { font-size: 12px; color: #94a3b8; font-family: ui-monospace, monospace; }
.chain-ops { margin-left: auto; display: flex; gap: 4px; }
.chain-op {
  width: 26px; height: 26px;
  border: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 5px;
  cursor: pointer;
  font-size: 13px;
  color: #64748b;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.chain-op:hover:not(:disabled) { background: #eff6ff; border-color: #93c5fd; color: #2563eb; }
.chain-op:disabled { opacity: 0.4; cursor: not-allowed; }
.chain-op-del { color: #ef4444; }
.chain-op-del:hover:not(:disabled) { background: #fef2f2; border-color: #fca5a5; color: #dc2626; }
.chain-empty { padding: 16px; color: #94a3b8; font-size: 13px; text-align: center; }
.chain-add { display: flex; gap: 8px; margin-top: 8px; align-items: center; }
.chain-save { margin-top: 10px; align-self: flex-start; }

.adapter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
  gap: 16px;
}
.adapter-card {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  transition: all 0.2s;
}
.adapter-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  border-color: #cbd5e1;
}
.adapter-card.disabled { opacity: 0.5; }
.adapter-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.adapter-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.adapter-name { font-size: 15px; font-weight: 600; color: #1e293b; }
.adapter-id {
  font-size: 12px;
  color: #94a3b8;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.adapter-desc {
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}
.adapter-health {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  flex-wrap: wrap;
  padding: 8px 10px;
  background: #f8fafc;
  border-radius: 6px;
}
.health-tag {
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}
.health-tag.ok { background: #d1fae5; color: #059669; }
.health-tag.fail { background: #fee2e2; color: #dc2626; }
.health-latency { font-family: ui-monospace, monospace; color: #64748b; font-size: 11px; }
.health-msg { color: #94a3b8; font-size: 11px; }
.adapter-actions { display: flex; gap: 6px; margin-top: 2px; }

.health-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.health-dot.ok { background: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,0.15); }
.health-dot.fail { background: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,0.15); }
.health-dot.unknown { background: #cbd5e1; }

.category-badge {
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.3px;
}
.category-badge.timeseries { background: #dbeafe; color: #2563eb; }
.category-badge.point { background: #fef3c7; color: #d97706; }

.switch { position: relative; display: inline-block; width: 38px; height: 22px; }
.switch input { opacity: 0; width: 0; height: 0; }
.switch-slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background: #cbd5e1;
  border-radius: 22px;
  transition: 0.2s;
}
.switch-slider::before {
  content: '';
  position: absolute;
  height: 18px; width: 18px;
  left: 2px; bottom: 2px;
  background: #fff;
  border-radius: 50%;
  transition: 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.switch input:checked + .switch-slider { background: #10b981; }
.switch input:checked + .switch-slider::before { transform: translateX(16px); }

.btn {
  padding: 7px 14px;
  border: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #475569;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s;
}
.btn:hover:not(:disabled) { background: #f8fafc; border-color: #cbd5e1; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm { padding: 5px 10px; font-size: 12px; }
.btn-primary {
  background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
  color: #fff;
  border: none;
  font-weight: 500;
}
.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59,130,246,0.3);
}
.btn-secondary { background: #fff; color: #475569; }
.btn-link {
  background: none;
  border: none;
  color: #3b82f6;
  padding: 3px 8px;
  cursor: pointer;
  font-size: 12px;
  border-radius: 4px;
  transition: all 0.15s;
}
.btn-link:hover { background: #dbeafe; }

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px;
  color: #64748b;
}
.spinner {
  width: 18px; height: 18px;
  border: 2px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.table-container {
  overflow-x: auto;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.data-table th, .data-table td {
  padding: 10px 14px;
  text-align: left;
  border-bottom: 1px solid #f1f5f9;
}
.data-table th {
  background: #f8fafc;
  font-weight: 600;
  font-size: 12px;
  color: #475569;
  white-space: nowrap;
}
.data-table tbody tr { transition: background 0.1s; }
.data-table tbody tr:hover { background: #f8fafc; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

.hit-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  background: #f1f5f9;
  border-radius: 5px;
  font-size: 12px;
  color: #334155;
}
.hit-from { font-size: 10px; color: #94a3b8; }

.config-hint-block {
  padding: 12px 14px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-left: 3px solid #f59e0b;
  border-radius: 6px;
  font-size: 12px;
  color: #92400e;
  margin-bottom: 14px;
  line-height: 1.6;
}
.config-hint-tip { color: #b45309; }

.search-input { min-width: 220px; }

.compare-input-row {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}
.compare-input { min-width: 300px; }

.compare-history {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 0;
  margin-bottom: 8px;
  border-top: 1px dashed #e2e8f0;
  border-bottom: 1px dashed #e2e8f0;
}
.history-label {
  font-size: 12px;
  color: #64748b;
  white-space: nowrap;
  font-weight: 500;
}
.history-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  cursor: pointer;
  font-size: 12px;
  color: #334155;
  transition: all 0.15s;
}
.history-chip:hover {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: #fff;
  border-color: transparent;
  transform: translateY(-1px);
}
.history-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 700;
}
.history-name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.history-clear {
  margin-left: auto;
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.15s;
}
.history-clear:hover { background: #fef2f2; text-decoration: none; }

.compare-fund-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%);
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  margin-bottom: 14px;
  font-size: 13px;
}
.fund-info-label { color: #64748b; }
.fund-info-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 700;
  color: #2563eb;
  font-size: 14px;
}
.fund-info-name { color: #1e40af; font-weight: 500; }
.fund-info-empty { color: #94a3b8; font-style: italic; }

.compare-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  border: 1px solid #a7f3d0;
  border-radius: 8px;
  margin-bottom: 14px;
  font-size: 13px;
}
.summary-label { color: #065f46; }
.summary-value { font-weight: 700; color: #047857; }
.summary-detail { font-family: ui-monospace, monospace; color: #047857; font-size: 12px; }

.row-best { background: #ecfdf5 !important; }

.cell-adapter {
  display: flex;
  align-items: center;
  gap: 7px;
}
.enabled-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  display: inline-block;
}
.enabled-dot.on { background: #10b981; }
.enabled-dot.off { background: #cbd5e1; }

.status-tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}
.status-tag.ok { background: #d1fae5; color: #059669; }
.status-tag.fail { background: #fee2e2; color: #dc2626; }

.pct.up { color: #dc2626; font-weight: 500; }
.pct.down { color: #059669; font-weight: 500; }

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-top: 16px;
  font-size: 13px;
}
.page-btn {
  padding: 6px 14px;
  border: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  color: #475569;
  transition: all 0.15s;
}
.page-btn:hover:not(:disabled) { background: #f8fafc; border-color: #cbd5e1; }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.page-info { color: #64748b; }

.empty-state {
  text-align: center;
  padding: 48px;
  color: #94a3b8;
  font-size: 13px;
}
</style>
