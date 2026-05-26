import type { AgentName } from '../types.js'
import { callLLM } from '../llmService.js'
import { getStockKline } from '../data/eastmoneyStock.js'
import { calculateTechnicalIndicators, formatTechnicalSummary } from '../data/technicalIndicators.js'
import type { StockAnalysisContext } from '../types.js'

export const agentName: AgentName = 'market_analyst'

export async function execute(
  ctx: StockAnalysisContext,
  sendEvent: (type: string, data: any) => void
): Promise<string> {
  sendEvent('tool_call', { agent: agentName, tool: 'getStockKline' })

  const kline = await getStockKline(ctx.stockCode, 120)
  ctx.klineData = kline

  if (kline.length === 0) {
    const report = '## 市场分析师报告\n\n无法获取K线数据，无法进行技术分析。'
    return report
  }

  sendEvent('tool_result', { agent: agentName, tool: 'getStockKline', toolResult: `获取到${kline.length}条K线数据` })

  sendEvent('tool_call', { agent: agentName, tool: 'calculateTechnicalIndicators' })
  const indicators = calculateTechnicalIndicators(kline)
  ctx.technicalIndicators = indicators
  sendEvent('tool_result', { agent: agentName, tool: 'calculateTechnicalIndicators', toolResult: '技术指标计算完成' })

  const techSummary = formatTechnicalSummary(kline, indicators, 20)

  const info = ctx.stockInfo
  const stockLabel = info ? `${info.name}(${info.code})` : ctx.stockCode

  let progressText = ''
  const report = await callLLM(
    [
      {
        role: 'system',
        content: `你是一位专业的股票市场技术分析师。你擅长通过K线图、技术指标（MA/MACD/RSI/布林带/ATR/KDJ）来分析股票走势。请用中文回答，使用markdown格式。分析要基于数据，客观专业。`,
      },
      {
        role: 'user',
        content: `请对 ${stockLabel} 进行技术分析。

${techSummary}

请分析以下内容：
1. **趋势判断**：基于均线系统判断当前趋势
2. **动量分析**：MACD、RSI、KDJ指标解读
3. **波动分析**：布林带、ATR分析
4. **关键支撑位和压力位**
5. **短期（1-2周）走势展望**

注意：分析要基于数据，客观专业，语言简洁。`,
      },
    ],
    (chunk) => {
      progressText += chunk
      sendEvent('agent_progress', { agent: agentName, content: chunk })
    },
    { maxTokens: 1500, temperature: 0.7 }
  )

  return report
}
