import { ref, computed, type ComputedRef } from 'vue'
import type { Holding } from '@/types'
import * as userApi from '@/api/user'

const STORAG_KEY = 'fund_holdings'

// 定义返回类型接口，避免循环引用
interface UseHoldingsReturn {
  holdings: ComputedRef<Map<string, Holding>>
  loadFromLocalStorage: () => Map<string, Holding>
  loadFromDatabase: () => Promise<void>
  setUseDatabase: (value: boolean) => Promise<void>
  setHolding: (fundCode: string, fundName: string, share: number, cost: number) => Promise<void>
  setHoldingByAmount: (fundCode: string, fundName: string, amount: number, currentNav: number) => Promise<void>
  removeHolding: (fundCode: string) => Promise<void>
  getHolding: (fundCode: string) => Holding | undefined
  hasHolding: (fundCode: string) => boolean
  updateHoldingAmount: (fundCode: string, newAmount: number) => Promise<void>
}

let holdingsInstance: UseHoldingsReturn | null = null

// 全局持仓数据（用于跨组件共享）
const globalHoldings = ref<Map<string, Holding>>(new Map())
const useDatabase = ref<boolean>(false) // 是否使用数据库存储
const isLoadingFromDatabase = ref<boolean>(false)

export function useHoldings(): UseHoldingsReturn {
  if (holdingsInstance) {
    return holdingsInstance
  }

  const holdings = computed(() => globalHoldings.value)

  // 从 localStorage 加载（用于迁移）
  function loadFromLocalStorage(): Map<string, Holding> {
    const migrated = new Map<string, Holding>()
    try {
      const stored = localStorage.getItem(STORAG_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        Object.entries(data).forEach(([code, h]: [string, any]) => {
          migrated.set(code, {
            ...h,
            holdingDate: h.holdingDate || getToday()
          }
          )
        })
        console.log('📦 从 localStorage 读取持仓数据:', migrated.size, '条')
      }
    } catch (error) {
      console.error('加载本地持仓数据失败:', error)
    }
    return migrated
  }

  // 保存到 localStorage（仅用于迁移前的旧数据）
  function saveToLocalStorage() {
    if (useDatabase.value) return // 使用数据库时不再保存到 localStorage

    try {
      const data = Object.fromEntries(globalHoldings.value)
      localStorage.setItem(STORAG_KEY, JSON.stringify(data))
    } catch (error) {
      console.error('保存持仓数据到本地失败:', error)
    }
  }

  // 从数据库加载
  async function loadFromDatabase(): Promise<void> {
    if (isLoadingFromDatabase.value) return

    try {
      isLoadingFromDatabase.value = true
      const holdingsArray = await userApi.getHoldings()
      const holdingsMap = new Map<string, Holding>()
      for (const holding of holdingsArray) {
        holdingsMap.set(holding.fundCode, holding)
      }
      globalHoldings.value = holdingsMap
      console.log('💾 从数据库加载持仓数据:', holdingsMap.size, '条')
    } catch (error) {
      console.error('从数据库加载持仓数据失败:', error)
      globalHoldings.value = new Map()
    } finally {
      isLoadingFromDatabase.value = false
    }
  }

  function getToday(): string {
    return new Date().toLocaleDateString('sv-SE')
  }

  async function setUseDatabase(value: boolean) {
    useDatabase.value = value
    if (value) {
      await loadFromDatabase()
    } else {
      globalHoldings.value = loadFromLocalStorage()
    }
  }

  async function setHolding(fundCode: string, fundName: string, share: number, cost: number) {
    const amount = Math.round(share * cost * 100) / 100
    const roundedShare = Math.round(share * 10000) / 10000
    const roundedCost = Math.round(cost * 10000) / 10000

    const holding: Holding = {
      fundCode,
      fundName,
      share: roundedShare,
      cost: roundedCost,
      amount,
      holdingDate: getToday()
    }

    if (useDatabase.value) {
      const res = await userApi.saveHolding(holding)
      if (!res.success) {
        throw new Error(res.error || '保存持仓失败')
      }
      if (res.holding) {
        holding.amount = res.holding.amount
        holding.settled = res.holding.settled
        holding.settleDate = res.holding.settleDate
        holding.currentDayProfit = res.holding.currentDayProfit
        holding.accumulatedProfit = res.holding.accumulatedProfit
      }
    }

    globalHoldings.value.set(fundCode, holding)
    saveToLocalStorage()
  }

  async function setHoldingByAmount(fundCode: string, fundName: string, amount: number, currentNav: number) {
    const roundedAmount = Math.round(amount * 100) / 100
    const existing = globalHoldings.value.get(fundCode)

    let share: number
    let cost: number
    let totalCost: number | undefined

    if (existing && existing.share > 0 && existing.cost > 0) {
      cost = existing.cost
      share = existing.share

      if (!useDatabase.value && existing.amount > 0 && existing.totalCost != null && existing.totalCost > 0) {
        const oldAmount = existing.amount
        if (roundedAmount > oldAmount) {
          totalCost = Math.round(((existing.totalCost) + (roundedAmount - oldAmount)) * 100) / 100
        } else if (roundedAmount < oldAmount && roundedAmount > 0) {
          totalCost = Math.round((existing.totalCost * roundedAmount / oldAmount) * 100) / 100
        } else {
          totalCost = existing.totalCost
        }
      }
    } else {
      cost = Math.round(currentNav * 10000) / 10000
      share = currentNav > 0 ? Math.round((roundedAmount / currentNav) * 10000) / 10000 : 0
      if (!useDatabase.value) {
        totalCost = roundedAmount
      }
    }

    const holding: Holding = {
      fundCode,
      fundName,
      share,
      cost,
      amount: roundedAmount,
      holdingDate: getToday(),
      ...(totalCost != null ? { totalCost } : {})
    }

    if (useDatabase.value) {
      const res = await userApi.saveHolding(holding)
      if (!res.success) {
        throw new Error(res.error || '保存持仓失败')
      }
      if (res.holding) {
        holding.amount = res.holding.amount
        holding.share = res.holding.share ?? holding.share
        holding.cost = res.holding.cost ?? holding.cost
        holding.settled = res.holding.settled
        holding.settleDate = res.holding.settleDate
        holding.currentDayProfit = res.holding.currentDayProfit
        holding.accumulatedProfit = res.holding.accumulatedProfit
        holding.totalCost = res.holding.totalCost ?? holding.totalCost
      }
    }

    globalHoldings.value.set(fundCode, holding)
    saveToLocalStorage()
  }

  async function removeHolding(fundCode: string) {
    if (useDatabase.value) {
      await userApi.deleteHolding(fundCode)
    }

    globalHoldings.value.delete(fundCode)
    saveToLocalStorage()
  }

  function getHolding(fundCode: string): Holding | undefined {
    return globalHoldings.value.get(fundCode)
  }

  function hasHolding(fundCode: string): boolean {
    return globalHoldings.value.has(fundCode)
  }

  async function updateHoldingAmount(fundCode: string, newAmount: number) {
    const holding = globalHoldings.value.get(fundCode)
    if (!holding) return

    const roundedAmount = Math.round(newAmount * 100) / 100

    const updated: Holding = {
      ...holding,
      amount: roundedAmount,
      holdingDate: getToday()
    }

    if (!useDatabase.value && holding.amount > 0 && holding.totalCost != null && holding.totalCost > 0) {
      const oldAmount = holding.amount
      if (roundedAmount > oldAmount) {
        updated.totalCost = Math.round((holding.totalCost + roundedAmount - oldAmount) * 100) / 100
      } else if (roundedAmount < oldAmount && roundedAmount > 0) {
        updated.totalCost = Math.round((holding.totalCost * roundedAmount / oldAmount) * 100) / 100
      }
    }

    if (useDatabase.value) {
      const res = await userApi.saveHolding(updated)
      if (res.success && res.holding) {
        updated.amount = res.holding.amount
        updated.share = res.holding.share ?? updated.share
        updated.cost = res.holding.cost ?? updated.cost
        updated.settled = res.holding.settled
        updated.settleDate = res.holding.settleDate
        updated.currentDayProfit = res.holding.currentDayProfit
        updated.accumulatedProfit = res.holding.accumulatedProfit
        updated.totalCost = res.holding.totalCost ?? updated.totalCost
      }
    }

    globalHoldings.value.set(fundCode, updated)
    saveToLocalStorage()
  }

  // 初始化：先从 localStorage 加载，后续迁移后会从数据库加载
  if (globalHoldings.value.size === 0) {
    globalHoldings.value = loadFromLocalStorage()
  }

  holdingsInstance = {
    holdings,
    loadFromLocalStorage,
    loadFromDatabase,
    setUseDatabase,
    setHolding,
    setHoldingByAmount,
    removeHolding,
    getHolding,
    hasHolding,
    updateHoldingAmount
  }

  return holdingsInstance
}
