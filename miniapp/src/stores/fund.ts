import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as fundApi from '@/api/fund'
import * as userApi from '@/api/user'
import type { Fund, SearchResult } from '@/api/fund'
import type { UserFund, Holding } from '@/api/user'

export const useFundStore = defineStore('fund', () => {
  const favoriteCodes = ref<string[]>([])
  const favoriteFunds = ref<Fund[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const sortField = ref('dayGrowth')
  const sortDirection = ref<'desc' | 'asc'>('desc')
  const hideAmount = ref(false)
  const tradingDay = ref('')
  const holdingsMap = ref<Map<string, Holding>>(new Map())

  const sortedFavorites = computed(() => {
    return [...favoriteFunds.value].sort((a, b) => {
      let aVal: number, bVal: number
      switch (sortField.value) {
        case 'gszzl':
          aVal = a.gszzl ?? 0
          bVal = b.gszzl ?? 0
          break
        case 'dayGrowth':
        default:
          aVal = a.dayGrowth ?? 0
          bVal = b.dayGrowth ?? 0
      }
      return sortDirection.value === 'desc' ? bVal - aVal : aVal - bVal
    })
  })

  function getHolding(code: string): Holding | undefined {
    return holdingsMap.value.get(code)
  }

  function isHeld(code: string): boolean {
    const h = holdingsMap.value.get(code)
    return !!h && h.amount > 0
  }

  async function loadFromDatabase() {
    try {
      const prefs = await userApi.getUserPreferences()
      sortField.value = prefs.sortField || 'dayGrowth'
      sortDirection.value = prefs.sortDirection || 'desc'
      hideAmount.value = prefs.hideAmount || false
      tradingDay.value = prefs.tradingDay || ''

      const userFunds = await userApi.getUserFunds()
      favoriteCodes.value = userFunds.map(f => f.fundCode)

      const holdings = await userApi.getHoldings()
      holdingsMap.value = new Map(holdings.map(h => [h.fundCode, h]))

      if (favoriteCodes.value.length === 0) {
        await initializeDefaultFunds()
      }
    } catch (e) {
      console.error('从数据库加载失败:', e)
    }
  }

  async function initializeDefaultFunds() {
    if (favoriteCodes.value.length > 0) return
    try {
      const result = await fundApi.getRecommendFunds()
      if (result.codes.length > 0) {
        favoriteCodes.value = result.codes
        await userApi.addUserFundsBatch(result.codes.map(code => ({ code })))
      }
    } catch (e) {
      console.error('初始化默认基金失败:', e)
    }
  }

  async function fetchFavorites(forceRefresh = false) {
    if (favoriteCodes.value.length === 0) {
      favoriteFunds.value = []
      return
    }
    loading.value = true
    error.value = null
    try {
      const funds = await fundApi.fetchFunds(favoriteCodes.value, forceRefresh)
      favoriteFunds.value = funds
    } catch (e) {
      error.value = '获取基金数据失败'
    } finally {
      loading.value = false
    }
  }

  async function addFavorite(code: string, name?: string) {
    if (!favoriteCodes.value.includes(code)) {
      favoriteCodes.value.push(code)
      await userApi.addUserFund(code, name)
    }
  }

  async function removeFavorite(code: string) {
    const idx = favoriteCodes.value.indexOf(code)
    if (idx > -1) {
      favoriteCodes.value.splice(idx, 1)
      favoriteFunds.value = favoriteFunds.value.filter(f => f.code !== code)
      await userApi.deleteUserFund(code)
    }
  }

  async function setHoldingAmount(code: string, fundName: string, amount: number, nav: number) {
    await userApi.setHolding(code, { amount })
    const h = holdingsMap.value.get(code)
    if (h) {
      h.amount = amount
    } else {
      holdingsMap.value.set(code, {
        fundCode: code,
        fundName,
        share: nav > 0 ? amount / nav : 0,
        cost: nav,
        amount
      })
    }
  }

  async function removeHolding(code: string) {
    await userApi.removeHolding(code)
    holdingsMap.value.delete(code)
  }

  async function refreshHoldings() {
    try {
      const holdings = await userApi.getHoldings()
      holdingsMap.value = new Map(holdings.map(h => [h.fundCode, h]))
    } catch (e) {
      console.error('刷新持仓失败:', e)
    }
  }

  async function init() {
    await loadFromDatabase()
    await fetchFavorites()
  }

  function toggleSortDirection() {
    sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc'
  }

  return {
    favoriteCodes,
    favoriteFunds,
    loading,
    error,
    sortField,
    sortDirection,
    hideAmount,
    tradingDay,
    holdingsMap,
    sortedFavorites,
    getHolding,
    isHeld,
    init,
    loadFromDatabase,
    fetchFavorites,
    addFavorite,
    removeFavorite,
    setHoldingAmount,
    removeHolding,
    refreshHoldings,
    initializeDefaultFunds,
    toggleSortDirection
  }
})
