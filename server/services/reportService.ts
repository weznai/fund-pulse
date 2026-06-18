import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { logger } from '../logger.js'
import { createReport } from '../db/report.js'
import type { AgentName, Decision, StockAnalysisContext } from '../trade_agent/types.js'
import { AGENT_CONFIGS, AGENT_ORDER } from '../trade_agent/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPORTS_DIR = path.join(__dirname, '..', 'reports')

function ensureReportsDir(): void {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true })
  }
}

function mdToHtml(md: string): string {
  if (!md) return ''
  let h = md
  h = h.replace(/^(\|.+\|)\n(\|[\s:|-]+\|)\n((?:\|.+\|\n?)*)/gm, (_match, headerRow: string, _sep: string, bodyRows: string) => {
    const parseCells = (row: string) => row.split('|').filter(c => c.trim() !== '').map(c => c.trim())
    const headers = parseCells(headerRow)
    const rows = bodyRows.trim().split('\n').filter(r => r.trim()).map(r => parseCells(r))
    let table = '<table><thead><tr>' + headers.map(c => `<th>${escapeHtml(c)}</th>`).join('') + '</tr></thead><tbody>'
    for (const row of rows) {
      table += '<tr>' + row.map(c => `<td>${escapeHtml(c)}</td>`).join('') + '</tr>'
    }
    table += '</tbody></table>'
    return table
  })
  h = h.replace(/^#### (.+)$/gm, '<h4>$1</h4>')
  h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  h = h.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  h = h.replace(/^# (.+)$/gm, '<h1>$1</h1>')
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  h = h.replace(/^\* (.+)$/gm, '<li>$1</li>')
  h = h.replace(/^- (.+)$/gm, '<li>$1</li>')
  h = h.replace(/(^|[^\*])\*(?!\s)(.+?)\*(?!\s)/g, '$1<em>$2</em>')
  h = h.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
  h = h.replace(/(<li>.*<\/li>\n?)+/gs, m => `<ul>${m}</ul>`)
  h = h.replace(/\n{2,}/g, '</p><p>')
  h = h.replace(/\n/g, '<br>')
  h = '<p>' + h + '</p>'
  h = h.replace(/<p><\/p>/g, '')
  h = h.replace(/<p>(<h[1234]>)/g, '$1')
  h = h.replace(/(<\/h[1234]>)<\/p>/g, '$1')
  h = h.replace(/<p>(<ul>)/g, '$1')
  h = h.replace(/(<\/ul>)<\/p>/g, '$1')
  h = h.replace(/<p>(<table>)/g, '$1')
  h = h.replace(/(<\/table>)<\/p>/g, '$1')
  return h
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  return text.replace(/[&<>"']/g, m => map[m])
}

interface ReportData {
  ctx: StockAnalysisContext
  finalDecision: Decision
  userId: string
  username: string
}

export function generateStockReport(data: ReportData): { url: string; reportId: number } | null {
  try {
    ensureReportsDir()

    const { ctx, finalDecision, userId, username } = data
    const stockInfo = ctx.stockInfo
    if (!stockInfo) return null

    const now = new Date()
    const dateStr = now.toLocaleDateString('sv-SE')
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '')
    const fileName = `${timeStr}-${stockInfo.code}.html`

    const dateDir = path.join(REPORTS_DIR, dateStr)
    if (!fs.existsSync(dateDir)) {
      fs.mkdirSync(dateDir, { recursive: true })
    }

    const filePath = path.join(dateDir, fileName)
    const url = `/reports/${dateStr}/${fileName}`

    const html = buildHtml(ctx, finalDecision, now)
    fs.writeFileSync(filePath, html, 'utf-8')

    const reportId = createReport({
      stock_code: stockInfo.code,
      stock_name: stockInfo.name,
      decision: finalDecision,
      file_path: filePath,
      url,
      user_id: userId,
      username,
      risk_report: ctx.agentReports.risk_manager || '',
    })

    logger.log(`[reportService] 报告已生成: ${stockInfo.name}(${stockInfo.code}) -> ${url}`)
    return { url, reportId }
  } catch (err) {
    logger.error('[reportService] 生成报告失败:', err)
    return null
  }
}

export function deleteReportFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch (err) {
    logger.error('[reportService] 删除报告文件失败:', err)
  }
}

export function cleanupEmptyDirs(): void {
  try {
    if (!fs.existsSync(REPORTS_DIR)) return
    const entries = fs.readdirSync(REPORTS_DIR, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirPath = path.join(REPORTS_DIR, entry.name)
        const files = fs.readdirSync(dirPath)
        if (files.length === 0) {
          fs.rmdirSync(dirPath)
        }
      }
    }
  } catch (err) {
    logger.error('[reportService] 清理空目录失败:', err)
  }
}

function buildHtml(ctx: StockAnalysisContext, decision: Decision, generatedAt: Date): string {
  const info = ctx.stockInfo!

  const decisionLabel = decision === 'BUY' ? '买入' : decision === 'SELL' ? '卖出' : '持有'
  const decisionIcon = decision === 'BUY' ? '&#x25B2;' : decision === 'SELL' ? '&#x25BC;' : '&#x25CF;'
  const decisionClass = decision.toLowerCase()
  const decisionColor = decision === 'BUY' ? '#2563EB' : decision === 'SELL' ? '#DC2626' : '#D97706'
  const decisionBg = decision === 'BUY'
    ? 'linear-gradient(135deg, #DBEAFE, #BFDBFE)'
    : decision === 'SELL'
    ? 'linear-gradient(135deg, #FEE2E2, #FECACA)'
    : 'linear-gradient(135deg, #FEF3C7, #FDE68A)'

  const changeClass = info.change >= 0 ? 'up' : 'down'
  const changeSign = info.change >= 0 ? '+' : ''

  const priceStr = info.price > 0 ? info.price.toFixed(2) : '--'

  const marketCapStr = info.marketCap > 0
    ? (info.marketCap >= 10000 ? (info.marketCap / 10000).toFixed(2) + '万亿' : info.marketCap.toFixed(1) + '亿')
    : '--'
  const peStr = info.pe > 0 ? info.pe.toFixed(2) : '--'
  const pbStr = info.pb > 0 ? info.pb.toFixed(2) : '--'
  const totalSharesStr = info.totalShares > 0
    ? (info.totalShares >= 10000 ? (info.totalShares / 10000).toFixed(2) + '亿' : info.totalShares.toFixed(0) + '万')
    : '--'

  const generatedTime = generatedAt.toLocaleString('zh-CN', { hour12: false })

  const agentReportsHtml = AGENT_ORDER.map(name => {
    const config = AGENT_CONFIGS[name]
    const report = ctx.agentReports[name]
    if (!report) return ''
    const phaseLabel = getPhaseLabel(config.phase)
    const phaseClass = config.phase
    return `
      <div class="agent-card phase-${phaseClass}">
        <div class="agent-header" onclick="this.parentElement.classList.toggle('collapsed')">
          <div class="agent-info">
            <span class="agent-phase-tag phase-tag-${phaseClass}">${phaseLabel}</span>
            <span class="agent-name">${config.label}</span>
          </div>
          <span class="agent-toggle">&#x25BC;</span>
        </div>
        <div class="agent-body">
          <div class="md">${mdToHtml(report)}</div>
        </div>
      </div>`
  }).filter(Boolean).join('\n')

  const riskManagerReport = ctx.agentReports.risk_manager
  const finalReportHtml = riskManagerReport ? mdToHtml(riskManagerReport) : '<p style="color:#94A3B8">暂无最终报告</p>'

  const stockNameEsc = escapeHtml(info.name)
  const industryEsc = info.industry && isNaN(Number(info.industry)) ? escapeHtml(info.industry) : ''

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${stockNameEsc}(${info.code}) 智能分析报告</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: linear-gradient(180deg, #F8FAFC 0%, #EFF1F5 100%);
  color: #1E293B;
  line-height: 1.7;
  min-height: 100vh;
}
.report-container { max-width: 960px; margin: 0 auto; padding: 24px 16px 60px; }

/* Header */
.report-header {
  background: white;
  border-radius: 20px;
  padding: 32px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.06);
  margin-bottom: 20px;
  position: relative;
  overflow: hidden;
}
.report-header::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 4px;
  background: linear-gradient(90deg, #BE123C, #F43F5E, #FB7185);
}

.stock-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}
.stock-title-left { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.stock-name { font-size: 26px; font-weight: 800; color: #0F172A; letter-spacing: -0.02em; }
.stock-code {
  font-size: 14px; font-weight: 600; color: #E11D48;
  background: #FFF1F2; padding: 3px 12px; border-radius: 8px;
}
.stock-industry {
  font-size: 12px; font-weight: 500; color: #475569;
  background: #F1F5F9; padding: 3px 10px; border-radius: 8px;
}
.stock-generated { font-size: 12px; color: #94A3B8; text-align: right; }
.stock-generated-label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }

.stock-metrics {
  display: flex; gap: 0; margin-top: 20px;
  background: #F8FAFC; border-radius: 14px; padding: 16px 4px;
}
.metric-item {
  flex: 1; text-align: center; padding: 0 12px;
  border-right: 1px solid #E2E8F0;
}
.metric-item:last-child { border-right: none; }
.metric-label { font-size: 11px; color: #94A3B8; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.03em; }
.metric-value { font-size: 18px; font-weight: 700; color: #0F172A; }
.metric-price { color: ${info.change >= 0 ? '#DC2626' : '#16A34A'}; }
.metric-change.${changeClass} { font-size: 14px; font-weight: 600; }
.metric-change.up { color: #DC2626; }
.metric-change.down { color: #16A34A; }

/* Decision Section */
.decision-banner {
  display: flex; align-items: center; gap: 20px;
  background: white; border-radius: 20px; padding: 28px 32px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.06);
  margin-bottom: 20px;
  border-left: 5px solid ${decisionColor};
}
.decision-icon-wrap {
  width: 64px; height: 64px; border-radius: 16px;
  display: flex; align-items: center; justify-content: center;
  background: ${decisionBg};
  flex-shrink: 0;
}
.decision-icon-text { font-size: 32px; color: ${decisionColor}; }
.decision-content { flex: 1; }
.decision-label { font-size: 12px; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; }
.decision-title { font-size: 22px; font-weight: 800; color: #0F172A; margin: 4px 0; }
.decision-desc { font-size: 13px; color: #64748B; }

/* Final Report */
.final-report-card {
  background: white; border-radius: 20px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.06);
  margin-bottom: 20px; overflow: hidden;
}
.final-report-header {
  display: flex; align-items: center; gap: 8px;
  padding: 18px 28px;
  background: linear-gradient(135deg, #FFFBFB, #FFF5F5);
  border-bottom: 2px solid #FECDD3;
  font-size: 16px; font-weight: 700; color: #9F1239;
}
.final-report-body { padding: 24px 28px; }

/* Section Title */
.section-title {
  font-size: 16px; font-weight: 700; color: #334155;
  margin: 28px 0 14px; display: flex; align-items: center; gap: 8px;
}
.section-title-icon { width: 4px; height: 18px; border-radius: 2px; background: #E11D48; }

/* Agent Cards */
.agent-card {
  background: white; border-radius: 14px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
  margin-bottom: 12px; overflow: hidden;
  border: 1px solid #F1F5F9;
  transition: box-shadow 0.2s;
}
.agent-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.07); }
.agent-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; cursor: pointer;
  background: #FAFBFC; border-bottom: 1px solid #F1F5F9;
  transition: background 0.15s;
}
.agent-header:hover { background: #F8FAFC; }
.agent-info { display: flex; align-items: center; gap: 10px; }
.agent-phase-tag {
  font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 5px;
  text-transform: uppercase; letter-spacing: 0.03em;
}
.phase-tag-analysts { background: #DBEAFE; color: #1E40AF; }
.phase-tag-research_debate { background: #E9D5FF; color: #6B21A8; }
.phase-tag-trading { background: #D1FAE5; color: #065F46; }
.phase-tag-risk_debate { background: #FED7AA; color: #9A3412; }
.phase-tag-decision { background: #FDE68A; color: #92400E; }
.agent-name { font-size: 14px; font-weight: 600; color: #334155; }
.agent-toggle { font-size: 12px; color: #94A3B8; transition: transform 0.2s; }
.agent-card.collapsed .agent-toggle { transform: rotate(-90deg); }
.agent-card.collapsed .agent-body { display: none; }
.agent-body { padding: 18px 20px; }

/* Markdown */
.md { line-height: 1.8; color: #475569; font-size: 14px; }
.md h1 { font-size: 18px; font-weight: 800; color: #0F172A; margin: 16px 0 8px; }
.md h2 { font-size: 16px; font-weight: 700; color: #1E293B; margin: 14px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #F1F5F9; }
.md h3 { font-size: 15px; font-weight: 600; color: #334155; margin: 10px 0 4px; }
.md h4 { font-size: 14px; font-weight: 600; color: #475569; margin: 8px 0 3px; }
.md strong { color: #0F172A; font-weight: 700; }
.md em { color: #64748B; }
.md ul { margin: 8px 0; padding-left: 20px; }
.md li { margin: 4px 0; }
.md p { margin: 8px 0; }
.md table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
.md th { background: #FFF1F2; color: #9F1239; font-weight: 600; text-align: left; padding: 8px 12px; border: 1px solid #FECDD3; }
.md td { padding: 7px 12px; border: 1px solid #E2E8F0; color: #475569; }
.md tr:nth-child(even) td { background: #FAFAFA; }

/* Disclaimer */
.disclaimer {
  margin-top: 32px; padding: 20px 24px;
  background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 14px;
  font-size: 12px; color: #92400E; line-height: 1.8;
}
.disclaimer-title { font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }

/* Badge */
.report-badge {
  position: absolute; top: 20px; right: 28px;
  padding: 6px 16px; border-radius: 8px;
  font-size: 12px; font-weight: 700; letter-spacing: 0.03em;
  background: ${decisionBg}; color: ${decisionColor};
}

@media (max-width: 640px) {
  .report-container { padding: 12px 8px 40px; }
  .report-header { padding: 20px 16px; border-radius: 14px; }
  .stock-name { font-size: 20px; }
  .stock-metrics { flex-wrap: wrap; gap: 12px; padding: 12px; }
  .metric-item { flex: 1 1 40%; border-right: none; }
  .decision-banner { padding: 20px 16px; flex-wrap: wrap; }
  .agent-header { padding: 12px 14px; }
  .agent-body { padding: 14px; }
}
</style>
</head>
<body>
<div class="report-container">

  <div class="report-header">
    <div class="report-badge">决策: ${decisionLabel}</div>
    <div class="stock-title-row">
      <div class="stock-title-left">
        <span class="stock-name">${stockNameEsc}</span>
        <span class="stock-code">${info.code}</span>
        ${industryEsc ? `<span class="stock-industry">${industryEsc}</span>` : ''}
      </div>
      <div class="stock-generated">
        <span class="stock-generated-label">报告生成时间</span>
        ${generatedTime}
      </div>
    </div>
    <div class="stock-metrics">
      <div class="metric-item">
        <div class="metric-label">现价</div>
        <div class="metric-value metric-price">${priceStr}</div>
      </div>
      <div class="metric-item">
        <div class="metric-label">涨跌幅</div>
        <div class="metric-value metric-change ${changeClass}">${changeSign}${info.change.toFixed(2)}%</div>
      </div>
      <div class="metric-item">
        <div class="metric-label">总市值</div>
        <div class="metric-value">${marketCapStr}</div>
      </div>
      <div class="metric-item">
        <div class="metric-label">PE(动)</div>
        <div class="metric-value">${peStr}</div>
      </div>
      <div class="metric-item">
        <div class="metric-label">PB</div>
        <div class="metric-value">${pbStr}</div>
      </div>
      <div class="metric-item">
        <div class="metric-label">总股本</div>
        <div class="metric-value">${totalSharesStr}</div>
      </div>
    </div>
  </div>

  <div class="decision-banner">
    <div class="decision-icon-wrap">
      <span class="decision-icon-text">${decisionIcon}</span>
    </div>
    <div class="decision-content">
      <div class="decision-label">多智能体综合决策</div>
      <div class="decision-title">建议${decisionLabel}</div>
      <div class="decision-desc">由风险经理综合分析师团队、多空辩论、交易计划及风险评估多方意见后得出</div>
    </div>
  </div>

  <div class="final-report-card">
    <div class="final-report-header">
      <span>最终分析报告</span>
    </div>
    <div class="final-report-body">
      <div class="md">${finalReportHtml}</div>
    </div>
  </div>

  <div class="section-title">
    <span class="section-title-icon"></span>
    各智能体详细报告
  </div>
  ${agentReportsHtml}

  <div class="disclaimer">
    <div class="disclaimer-title">&#x26A0; 免责声明</div>
    本报告由 AI 多智能体系统自动生成，所有分析内容仅供参考，不构成任何投资建议。投资有风险，入市需谨慎。请根据自身风险承受能力做出独立判断，据此操作风险自担。本报告将在生成后7天自动删除。
  </div>

</div>
</body>
</html>`
}

function getPhaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    analysts: '分析师',
    research_debate: '研究辩论',
    trading: '交易计划',
    risk_debate: '风险评估',
    decision: '最终决策',
  }
  return labels[phase] || phase
}
