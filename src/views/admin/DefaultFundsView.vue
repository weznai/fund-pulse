<template>
  <div class="default-funds-page">
    <div class="page-header">
      <h2 class="page-title">基金管理</h2>
      <p class="page-desc">管理新用户首次使用时导入的默认基金列表</p>
    </div>

    <div class="content-body">
      <!-- 新增基金区域 -->
      <div class="add-section">
        <div class="section-header">
          <h3>新增基金</h3>
        </div>
        <div class="add-form">
          <input
            v-model="newFundCode"
            type="text"
            class="fund-input"
            placeholder="输入基金代码或名称搜索"
            @keyup.enter="searchFund"
            :disabled="searching"
          />
          <button class="btn btn-primary" @click="searchFund" :disabled="searching || !newFundCode.trim()">
            <span class="spinner" v-if="searching"></span>
            {{ searching ? '搜索中...' : '搜索基金' }}
          </button>
        </div>

        <!-- 搜索结果 -->
        <div class="search-results" v-if="searchResults.length > 0">
          <div class="search-result-item" v-for="fund in searchResults" :key="fund.code">
            <div class="fund-info">
              <span class="fund-code">{{ fund.code }}</span>
              <span class="fund-name">{{ fund.name }}</span>
              <span class="fund-type" v-if="fund.type">{{ fund.type }}</span>
            </div>
            <button class="btn btn-sm btn-success" @click="confirmAddFund(fund)">
              添加
            </button>
          </div>
        </div>
        <div class="no-results" v-else-if="searched && !searching">
          未找到匹配的基金
        </div>
      </div>

      <!-- 编辑区域 -->
      <div class="edit-section">
        <div class="section-header">
          <h3>基金代码配置</h3>
          <div class="header-actions">
            <button class="btn btn-secondary" @click="resetToDefault">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M3 3v5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              恢复默认
            </button>
            <button class="btn btn-primary btn-save-config" @click="saveConfig" :disabled="saving">
              <svg viewBox="0 0 24 24" fill="none" v-if="!saving">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="17 21 17 13 7 13 7 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="7 3 7 8 15 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span class="spinner" v-else></span>
              {{ saving ? '保存中...' : '保存配置' }}
            </button>
          </div>
        </div>

        <div class="form-group">
          <label>基金代码（多个代码用逗号分隔）</label>
          <textarea
            v-model="fundCodesText"
            class="fund-textarea"
            placeholder="请输入基金代码，多个代码用英文逗号分隔，例如：000001,110022,161725"
            rows="4"
          ></textarea>
          <div class="form-hint">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            支持任意格式输入，系统会自动提取6位数字的基金代码
          </div>
        </div>
      </div>

      <!-- 预览区域 -->
      <div class="preview-section">
        <div class="section-header">
          <h3>基金列表预览</h3>
          <div class="header-right">
            <button class="btn btn-sm btn-secondary" @click="loadFundNames" :disabled="loadingNames" v-if="parsedCodes.length > 0">
              {{ loadingNames ? '加载中...' : '加载基金名称' }}
            </button>
            <span class="fund-count">共 {{ parsedCodes.length }} 只基金</span>
          </div>
        </div>

        <div class="fund-list" v-if="parsedCodes.length > 0">
          <div class="fund-item" v-for="(code, index) in parsedCodes" :key="code">
            <span class="fund-index">{{ index + 1 }}</span>
            <span class="fund-code">{{ code }}</span>
            <span class="fund-name-preview" v-if="fundNames[code]">{{ fundNames[code] }}</span>
            <span class="fund-name-loading" v-else-if="loadingNames">加载中...</span>
            <button class="btn-remove" @click="removeCode(code)" title="移除">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="empty-state" v-else>
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <p>暂无基金代码</p>
        </div>
      </div>

      <!-- 操作提示 -->
      <div class="tips-section">
        <h4>说明</h4>
        <ul>
          <li>修改配置后，点击"保存配置"按钮将更新配置文件</li>
          <li>新用户首次访问时，会自动导入此处配置的默认基金</li>
          <li>已有自选基金的用户不会受影响</li>
          <li>建议先搜索验证基金是否存在，确认后再添加</li>
        </ul>
      </div>
    </div>

    <!-- 确认添加对话框 -->
    <div class="modal-overlay" v-if="showConfirmModal" @click.self="showConfirmModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>确认添加基金</h3>
          <button class="modal-close" @click="showConfirmModal = false">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="confirm-fund-info">
            <div class="confirm-row">
              <span class="confirm-label">基金代码：</span>
              <span class="confirm-value">{{ pendingFund?.code }}</span>
            </div>
            <div class="confirm-row">
              <span class="confirm-label">基金名称：</span>
              <span class="confirm-value">{{ pendingFund?.name }}</span>
            </div>
            <div class="confirm-row" v-if="pendingFund?.type">
              <span class="confirm-label">基金类型：</span>
              <span class="confirm-value">{{ pendingFund?.type }}</span>
            </div>
          </div>
          <p class="confirm-hint">确认要将此基金添加到默认基金列表吗？</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showConfirmModal = false">取消</button>
          <button class="btn btn-primary" @click="addFundToCode">确认添加</button>
        </div>
      </div>
    </div>

    <!-- 保存成功提示 -->
    <div class="toast success" v-if="showSuccess">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      {{ successMessage }}
    </div>

    <!-- 错误提示 -->
    <div class="toast error" v-if="showError">
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
        <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      {{ errorMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const fundCodesText = ref('')
const saving = ref(false)
const showSuccess = ref(false)
const successMessage = ref('')
const showError = ref(false)
const errorMessage = ref('')
const originalCodes = ref('')

// 新增基金相关
const newFundCode = ref('')
const searching = ref(false)
const searched = ref(false)
const searchResults = ref<Array<{ code: string; name: string; type?: string }>>([])
const showConfirmModal = ref(false)
const pendingFund = ref<{ code: string; name: string; type?: string } | null>(null)

// 基金名称缓存
const fundNames = ref<Record<string, string>>({})
const loadingNames = ref(false)

// 解析基金代码
const parsedCodes = computed(() => {
  const text = fundCodesText.value
  // 匹配所有6位数字
  const codes = text.match(/\d{6}/g) || []
  // 去重并保持顺序
  return [...new Set(codes)]
})

// 加载当前配置
onMounted(async () => {
  try {
    const { data } = await axios.get('/api/admin/default-funds')
    fundCodesText.value = data.codes.join(',')
    originalCodes.value = fundCodesText.value
    // 自动加载基金名称
    if (data.codes.length > 0) {
      loadFundNames()
    }
  } catch (error) {
    console.error('加载配置失败:', error)
    showErrorMessage('加载配置失败，请刷新页面重试')
  }
})

// 搜索基金
async function searchFund() {
  const keyword = newFundCode.value.trim()
  if (!keyword || searching.value) return

  searching.value = true
  searched.value = false
  searchResults.value = []

  try {
    const { data } = await axios.get('/api/eastmoney/FundSearch.ashx', {
      params: {
        key: keyword,
        pagesize: 10
      }
    })

    searchResults.value = (data.Datas || []).map((item: any) => ({
      code: item.code,
      name: item.name,
      type: item.type
    }))
    searched.value = true
  } catch (error) {
    console.error('搜索基金失败:', error)
    showErrorMessage('搜索失败，请重试')
  } finally {
    searching.value = false
  }
}

// 确认添加基金
function confirmAddFund(fund: { code: string; name: string; type?: string }) {
  pendingFund.value = fund
  showConfirmModal.value = true
}

// 添加基金到代码列表
function addFundToCode() {
  if (!pendingFund.value) return

  const code = pendingFund.value.code
  const codes = parsedCodes.value

  if (!codes.includes(code)) {
    codes.push(code)
    fundCodesText.value = codes.join(',')
    // 缓存基金名称
    fundNames.value[code] = pendingFund.value.name
  }

  showConfirmModal.value = false
  pendingFund.value = null
  newFundCode.value = ''
  searchResults.value = []
  searched.value = false

  showSuccessMessage('基金已添加到列表')
}

// 加载基金名称
async function loadFundNames() {
  if (loadingNames.value || parsedCodes.value.length === 0) return

  loadingNames.value = true

  try {
    const { data } = await axios.post('/api/funds', {
      codes: parsedCodes.value
    })

    const namesMap: Record<string, string> = {}
    data.forEach((fund: any) => {
      if (fund && fund.code && fund.name) {
        namesMap[fund.code] = fund.name
      }
    })

    fundNames.value = namesMap
  } catch (error) {
    console.error('加载基金名称失败:', error)
  } finally {
    loadingNames.value = false
  }
}

// 移除单个代码
function removeCode(code: string) {
  const codes = parsedCodes.value.filter(c => c !== code)
  fundCodesText.value = codes.join(',')
  // 移除缓存的名称
  delete fundNames.value[code]
}

// 恢复默认
function resetToDefault() {
  fundCodesText.value = '000001,110022,161725,519772,007301,004854,000961,040008,377240,260108'
  fundNames.value = {}
  loadFundNames()
}

// 保存配置
async function saveConfig() {
  if (saving.value) return

  if (parsedCodes.value.length === 0) {
    showErrorMessage('请至少添加一个基金代码')
    return
  }

  saving.value = true
  try {
    await axios.post('/api/admin/default-funds', {
      codes: parsedCodes.value
    })
    originalCodes.value = fundCodesText.value
    showSuccessMessage('保存成功！')
  } catch (error: any) {
    console.error('保存配置失败:', error)
    const msg = error.response?.data?.error || '保存失败，请重试'
    showErrorMessage(msg)
  } finally {
    saving.value = false
  }
}

// 显示成功消息
function showSuccessMessage(msg: string) {
  successMessage.value = msg
  showSuccess.value = true
  setTimeout(() => {
    showSuccess.value = false
  }, 3000)
}

// 显示错误消息
function showErrorMessage(msg: string) {
  errorMessage.value = msg
  showError.value = true
  setTimeout(() => {
    showError.value = false
  }, 5000)
}
</script>

<style scoped>
.default-funds-page {
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

.header-actions {
  display: flex;
  gap: 10px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 卡片通用样式 */
.add-section,
.edit-section,
.preview-section {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03);
  border: 1px solid #e2e8f0;
  transition: all 0.3s ease;
}

.add-section:hover,
.edit-section:hover,
.preview-section:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.add-section {
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
}

.add-form {
  display: flex;
  gap: 12px;
}

.fund-input {
  flex: 1;
  padding: 14px 18px;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  font-size: 15px;
  background: #fff;
  transition: all 0.3s ease;
}

.fund-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.fund-input:disabled {
  background: #f8fafc;
  cursor: not-allowed;
}

/* 搜索结果 */
.search-results {
  margin-top: 16px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.search-result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #f1f5f9;
  transition: all 0.2s;
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.fund-info {
  display: flex;
  align-items: center;
  gap: 14px;
}

.fund-info .fund-code {
  font-family: 'SF Mono', Consolas, monospace;
  font-weight: 600;
  color: #1e3a5f;
  font-size: 14px;
}

.fund-info .fund-name {
  color: #334155;
  font-size: 14px;
}

.fund-info .fund-type {
  font-size: 11px;
  color: #64748b;
  background: #f1f5f9;
  padding: 3px 10px;
  border-radius: 20px;
  font-weight: 500;
}

.no-results {
  margin-top: 16px;
  text-align: center;
  padding: 24px;
  color: #94a3b8;
  font-size: 14px;
  background: #f8fafc;
  border-radius: 12px;
}

/* 编辑区域 */
.edit-section {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.form-group {
  margin-bottom: 0;
}

.form-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 10px;
}

.fund-textarea {
  width: 100%;
  padding: 16px;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  font-size: 14px;
  font-family: 'SF Mono', Consolas, monospace;
  resize: vertical;
  transition: all 0.3s ease;
  background: #fff;
}

.fund-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.form-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 13px;
  color: #64748b;
  padding: 10px 14px;
  background: rgba(59, 130, 246, 0.05);
  border-radius: 8px;
}

.form-hint svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: #3b82f6;
}

/* 预览区域 */
.fund-count {
  font-size: 13px;
  font-weight: 600;
  color: #1e3a5f;
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
  padding: 6px 14px;
  border-radius: 20px;
}

.fund-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.fund-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: linear-gradient(135deg, #f8fafc 0%, #fff 100%);
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  transition: all 0.3s ease;
}

.fund-item:hover {
  border-color: #cbd5e1;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transform: translateY(-1px);
}

.fund-index {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e3a5f 0%, #3b82f6 100%);
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
}

.fund-code {
  font-size: 13px;
  font-weight: 600;
  color: #1e3a5f;
  font-family: 'SF Mono', Consolas, monospace;
}

.fund-name-preview {
  font-size: 12px;
  color: #64748b;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fund-name-loading {
  font-size: 12px;
  color: #94a3b8;
}

.btn-remove {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: #94a3b8;
  transition: all 0.2s;
  padding: 0;
}

.btn-remove:hover {
  background: #fee2e2;
  color: #ef4444;
}

.btn-remove svg {
  width: 14px;
  height: 14px;
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: #94a3b8;
}

.empty-state svg {
  width: 56px;
  height: 56px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}

/* 提示区域 */
.tips-section {
  background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%);
  border: 1px solid #fde047;
  border-radius: 12px;
  padding: 20px 24px;
}

.tips-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: #854d0e;
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tips-section h4::before {
  content: '💡';
}

.tips-section ul {
  margin: 0;
  padding-left: 20px;
}

.tips-section li {
  font-size: 13px;
  color: #a16207;
  line-height: 2;
}

/* 按钮 */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn svg {
  width: 14px;
  height: 14px;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
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

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* 保存配置按钮颜色变浅 */
.btn-save-config {
  background: linear-gradient(135deg, #64748b 0%, #94a3b8 100%);
  box-shadow: 0 2px 6px rgba(100, 116, 139, 0.2);
}

.btn-save-config:hover:not(:disabled) {
  box-shadow: 0 4px 10px rgba(100, 116, 139, 0.3);
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

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-success {
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  color: #fff;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.btn-success:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 模态框 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.modal {
  background: #fff;
  border-radius: 20px;
  width: 90%;
  max-width: 420px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  animation: slideUp 0.3s ease;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-bottom: 1px solid #e2e8f0;
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.modal-close {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  cursor: pointer;
  color: #64748b;
  transition: all 0.2s;
}

.modal-close:hover {
  background: #fee2e2;
  border-color: #fecaca;
  color: #ef4444;
}

.modal-close svg {
  width: 18px;
  height: 18px;
}

.modal-body {
  padding: 24px;
}

.confirm-fund-info {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 12px;
  padding: 18px;
  margin-bottom: 16px;
}

.confirm-row {
  display: flex;
  margin-bottom: 10px;
}

.confirm-row:last-child {
  margin-bottom: 0;
}

.confirm-label {
  width: 80px;
  color: #64748b;
  font-size: 14px;
  flex-shrink: 0;
}

.confirm-value {
  color: #1e293b;
  font-size: 14px;
  font-weight: 600;
}

.confirm-hint {
  font-size: 14px;
  color: #475569;
  margin: 0;
  text-align: center;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
}

/* Toast 提示 */
.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 24px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  animation: slideIn 0.3s ease;
  z-index: 1001;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
}

.toast.success {
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  color: #fff;
}

.toast.error {
  background: linear-gradient(135deg, #ef4444 0%, #f87171 100%);
  color: #fff;
}

.toast svg {
  width: 20px;
  height: 20px;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@media (max-width: 768px) {
  .page-header {
    padding: 20px;
  }

  .add-form {
    flex-direction: column;
  }

  .header-actions {
    flex-direction: column;
    gap: 8px;
  }
}
</style>
