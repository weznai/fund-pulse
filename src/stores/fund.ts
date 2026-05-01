import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Fund, FundTableRow } from '@/types'
import { fetchFunds } from '@/api/fund'
import { useHoldings } from '@/composables/useHoldings'
import * as userApi from '@/api/user'

const STORAGE_VERSION = 'v2'

export const useFundStore = defineStore('fund', () => {
  const favoriteCodes = ref<string[]>([])
  const favoriteFunds = ref<Fund[]>([])
  const loading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const viewMode = ref<'grid' | 'list'>('list')
  const lastUpdateTime = ref<string>('')
  const sortField = ref<string>('dayGrowth')
  const sortDirection = ref<'desc' | 'asc'>('desc')
  const hideAmount = ref<boolean>(false)
  const filterMode = ref<'all' | 'held'>('all')
  const useDatabase = ref<boolean>(false)
  const isMigrating = ref<boolean>(false)
  const migrationCompleted = ref<boolean>(false)
  const isInitialized = ref<boolean>(false)

  const holdings = useHoldings()

  let pollingTimer: number | null = null

  const favorites = computed(() => favoriteFunds.value)

  const sortedFavorites = computed(() => {
    const sorted = [...favoriteFunds.value].sort((a, b) => {
      let aVal: number, bVal: number

      switch (sortField.value) {
        case 'name':
          return sortDirection.value === 'desc'
            ? b.name.localeCompare(a.name)
            : a.name.localeCompare(a.name)
        case 'gszzl':
          aVal = a.gszzl ?? 0
          bVal = b.gszzl ?? 0
          break
        case 'holdingAmount': {
          const aHolding = holdings.getHolding(a.code)
          const bHolding = holdings.getHolding(b.code)
          aVal = aHolding ? aHolding.share * (a.gsz || a.nav) : 0
          bVal = bHolding ? bHolding.share * (b.gsz || b.nav) : 0
          break
        }
        case 'todayProfit': {
          const aHolding = holdings.getHolding(a.code)
          const bHolding = holdings.getHolding(b.code)
          const aGrowth = a.dayGrowth ?? a.gszzl ?? null
          const bGrowth = b.dayGrowth ?? b.gszzl ?? null
          const today = new Date().toLocaleDateString('sv-SE')
          const aJzrq = a.jzrq || ''
          const bJzrq = b.jzrq || ''
          const aGztime = a.gztime ? a.gztime.slice(0, 10) : ''
          const bGztime = b.gztime ? b.gztime.slice(0, 10) : ''

          const aIsToday = (aJzrq === today && aGrowth != null) || (aGztime === today && aGrowth != null)
          const bIsToday = (bJzrq === today && bGrowth != null) || (bGztime === today && bGrowth != null)

          if (aIsToday && aHolding) {
            const aAmount = aHolding.share * (a.gsz || a.nav)
            aVal = aAmount * ((aGrowth!) / 100)
          } else if (aHolding && aHolding.lastSettledDate && aHolding.currentDayProfit != null) {
            aVal = aHolding.currentDayProfit
          } else {
            aVal = 0
          }

          if (bIsToday && bHolding) {
            const bAmount = bHolding.share * (b.gsz || b.nav)
            bVal = bAmount * ((bGrowth!) / 100)
          } else if (bHolding && bHolding.lastSettledDate && bHolding.currentDayProfit != null) {
            bVal = bHolding.currentDayProfit
          } else {
            bVal = 0
          }
          break
        }
        case 'dayGrowth':
        default:
          aVal = a.dayGrowth ?? 0
          bVal = b.dayGrowth ?? 0
      }

      return sortDirection.value === 'desc' ? bVal - aVal : aVal - bVal
    })
    return sorted
  })

  async function setSortField(field: string) {
    if (sortField.value === field) {
      sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc'
    } else {
      sortField.value = field
      sortDirection.value = 'desc'
    }

    if (useDatabase.value) {
      try {
        await userApi.saveUserPreferences({ sortField: sortField.value, sortDirection: sortDirection.value })
      } catch (error) {
        console.error('保存排序设置失败:', error)
      }
    } else {
      localStorage.setItem('sortField', sortField.value)
      localStorage.setItem('sortDirection', sortDirection.value)
    }
  }

  async function toggleSortDirection() {
    sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc'

    if (useDatabase.value) {
      try {
        await userApi.saveUserPreferences({ sortDirection: sortDirection.value })
      } catch (error) {
        console.error('保存排序方向失败:', error)
      }
    } else {
      localStorage.setItem('sortDirection', sortDirection.value)
    }
  }

  async function toggleHideAmount() {
    hideAmount.value = !hideAmount.value
    if (useDatabase.value) {
      try {
        await userApi.saveUserPreferences({ hideAmount: hideAmount.value })
      } catch (error) {
        console.error('保存隐藏金额设置失败:', error)
      }
    }
  }

  async function setFilterMode(mode: 'all' | 'held') {
    filterMode.value = mode
    localStorage.setItem('filterMode', mode)
  }

  function loadFromLocalStorage() {
    const data: {
      favoriteFunds: string[]
      hideAmount: boolean
      viewMode: 'grid' | 'list'
      sortField: string
      sortDirection: 'desc' | 'asc'
      filterMode: 'all' | 'held'
    } = {
      favoriteFunds: [],
      hideAmount: false,
      viewMode: 'list',
      sortField: 'dayGrowth',
      sortDirection: 'desc',
      filterMode: 'all'
    }

    try {
      const storedVersion = localStorage.getItem('favoriteFundsVersion')
      const stored = localStorage.getItem('favoriteFunds')
      if (stored && storedVersion === STORAGE_VERSION) {
        try {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed) && parsed.length > 0) {
            data.favoriteFunds = parsed
          }
        } catch (e) {
          console.error('解析自选基金数据失败:', e)
        }
      }
    } catch (e) {
      console.error('读取自选基金失败:', e)
    }

    try {
      const hideAmount = localStorage.getItem('hideAmount')
      if (hideAmount) {
        data.hideAmount = hideAmount === 'true'
      }
    } catch (e) {
      console.error('读取隐藏金额设置失败:', e)
    }

    try {
      const storedFilterMode = localStorage.getItem('filterMode')
      if (storedFilterMode && (storedFilterMode === 'all' || storedFilterMode === 'held')) {
        data.filterMode = storedFilterMode as 'all' | 'held'
      }
    } catch (e) {
      console.error('读取过滤模式失败:', e)
    }

    try {
      const storedSortField = localStorage.getItem('sortField')
      if (storedSortField) {
        data.sortField = storedSortField
      }
    } catch (e) {
      console.error('读取排序字段失败:', e)
    }

    try {
      const storedSortDirection = localStorage.getItem('sortDirection')
      if (storedSortDirection === 'asc' || storedSortDirection === 'desc') {
        data.sortDirection = storedSortDirection
      }
    } catch (e) {
      console.error('读取排序方向失败:', e)
    }

    return data
  }

  function hasLocalData(): boolean {
    return !!(
      localStorage.getItem('favoriteFunds') ||
      localStorage.getItem('fund_holdings')
    )
  }

  async function migrateToDatabase(): Promise<boolean> {
    if (isMigrating.value || migrationCompleted.value) {
      return false
    }

    try {
      isMigrating.value = true
      console.log('🔄 开始迁移数据到数据库...')

      const localData = loadFromLocalStorage()
      const localHoldings = holdings.loadFromLocalStorage()

      const migrationData = {
        favoriteFunds: localData.favoriteFunds,
        holdings: Object.fromEntries(localHoldings),
        hideAmount: localData.hideAmount,
        viewMode: localData.viewMode,
        sortField: localData.sortField,
        sortDirection: localData.sortDirection
      }

      const result = await userApi.migrateFromLocal(migrationData)

      if (result.success) {
        console.log('✅ 数据迁移成功:', result.message)
        migrationCompleted.value = true
        useDatabase.value = true
        await holdings.setUseDatabase(true)
        await loadFromDatabase()
        clearLocalStorage()
        return true
      }
    } catch (error) {
      console.error('❌ 数据迁移失败:', error)
    } finally {
      isMigrating.value = false
    }

    return false
  }

  async function loadFromDatabase(): Promise<boolean> {
    try {
      const prefs = await userApi.getUserPreferences()
      
      if (prefs.isTempUser) {
        console.log('📦 临时用户，使用 localStorage 存储')
        useDatabase.value = false
        return false
      }

      viewMode.value = prefs.viewMode || 'list'
      sortField.value = prefs.sortField || 'dayGrowth'
      sortDirection.value = prefs.sortDirection || 'desc'
      hideAmount.value = prefs.hideAmount || false
      useDatabase.value = true
      migrationCompleted.value = prefs.migratedFromLocal || false

      await holdings.setUseDatabase(true)

      const userFunds = await userApi.getUserFunds()
      favoriteCodes.value = userFunds.map(f => f.fundCode)

      console.log('💾 从数据库加载用户数据:', favoriteCodes.value.length, '只基金')

      if (favoriteCodes.value.length === 0) {
        console.log('🎯 没有自选基金，初始化默认基金...')
        await initializeDefaultFunds()
      }

      return true
    } catch (error) {
      console.error('从数据库加载用户数据失败:', error)
      const localData = loadFromLocalStorage()
      favoriteCodes.value = localData.favoriteFunds
      viewMode.value = localData.viewMode
      sortField.value = localData.sortField
      sortDirection.value = localData.sortDirection
      hideAmount.value = localData.hideAmount
      filterMode.value = localData.filterMode
      return false
    }
  }

  function clearLocalStorage() {
    const keysToRemove = [
      'favoriteFunds',
      'favoriteFundsVersion',
      'heldFunds',
      'fund_holdings',
      'fund_estimate_cache',
      'hideAmount',
      'filterMode',
      'sortField',
      'sortDirection',
      'viewMode'
    ]
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key)
      } catch (e) {
        // 忽略错误
      }
    })
    console.log('🗑️ 已清除 localStorage 数据')
  }

  async function switchToLocalMode(): Promise<void> {
    useDatabase.value = false
    migrationCompleted.value = false
    await holdings.setUseDatabase(false)
    
    const localData = loadFromLocalStorage()
    favoriteCodes.value = localData.favoriteFunds
    viewMode.value = localData.viewMode
    sortField.value = localData.sortField
    sortDirection.value = localData.sortDirection
    hideAmount.value = localData.hideAmount
    filterMode.value = localData.filterMode

    if (favoriteCodes.value.length === 0) {
      initializeDefaultFunds()
    }

    console.log('📦 已切换到 localStorage 模式')
  }

  function initDefaultFunds() {
    let loadedFromStorage = false

    try {
      const storedVersion = localStorage.getItem('favoriteFundsVersion')
      const stored = localStorage.getItem('favoriteFunds')

      if (stored && storedVersion === STORAGE_VERSION) {
        try {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed) && parsed.length > 0) {
            favoriteCodes.value = parsed
            loadedFromStorage = true
            console.log('✅ Loaded', parsed.length, 'fund codes from localStorage')
          }
        } catch (e) {
          console.error('❌ Error parsing stored data:', e)
        }
      }
    } catch (e) {
      console.error('❌ localStorage error:', e)
    }

    if (!loadedFromStorage) {
      console.log('🎯 没有 localStorage 数据，等待异步初始化推荐基金')
    }

    try {
      const storedFilterMode = localStorage.getItem('filterMode')
      if (storedFilterMode && (storedFilterMode === 'all' || storedFilterMode === 'held')) {
        filterMode.value = storedFilterMode as 'all' | 'held'
        console.log('✅ Loaded filterMode from localStorage:', filterMode.value)
      }
    } catch (e) {
      console.error('❌ Failed to load filterMode from storage', e)
    }

    try {
      const storedSortField = localStorage.getItem('sortField')
      if (storedSortField) {
        sortField.value = storedSortField
      }
      const storedSortDirection = localStorage.getItem('sortDirection')
      if (storedSortDirection === 'asc' || storedSortDirection === 'desc') {
        sortDirection.value = storedSortDirection
      }
    } catch (e) {
      console.error('❌ Failed to load sort preferences from storage', e)
    }

    console.log('📊 Current favorite codes:', favoriteCodes.value.length)
  }

  function startPolling() {
    stopPolling()
    fetchFavorites()
    pollingTimer = window.setInterval(() => {
      fetchFavorites()
    }, 120000)
  }

  function stopPolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer)
      pollingTimer = null
    }
  }

  async function fetchFavorites() {
    if (favoriteCodes.value.length === 0) {
      favoriteFunds.value = []
      return
    }

    loading.value = true
    error.value = null

    try {
      const funds = await fetchFunds(favoriteCodes.value)
      favoriteFunds.value = funds
      lastUpdateTime.value = new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    } catch (e) {
      error.value = '获取基金数据失败'
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  async function addFavorite(code: string, name?: string) {
    if (!favoriteCodes.value.includes(code)) {
      favoriteCodes.value.push(code)

      if (useDatabase.value) {
        try {
          await userApi.addUserFund(code, name)
        } catch (error) {
          console.error('添加基金到数据库失败:', error)
        }
      } else {
        saveToStorage()
      }
    }
  }

  async function addFavoritesBatch(funds: Array<{ code: string; fundName?: string }>): Promise<number> {
    console.log('📌 addFavoritesBatch 被调用，传入:', funds.length, '只')
    console.log('📌 当前 favoriteCodes:', favoriteCodes.value.slice(0, 5).join(','), '...')
    
    const newFunds = funds.filter(f => !favoriteCodes.value.includes(f.code))
    console.log('📌 过滤后 newFunds:', newFunds.length, '只')
    
    if (newFunds.length === 0) return 0

    for (const fund of newFunds) {
      favoriteCodes.value.push(fund.code)
    }

    if (useDatabase.value) {
      try {
        const result = await userApi.addUserFundsBatch(newFunds)
        console.log('💾 批量添加基金到数据库:', result.count, '只')
        return result.count
      } catch (error) {
        console.error('批量添加基金到数据库失败:', error)
        return 0
      }
    } else {
      saveToStorage()
      console.log('📦 批量添加基金到 localStorage:', newFunds.length, '只')
      return newFunds.length
    }
  }

  async function removeFavorite(code: string) {
    const index = favoriteCodes.value.indexOf(code)
    if (index > -1) {
      favoriteCodes.value.splice(index, 1)
      favoriteFunds.value = favoriteFunds.value.filter(f => f.code !== code)

      console.log('🗑️ 删除基金:', code, ', useDatabase:', useDatabase.value)

      if (useDatabase.value) {
        try {
          const result = await userApi.deleteUserFund(code)
          console.log('🗑️ 数据库删除结果:', result)
        } catch (error) {
          console.error('从数据库删除基金失败:', error)
        }
      } else {
        saveToStorage()
      }

      console.log('🗑️ Removed fund:', code, ', remaining:', favoriteCodes.value.length)
    }
  }

  function isFavorite(code: string): boolean {
    return favoriteCodes.value.includes(code)
  }

  function toggleViewMode() {
    viewMode.value = viewMode.value === 'list' ? 'grid' : 'list'

    if (useDatabase.value) {
      userApi.saveUserPreferences({ viewMode: viewMode.value }).catch(console.error)
    } else {
      localStorage.setItem('viewMode', viewMode.value)
    }
  }

  function saveToStorage() {
    if (useDatabase.value) return

    localStorage.setItem('favoriteFundsVersion', STORAGE_VERSION)
    localStorage.setItem('favoriteFunds', JSON.stringify(favoriteCodes.value))
    localStorage.setItem('filterMode', filterMode.value)
    localStorage.setItem('sortField', sortField.value)
    localStorage.setItem('sortDirection', sortDirection.value)
  }

  function isHeld(code: string): boolean {
    const holding = holdings.getHolding(code)
    return holding !== undefined && holding.amount > 0
  }

  async function initializeDefaultFunds(): Promise<void> {
    console.log('🔍 initializeDefaultFunds 被调用，当前 favoriteCodes 数量:', favoriteCodes.value.length)

    if (favoriteCodes.value.length === 0) {
      console.log('🎯 用户首次进入，初始化默认自选基金...')
      
      let defaultCodes: string[] = []
      
      try {
        const result = await userApi.getRecommendFunds()
        defaultCodes = result.codes
        console.log('📥 从 API 获取推荐基金:', defaultCodes.length, '只')
      } catch (error) {
        console.warn('获取推荐基金失败:', error)
      }
      
      if (defaultCodes.length === 0) {
        console.log('⚠️ 没有推荐基金，跳过默认导入')
        return
      }
      
      favoriteCodes.value = defaultCodes

      if (useDatabase.value) {
        try {
          const fundsToAdd = defaultCodes.map(code => ({ code }))
          await userApi.addUserFundsBatch(fundsToAdd)
          console.log('💾 默认自选基金已保存到数据库:', favoriteCodes.value.length, '只')
        } catch (error) {
          console.error('保存默认自选基金失败:', error)
        }
      } else {
        saveToStorage()
        console.log('📦 默认自选基金已保存到 localStorage:', favoriteCodes.value.length, '只')
      }
    } else {
      console.log('⏭️ 跳过初始化，已有', favoriteCodes.value.length, '只基金')
    }
  }

  function convertToTableRow(fund: Fund): FundTableRow {
    const today = new Date().toLocaleDateString('sv-SE')
    const isUpdated = fund.jzrq === today

    const estimateDate = fund.gztime ? fund.gztime.slice(0, 10) : ''
    const isEstimateToday = estimateDate === today

    const holding = holdings.getHolding(fund.code)

    let holdingAmount = holding ? holding.amount : null

    let effectiveGrowth: number | null = null
    let displayGrowthPercent = '—'

    if (isUpdated && fund.dayGrowth != null) {
      effectiveGrowth = fund.dayGrowth
      displayGrowthPercent = `${fund.dayGrowth > 0 ? '+' : ''}${fund.dayGrowth.toFixed(2)}%`
    } else if (isEstimateToday && fund.gszzl != null) {
      effectiveGrowth = fund.gszzl
      displayGrowthPercent = `${fund.gszzl > 0 ? '+' : ''}${fund.gszzl.toFixed(2)}%`
    } else if (fund.dayGrowth != null) {
      effectiveGrowth = fund.dayGrowth
      displayGrowthPercent = `${fund.dayGrowth > 0 ? '+' : ''}${fund.dayGrowth.toFixed(2)}%`
    } else if (fund.gszzl != null) {
      effectiveGrowth = fund.gszzl
      displayGrowthPercent = `${fund.gszzl > 0 ? '+' : ''}${fund.gszzl.toFixed(2)}%`
    }

    // 当日收益计算：已结算使用数据库值，未结算实时计算，兜底用最近交易日收益
    let todayProfit: number | null = null
    let isHistoryProfit = false
    let todayProfitDate = today

    if (holding && holding.settled && holding.currentDayProfit != null && holding.lastSettledDate === today) {
      // 已结算且是今天的结算：使用数据库存储的当日收益（准确值）
      todayProfit = holding.currentDayProfit
      todayProfitDate = today
      isHistoryProfit = false
    } else if (holdingAmount !== null && effectiveGrowth !== null) {
      // 未结算或结算数据过期：实时计算
      todayProfit = Math.round(holdingAmount * (effectiveGrowth / 100) * 100) / 100
    }

    // 兜底：非交易日或未开盘时，用最近交易日的结算收益
    if (todayProfit === null && holding && holding.lastSettledDate && holding.currentDayProfit != null && holding.currentDayProfitRate != null) {
      todayProfit = holding.currentDayProfit
      isHistoryProfit = true
      todayProfitDate = holding.lastSettledDate
    }

    // 收益率：已结算或兜底时用数据库值，否则用实时值
    if (isHistoryProfit && holding && holding.currentDayProfitRate != null) {
      displayGrowthPercent = `${holding.currentDayProfitRate > 0 ? '+' : ''}${holding.currentDayProfitRate.toFixed(2)}%`
      effectiveGrowth = holding.currentDayProfitRate
    }

    const jzrqDate = fund.jzrq || fund.lastUpdate || ''
    const yesterdayDateDisplay = isUpdated ? '' : jzrqDate

    const displayNav = isUpdated ? fund.nav : (fund.gsz || fund.nav)
    const displayNavDate = isUpdated ? fund.jzrq : fund.gztime

    const formatDate = (dateStr: string) => {
      if (!dateStr) return '-'
      return dateStr.slice(0, 10)
    }

    const share = holding?.share ?? 0
    const costPerUnit = holding?.cost ?? 0
    const shareBasedCost = share > 0 && costPerUnit > 0 ? share * costPerUnit : 0

    const dbTotalCost = holding?.totalCost
    const accumulatedProfit = holding?.accumulatedProfit

    let holdingProfitValue: number | null
    let costBasis: number

    if (dbTotalCost != null && dbTotalCost > 0) {
      holdingProfitValue = holdingAmount !== null
        ? Math.round((holdingAmount - dbTotalCost) * 100) / 100
        : null
      costBasis = dbTotalCost
    } else if (accumulatedProfit != null && accumulatedProfit !== 0 && holdingAmount !== null) {
      holdingProfitValue = accumulatedProfit
      costBasis = holdingAmount - accumulatedProfit
    } else if (shareBasedCost > 0 && holdingAmount !== null) {
      holdingProfitValue = Math.round((holdingAmount - shareBasedCost) * 100) / 100
      costBasis = shareBasedCost
    } else {
      holdingProfitValue = null
      costBasis = 0
    }

    return {
      rawFund: fund,
      code: fund.code,
      fundName: fund.name,
      isUpdated,

      latestNav: displayNav ? displayNav.toFixed(4) : '—',
      latestNavDate: displayNavDate || '-',
      latestNavDateShort: formatDate(displayNavDate || fund.jzrq || '-'),
      estimateNav: fund.gsz ? fund.gsz.toFixed(4) : '—',
      estimateNavDate: fund.gztime || '-',
      estimateNavDateShort: formatDate(fund.gztime || '-'),

      yesterdayChangePercent: fund.dayGrowth !== 0
        ? `${fund.dayGrowth > 0 ? '+' : ''}${fund.dayGrowth.toFixed(2)}%`
        : '—',
      yesterdayChangeValue: fund.dayGrowth || null,
      yesterdayDate: yesterdayDateDisplay,

      estimateChangePercent: fund.gszzl !== undefined
        ? `${fund.gszzl > 0 ? '+' : ''}${fund.gszzl.toFixed(2)}%`
        : '—',
      estimateChangeValue: fund.gszzl || null,
      estimateTime: fund.gztime || '-',
      estimateTimeShort: formatDate(fund.gztime || '-'),

      estimateProfit: todayProfit !== null
        ? `${todayProfit > 0 ? '+' : ''}¥${Math.abs(todayProfit).toFixed(2)}`
        : '',
      estimateProfitValue: todayProfit,
      estimateProfitPercent: todayProfit !== null && holdingAmount !== null && holdingAmount > 0
        ? `${(todayProfit / holdingAmount * 100) > 0 ? '+' : ''}${(todayProfit / holdingAmount * 100).toFixed(2)}%`
        : '',

      holdingAmount: holdingAmount !== null
        ? `¥${holdingAmount.toFixed(2)}`
        : '设置',
      holdingAmountValue: holdingAmount,

      todayProfit: todayProfit !== null
        ? `${todayProfit > 0 ? '+' : ''}¥${Math.abs(todayProfit).toFixed(2)}`
        : '',
      todayProfitPercent: displayGrowthPercent,
      todayProfitValue: todayProfit,
      todayProfitGrowthValue: effectiveGrowth,
      isHistoryProfit,
      todayProfitDate,

      holdingProfit: holdingProfitValue !== null
        ? `${holdingProfitValue > 0 ? '+' : ''}¥${Math.abs(holdingProfitValue).toFixed(2)}`
        : '',
      holdingProfitPercent: (() => {
        if (holdingProfitValue === null) return ''
        if (!costBasis || costBasis <= 0) return ''
        return `${holdingProfitValue >= 0 ? '+' : ''}${(holdingProfitValue / costBasis * 100).toFixed(2)}%`
      })(),
      holdingProfitValue,
    }
  }

  const tableRows = computed(() => {
    return sortedFavorites.value.map(fund => convertToTableRow(fund))
  })

  async function init() {
    if (isInitialized.value) {
      console.log('⚠️ Store 已经初始化，跳过重复初始化')
      return
    }

    isInitialized.value = true

    const localFilterMode = localStorage.getItem('filterMode')
    if (localFilterMode && (localFilterMode === 'all' || localFilterMode === 'held')) {
      filterMode.value = localFilterMode as 'all' | 'held'
      console.log('📦 从 localStorage 加载 filterMode:', filterMode.value)
    }

    const dbLoaded = await loadFromDatabase()

    if (!dbLoaded) {
      console.log('📦 使用 localStorage 模式')
      initDefaultFunds()

      if (favoriteCodes.value.length === 0) {
        await initializeDefaultFunds()
      }
    }

    if (!useDatabase.value && hasLocalData()) {
      console.log('检测到 localStorage 数据，可以迁移到数据库')
    }

    startPolling()
  }

  return {
    favoriteCodes,
    favoriteFunds,
    loading,
    error,
    viewMode,
    lastUpdateTime,
    sortField,
    sortDirection,
    hideAmount,
    filterMode,
    useDatabase,
    isMigrating,
    migrationCompleted,
    isInitialized,
    favorites,
    sortedFavorites,
    tableRows,
    holdings,
    init,
    startPolling,
    stopPolling,
    fetchFavorites,
    addFavorite,
    addFavoritesBatch,
    removeFavorite,
    isFavorite,
    toggleViewMode,
    setSortField,
    toggleSortDirection,
    toggleHideAmount,
    setFilterMode,
    isHeld,
    convertToTableRow,
    hasLocalData,
    migrateToDatabase,
    loadFromDatabase,
    initializeDefaultFunds,
    switchToLocalMode
  }
})