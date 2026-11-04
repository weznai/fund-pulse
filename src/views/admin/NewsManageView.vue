<template>
  <div class="news-admin-page">
    <div class="page-header">
      <h2 class="page-title">资讯管理</h2>
      <p class="page-desc">发布基金资讯文章，支持整篇 HTML 导入（WorkBuddy 报告等）、草稿/发布状态与批量管理</p>
    </div>

    <div class="content-body">
      <!-- 统计 -->
      <div class="stats-row" v-if="stats">
        <div class="stat-card">
          <span class="stat-value">{{ stats.total }}</span>
          <span class="stat-label">文章总数</span>
        </div>
        <div class="stat-card stat-published">
          <span class="stat-value">{{ stats.published }}</span>
          <span class="stat-label">已发布</span>
        </div>
        <div class="stat-card stat-draft">
          <span class="stat-value">{{ stats.draft }}</span>
          <span class="stat-label">草稿</span>
        </div>
      </div>

      <!-- 搜索栏 -->
      <div class="filter-section">
        <div class="filter-row">
          <div class="filter-item">
            <label>关键字</label>
            <input v-model="keyword" @keyup.enter="resetAndLoad" placeholder="标题/摘要..." class="filter-input" />
          </div>
          <div class="filter-item">
            <label>状态</label>
            <select v-model="statusFilter" class="filter-input filter-select" @change="resetAndLoad">
              <option value="">全部</option>
              <option value="published">已发布</option>
              <option value="draft">草稿</option>
            </select>
          </div>
          <div class="filter-actions">
            <button class="btn btn-primary" @click="resetAndLoad">查询</button>
            <button class="btn btn-secondary" @click="resetSearch">重置</button>
            <button class="btn btn-primary" @click="openCreate">新建资讯</button>
          </div>
        </div>
      </div>

      <!-- 批量操作 -->
      <div class="batch-bar" v-if="selectedIds.size > 0">
        <span>已选 {{ selectedIds.size }} 项</span>
        <button class="btn btn-primary btn-sm" @click="batchSetStatus('published')">批量发布</button>
        <button class="btn btn-secondary btn-sm" @click="batchSetStatus('draft')">批量下架</button>
        <button class="btn btn-danger btn-sm" @click="batchDelete">批量删除</button>
        <button class="btn btn-secondary btn-sm" @click="selectedIds.clear()">取消</button>
      </div>

      <!-- 表格 -->
      <div class="table-section">
        <div class="loading-state" v-if="loading">
          <span class="spinner"></span>
          <span>加载中...</span>
        </div>

        <template v-else>
          <div class="table-container" v-if="list.length > 0">
            <table class="data-table">
              <thead>
                <tr>
                  <th class="col-check"><input type="checkbox" :checked="allChecked" @change="toggleAll" /></th>
                  <th>ID</th>
                  <th>标题</th>
                  <th>状态</th>
                  <th>浏览</th>
                  <th>发布时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in list" :key="row.id">
                  <td class="col-check"><input type="checkbox" :checked="selectedIds.has(row.id)" @change="toggleRow(row.id)" /></td>
                  <td class="col-id">{{ row.id }}</td>
                  <td>
                    <div class="title-cell">
                      <span class="title-text">
                        <span v-if="row.pinned" class="pin-tag">顶</span>{{ row.title }}
                      </span>
                      <span v-if="row.summary" class="summary-text">{{ row.summary }}</span>
                    </div>
                  </td>
                  <td>
                    <span class="status-tag" :class="row.status">{{ row.status === 'published' ? '已发布' : '草稿' }}</span>
                  </td>
                  <td class="col-num">{{ row.views }}</td>
                  <td class="col-time">{{ row.created_at }}</td>
                  <td>
                    <div class="action-cell">
                      <a :href="`/news/${row.id}`" target="_blank" class="btn btn-sm btn-link">查看</a>
                      <button class="btn btn-sm btn-primary" v-if="row.status === 'draft'" @click="setStatus(row, 'published')">发布</button>
                      <button class="btn btn-sm btn-secondary" v-else @click="setStatus(row, 'draft')">下架</button>
                      <button class="btn btn-sm btn-secondary" @click="togglePin(row)">{{ row.pinned ? '取消置顶' : '置顶' }}</button>
                      <button class="btn btn-sm btn-link" @click="openEdit(row)">编辑</button>
                      <button class="btn btn-sm btn-danger" @click="deleteOne(row)">删除</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="empty-state" v-else>
            <p>暂无资讯</p>
            <button class="btn btn-primary btn-sm" @click="openCreate">发布第一篇资讯</button>
          </div>

          <!-- 分页 -->
          <div class="pagination" v-if="total > pageSize">
            <button class="btn btn-sm btn-secondary" :disabled="page <= 1" @click="page--; load()">上一页</button>
            <span class="page-info">{{ page }} / {{ totalPages }}</span>
            <button class="btn btn-sm btn-secondary" :disabled="page >= totalPages" @click="page++; load()">下一页</button>
          </div>
        </template>
      </div>
    </div>

    <!-- 新建/编辑弹窗 -->
    <div class="modal-overlay" v-if="dialog.visible" @click.self="dialog.visible = false">
      <div class="modal-box">
        <div class="modal-header">
          <h3>{{ dialog.isEdit ? '编辑资讯' : '新建资讯' }}</h3>
          <button class="modal-close" @click="dialog.visible = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label>标题 <i class="req">*</i></label>
            <input v-model="dialog.form.title" class="form-input" maxlength="200" placeholder="文章标题" />
          </div>
          <div class="form-item">
            <label>摘要</label>
            <textarea v-model="dialog.form.summary" class="form-input" rows="2" maxlength="300" placeholder="列表页展示的摘要（可选）"></textarea>
          </div>
          <div class="form-item">
            <label>来源</label>
            <input v-model="dialog.form.source" class="form-input" maxlength="50" placeholder="如：WorkBuddy / 内部研究（可选）" />
          </div>
          <div class="form-item form-row">
            <div class="form-item half">
              <label>状态</label>
              <select v-model="dialog.form.status" class="form-input">
                <option value="draft">草稿</option>
                <option value="published">发布</option>
              </select>
            </div>
            <div class="form-item half pin-item">
              <label class="check-label">
                <input type="checkbox" v-model="dialog.form.pinned" />
                置顶显示
              </label>
            </div>
          </div>
          <div class="form-item">
            <label>正文 HTML <i class="req">*</i></label>
            <div class="content-tools">
              <label class="btn btn-sm btn-secondary file-import-btn">
                导入 .html 文件
                <input type="file" accept=".html,.htm" @change="importHtmlFile" hidden />
              </label>
              <span class="content-hint">{{ dialog.form.content_html ? `${(dialog.form.content_html.length / 1024).toFixed(1)} KB` : '可导入整篇 HTML 或直接粘贴' }}</span>
            </div>
            <textarea v-model="dialog.form.content_html" class="form-input content-area" rows="8" placeholder="粘贴完整 HTML 文档，或用上方按钮导入 .html 文件"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="dialog.visible = false">取消</button>
          <button class="btn btn-primary" :disabled="dialog.saving" @click="save">{{ dialog.saving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- 提示 -->
    <div class="toast" v-if="toast.show" :class="toast.type">{{ toast.msg }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import axios from 'axios'

interface NewsRow {
  id: number
  title: string
  summary: string
  source: string
  status: 'draft' | 'published'
  pinned: number
  views: number
  created_at: string
  updated_at: string
}

const list = ref<NewsRow[]>([])
const stats = ref<{ total: number; published: number; draft: number } | null>(null)
const loading = ref(false)
const keyword = ref('')
const statusFilter = ref('')
const page = ref(1)
const pageSize = 15
const total = ref(0)
const selectedIds = reactive(new Set<number>())

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const allChecked = computed(() => list.value.length > 0 && list.value.every(r => selectedIds.has(r.id)))

const dialog = reactive({
  visible: false,
  isEdit: false,
  editId: 0,
  saving: false,
  form: { title: '', summary: '', source: '', status: 'draft' as 'draft' | 'published', pinned: false, content_html: '' }
})

const toast = reactive({ show: false, type: 'success', msg: '' })
function showToast(msg: string, type = 'success') {
  toast.msg = msg
  toast.type = type
  toast.show = true
  setTimeout(() => { toast.show = false }, 2500)
}

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
}

async function load() {
  loading.value = true
  try {
    const params: Record<string, string | number> = { page: page.value, pageSize }
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    if (statusFilter.value) params.status = statusFilter.value
    const { data } = await axios.get('/api/admin/news', { params, headers: authHeaders() })
    list.value = data.list || []
    total.value = data.total || 0
    selectedIds.clear()
  } catch (e: any) {
    showToast(e.response?.data?.error || '加载失败', 'error')
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const { data } = await axios.get('/api/admin/news/stats', { headers: authHeaders() })
    stats.value = data
  } catch { /* 忽略 */ }
}

function resetAndLoad() { page.value = 1; load() }
function resetSearch() { keyword.value = ''; statusFilter.value = ''; resetAndLoad() }

function toggleAll() {
  if (allChecked.value) selectedIds.clear()
  else list.value.forEach(r => selectedIds.add(r.id))
}
function toggleRow(id: number) {
  if (selectedIds.has(id)) selectedIds.delete(id)
  else selectedIds.add(id)
}

async function setStatus(row: NewsRow, status: 'draft' | 'published') {
  try {
    await axios.put(`/api/admin/news/${row.id}/status`, { status }, { headers: authHeaders() })
    showToast(status === 'published' ? `已发布：${row.title}` : `已下架：${row.title}`)
    load()
    loadStats()
  } catch (e: any) {
    showToast(e.response?.data?.error || '操作失败', 'error')
  }
}

async function togglePin(row: NewsRow) {
  try {
    await axios.put(`/api/admin/news/${row.id}`, { pinned: !row.pinned }, { headers: authHeaders() })
    showToast(row.pinned ? '已取消置顶' : '已置顶')
    load()
  } catch (e: any) {
    showToast(e.response?.data?.error || '操作失败', 'error')
  }
}

async function deleteOne(row: NewsRow) {
  if (!confirm(`确定删除资讯「${row.title}」吗？删除后不可恢复。`)) return
  try {
    await axios.delete(`/api/admin/news/${row.id}`, { headers: authHeaders() })
    showToast('已删除')
    load()
    loadStats()
  } catch (e: any) {
    showToast(e.response?.data?.error || '删除失败', 'error')
  }
}

async function batchDelete() {
  const ids = Array.from(selectedIds)
  if (!confirm(`确定删除选中的 ${ids.length} 篇资讯吗？删除后不可恢复。`)) return
  try {
    const { data } = await axios.post('/api/admin/news/batch-delete', { ids }, { headers: authHeaders() })
    showToast(`已删除 ${data.deleted} 篇${data.notFound?.length ? `，${data.notFound.length} 篇不存在已跳过` : ''}`)
    load()
    loadStats()
  } catch (e: any) {
    showToast(e.response?.data?.error || '批量删除失败', 'error')
  }
}

async function batchSetStatus(status: 'draft' | 'published') {
  const ids = Array.from(selectedIds)
  const action = status === 'published' ? '发布' : '下架'
  if (!confirm(`确定${action}选中的 ${ids.length} 篇资讯吗？`)) return
  let ok = 0
  for (const id of ids) {
    try {
      await axios.put(`/api/admin/news/${id}/status`, { status }, { headers: authHeaders() })
      ok++
    } catch { /* 单篇失败不阻断 */ }
  }
  showToast(`已${action} ${ok}/${ids.length} 篇`)
  load()
  loadStats()
}

function openCreate() {
  dialog.isEdit = false
  dialog.editId = 0
  dialog.form = { title: '', summary: '', source: '', status: 'draft', pinned: false, content_html: '' }
  dialog.visible = true
}

async function openEdit(row: NewsRow) {
  try {
    const { data } = await axios.get(`/api/admin/news/${row.id}`, { headers: authHeaders() })
    dialog.isEdit = true
    dialog.editId = row.id
    dialog.form = {
      title: data.title,
      summary: data.summary || '',
      source: data.source || '',
      status: data.status,
      pinned: !!data.pinned,
      content_html: data.content_html || ''
    }
    dialog.visible = true
  } catch (e: any) {
    showToast(e.response?.data?.error || '加载详情失败', 'error')
  }
}

function importHtmlFile(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const html = String(reader.result || '')
    dialog.form.content_html = html
    if (!dialog.form.title) {
      const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      if (m) dialog.form.title = m[1].trim()
    }
    showToast(`已导入 ${file.name}`)
  }
  reader.readAsText(file, 'utf-8')
  ;(ev.target as HTMLInputElement).value = ''
}

async function save() {
  if (!dialog.form.title.trim()) return showToast('请填写标题', 'error')
  if (!dialog.form.content_html.trim()) return showToast('请填写正文 HTML', 'error')
  dialog.saving = true
  try {
    if (dialog.isEdit) {
      await axios.put(`/api/admin/news/${dialog.editId}`, dialog.form, { headers: authHeaders() })
    } else {
      await axios.post('/api/admin/news', dialog.form, { headers: authHeaders() })
    }
    showToast(dialog.isEdit ? '已保存' : '已创建')
    dialog.visible = false
    load()
    loadStats()
  } catch (e: any) {
    showToast(e.response?.data?.error || '保存失败', 'error')
  } finally {
    dialog.saving = false
  }
}

onMounted(() => { load(); loadStats() })
</script>

<style scoped>
.news-admin-page { padding: 0; }

.page-header { margin-bottom: 20px; }
.page-title { font-size: 20px; font-weight: 700; color: #1f2933; margin: 0 0 6px; }
.page-desc { font-size: 13px; color: #64707d; margin: 0; }

.stats-row { display: flex; gap: 14px; margin-bottom: 18px; flex-wrap: wrap; }
.stat-card {
  flex: 1; min-width: 140px;
  background: #fff; border: 1px solid #e4e8ee; border-radius: 12px;
  padding: 14px 18px; display: flex; flex-direction: column; gap: 2px;
}
.stat-value { font-size: 22px; font-weight: 700; color: #1f2933; }
.stat-label { font-size: 12px; color: #94a3b8; }
.stat-published .stat-value { color: #1e7e34; }
.stat-draft .stat-value { color: #b9770e; }

.filter-section { background: #fff; border: 1px solid #e4e8ee; border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
.filter-row { display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
.filter-item { display: flex; flex-direction: column; gap: 4px; }
.filter-item label { font-size: 12px; color: #64707d; }
.filter-input {
  border: 1px solid #d6dce4; border-radius: 8px; padding: 7px 10px;
  font-size: 13px; color: #1f2933; outline: none; background: #fff; min-width: 170px;
}
.filter-input:focus { border-color: #2563eb; }
.filter-actions { display: flex; gap: 8px; margin-left: auto; }

.btn {
  border: none; border-radius: 8px; padding: 8px 16px; font-size: 13px;
  cursor: pointer; transition: opacity 0.2s; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;
}
.btn:disabled { opacity: 0.5; cursor: default; }
.btn-sm { padding: 5px 10px; font-size: 12px; }
.btn-primary { background: #2563eb; color: #fff; }
.btn-primary:hover:not(:disabled) { background: #1d4ed8; }
.btn-secondary { background: #f1f5f9; color: #475569; }
.btn-secondary:hover:not(:disabled) { background: #e2e8f0; }
.btn-danger { background: #dc2626; color: #fff; }
.btn-danger:hover:not(:disabled) { background: #b91c1c; }
.btn-link { background: none; color: #2563eb; padding: 5px 6px; }

.batch-bar {
  display: flex; align-items: center; gap: 10px;
  background: #eaf2f8; border: 1px solid #c7dcf0; border-radius: 10px;
  padding: 8px 14px; margin-bottom: 14px; font-size: 13px; color: #1a5276;
}

.table-section { background: #fff; border: 1px solid #e4e8ee; border-radius: 12px; overflow: hidden; }
.loading-state, .empty-state {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 48px 0; color: #94a3b8; font-size: 14px;
}
.empty-state { flex-direction: column; gap: 12px; }
.spinner {
  width: 18px; height: 18px; border-radius: 50%;
  border: 2px solid #e2e8f0; border-top-color: #2563eb;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.table-container { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th {
  text-align: left; padding: 10px 14px; background: #f8fafc;
  color: #64707d; font-weight: 600; border-bottom: 1px solid #e4e8ee; white-space: nowrap;
}
.data-table td { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
.data-table tr:last-child td { border-bottom: none; }
.data-table tr:hover td { background: #f8fafc; }

.col-check { width: 36px; }
.col-id { color: #94a3b8; width: 50px; }
.col-num { width: 70px; text-align: right; }
.col-time { color: #94a3b8; white-space: nowrap; width: 150px; }

.title-cell { display: flex; flex-direction: column; gap: 2px; min-width: 220px; }
.title-text { font-weight: 600; color: #1f2933; display: flex; align-items: center; gap: 6px; }
.pin-tag {
  font-size: 10px; font-weight: 600; color: #b9770e; background: #fef5e7;
  border-radius: 3px; padding: 0 4px; flex-shrink: 0;
}
.summary-text {
  font-size: 12px; color: #94a3b8;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 420px;
}

.status-tag { font-size: 12px; border-radius: 4px; padding: 2px 8px; white-space: nowrap; }
.status-tag.published { color: #1e7e34; background: #e8f5ec; }
.status-tag.draft { color: #b9770e; background: #fef5e7; }

.action-cell { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; white-space: nowrap; }

.pagination {
  display: flex; align-items: center; justify-content: flex-end; gap: 12px;
  padding: 12px 14px; border-top: 1px solid #f1f5f9; font-size: 13px; color: #64707d;
}

.modal-overlay {
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45);
  display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px;
}
.modal-box {
  background: #fff; border-radius: 14px; width: 640px; max-width: 100%;
  max-height: 90vh; display: flex; flex-direction: column;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.25);
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid #f1f5f9;
}
.modal-header h3 { font-size: 16px; font-weight: 700; color: #1f2933; margin: 0; }
.modal-close { border: none; background: none; font-size: 22px; color: #94a3b8; cursor: pointer; line-height: 1; }
.modal-close:hover { color: #475569; }
.modal-body { padding: 16px 20px; overflow-y: auto; }
.modal-footer {
  display: flex; justify-content: flex-end; gap: 10px;
  padding: 14px 20px; border-top: 1px solid #f1f5f9;
}

.form-item { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
.form-item label { font-size: 13px; color: #475569; font-weight: 600; }
.form-item .req { color: #dc2626; font-style: normal; }
.form-input {
  border: 1px solid #d6dce4; border-radius: 8px; padding: 8px 10px;
  font-size: 13px; color: #1f2933; outline: none; background: #fff; width: 100%;
  font-family: inherit;
}
.form-input:focus { border-color: #2563eb; }
.form-row { flex-direction: row; gap: 14px; }
.form-item.half { flex: 1; }
.pin-item { justify-content: flex-end; }
.check-label { display: flex; align-items: center; gap: 6px; font-weight: 400 !important; padding-top: 8px; cursor: pointer; }

.content-tools { display: flex; align-items: center; gap: 10px; }
.file-import-btn { cursor: pointer; }
.content-hint { font-size: 12px; color: #94a3b8; }
.content-area { font-family: Consolas, monospace; font-size: 12px; resize: vertical; }

.toast {
  position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
  padding: 10px 22px; border-radius: 10px; font-size: 13px; z-index: 200;
  color: #fff; background: #1e7e34; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.2);
}
.toast.error { background: #dc2626; }
</style>
