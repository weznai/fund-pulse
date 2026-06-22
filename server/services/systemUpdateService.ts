import fs from 'fs'
import path from 'path'
import os from 'os'
import net from 'net'
import { spawn, exec, execSync } from 'child_process'
import { fileURLToPath } from 'url'
import axios from 'axios'
import { pipeline } from 'stream/promises'
import { createWriteStream } from 'fs'
import { logger } from '../logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const LOG_DIR = path.join(PROJECT_ROOT, 'logs')
const UPDATE_LOG_FILE = path.join(LOG_DIR, 'update.log')
const UPDATE_CONFIG_PATH = path.join(PROJECT_ROOT, 'update-config.json')
const APP_PORT = 3010
const MAX_LOG_LINES = 1200

type Stage = 'idle' | 'starting' | 'downloading' | 'deploying' | 'building' | 'installing' | 'restarting' | 'stopping' | 'done' | 'error'

interface UpdateState {
  running: boolean
  stage: Stage
  stageText: string
  progress: string
  startedAt: string | null
  finishedAt: string | null
  logs: string[]
  error: string | null
  osType: string
}

const STAGE_TEXT: Record<Stage, string> = {
  idle: '空闲',
  starting: '启动中',
  downloading: '下载代码',
  deploying: '部署代码',
  building: '编译构建',
  installing: '安装依赖',
  restarting: '重启应用',
  stopping: '关闭应用',
  done: '已完成',
  error: '失败',
}

const updateState: UpdateState = {
  running: false,
  stage: 'idle',
  stageText: STAGE_TEXT.idle,
  progress: '',
  startedAt: null,
  finishedAt: null,
  logs: [],
  error: null,
  osType: '',
}

export interface UpdateConfig {
  github_enabled: boolean
  github_url: string
  github_branch: string
  github_token: string
  download_dir: string
  deploy_excludes: string[]
  package_keep: number
  project_root: string
  app_port: number
  proxy: string
  build_enabled: boolean
  build_command: string
  build_cwd: string
  build_timeout: number
  install_enabled: boolean
  restart_command: string
  restart_script: string
  pm2_app_name: string
}

const DEFAULT_UPDATE_CONFIG: UpdateConfig = {
  github_enabled: true,
  github_url: 'https://github.com/weznai/fund-pulse',
  github_branch: 'main',
  github_token: '',
  download_dir: 'deploy',
  deploy_excludes: [],
  package_keep: 3,
  project_root: '',
  app_port: APP_PORT,
  proxy: '',
  build_enabled: true,
  build_command: 'npm run build',
  build_cwd: '',
  build_timeout: 600,
  install_enabled: true,
  restart_command: '',
  restart_script: '',
  pm2_app_name: 'fund-pulse',
}

const DEFAULT_DEPLOY_EXCLUDES = [
  '.env',
  'update-config.json',
  'db/',
  'deploy/',
  'logs/',
  'server/reports/',
  '*.db',
  '*.db-wal',
  '*.db-shm',
  '*.bak',
  '*.backup',
  'node_modules/',
  'miniapp/node_modules/',
  'miniapp/dist/',
  'miniapp/unpackage/',
  'server/dist/',
  '.git/',
  '.idea/',
  '.vscode/',
  '.DS_Store',
  'Thumbs.db',
]

function now(): string {
  return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
}

function addLog(msg: string, level: 'INFO' | 'WARNING' | 'ERROR' = 'INFO'): void {
  const ts = now()
  const line = `[${ts}] [${level}] ${msg}`
  updateState.logs.push(line)
  if (updateState.logs.length > MAX_LOG_LINES) {
    updateState.logs = updateState.logs.slice(-MAX_LOG_LINES)
  }
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
    fs.appendFileSync(UPDATE_LOG_FILE, line + '\n', 'utf-8')
  } catch {
    // ignore
  }
  if (level === 'ERROR') {
    logger.error(`[system_update] ${msg}`)
  } else {
    logger.log(`[system_update] ${msg}`)
  }
}

export function getState(): UpdateState {
  return {
    ...updateState,
    logs: [...updateState.logs],
    osType: detectOs(),
  }
}

export function detectOs(): string {
  const platform = process.platform
  if (platform === 'win32') return 'windows'
  if (platform === 'linux') return 'linux'
  if (platform === 'darwin') return 'mac'
  return platform
}

export function getDefaultShellInfo() {
  const osType = detectOs()
  if (osType === 'windows') {
    return {
      os_type: osType,
      os_label: 'Windows',
      shell: 'cmd',
      default_restart: 'npm run server',
      default_script: '',
      default_build: 'npm run build',
      hint: 'Windows 下使用 npm run server 启动开发服务器。',
    }
  }
  if (osType === 'mac') {
    return {
      os_type: osType,
      os_label: 'macOS',
      shell: 'bash',
      default_restart: 'npm run server',
      default_script: '',
      default_build: 'npm run build',
      hint: 'macOS 下建议使用 npm run server 启动；启动脚本需可执行权限 (chmod +x)。',
    }
  }
  return {
    os_type: osType,
    os_label: 'Linux',
    shell: 'bash',
    default_restart: 'npm run server',
    default_script: '',
    default_build: 'npm run build',
    hint: 'Linux 下建议使用 nohup + npm run server 启动。',
  }
}

export function loadUpdateConfig(): UpdateConfig {
  if (fs.existsSync(UPDATE_CONFIG_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(UPDATE_CONFIG_PATH, 'utf-8'))
      return { ...DEFAULT_UPDATE_CONFIG, ...data }
    } catch {
      // fall through
    }
  }
  const cfg = { ...DEFAULT_UPDATE_CONFIG }
  saveUpdateConfigFile(cfg)
  return cfg
}

export function saveUpdateConfigFile(cfg: UpdateConfig): void {
  const dir = path.dirname(UPDATE_CONFIG_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(UPDATE_CONFIG_PATH, JSON.stringify(cfg, null, 4), 'utf-8')
}

function normalizeArchiveUrl(githubUrl: string, branch: string): string | null {
  const url = (githubUrl || '').trim()
  if (!url) return null
  const low = url.toLowerCase()
  if (low.includes('/releases/download/')) return url.replace(/\/$/, '')
  if (low.includes('codeload.github.com/')) return url
  let body = url
  for (const pfx of ['https://', 'http://']) {
    if (body.toLowerCase().startsWith(pfx)) {
      body = body.slice(pfx.length)
      break
    }
  }
  const afterHost = body.includes('/') ? body.split('/').slice(1).join('/') : body
  let ownerRepo = afterHost.trim().replace(/\/$/, '')
  if (ownerRepo.endsWith('.git')) ownerRepo = ownerRepo.slice(0, -4)
  const parts = ownerRepo.split('/').filter(Boolean)
  if (parts.length < 2) return url.replace(/\/$/, '')
  ownerRepo = parts.slice(0, 2).join('/')
  const b = (branch || 'main').trim() || 'main'
  return `https://codeload.github.com/${ownerRepo}/zip/refs/heads/${b}`
}

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  const low = msg.toLowerCase()
  if (low.includes('timeout') || low.includes('timed out')) return '连接超时（国内访问 GitHub 常见，建议配置代理）'
  if (low.includes('connect econnrefused') || low.includes('connection refused')) return '连接被拒绝'
  if (low.includes('ssl') || low.includes('certificate')) return 'SSL 证书错误'
  if (low.includes('getaddrinfo') || low.includes('enotfound')) return 'DNS 解析失败（域名无法访问）'
  if (low.includes('econnreset')) return '连接被对端重置'
  if (low.includes('proxy')) return '代理错误'
  return msg
}

function maskToken(token: string): string {
  if (!token) return ''
  if (token.length <= 8) return '***'
  return token.slice(0, 4) + '***' + token.slice(-4)
}

function getAxiosProxyConfig(proxyUrl: string) {
  const proxy = (proxyUrl || '').trim()
  if (!proxy) return undefined
  try {
    const url = new URL(proxy)
    return {
      protocol: url.protocol.replace(':', ''),
      host: url.hostname,
      port: parseInt(url.port) || 80,
      auth: url.username ? { username: decodeURIComponent(url.username), password: decodeURIComponent(url.password) } : undefined,
    }
  } catch {
    return undefined
  }
}

async function downloadFile(url: string, targetPath: string, token: string, cfg: UpdateConfig): Promise<void> {
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `token ${token}`

  const candidates = [url]
  if (url.includes('refs/heads/main')) {
    candidates.push(url.replace('refs/heads/main', 'refs/heads/master'))
  }

  addLog(`========== 开始下载 ==========`)
  addLog(`目标地址: ${url}`)
  if (cfg.proxy) addLog(`使用代理: ${cfg.proxy}`)
  addLog(`Token: ${maskToken(token) || '(无)'}`)
  addLog(`临时文件: ${targetPath}`)
  addLog(`候选地址共 ${candidates.length} 个，将依次尝试`)

  const proxyConfig = getAxiosProxyConfig(cfg.proxy)
  let lastErr: string | null = null
  let lastStatus: number | null = null

  for (let idx = 0; idx < candidates.length; idx++) {
    const u = candidates[idx]
    addLog(`------ [候选 ${idx + 1}/${candidates.length}] ${u} ------`)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        addLog(`  连接尝试 ${attempt}/3 ...`)
        const t0 = Date.now()
        const response = await axios({
          method: 'get',
          url: u,
          responseType: 'stream',
          headers,
          proxy: proxyConfig,
          timeout: 60000,
          maxRedirects: 5,
        })
        const connectMs = Date.now() - t0
        lastStatus = response.status
        const total = parseInt(response.headers['content-length'] as string) || 0
        const contentType = response.headers['content-type'] || '未知'
        const lastModified = response.headers['last-modified'] || ''
        addLog(`  HTTP ${response.status} (连接耗时 ${connectMs}ms)`)
        addLog(`  Content-Type: ${contentType}`)
        addLog(`  Content-Length: ${total ? formatSize(total) : '未知'} (${total || '?'} bytes)`)
        if (lastModified) addLog(`  Last-Modified: ${lastModified}`)

        if (response.status === 404) {
          addLog('  此地址 404，跳到下一个候选', 'WARNING')
          lastErr = `404 Not Found: ${u}`
          break
        }

        addLog(`  开始写入文件...`)
        let downloaded = 0
        let lastPct = -10
        const tStart = Date.now()
        const writer = createWriteStream(targetPath)
        response.data.on('data', (chunk: Buffer) => {
          downloaded += chunk.length
          if (total > 0) {
            const pct = Math.floor((downloaded * 100) / total)
            if (pct >= lastPct + 10) {
              lastPct = pct
              const elapsed = (Date.now() - tStart) / 1000
              const speed = downloaded / Math.max(elapsed, 0.1) / 1024
              const eta = total > 0 ? Math.ceil((total - downloaded) / 1024 / Math.max(speed, 0.1)) : 0
              addLog(`  下载进度: ${pct}% | ${formatSize(downloaded)} / ${formatSize(total)} | ${Math.floor(speed)} KB/s | 剩余 ${eta}s`)
            }
          }
        })
        await pipeline(response.data, writer)
        const totalMs = Date.now() - tStart
        const avgSpeed = total > 0 ? (total / 1024 / Math.max(totalMs / 1000, 0.1)) : 0
        addLog(`  ✓ 下载完成`)
        addLog(`    文件: ${targetPath}`)
        addLog(`    大小: ${formatSize(downloaded)} (${downloaded} bytes)`)
        addLog(`    耗时: ${(totalMs / 1000).toFixed(1)}s`)
        addLog(`    平均速度: ${Math.floor(avgSpeed)} KB/s`)
        addLog(`========== 下载结束 ==========`)
        return
      } catch (e: any) {
        if (e.response) {
          lastStatus = e.response.status
          if (e.response.status === 401) {
            addLog(`  401 Unauthorized - Token 无效或过期`, 'ERROR')
            throw new Error('401 Unauthorized - Token 无效或过期')
          }
          if (e.response.status === 403) {
            addLog(`  403 Forbidden - Token 无权限或触发限流`, 'ERROR')
            throw new Error('403 Forbidden - Token 无权限或触发限流')
          }
          if (e.response.status === 404) {
            lastErr = `404 Not Found: ${u}`
            addLog(`  HTTP ${e.response.status}: ${u}`, 'WARNING')
            break
          }
          lastErr = `HTTP ${e.response.status}: ${u}`
          addLog(`  HTTP 错误: ${lastErr}`, 'WARNING')
          break
        }
        lastErr = friendlyError(e)
        addLog(`  尝试 ${attempt}/3 失败: ${lastErr}`, 'WARNING')
        if (e.code) addLog(`  错误码: ${e.code}`, 'WARNING')
        if (attempt < 3) {
          const wait = attempt * 2
          addLog(`  ${wait}s 后重试...`)
          await new Promise(r => setTimeout(r, wait * 1000))
        }
      }
    }
  }

  addLog(`下载失败（已尝试所有候选），最后状态: ${lastStatus}`, 'ERROR')
  throw new Error(`下载失败（已尝试所有候选）: ${lastErr || '未知错误'}`)
}

async function extractZip(zipPath: string, targetDir: string): Promise<void> {
  const t0 = Date.now()
  const zipSize = fs.existsSync(zipPath) ? fs.statSync(zipPath).size : 0
  addLog(`========== 开始解压 ==========`)
  addLog(`ZIP 文件: ${zipPath} (${formatSize(zipSize)})`)
  addLog(`目标目录: ${targetDir}`)
  fs.mkdirSync(targetDir, { recursive: true })
  const osType = detectOs()
  const rawDir = path.join(targetDir, '.__raw__')
  fs.mkdirSync(rawDir, { recursive: true })

  addLog(`解压工具: ${osType === 'windows' ? 'PowerShell Expand-Archive' : 'unzip'}`)
  if (osType === 'windows') {
    await new Promise<void>((resolve, reject) => {
      const cmd = `powershell -NoProfile -NonInteractive -Command "Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${rawDir}' -Force"`
      addLog(`执行: ${cmd}`)
      exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err) => {
        if (err) {
          addLog(`解压命令失败: ${err.message}`, 'ERROR')
          reject(new Error(`解压失败: ${err.message}`))
        } else {
          addLog(`解压命令执行成功`)
          resolve()
        }
      })
    })
  } else {
    await new Promise<void>((resolve, reject) => {
      addLog(`执行: unzip -o '${zipPath}' -d '${rawDir}'`)
      exec(`unzip -o '${zipPath}' -d '${rawDir}'`, { maxBuffer: 10 * 1024 * 1024 }, (err) => {
        if (err) {
          addLog(`解压命令失败: ${err.message}`, 'ERROR')
          reject(new Error(`解压失败: ${err.message}`))
        } else {
          addLog(`解压命令执行成功`)
          resolve()
        }
      })
    })
  }

  const entries = fs.readdirSync(rawDir)
  addLog(`解压后顶层条目: ${entries.length} 个`)
  entries.slice(0, 10).forEach((e, i) => {
    const fullPath = path.join(rawDir, e)
    const type = fs.statSync(fullPath).isDirectory() ? '目录' : '文件'
    addLog(`  [${i + 1}] ${type}: ${e}`)
  })
  if (entries.length > 10) addLog(`  ... 还有 ${entries.length - 10} 个`)

  let srcDir = rawDir
  if (entries.length === 1) {
    const onlyPath = path.join(rawDir, entries[0])
    if (fs.statSync(onlyPath).isDirectory()) {
      srcDir = onlyPath
      addLog(`检测到单顶层目录，自动去除: ${entries[0]}`)
    }
  }

  const fileCount = countFiles(srcDir)
  addLog(`源目录文件总数: ${fileCount}`)
  addLog(`开始复制文件到目标目录...`)
  copyDirContents(srcDir, targetDir)
  fs.rmSync(rawDir, { recursive: true, force: true })
  const dt = ((Date.now() - t0) / 1000).toFixed(1)
  addLog(`  ✓ 解压完成: ${fileCount} 个文件, 耗时 ${dt}s`)
  addLog(`========== 解压结束 ==========`)
}

function countFiles(dir: string): number {
  let count = 0
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += countFiles(path.join(dir, entry.name))
    } else {
      count++
    }
  }
  return count
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function copyDirContents(src: string, dst: string): void {
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const s = path.join(src, entry.name)
    const d = path.join(dst, entry.name)
    if (entry.isDirectory()) {
      fs.mkdirSync(d, { recursive: true })
      copyDirContents(s, d)
    } else {
      fs.copyFileSync(s, d)
    }
  }
}

function isExcluded(relPath: string, excludes: string[]): boolean {
  let rel = relPath.replace(/\\/g, '/')
  if (rel.startsWith('./')) rel = rel.slice(2)
  const parts = rel.split('/').filter(Boolean)
  for (const pat of excludes) {
    const p = (pat || '').trim().replace(/^\/+|\/+$/g, '').replace(/\\/g, '/')
    if (!p) continue
    if (p.includes('/')) {
      const joined = parts.join('/')
      if (joined === p || joined.startsWith(p + '/')) return true
    } else {
      if (parts.some(part => minimatch(part, p))) return true
    }
  }
  return false
}

function minimatch(str: string, pattern: string): boolean {
  const escapeRegex = (s: string) => s.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const regexStr = escapeRegex(pattern).replace(/\*/g, '.*').replace(/\?/g, '.')
  return new RegExp(`^${regexStr}$`).test(str)
}

function deployFiles(src: string, dst: string, excludes: string[]): void {
  const t0 = Date.now()
  if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) {
    throw new Error(`部署源目录不存在: ${src}`)
  }
  addLog(`========== 开始部署 ==========`)
  addLog(`源目录: ${src}`)
  addLog(`目标目录: ${dst}`)
  addLog(`排除规则: ${excludes.length} 条`)
  addLog(`排除列表: ${excludes.join(', ')}`)
  let copied = 0
  let skipped = 0
  const copiedDirs = new Set<string>()
  const keyFiles: string[] = []

  function walk(curSrc: string, relDir: string) {
    const entries = fs.readdirSync(curSrc, { withFileTypes: true })
    for (const entry of entries) {
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name
      if (isExcluded(rel, excludes)) {
        skipped++
        continue
      }
      const s = path.join(curSrc, entry.name)
      const d = path.join(dst, rel)
      if (entry.isDirectory()) {
        fs.mkdirSync(d, { recursive: true })
        copiedDirs.add(rel)
        walk(s, rel)
      } else {
        fs.mkdirSync(path.dirname(d), { recursive: true })
        const isNew = !fs.existsSync(d)
        fs.copyFileSync(s, d)
        copied++
        if (rel === 'package.json' || rel === 'server/index.ts' || rel === 'vite.config.ts' || rel === 'tsconfig.json') {
          keyFiles.push(rel)
        }
      }
    }
  }
  walk(src, '')
  const dt = ((Date.now() - t0) / 1000).toFixed(1)
  addLog(`部署的顶层目录/文件:`)
  for (const dir of copiedDirs) {
    addLog(`  + ${dir}/`)
  }
  if (keyFiles.length > 0) {
    addLog(`关键文件更新:`)
    keyFiles.forEach(f => addLog(`  * ${f}`))
  }
  addLog(`  ✓ 部署完成: 覆盖 ${copied} 个文件, 跳过 ${skipped} 个(排除), 涉及 ${copiedDirs.size} 个目录, 耗时 ${dt}s`)
  addLog(`========== 部署结束 ==========`)
}

function packagesDirFromCfg(cfg: UpdateConfig, projectRoot: string): string {
  let baseDir = (cfg.download_dir || '').trim()
  if (!baseDir) baseDir = 'deploy'
  if (!path.isAbsolute(baseDir)) baseDir = path.join(projectRoot, baseDir)
  return path.join(baseDir, 'packages')
}

function makePackageDir(packagesDir: string, branch: string): string {
  fs.mkdirSync(packagesDir, { recursive: true })
  const ts = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
    .replace(/[/\s:]/g, '').replace(/,/g, '_')
  const safe = (branch || 'main').replace(/[^a-zA-Z0-9-_]/g, '_')
  let name = `${ts}_${safe}`
  let i = 2
  while (fs.existsSync(path.join(packagesDir, name))) {
    name = `${ts}_${safe}_${i}`
    i++
  }
  const p = path.join(packagesDir, name)
  fs.mkdirSync(p, { recursive: true })
  return p
}

function latestPackageDir(packagesDir: string): string | null {
  if (!fs.existsSync(packagesDir) || !fs.statSync(packagesDir).isDirectory()) return null
  const pkgs = fs.readdirSync(packagesDir)
    .filter(d => fs.statSync(path.join(packagesDir, d)).isDirectory())
    .sort()
    .reverse()
  return pkgs.length > 0 ? path.join(packagesDir, pkgs[0]) : null
}

function prunePackages(packagesDir: string, keep: number): void {
  if (keep <= 0 || !fs.existsSync(packagesDir)) return
  const pkgs = fs.readdirSync(packagesDir)
    .filter(d => fs.statSync(path.join(packagesDir, d)).isDirectory())
    .sort()
    .reverse()
  for (const d of pkgs.slice(keep)) {
    try {
      fs.rmSync(path.join(packagesDir, d), { recursive: true, force: true })
      addLog(`清理旧包: ${d}`)
    } catch (e) {
      addLog(`清理旧包失败 ${d}: ${e}`, 'WARNING')
    }
  }
}

export function getPackagesInfo(cfg?: UpdateConfig, projectRoot?: string) {
  cfg = cfg || loadUpdateConfig()
  const root = projectRoot || PROJECT_ROOT
  const pdir = packagesDirFromCfg(cfg, root)
  const latest = latestPackageDir(pdir)
  let packages: { name: string; mtime: number }[] = []
  if (fs.existsSync(pdir) && fs.statSync(pdir).isDirectory()) {
    packages = fs.readdirSync(pdir)
      .filter(d => fs.statSync(path.join(pdir, d)).isDirectory())
      .sort()
      .reverse()
      .map(name => ({ name, mtime: fs.statSync(path.join(pdir, name)).mtimeMs }))
  }
  return {
    dir: pdir,
    count: packages.length,
    packages,
    active: latest ? path.basename(latest) : null,
  }
}

async function runCommand(cmd: string, cwd: string, timeout: number): Promise<void> {
  const osType = detectOs()
  const t0 = Date.now()
  addLog(`========== 执行命令 ==========`)
  addLog(`  命令: ${cmd}`)
  addLog(`  工作目录: ${cwd || '(继承)'}`)
  addLog(`  超时: ${timeout}s`)
  addLog(`  操作系统: ${osType}`)
  addLog(`  Shell: ${osType === 'windows' ? (process.env.ComSpec || 'cmd.exe') : '/bin/bash'}`)

  const shell = osType === 'windows' ? process.env.ComSpec || 'cmd.exe' : '/bin/bash'
  const shellArgs = osType === 'windows' ? ['/c', cmd] : ['-c', cmd]
  addLog(`  PID: (spawning...)`)

  return new Promise<void>((resolve, reject) => {
    const proc = spawn(shell, shellArgs, {
      cwd: cwd || undefined,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    addLog(`  PID: ${proc.pid}`)
    let stdout = ''
    let lineCount = 0
    const handleData = (data: Buffer) => {
      stdout += data.toString('utf-8')
      const lines = stdout.split('\n')
      stdout = lines.pop() || ''
      for (const ln of lines) {
        const trimmed = ln.replace(/\r$/, '').trim()
        if (trimmed) {
          addLog(`  | ${trimmed}`)
          lineCount++
        }
      }
    }
    proc.stdout?.on('data', handleData)
    proc.stderr?.on('data', handleData)

    const timer = setTimeout(() => {
      proc.kill('SIGKILL')
      addLog(`  ✗ 命令超时被强制终止 (${timeout}s)`, 'ERROR')
      addLog(`========== 命令结束(超时) ==========`, 'ERROR')
      reject(new Error(`命令超时 (${timeout}s): ${cmd}`))
    }, timeout * 1000)

    proc.on('close', (code) => {
      clearTimeout(timer)
      const dt = ((Date.now() - t0) / 1000).toFixed(1)
      if (stdout.trim()) {
        addLog(`  | ${stdout.trim()}`)
        lineCount++
      }
      addLog(`  退出码: ${code}`)
      addLog(`  输出: ${lineCount} 行`)
      addLog(`  耗时: ${dt}s`)
      if (code === 0) {
        addLog(`  ✓ 命令执行成功`)
      } else {
        addLog(`  ✗ 命令执行失败 (退出码 ${code})`, 'ERROR')
      }
      addLog(`========== 命令结束 ==========`)
      if (code !== 0) {
        reject(new Error(`命令退出码 ${code}: ${cmd}`))
      } else {
        resolve()
      }
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      const dt = ((Date.now() - t0) / 1000).toFixed(1)
      addLog(`  ✗ 命令执行出错: ${err.message}`, 'ERROR')
      addLog(`  耗时: ${dt}s`, 'ERROR')
      addLog(`========== 命令结束(错误) ==========`, 'ERROR')
      reject(new Error(`命令执行出错: ${err.message}`))
    })
  })
}

function pm2AvailableSync(): boolean {
  const osType = detectOs()
  const probe = osType === 'windows' ? 'where pm2' : 'command -v pm2'
  try {
    execSync(probe, { stdio: 'ignore', windowsHide: true })
    return true
  } catch {
    return false
  }
}

function spawnPm2Command(action: 'restart' | 'stop', appName: string, projectRoot: string): void {
  const osType = detectOs()
  const cmd = `pm2 ${action} ${appName} --update-env`
  addLog(`========== PM2 ${action} ==========`)
  addLog(`命令: ${cmd}`)
  addLog(`工作目录: ${projectRoot}`)
  addLog(`操作系统: ${osType}`)
  fs.mkdirSync(LOG_DIR, { recursive: true })
  const ctrlLog = path.join(LOG_DIR, 'pm2-control.log')
  addLog(`控制日志: ${ctrlLog}`)

  const shell = osType === 'windows' ? (process.env.ComSpec || 'cmd.exe') : '/bin/bash'
  const delayed = osType === 'windows'
    ? `timeout /t 1 /nobreak >nul && ${cmd}`
    : `sleep 1 && ${cmd}`
  const args = osType === 'windows' ? ['/c', delayed] : ['-c', delayed]

  const fd = fs.openSync(ctrlLog, 'a')
  spawn(shell, args, {
    cwd: projectRoot,
    detached: true,
    stdio: ['ignore', fd, fd],
    windowsHide: true,
  }).unref()
  addLog(`已派生 detached 进程执行: ${delayed}`)
  addLog(`应用将在约 1 秒后被 PM2 ${action === 'restart' ? '重启' : '停止'}`)
}

function setStage(stage: Stage, progress = ''): void {
  updateState.stage = stage
  updateState.stageText = STAGE_TEXT[stage]
  updateState.progress = progress
}

const VALID_MODES = ['full', 'download', 'deploy', 'install', 'build', 'restart', 'stop'] as const
type UpdateMode = typeof VALID_MODES[number]

export function runUpdate(cfg: UpdateConfig, mode: UpdateMode = 'full'): void {
  if (!VALID_MODES.includes(mode)) throw new Error(`未知模式: ${mode}`)
  if (updateState.running) throw new Error('已有更新任务在执行中')

  updateState.running = true
  updateState.stage = 'starting'
  updateState.stageText = STAGE_TEXT.starting
  updateState.progress = `准备中... (模式: ${mode})`
  updateState.startedAt = now()
  updateState.finishedAt = null
  updateState.logs = []
  updateState.error = null

  runUpdateTask(cfg, mode).catch((e) => {
    addLog(`更新失败: ${e}`, 'ERROR')
    updateState.stage = 'error'
    updateState.stageText = STAGE_TEXT.error
    updateState.progress = `失败: ${e}`
    updateState.error = String(e)
    updateState.finishedAt = now()
    updateState.running = false
  })
}

async function runUpdateTask(cfg: UpdateConfig, mode: UpdateMode): Promise<void> {
  const stageTimings: { stage: string; duration: number }[] = []
  const tTotal = Date.now()
  try {
    const osType = detectOs()
    const projectRoot = path.resolve((cfg.project_root || '').trim() || PROJECT_ROOT)
    const appPort = parseInt(String(cfg.app_port || APP_PORT))
    if (!fs.existsSync(projectRoot)) throw new Error(`项目根目录不存在: ${projectRoot}`)

    addLog(`############################################################`)
    addLog(`#                                                          #`)
    addLog(`#              ===== 系统更新开始 =====                    #`)
    addLog(`#                                                          #`)
    addLog(`############################################################`)
    addLog(`---------- 基本信息 ----------`)
    addLog(`  更新模式: ${mode}`)
    addLog(`  操作系统: ${osType} (${os.platform()} ${os.release()})`)
    addLog(`  CPU 架构: ${process.arch}`)
    addLog(`  CPU 核心数: ${os.cpus().length}`)
    addLog(`  总内存: ${formatSize(os.totalmem())}`)
    addLog(`  空闲内存: ${formatSize(os.freemem())}`)
    addLog(`  Node.js: ${process.version}`)
    addLog(`  项目根目录: ${projectRoot}`)
    addLog(`  应用端口: ${appPort}`)
    addLog(`  系统临时目录: ${os.tmpdir()}`)
    addLog(`  当前工作目录: ${process.cwd()}`)
    addLog(`  配置文件: ${UPDATE_CONFIG_PATH}`)
    addLog(`---------- 配置摘要 ----------`)
    addLog(`  GitHub 下载: ${cfg.github_enabled ? '✓ 启用' : '✗ 禁用'}`)
    addLog(`  GitHub 地址: ${cfg.github_url || '(空)'}`)
    addLog(`  GitHub 分支: ${cfg.github_branch}`)
    addLog(`  GitHub Token: ${cfg.github_token ? maskToken(cfg.github_token) : '(无)'}`)
    addLog(`  HTTP 代理: ${cfg.proxy || '(无)'}`)
    addLog(`  安装依赖: ${cfg.install_enabled ? '✓ 启用' : '✗ 禁用'}`)
    addLog(`  编译构建: ${cfg.build_enabled ? '✓ 启用' : '✗ 禁用'}`)
    addLog(`  编译命令: ${cfg.build_command || '(默认)'}`)
    addLog(`  编译超时: ${cfg.build_timeout}s`)
    addLog(`  PM2 应用名: ${cfg.pm2_app_name || 'fund-pulse'}`)
    addLog(`  进程管理: PM2 (pm2 ${cfg.pm2_app_name || 'fund-pulse'})`)
    addLog(`  代码包保留数: ${cfg.package_keep}`)
    addLog(`  部署排除规则: ${cfg.deploy_excludes?.length || 0} 条 (用户自定义)`)
    addLog(`  系统默认排除规则: ${DEFAULT_DEPLOY_EXCLUDES.length} 条`)
    addLog(`  下载目录: ${cfg.download_dir || '(默认 deploy)'}`)
    addLog(`---------- 执行计划 ----------`)

    const doDownload = mode === 'download' || (mode === 'full' && cfg.github_enabled)
    const doDeploy = mode === 'deploy' || (mode === 'full' && cfg.github_enabled)
    const doInstall = mode === 'install' || (mode === 'full' && cfg.install_enabled)
    const doBuild = mode === 'build' || (mode === 'full' && cfg.build_enabled)
    const doRestart = mode === 'full' || mode === 'restart'
    const doStop = mode === 'stop'

    const plan: string[] = []
    if (doDownload) plan.push('① 下载代码')
    if (doDeploy) plan.push('② 部署代码')
    if (doInstall) plan.push('③ 安装依赖')
    if (doBuild) plan.push('④ 编译构建')
    if (doRestart) plan.push('⑤ 重启应用')
    if (doStop) plan.push('⑤ 关闭应用')
    addLog(`  执行步骤: ${plan.join(' → ')}`)
    addLog(``)

    if (doDownload) {
      const tStage = Date.now()
      setStage('downloading', '从 GitHub 下载代码...')
      addLog(`############################################################`)
      addLog(`#  [阶段 1] 下载代码`)
      addLog(`############################################################`)
      const ghUrl = (cfg.github_url || '').trim()
      if (!ghUrl) throw new Error('GitHub 地址为空')
      const branch = (cfg.github_branch || 'main').trim() || 'main'
      const token = (cfg.github_token || '').trim()

      const archiveUrl = normalizeArchiveUrl(ghUrl, branch)
      addLog(`GitHub 原始地址: ${ghUrl}`)
      addLog(`归档下载地址(codeload): ${archiveUrl}`)
      addLog(`分支: ${branch}`)

      const packagesDir = packagesDirFromCfg(cfg, projectRoot)
      addLog(`代码包根目录: ${packagesDir}`)
      const packageDir = makePackageDir(packagesDir, branch)
      addLog(`本次代码包目录: ${packageDir}`)
      const tmpZip = path.join(os.tmpdir(), `fundpulse_update_${Date.now()}.zip`)
      try {
        await downloadFile(archiveUrl!, tmpZip, token, cfg)
        setStage('downloading', `解压到包 ${path.basename(packageDir)}...`)
        await extractZip(tmpZip, packageDir)
      } finally {
        try {
          fs.unlinkSync(tmpZip)
          addLog(`已清理临时文件: ${tmpZip}`)
        } catch { /* ignore */ }
      }
      const keep = parseInt(String(cfg.package_keep || 3))
      addLog(`保留最近 ${keep} 个代码包，开始清理旧包...`)
      prunePackages(packagesDir, keep)
      const dt = ((Date.now() - tStage) / 1000).toFixed(1)
      stageTimings.push({ stage: '下载', duration: parseFloat(dt) })
      addLog(`[阶段 1] 下载完成，耗时 ${dt}s`)
      addLog(``)
    } else {
      addLog(`跳过 [阶段 1] 下载代码（未启用或模式不匹配）`)
      addLog(``)
    }

    if (doDeploy) {
      const tStage = Date.now()
      setStage('deploying', '部署代码到项目目录...')
      addLog(`############################################################`)
      addLog(`#  [阶段 2] 部署代码`)
      addLog(`############################################################`)
      const packagesDir = packagesDirFromCfg(cfg, projectRoot)
      const deploySrc = latestPackageDir(packagesDir)
      if (!deploySrc) throw new Error('没有已下载的代码包，请先执行下载')
      addLog(`部署来源(最新包): ${deploySrc}`)
      const userExcludes = Array.isArray(cfg.deploy_excludes) ? cfg.deploy_excludes : []
      const excludes = [...DEFAULT_DEPLOY_EXCLUDES, ...userExcludes.map(String)]
      deployFiles(deploySrc, projectRoot, excludes)
      const dt = ((Date.now() - tStage) / 1000).toFixed(1)
      stageTimings.push({ stage: '部署', duration: parseFloat(dt) })
      addLog(`[阶段 2] 部署完成，耗时 ${dt}s`)
      addLog(``)
    } else {
      addLog(`跳过 [阶段 2] 部署代码（未启用或模式不匹配）`)
      addLog(``)
    }

    if (doInstall) {
      const tStage = Date.now()
      setStage('installing', '安装依赖 (npm install)...')
      addLog(`############################################################`)
      addLog(`#  [阶段 3] 安装依赖`)
      addLog(`############################################################`)
      addLog(`执行 npm install...`)
      await runCommand('npm install', projectRoot, 300)
      const dt = ((Date.now() - tStage) / 1000).toFixed(1)
      stageTimings.push({ stage: '安装依赖', duration: parseFloat(dt) })
      addLog(`[阶段 3] 安装依赖完成，耗时 ${dt}s`)
      addLog(``)
    } else {
      addLog(`跳过 [阶段 3] 安装依赖（未启用或模式不匹配）`)
      addLog(``)
    }

    if (doBuild) {
      const tStage = Date.now()
      setStage('building', '执行编译 / 构建命令...')
      addLog(`############################################################`)
      addLog(`#  [阶段 4] 编译构建`)
      addLog(`############################################################`)
      const shellInfo = getDefaultShellInfo()
      const buildCmd = (cfg.build_command || '').trim() || shellInfo.default_build
      if (!buildCmd) throw new Error('编译命令为空且无默认值')
      addLog(`编译命令: ${buildCmd}${!(cfg.build_command || '').trim() ? '（使用默认）' : ''}`)
      const buildCwd = (cfg.build_cwd || '').trim() || projectRoot
      addLog(`编译工作目录: ${buildCwd}`)
      const buildTimeout = parseInt(String(cfg.build_timeout || 600))
      await runCommand(buildCmd, buildCwd, buildTimeout)
      const dt = ((Date.now() - tStage) / 1000).toFixed(1)
      stageTimings.push({ stage: '编译', duration: parseFloat(dt) })
      addLog(`[阶段 4] 编译完成，耗时 ${dt}s`)
      addLog(``)
    } else {
      addLog(`跳过 [阶段 4] 编译构建（未启用或模式不匹配）`)
      addLog(``)
    }

    if (doRestart) {
      const tStage = Date.now()
      setStage('restarting', '通过 PM2 重启应用...')
      addLog(`############################################################`)
      addLog(`#  [阶段 5] 重启应用`)
      addLog(`############################################################`)
      const appName = (cfg.pm2_app_name || 'fund-pulse').trim()
      if (!pm2AvailableSync()) {
        throw new Error('未检测到 PM2，无法重启。请先安装: npm i -g pm2，并用 pm2 start ecosystem.config.cjs 启动服务')
      }
      addLog(`PM2 应用名: ${appName}`)
      spawnPm2Command('restart', appName, projectRoot)
      const dt = ((Date.now() - tStage) / 1000).toFixed(1)
      stageTimings.push({ stage: '重启', duration: parseFloat(dt) })
      addLog(`[阶段 5] 重启指令已派发，耗时 ${dt}s`)
      addLog(``)
    } else {
      addLog(`跳过 [阶段 5] 重启应用（模式不匹配）`)
      addLog(``)
    }

    if (doStop) {
      const tStage = Date.now()
      setStage('stopping', '通过 PM2 停止应用...')
      addLog(`############################################################`)
      addLog(`#  [阶段 5] 关闭应用`)
      addLog(`############################################################`)
      const appName = (cfg.pm2_app_name || 'fund-pulse').trim()
      if (!pm2AvailableSync()) {
        throw new Error('未检测到 PM2，无法停止。请先安装: npm i -g pm2')
      }
      spawnPm2Command('stop', appName, projectRoot)
      const dt = ((Date.now() - tStage) / 1000).toFixed(1)
      stageTimings.push({ stage: '关闭', duration: parseFloat(dt) })
      addLog(`[阶段 5] 关闭指令已派发，耗时 ${dt}s`)
      addLog(``)
    } else {
      addLog(`跳过 [阶段 5] 关闭应用（模式不匹配）`)
      addLog(``)
    }

    setStage('done', '更新完成')
    const totalDt = ((Date.now() - tTotal) / 1000).toFixed(1)
    addLog(`############################################################`)
    addLog(`#              ===== 更新完成 =====`)
    addLog(`############################################################`)
    addLog(`---------- 耗时汇总 ----------`)
    for (const t of stageTimings) {
      addLog(`  ${t.stage}: ${t.duration}s`)
    }
    addLog(`  ────────────────────`)
    addLog(`  总耗时: ${totalDt}s`)
    addLog(`  开始时间: ${updateState.startedAt}`)
    addLog(`  完成时间: ${now()}`)
    addLog(`############################################################`)
    updateState.finishedAt = now()
    updateState.running = false
  } catch (e) {
    const totalDt = ((Date.now() - tTotal) / 1000).toFixed(1)
    const errMsg = e instanceof Error ? e.message : String(e)
    const errStack = e instanceof Error ? e.stack : ''
    addLog(`############################################################`, 'ERROR')
    addLog(`#              ===== 更新失败 =====`, 'ERROR')
    addLog(`############################################################`, 'ERROR')
    addLog(`错误信息: ${errMsg}`, 'ERROR')
    if (errStack) {
      addLog(`错误堆栈:`, 'ERROR')
      errStack.split('\n').slice(0, 10).forEach(line => addLog(`  ${line}`, 'ERROR'))
    }
    addLog(`失败时已耗时: ${totalDt}s`, 'ERROR')
    if (stageTimings.length > 0) {
      addLog(`已完成阶段:`, 'ERROR')
      for (const t of stageTimings) {
        addLog(`  ${t.stage}: ${t.duration}s`, 'ERROR')
      }
    }
    addLog(`############################################################`, 'ERROR')
    updateState.stage = 'error'
    updateState.stageText = STAGE_TEXT.error
    updateState.progress = `失败: ${errMsg}`
    updateState.error = errMsg
    updateState.finishedAt = now()
    updateState.running = false
  }
}

export async function testGithubConnection(cfg: UpdateConfig) {
  const ghUrl = (cfg.github_url || '').trim()
  if (!ghUrl) return { ok: false, message: 'GitHub 地址为空' }
  const branch = (cfg.github_branch || 'main').trim() || 'main'
  const token = (cfg.github_token || '').trim()
  const archiveUrl = normalizeArchiveUrl(ghUrl, branch)

  const headers: Record<string, string> = { Range: 'bytes=0-0' }
  if (token) headers['Authorization'] = `token ${token}`
  const proxyConfig = getAxiosProxyConfig(cfg.proxy)

  const candidates = [archiveUrl!]
  if (archiveUrl!.includes('refs/heads/main') && branch === 'main') {
    candidates.push(archiveUrl!.replace('refs/heads/main', 'refs/heads/master'))
  }

  const logs: string[] = []
  const _log = (msg: string) => logs.push(msg)

  _log(`原始地址: ${archiveUrl}`)
  if (cfg.proxy) _log(`代理: ${cfg.proxy}`)
  _log(`Token: ${maskToken(token) || '(无)'}`)

  let lastStatus: number | null = null
  for (const u of candidates) {
    _log(`尝试: ${u}`)
    try {
      const t0 = Date.now()
      const response = await axios.head(u, {
        headers,
        proxy: proxyConfig,
        timeout: 20000,
        maxRedirects: 5,
      })
      const dt = Math.round((Date.now() - t0) / 1000)
      lastStatus = response.status
      _log(`  HTTP ${response.status} (${dt}s)`)
      if (response.status === 200 || response.status === 206) {
        const cr = (response.headers['content-range'] as string || '').split('/').pop()
        const sizeMsg = cr && /^\d+$/.test(cr) ? `，文件约 ${Math.floor(parseInt(cr) / 1024 / 1024)} MB` : ''
        return { ok: true, message: `连接成功${sizeMsg}（${dt}s）`, url: u, logs }
      }
    } catch (e: any) {
      if (e.response) {
        lastStatus = e.response.status
        _log(`  HTTP ${e.response.status}`)
        if (e.response.status === 401) return { ok: false, message: 'Token 无效或过期 (401)', url: u, logs }
        if (e.response.status === 403) return { ok: false, message: 'Token 无权限或触发限流 (403)', url: u, logs }
      } else {
        _log(`  失败: ${friendlyError(e)}`)
      }
      continue
    }
  }

  let msg: string
  if (lastStatus === 404) {
    msg = '仓库或分支不存在（已尝试 main/master）。请确认: 地址正确、仓库可见、分支名无误'
  } else if (lastStatus === null) {
    msg = '所有候选地址均无法连接（网络超时或被墙）。建议配置代理（如 http://127.0.0.1:7890）'
  } else {
    msg = `HTTP ${lastStatus}`
  }
  return { ok: false, message: msg, url: archiveUrl, logs }
}

export function probeProxy() {
  const candidates = [
    { port: 7890, name: 'Clash / Clash Verge' },
    { port: 7891, name: 'Clash Socks' },
    { port: 10809, name: 'V2RayN HTTP' },
    { port: 10808, name: 'V2RayN Socks' },
    { port: 1080, name: 'Shadowsocks / SOCKS' },
    { port: 8888, name: 'Charles / Fiddler' },
    { port: 8080, name: 'HTTP 通用' },
  ]
  const available: { port: number; name: string; proxy: string }[] = []
  for (const { port, name } of candidates) {
    try {
      const s = new net.Socket()
      s.setTimeout(300)
      const ok = awaitSocket(s, port)
      if (ok) available.push({ port, name, proxy: `http://127.0.0.1:${port}` })
      s.destroy()
    } catch {
      // ignore
    }
  }
  return {
    available,
    suggested: available.length > 0 ? available[0] : null,
  }
}

function awaitSocket(socket: any, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    socket.once('connect', () => resolve(true))
    socket.once('error', () => resolve(false))
    socket.once('timeout', () => resolve(false))
    socket.connect(port, '127.0.0.1')
  })
}
