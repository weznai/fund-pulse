-- ============================================================
-- 交易流水表 + 持仓总成本字段
-- 仅优化持仓收益率计算，不影响现有结算逻辑
-- ============================================================

-- 1. 新增交易流水表
CREATE TABLE IF NOT EXISTS user_fund_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  fund_code TEXT NOT NULL,
  fund_name TEXT,
  type TEXT NOT NULL CHECK(type IN ('buy', 'sell', 'migrate')),
  shares REAL NOT NULL,
  nav REAL NOT NULL,
  amount REAL NOT NULL,
  cost_price REAL NOT NULL,
  shares_before REAL NOT NULL DEFAULT 0,
  shares_after REAL NOT NULL DEFAULT 0,
  total_cost_before REAL NOT NULL DEFAULT 0,
  total_cost_after REAL NOT NULL DEFAULT 0,
  realized_profit REAL DEFAULT 0,
  transaction_date TEXT NOT NULL,
  remark TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON user_fund_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_fund ON user_fund_transactions (user_id, fund_code);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON user_fund_transactions (transaction_date);

-- 2. user_funds 新增 total_cost 字段
-- 存储真实投入总成本（用于精确计算持仓收益率）
-- 收益率 = (amount - total_cost) / total_cost
ALTER TABLE user_funds ADD COLUMN total_cost REAL NOT NULL DEFAULT 0;

-- 3. 迁移现有持仓数据：用现有 share * cost 推算 total_cost
-- 仅对有持仓（is_held=1 且有 share/cost 数据）的记录生成迁移交易流水
-- 无 total_cost 或 total_cost=0 的记录，用 share*cost 推算
UPDATE user_funds
SET total_cost = ROUND(share * cost, 2)
WHERE is_held = 1
  AND share > 0
  AND cost > 0
  AND total_cost = 0;
