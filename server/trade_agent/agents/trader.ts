import type { AgentName, Decision } from '../types.js'
import { callLLM } from '../llmService.js'
import type { StockAnalysisContext } from '../types.js'

export const agentName: AgentName = 'trader'

export async function execute(
  ctx: StockAnalysisContext,
  sendEvent: (type: string, data: any) => void,
  researchDecision: Decision
): Promise<string> {
  const info = ctx.stockInfo
  const stockLabel = info ? `${info.name}(${info.code})` : ctx.stockCode
  const currentPrice = info?.price || 0

  const report = await callLLM(
    [
      {
        role: 'system',
        content: `你是一位专业的交易员（Trader）。你的角色是基于研究主管的投资决策，制定具体的交易执行计划。你需要考虑入场时机、仓位管理、止盈止损等。
请用中文回答，使用markdown格式。`,
      },
      {
        role: 'user',
        content: `请为 ${stockLabel} 制定交易计划。

## 研究主管决策：${researchDecision}

## 当前股价：${currentPrice ? currentPrice.toFixed(2) + '元' : '未知'}

## 市场分析师报告摘要
${(ctx.agentReports.market_analyst || '').slice(0, 500)}

## 基本面分析师报告摘要
${(ctx.agentReports.fundamentals_analyst || '').slice(0, 500)}

请制定详细的交易计划，包括：
1. **交易方向**：确认买入/卖出/持有
2. **入场策略**：建议入场价位和时机
3. **仓位建议**：建议仓位比例
4. **止盈目标**：目标价位（如适用）
5. **止损设置**：止损价位
6. **风险提示**

注意：仅供参考，不构成投资建议。`,
      },
    ],
    (chunk) => {
      sendEvent('agent_progress', { agent: agentName, content: chunk })
    },
    { maxTokens: 1200, temperature: 0.7 }
  )

  return report
}
