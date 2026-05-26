<template>
  <div :class="['fund-card', mode]">
    <div v-if="mode === 'list'" class="fund-card-list-content">
      <div class="fund-info">
        <div class="fund-code-label">
          基 {{ fund.code }}
          <button class="hold-btn" :class="{ held: isHeld }" @click.stop="toggleHeld" :title="isHeld ? '已持有' : '未持有'">持</button>
        </div>
        <div class="fund-name">{{ fund.name }}</div>
      </div>
      
      <div class="fund-growth" :class="growthClass">
        {{ growthText }}
      </div>
      
      <div class="fund-growth-value" :class="growthClass">
        {{ growthValueText }}
      </div>
      
      <div class="fund-nav" :class="growthClass">
        {{ fund.nav.toFixed(4) }}
      </div>
      
      <div class="fund-mobile-data">
        <div class="fund-mobile-item">
          <span class="fund-mobile-label">涨跌幅</span>
          <span class="fund-mobile-value" :class="growthClass">{{ growthText }}</span>
        </div>
        <div class="fund-mobile-item">
          <span class="fund-mobile-label">涨跌额</span>
          <span class="fund-mobile-value" :class="growthClass">{{ growthValueText }}</span>
        </div>
        <div class="fund-mobile-item">
          <span class="fund-mobile-label">净值</span>
          <span class="fund-mobile-value" :class="growthClass">{{ fund.nav.toFixed(4) }}</span>
        </div>
      </div>
    </div>
    
    <div v-else class="fund-card-grid-content">
      <div class="grid-code">
        基 {{ fund.code }}
      </div>
      <div class="grid-name" @click.stop="handleDetail">
        <span class="grid-name-text">{{ fund.name }}</span>
        <span v-if="isHeld" class="hold-badge">持</span>
      </div>
      <div class="grid-values">
        <span class="grid-growth" :class="displayGrowthClass">
          {{ displayGrowthText }}<sup v-if="gridDisplayData.isEstimate" class="est-badge">估</sup>
        </span>
        <span class="grid-nav" :class="displayGrowthClass">{{ displayNavText }}</span>
        <span v-if="displayDate" class="grid-date">{{ displayDate }}</span>
      </div>
    </div>
    
    <button class="delete-btn" @click.stop="handleDelete" title="移除自选">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Fund } from '@/types'
import { useFundStore } from '@/stores/fund'

const props = defineProps<{
  fund: Fund
  mode: 'list' | 'grid'
}>()

const emit = defineEmits<{
  delete: [code: string]
  detail: [fund: Fund]
  holding: [fund: Fund]
}>()

const store = useFundStore()

const isHeld = computed(() => store.isHeld(props.fund.code))

const growthClass = computed(() => {
  if (props.fund.dayGrowth > 0) return 'positive'
  if (props.fund.dayGrowth < 0) return 'negative'
  return 'neutral'
})

const growthText = computed(() => {
  const prefix = props.fund.dayGrowth > 0 ? '+' : ''
  return `${prefix}${props.fund.dayGrowth.toFixed(2)}%`
})

const growthValueText = computed(() => {
  const value = props.fund.growthValue || 0
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toFixed(4)}`
})

const today = computed(() => new Date().toISOString().split('T')[0])

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  return dateStr.slice(5).replace('-', '.')
}

const gridDisplayData = computed(() => {
  const jzrq = props.fund.jzrq || ''
  const gztime = props.fund.gztime ? props.fund.gztime.slice(0, 10) : ''
  const dayGrowth = props.fund.dayGrowth ?? 0
  const gszzl = props.fund.gszzl ?? 0
  const nav = props.fund.nav ?? 0
  const gsz = props.fund.gsz ?? nav
  
  if (!gztime || gztime === jzrq) {
    const prefix = dayGrowth > 0 ? '+' : ''
    return {
      growth: dayGrowth,
      growthText: `${prefix}${dayGrowth.toFixed(2)}%`,
      nav: nav,
      navText: nav.toFixed(4),
      date: jzrq !== today.value ? formatDate(jzrq) : '',
      isEstimate: false,
    }
  }
  
  if (gztime > jzrq) {
    const prefix = gszzl > 0 ? '+' : ''
    return {
      growth: gszzl,
      growthText: `${prefix}${gszzl.toFixed(2)}%`,
      nav: gsz,
      navText: gsz.toFixed(4),
      date: gztime !== today.value ? formatDate(gztime) : '',
      isEstimate: true,
    }
  }
  
  const prefix = dayGrowth > 0 ? '+' : ''
  return {
    growth: dayGrowth,
    growthText: `${prefix}${dayGrowth.toFixed(2)}%`,
    nav: nav,
    navText: nav.toFixed(4),
    date: jzrq !== today.value ? formatDate(jzrq) : '',
    isEstimate: false,
  }
})

const displayGrowthClass = computed(() => {
  const growth = gridDisplayData.value.growth
  if (growth > 0) return 'positive'
  if (growth < 0) return 'negative'
  return 'neutral'
})

const displayGrowthText = computed(() => gridDisplayData.value.growthText)
const displayDate = computed(() => gridDisplayData.value.date)
const displayNavText = computed(() => gridDisplayData.value.navText)

function handleDelete() {
  emit('delete', props.fund.code)
}

function handleDetail() {
  emit('detail', props.fund)
}

function toggleHeld() {
  emit('holding', props.fund)
}
</script>

<style scoped>
.fund-card {
  position: relative;
  background: white;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  transition: all 0.2s;
}

.fund-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border-color: #D1D5DB;
}

/* List Mode */
.fund-card.list {
  padding: 0 50px 0 20px;
}

.fund-card-list-content {
  display: flex;
  align-items: center;
  height: 60px;
  gap: 16px;
}

.fund-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
}

.fund-code-label {
  font-size: 12px;
  color: #9333EA;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.fund-name {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fund-growth {
  width: 100px;
  flex-shrink: 0;
  text-align: center;
  font-size: 17px;
  font-weight: 700;
  font-family: 'SF Mono', 'Consolas', 'Courier New', monospace;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fund-growth-value {
  width: 100px;
  flex-shrink: 0;
  text-align: center;
  font-size: 15px;
  font-family: 'SF Mono', 'Consolas', 'Courier New', monospace;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fund-nav {
  width: 100px;
  flex-shrink: 0;
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  font-family: 'SF Mono', 'Consolas', 'Courier New', monospace;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Grid Mode */
.fund-card.grid {
  padding: 12px;
}

.fund-card-grid-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.grid-code {
  font-size: 12px;
  color: #9333EA;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.grid-name {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  line-height: 1.3;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.grid-name-text {
  min-width: 0;
}

.grid-name:hover {
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

.grid-values {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'SF Mono', 'Consolas', 'Courier New', monospace;
}

.grid-growth {
  font-size: 15px;
  font-weight: 700;
}

.grid-growth .est-badge {
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
  margin-left: 5px;
  flex-shrink: 0;
}

.grid-date {
  font-size: 10px;
  color: #9CA3AF;
}

.grid-nav-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'SF Mono', 'Consolas', 'Courier New', monospace;
}

.grid-nav {
  font-size: 13px;
  font-weight: 600;
}

.grid-nav-date {
  font-size: 10px;
  color: #9CA3AF;
}

/* Color Classes */
.positive {
  color: #EF4444;
}

.negative {
  color: #10B981;
}

.neutral {
  color: #6B7280;
}

.hold-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  margin-left: 4px;
  background: transparent;
  border: 1px solid #D1D5DB;
  border-radius: 50%;
  cursor: pointer;
  font-size: 8px;
  font-weight: 600;
  color: #9CA3AF;
  transition: all 0.2s;
  vertical-align: middle;
  opacity: 0.6;
}

.hold-btn:hover {
  border-color: #3B82F6;
  color: #3B82F6;
  opacity: 1;
}

.hold-btn.held {
  background: #3B82F6;
  border-color: #3B82F6;
  color: white;
  opacity: 1;
}

.delete-btn {
  position: absolute;
  right: 8px;
  top: 8px;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.95);
  backdrop-filter: blur(4px);
  border: 1px solid #FECACA;
  border-radius: 6px;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s;
  z-index: 1;
}

.delete-btn svg {
  width: 12px;
  height: 12px;
  color: #F87171;
  transition: color 0.15s;
}

.fund-card:hover .hold-btn {
  opacity: 1;
}

.fund-card:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  background: #FEE2E2;
  border-color: #F87171;
}
.delete-btn:hover svg {
  color: #DC2626;
}

.fund-mobile-data {
  display: none;
}

@media (max-width: 767px) {
  .fund-card.list {
    padding: 12px 44px 12px 12px;
  }
  
  .fund-card.grid {
    padding: 10px;
  }
  
  .fund-card-grid-content {
    gap: 4px;
  }
  
  .fund-card-list-content {
    flex-direction: column;
    align-items: flex-start;
    height: auto;
    gap: 8px;
  }
  
  .fund-info {
    width: 100%;
    gap: 4px;
  }
  
  .fund-name {
    font-size: 15px;
  }
  
  .fund-growth,
  .fund-growth-value,
  .fund-nav {
    display: none;
  }
  
  .fund-mobile-data {
    display: flex;
    width: 100%;
    gap: 12px;
  }
  
  .fund-mobile-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  
  .fund-mobile-label {
    font-size: 11px;
    color: #9CA3AF;
  }
  
  .fund-mobile-value {
    font-size: 13px;
    font-weight: 600;
    font-family: 'SF Mono', 'Consolas', 'Courier New', monospace;
  }
  
  .grid-code,
  .grid-name {
    font-size: 12px;
  }
  
  .grid-name {
    white-space: normal;
    word-break: break-all;
  }
  
  .grid-values {
    gap: 6px;
  }
  
  .grid-growth {
    font-size: 13px;
  }

  .grid-growth .est-badge {
    width: 8px;
    height: 8px;
    font-size: 4px;
  }
  
  .grid-date {
    font-size: 9px;
  }
  
  .grid-nav-row {
    gap: 6px;
  }
  
  .grid-nav {
    font-size: 12px;
  }
  
  .grid-nav-date {
    font-size: 9px;
  }
}
</style>
