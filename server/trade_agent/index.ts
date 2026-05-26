import { logger } from '../logger.js'
import type { AgentName, Decision, StockAnalysisContext, SSEEvent } from './types.js'
import { AGENT_CONFIGS, AGENT_ORDER } from './types.js'
import { getStockInfo } from './data/eastmoneyStock.js'

// Agent imports
import * as marketAnalyst from './agents/marketAnalyst.js'
import * as socialMediaAnalyst from './agents/socialMediaAnalyst.js'
import * as newsAnalyst from './agents/newsAnalyst.js'
import * as fundamentalsAnalyst from './agents/fundamentalsAnalyst.js'
import * as bullResearcher from './agents/bullResearcher.js'
import * as bearResearcher from './agents/bearResearcher.js'
import * as researchManager from './agents/researchManager.js'
import * as trader from './agents/trader.js'
import * as aggressiveDebator from './agents/aggressiveDebator.js'
import * as conservativeDebator from './agents/conservativeDebator.js'
import * as neutralDebator from './agents/neutralDebator.js'
import * as riskManager from './agents/riskManager.js'

const RESEARCH_DEBATE_ROUNDS = 2
const RISK_DEBATE_ROUNDS = 2

export { AGENT_CONFIGS, AGENT_ORDER }
export type { AgentName, Decision, SSEEvent }

function createSendEvent(res: import('express').Response) {
  return (type: string, data: any) => {
    try {
      const event: SSEEvent = { type: type as SSEEvent['type'], ...data }
      res.write(`data: ${JSON.stringify(event)}\n\n`)
    } catch { /* */ }
  }
}

export async function runStockAnalysis(
  res: import('express').Response,
  stockCode: string
): Promise<void> {
  const sendEvent = createSendEvent(res)

  const ctx: StockAnalysisContext = {
    stockCode,
    stockInfo: null,
    klineData: [],
    technicalIndicators: null,
    fundamentals: null,
    balanceSheet: [],
    cashFlow: [],
    incomeStatement: [],
    stockNews: [],
    globalNews: [],
    agentReports: {} as Record<AgentName, string>,
    debateHistory: [],
  }

  try {
    // ====== Phase 0: Pre-check ======
    sendEvent('tool_call', { agent: 'market_analyst', tool: 'getStockInfo' })
    ctx.stockInfo = await getStockInfo(stockCode)
    sendEvent('tool_result', { agent: 'market_analyst', tool: 'getStockInfo', toolResult: ctx.stockInfo ? `${ctx.stockInfo.name}(${ctx.stockInfo.code})` : '未找到' })

    if (!ctx.stockInfo || !ctx.stockInfo.name) {
      sendEvent('error', { error: `无法获取股票 ${stockCode} 的基本信息，请确认代码是否正确` })
      res.end()
      return
    }
    if (ctx.stockInfo.price <= 0) {
      sendEvent('error', { error: `股票 ${ctx.stockInfo.name}(${stockCode}) 当前无有效价格数据（可能已退市或停牌），无法进行有效分析` })
      res.end()
      return
    }

    // ====== Phase 1: Analysts ======
    // 1. Market Analyst
    sendEvent('agent_start', { agent: 'market_analyst', phase: 'analysts', content: '正在获取K线数据并计算技术指标...' })
    try {
      const report = await marketAnalyst.execute(ctx, sendEvent)
      ctx.agentReports.market_analyst = report
      sendEvent('agent_complete', { agent: 'market_analyst', report })
    } catch (e: any) {
      logger.error(`[stockAnalysis] market_analyst error: ${e?.message}`)
      ctx.agentReports.market_analyst = `市场分析师报告生成失败: ${e?.message}`
      sendEvent('agent_complete', { agent: 'market_analyst', report: ctx.agentReports.market_analyst })
    }

    // Early abort: no kline data at all
    if (ctx.klineData.length === 0) {
      sendEvent('error', { error: `无法获取 ${ctx.stockInfo.name}(${stockCode}) 的K线数据，可能是新股、退市股或数据源异常，无法继续分析` })
      res.end()
      return
    }

    // 2. Social Media Analyst
    sendEvent('agent_start', { agent: 'social_media_analyst', phase: 'analysts', content: '正在获取新闻和舆情数据...' })
    try {
      const report = await socialMediaAnalyst.execute(ctx, sendEvent)
      ctx.agentReports.social_media_analyst = report
      sendEvent('agent_complete', { agent: 'social_media_analyst', report })
    } catch (e: any) {
      logger.error(`[stockAnalysis] social_media_analyst error: ${e?.message}`)
      ctx.agentReports.social_media_analyst = `社交媒体分析师报告生成失败: ${e?.message}`
      sendEvent('agent_complete', { agent: 'social_media_analyst', report: ctx.agentReports.social_media_analyst })
    }

    // 3. News Analyst
    sendEvent('agent_start', { agent: 'news_analyst', phase: 'analysts', content: '正在获取宏观新闻...' })
    try {
      const report = await newsAnalyst.execute(ctx, sendEvent)
      ctx.agentReports.news_analyst = report
      sendEvent('agent_complete', { agent: 'news_analyst', report })
    } catch (e: any) {
      logger.error(`[stockAnalysis] news_analyst error: ${e?.message}`)
      ctx.agentReports.news_analyst = `新闻分析师报告生成失败: ${e?.message}`
      sendEvent('agent_complete', { agent: 'news_analyst', report: ctx.agentReports.news_analyst })
    }

    // 4. Fundamentals Analyst
    sendEvent('agent_start', { agent: 'fundamentals_analyst', phase: 'analysts', content: '正在获取财务数据...' })
    try {
      const report = await fundamentalsAnalyst.execute(ctx, sendEvent)
      ctx.agentReports.fundamentals_analyst = report
      sendEvent('agent_complete', { agent: 'fundamentals_analyst', report })
    } catch (e: any) {
      logger.error(`[stockAnalysis] fundamentals_analyst error: ${e?.message}`)
      ctx.agentReports.fundamentals_analyst = `基本面分析师报告生成失败: ${e?.message}`
      sendEvent('agent_complete', { agent: 'fundamentals_analyst', report: ctx.agentReports.fundamentals_analyst })
    }

    // Early abort: core data too sparse — no fundamentals AND limited kline
    const hasFundamentals = ctx.fundamentals && (ctx.fundamentals.pe > 0 || ctx.fundamentals.pb > 0 || ctx.fundamentals.marketCap > 0)
    const hasFinancialReports = ctx.balanceSheet.length > 0 || ctx.incomeStatement.length > 0
    const shortKline = ctx.klineData.length < 20
    if (!hasFundamentals && !hasFinancialReports && shortKline) {
      const label = ctx.stockInfo ? `${ctx.stockInfo.name}(${stockCode})` : stockCode
      sendEvent('error', { error: `${label} 核心数据严重不足：无基本面数据且K线数据过少，继续分析无实际意义` })
      res.end()
      return
    }

    // ====== Phase 2: Research Debate ======
    let bullArg: string | undefined
    let bearArg: string | undefined
    const debateHistory: string[] = []

    for (let round = 0; round < RESEARCH_DEBATE_ROUNDS; round++) {
      sendEvent('debate_start', { debateType: 'research', round: round + 1 })

      // Bull
      sendEvent('agent_start', { agent: 'bull_researcher', phase: 'research_debate', content: `多空辩论第${round + 1}轮 - 看多研究员发言...` })
      try {
        bullArg = await bullResearcher.execute(ctx, sendEvent, round, bearArg)
        ctx.agentReports.bull_researcher = bullArg
        sendEvent('agent_complete', { agent: 'bull_researcher', report: bullArg })
      } catch (e: any) {
        bullArg = `看多研究员发言失败: ${e?.message}`
        sendEvent('agent_complete', { agent: 'bull_researcher', report: bullArg })
      }

      // Bear
      sendEvent('agent_start', { agent: 'bear_researcher', phase: 'research_debate', content: `多空辩论第${round + 1}轮 - 看空研究员发言...` })
      try {
        bearArg = await bearResearcher.execute(ctx, sendEvent, round, bullArg)
        ctx.agentReports.bear_researcher = bearArg
        sendEvent('agent_complete', { agent: 'bear_researcher', report: bearArg })
      } catch (e: any) {
        bearArg = `看空研究员发言失败: ${e?.message}`
        sendEvent('agent_complete', { agent: 'bear_researcher', report: bearArg })
      }

      debateHistory.push(`### 第${round + 1}轮\n**看多**:\n${bullArg}\n\n**看空**:\n${bearArg}`)
      sendEvent('debate_round', { debateType: 'research', round: round + 1 })
    }

    ctx.debateHistory = debateHistory

    // Research Manager
    let researchDecision: Decision = 'HOLD'
    sendEvent('agent_start', { agent: 'research_manager', phase: 'research_debate', content: '研究主管综合辩论做出决策...' })
    try {
      const result = await researchManager.execute(ctx, sendEvent, debateHistory)
      ctx.agentReports.research_manager = result.report
      researchDecision = result.decision
      sendEvent('agent_complete', { agent: 'research_manager', report: result.report })
      sendEvent('decision', { agent: 'research_manager', decision: researchDecision })
    } catch (e: any) {
      ctx.agentReports.research_manager = `研究主管决策失败: ${e?.message}`
      sendEvent('agent_complete', { agent: 'research_manager', report: ctx.agentReports.research_manager })
    }

    // ====== Phase 3: Trader ======
    sendEvent('agent_start', { agent: 'trader', phase: 'trading', content: '交易员制定交易计划...' })
    try {
      const report = await trader.execute(ctx, sendEvent, researchDecision)
      ctx.agentReports.trader = report
      sendEvent('agent_complete', { agent: 'trader', report })
    } catch (e: any) {
      ctx.agentReports.trader = `交易员计划生成失败: ${e?.message}`
      sendEvent('agent_complete', { agent: 'trader', report: ctx.agentReports.trader })
    }

    // ====== Phase 4: Risk Debate ======
    const riskDebateHistory: string[] = []

    for (let round = 0; round < RISK_DEBATE_ROUNDS; round++) {
      sendEvent('debate_start', { debateType: 'risk', round: round + 1 })

      const roundArgs: string[] = []

      // Aggressive
      sendEvent('agent_start', { agent: 'aggressive_debator', phase: 'risk_debate', content: `风险评估第${round + 1}轮 - 激进分析师...` })
      try {
        const arg = await aggressiveDebator.execute(ctx, sendEvent, round, roundArgs.join('\n'))
        ctx.agentReports.aggressive_debator = arg
        roundArgs.push(`**激进分析师**:\n${arg}`)
        sendEvent('agent_complete', { agent: 'aggressive_debator', report: arg })
      } catch (e: any) {
        const arg = `激进分析师发言失败: ${e?.message}`
        roundArgs.push(arg)
        sendEvent('agent_complete', { agent: 'aggressive_debator', report: arg })
      }

      // Conservative
      sendEvent('agent_start', { agent: 'conservative_debator', phase: 'risk_debate', content: `风险评估第${round + 1}轮 - 保守分析师...` })
      try {
        const arg = await conservativeDebator.execute(ctx, sendEvent, round, roundArgs.join('\n'))
        ctx.agentReports.conservative_debator = arg
        roundArgs.push(`**保守分析师**:\n${arg}`)
        sendEvent('agent_complete', { agent: 'conservative_debator', report: arg })
      } catch (e: any) {
        const arg = `保守分析师发言失败: ${e?.message}`
        roundArgs.push(arg)
        sendEvent('agent_complete', { agent: 'conservative_debator', report: arg })
      }

      // Neutral
      sendEvent('agent_start', { agent: 'neutral_debator', phase: 'risk_debate', content: `风险评估第${round + 1}轮 - 中性分析师...` })
      try {
        const arg = await neutralDebator.execute(ctx, sendEvent, round, roundArgs.join('\n'))
        ctx.agentReports.neutral_debator = arg
        roundArgs.push(`**中性分析师**:\n${arg}`)
        sendEvent('agent_complete', { agent: 'neutral_debator', report: arg })
      } catch (e: any) {
        const arg = `中性分析师发言失败: ${e?.message}`
        roundArgs.push(arg)
        sendEvent('agent_complete', { agent: 'neutral_debator', report: arg })
      }

      riskDebateHistory.push(`### 第${round + 1}轮\n${roundArgs.join('\n\n')}`)
      sendEvent('debate_round', { debateType: 'risk', round: round + 1 })
    }

    // ====== Phase 5: Risk Manager (Final Decision) ======
    let finalDecision: Decision = 'HOLD'
    sendEvent('agent_start', { agent: 'risk_manager', phase: 'decision', content: '风险经理做出最终决策...' })
    try {
      const result = await riskManager.execute(ctx, sendEvent, riskDebateHistory)
      ctx.agentReports.risk_manager = result.report
      finalDecision = result.decision
      sendEvent('agent_complete', { agent: 'risk_manager', report: result.report })
      sendEvent('decision', { agent: 'risk_manager', decision: finalDecision })
    } catch (e: any) {
      ctx.agentReports.risk_manager = `风险经理决策失败: ${e?.message}`
      sendEvent('agent_complete', { agent: 'risk_manager', report: ctx.agentReports.risk_manager })
    }

    // Done
    sendEvent('done', {})
    res.end()
  } catch (error: any) {
    logger.error(`[stockAnalysis] Fatal error: ${error?.message || error}`)
    sendEvent('error', { error: error?.message || '分析过程发生错误' })
    res.end()
  }
}
