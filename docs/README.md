<div align="center">

# 💰 Fund Pulse

**基金实时跟踪系统**

一款简洁高效的基金管理工具，实时追踪你的投资组合

[![Vue.js](https://img.shields.io/badge/Vue.js-3.x-4FC08D?style=flat-square&logo=vue.js&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://www.sqlite.org/)

[快速开始](#-快速开始) · [功能特性](#-功能特性)

</div>

---

## ✨ 功能特性

### 用户功能
- 🔍 **基金搜索** - 支持按基金代码或名称快速搜索
- ⭐ **自选管理** - 添加和管理自选基金列表
- 📊 **实时估值** - 查看基金净值、涨跌幅、分时走势
- 💼 **持仓管理** - 管理持仓份额、成本、收益
- 📈 **收益统计** - 每日收益记录和统计
- 👤 **用户系统** - 邮箱验证码登录注册
- 📱 **响应式设计** - 完美支持移动端和桌面端

---

## 🛠️ 技术栈

| 技术 | 说明 |
|------|------|
| Vue 3 | 渐进式 JavaScript 框架 |
| TypeScript | 类型安全的 JavaScript 超集 |
| Vite | 下一代前端构建工具 |
| Vue Router | 官方路由管理器 |
| Pinia | Vue 状态管理库 |
| Express | Node.js Web 框架 |
| SQLite | 轻量级数据库 |
| ECharts | 图表可视化 |

---

## 📦 数据源

- 东方财富 - 提供基金搜索、详情、估值等数据

---

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev:full
```

- 前端: http://localhost:5173
- 后端: http://localhost:3010

### 构建生产版本

```bash
npm run build
```

### 生产部署

```bash
npm run server
```

服务器运行在 http://localhost:3010

**推荐使用 PM2：**

```bash
pm2 start "tsx server.ts" --name fund-pulse
```

---

## 📁 项目结构

```
fund-pulse/
├ public/                # 静态资源
├ src/
│   ├── api/             # API 接口
│   ├── components/      # 组件
│   ├── composables/     # 组合式函数
│   ├── config/          # 配置文件
│   ├── router/          # 路由配置
│   ├── stores/          # Pinia 状态管理
│   ├── types/           # TypeScript 类型
│   ├── views/           # 页面视图
│   │   ├── HomeView.vue       # 首页
│   │   └── FundDetailView.vue # 基金详情
│   │   
│   ├── App.vue
│   └── main.ts
├ db/                    # 数据库相关
├ server.ts              # Express 服务器
├ db.ts                  # 数据库操作
├ emailService.ts        # 邮件服务
└ vite.config.ts         # Vite 配置
```

---

## ⚙️ 配置说明

### 邮件服务

系统使用邮箱验证码登录，需配置邮件服务：

在数据库 `system_params` 表中设置：
- `email_user`: 发件邮箱地址
- `email_pass`: 邮箱授权码


---

## ⚠️ 注意事项

- 📈 基金数据仅供参考，不构成投资建议
- 🔐 生产环境请修改默认端口和密钥
- 💾 数据存储在 SQLite 数据库，请定期备份

---

## 📄 License

[MIT](LICENSE) © 2024

---

<div align="center">

如果这个项目对你有帮助，欢迎 ⭐ Star 支持！

</div>
