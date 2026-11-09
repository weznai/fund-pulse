<template>
  <div class="admin-accounts-page">
    <div class="page-header">
      <h2 class="page-title">管理员账号</h2>
      <p class="page-desc">管理后台登录账号与权限。超级管理员拥有全部权限；资讯维护仅可管理资讯文章。内置超管（账号留空 + 环境变量密码）不在此列表中</p>
    </div>

    <div class="content-body">
      <!-- 提示 -->
      <div class="builtin-hint">
        <span>内置超管：登录时账号留空、使用 ADMIN_PASSWORD 密码即可，拥有全部权限。</span>
      </div>

      <!-- 搜索栏 -->
      <div class="filter-section">
        <div class="filter-row">
          <div class="filter-item">
            <label>关键字</label>
            <input v-model="keyword" @keyup.enter="load" placeholder="用户名/备注..." class="filter-input" />
          </div>
          <div class="filter-actions">
            <button class="btn btn-primary" @click="load">查询</button>
            <button class="btn btn-secondary" @click="keyword = ''; load()">重置</button>
            <button class="btn btn-primary" @click="openCreate">新建账号</button>
          </div>
        </div>
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
                  <th>ID</th>
                  <th>用户名</th>
                  <th>备注</th>
                  <th>角色</th>
                  <th>状态</th>
                  <th>最近登录</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in list" :key="row.id">
                  <td class="col-id">{{ row.id }}</td>
                  <td class="username-cell">{{ row.username }}</td>
                  <td class="label-cell">{{ row.label || '-' }}</td>
                  <td>
                    <span class="role-tag" :class="row.role">{{ roleText(row.role) }}</span>
                  </td>
                  <td>
                    <span class="status-tag" :class="row.disabled ? 'off' : 'on'">{{ row.disabled ? '已禁用' : '启用中' }}</span>
                  </td>
                  <td class="col-time">{{ formatTime(row.last_login_at) }}</td>
                  <td class="col-time">{{ formatTime(row.created_at) }}</td>
                  <td>
                    <div class="action-cell">
                      <button class="btn btn-sm btn-link" @click="openEdit(row)">编辑</button>
                      <button class="btn btn-sm btn-link" @click="openResetPassword(row)">重置密码</button>
                      <button class="btn btn-sm btn-secondary" @click="toggleDisabled(row)">{{ row.disabled ? '启用' : '禁用' }}</button>
                      <button class="btn btn-sm btn-danger" @click="deleteOne(row)">删除</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="empty-state" v-else>
            <p>暂无后台账号</p>
            <button class="btn btn-primary btn-sm" @click="openCreate">创建第一个账号</button>
          </div>
        </template>
      </div>
    </div>

    <!-- 新建/编辑弹窗 -->
    <div class="modal-overlay" v-if="dialog.visible" @click.self="dialog.visible = false">
      <div class="modal-box">
        <div class="modal-header">
          <h3>{{ dialog.isEdit ? `编辑账号：${dialog.form.username}` : '新建账号' }}</h3>
          <button class="modal-close" @click="dialog.visible = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-item" v-if="!dialog.isEdit">
            <label>用户名 <i class="req">*</i></label>
            <input v-model="dialog.form.username" class="form-input" maxlength="32" placeholder="2-32 位字母/数字/下划线/中划线" />
          </div>
          <div class="form-item" v-if="!dialog.isEdit">
            <label>密码 <i class="req">*</i></label>
            <input v-model="dialog.form.password" class="form-input" type="text" maxlength="64" placeholder="6-64 位" />
          </div>
          <div class="form-item">
            <label>角色 <i class="req">*</i></label>
            <select v-model="dialog.form.role" class="form-input">
              <option value="news">资讯维护（仅资讯管理）</option>
              <option value="super">超级管理员（全部权限）</option>
            </select>
          </div>
          <div class="form-item">
            <label>备注</label>
            <input v-model="dialog.form.label" class="form-input" maxlength="50" placeholder="如：资讯维护（可选）" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="dialog.visible = false">取消</button>
          <button class="btn btn-primary" :disabled="dialog.saving" @click="save">{{ dialog.saving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- 重置密码弹窗 -->
    <div class="modal-overlay" v-if="pwdDialog.visible" @click.self="pwdDialog.visible = false">
      <div class="modal-box modal-sm">
        <div class="modal-header">
          <h3>重置密码：{{ pwdDialog.username }}</h3>
          <button class="modal-close" @click="pwdDialog.visible = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label>新密码 <i class="req">*</i></label>
            <input v-model="pwdDialog.password" class="form-input" type="text" maxlength="64" placeholder="6-64 位" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="pwdDialog.visible = false">取消</button>
          <button class="btn btn-primary" :disabled="pwdDialog.saving" @click="savePassword">{{ pwdDialog.saving ? '保存中...' : '重置' }}</button>
        </div>
      </div>
    </div>

    <!-- 提示 -->
    <div class="toast" v-if="toast.show" :class="toast.type">{{ toast.msg }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import axios from 'axios'

interface AdminAccountRow {
  id: number
  username: string
  role: 'super' | 'news'
  label: string
  disabled: number
  last_login_at: number | null
  created_at: number
}

const list = ref<AdminAccountRow[]>([])
const loading = ref(false)
const keyword = ref('')

const dialog = reactive({
  visible: false,
  isEdit: false,
  editId: 0,
  saving: false,
  form: { username: '', password: '', role: 'news' as 'super' | 'news', label: '' }
})

const pwdDialog = reactive({
  visible: false,
  saving: false,
  userId: 0,
  username: '',
  password: ''
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

function roleText(role: string) {
  return role === 'super' ? '超级管理员' : '资讯维护'
}

function formatTime(ts: number | null): string {
  if (!ts) return '-'
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function load() {
  loading.value = true
  try {
    const params: Record<string, string> = {}
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    const { data } = await axios.get('/api/admin/admin-users', { params, headers: authHeaders() })
    list.value = data.list || []
  } catch (e: any) {
    showToast(e.response?.data?.error || '加载失败', 'error')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  dialog.isEdit = false
  dialog.editId = 0
  dialog.form = { username: '', password: '', role: 'news', label: '' }
  dialog.visible = true
}

function openEdit(row: AdminAccountRow) {
  dialog.isEdit = true
  dialog.editId = row.id
  dialog.form = { username: row.username, password: '', role: row.role, label: row.label || '' }
  dialog.visible = true
}

async function save() {
  if (!dialog.isEdit) {
    if (!/^[a-zA-Z0-9_\-]{2,32}$/.test(dialog.form.username)) return showToast('用户名需为 2-32 位字母/数字/下划线/中划线', 'error')
    if (dialog.form.password.length < 6) return showToast('密码至少 6 位', 'error')
  }
  dialog.saving = true
  try {
    if (dialog.isEdit) {
      await axios.put(`/api/admin/admin-users/${dialog.editId}`, {
        role: dialog.form.role,
        label: dialog.form.label
      }, { headers: authHeaders() })
    } else {
      await axios.post('/api/admin/admin-users', dialog.form, { headers: authHeaders() })
    }
    showToast(dialog.isEdit ? '已保存' : '已创建')
    dialog.visible = false
    load()
  } catch (e: any) {
    showToast(e.response?.data?.error || '保存失败', 'error')
  } finally {
    dialog.saving = false
  }
}

function openResetPassword(row: AdminAccountRow) {
  pwdDialog.userId = row.id
  pwdDialog.username = row.username
  pwdDialog.password = ''
  pwdDialog.visible = true
}

async function savePassword() {
  if (pwdDialog.password.length < 6) return showToast('密码至少 6 位', 'error')
  pwdDialog.saving = true
  try {
    await axios.put(`/api/admin/admin-users/${pwdDialog.userId}`, { password: pwdDialog.password }, { headers: authHeaders() })
    showToast(`已重置 ${pwdDialog.username} 的密码`)
    pwdDialog.visible = false
  } catch (e: any) {
    showToast(e.response?.data?.error || '重置失败', 'error')
  } finally {
    pwdDialog.saving = false
  }
}

async function toggleDisabled(row: AdminAccountRow) {
  const action = row.disabled ? '启用' : '禁用'
  if (!confirm(`确定${action}账号「${row.username}」吗？`)) return
  try {
    await axios.put(`/api/admin/admin-users/${row.id}/status`, { disabled: !row.disabled }, { headers: authHeaders() })
    showToast(`已${action}：${row.username}`)
    load()
  } catch (e: any) {
    showToast(e.response?.data?.error || '操作失败', 'error')
  }
}

async function deleteOne(row: AdminAccountRow) {
  if (!confirm(`确定删除账号「${row.username}」吗？删除后该账号将无法登录。`)) return
  try {
    await axios.delete(`/api/admin/admin-users/${row.id}`, { headers: authHeaders() })
    showToast('已删除')
    load()
  } catch (e: any) {
    showToast(e.response?.data?.error || '删除失败', 'error')
  }
}

onMounted(load)
</script>

<style scoped>
.admin-accounts-page { padding: 0; }

.page-header { margin-bottom: 20px; }
.page-title { font-size: 20px; font-weight: 700; color: #1f2933; margin: 0 0 6px; }
.page-desc { font-size: 13px; color: #64707d; margin: 0; }

.builtin-hint {
  display: flex; align-items: center; gap: 10px;
  background: #eaf2f8; border: 1px solid #c7dcf0; border-radius: 10px;
  padding: 8px 14px; margin-bottom: 14px; font-size: 13px; color: #1a5276;
}

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

.col-id { color: #94a3b8; width: 50px; }
.col-time { color: #94a3b8; white-space: nowrap; width: 140px; }
.username-cell { font-weight: 600; color: #1f2933; }
.label-cell { color: #64707d; }

.role-tag { font-size: 12px; border-radius: 4px; padding: 2px 8px; white-space: nowrap; }
.role-tag.super { color: #6d28d9; background: #f3e8ff; }
.role-tag.news { color: #1a5276; background: #eaf2f8; }

.status-tag { font-size: 12px; border-radius: 4px; padding: 2px 8px; white-space: nowrap; }
.status-tag.on { color: #1e7e34; background: #e8f5ec; }
.status-tag.off { color: #b91c1e; background: #fdecea; }

.action-cell { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; white-space: nowrap; }

.modal-overlay {
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45);
  display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px;
}
.modal-box {
  background: #fff; border-radius: 14px; width: 520px; max-width: 100%;
  max-height: 90vh; display: flex; flex-direction: column;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.25);
}
.modal-sm { width: 420px; }
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

.toast {
  position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
  padding: 10px 22px; border-radius: 10px; font-size: 13px; z-index: 200;
  color: #fff; background: #1e7e34; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.2);
}
.toast.error { background: #dc2626; }
</style>
