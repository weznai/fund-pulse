// 节假日数据同步 CLI 脚本
// 用法：tsx server/service/syncHolidays.ts
// 功能：从 CDN 拉取节假日数据写入数据库，同步范围为去年到后年
// 适用于首次部署或数据修复，日常同步通过管理后台 API 操作
import '../db.js'
import { runSyncCli } from './holidayService.js'

runSyncCli()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Sync failed:', err)
    process.exit(1)
  })
