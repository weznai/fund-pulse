// PM2 进程管理配置 — Fund Pulse
//
// 常用命令:
//   pm2 start ecosystem.config.cjs     # 启动
//   pm2 restart fund-pulse              # 重启（管理后台"系统更新"也会调用）
//   pm2 stop fund-pulse                 # 停止
//   pm2 logs fund-pulse                 # 查看日志
//   pm2 status                          # 查看状态
//
// 开机自启 (Linux):
//   pm2 startup                         # 按提示执行返回的那条命令
//   pm2 save                            # 保存当前进程列表
//
// 说明: 后端使用 tsx 直接运行 TypeScript (server/index.ts)。
// 通过 `node --import tsx` 让 Node 加载 tsx 的 loader (需 tsx >= 4.7)。

module.exports = {
  apps: [
    {
      name: 'fund-pulse',
      script: 'server/index.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      max_memory_restart: '1G',
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
}
