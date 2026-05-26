import { getLLMConfigForScene, getFallbackLLMConfig } from '../db/modelConfig.js'
import { logger } from '../logger.js'

interface LLMConfig {
  model: string
  apiKey: string
  apiBase: string
}

export function getStockAgentLLMConfig(): LLMConfig {
  // Try stock_agent scene first, then fallback to fund_analysis, then env
  const stockConfig = getLLMConfigForScene('stock_agent')
  if (stockConfig) return stockConfig
  const fundConfig = getLLMConfigForScene('fund_analysis')
  if (fundConfig) return fundConfig
  return getFallbackLLMConfig()
}

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Non-streaming LLM call - returns full response text
 */
export async function callLLMSync(
  messages: Message[],
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const config = getStockAgentLLMConfig()
  const maxTokens = options?.maxTokens ?? 2000
  const temperature = options?.temperature ?? 0.7

  try {
    const response = await fetch(`${config.apiBase}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: false,
      }),
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      throw new Error(`LLM API error: status=${response.status} body=${errBody.slice(0, 300)}`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  } catch (error: any) {
    logger.error(`[llmService] callLLMSync error: ${error?.message || error}`)
    throw error
  }
}

/**
 * Streaming LLM call - calls onChunk for each content piece, returns full text
 */
export async function callLLM(
  messages: Message[],
  onChunk: (content: string) => void,
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const config = getStockAgentLLMConfig()
  const maxTokens = options?.maxTokens ?? 2000
  const temperature = options?.temperature ?? 0.7

  try {
    const response = await fetch(`${config.apiBase}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      throw new Error(`LLM API error: status=${response.status} body=${errBody.slice(0, 300)}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body reader')

    const decoder = new TextDecoder()
    let buffer = ''
    let fullText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const jsonStr = trimmed.slice(5).trim()
        if (jsonStr === '[DONE]') continue
        try {
          const parsed = JSON.parse(jsonStr)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) {
            fullText += content
            onChunk(content)
          }
        } catch {
          // skip
        }
      }
    }

    return fullText
  } catch (error: any) {
    logger.error(`[llmService] callLLM error: ${error?.message || error}`)
    throw error
  }
}
