# Server 架构说明

## 目录结构

```
server/
├── config/           # 配置管理
│   └── index.ts      # 应用配置（端口、CORS等）
│
├── db/               # 数据访问层
│   ├── connection.ts # 数据库连接和基础工具
│   ├── repositories.ts # Repository 模式封装
│   ├── auth.ts       # 认证相关数据操作
│   ├── user.ts       # 用户数据操作
│   ├── userFund.ts   # 用户基金数据操作
│   ├── fundInfo.ts   # 基金信息数据操作
│   ├── cache.ts      # 缓存数据操作
│   └── ...           # 其他数据表操作
│
├── routes/           # 路由层（包含控制器逻辑）
│   ├── auth.ts       # 认证路由
│   ├── user.ts       # 用户相关路由
│   ├── fund.ts       # 基金数据路由
│   ├── holdings.ts   # 持仓路由
│   ├── admin.ts      # 管理员路由
│   └── ...           # 其他路由
│
├── services/         # 业务逻辑层
│   ├── auth.ts       # 认证业务逻辑
│   ├── fundService.ts # 基金业务逻辑（合并后）
│   ├── holidayService.ts # 节假日服务
│   ├── password.ts   # 密码处理
│   └── ...           # 其他服务
│
├── middleware/       # 中间件
│   ├── auth.ts       # 认证中间件
│   ├── errorHandler.ts # 错误处理
│   ├── validation.ts # 输入验证
│   └── ...           # 其他中间件
│
├── scheduled/        # 定时任务
│   ├── settlement.ts # 结算任务
│   └── estimate.ts   # 估值任务
│
├── external/         # 外部API集成
│   ├── eastmoney.ts  # 东方财富API
│   └── holiday.ts    # 节假日API
│
├── utils/            # 工具函数
│   ├── response.ts   # 响应格式化
│   ├── errors.ts     # 自定义错误类
│   └── sanitizer.ts  # 输入清理
│
├── types/            # TypeScript 类型定义
│   └── index.ts      # 全局类型
│
├── index.ts          # 应用入口
└── logger.ts         # 日志工具
```

## 架构层次

### 1. 路由层 (Routes)
**职责**: 处理 HTTP 请求，参数验证，调用服务层，返回响应

```typescript
// routes/auth.ts
router.post('/login', async (req, res) => {
  const { identifier, password } = req.body
  const user = await authService.login(identifier, password)
  res.json({ success: true, user })
})
```

### 2. 服务层 (Services)
**职责**: 实现业务逻辑，调用数据访问层

```typescript
// services/auth.ts
class AuthService {
  async login(identifier: string, password: string): Promise<User> {
    const user = userRepository.findByUsernameOrEmail(identifier)
    // 业务逻辑验证
    return user
  }
}
```

### 3. 数据访问层 (DB + Repositories)
**职责**: 封装数据库操作，提供类型安全的接口

```typescript
// db/repositories.ts
class UserRepository extends BaseRepository {
  findByUsernameOrEmail(identifier: string): User | undefined {
    return this.db.prepare('SELECT * FROM users WHERE username = ? OR email = ?')
      .get(identifier, identifier)
  }
}
```

## 数据流

```
HTTP Request
    ↓
Middleware (认证、验证、限流)
    ↓
Routes (路由分发)
    ↓
Services (业务逻辑)
    ↓
Repositories (数据访问)
    ↓
Database (SQLite)
    ↓
Response
```

## 主要改进

### 1. 扁平化三层结构
- **之前**: Controller → Service → Repository → DB (4层)
- **现在**: Routes → Service → DB (3层，Repository 合并到 DB)

### 2. 合并重复代码
- 删除 `controllers/` 目录，合并到 `routes/`
- 删除 `repositories/` 目录，合并到 `db/repositories.ts`
- 合并 `services/fund.ts` 和 `services/fundService.ts`

### 3. 统一导入路径
所有 Repository 从 `db/index.ts` 导出：
```typescript
import { userRepository, userFundRepository } from '../db/index.js'
```

## 文件命名规范

- **路由文件**: 小写，对应资源名 (如 `auth.ts`, `user.ts`)
- **服务文件**: 驼峰，以 Service 结尾 (如 `fundService.ts`)
- **数据库文件**: 小写，对应表名 (如 `userFund.ts`)
- **中间件文件**: 小写，描述功能 (如 `errorHandler.ts`)

## 最佳实践

1. **单一职责**: 每个文件只负责一个功能模块
2. **依赖注入**: 服务类通过构造函数注入依赖
3. **错误处理**: 使用统一的错误类和中间件
4. **类型安全**: 充分利用 TypeScript 类型系统
5. **注释清晰**: 每个模块顶部添加职责说明
