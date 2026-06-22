<template>
  <div class="system-update-page">
    <div class="page-header">
      <h2 class="page-title">系统更新</h2>
      <p class="page-desc">从 GitHub 拉取最新代码、编译构建并重启应用</p>
    </div>

    <div class="content-body">
      <!-- 执行控制区 -->
      <div class="section-card exec-card">
        <!-- 状态指示条 -->
        <div :class="['exec-status', statusTheme]">
          <svg v-if="state.running" class="spinner-icon" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" stroke-opacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
          </svg>
          <svg v-else-if="state.stage === 'done'" viewBox="0 0 24 24" fill="none" class="status-icon">
            <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
          </svg>
          <svg v-else-if="state.stage === 'error'" viewBox="0 0 24 24" fill="none" class="status-icon">
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
            <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" class="status-icon">
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
            <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          <div class="status-text">
            <span class="status-label">{{ state.stage_text }}</span>
            <span class="status-progress" v-if="state.progress">{{ state.progress }}</span>
          </div>
          <div class="status-time" v-if="state.started_at">
            <span v-if="state.running">开始: {{ state.started_at }}</span>
            <span v-else-if="state.finished_at">完成: {{ state.finished_at }}</span>
          </div>
        </div>

        <!-- 主操作 -->
        <div class="action-area">
          <button
            class="hero-btn"
            @click="runUpdate('full')"
            :disabled="state.running"
          >
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 2v6m0 0l3-3m-3 3L9 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M4 12a8 8 0 0 0 8 8 8 8 0 0 0 8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
            一键更新
          </button>

          <!-- 子操作卡片 -->
          <div class="action-cards">
            <button class="action-card card-download" @click="runUpdate('download')" :disabled="state.running">
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0l4-4m-4 4l-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
              <span>下载</span>
            </button>
            <button class="action-card card-deploy" @click="runUpdate('deploy')" :disabled="state.running">
              <svg viewBox="0 0 24 24" fill="none"><path d="M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /><path d="M12 11v10" stroke="currentColor" stroke-width="1.8" /></svg>
              <span>部署</span>
            </button>
            <button class="action-card card-install" @click="runUpdate('install')" :disabled="state.running">
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" /></svg>
              <span>安装依赖</span>
            </button>
            <button class="action-card card-build" @click="runUpdate('build')" :disabled="state.running">
              <svg viewBox="0 0 24 24" fill="none"><path d="M14.7 6.3l3 3M3 21l6-6m-3-3l8-8 4 4-8 8H6v-3z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
              <span>编译</span>
            </button>
            <button class="action-card card-restart" @click="runUpdate('restart')" :disabled="state.running">
              <svg viewBox="0 0 24 24" fill="none"><path d="M4 12a8 8 0 0 1 8-8 8 8 0 0 1 6 2.7L20 4v5h-5l1.7-1.7A6 6 0 0 0 12 6a6 6 0 1 0 6 6h2a8 8 0 0 1-8 8 8 8 0 0 1-8-8z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
              <span>重启</span>
            </button>
            <button class="action-card card-stop" @click="runUpdate('stop')" :disabled="state.running">
              <svg viewBox="0 0 24 24" fill="none"><rect x="5" y="5" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.8" /></svg>
              <span>关闭</span>
            </button>
          </div>
        </div>

        <!-- 辅助操作 -->
        <div class="aux-actions">
          <button class="btn btn-sm btn-secondary" @click="loadStatus">
            <svg viewBox="0 0 24 24" fill="none" class="btn-icon"><path d="M4 12a8 8 0 0 1 8-8 8 8 0 0 1 6 2.7L20 4v5h-5l1.7-1.7A6 6 0 0 0 12 6a6 6 0 1 0 6 6h2a8 8 0 0 1-8 8 8 8 0 0 1-8-8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
            刷新状态
          </button>
          <button class="btn btn-sm btn-secondary" @click="clearLogs">清空日志</button>
        </div>
      </div>

      <!-- 更新日志 -->
      <div class="section-card">
        <div class="section-header">
          <h3>更新日志</h3>
          <span class="log-count" v-if="state.logs.length">{{ state.logs.length }} 行</span>
        </div>
        <div class="update-log-container" ref="logContainer">
          <div v-if="state.logs.length === 0" class="log-empty">暂无日志</div>
          <div
            v-for="(line, i) in state.logs"
            :key="i"
            :class="['log-line', logLineClass(line)]"
          >{{ line }}</div>
        </div>
      </div>

      <!-- 配置表单 -->
      <div class="section-card">
        <div class="section-header">
          <h3>更新配置</h3>
          <button class="btn btn-sm btn-primary" @click="saveConfig" :disabled="savingConfig">
            {{ savingConfig ? '保存中...' : '保存配置' }}
          </button>
        </div>

        <div class="config-form">
          <!-- GitHub 配置 -->
          <div class="config-group">
            <h4 class="config-group-title">GitHub 下载</h4>
            <div class="config-row">
              <label class="config-label">
                <input type="checkbox" v-model="config.github_enabled" />
                <span>启用 GitHub 下载</span>
              </label>
            </div>
            <div class="config-row">
              <label class="config-label-text">GitHub Token</label>
              <input
                v-model="config.github_token"
                type="password"
                class="config-input"
                placeholder="可选，私有仓库需要"
              />
            </div>
            <div class="config-row">
              <label class="config-label-text">分支</label>
              <input v-model="config.github_branch" class="config-input" placeholder="main" />
            </div>
            <div class="config-row">
              <label class="config-label-text">HTTP 代理</label>
              <div class="proxy-input-group">
                <input v-model="config.proxy" class="config-input" placeholder="http://127.0.0.1:7890" />
                <button class="btn btn-sm btn-secondary" @click="probeProxyPorts">探测代理</button>
              </div>
            </div>
            <div class="config-row" v-if="proxyResults.length > 0">
              <label class="config-label-text">可用代理</label>
              <div class="proxy-tags">
                <span
                  v-for="p in proxyResults"
                  :key="p.port"
                  class="proxy-tag"
                  @click="config.proxy = p.proxy"
                >{{ p.name }} ({{ p.port }})</span>
              </div>
            </div>
            <div class="config-row">
              <button class="btn btn-sm btn-secondary" @click="testGithub" :disabled="testingGithub">
                {{ testingGithub ? '测试中...' : '测试连接' }}
              </button>
            </div>
            <div class="config-row" v-if="githubTestResult">
              <div :class="['test-result', githubTestResult.ok ? 'success' : 'error']">
                {{ githubTestResult.message }}
              </div>
            </div>
            <div class="config-row" v-if="githubTestLogs.length > 0">
              <div class="test-logs">
                <div v-for="(line, i) in githubTestLogs" :key="i" class="test-log-line">{{ line }}</div>
              </div>
            </div>
          </div>

          <!-- 构建配置 -->
          <div class="config-group">
            <h4 class="config-group-title">安装与构建</h4>
            <div class="config-row">
              <label class="config-label">
                <input type="checkbox" v-model="config.install_enabled" />
                <span>一键更新时自动安装依赖 (npm install)</span>
              </label>
            </div>
            <div class="config-row">
              <label class="config-label">
                <input type="checkbox" v-model="config.build_enabled" />
                <span>一键更新时自动编译构建</span>
              </label>
            </div>
            <div class="config-row">
              <label class="config-label-text">编译命令</label>
              <input v-model="config.build_command" class="config-input" placeholder="npm run build" />
            </div>
            <div class="config-row">
              <label class="config-label-text">编译超时(秒)</label>
              <input v-model.number="config.build_timeout" type="number" class="config-input config-narrow" min="60" max="3600" />
            </div>
          </div>

          <!-- 重启配置 -->
          <div class="config-group">
            <h4 class="config-group-title">重启配置</h4>
            <div class="config-row">
              <label class="config-label-text">启动命令</label>
              <input v-model="config.restart_command" class="config-input" :placeholder="shellInfo.default_restart || 'npm run server'" />
            </div>
            <div class="config-row">
              <label class="config-label-text">应用端口</label>
              <input v-model.number="config.app_port" type="number" class="config-input config-narrow" min="1" max="65535" />
            </div>
          </div>

          <!-- 部署排除 -->
          <div class="config-group">
            <h4 class="config-group-title">部署排除（每行一个）</h4>
            <textarea
              v-model="deployExcludesText"
              class="config-textarea"
              rows="6"
              placeholder="如 .env, db/, node_modules/"
            ></textarea>
          </div>
        </div>
      </div>

      <!-- 环境信息 -->
      <div class="section-card env-info-card">
        <div class="section-header">
          <h3>环境信息</h3>
        </div>
        <div class="env-grid">
          <div class="env-item">
            <span class="env-label">操作系统</span>
            <span class="env-value">{{ shellInfo.os_label || '-' }}</span>
          </div>
          <div class="env-item">
            <span class="env-label">Shell</span>
            <span class="env-value">{{ shellInfo.shell || '-' }}</span>
          </div>
          <div class="env-item">
            <span class="env-label">默认启动命令</span>
            <span class="env-value">{{ shellInfo.default_restart || '-' }}</span>
          </div>
          <div class="env-item">
            <span class="env-label">默认编译命令</span>
            <span class="env-value">{{ shellInfo.default_build || '-' }}</span>
          </div>
          <div class="env-item" v-if="packagesInfo.dir">
            <span class="env-label">代码包目录</span>
            <span class="env-value mono">{{ packagesInfo.dir }}</span>
          </div>
          <div class="env-item">
            <span class="env-label">代码包数量</span>
            <span class="env-value">{{ packagesInfo.count || 0 }}</span>
          </div>
        </div>
        <p class="env-hint" v-if="shellInfo.hint">{{ shellInfo.hint }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import axios from 'axios'

interface UpdateState {
  running: boolean
  stage: string
  stage_text: string
  progress: string
  started_at: string | null
  finished_at: string | null
  logs: string[]
  error: string | null
  os_type: string
}

interface ShellInfo {
  os_type: string
  os_label: string
  shell: string
  default_restart: string
  default_build: string
  hint: string
}

interface PackagesInfo {
  dir: string
  count: number
  packages: { name: string; mtime: number }[]
  active: string | null
}

const state = reactive<UpdateState>({
  running: false,
  stage: 'idle',
  stage_text: '空闲',
  progress: '',
  started_at: null,
  finished_at: null,
  logs: [],
  error: null,
  os_type: '',
})

const shellInfo = reactive<Partial<ShellInfo>>({})
const packagesInfo = reactive<Partial<PackagesInfo>>({})

const config = reactive({
  github_enabled: true,
  github_url: '',
  github_branch: 'main',
  github_token: '',
  download_dir: 'deploy',
  deploy_excludes: [] as string[],
  package_keep: 5,
  project_root: '',
  app_port: 3010,
  proxy: '',
  build_enabled: true,
  build_command: 'npm run build',
  build_cwd: '',
  build_timeout: 600,
  install_enabled: true,
  restart_command: '',
  restart_script: '',
})

const deployExcludesText = ref('')
const savingConfig = ref(false)
const testingGithub = ref(false)
const githubTestResult = ref<{ ok: boolean; message: string } | null>(null)
const githubTestLogs = ref<string[]>([])
const proxyResults = ref<{ port: number; name: string; proxy: string }[]>([])
const logContainer = ref<HTMLElement | null>(null)

let pollTimer: ReturnType<typeof setInterval> | null = null

const statusTheme = computed(() => {
  if (state.running) return 'running'
  if (state.stage === 'done') return 'done'
  if (state.stage === 'error') return 'error'
  return 'idle'
})

function logLineClass(line: string): string {
  if (line.includes('[ERROR]')) return 'log-error'
  if (line.includes('[WARNING]')) return 'log-warning'
  if (line.includes('====') || line.includes('####')) return 'log-divider'
  return ''
}

async function loadStatus() {
  try {
    const { data } = await axios.get('/api/admin/system/update/status')
    if (data.success) {
      const d = data.data
      Object.assign(state, {
        running: d.running,
        stage: d.stage,
        stage_text: d.stage_text,
        progress: d.progress,
        started_at: d.started_at,
        finished_at: d.finished_at,
        logs: d.logs || [],
        error: d.error,
        os_type: d.os_type,
      })
      if (d.shell_info) Object.assign(shellInfo, d.shell_info)
      if (d.packages_info) Object.assign(packagesInfo, d.packages_info)

      if (d.running && !pollTimer) {
        startPolling()
      } else if (!d.running && pollTimer) {
        stopPolling()
      }
      scrollToBottom()
    }
  } catch (e) {
    console.error('加载状态失败:', e)
  }
}

async function loadConfig() {
  try {
    const { data } = await axios.get('/api/admin/system/update/config')
    if (data.success) {
      Object.assign(config, data.data)
      deployExcludesText.value = (config.deploy_excludes || []).join('\n')
    }
  } catch (e) {
    console.error('加载配置失败:', e)
  }
}

async function saveConfig() {
  savingConfig.value = true
  try {
    config.deploy_excludes = deployExcludesText.value
      .split('\n')
      .map((s: string) => s.trim())
      .filter(Boolean)
    const { data } = await axios.post('/api/admin/system/update/config', config)
    if (data.success) {
      showToast('配置已保存', 'success')
    } else {
      showToast(data.message || '保存失败', 'error')
    }
  } catch (e) {
    showToast('保存失败', 'error')
  } finally {
    savingConfig.value = false
  }
}

const modeTextMap: Record<string, string> = {
  full: '确定要执行一键更新吗？\n\n将依次执行: 下载代码 → 部署 → 安装依赖 → 编译构建 → 重启应用',
  download: '确定要下载最新代码吗？',
  deploy: '确定要部署最新代码包吗？',
  install: '确定要安装依赖 (npm install) 吗？',
  build: '确定要执行编译构建吗？',
  restart: '确定要重启应用吗？\n\n将关闭当前应用并重新启动。',
  stop: '确定要关闭应用吗？\n\n关闭后需要手动重新启动！',
}

async function runUpdate(mode: string) {
  const text = modeTextMap[mode] || `确定要执行 ${mode} 吗？`
  if (!confirm(text)) return

  try {
    config.deploy_excludes = deployExcludesText.value
      .split('\n')
      .map((s: string) => s.trim())
      .filter(Boolean)
    await axios.post('/api/admin/system/update/config', config)

    const { data } = await axios.post('/api/admin/system/update/run', { mode })
    if (data.success) {
      showToast(data.message || '更新任务已启动', 'success')
      loadStatus()
    } else {
      showToast(data.message || '启动失败', 'error')
    }
  } catch (e) {
    showToast('操作失败', 'error')
  }
}

async function testGithub() {
  testingGithub.value = true
  githubTestResult.value = null
  githubTestLogs.value = []
  try {
    config.deploy_excludes = deployExcludesText.value
      .split('\n')
      .map((s: string) => s.trim())
      .filter(Boolean)
    await axios.post('/api/admin/system/update/config', config)

    const { data } = await axios.post('/api/admin/system/update/test-github')
    if (data.success && data.data) {
      githubTestResult.value = { ok: data.data.ok, message: data.data.message }
      githubTestLogs.value = data.data.logs || []
    }
  } catch (e) {
    githubTestResult.value = { ok: false, message: '请求失败' }
  } finally {
    testingGithub.value = false
  }
}

async function probeProxyPorts() {
  try {
    const { data } = await axios.get('/api/admin/system/update/probe-proxy')
    if (data.success && data.data) {
      proxyResults.value = data.data.available || []
      if (data.data.suggested && !config.proxy) {
        config.proxy = data.data.suggested.proxy
      }
    }
  } catch (e) {
    console.error('探测代理失败:', e)
  }
}

function clearLogs() {
  state.logs = []
}

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    await loadStatus()
    if (!state.running && pollTimer) {
      stopPolling()
      if (state.stage === 'done') {
        showToast('更新完成', 'success')
      } else if (state.stage === 'error') {
        showToast('更新失败: ' + (state.error || ''), 'error')
      }
    }
  }, 2000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
}

function showToast(msg: string, type: 'success' | 'error') {
  const el = document.createElement('div')
  el.className = `update-toast ${type}`
  el.textContent = msg
  document.body.appendChild(el)
  setTimeout(() => el.classList.add('show'), 10)
  setTimeout(() => {
    el.classList.remove('show')
    setTimeout(() => el.remove(), 300)
  }, 3000)
}

onMounted(() => {
  loadStatus()
  loadConfig()
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.system-update-page {
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
  color: #1e3a5f;
  margin: 0 0 8px 0;
}

.page-desc {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.content-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-header h3::before {
  content: '';
  width: 4px;
  height: 18px;
  background: linear-gradient(180deg, #1e3a5f 0%, #3b82f6 100%);
  border-radius: 2px;
}

/* 执行控制区 */
.exec-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-radius: 12px;
  margin-bottom: 20px;
  transition: all 0.3s;
}

.exec-status.idle {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #64748b;
}

.exec-status.running {
  background: #eff6ff;
  border: 1px solid #93c5fd;
  color: #2563eb;
}

.exec-status.done {
  background: #f0fdf4;
  border: 1px solid #86efac;
  color: #16a34a;
}

.exec-status.error {
  background: #fef2f2;
  border: 1px solid #fca5a5;
  color: #dc2626;
}

.status-icon,
.spinner-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.spinner-icon {
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.status-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.status-label {
  font-size: 15px;
  font-weight: 600;
}

.status-progress {
  font-size: 13px;
  opacity: 0.8;
}

.status-time {
  font-size: 12px;
  opacity: 0.7;
  font-family: 'SF Mono', Consolas, monospace;
}

/* 主操作按钮 */
.action-area {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.hero-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 14px 36px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #1e3a5f 0%, #3b82f6 100%);
  box-shadow: 0 4px 16px rgba(30, 58, 95, 0.35);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.hero-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(30, 58, 95, 0.45);
}

.hero-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hero-btn svg {
  width: 20px;
  height: 20px;
}

/* 子操作卡片 */
.action-cards {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  font-size: 12px;
  font-weight: 500;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
}

.action-card:hover:not(:disabled) {
  border-color: #3b82f6;
  color: #3b82f6;
  transform: translateY(-1px);
}

.action-card:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-card svg {
  width: 20px;
  height: 20px;
}

.card-download:hover:not(:disabled) { border-color: #3b82f6; color: #3b82f6; }
.card-deploy:hover:not(:disabled) { border-color: #8b5cf6; color: #8b5cf6; }
.card-install:hover:not(:disabled) { border-color: #f59e0b; color: #f59e0b; }
.card-build:hover:not(:disabled) { border-color: #10b981; color: #10b981; }
.card-restart:hover:not(:disabled) { border-color: #06b6d4; color: #06b6d4; }
.card-stop:hover:not(:disabled) { border-color: #ef4444; color: #ef4444; }

/* 辅助操作 */
.aux-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

/* 按钮通用 */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-icon {
  width: 14px;
  height: 14px;
}

.btn-primary {
  background: linear-gradient(135deg, #1e3a5f 0%, #3b82f6 100%);
  color: #fff;
  box-shadow: 0 2px 8px rgba(30, 58, 95, 0.3);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(30, 58, 95, 0.4);
}

.btn-secondary {
  background: #fff;
  color: #475569;
  border: 1px solid #e2e8f0;
}

.btn-secondary:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #cbd5e1;
}

/* 更新日志 */
.log-count {
  font-size: 12px;
  color: #94a3b8;
}

.update-log-container {
  background: #1e293b;
  border-radius: 12px;
  padding: 16px;
  max-height: 480px;
  overflow-y: auto;
  font-family: 'SF Mono', Consolas, 'Liberation Mono', monospace;
  font-size: 12.5px;
  line-height: 1.7;
}

.log-empty {
  color: #64748b;
  text-align: center;
  padding: 32px;
}

.log-line {
  color: #cbd5e1;
  white-space: pre-wrap;
  word-break: break-all;
}

.log-error {
  color: #fca5a5;
}

.log-warning {
  color: #fcd34d;
}

.log-divider {
  color: #60a5fa;
  font-weight: 600;
}

/* 配置表单 */
.config-form {
  display: grid;
  gap: 24px;
}

.config-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-group-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 4px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid #f1f5f9;
}

.config-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.config-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #334155;
  cursor: pointer;
}

.config-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #3b82f6;
}

.config-label-text {
  font-size: 13px;
  color: #64748b;
  width: 120px;
  flex-shrink: 0;
}

.config-input {
  flex: 1;
  max-width: 400px;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #1e293b;
  outline: none;
  transition: border-color 0.2s;
}

.config-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.config-narrow {
  max-width: 120px;
}

.config-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
  font-family: 'SF Mono', Consolas, monospace;
  color: #1e293b;
  outline: none;
  resize: vertical;
  transition: border-color 0.2s;
}

.config-textarea:focus {
  border-color: #3b82f6;
}

.proxy-input-group {
  display: flex;
  gap: 8px;
  flex: 1;
  max-width: 400px;
}

.proxy-input-group .config-input {
  max-width: none;
}

.proxy-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.proxy-tag {
  padding: 4px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  font-size: 12px;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
}

.proxy-tag:hover {
  border-color: #3b82f6;
  color: #3b82f6;
  background: #eff6ff;
}

.test-result {
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
}

.test-result.success {
  background: #dcfce7;
  color: #16a34a;
}

.test-result.error {
  background: #fee2e2;
  color: #dc2626;
}

.test-logs {
  background: #1e293b;
  border-radius: 8px;
  padding: 10px 12px;
  max-height: 200px;
  overflow-y: auto;
  width: 100%;
}

.test-log-line {
  font-family: 'SF Mono', Consolas, monospace;
  font-size: 12px;
  color: #cbd5e1;
  line-height: 1.6;
}

/* 环境信息 */
.env-info-card {
  background: #f8fafc;
}

.env-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.env-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.env-label {
  font-size: 12px;
  color: #94a3b8;
}

.env-value {
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
  word-break: break-all;
}

.env-value.mono {
  font-family: 'SF Mono', Consolas, monospace;
  font-size: 12px;
}

.env-hint {
  margin-top: 12px;
  font-size: 13px;
  color: #64748b;
  padding: 8px 12px;
  background: #fff;
  border-radius: 8px;
  border: 1px dashed #cbd5e1;
}

/* Toast */
:deep(.update-toast) {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 9999;
  padding: 12px 24px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  opacity: 0;
  transform: translateY(-10px);
  transition: all 0.3s;
}

:deep(.update-toast.show) {
  opacity: 1;
  transform: translateY(0);
}

:deep(.update-toast.success) {
  background: #16a34a;
  color: #fff;
}

:deep(.update-toast.error) {
  background: #dc2626;
  color: #fff;
}
</style>
