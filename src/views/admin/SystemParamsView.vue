<template>
  <div class="system-params-page">
    <div class="page-header">
      <h2 class="page-title">参数管理</h2>
    </div>

    <div class="tabs">
      <button :class="['tab', { active: activeTab === 'params' }]" @click="activeTab = 'params'">系统参数</button>
      <button :class="['tab', { active: activeTab === 'holidays' }]" @click="activeTab = 'holidays'">节假日管理</button>
    </div>

    <div class="content-body" v-show="activeTab === 'params'">
      <div class="params-section">
        <div class="section-header">
          <h3>参数列表</h3>
          <button class="btn btn-primary" @click="showAddModal = true">
            <svg viewBox="0 0 24 24" fill="none" class="btn-icon">
              <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            新增参数
          </button>
        </div>

        <div class="loading-state" v-if="loading">
          <span class="spinner"></span>
          <span>加载中...</span>
        </div>

        <div class="table-container" v-else-if="params.length > 0">
          <table class="data-table">
            <thead>
              <tr>
                <th>参数键</th>
                <th>参数值</th>
                <th>备注</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="param in params" :key="param.key">
                <td class="param-key">{{ param.key }}</td>
                <td class="param-value">
                  <span v-if="editingKey !== param.key" class="value-text" @dblclick="startEdit(param)">
                    {{ param.value || '-' }}
                  </span>
                  <input
                    v-else
                    ref="editInputRef"
                    v-model="editingValue"
                    class="edit-input"
                    @blur="saveEdit(param)"
                    @keyup.enter="saveEdit(param)"
                    @keyup.escape="cancelEdit"
                  />
                </td>
                <td class="param-remark">
                  <span v-if="editingRemarkKey !== param.key" class="remark-text" @dblclick="startEditRemark(param)">
                    {{ param.remark || '-' }}
                  </span>
                  <input
                    v-else
                    ref="editRemarkRef"
                    v-model="editingRemark"
                    class="edit-input"
                    @blur="saveEditRemark(param)"
                    @keyup.enter="saveEditRemark(param)"
                    @keyup.escape="cancelEditRemark"
                  />
                </td>
                <td>
                  <div class="action-btns">
                    <button class="btn btn-sm btn-edit" @click="openEditModal(param)">编辑</button>
                    <button class="btn btn-sm btn-danger" @click="deleteParam(param.key)">删除</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="empty-state" v-else>
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <p>暂无参数配置</p>
        </div>
      </div>
    </div>

    <div class="content-body" v-show="activeTab === 'holidays'">
      <div class="params-section compact">
        <div class="section-header compact year-row">
          <h3>年份选择</h3>
          <div class="year-chips">
            <button
              v-for="year in yearOptions"
              :key="year"
              :class="['chip', { active: selectedYear === year }]"
              @click="selectedYear = year"
            >
              {{ year }}
            </button>
          </div>
        </div>
      </div>

      <div class="params-section compact">
        <div class="section-header compact">
          <h3>数据操作</h3>
          <div class="action-btns">
            <button class="btn btn-primary btn-sm" @click="syncYear" :disabled="syncing">
              <svg v-if="syncing" class="btn-icon spinner-icon" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="60" stroke-dashoffset="20"/>
              </svg>
              {{ syncing ? '同步中...' : '同步 ' + selectedYear + ' 年' }}
            </button>
            <button class="btn btn-secondary btn-sm" @click="syncAllYears" :disabled="syncing">
              {{ syncing ? '同步中...' : '同步全部' }}
            </button>
            <button class="btn btn-danger btn-sm" @click="deleteYear" :disabled="loadingHolidays || syncing || holidays.length === 0">
              删除当年
            </button>
          </div>
        </div>

        <div v-if="holidayMessage" :class="['message-box', holidayMessage.type]">
          {{ holidayMessage.text }}
        </div>

        <div v-if="yearStat" class="stat-cards">
          <div class="stat-card holiday">
            <span class="stat-label">节假日</span>
            <span class="stat-value">{{ yearStat.holiday }}</span>
          </div>
          <div class="stat-card workday">
            <span class="stat-label">调休上班</span>
            <span class="stat-value">{{ yearStat.workday }}</span>
          </div>
          <div class="stat-card inlieu">
            <span class="stat-label">补休</span>
            <span class="stat-value">{{ yearStat.inLieuDay }}</span>
          </div>
        </div>
      </div>

      <div class="params-section">
        <div class="section-header">
          <h3>节假日列表 ({{ holidays.length }} 条)</h3>
        </div>

        <div class="loading-state" v-if="loadingHolidays">
          <span class="spinner"></span>
          <span>加载中...</span>
        </div>

        <div class="table-container" v-else-if="holidays.length > 0">
          <table class="data-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>名称</th>
                <th>类型</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="h in holidays" :key="h.date">
                <td class="date-cell">{{ h.date }}</td>
                <td>{{ h.name }}</td>
                <td>
                  <span :class="['type-badge', h.type]">{{ getTypeLabel(h.type) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="empty-state" v-else>
          <svg viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.8"/>
            <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="1.8"/>
          </svg>
          <p>暂无数据</p>
        </div>
      </div>

      <div class="params-section">
        <div class="section-header">
          <h3>月历视图</h3>
          <div class="calendar-nav">
            <button class="cal-nav-btn" @click="calPrevMonth">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <span class="cal-month-label">{{ calYear }} 年 {{ calMonth + 1 }} 月</span>
            <button class="cal-nav-btn" @click="calNextMonth">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
            </button>
            <button class="cal-today-btn" @click="calGoToday">今天</button>
          </div>
        </div>

        <div class="calendar-grid">
          <div class="cal-weekday" v-for="d in calWeekdays" :key="d">{{ d }}</div>
          <div
            v-for="(cell, idx) in calCells"
            :key="idx"
            :class="[
              'cal-cell',
              { 'other-month': !cell.inMonth },
              { 'today': cell.isToday },
              { 'is-holiday': cell.holidayInfo?.type === 'holiday' },
              { 'is-workday': cell.holidayInfo?.type === 'workday' },
              { 'is-inlieu': cell.holidayInfo?.type === 'inLieuDay' },
            ]"
          >
            <span class="cal-day">{{ cell.day }}</span>
            <span v-if="cell.holidayInfo" class="cal-holiday-name">{{ cell.holidayInfo.name }}</span>
          </div>
        </div>

        <div class="calendar-legend">
          <span class="legend-item"><i class="legend-dot holiday"></i>节假日</span>
          <span class="legend-item"><i class="legend-dot workday"></i>调休上班</span>
          <span class="legend-item"><i class="legend-dot inlieu"></i>补休</span>
        </div>
      </div>
    </div>

    <div class="modal-overlay" v-if="showAddModal || showEditModal">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ showEditModal ? '编辑参数' : '新增参数' }}</h3>
          <button class="modal-close" @click="closeModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>参数键</label>
            <input v-model="formData.key" type="text" class="form-input" :disabled="showEditModal" placeholder="请输入参数键" />
          </div>
          <div class="form-group">
            <label>参数值</label>
            <textarea v-model="formData.value" class="form-textarea" placeholder="请输入参数值" rows="3"></textarea>
          </div>
          <div class="form-group">
            <label>备注</label>
            <input v-model="formData.remark" type="text" class="form-input" placeholder="请输入备注（可选）" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="submitForm" :disabled="!formData.key">{{ showEditModal ? '保存' : '添加' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import axios from 'axios'

interface SystemParam {
  key: string
  value: string
  remark?: string
}

interface Holiday {
  id: number
  year: number
  date: string
  name: string
  type: 'holiday' | 'workday' | 'inLieuDay'
}

interface HolidayStat {
  year: number
  holiday: number
  workday: number
  inLieuDay: number
}

interface CalCell {
  date: string
  day: number
  inMonth: boolean
  isToday: boolean
  holidayInfo?: { name: string; type: string }
}

const activeTab = ref('params')

const loading = ref(false)
const params = ref<SystemParam[]>([])
const showAddModal = ref(false)
const showEditModal = ref(false)

const formData = ref({ key: '', value: '', remark: '' })

const editingKey = ref<string | null>(null)
const editingValue = ref('')
const editInputRef = ref<HTMLInputElement | null>(null)

const editingRemarkKey = ref<string | null>(null)
const editingRemark = ref('')
const editRemarkRef = ref<HTMLInputElement | null>(null)

async function loadParams() {
  loading.value = true
  try {
    const { data } = await axios.get('/api/admin/system-params')
    params.value = data || []
  } catch (error) {
    console.error('加载参数失败:', error)
  } finally {
    loading.value = false
  }
}

function openEditModal(param: SystemParam) {
  formData.value = { key: param.key, value: param.value, remark: param.remark || '' }
  showEditModal.value = true
}

function closeModal() {
  showAddModal.value = false
  showEditModal.value = false
  formData.value = { key: '', value: '', remark: '' }
}

async function submitForm() {
  if (!formData.value.key) return

  try {
    await axios.post('/api/admin/system-params', {
      key: formData.value.key.trim(),
      value: formData.value.value.trim(),
      remark: formData.value.remark || undefined
    })
    closeModal()
    loadParams()
  } catch (error: any) {
    alert(error.response?.data?.error || '操作失败')
  }
}

async function deleteParam(key: string) {
  if (!confirm('Delete param "' + key + '"?')) return

  try {
    await axios.delete('/api/admin/system-params/' + key)
    loadParams()
  } catch (error: any) {
    alert(error.response?.data?.error || '删除失败')
  }
}

function startEdit(param: SystemParam) {
  editingKey.value = param.key
  editingValue.value = param.value
  nextTick(() => {
    editInputRef.value?.focus()
    editInputRef.value?.select()
  })
}

async function saveEdit(param: SystemParam) {
  if (editingValue.value === param.value) {
    cancelEdit()
    return
  }

  try {
    await axios.post('/api/admin/system-params', {
      key: param.key,
      value: editingValue.value,
      remark: param.remark
    })
    param.value = editingValue.value
  } catch (error: any) {
    alert(error.response?.data?.error || '保存失败')
  }

  cancelEdit()
}

function cancelEdit() {
  editingKey.value = null
  editingValue.value = ''
}

function startEditRemark(param: SystemParam) {
  editingRemarkKey.value = param.key
  editingRemark.value = param.remark || ''
  nextTick(() => {
    editRemarkRef.value?.focus()
    editRemarkRef.value?.select()
  })
}

async function saveEditRemark(param: SystemParam) {
  if (editingRemark.value === (param.remark || '')) {
    cancelEditRemark()
    return
  }

  try {
    await axios.post('/api/admin/system-params', {
      key: param.key,
      value: param.value,
      remark: editingRemark.value || undefined
    })
    param.remark = editingRemark.value || undefined
  } catch (error: any) {
    alert(error.response?.data?.error || '保存失败')
  }

  cancelEditRemark()
}

function cancelEditRemark() {
  editingRemarkKey.value = null
  editingRemark.value = ''
}

const currentYear = new Date().getFullYear()
const yearOptions = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2]

const selectedYear = ref(currentYear)
const holidays = ref<Holiday[]>([])
const holidayStats = ref<HolidayStat[]>([])
const loadingHolidays = ref(false)
const syncing = ref(false)
const holidayMessage = ref<{ type: string; text: string } | null>(null)

const nowDate = new Date()
const calYear = ref(nowDate.getFullYear())
const calMonth = ref(nowDate.getMonth())
const calWeekdays = ['一', '二', '三', '四', '五', '六', '日']

const holidayMap = computed(() => {
  const m = new Map<string, { name: string; type: string }>()
  for (const h of holidays.value) {
    m.set(h.date, { name: h.name, type: h.type })
  }
  return m
})

const calCells = computed<CalCell[]>(() => {
  const year = calYear.value
  const month = calMonth.value
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()

  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6

  const prevLast = new Date(year, month, 0).getDate()
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const cells: CalCell[] = []

  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevLast - i
    const pm = month === 0 ? 11 : month - 1
    const py = month === 0 ? year - 1 : year
    const dateStr = `${py}-${String(pm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ date: dateStr, day: d, inMonth: false, isToday: dateStr === todayStr, holidayInfo: holidayMap.value.get(dateStr) })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ date: dateStr, day: d, inMonth: true, isToday: dateStr === todayStr, holidayInfo: holidayMap.value.get(dateStr) })
  }

  const remaining = 42 - cells.length
  const nm = month === 11 ? 0 : month + 1
  const ny = month === 11 ? year + 1 : year
  for (let d = 1; d <= remaining; d++) {
    const dateStr = `${ny}-${String(nm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ date: dateStr, day: d, inMonth: false, isToday: dateStr === todayStr, holidayInfo: holidayMap.value.get(dateStr) })
  }

  return cells
})

function calPrevMonth() {
  if (calMonth.value === 0) {
    calMonth.value = 11
    calYear.value--
  } else {
    calMonth.value--
  }
}

function calNextMonth() {
  if (calMonth.value === 11) {
    calMonth.value = 0
    calYear.value++
  } else {
    calMonth.value++
  }
}

function calGoToday() {
  const today = new Date()
  calYear.value = today.getFullYear()
  calMonth.value = today.getMonth()
}

const yearStat = computed(() => holidayStats.value.find(s => s.year === selectedYear.value))

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    holiday: '节假日',
    workday: '调休上班',
    inLieuDay: '补休'
  }
  return labels[type] || type
}

function showHolidayMessage(type: string, text: string) {
  holidayMessage.value = { type, text }
  setTimeout(() => { holidayMessage.value = null }, 5000)
}

async function loadHolidayStats() {
  try {
    const { data } = await axios.get('/api/admin/holidays/stats')
    holidayStats.value = data || []
  } catch (error) {
    console.error('Load stats failed:', error)
  }
}

async function loadHolidays() {
  loadingHolidays.value = true
  try {
    const { data } = await axios.get('/api/admin/holidays/' + selectedYear.value)
    holidays.value = data || []
  } catch (error) {
    console.error('Load holidays failed:', error)
    holidays.value = []
  } finally {
    loadingHolidays.value = false
  }
}

async function syncYear() {
  syncing.value = true
  holidayMessage.value = null
  try {
    const { data } = await axios.post('/api/admin/holidays/sync/' + selectedYear.value)
    showHolidayMessage('success', data.message || 'Synced ' + data.count + ' records')
    await loadHolidays()
    await loadHolidayStats()
  } catch (error: any) {
    showHolidayMessage('error', error.response?.data?.error || 'Sync failed')
  } finally {
    syncing.value = false
  }
}

async function syncAllYears() {
  syncing.value = true
  holidayMessage.value = null
  try {
    const { data } = await axios.post('/api/admin/holidays/sync-batch', { years: yearOptions })
    showHolidayMessage('success', data.message || 'Synced ' + data.count + ' records')
    await loadHolidays()
    await loadHolidayStats()
  } catch (error: any) {
    showHolidayMessage('error', error.response?.data?.error || 'Sync failed')
  } finally {
    syncing.value = false
  }
}

async function deleteYear() {
  if (!confirm('Delete ' + selectedYear.value + ' holiday data?')) return

  loadingHolidays.value = true
  try {
    await axios.delete('/api/admin/holidays/' + selectedYear.value)
    showHolidayMessage('success', 'Deleted')
    holidays.value = []
    await loadHolidayStats()
  } catch (error: any) {
    showHolidayMessage('error', error.response?.data?.error || 'Delete failed')
  } finally {
    loadingHolidays.value = false
  }
}

watch(selectedYear, () => {
  loadHolidays()
})

onMounted(() => {
  loadParams()
  loadHolidayStats()
  loadHolidays()
})
</script>

<style scoped>
.system-params-page {
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

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.tab {
  padding: 8px 20px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.tab:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.tab.active {
  border-color: #3b82f6;
  background: #3b82f6;
  color: #fff;
}

.content-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.params-section {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.params-section.compact {
  padding: 10px 16px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-header.compact {
  margin-bottom: 12px;
}

.section-header.compact.year-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
}

.section-header.compact.year-row .year-chips {
  flex: 1;
  justify-content: center;
}

.section-header.compact h3 {
  font-size: 14px;
}

.section-header.compact h3::before {
  height: 14px;
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

.year-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.chip {
  padding: 6px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #fff;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.chip:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.chip.active {
  background: linear-gradient(135deg, #1e3a5f 0%, #3b82f6 100%);
  border-color: transparent;
  color: #fff;
}

.action-btns {
  display: flex;
  gap: 10px;
}

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

.spinner-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
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

.btn-danger {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  color: #dc2626;
}

.btn-danger:hover:not(:disabled) {
  background: linear-gradient(135deg, #fecaca 0%, #fca5a5 100%);
}

.message-box {
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
}

.message-box.success {
  background: #dcfce7;
  color: #16a34a;
}

.message-box.error {
  background: #fee2e2;
  color: #dc2626;
}

.stat-cards {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.stat-card {
  flex: 1;
  padding: 12px;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-card.holiday {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
}

.stat-card.workday {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
}

.stat-card.inlieu {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
}

.stat-label {
  font-size: 12px;
  color: #64748b;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #1e3a5f;
}

.table-container {
  overflow-x: auto;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  max-height: 400px;
  overflow-y: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.data-table th {
  text-align: left;
  padding: 14px 18px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  color: #475569;
  font-weight: 600;
  border-bottom: 2px solid #e2e8f0;
  font-size: 13px;
  position: sticky;
  top: 0;
}

.data-table td {
  padding: 12px 18px;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
}

.data-table tbody tr:hover {
  background: #f8fafc;
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.param-key {
  font-family: 'SF Mono', Consolas, monospace;
  font-size: 13px;
  font-weight: 600;
  color: #1e3a5f;
}

.param-value,
.param-remark {
  max-width: 300px;
}

.value-text,
.remark-text {
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
  display: inline-block;
}

.value-text:hover,
.remark-text:hover {
  background: #f1f5f9;
}

.edit-input {
  padding: 6px 10px;
  border: 2px solid #3b82f6;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  width: 100%;
  max-width: 250px;
}

.date-cell {
  font-family: 'SF Mono', Consolas, monospace;
  font-size: 13px;
  font-weight: 500;
}

.type-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.type-badge.holiday {
  background: #fee2e2;
  color: #dc2626;
}

.type-badge.workday {
  background: #dcfce7;
  color: #16a34a;
}

.type-badge.inLieuDay {
  background: #fef3c7;
  color: #d97706;
}

.empty-state {
  text-align: center;
  padding: 64px 24px;
  color: #94a3b8;
}

.empty-state svg {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: 15px;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 64px 24px;
  color: #64748b;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e2e8f0;
  border-top-color: #1e3a5f;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.btn-edit {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  color: #1d4ed8;
}

.btn-edit:hover {
  background: linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%);
}

.info-section {
  padding: 16px;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.info-text {
  margin: 0;
  font-size: 13px;
  color: #64748b;
  line-height: 1.6;
}

.info-text + .info-text {
  margin-top: 4px;
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
  z-index: 1000;
}

.modal {
  background: #fff;
  border-radius: 16px;
  width: 100%;
  max-width: 480px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1e3a5f;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #94a3b8;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.modal-close:hover {
  color: #64748b;
}

.modal-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #475569;
}

.form-input {
  width: 100%;
  padding: 12px 14px;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
  transition: all 0.2s;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.form-input:disabled {
  background: #f8fafc;
  color: #64748b;
}

.form-textarea {
  width: 100%;
  padding: 12px 14px;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
  transition: all 0.2s;
  box-sizing: border-box;
  resize: vertical;
  font-family: inherit;
}

.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  background: #f8fafc;
  border-radius: 0 0 16px 16px;
}

.calendar-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cal-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  color: #475569;
  transition: all 0.2s;
}

.cal-nav-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.cal-month-label {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  min-width: 110px;
  text-align: center;
}

.cal-today-btn {
  padding: 4px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  color: #475569;
  transition: all 0.2s;
}

.cal-today-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 16px;
}

.cal-weekday {
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: #94a3b8;
  padding: 8px 0;
}

.cal-cell {
  position: relative;
  min-height: 64px;
  padding: 6px 8px;
  border-radius: 10px;
  border: 1px solid #f1f5f9;
  background: #fff;
  transition: all 0.15s;
  display: flex;
  flex-direction: column;
}

.cal-cell:hover {
  border-color: #cbd5e1;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.cal-cell.other-month {
  opacity: 0.35;
}

.cal-cell.today {
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px #3b82f6;
}

.cal-cell.is-holiday {
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  border-color: #fecaca;
}

.cal-cell.is-workday {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border-color: #bbf7d0;
}

.cal-cell.is-inlieu {
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  border-color: #fde68a;
}

.cal-day {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
}

.cal-cell.today .cal-day {
  color: #3b82f6;
}

.cal-holiday-name {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cal-cell.is-holiday .cal-holiday-name {
  color: #dc2626;
}

.cal-cell.is-workday .cal-holiday-name {
  color: #16a34a;
}

.cal-cell.is-inlieu .cal-holiday-name {
  color: #d97706;
}

.calendar-legend {
  display: flex;
  gap: 20px;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #64748b;
}

.legend-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 4px;
}

.legend-dot.holiday {
  background: #fee2e2;
  border: 1px solid #fecaca;
}

.legend-dot.workday {
  background: #dcfce7;
  border: 1px solid #bbf7d0;
}

.legend-dot.inlieu {
  background: #fef3c7;
  border: 1px solid #fde68a;
}
</style>
