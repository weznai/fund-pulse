import axios from 'axios'
import { logger } from '../logger.js'
import { updateSuggestionSummary, updateSuggestionStatus } from '../db/suggestion.js'

const LLM_CONFIG = {
  model: 'Qwen/Qwen3-8B',
  apiKey: 'sk-syxkwgeidzezrzpszuvjcctevrfpfkevuuthhzhpmkphwjxe',
  apiBase: 'https://api.siliconflow.cn'
}

export async function generateSuggestionSummary(id: number, content: string): Promise<void> {
  try {
    updateSuggestionStatus(id, 'processing')

    const response = await axios.post(
      `${LLM_CONFIG.apiBase}/v1/chat/completions`,
      {
        model: LLM_CONFIG.model,
        messages: [
          {
            role: 'system',
            content: '你是一个文本摘要助手。请用中文对用户提交的建议或问题内容生成一个简洁的摘要，不超过15个字。只输出摘要内容，不要输出其他任何文字。'
          },
          {
            role: 'user',
            content: content
          }
        ],
        max_tokens: 50,
        temperature: 0.3
      },
      {
        headers: {
          'Authorization': `Bearer ${LLM_CONFIG.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    )

    const summary = response.data?.choices?.[0]?.message?.content?.trim() || '无摘要'

    updateSuggestionSummary(id, summary)
    updateSuggestionStatus(id, 'completed')
    logger.log(`✅ 建议#${id} 摘要生成完成: ${summary}`)
  } catch (error: any) {
    logger.error(`❌ 建议#${id} 摘要生成失败:`, error?.message || error)
    try {
      updateSuggestionSummary(id, content.slice(0, 15))
      updateSuggestionStatus(id, 'completed')
    } catch (e) {
      logger.error(`❌ 建议#${id} 降级摘要更新失败:`, e)
    }
  }
}
