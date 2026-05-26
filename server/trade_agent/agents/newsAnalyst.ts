import type { AgentName } from '../types.js'
import { callLLM } from '../llmService.js'
import { getGlobalNews } from '../data/eastmoneyStock.js'
import type { StockAnalysisContext } from '../types.js'

export const agentName: AgentName = 'news_analyst'

export async function execute(
  ctx: StockAnalysisContext,
  sendEvent: (type: string, data: any) => void
): Promise<string> {
  sendEvent('tool_call', { agent: agentName, tool: 'getGlobalNews' })

  const globalNews = await getGlobalNews()
  ctx.globalNews = globalNews

  sendEvent('tool_result', { agent: agentName, tool: 'getGlobalNews', toolResult: `获取到${globalNews.length}条宏观新闻` })

  const globalList = globalNews.slice(0, 8).map((n, i) => `${i + 1}. [${n.time}] ${n.title}\n   摘要：${n.content.slice(0, 100)}`).join('\n\n')

  const stockList = ctx.stockNews.length > 0
    ? ctx.stockNews.slice(0, 5).map((n, i) => `${i + 1}. [${n.time}] ${n.title}`).join('\n')
    : '无个股新闻数据'

  const info = ctx.stockInfo
  const stockLabel = info ? `${info.name}(${info.code})` : ctx.stockCode

  const report = await callLLM(
    [
      {
        role: 'system',
        content: `你是一位专业的新闻分析师。你擅长分析宏观经济新闻、政策变化对股市和个股的影响。请用中文回答，使用markdown格式。`,
      },
      {
        role: 'user',
        content: `请分析宏观新闻对 ${stockLabel} 的潜在影响。

## 个股相关新闻
${stockList}

## 宏观/市场新闻
${globalList || '暂无宏观新闻数据'}

请分析以下内容：
1. **宏观环境**：当前宏观经济和政策环境
2. **行业影响**：相关行业政策对该股的影响
3. **重大事件**：可能影响市场的重大事件
4. **综合判断**：宏观面对该股的综合影响（利好/利空/中性）

注意：基于新闻内容客观分析，如有不确定的信息请标注。`,
      },
    ],
    (chunk) => {
      sendEvent('agent_progress', { agent: agentName, content: chunk })
    },
    { maxTokens: 1200, temperature: 0.7 }
  )

  return report
}
