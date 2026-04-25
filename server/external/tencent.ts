import axios from 'axios'

interface StockQuote {
  code: string
  changePercent: string
}

export async function getStockChangePercent(codes: string[]): Promise<Record<string, string>> {
  if (!codes || codes.length === 0) return {}

  const codeMapping: Record<string, string> = {}
  const tencentCodes = codes.map(code => {
    const c = code.trim()
    let tencentCode = ''
    if (c.length === 6 && /^\d{6}$/.test(c)) {
      const prefix = c.startsWith('6') || c.startsWith('9') ? 'sh' : 'sz'
      tencentCode = `s_${prefix}${c}`
    } else if (c.length === 5 && /^\d{5}$/.test(c)) {
      tencentCode = `s_hk${c}`
    } else {
      tencentCode = `s_sh${c}`
    }
    codeMapping[tencentCode] = c
    return tencentCode
  })

  try {
    const response = await axios.get(`https://qt.gtimg.cn/q=${tencentCodes.join(',')}`, {
      headers: { 'Referer': 'https://stockapp.finance.qq.com/' },
      timeout: 8000
    })

    const lines = response.data.split('\n')
    const result: Record<string, string> = {}

    for (const line of lines) {
      if (!line.includes('~')) continue
      const match = line.match(/v_(s_.+?)="(.+?)"/)
      if (!match) continue

      const tencentCode = match[1]
      const originalCode = codeMapping[tencentCode]
      if (!originalCode) continue

      const parts = match[2].split('~')
      if (parts.length > 5) {
        const changePercent = parseFloat(parts[5])
        if (!isNaN(changePercent)) {
          result[originalCode] = `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%`
        }
      }
    }

    for (const code of codes) {
      if (!result[code]) {
        result[code] = '-'
      }
    }

    return result
  } catch (error) {
    const result: Record<string, string> = {}
    codes.forEach(code => { result[code] = '-' })
    return result
  }
}
