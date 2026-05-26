import type { AgentName, Decision } from '../types.js'
import { callLLM } from '../llmService.js'
import type { StockAnalysisContext } from '../types.js'

export const agentName: AgentName = 'risk_manager'

export async function execute(
  ctx: StockAnalysisContext,
  sendEvent: (type: string, data: any) => void,
  riskDebateHistory: string[]
): Promise<{ report: string; decision: Decision }> {
  const info = ctx.stockInfo
  const stockLabel = info ? `${info.name}(${info.code})` : ctx.stockCode

  const researchReport = ctx.agentReports.research_manager || '无研究主管报告'
  const traderReport = ctx.agentReports.trader || '无交易员报告'

  const debateSummary = riskDebateHistory.length > 0
    ? `## 风险辩论记录\n${riskDebateHistory.join('\n---\n')}`
    : '无风险辩论记录'

  const fullResponse = await callLLM(
    [
      {
        role: 'system',
        content: `你是风险管理经理（Risk Manager）。你的角色是最终审核所有分析报告、研究决策、交易计划和风险评估辩论，做出最终的投资决策。

你必须：
1. 审核研究主管的决策依据
2. 审核交易员的交易计划
3. 考虑风险辩论中各方的观点
4. 做出最终决策：BUY（买入）/ SELL（卖出）/ HOLD（持有）
5. 给出最终的风险控制建议

请用中文回答，使用markdown格式。最后必须包含一行：
**最终决策：BUY** 或 **最终决策：SELL** 或 **最终决策：HOLD**`,
      },
      {
        role: 'user',
        content: `请对 ${stockLabel} 做出最终投资决策。

## 研究主管报告
${researchReport.slice(0, 800)}

## 交易员计划
${traderReport.slice(0, 800)}

${debateSummary}

请给出最终风险评估和投资决策。`,
      },
    ],
    (chunk) => {
      sendEvent('agent_progress', { agent: agentName, content: chunk })
    },
    { maxTokens: 1500, temperature: 0.6 }
  )

  // Parse decision
  let decision: Decision = 'HOLD'
  if (fullResponse.includes('**最终决策：BUY**') || fullResponse.includes('最终决策：BUY')) {
    decision = 'BUY'
  } else if (fullResponse.includes('**最终决策：SELL**') || fullResponse.includes('最终决策：SELL')) {
    decision = 'SELL'
  }

  return { report: fullResponse, decision }
}
