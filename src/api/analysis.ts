import axios from 'axios'

export interface AnalysisUsage {
  allowed: boolean
  used: number
  limit: number
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
  onUsage: (used: number, limit: number) => void,
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
          onUsage(parsed.used, parsed.limit)
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
