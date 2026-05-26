import type { AgentName } from '../types.js'
import { callLLM } from '../llmService.js'
import { getStockFundamentals, getStockBalanceSheet, getStockCashFlow, getStockIncomeStatement } from '../data/eastmoneyStock.js'
import type { StockAnalysisContext } from '../types.js'

export const agentName: AgentName = 'fundamentals_analyst'

export async function execute(
  ctx: StockAnalysisContext,
  sendEvent: (type: string, data: any) => void
): Promise<string> {
  const info = ctx.stockInfo
  const stockLabel = info ? `${info.name}(${info.code})` : ctx.stockCode

  sendEvent('tool_call', { agent: agentName, tool: 'getStockFundamentals' })
  const fundamentals = await getStockFundamentals(ctx.stockCode)
  ctx.fundamentals = fundamentals
  sendEvent('tool_result', { agent: agentName, tool: 'getStockFundamentals', toolResult: fundamentals ? '基本面数据获取成功' : '无基本面数据' })

  sendEvent('tool_call', { agent: agentName, tool: 'getStockBalanceSheet' })
  const balanceSheet = await getStockBalanceSheet(ctx.stockCode)
  ctx.balanceSheet = balanceSheet
  sendEvent('tool_result', { agent: agentName, tool: 'getStockBalanceSheet', toolResult: `获取到${balanceSheet.length}期资产负债表` })

  sendEvent('tool_call', { agent: agentName, tool: 'getStockCashFlow' })
  const cashFlow = await getStockCashFlow(ctx.stockCode)
  ctx.cashFlow = cashFlow
  sendEvent('tool_result', { agent: agentName, tool: 'getStockCashFlow', toolResult: `获取到${cashFlow.length}期现金流数据` })

  sendEvent('tool_call', { agent: agentName, tool: 'getStockIncomeStatement' })
  const incomeStatement = await getStockIncomeStatement(ctx.stockCode)
  ctx.incomeStatement = incomeStatement
  sendEvent('tool_result', { agent: agentName, tool: 'getStockIncomeStatement', toolResult: `获取到${incomeStatement.length}期利润表数据` })

  // Build fundamentals summary
  let fundamentalsText = ''
  if (fundamentals) {
    fundamentalsText = `
## 基本面数据
- 市盈率(动)：${fundamentals.pe.toFixed(2)}
- 市净率：${fundamentals.pb.toFixed(2)}
- 总市值：${fundamentals.marketCap.toFixed(2)}亿
- 营业收入：${fundamentals.totalRevenue.toFixed(2)}亿（同比${fundamentals.revenueGrowth >= 0 ? '+' : ''}${fundamentals.revenueGrowth.toFixed(2)}%）
- 净利润：${fundamentals.netProfit.toFixed(2)}亿（同比${fundamentals.profitGrowth >= 0 ? '+' : ''}${fundamentals.profitGrowth.toFixed(2)}%）
- 毛利率：${fundamentals.grossMargin.toFixed(2)}%
- 净利率：${fundamentals.netMargin.toFixed(2)}%
- ROE：${fundamentals.roe.toFixed(2)}%
- 资产负债率：${fundamentals.debtRatio.toFixed(2)}%
`
  }

  let balanceSheetText = ''
  if (balanceSheet.length > 0) {
    balanceSheetText = '\n## 资产负债表(最近' + balanceSheet.length + '期)\n'
    balanceSheetText += '报告期 | 总资产(亿) | 总负债(亿) | 所有者权益(亿) | 货币资金(亿)\n---|---|---|---|---\n'
    for (const b of balanceSheet) {
      balanceSheetText += `${b.reportDate} | ${b.totalAssets.toFixed(2)} | ${b.totalLiabilities.toFixed(2)} | ${b.totalEquity.toFixed(2)} | ${b.cash.toFixed(2)}\n`
    }
  }

  let cashFlowText = ''
  if (cashFlow.length > 0) {
    cashFlowText = '\n## 现金流量表(最近' + cashFlow.length + '期)\n'
    cashFlowText += '报告期 | 经营(亿) | 投资(亿) | 筹资(亿)\n---|---|---|---\n'
    for (const c of cashFlow) {
      cashFlowText += `${c.reportDate} | ${c.operatingCashFlow.toFixed(2)} | ${c.investingCashFlow.toFixed(2)} | ${c.financingCashFlow.toFixed(2)}\n`
    }
  }

  let incomeText = ''
  if (incomeStatement.length > 0) {
    incomeText = '\n## 利润表(最近' + incomeStatement.length + '期)\n'
    incomeText += '报告期 | 营收(亿) | 营业成本(亿) | 净利润(亿) | EPS\n---|---|---|---|---\n'
    for (const i of incomeStatement) {
      incomeText += `${i.reportDate} | ${i.totalRevenue.toFixed(2)} | ${i.totalCost.toFixed(2)} | ${i.netProfit.toFixed(2)} | ${i.eps.toFixed(4)}\n`
    }
  }

  const report = await callLLM(
    [
      {
        role: 'system',
        content: `你是一位专业的基本面分析师。你擅长通过财务报表、估值指标来评估公司内在价值。请用中文回答，使用markdown格式。`,
      },
      {
        role: 'user',
        content: `请对 ${stockLabel} 进行基本面分析。

${fundamentalsText}
${balanceSheetText}
${cashFlowText}
${incomeText}

请分析以下内容：
1. **估值分析**：PE、PB估值水平是否合理，与行业对比
2. **盈利能力**：营收和利润增长趋势，毛利率和净利率变化
3. **财务健康**：资产负债率、现金流状况
4. **成长性评估**：营收和利润的增长趋势
5. **综合评价**：基本面综合评分（优/良/中/差）

注意：基于财务数据客观分析。`,
      },
    ],
    (chunk) => {
      sendEvent('agent_progress', { agent: agentName, content: chunk })
    },
    { maxTokens: 1500, temperature: 0.7 }
  )

  return report
}
