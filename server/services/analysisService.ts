import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../../.env') })

import { logger } from '../logger.js'
import { ensureAnalysisUsageTable, getAnalysisUsage, incrementAnalysisUsage } from '../db/analysisUsage.js'
import { getCurrentUserId } from '../db/connection.js'
import { getFundHistory, getFundHoldings, fetchFinalNavFromMobApi } from '../external/eastmoney.js'
import { getFundInfo } from '../db/fundInfo.js'
import { getNavHistoryRange } from '../db/navHistory.js'
import { getLLMConfigForScene, getFallbackLLMConfig } from '../db/modelConfig.js'

function getLLMConfig() {
  const config = getLLMConfigForScene('fund_analysis')
  if (config) return config
  return getFallbackLLMConfig()
}

interface HoldingInfo {
  name: string
  code: string
  ratio: string
  change: string
}

interface FundAnalysisData {
  code: string
  name: string
  type: string
  navData: Array<{ date: string; nav: number; growth: number }>
  latestNav: number
  latestDate: string
  periodReturn: number
  todayNav: number | null
  todayGrowth: number | null
  todayDate: string | null
  holdings: HoldingInfo[]
}

function getStartDate(period: string): string {
  const now = new Date()
  const months = period === '1m' ? 1 : period === '3m' ? 3 : 12
  const start = new Date(now.getFullYear(), now.getMonth() - months, now.getDate())
  return start.toLocaleDateString('sv-SE')
}

async function fetchFundAnalysisData(code: string, period: string): Promise<FundAnalysisData | null> {
  const fundInfo = getFundInfo(code)
  const name = fundInfo?.name || `基金${code}`
  const type = fundInfo?.type || '未知'

  const startDate = getStartDate(period)
  let navData = getNavHistoryRange(code, startDate)

  if (navData.length < 5) {
    try {
      const months = period === '1m' ? '1' : period === '3m' ? '3' : '12'
      const history = await getFundHistory(code, months)
      navData = history.map(h => ({ date: h.date, nav: h.nav, growth: h.growth }))
    } catch (e) {
      logger.error(`获取基金${code}历史数据失败:`, e instanceof Error ? e.message : e)
    }
  }

  if (navData.length === 0) return null

  const latest = navData[navData.length - 1]
  const first = navData[0]
  const periodReturn = first.nav > 0 ? ((latest.nav - first.nav) / first.nav) * 100 : 0

  let todayNav: number | null = null
  let todayGrowth: number | null = null
  let todayDate: string | null = null
  try {
    const mobData = await fetchFinalNavFromMobApi(code)
    if (mobData) {
      todayNav = mobData.nav
      todayGrowth = mobData.growth
      todayDate = mobData.date
    }
  } catch { /* */ }

  let holdings: HoldingInfo[] = []
  try {
    const holdingsResult = await getFundHoldings(code)
    if (!holdingsResult.pageNotFound && holdingsResult.data.length > 0) {
      holdings = holdingsResult.data.slice(0, 10)
    }
  } catch { /* */ }

  return {
    code,
    name,
    type,
    navData: navData.map(d => ({ date: d.date, nav: d.nav, growth: d.growth })),
    latestNav: latest.nav,
    latestDate: latest.date,
    periodReturn,
    todayNav,
    todayGrowth,
    todayDate,
    holdings
  }
}

function buildSingleFundPrompt(data: FundAnalysisData, period: string): string {
  const periodLabel = period === '1m' ? '近1个月' : period === '3m' ? '近3个月' : '近1年'
  const sampleData = data.navData.length > 30
    ? [...data.navData.filter((_, i) => i % Math.ceil(data.navData.length / 20) === 0), data.navData[data.navData.length - 1]]
    : data.navData

  const navPoints = sampleData.map(d => `${d.date}: 净值${d.nav.toFixed(4)}, 涨跌幅${d.growth.toFixed(2)}%`).join('\n')

  const maxNav = Math.max(...data.navData.map(d => d.nav))
  const minNav = Math.min(...data.navData.map(d => d.nav))
  const avgNav = data.navData.reduce((s, d) => s + d.nav, 0) / data.navData.length
  const maxGrowth = Math.max(...data.navData.map(d => d.growth))
  const minGrowth = Math.min(...data.navData.map(d => d.growth))
  const avgGrowth = data.navData.reduce((s, d) => s + d.growth, 0) / data.navData.length
  const positiveDays = data.navData.filter(d => d.growth > 0).length
  const negativeDays = data.navData.filter(d => d.growth < 0).length
  const volatility = Math.sqrt(data.navData.reduce((s, d) => s + Math.pow(d.growth - avgGrowth, 2), 0) / data.navData.length)

  let todaySection = ''
  if (data.todayNav !== null && data.todayDate) {
    const todaySign = (data.todayGrowth ?? 0) >= 0 ? '+' : ''
    todaySection = `
## 当日实时数据（${data.todayDate}）
- 当日估值净值：${data.todayNav.toFixed(4)}
- 当日估值涨跌：${todaySign}${(data.todayGrowth ?? 0).toFixed(2)}%
`
  }

  let holdingsSection = ''
  if (data.holdings.length > 0) {
    const holdingsList = data.holdings.map(h => {
      const changeStr = h.change && h.change !== '-' ? `（当日${h.change}）` : ''
      return `  - ${h.name}（${h.code}）占比 ${h.ratio}${changeStr}`
    }).join('\n')
    holdingsSection = `
## 前${data.holdings.length}大重仓股
${holdingsList}
`
  }

  return `你是一位专业的基金分析师。请根据以下基金数据，提供一份专业、客观的分析报告。

## 基金基本信息
- 基金代码：${data.code}
- 基金名称：${data.name}
- 基金类型：${data.type}
- 最新净值：${data.latestNav.toFixed(4)}（${data.latestDate}）
- ${periodLabel}收益率：${data.periodReturn.toFixed(2)}%
${todaySection}${holdingsSection}
## ${periodLabel}走势数据（采样）
${navPoints}

## 统计指标
- 净值区间：${minNav.toFixed(4)} ~ ${maxNav.toFixed(4)}
- 平均净值：${avgNav.toFixed(4)}
- 最大单日涨幅：${maxGrowth.toFixed(2)}%
- 最大单日跌幅：${minGrowth.toFixed(2)}%
- 日均涨跌幅：${avgGrowth.toFixed(4)}%
- 上涨天数/下跌天数：${positiveDays}/${negativeDays}
- 波动率（标准差）：${volatility.toFixed(4)}%

请从以下几个维度进行分析，使用简洁的markdown格式：
1. **走势概况**：简要描述${periodLabel}的走势特征，结合当日实时数据说明最新动态
2. **重仓股分析**：${data.holdings.length > 0 ? '分析重仓股结构及其对基金表现的影响，结合重仓股当日涨跌情况' : '无重仓股数据，跳过此项'}
3. **波动分析**：分析基金的风险水平
4. **趋势判断**：基于数据判断当前趋势
5. **投资建议**：给出客观的投资建议（声明：仅供参考，不构成投资建议）

注意：分析要基于数据，客观专业，语言简洁。最后附上免责声明。`
}

function buildComparisonPrompt(fundsData: FundAnalysisData[], period: string): string {
  const periodLabel = period === '1m' ? '近1个月' : period === '3m' ? '近3个月' : '近1年'

  const fundsInfo = fundsData.map(f => {
    const sampleData = f.navData.length > 20
      ? [...f.navData.filter((_, i) => i % Math.ceil(f.navData.length / 15) === 0), f.navData[f.navData.length - 1]]
      : f.navData
    const navPoints = sampleData.map(d => `${d.date}: ${d.nav.toFixed(4)}(${d.growth >= 0 ? '+' : ''}${d.growth.toFixed(2)}%)`).join(', ')
    const maxGrowth = Math.max(...f.navData.map(d => d.growth))
    const minGrowth = Math.min(...f.navData.map(d => d.growth))
    const avgGrowth = f.navData.reduce((s, d) => s + d.growth, 0) / f.navData.length
    const volatility = Math.sqrt(f.navData.reduce((s, d) => s + Math.pow(d.growth - avgGrowth, 2), 0) / f.navData.length)

    let todayLine = ''
    if (f.todayNav !== null && f.todayDate) {
      const todaySign = (f.todayGrowth ?? 0) >= 0 ? '+' : ''
      todayLine = `\n- 当日估值：${f.todayNav.toFixed(4)}（${todaySign}${(f.todayGrowth ?? 0).toFixed(2)}%，${f.todayDate}）`
    }

    let holdingsLines = ''
    if (f.holdings.length > 0) {
      holdingsLines = '\n- 重仓股：' + f.holdings.slice(0, 5).map(h => {
        const changeStr = h.change && h.change !== '-' ? `(${h.change})` : ''
        return `${h.name}${changeStr} ${h.ratio}`
      }).join('、')
    }

    return `### ${f.name}（${f.code}）
- 类型：${f.type}
- 最新净值：${f.latestNav.toFixed(4)}（${f.latestDate}）
- ${periodLabel}收益率：${f.periodReturn.toFixed(2)}%
- 最大涨幅/跌幅：${maxGrowth.toFixed(2)}% / ${minGrowth.toFixed(2)}%
- 波动率：${volatility.toFixed(4)}%
- 走势数据：${navPoints}${todayLine}${holdingsLines}`
  }).join('\n\n')

  return `你是一位专业的基金分析师。请对以下${fundsData.length}只基金进行${periodLabel}的对比分析。

${fundsInfo}

请从以下维度进行对比分析，使用简洁的markdown格式：
1. **收益对比**：对比各基金的收益表现，排名，结合当日估值说明最新动态
2. **持仓对比**：对比各基金的重仓股结构差异，分析持仓风格
3. **风险对比**：对比波动率和最大回撤
4. **相关性分析**：分析各基金走势的关联度
5. **配置建议**：给出基金配置建议

注意：分析要基于数据，客观专业，语言简洁。最后附上免责声明。`
}

export function checkUsageLimit(): { allowed: boolean; credits: number; userType: string } {
  ensureAnalysisUsageTable()
  const userId = getCurrentUserId()
  const userType = userId.type === 'registered' ? 'registered' as const : 'guest' as const
  const usage = getAnalysisUsage(userId.id, userType)
  return {
    allowed: usage.credits > 0,
    credits: usage.credits,
    userType
  }
}

export async function streamAnalysis(
  res: import('express').Response,
  codes: string[],
  period: string
): Promise<void> {
  ensureAnalysisUsageTable()
  const userId = getCurrentUserId()
  const userType = userId.type === 'registered' ? 'registered' as const : 'guest' as const

  const usage = getAnalysisUsage(userId.id, userType)
  if (usage.credits < 2) {
    res.write(`data: ${JSON.stringify({ error: '积分不足，无法进行分析', credits: usage.credits })}\n\n`)
    res.end()
    return
  }

  const isComparison = codes.length > 1
  const fundsData: FundAnalysisData[] = []

  for (const code of codes) {
    const data = await fetchFundAnalysisData(code, period)
    if (data) {
      fundsData.push(data)
    }
  }

  if (fundsData.length === 0) {
    res.write(`data: ${JSON.stringify({ error: '未找到有效的基金数据' })}\n\n`)
    res.end()
    return
  }

  const prompt = isComparison
    ? buildComparisonPrompt(fundsData, period)
    : buildSingleFundPrompt(fundsData[0], period)

  const systemPrompt = isComparison
    ? '你是一位专业的基金对比分析师，擅长多基金横向对比分析。请用中文回答，使用markdown格式，内容专业简洁。'
    : '你是一位专业的基金分析师，擅长单只基金的深度分析。请用中文回答，使用markdown格式，内容专业简洁。'

  try {
    const llmConfig = getLLMConfig()
    const llmResponse = await fetch(`${llmConfig.apiBase}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${llmConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: llmConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.7,
        stream: true
      })
    })

    if (!llmResponse.ok) {
      const errBody = await llmResponse.text().catch(() => '')
      logger.error(`LLM API error: status=${llmResponse.status} body=${errBody.slice(0, 500)}`)
      res.write(`data: ${JSON.stringify({ error: '分析服务暂时不可用，请稍后重试' })}\n\n`)
      res.end()
      return
    }

    const deductResult = incrementAnalysisUsage(userId.id, 2)
    res.write(`data: ${JSON.stringify({ type: 'usage', credits: deductResult.remaining })}\n\n`)

    const reader = llmResponse.body?.getReader()
    if (!reader) {
      res.write(`data: ${JSON.stringify({ error: '无法读取响应流' })}\n\n`)
      res.end()
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const jsonStr = trimmed.slice(5).trim()
        if (jsonStr === '[DONE]') {
          res.write('data: [DONE]\n\n')
          continue
        }
        try {
          const parsed = JSON.parse(jsonStr)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) {
            res.write(`data: ${JSON.stringify({ type: 'content', content })}\n\n`)
          }
        } catch {
          // skip
        }
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (error: any) {
    logger.error('LLM analysis error:', error?.message || error)
    res.write(`data: ${JSON.stringify({ error: '分析服务暂时不可用，请稍后重试' })}\n\n`)
    res.end()
  }
}
