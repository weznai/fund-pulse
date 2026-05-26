import type { AgentName } from '../types.js'
import { callLLM } from '../llmService.js'
import type { StockAnalysisContext } from '../types.js'

export const agentName: AgentName = 'neutral_debator'

export async function execute(
  ctx: StockAnalysisContext,
  sendEvent: (type: string, data: any) => void,
  round: number,
  othersArguments?: string
): Promise<string> {
  const info = ctx.stockInfo
  const stockLabel = info ? `${info.name}(${info.code})` : ctx.stockCode

  const contextInfo = `
## 研究主管决策
${ctx.agentReports.research_manager || '无'}

## 交易员计划
${ctx.agentReports.trader || '无'}
`

  let debateNote = ''
  if (othersArguments) {
    debateNote = `\n## 激进和保守分析师的观点（请平衡）\n${othersArguments}\n`
  }

  const report = await callLLM(
    [
      {
        role: 'system',
        content: `你是一位中性/平衡型风险分析师。你的角色是平衡激进和保守的观点，提供客观中立的风险评估。你的论点需要基于数据和分析。
请用中文回答，使用markdown格式。`,
      },
      {
        role: 'user',
        content: `你正在参与关于 ${stockLabel} 的风险评估辩论（第${round + 1}轮）。

${contextInfo}
${debateNote}
请从中立角度分析：
1. **风险收益平衡**：客观评估风险和收益
2. **概率分析**：不同情景的概率分布
3. **中性操作建议**
${round > 0 ? '4. **对激进和保守观点的平衡评价**' : ''}`,
      },
    ],
    (chunk) => {
      sendEvent('agent_progress', { agent: agentName, content: chunk })
    },
    { maxTokens: 800, temperature: 0.7 }
  )

  return report
}
