/**
 * SEO 路由：SPA 服务端元信息注入 + robots.txt + sitemap.xml
 *
 * 背景：Vue SPA 直出 index.html 爬虫抓不到内容，文章页无独立 title/描述。
 * 方案：index.html 内置默认 title/description + <!--SEO_TAGS--> 标记位，本模块按请求动态
 * 替换 title/description 并在标记位注入 canonical/OG/验证码：
 *   - GET /news/:id   注入文章标题/摘要/canonical/OG（仅已发布文章）
 *   - GET /robots.txt 允许抓取，禁止 /admin 与 /api
 *   - GET /sitemap.xml 静态路由 + 全部已发布文章（含 lastmod）
 *   - 其余 SPA 兜底路由使用默认站点元信息
 *
 * 环境变量（可选，站长平台验证码）：
 *   SITE_URL           站点地址，默认 https://fund.wezin.cn
 *   SEO_BAIDU_TOKEN    百度站长平台验证码（content 值）
 *   SEO_GOOGLE_TOKEN   Google Search Console 验证码
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { Request, Response } from 'express'
import { getNewsById, getNewsList } from '../db/news.js'
import type { NewsArticle } from '../db/news.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, '..', 'dist')
const DIST_ZX = path.join(__dirname, '..', '..', 'dist-zx')
const SITE = (process.env.SITE_URL || 'https://fund.wezin.cn').replace(/\/$/, '')

const DEFAULTS = {
  title: 'Fund Pulse 基金脉搏 - 基金实时估值·持仓收益·每日财经速览',
  desc: '免费基金追踪工具：基金实时估值、持仓收益分析、收益日历、智能诊断；每日财经速览覆盖油价、美联储、A股/港股关键行情与市场逻辑。',
  url: SITE + '/',
  ogType: 'website'
}

const STATIC_ROUTES = ['/', '/suggestions', '/revenue-analysis', '/smart-analysis', '/news']

/** dist/index.html 模板缓存（按 mtime 失效，发布新前端后无需重启） */
let templateCache: { html: string; mtimeMs: number } | null = null

function loadTemplate(): string {
  const file = path.join(DIST, 'index.html')
  const mtimeMs = fs.statSync(file).mtimeMs
  if (!templateCache || templateCache.mtimeMs !== mtimeMs) {
    templateCache = { html: fs.readFileSync(file, 'utf8'), mtimeMs }
  }
  return templateCache.html
}

/** 属性值场景的最小转义（& < > "） */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function renderSeoHtml(opts: { title?: string; desc?: string; url?: string; ogType?: string } = {}): string {
  const title = esc(opts.title || DEFAULTS.title)
  const desc = esc(opts.desc || DEFAULTS.desc)
  const url = esc(opts.url || DEFAULTS.url)
  const ogType = opts.ogType || DEFAULTS.ogType

  const tags: string[] = [
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:site_name" content="Fund Pulse 基金脉搏" />`,
    `<meta property="og:type" content="${ogType}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${desc}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta name="twitter:card" content="summary" />`
  ]
  if (process.env.SEO_BAIDU_TOKEN) tags.push(`<meta name="baidu-site-verification" content="${esc(process.env.SEO_BAIDU_TOKEN)}" />`)
  if (process.env.SEO_GOOGLE_TOKEN) tags.push(`<meta name="google-site-verification" content="${esc(process.env.SEO_GOOGLE_TOKEN)}" />`)

  return loadTemplate()
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${desc}$2`)
    .replace('<!--SEO_TAGS-->', tags.join('\n    '))
}

/** XML 文本转义 */
function xmlEsc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function toIso(dt: string | null | undefined): string {
  return dt ? new Date(dt.replace(' ', 'T') + 'Z').toISOString() : new Date().toISOString()
}

function listPublished(): NewsArticle[] {
  const out: NewsArticle[] = []
  const pageSize = 100
  for (let page = 1; page <= 50; page++) {
    const { list, total } = getNewsList({ page, pageSize, status: 'published' })
    out.push(...(list as NewsArticle[]))
    if (out.length >= total) break
  }
  return out
}

export function setupSeoRoutes(app: import('express').Express): void {
  injectHomeSeoFiles()

  app.get('/robots.txt', (_req: Request, res: Response) => {
    res.type('text/plain').send(
      ['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /api/', `Sitemap: ${SITE}/sitemap.xml`].join('\n') + '\n'
    )
  })

  app.get('/sitemap.xml', (_req: Request, res: Response) => {
    const urls: string[] = []
    const today = new Date().toISOString().slice(0, 10)
    for (const r of STATIC_ROUTES) {
      urls.push(`  <url>\n    <loc>${SITE}${r === '/' ? '/' : r}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${r === '/news' ? 'hourly' : 'daily'}</changefreq>\n    <priority>${r === '/' ? '1.0' : '0.8'}</priority>\n  </url>`)
    }
    try {
      for (const a of listPublished()) {
        const lastmod = (a.updated_at || a.created_at || '').slice(0, 10) || today
        urls.push(`  <url>\n    <loc>${SITE}/news/${a.id}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`)
      }
    } catch (e) {
      // sitemap 静态部分兜底输出
    }
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
    res.type('application/xml').send(xml)
  })

  /** 文章直链：注入该文章的 title/description/OG（不增加阅读数，页面挂载后由 /api/news/:id 计数） */
  app.get('/news/:id(\\d+)', (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10)
    let article: NewsArticle | undefined
    try {
      article = getNewsById(id, { publishedOnly: true })
    } catch {
      article = undefined
    }
    if (!article) return res.status(404).send(renderSeoHtml())
    const html = renderSeoHtml({
      title: `${article.title} - 资讯 - Fund Pulse`,
      desc: article.summary || `${article.title} - Fund Pulse 资讯`,
      url: `${SITE}/news/${id}`,
      ogType: 'article'
    })
    res.type('html').send(html)
  })
}

/**
 * 首页 SEO 正文注入
 *
 * SPA 首页对爬虫是空壳（<div id="app"></div>）。把站点简介 + 功能 + 最新速览内链
 * 写入 dist/index.html 与 dist-zx/index.html 的 #app 内部：爬虫可抓到真实内容与
 * 文章内链；浏览器端 Vue 挂载后整块被替换，用户无感知。
 * 幂等：以 <!--HOME_SEO_START/END--> 标记包裹，重复执行先剥离旧块。
 * 触发：服务启动时 + 资讯增删改/上下架后（见 routes/news.ts 调用）。
 */
function buildHomeSeoBlock(): string {
  const feats = [
    '基金实时估值：盘中多源估值刷新，涨跌一目了然',
    '持仓收益分析：收益日历、分时走势、收益归因',
    '智能诊断：AI 分析基金持仓与市场关联',
    '每日速览：油价、美联储、A股/港股关键行情与市场逻辑'
  ]
  let newsItems = ''
  try {
    const arts = listPublished().slice(0, 6)
    newsItems =
      '\n    <h2>最新每日速览</h2>\n    <ul>' +
      arts
        .map(a => `\n      <li><a href="${SITE}/news/${a.id}">${xmlEsc(a.title)}</a>（${(a.created_at || '').slice(0, 10)}）</li>`)
        .join('') +
      '\n    </ul>'
  } catch {
    newsItems = ''
  }

  return `<!--HOME_SEO_START--><div style="max-width:960px;margin:0 auto;padding:48px 20px;font-family:system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#1f2933;">
    <h1 style="font-size:24px;margin:0 0 12px;">Fund Pulse 基金脉搏 — 基金实时估值与每日财经速览</h1>
    <p style="margin:0 0 20px;line-height:1.8;">免费的基金追踪工具：基金实时估值、持仓收益分析、收益日历、智能诊断；每日速览覆盖油价、美联储政策、A股/港股关键行情与市场逻辑，助力基金投资决策。</p>${newsItems}
    <h2 style="font-size:17px;margin:24px 0 8px;">主要功能</h2>
    <ul style="line-height:1.9;">
${feats.map(f => `      <li>${f}</li>`).join('\n')}
    </ul>
  </div><!--HOME_SEO_END-->`
}

export function injectHomeSeoFiles(): void {
  const block = buildHomeSeoBlock()
  for (const file of [path.join(DIST, 'index.html'), path.join(DIST_ZX, 'index.html')]) {
    try {
      if (!fs.existsSync(file)) continue
      let html = fs.readFileSync(file, 'utf8')
      html = html.replace(/<!--HOME_SEO_START-->[\s\S]*?<!--HOME_SEO_END-->/, '')
      if (html.includes('<div id="app">')) {
        html = html.replace('<div id="app">', `<div id="app">${block}`)
        fs.writeFileSync(file, html)
      }
    } catch (e) {
      // 注入失败不影响服务
    }
  }
}
