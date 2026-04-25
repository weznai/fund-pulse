import express from 'express'

export interface ReqSource {
  ts: string
  ip: string
  ua: string
  device: string
  os: string
  browser: string
  path: string
  referer: string
  lang: string
  method: string
}

export function parseUserAgent(ua: string, ip: string, req: express.Request): ReqSource {
  let device = 'unknown'
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    device = 'mobile'
  } else if (/tablet|ipad|playbook|silk/i.test(ua)) {
    device = 'tablet'
  } else if (/bot|crawl|spider|scraper/i.test(ua)) {
    device = 'bot'
  } else {
    device = 'pc'
  }

  let os = 'unknown'
  if (/windows nt 10/i.test(ua)) os = 'Windows 10'
  else if (/windows nt 6\.3/i.test(ua)) os = 'Windows 8.1'
  else if (/windows nt 6\.2/i.test(ua)) os = 'Windows 8'
  else if (/windows nt 6\.1/i.test(ua)) os = 'Windows 7'
  else if (/windows/i.test(ua)) os = 'Windows'
  else if (/mac os x/i.test(ua)) os = 'macOS'
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS'
  else if (/android/i.test(ua)) os = 'Android'
  else if (/linux/i.test(ua)) os = 'Linux'
  else if (/ubuntu/i.test(ua)) os = 'Ubuntu'

  let browser = 'unknown'
  if (/edg\//i.test(ua)) browser = 'Edge'
  else if (/opr\//i.test(ua)) browser = 'Opera'
  else if (/chrome/i.test(ua) && !/chromium/i.test(ua)) browser = 'Chrome'
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari'
  else if (/firefox/i.test(ua)) browser = 'Firefox'
  else if (/msie|trident/i.test(ua)) browser = 'IE'
  else if (/micromessenger/i.test(ua)) browser = 'WeChat'
  else if (/qq\//i.test(ua)) browser = 'QQ'
  else if (/weibo/i.test(ua)) browser = 'Weibo'

  return {
    ts: new Date().toISOString(),
    ip: ip,
    ua: ua.substring(0, 500),
    device,
    os,
    browser,
    path: req.path || '/',
    referer: String(req.headers.referer || req.headers.referrer || '').substring(0, 500),
    lang: String(req.headers['accept-language'] || '').substring(0, 100),
    method: req.method
  }
}

export function getClientIp(req: express.Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] as string ||
         req.connection?.remoteAddress ||
         'unknown'
}
