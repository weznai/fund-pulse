import type { AgentName } from '../types.js'
import { callLLM } from '../llmService.js'
import { getStockNews } from '../data/eastmoneyStock.js'
import type { StockAnalysisContext } from '../types.js'

export const agentName: AgentName = 'social_media_analyst'

export async function execute(
  ctx: StockAnalysisContext,
  sendEvent: (type: string, data: any) => void
): Promise<string> {
  sendEvent('tool_call', { agent: agentName, tool: 'getStockNews' })

  const news = await getStockNews(ctx.stockCode)
  ctx.stockNews = news

  sendEvent('tool_result', { agent: agentName, tool: 'getStockNews', toolResult: `获取到${news.length}条新闻` })

  if (news.length === 0) {
    const report = '## 社交媒体分析师报告\n\n未获取到相关新闻/舆情数据。'
    return report
  }

  const newsList = news.slice(0, 8).map((n, i) => `${i + 1}. [${n.time}] ${n.title}\n   摘要：${n.content.slice(0, 100)}`).join('\n\n')

  const info = ctx.stockInfo
  const stockLabel = info ? `${info.name}(${info.code})` : ctx.stockCode

  const report = await callLLM(
    [
      {
        role: 'system',
        content: `你是一位专业的社交媒体和舆情分析师。你擅长从新闻和社交媒体信息中提炼市场情绪和投资观点。请用中文回答，使用markdown格式。`,
      },
      {
        role: 'user',
        content: `请分析 ${stockLabel} 的相关新闻和舆情。

以下是近期相关新闻：
${newsList}

请分析以下内容：
1. **舆情概览**：近期新闻的主要话题和情绪倾向（正面/负面/中性）
2. **关键事件**：影响股价的重要事件
3. **市场情绪**：综合判断当前市场对该股的情绪（看多/看空/中性）
4. **风险提示**：需要关注的负面信息

注意：基于新闻内容客观分析，不要凭空推测。`,
      },
    ],
    (chunk) => {
      sendEvent('agent_progress', { agent: agentName, content: chunk })
    },
    { maxTokens: 1200, temperature: 0.7 }
  )

  return report
}
