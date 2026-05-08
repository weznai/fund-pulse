import '../db.js'
import { initHolidaysTable, upsertHolidays, getHolidayStats } from '../db/holiday.js'
import { fetchHolidaysFromCDN, parseCDNDataToHolidays } from '../external/holiday.js'

async function syncHolidays() {
  console.log('Initializing holidays table...')
  initHolidaysTable()

  const currentYear = new Date().getFullYear()
  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2]

  console.log('Syncing holidays for years:', years.join(', '))

  let totalCount = 0
  const errors: string[] = []

  for (const year of years) {
    try {
      console.log(`\nFetching ${year}...`)
      const cdnData = await fetchHolidaysFromCDN(year)
      if (!cdnData) {
        errors.push(`${year}: fetch failed`)
        console.error(`  Failed to fetch ${year}`)
        continue
      }

      const holidays = parseCDNDataToHolidays(cdnData, year)
      if (holidays.length === 0) {
        errors.push(`${year}: parse failed`)
        console.error(`  Failed to parse ${year}`)
        continue
      }

      const count = upsertHolidays(holidays)
      totalCount += count
      console.log(`  Synced ${count} records for ${year}`)
    } catch (e: any) {
      errors.push(`${year}: ${e.message}`)
      console.error(`  Error: ${e.message}`)
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Total synced: ${totalCount} records`)
  if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`)
    errors.forEach(e => console.log(`  - ${e}`))
  }

  console.log('\n=== Current Stats ===')
  const stats = getHolidayStats()
  console.table(stats)

  process.exit(0)
}

syncHolidays().catch(err => {
  console.error('Sync failed:', err)
  process.exit(1)
})
