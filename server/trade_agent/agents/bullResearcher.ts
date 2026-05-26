import type { AgentName } from '../types.js'
import { callLLM } from '../llmService.js'
import type { StockAnalysisContext } from '../types.js'

export const agentName: AgentName = 'bull_researcher'

export async function execute(
  ctx: StockAnalysisContext,
  sendEvent: (type: string, data: any) => void,
  round: number,
  previousBearArgument?: string
): Promise<string> {
  const info = ctx.stockInfo
  const stockLabel = info ? `${info.name}(${info.code})` : ctx.stockCode

  const analystReports = `
## 市场分析师报告
${ctx.agentReports.market_analyst || '无'}

## 社交媒体分析师报告
${ctx.agentReports.social_media_analyst || '无'}

## 新闻分析师报告
${ctx.agentReports.news_analyst || '无'}

## 基本面分析师报告
${ctx.agentReports.fundamentals_analyst || '无'}
`

  let debateContext = ''
  if (round > 0 && previousBearArgument) {
    debateContext = `
## 上一轮看空研究员的论点（请反驳）
${previousBearArgument}
`
  }

  const report = await callLLM(
    [
      {
        role: 'system',
        content: `你是一位看多研究员（Bull Researcher）。你的角色是从积极的角度分析股票，找出支持买入的理由。你需要基于分析师团队的数据和报告，构建强有力的看多论点。${round > 0 ? '你还需要反驳看空研究员的观点。' : ''}
请用中文回答，使用markdown格式。论点要有数据支撑，不要空洞。`,
      },
      {
        role: 'user',
        content: `你正在参与关于 ${stockLabel} 的投资研究辩论（第${round + 1}轮）。

${analystReports}
${debateContext}
请提出你的看多论点（2-4个关键论点），${round > 0 ? '并反驳看空研究员的观点。' : ''}要有具体的数据支撑。`,
      },
    ],
    (chunk) => {
      sendEvent('agent_progress', { agent: agentName, content: chunk })
    },
    { maxTokens: 1000, temperature: 0.8 }
  )

  return report
}
