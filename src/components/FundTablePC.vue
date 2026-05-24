<template>
  <div class="fund-table-pc">
    <table>
      <thead>
        <tr>
          <th class="col-name">基金名称</th>
          <th class="col-change sortable" @click="$emit('sort', 'dayGrowth')">
            涨跌幅
            <span class="sort-icons">
              <svg class="sort-up" :class="{ active: sortField === 'dayGrowth' && sortDirection === 'asc' }" viewBox="0 0 24 24" fill="none">
                <path d="M12 5l-7 7h14l-7-7z" fill="currentColor"/>
              </svg>
              <svg class="sort-down" :class="{ active: sortField === 'dayGrowth' && sortDirection === 'desc' }" viewBox="0 0 24 24" fill="none">
                <path d="M12 19l-7-7h14l-7 7z" fill="currentColor"/>
              </svg>
            </span>
          </th>
          <th class="col-estimate sortable" @click="$emit('sort', 'gszzl')">
            估值涨幅
            <span class="sort-icons">
              <svg class="sort-up" :class="{ active: sortField === 'gszzl' && sortDirection === 'asc' }" viewBox="0 0 24 24" fill="none">
                <path d="M12 5l-7 7h14l-7-7z" fill="currentColor"/>
              </svg>
              <svg class="sort-down" :class="{ active: sortField === 'gszzl' && sortDirection === 'desc' }" viewBox="0 0 24 24" fill="none">
                <path d="M12 19l-7-7h14l-7 7z" fill="currentColor"/>
              </svg>
            </span>
          </th>
          <th class="col-nav">净值</th>
          <th class="col-profit sortable" @click="$emit('sort', 'todayProfit')">
            当日收益
            <span class="sort-icons">
              <svg class="sort-up" :class="{ active: sortField === 'todayProfit' && sortDirection === 'asc' }" viewBox="0 0 24 24" fill="none">
                <path d="M12 5l-7 7h14l-7-7z" fill="currentColor"/>
              </svg>
              <svg class="sort-down" :class="{ active: sortField === 'todayProfit' && sortDirection === 'desc' }" viewBox="0 0 24 24" fill="none">
                <path d="M12 19l-7-7h14l-7 7z" fill="currentColor"/>
              </svg>
            </span>
          </th>
          <th class="col-holding sortable" @click="$emit('sort', 'holdingAmount')">
            持仓金额
            <span class="sort-icons">
              <svg class="sort-up" :class="{ active: sortField === 'holdingAmount' && sortDirection === 'asc' }" viewBox="0 0 24 24" fill="none">
                <path d="M12 5l-7 7h14l-7-7z" fill="currentColor"/>
              </svg>
              <svg class="sort-down" :class="{ active: sortField === 'holdingAmount' && sortDirection === 'desc' }" viewBox="0 0 24 24" fill="none">
                <path d="M12 19l-7-7h14l-7 7z" fill="currentColor"/>
              </svg>
            </span>
          </th>
          <th class="col-action">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in funds" :key="row.code" @click="$emit('row-click', row)">
          <td class="col-name">
            <div class="fund-info" @click.stop="$emit('detail-click', row)" title="点击查询详情">
              <div class="fund-name-row">
                <span class="fund-name fund-name-link">{{ row.fundName }}</span>
                <span v-if="row.holdingAmountValue" class="hold-badge">持</span>
              </div>
              <span class="fund-code-wrap" @click.stop="copyCode(row.code, $event)">
                <span class="fund-code">{{ row.code }}</span>
                <svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
              </span>
            </div>
          </td>
          <td class="col-change">
            <div class="cell-with-sub">
              <span class="main-value" :class="getChangeClass(row.yesterdayChangeValue)">{{ row.yesterdayChangePercent }}</span>
              <span v-if="!isToday(row.yesterdayDate) && row.yesterdayDate" class="sub-value">{{ row.yesterdayDate }}</span>
            </div>
          </td>
          <td class="col-estimate">
            <div class="cell-with-sub">
              <span class="estimate-val-wrap">
                <span class="main-value" :class="getChangeClass(row.estimateChangeValue)">{{ row.estimateChangePercent }}</span>
                <sup class="est-badge">估</sup>
              </span>
              <span v-if="!isToday(row.estimateTime) && row.estimateTime" class="sub-value">{{ row.estimateTime }}</span>
            </div>
          </td>
          <td class="col-nav">
            <div class="cell-with-sub">
              <span class="main-value" :class="getChangeClass(row.estimateChangeValue)">{{ row.estimateNav || row.latestNav }}</span>
              <span v-if="!isToday(row.estimateNavDateShort) && row.estimateNavDateShort" class="sub-value">{{ row.estimateNavDateShort }}</span>
            </div>
          </td>
          <td class="col-profit">
            <div class="cell-with-sub">
              <span v-if="row.todayProfit" class="main-value" :class="getChangeClass(row.todayProfitValue)">{{ row.todayProfit }}</span>
              <span v-else class="main-value empty">—</span>
              <span v-if="row.isHistoryProfit && row.todayProfitDate" class="sub-value">{{ row.todayProfitDate }}</span>
              <span v-else-if="row.todayProfit" class="sub-value" :class="getChangeClass(row.todayProfitGrowthValue)">{{ row.todayProfitPercent }}</span>
            </div>
          </td>
          <td class="col-holding">
            <div class="holding-cell" @click.stop="$emit('holding-click', row)" :title="row.holdingAmountValue ? '点击修改持仓' : '点击设置持仓'">
              <div class="holding-content">
                <template v-if="hideAmount">
                  <span v-if="row.holdingAmountValue" class="holding-value">********</span>
                  <span v-else class="holding-empty">设置</span>
                </template>
                <template v-else>
                  <span v-if="row.holdingAmountValue" class="holding-value">¥{{ row.holdingAmountValue.toFixed(2) }}</span>
                  <span v-else class="holding-empty">设置</span>
                </template>
                <span v-if="row.holdingProfitPercent" class="holding-profit" :class="getChangeClass(row.holdingProfitValue)">{{ row.holdingProfitPercent }}</span>
              </div>
              <svg class="setting-icon" viewBox="0 0 24 24" fill="none">
                <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" stroke-width="2"/>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" stroke-width="2"/>
              </svg>
            </div>
          </td>
          <td class="col-action">
            <button class="delete-btn" @click.stop="$emit('delete', row)" title="删除">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { FundTableRow } from '@/types'

defineProps<{
  funds: FundTableRow[]
  sortField: string
  sortDirection: 'asc' | 'desc'
  hideAmount?: boolean
}>()

defineEmits<{
  (e: 'row-click', row: FundTableRow): void
  (e: 'delete', row: FundTableRow): void
  (e: 'holding-click', row: FundTableRow): void
  (e: 'sort', field: string): void
  (e: 'detail-click', row: FundTableRow): void
}>()

function getChangeClass(value: number | null): string {
  if (value === null || value === 0) return ''
  return value > 0 ? 'up' : 'down'
}

function copyCode(code: string, e: MouseEvent) {
  navigator.clipboard.writeText(code)
  const wrap = (e.currentTarget as HTMLElement)
  const icon = wrap.querySelector('.copy-icon')
  if (icon) {
    icon.classList.add('copied')
    setTimeout(() => icon.classList.remove('copied'), 1200)
  }
}

function isToday(dateStr: string): boolean {
  if (!dateStr) return false
  const today = new Date().toISOString().split('T')[0]
  return dateStr === today || dateStr.slice(0, 10) === today
}
</script>

<style scoped>
.fund-table-pc {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow-x: auto;
  border: 1px solid #E5E7EB;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  min-width: 700px;
}

thead {
  background: #F3F4F6;
}

th {
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #E5E7EB;
  user-select: none;
  white-space: nowrap;
}

th.sortable {
  cursor: pointer;
}

th.sortable:hover {
  background: #E5E7EB;
}

.sort-icons {
  display: inline-flex;
  flex-direction: column;
  margin-left: 4px;
  vertical-align: middle;
  gap: 0;
}

.sort-icons svg {
  width: 8px;
  height: 8px;
}

.sort-up {
  color: #D1D5DB;
  margin-bottom: -2px;
}

.sort-down {
  color: #D1D5DB;
}

.sort-up.active {
  color: #3B82F6;
}

.sort-down.active {
  color: #3B82F6;
}

th:hover {
  background: #E5E7EB;
}

th.sortable {
  position: relative;
  padding-right: 28px;
}

.sort-icons {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}

.sort-icons svg {
  width: 8px;
  height: 6px;
}

.sort-icons .sort-up {
  margin-bottom: -4px;
  margin-top: -1px;
}

.sort-icons .sort-down {
  margin-top: -4px;
}

.sort-icons svg {
  width: 14px;
  height: 12px;
}

.sort-icons .sort-up,
.sort-icons .sort-down {
  color: #D1D5DB;
  transition: color 0.2s;
}

.sort-icons .sort-up.active,
.sort-icons .sort-down.active {
  color: #3B82F6;
}

td {
  padding: 14px 16px;
  border-bottom: 1px solid #F3F4F6;
  vertical-align: middle;
}

tbody tr {
  cursor: pointer;
  transition: background 0.15s;
}

tbody tr:hover {
  background: #F9FAFB;
}

tbody tr:last-child td {
  border-bottom: none;
}

.col-name {
  min-width: 165px;
  max-width: 185px;
  position: sticky;
  left: 0;
  z-index: 1;
  background: inherit;
}

thead .col-name {
  background: #F3F4F6;
}

tbody .col-name {
  background: white;
}

tbody tr:hover .col-name {
  background: #F9FAFB;
}

.fund-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.fund-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.fund-name {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  min-width: 0;
}

.fund-name-link {
  cursor: pointer;
  transition: color 0.15s;
}

.fund-name-link:hover {
  color: #3B82F6;
}

.fund-info {
  cursor: pointer;
}

.fund-info:hover .fund-name {
  color: #3B82F6;
}

.hold-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  background: #3B82F6;
  color: white;
  font-size: 7px;
  font-weight: 500;
  border-radius: 2px;
  line-height: 1;
  flex-shrink: 0;
  vertical-align: middle;
}

.fund-code {
  font-size: 12px;
  color: #9CA3AF;
  font-family: 'SF Mono', Consolas, monospace;
}

.fund-code-wrap {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.fund-code-wrap:hover .fund-code {
  color: #3B82F6;
}

.copy-icon {
  width: 12px;
  height: 12px;
  color: #9CA3AF;
  opacity: 0;
  transition: all 0.15s;
  flex-shrink: 0;
}

.fund-code-wrap:hover .copy-icon {
  opacity: 1;
  color: #3B82F6;
}

.copy-icon.copied {
  opacity: 1;
  color: #3B82F6;
}

.col-change {
  min-width: 60px;
}

.col-estimate {
  min-width: 50px;
}

.estimate-val-wrap {
  display: inline-flex;
  align-items: flex-start;
}

.est-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(139, 92, 246, 0.18);
  color: #8B5CF6;
  font-size: 6px;
  line-height: 1;
  margin-top: 1px;
  margin-left: 5px;
  flex-shrink: 0;
}

.cell-with-sub {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.main-value {
  font-weight: 700;
  color: #111827;
  font-family: 'SF Mono', Consolas, monospace;
  font-size: 14px;
}

.main-value.empty {
  color: #D1D5DB;
}

.main-value.up {
  color: #EF4444;
}

.main-value.down {
  color: #10B981;
}

.sub-value {
  font-size: 10px;
  color: #9CA3AF;
  font-family: 'SF Mono', Consolas, monospace;
}

.sub-value.up {
  color: #EF4444;
}

.sub-value.down {
  color: #10B981;
}

.change-cell {
  font-weight: 700;
  font-family: 'SF Mono', Consolas, monospace;
  font-size: 14px;
}

.change-cell.up {
  color: #EF4444;
}

.change-cell.down {
  color: #10B981;
}

.col-nav {
  min-width: 50px;
}

.nav-value {
  font-weight: 700;
  color: #111827;
  font-family: 'SF Mono', Consolas, monospace;
  font-size: 14px;
}

.col-profit {
  min-width: 85px;
}

.col-holding {
  min-width: 70px;
}

.holding-cell {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.holding-cell:has(.holding-empty) {
  background: #F3F4F6;
  border: 1px solid #E5E7EB;
}

.holding-cell:hover {
  background: #F3F4F6;
}

.holding-cell:has(.holding-empty):hover {
  border-color: #D1D5DB;
}

.holding-value {
  font-size: 12px;
  font-weight: 700;
  color: #374151;
  font-family: 'SF Mono', Consolas, monospace;
}

.holding-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.holding-empty {
  font-size: 12px;
  color: #9CA3AF;
}

.holding-profit {
  font-size: 10px;
  font-weight: 600;
  color: #9CA3AF;
  font-family: 'SF Mono', Consolas, monospace;
}

.holding-profit.up {
  color: #EF4444;
}

.holding-profit.down {
  color: #10B981;
}

.setting-icon {
  width: 12px;
  height: 12px;
  color: #9CA3AF;
  opacity: 0;
  transition: opacity 0.15s;
}

.holding-cell:hover .setting-icon {
  opacity: 1;
}

.col-action {
  width: 70px;
}

.delete-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: #9CA3AF;
  transition: all 0.15s;
}

.delete-btn:hover {
  background: #FEE2E2;
  color: #EF4444;
}

.delete-btn svg {
  width: 14px;
  height: 14px;
}

@media (max-width: 768px) {
  .sub-value {
    font-size: 8px;
  }
}
</style>
