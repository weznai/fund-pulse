import fs from 'node:fs'
import path from 'node:path'
import util from 'node:util'
import { fileURLToPath } from 'node:url'

const timestamp = () => `[${new Date().toLocaleString()}]`

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const logDir = path.resolve(__dirname, '..', 'logs')
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })

const logStream = fs.createWriteStream(path.join(logDir, 'funds.log'), { flags: 'a' })
logStream.on('error', (err) => console.error('日志文件写入失败:', err))

const toFile = (level: string, args: unknown[]) => {
  logStream.write(`${timestamp()} [${level}] ${util.format(...args)}\n`)
}

export const logger = {
  log: (...args: unknown[]) => { console.log(timestamp(), ...args); toFile('LOG', args) },
  error: (...args: unknown[]) => { console.error(timestamp(), ...args); toFile('ERROR', args) },
  warn: (...args: unknown[]) => { console.warn(timestamp(), ...args); toFile('WARN', args) },
  info: (...args: unknown[]) => { console.info(timestamp(), ...args); toFile('INFO', args) },
}
