import type { AgentName, Decision } from '../types.js'
import { callLLM } from '../llmService.js'
import type { StockAnalysisContext } from '../types.js'

export const agentName: AgentName = 'research_manager'

export async function execute(
  ctx: StockAnalysisContext,
  sendEvent: (type: string, data: any) => void,
  debateHistory: string[]
): Promise<{ report: string; decision: Decision }> {
  const info = ctx.stockInfo
  const stockLabel = info ? `${info.name}(${info.code})` : ctx.stockCode

  const analystReports = `
## 市场分析师报告
${ctx.agentReports.market_analyst || '无'}

## 基本面分析师报告
${ctx.agentReports.fundamentals_analyst || '无'}
`

  const debateSummary = debateHistory.length > 0
    ? `## 多空辩论记录\n${debateHistory.join('\n---\n')}`
    : '无辩论记录'

  const fullResponse = await callLLM(
    [
      {
        role: 'system',
        content: `你是一位研究主管（Research Manager）。你的角色是综合所有分析师的报告和多空辩论的论点，做出最终的投资决策。

你必须：
1. 综合所有分析报告和辩论内容
2. 权衡多空论点的强弱
3. 做出明确的投资决策：BUY（买入）/ SELL（卖出）/ HOLD（持有）
4. 在报告的最后用固定格式给出决策

请用中文回答，使用markdown格式。最后必须包含一行：
**决策：BUY** 或 **决策：SELL** 或 **决策：HOLD**`,
      },
      {
        role: 'user',
        content: `请综合分析 ${stockLabel}，做出投资决策。

${analystReports}

${debateSummary}

请给出你的综合研究报告和投资决策。`,
      },
    ],
    (chunk) => {
      sendEvent('agent_progress', { agent: agentName, content: chunk })
    },
    { maxTokens: 1500, temperature: 0.6 }
  )

  // Parse decision
  let decision: Decision = 'HOLD'
  if (fullResponse.includes('**决策：BUY**') || fullResponse.includes('决策：BUY')) {
    decision = 'BUY'
  } else if (fullResponse.includes('**决策：SELL**') || fullResponse.includes('决策：SELL')) {
    decision = 'SELL'
  }

  return { report: fullResponse, decision }
}
