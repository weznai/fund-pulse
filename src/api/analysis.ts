import axios from 'axios'

export interface AnalysisUsage {
  allowed: boolean
  credits: number
  userType: 'guest' | 'registered'
}

export interface NavHistoryPoint {
  date: string
  nav: number
  growth: number
}

export interface FundNavHistory {
  name: string
  data: NavHistoryPoint[]
}

export async function getAnalysisUsage(): Promise<AnalysisUsage> {
  const { data } = await axios.get('/api/analysis/usage')
  return data
}

export async function getNavHistory(codes: string[], period: string): Promise<Record<string, FundNavHistory>> {
  const { data } = await axios.post('/api/analysis/nav-history', { codes, period })
  return data
}

export async function lookupFunds(codes: string[]): Promise<Array<{ code: string; name: string; type: string; found: boolean }>> {
  const { data } = await axios.post('/api/analysis/lookup', { codes })
  return data
}

export async function streamAnalysis(
  codes: string[],
  period: string,
  onChunk: (content: string) => void,
  onUsage: (credits: number) => void,
  onError: (error: string) => void,
  onDone: () => void
): Promise<void> {
  const response = await fetch('/api/analysis/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ codes, period })
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: '请求失败' }))
    onError(data.error || '分析请求失败')
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    onError('浏览器不支持流式响应')
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim().startsWith('data:')) continue
      const jsonStr = line.trim().slice(5).trim()
      if (jsonStr === '[DONE]') {
        onDone()
        return
      }
      try {
        const parsed = JSON.parse(jsonStr)
        if (parsed.error) {
          onError(parsed.error)
          return
        }
        if (parsed.type === 'usage') {
          onUsage(parsed.credits)
        }
        if (parsed.type === 'content') {
          onChunk(parsed.content)
        }
      } catch {
        // skip
      }
    }
  }
  onDone()
}

// ===== Stock Analysis Types =====

export interface StockAgentInfo {
  name: string
  label: string
  phase: string
}

export interface StockLookupResult {
  found: boolean
  code?: string
  name?: string
  industry?: string
  price?: number
  change?: number
  marketCap?: number
  pe?: number
  pb?: number
  totalShares?: number
  floatShares?: number
}

export interface StockSSEEvent {
  type: string
  agent?: string
  phase?: string
  content?: string
  report?: string
  tool?: string
  toolResult?: string
  debateType?: string
  round?: number
  decision?: string
  credits?: number
  error?: string
  reportUrl?: string
  reportId?: number
}

export async function getStockAgents(): Promise<StockAgentInfo[]> {
  const { data } = await axios.get('/api/analysis/stock/agents')
  return data.agents
}

export async function lookupStock(stockCode: string): Promise<StockLookupResult> {
  const { data } = await axios.post('/api/analysis/stock/lookup', { stockCode })
  return data
}

export interface StockAnalysisCallbacks {
  onEvent: (event: StockSSEEvent) => void
  onUsage: (credits: number) => void
  onError: (error: string) => void
  onDone: () => void
}

export async function streamStockAnalysis(
  stockCode: string,
  callbacks: StockAnalysisCallbacks
): Promise<void> {
  const response = await fetch('/api/analysis/stock/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ stockCode })
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: '请求失败' }))
    callbacks.onError(data.error || '股票分析请求失败')
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    callbacks.onError('浏览器不支持流式响应')
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim().startsWith('data:')) continue
      const jsonStr = line.trim().slice(5).trim()
      if (jsonStr === '[DONE]') {
        callbacks.onDone()
        return
      }
      try {
        const parsed = JSON.parse(jsonStr) as StockSSEEvent
        if (parsed.type === 'error') {
          callbacks.onError(parsed.error || '分析出错')
          return
        }
        if (parsed.type === 'usage') {
          callbacks.onUsage(parsed.credits!)
        } else {
          callbacks.onEvent(parsed)
        }
      } catch {
        // skip
      }
    }
  }
  callbacks.onDone()
}
