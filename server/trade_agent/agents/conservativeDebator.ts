import type { AgentName } from '../types.js'
import { callLLM } from '../llmService.js'
import type { StockAnalysisContext } from '../types.js'

export const agentName: AgentName = 'conservative_debator'

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
    debateNote = `\n## 其他风险分析师的观点（请回应）\n${othersArguments}\n`
  }

  const report = await callLLM(
    [
      {
        role: 'system',
        content: `你是一位保守型风险分析师。你的角色是从保守投资的角度评估风险，强调本金安全和风险控制。你的论点需要基于数据和分析。${round > 0 ? '请回应其他分析师的观点。' : ''}
请用中文回答，使用markdown格式。`,
      },
      {
        role: 'user',
        content: `你正在参与关于 ${stockLabel} 的风险评估辩论（第${round + 1}轮）。

${contextInfo}
${debateNote}
请从保守角度分析：
1. **主要风险点**：最大的下行风险是什么
2. **最坏情景**：如果判断错误，最大亏损可能多大
3. **保守操作建议**
${round > 0 ? '4. **对其他分析师观点的回应**' : ''}`,
      },
    ],
    (chunk) => {
      sendEvent('agent_progress', { agent: agentName, content: chunk })
    },
    { maxTokens: 800, temperature: 0.8 }
  )

  return report
}
