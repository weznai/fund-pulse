<template>
  <div class="model-manage-page">
    <div class="page-header">
      <h2 class="page-title">模型管理</h2>
    </div>

    <div class="tabs">
      <button :class="['tab', { active: activeTab === 'providers' }]" @click="activeTab = 'providers'">提供商</button>
      <button :class="['tab', { active: activeTab === 'models' }]" @click="activeTab = 'models'; loadModels()">模型</button>
      <button :class="['tab', { active: activeTab === 'scenes' }]" @click="activeTab = 'scenes'; loadScenes()">场景映射</button>
    </div>

    <!-- Providers -->
    <div class="content-body" v-show="activeTab === 'providers'">
      <div class="section-header">
        <h3>提供商列表</h3>
        <button class="btn btn-primary" @click="openProviderModal()">新增提供商</button>
      </div>
      <div class="loading-state" v-if="loading"><span class="spinner"></span><span>加载中...</span></div>
      <div class="table-container" v-else-if="providers.length > 0">
        <table class="data-table">
          <thead>
            <tr><th>ID</th><th>名称</th><th>API Base</th><th>API Key</th><th>状态</th><th>操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="p in providers" :key="p.id">
              <td>{{ p.id }}</td>
              <td class="font-medium">{{ p.name }}</td>
              <td class="mono">{{ p.api_base }}</td>
              <td>{{ p.api_key ? '••••••' + p.api_key.slice(-4) : '未设置' }}</td>
              <td><span :class="['status-badge', p.enabled ? 'active' : 'disabled']">{{ p.enabled ? '启用' : '禁用' }}</span></td>
              <td>
                <div class="action-btns">
                  <button class="btn btn-sm btn-edit" @click="openProviderModal(p)">编辑</button>
                  <button class="btn btn-sm btn-danger" @click="deleteProvider(p)">删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="empty-state" v-else><span>暂无提供商</span></div>
    </div>

    <!-- Models -->
    <div class="content-body" v-show="activeTab === 'models'">
      <div class="section-header">
        <h3>模型列表</h3>
        <button class="btn btn-primary" @click="openModelModal()">新增模型</button>
      </div>
      <div class="loading-state" v-if="loadingModels"><span class="spinner"></span><span>加载中...</span></div>
      <div class="table-container" v-else-if="models.length > 0">
        <table class="data-table">
          <thead>
            <tr><th>ID</th><th>提供商</th><th>模型ID</th><th>模型名称</th><th>状态</th><th>操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="m in models" :key="m.id">
              <td>{{ m.id }}</td>
              <td>{{ m.provider_name }}</td>
              <td class="mono">{{ m.model_id }}</td>
              <td class="font-medium">{{ m.model_name }}</td>
              <td><span :class="['status-badge', m.enabled ? 'active' : 'disabled']">{{ m.enabled ? '启用' : '禁用' }}</span></td>
              <td>
                <div class="action-btns">
                  <button class="btn btn-sm btn-edit" @click="openModelModal(m)">编辑</button>
                  <button class="btn btn-sm btn-danger" @click="deleteModel(m)">删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="empty-state" v-else><span>暂无模型</span></div>
    </div>

    <!-- Scenes -->
    <div class="content-body" v-show="activeTab === 'scenes'">
      <div class="section-header">
        <h3>场景映射</h3>
      </div>
      <div class="loading-state" v-if="loadingScenes"><span class="spinner"></span><span>加载中...</span></div>
      <div class="table-container" v-else-if="scenes.length > 0">
        <table class="data-table">
          <thead>
            <tr><th>场景</th><th>场景名称</th><th>提供商</th><th>模型ID</th><th>操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="s in scenes" :key="s.id">
              <td class="mono">{{ s.scene }}</td>
              <td class="font-medium">{{ s.scene_name }}</td>
              <td>{{ s.provider_name }}</td>
              <td class="mono">{{ s.model_id }}</td>
              <td>
                <div class="action-btns">
                  <button class="btn btn-sm btn-edit" @click="openSceneModal(s)">编辑</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="empty-state" v-else><span>暂无场景映射</span></div>
    </div>

    <!-- Provider Modal -->
    <div class="modal-overlay" v-if="showProviderModal" @click.self="showProviderModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ editingProvider?.id ? '编辑提供商' : '新增提供商' }}</h3>
          <button class="modal-close" @click="showProviderModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>名称</label>
            <input v-model="providerForm.name" class="form-input" placeholder="如 DeepSeek" />
          </div>
          <div class="form-group">
            <label>API Base</label>
            <input v-model="providerForm.api_base" class="form-input" placeholder="https://api.deepseek.com" />
          </div>
          <div class="form-group">
            <label>API Key</label>
            <input v-model="providerForm.api_key" type="password" class="form-input" placeholder="可选" />
          </div>
          <div class="form-group" v-if="editingProvider?.id">
            <label>状态</label>
            <select v-model="providerForm.enabled" class="form-input">
              <option :value="1">启用</option>
              <option :value="0">禁用</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showProviderModal = false">取消</button>
          <button class="btn btn-primary" @click="saveProvider">保存</button>
        </div>
      </div>
    </div>

    <!-- Model Modal -->
    <div class="modal-overlay" v-if="showModelModal" @click.self="showModelModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ editingModel?.id ? '编辑模型' : '新增模型' }}</h3>
          <button class="modal-close" @click="showModelModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group" v-if="!editingModel?.id">
            <label>提供商</label>
            <select v-model="modelForm.provider_id" class="form-input">
              <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div class="form-group" v-if="!editingModel?.id">
            <label>模型ID</label>
            <input v-model="modelForm.model_id" class="form-input" placeholder="如 deepseek-chat" />
          </div>
          <div class="form-group">
            <label>模型名称</label>
            <input v-model="modelForm.model_name" class="form-input" placeholder="如 DeepSeek Chat" />
          </div>
          <div class="form-group" v-if="editingModel?.id">
            <label>状态</label>
            <select v-model="modelForm.enabled" class="form-input">
              <option :value="1">启用</option>
              <option :value="0">禁用</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showModelModal = false">取消</button>
          <button class="btn btn-primary" @click="saveModel">保存</button>
        </div>
      </div>
    </div>

    <!-- Scene Modal -->
    <div class="modal-overlay" v-if="showSceneModal" @click.self="showSceneModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>编辑场景映射</h3>
          <button class="modal-close" @click="showSceneModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>场景名称</label>
            <input v-model="sceneForm.scene_name" class="form-input" />
          </div>
          <div class="form-group">
            <label>提供商</label>
            <select v-model="sceneForm.provider_id" class="form-input" @change="onSceneProviderChange">
              <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>模型</label>
            <select v-model="sceneForm.model_id" class="form-input">
              <option v-for="m in sceneProviderModels" :key="m.model_id" :value="m.model_id">{{ m.model_name }} ({{ m.model_id }})</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showSceneModal = false">取消</button>
          <button class="btn btn-primary" @click="saveScene">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const token = () => localStorage.getItem('admin_token')
const headers = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` })

const activeTab = ref('providers')
const loading = ref(false)
const loadingModels = ref(false)
const loadingScenes = ref(false)

const providers = ref<any[]>([])
const models = ref<any[]>([])
const scenes = ref<any[]>([])

const showProviderModal = ref(false)
const showModelModal = ref(false)
const showSceneModal = ref(false)

const editingProvider = ref<any>(null)
const editingModel = ref<any>(null)
const editingScene = ref<any>(null)

const providerForm = ref({ name: '', api_base: '', api_key: '', enabled: 1 })
const modelForm = ref({ provider_id: 0, model_id: '', model_name: '', enabled: 1 })
const sceneForm = ref({ scene: '', scene_name: '', provider_id: 0, model_id: '' })
const sceneProviderModels = ref<any[]>([])

async function loadProviders() {
  loading.value = true
  try {
    const r = await fetch('/api/admin/model/providers', { headers: headers() })
    providers.value = await r.json()
  } catch (e) { console.error(e) }
  loading.value = false
}

async function loadModels() {
  loadingModels.value = true
  try {
    const r = await fetch('/api/admin/model/models', { headers: headers() })
    models.value = await r.json()
  } catch (e) { console.error(e) }
  loadingModels.value = false
}

async function loadScenes() {
  loadingScenes.value = true
  try {
    const r = await fetch('/api/admin/model/scenes', { headers: headers() })
    scenes.value = await r.json()
  } catch (e) { console.error(e) }
  loadingScenes.value = false
}

function openProviderModal(p?: any) {
  editingProvider.value = p || null
  providerForm.value = p ? { name: p.name, api_base: p.api_base, api_key: '', enabled: p.enabled } : { name: '', api_base: '', api_key: '', enabled: 1 }
  showProviderModal.value = true
}

async function saveProvider() {
  const f = providerForm.value
  if (!f.name || !f.api_base) return alert('名称和API Base不能为空')
  try {
    if (editingProvider.value?.id) {
      const body: any = { name: f.name, api_base: f.api_base, enabled: f.enabled }
      if (f.api_key) body.api_key = f.api_key
      await fetch(`/api/admin/model/providers/${editingProvider.value.id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) })
    } else {
      await fetch('/api/admin/model/providers', { method: 'POST', headers: headers(), body: JSON.stringify(f) })
    }
    showProviderModal.value = false
    loadProviders()
  } catch (e) { console.error(e) }
}

async function deleteProvider(p: any) {
  if (!confirm(`确定删除提供商「${p.name}」？`)) return
  try {
    const r = await fetch(`/api/admin/model/providers/${p.id}`, { method: 'DELETE', headers: headers() })
    const d = await r.json()
    if (!d.success) return alert(d.error)
    loadProviders()
  } catch (e) { console.error(e) }
}

function openModelModal(m?: any) {
  editingModel.value = m || null
  modelForm.value = m ? { provider_id: m.provider_id, model_id: m.model_id, model_name: m.model_name, enabled: m.enabled } : { provider_id: providers.value[0]?.id || 0, model_id: '', model_name: '', enabled: 1 }
  showModelModal.value = true
}

async function saveModel() {
  const f = modelForm.value
  if (!f.model_name) return alert('模型名称不能为空')
  try {
    if (editingModel.value?.id) {
      await fetch(`/api/admin/model/models/${editingModel.value.id}`, { method: 'PUT', headers: headers(), body: JSON.stringify({ model_name: f.model_name, enabled: f.enabled }) })
    } else {
      if (!f.provider_id || !f.model_id) return alert('缺少必要参数')
      await fetch('/api/admin/model/models', { method: 'POST', headers: headers(), body: JSON.stringify(f) })
    }
    showModelModal.value = false
    loadModels()
  } catch (e) { console.error(e) }
}

async function deleteModel(m: any) {
  if (!confirm(`确定删除模型「${m.model_name}」？`)) return
  try {
    await fetch(`/api/admin/model/models/${m.id}`, { method: 'DELETE', headers: headers() })
    loadModels()
  } catch (e) { console.error(e) }
}

function openSceneModal(s: any) {
  editingScene.value = s
  sceneForm.value = { scene: s.scene, scene_name: s.scene_name, provider_id: s.provider_id, model_id: s.model_id }
  loadSceneModels(s.provider_id)
  showSceneModal.value = true
}

async function loadSceneModels(providerId: number) {
  try {
    const r = await fetch(`/api/admin/model/providers/${providerId}/models`, { headers: headers() })
    sceneProviderModels.value = await r.json()
  } catch (e) { console.error(e) }
}

function onSceneProviderChange() {
  sceneForm.value.model_id = ''
  loadSceneModels(sceneForm.value.provider_id)
}

async function saveScene() {
  const f = sceneForm.value
  if (!f.model_id || !f.provider_id) return alert('缺少必要参数')
  try {
    await fetch(`/api/admin/model/scenes/${f.scene}`, { method: 'PUT', headers: headers(), body: JSON.stringify(f) })
    showSceneModal.value = false
    loadScenes()
  } catch (e) { console.error(e) }
}

onMounted(loadProviders)
</script>

<style scoped>
.model-manage-page { max-width: 1200px; }
.page-header { margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; }
.page-title { font-size: 18px; font-weight: 600; color: #1e3a5f; margin: 0; }

.tabs { display: flex; gap: 4px; margin-bottom: 16px; background: #f1f5f9; border-radius: 8px; padding: 4px; }
.tab { padding: 8px 20px; border: none; border-radius: 6px; background: transparent; font-size: 13px; font-weight: 500; cursor: pointer; color: #64748b; transition: all 0.2s; }
.tab.active { background: #fff; color: #1e3a5f; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }

.content-body { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.section-header h3 { font-size: 15px; font-weight: 600; color: #334155; margin: 0; }

.btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
.btn-primary { background: #3b82f6; color: #fff; }
.btn-primary:hover { background: #2563eb; }
.btn-secondary { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
.btn-secondary:hover { background: #e2e8f0; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.btn-edit { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
.btn-edit:hover { background: #e2e8f0; }
.btn-danger { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
.btn-danger:hover { background: #fee2e2; }

.table-container { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th { background: #f8fafc; padding: 10px 12px; text-align: left; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
.data-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; }
.font-medium { font-weight: 500; }
.mono { font-family: monospace; font-size: 12px; color: #64748b; }

.status-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; }
.status-badge.active { background: #dcfce7; color: #16a34a; }
.status-badge.disabled { background: #f1f5f9; color: #94a3b8; }

.action-btns { display: flex; gap: 6px; }

.loading-state, .empty-state { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 40px; color: #94a3b8; font-size: 14px; }

.spinner { width: 16px; height: 16px; border: 2px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.6s linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: #fff; border-radius: 12px; width: 480px; max-width: 90vw; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #e2e8f0; }
.modal-header h3 { font-size: 16px; font-weight: 600; color: #1e3a5f; margin: 0; }
.modal-close { background: none; border: none; font-size: 20px; color: #94a3b8; cursor: pointer; }
.modal-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid #e2e8f0; }

.form-group { display: flex; flex-direction: column; gap: 4px; }
.form-group label { font-size: 12px; color: #64748b; font-weight: 500; }
.form-input { padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; }
.form-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.1); }
</style>
