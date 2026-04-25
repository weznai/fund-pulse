# SQL 注入防护指南

## 概述

本项目已实施多层 SQL 注入防护措施，确保数据库安全。

## 飘�层防护

### 1. 输入验证中间件 (Input Sanitizer)
**位置**: `server/middleware/inputSanitizer.ts`

**功能**:
- 自动检测请求体中的 SQL 注入尝试
- 记录可疑请求日志
- 拒绝包含危险模式的请求

**使用**:
```typescript
import { inputSanitizer } from './middleware/inputSanitizer.js'

app.use(inputSanitizer)
```

### 2. SQL 注入检测工具 (sqlSecurity.ts)
**位置**: `server/utils/sqlSecurity.ts`

**API**:
```typescript
// 检测输入是否包含 SQL 注入
detectSqlInjection(input: string): { isSafe: boolean; patterns: string[] }

// 验证字段名
validateFieldName(fieldName: string): boolean

// 验证表名
validateTableName(tableName: string): boolean

// 验证数字范围
validateNumber(value: any, min?: number, max?: number): number

// 验证分页参数
validatePagination(page?: any, pageSize?: any): { page: number; pageSize: number; offset: number }
```

## 数据访问层防护

### SafeQueryBuilder

**安全的查询构建器**，自动使用参数化查询：

```typescript
import { SafeQueryBuilder } from '../utils/sqlSecurity.js'

// 构建安全的 SELECT 查询
const builder = new SafeQueryBuilder('fund_info')
  .where('code', 'LIKE', '%000001%')
  .where('is_recommend', '=', 1)
  .orderBy('updated_at', 'DESC')
  .limit(20)
  .offset(0)

const { sql, params } = builder.buildSelect(['code', 'name', 'ftype'])
const results = db.prepare(sql).all(...params)
```

### 使用示例

#### 之前的代码（仍然安全）:
```typescript
let whereClause = '1=1'
const params: any[] = []

if (options.keyword) {
  whereClause += ' AND (code LIKE ? OR name LIKE ?)'
  params.push(`%${options.keyword}%`, `%${options.keyword}%`)
}

const sql = `SELECT * FROM fund_info WHERE ${whereClause}`
const results = db.prepare(sql).all(...params)
```

#### 推荐的代码（更安全、更清晰）:
```typescript
const builder = new SafeQueryBuilder('fund_info')

if (options.keyword) {
  builder
    .where('code', 'LIKE', `%${options.keyword}%`)
    .where('name', 'LIKE', `%${options.keyword}%`, 'OR')
}

const { sql, params } = builder.buildSelect(['*'])
const results = db.prepare(sql).all(...params)
```

## 最佳实践

### ✅ DO（应该做的）

1. **始终使用参数化查询**
```typescript
// ✅ 正确
const stmt = db.prepare('SELECT * FROM users WHERE id = ?')
const user = stmt.get(userId)

// ❌ 错误
const stmt = db.prepare(`SELECT * FROM users WHERE id = ${userId}`)
```

2. **验证用户输入**
```typescript
import { validateNumber, validateFieldName } from '../utils/sqlSecurity.js'

// 验证分页参数
const { page, pageSize, offset } = validatePagination(req.query.page, req.query.pageSize)

// 验证字段名
if (!validateFieldName(sortField)) {
  throw new Error('Invalid field name')
}
```

3. **使用 SafeQueryBuilder 构建动态查询**
```typescript
const builder = new SafeQueryBuilder('users')

if (status) {
  builder.where('status', '=', status)
}

const { sql, params } = builder.buildSelect(['id', 'name', 'email'])
```

4. **限制查询结果数量**
```typescript
const builder = new SafeQueryBuilder('fund_info')
  .limit(100)  // 限制最大返回 100 条
```

### ❌ DON'T（不应该做的）

1. **不要拼接用户输入到 SQL**
```typescript
// ❌ 危险
const sql = `SELECT * FROM ${tableName} WHERE ${fieldName} = '${value}'`

// ✅ 安全
const builder = new SafeQueryBuilder(validateTableName(tableName))
builder.where(validateFieldName(fieldName), '=', value)
```

2. **不要信任任何用户输入**
```typescript
// ❌ 危险
const userId = req.query.id  // 未验证

// ✅ 安全
const userId = validateNumber(req.query.id, 1, Number.MAX_SAFE_INTEGER)
```

3. **不要忽略错误处理**
```typescript
// ❌ 不好
try {
  const result = stmt.run(...)
} catch (e) {
  // 忽略错误
}

// ✅ 好
try {
  const result = stmt.run(...)
} catch (e) {
  logger.error('Database error:', e)
  throw new DatabaseError('操作失败')
}
```

## 测试

运行安全测试：
```bash
npm test -- sqlSecurity.test.ts
```

## 迁移指南

### 步骤 1: 添加中间件
在 `server/index.ts` 中：
```typescript
import { inputSanitizer } from './middleware/inputSanitizer.js'

// 在路由之前添加
app.use(inputSanitizer)
```

### 步骤 2: 逐步迁移现有代码
优先级：
1. **P0**: 所有接受用户输入的查询（搜索、过滤）
2. **P1**: 管理后台的动态查询
3. **P2**: 其他内部查询

### 步骤 3: 添加单元测试
为所有数据库操作添加安全测试。

## 监控和审计

### 日志记录
所有 SQL 查询都会在开发环境中记录：
```
[SQL] SELECT * FROM users WHERE id = ? [123] userId: user123
```

### 异常报告
检测到 SQL 注入尝试时，会记录详细日志：
```
⚠️ SQL Injection detected from IP 192.168.1.100: "1' OR '1'='1"
```

## 参考资料

- [OWASP SQL Injection](https://owasp.org/www-community/attacks/SQL_Injection)
- [SQLite Security Best Practices](https://www.sqlite.org/security.html)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
