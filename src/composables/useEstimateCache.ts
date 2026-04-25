import { ref } from 'vue'

const CACHE_KEY = 'fund_estimate_cache'
const CACHE_EXPIRE_HOURS = 24

export interface EstimateDataPoint {
  time: string
  value: number
  percent: number
}

export interface EstimateCache {
  code: string
  data: EstimateDataPoint[]
  date: string
  timestamp: number
}

interface CacheStore {
  [code: string]: EstimateCache
}

function loadCache(): CacheStore {
  try {
    const stored = localStorage.getItem(CACHE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error('加载估值缓存失败:', e)
  }
  return {}
}

function saveCache(cache: CacheStore) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch (e) {
    console.error('保存估值缓存失败:', e)
  }
}

function getToday(): string {
  return new Date().toLocaleDateString('sv-SE')
}

function isCacheValid(cache: EstimateCache): boolean {
  const today = getToday()
  const now = Date.now()
  const cacheAge = now - cache.timestamp
  const maxAge = CACHE_EXPIRE_HOURS * 60 * 60 * 1000
  
  if (cache.date === today) {
    return true
  }
  
  if (cacheAge < maxAge) {
    return true
  }
  
  return false
}

const globalCache = ref<CacheStore>(loadCache())

export function useEstimateCache() {
  function getEstimateCache(code: string): EstimateDataPoint[] | null {
    const cached = globalCache.value[code]
    
    if (!cached || !cached.data || cached.data.length === 0) {
      return null
    }
    
    if (!isCacheValid(cached)) {
      delete globalCache.value[code]
      return null
    }
    
    console.log(`📦 使用缓存估值数据 ${code}:`, cached.data.length, '条, 日期:', cached.date)
    return cached.data
  }

  function setEstimateCache(code: string, data: EstimateDataPoint[]) {
    if (!data || data.length === 0) return
    
    const today = getToday()
    
    globalCache.value[code] = {
      code,
      data,
      date: today,
      timestamp: Date.now()
    }
    
    saveCache(globalCache.value)
    console.log(`💾 保存估值缓存 ${code}:`, data.length, '条')
  }

  function clearEstimateCache(code?: string) {
    if (code) {
      delete globalCache.value[code]
    } else {
      globalCache.value = {}
    }
    saveCache(globalCache.value)
  }

  function hasEstimateCache(code: string): boolean {
    const cached = globalCache.value[code]
    return cached && cached.data && cached.data.length > 0 && isCacheValid(cached)
  }

  function getCacheInfo(code: string): { date: string; dataCount: number } | null {
    const cached = globalCache.value[code]
    if (!cached) return null
    return {
      date: cached.date,
      dataCount: cached.data.length
    }
  }

  return {
    getEstimateCache,
    setEstimateCache,
    clearEstimateCache,
    hasEstimateCache,
    getCacheInfo
  }
}
