import type { StockKlinePoint, TechnicalIndicators } from '../types.js'

function sma(data: number[], period: number): number[] {
  const result: number[] = []
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN)
    } else {
      let sum = 0
      for (let j = i - period + 1; j <= i; j++) sum += data[j]
      result.push(sum / period)
    }
  }
  return result
}

function ema(data: number[], period: number): number[] {
  const result: number[] = []
  const k = 2 / (period + 1)
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result.push(data[0])
    } else {
      result.push(data[i] * k + result[i - 1] * (1 - k))
    }
  }
  return result
}

function calcMACD(closes: number[], short: number = 12, long: number = 26, signal: number = 9): { dif: number[]; dea: number[]; macd: number[] } {
  const emaShort = ema(closes, short)
  const emaLong = ema(closes, long)
  const dif = emaShort.map((v, i) => v - emaLong[i])
  const dea = ema(dif, signal)
  const macd = dif.map((v, i) => (v - dea[i]) * 2)
  return { dif, dea, macd }
}

function calcRSI(closes: number[], period: number): number[] {
  const result: number[] = []
  let avgGain = 0
  let avgLoss = 0

  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      result.push(NaN)
      continue
    }
    const change = closes[i] - closes[i - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? -change : 0

    if (i < period) {
      avgGain += gain
      avgLoss += loss
      if (i === period - 1) {
        avgGain /= period
        avgLoss /= period
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
        result.push(100 - 100 / (1 + rs))
      } else {
        result.push(NaN)
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period
      avgLoss = (avgLoss * (period - 1) + loss) / period
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
      result.push(100 - 100 / (1 + rs))
    }
  }
  return result
}

function calcBOLL(closes: number[], period: number = 20, multiplier: number = 2): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = sma(closes, period)
  const upper: number[] = []
  const lower: number[] = []

  for (let i = 0; i < closes.length; i++) {
    if (isNaN(middle[i])) {
      upper.push(NaN)
      lower.push(NaN)
    } else {
      let sumSqDiff = 0
      for (let j = i - period + 1; j <= i; j++) {
        sumSqDiff += (closes[j] - middle[i]) ** 2
      }
      const stdDev = Math.sqrt(sumSqDiff / period)
      upper.push(middle[i] + multiplier * stdDev)
      lower.push(middle[i] - multiplier * stdDev)
    }
  }
  return { upper, middle, lower }
}

function calcATR(kline: StockKlinePoint[], period: number = 14): number[] {
  const trueRange: number[] = []
  for (let i = 0; i < kline.length; i++) {
    if (i === 0) {
      trueRange.push(kline[i].high - kline[i].low)
    } else {
      const tr = Math.max(
        kline[i].high - kline[i].low,
        Math.abs(kline[i].high - kline[i - 1].close),
        Math.abs(kline[i].low - kline[i - 1].close)
      )
      trueRange.push(tr)
    }
  }
  return sma(trueRange, period)
}

function calcKDJ(kline: StockKlinePoint[], period: number = 9, k1: number = 3, k2: number = 3): { k: number[]; d: number[]; j: number[] } {
  const kArr: number[] = []
  const dArr: number[] = []
  const jArr: number[] = []
  let prevK = 50
  let prevD = 50

  for (let i = 0; i < kline.length; i++) {
    if (i < period - 1) {
      kArr.push(NaN)
      dArr.push(NaN)
      jArr.push(NaN)
      continue
    }
    let highest = -Infinity
    let lowest = Infinity
    for (let j = i - period + 1; j <= i; j++) {
      if (kline[j].high > highest) highest = kline[j].high
      if (kline[j].low < lowest) lowest = kline[j].low
    }
    const rsv = highest === lowest ? 50 : ((kline[i].close - lowest) / (highest - lowest)) * 100
    const k = (2 / k1) * prevK + (1 / k1) * rsv
    const d = (2 / k2) * prevD + (1 / k2) * k
    const j = 3 * k - 2 * d
    kArr.push(k)
    dArr.push(d)
    jArr.push(j)
    prevK = k
    prevD = d
  }
  return { k: kArr, d: dArr, j: jArr }
}

export function calculateTechnicalIndicators(kline: StockKlinePoint[]): TechnicalIndicators {
  const closes = kline.map(k => k.close)

  return {
    ma5: sma(closes, 5),
    ma10: sma(closes, 10),
    ma20: sma(closes, 20),
    ma60: sma(closes, 60),
    macd: calcMACD(closes),
    rsi: {
      rsi6: calcRSI(closes, 6),
      rsi12: calcRSI(closes, 12),
      rsi24: calcRSI(closes, 24),
    },
    boll: calcBOLL(closes),
    atr: calcATR(kline),
    kdj: calcKDJ(kline),
  }
}

/**
 * Format technical indicator summary for LLM prompt (last N values)
 */
export function formatTechnicalSummary(kline: StockKlinePoint[], indicators: TechnicalIndicators, lastN: number = 20): string {
  const len = kline.length
  const start = Math.max(0, len - lastN)
  const lines: string[] = []

  lines.push(`### 最近${Math.min(lastN, len)}个交易日K线和技术指标`)
  lines.push('日期 | 开盘 | 收盘 | 最高 | 最低 | 成交量(万手) | 涨跌幅% | MA5 | MA10 | MA20 | MACD | RSI6 | KDJ-K | KDJ-D')
  lines.push('---|---|---|---|---|---|---|---|---|---|---|---|---|---')

  for (let i = start; i < len; i++) {
    const k = kline[i]
    const ma5 = isNaN(indicators.ma5[i]) ? '-' : indicators.ma5[i].toFixed(2)
    const ma10 = isNaN(indicators.ma10[i]) ? '-' : indicators.ma10[i].toFixed(2)
    const ma20 = isNaN(indicators.ma20[i]) ? '-' : indicators.ma20[i].toFixed(2)
    const macd = isNaN(indicators.macd.macd[i]) ? '-' : indicators.macd.macd[i].toFixed(4)
    const rsi6 = isNaN(indicators.rsi.rsi6[i]) ? '-' : indicators.rsi.rsi6[i].toFixed(1)
    const kdjk = isNaN(indicators.kdj.k[i]) ? '-' : indicators.kdj.k[i].toFixed(1)
    const kdjd = isNaN(indicators.kdj.d[i]) ? '-' : indicators.kdj.d[i].toFixed(1)

    lines.push(`${k.date} | ${k.open.toFixed(2)} | ${k.close.toFixed(2)} | ${k.high.toFixed(2)} | ${k.low.toFixed(2)} | ${(k.volume / 10000).toFixed(1)} | ${k.change.toFixed(2)} | ${ma5} | ${ma10} | ${ma20} | ${macd} | ${rsi6} | ${kdjk} | ${kdjd}`)
  }

  // Current technical status
  const last = len - 1
  if (last >= 0) {
    const c = kline[last].close
    const ma5v = indicators.ma5[last]
    const ma20v = indicators.ma20[last]
    const rsi6v = indicators.rsi.rsi6[last]
    const macdv = indicators.macd.macd[last]
    const difv = indicators.macd.dif[last]
    const deav = indicators.macd.dea[last]
    const kv = indicators.kdj.k[last]
    const dv = indicators.kdj.d[last]
    const jv = indicators.kdj.j[last]
    const bollUp = indicators.boll.upper[last]
    const bollMid = indicators.boll.middle[last]
    const bollLow = indicators.boll.lower[last]
    const atrv = indicators.atr[last]

    lines.push('')
    lines.push('### 当前技术指标状态')
    lines.push(`- 当前价 ${c.toFixed(2)}，MA5=${isNaN(ma5v) ? '-' : ma5v.toFixed(2)}，MA20=${isNaN(ma20v) ? '-' : ma20v.toFixed(2)}`)
    if (!isNaN(ma5v) && !isNaN(ma20v)) {
      lines.push(`  - MA趋势：${c > ma5v ? '价格在MA5之上(偏多)' : '价格在MA5之下(偏空)'}，${ma5v > ma20v ? 'MA5>MA20(多头排列)' : 'MA5<MA20(空头排列)'}`)
    }
    if (!isNaN(difv)) {
      lines.push(`- MACD：DIF=${difv.toFixed(4)}，DEA=${deav.toFixed(4)}，MACD柱=${macdv.toFixed(4)}，${difv > deav ? '金叉(偏多)' : '死叉(偏空)'}`)
    }
    if (!isNaN(rsi6v)) {
      lines.push(`- RSI(6)：${rsi6v.toFixed(1)}，${rsi6v > 80 ? '超买区域' : rsi6v < 20 ? '超卖区域' : '正常区间'}`)
    }
    if (!isNaN(kv)) {
      lines.push(`- KDJ：K=${kv.toFixed(1)}，D=${dv.toFixed(1)}，J=${jv.toFixed(1)}`)
    }
    if (!isNaN(bollUp)) {
      lines.push(`- 布林带：上轨=${bollUp.toFixed(2)}，中轨=${bollMid.toFixed(2)}，下轨=${bollLow.toFixed(2)}`)
      lines.push(`  - ${c > bollUp ? '突破上轨(强势/注意回调)' : c < bollLow ? '跌破下轨(弱势/可能反弹)' : '在中轨附近运行'}`)
    }
    if (!isNaN(atrv)) {
      lines.push(`- ATR(14)：${atrv.toFixed(2)}（波动率参考）`)
    }
  }

  return lines.join('\n')
}
