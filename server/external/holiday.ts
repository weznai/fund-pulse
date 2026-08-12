import axios from 'axios'
import { logger } from '../logger.js'

const DATA_BASE = 'https://registry.npmmirror.com/chinese-days/latest/files/dist/years'

export interface CDNHolidayData {
  holidays?: Record<string, string>
  workdays?: Record<string, string>
  inLieuDays?: Record<string, string>
}

export interface ParsedHoliday {
  year: number
  date: string
  name: string
  type: 'holiday' | 'workday' | 'inLieuDay'
}

export async function fetchHolidaysFromCDN(year: number): Promise<CDNHolidayData | null> {
  try {
    const response = await axios.get(`${DATA_BASE}/${year}.json`, {
      timeout: 15000
    })
    return response.data
  } catch (error) {
    logger.error('Fetch holiday data failed for year ' + year + ':', error)
    return null
  }
}

export function parseCDNDataToHolidays(cdnData: CDNHolidayData | null, year: number): ParsedHoliday[] {
  const holidays: ParsedHoliday[] = []
  if (!cdnData || typeof cdnData !== 'object') return holidays

  const { holidays: holidayObj, workdays, inLieuDays } = cdnData

  if (holidayObj) {
    Object.entries(holidayObj).forEach(([date, value]) => {
      const [enName, cnName] = String(value).split(',')
      holidays.push({
        year,
        date,
        name: cnName || enName || '节假日',
        type: 'holiday'
      })
    })
  }

  if (workdays) {
    Object.entries(workdays).forEach(([date, value]) => {
      const [enName, cnName] = String(value).split(',')
      holidays.push({
        year,
        date,
        name: cnName || enName || '调休上班',
        type: 'workday'
      })
    })
  }

  if (inLieuDays) {
    Object.entries(inLieuDays).forEach(([date, value]) => {
      const [enName, cnName] = String(value).split(',')
      holidays.push({
        year,
        date,
        name: cnName || enName || '补休',
        type: 'inLieuDay'
      })
    })
  }

  return holidays.sort((a, b) => a.date.localeCompare(b.date))
}

export function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    holiday: '节假日',
    workday: '调休上班',
    inLieuDay: '补休'
  }
  return labels[type] || type
}

export function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    holiday: '#ef4444',
    workday: '#22c55e',
    inLieuDay: '#f59e0b'
  }
  return colors[type] || '#6b7280'
}
