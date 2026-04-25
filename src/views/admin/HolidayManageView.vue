<template>
  <div class="holiday-manage-page">
    <div class="page-header">
      <h2 class="page-title">节假日管理</h2>
      <p class="page-desc">管理交易日历，同步节假日数据</p>
    </div>

    <div class="content-body">
      <div class="params-section">
        <div class="section-header">
          <h3>年份选择</h3>
        </div>
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

      <div class="params-section">
        <div class="section-header">
          <h3>数据操作</h3>
          <div class="action-btns">
            <button class="btn btn-primary" @click="syncYear" :disabled="syncing">
              <svg v-if="syncing" class="btn-icon spinner-icon" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="60" stroke-dashoffset="20"/>
              </svg>
              {{ syncing ? '同步中...' : `同步 ${selectedYear} 年` }}
            </button>
            <button class="btn btn-secondary" @click="syncAllYears" :disabled="syncing">
              {{ syncing ? '同步中...' : '同步全部年份' }}
            </button>
            <button class="btn btn-danger" @click="deleteYear" :disabled="loading || syncing || holidays.length === 0">
              删除当年数据
            </button>
          </div>
        </div>

        <div v-if="message" :class="['message-box', message.type]">
          {{ message.text }}
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

        <div class="loading-state" v-if="loading">
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
          <p>暂无数据，请点击同步按钮从 CDN 获取</p>
        </div>
      </div>

      <div class="info-section">
        <p class="info-text">数据来源: chinese-days npm 包 (jsDelivr CDN)</p>
        <p class="info-text">注意: 同步会覆盖已存在的同日期数据</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'

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

const currentYear = new Date().getFullYear()
const yearOptions = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2]

const selectedYear = ref(currentYear)
const holidays = ref<Holiday[]>([])
const stats = ref<HolidayStat[]>([])
const loading = ref(false)
const syncing = ref(false)
const message = ref<{ type: string; text: string } | null>(null)

const yearStat = computed(() => stats.value.find(s => s.year === selectedYear.value))

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    holiday: '节假日',
    workday: '调休上班',
    inLieuDay: '补休'
  }
  return labels[type] || type
}

function showMessage(type: string, text: string) {
  message.value = { type, text }
  setTimeout(() => { message.value = null }, 5000)
}

async function loadStats() {
  try {
    const { data } = await axios.get('/api/admin/holidays/stats')
    stats.value = data || []
  } catch (error) {
    console.error('加载统计失败:', error)
  }
}

async function loadHolidays() {
  loading.value = true
  try {
    const { data } = await axios.get(`/api/admin/holidays/${selectedYear.value}`)
    holidays.value = data || []
  } catch (error) {
    console.error('加载节假日失败:', error)
    holidays.value = []
  } finally {
    loading.value = false
  }
}

async function syncYear() {
  syncing.value = true
  message.value = null
  try {
    const { data } = await axios.post(`/api/admin/holidays/sync/${selectedYear.value}`)
    showMessage('success', data.message || `成功同步 ${data.count} 条数据`)
    await loadHolidays()
    await loadStats()
  } catch (error: any) {
    showMessage('error', error.response?.data?.error || '同步失败')
  } finally {
    syncing.value = false
  }
}

async function syncAllYears() {
  syncing.value = true
  message.value = null
  try {
    const { data } = await axios.post('/api/admin/holidays/sync-batch', {
      years: yearOptions
    })
    showMessage('success', data.message || `成功同步 ${data.count} 条数据`)
    await loadHolidays()
    await loadStats()
  } catch (error: any) {
    showMessage('error', error.response?.data?.error || '同步失败')
  } finally {
    syncing.value = false
  }
}

async function deleteYear() {
  if (!confirm(`确定删除 ${selectedYear.value} 年的节假日数据？`)) return
  
  loading.value = true
  try {
    await axios.delete(`/api/admin/holidays/${selectedYear.value}`)
    showMessage('success', '删除成功')
    holidays.value = []
    await loadStats()
  } catch (error: any) {
    showMessage('error', error.response?.data?.error || '删除失败')
  } finally {
    loading.value = false
  }
}

watch(selectedYear, () => {
  loadHolidays()
})

onMounted(() => {
  loadStats()
  loadHolidays()
})
</script>

<style scoped>
.holiday-manage-page {
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

.params-section {
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
  margin-bottom: 20px;
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
  padding: 8px 20px;
  border: 2px solid #e2e8f0;
  border-radius: 20px;
  background: #fff;
  font-size: 14px;
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
  gap: 6px;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-icon {
  width: 16px;
  height: 16px;
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
  gap: 16px;
  margin-bottom: 16px;
}

.stat-card {
  flex: 1;
  padding: 16px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
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
  font-size: 13px;
  color: #64748b;
}

.stat-value {
  font-size: 24px;
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
</style>
