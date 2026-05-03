-- ============================================================
-- Fund Pulse Database DDL
-- Database: fund-data.db (SQLite)
-- Generated from live database schema
-- ============================================================

-- -----------------------------------------------------------
-- Table: users
-- 用户表
-- -----------------------------------------------------------
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  password TEXT,
  type TEXT NOT NULL,
  label TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_active INTEGER NOT NULL
);
CREATE INDEX idx_users_type ON users (type);
CREATE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_email ON users (email);

-- -----------------------------------------------------------
-- Table: email_otps
-- 邮箱验证码表
-- -----------------------------------------------------------
CREATE TABLE email_otps (
  email TEXT PRIMARY KEY,
  otp TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_email_otps_expires ON email_otps (expires_at);

-- -----------------------------------------------------------
-- Table: user_preferences
-- 用户偏好设置表
-- -----------------------------------------------------------
CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY,
  favorite_funds TEXT NOT NULL DEFAULT '[]',
  held_funds TEXT NOT NULL DEFAULT '[]',
  hide_amount INTEGER NOT NULL DEFAULT 0,
  view_mode TEXT NOT NULL DEFAULT 'list',
  sort_field TEXT NOT NULL DEFAULT 'dayGrowth',
  sort_direction TEXT NOT NULL DEFAULT 'desc',
  filter_mode TEXT NOT NULL DEFAULT 'all',
  migrated_from_local INTEGER NOT NULL DEFAULT 0,
  last_updated INTEGER NOT NULL,
  default_funds_imported INTEGER NOT NULL DEFAULT 0
);

-- -----------------------------------------------------------
-- Table: user_funds
-- 用户持仓基金表
-- status: 'a' = Active, 'd' = Deleted (软删除)
-- -----------------------------------------------------------
CREATE TABLE user_funds (
  user_id TEXT NOT NULL,
  fund_code TEXT NOT NULL,
  fund_name TEXT,
  is_held INTEGER NOT NULL DEFAULT 0,
  share REAL NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0,
  total_cost REAL NOT NULL DEFAULT 0,
  holding_date TEXT,
  settled INTEGER NOT NULL DEFAULT 0,
  last_settled_date TEXT,
  accumulated_profit REAL NOT NULL DEFAULT 0,
  current_day_profit REAL NOT NULL DEFAULT 0,
  current_day_profit_rate REAL NOT NULL DEFAULT 0,
  profit_type TEXT NOT NULL DEFAULT 'estimate',
  last_profit_date TEXT,
  added_at INTEGER NOT NULL,
  status VARCHAR(1) NOT NULL DEFAULT 'a',
  PRIMARY KEY (user_id, fund_code)
);
CREATE INDEX idx_user_funds_user ON user_funds (user_id);
CREATE INDEX idx_user_funds_held ON user_funds (user_id, is_held);

-- -----------------------------------------------------------
-- Table: user_fund_transactions
-- 用户基金交易流水表（加仓/减仓/迁移）
-- -----------------------------------------------------------
CREATE TABLE user_fund_transactions (
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
CREATE INDEX idx_transactions_user ON user_fund_transactions (user_id);
CREATE INDEX idx_transactions_fund ON user_fund_transactions (user_id, fund_code);
CREATE INDEX idx_transactions_date ON user_fund_transactions (transaction_date);

-- -----------------------------------------------------------
-- Table: user_funds_profit_history
-- 用户基金收益历史表
-- -----------------------------------------------------------
CREATE TABLE user_funds_profit_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  fund_code TEXT NOT NULL,
  fund_name TEXT NOT NULL,
  profit_date TEXT NOT NULL,
  opening_amount REAL NOT NULL,
  closing_amount REAL NOT NULL,
  day_profit REAL NOT NULL,
  day_profit_rate REAL NOT NULL,
  profit_type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  nav REAL,
  day_growth REAL,
  UNIQUE (user_id, fund_code, profit_date, profit_type)
);

-- -----------------------------------------------------------
-- Table: user_daily_profit
-- 用户每日分时收益快照表
-- -----------------------------------------------------------
CREATE TABLE user_daily_profit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  profit_date TEXT NOT NULL,
  opening_amount REAL NOT NULL DEFAULT 0,
  time_profit_data TEXT,
  final_rate REAL,
  final_profit REAL,
  final_amount REAL,
  settled INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (user_id, profit_date)
);
CREATE INDEX idx_user_daily_profit_user ON user_daily_profit (user_id);
CREATE INDEX idx_user_daily_profit_date ON user_daily_profit (profit_date);

-- -----------------------------------------------------------
-- Table: fund_cache
-- 基金数据缓存表
-- -----------------------------------------------------------
CREATE TABLE fund_cache (
  code TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- -----------------------------------------------------------
-- Table: fund_info
-- 基金基本信息表
-- -----------------------------------------------------------
CREATE TABLE fund_info (
  code VARCHAR(20) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  pinyin VARCHAR(50),
  ftype VARCHAR(50),
  fund_company VARCHAR(100),
  fund_manager VARCHAR(50),
  establish_date DATE,
  fund_scale DECIMAL(18, 2),
  benchmark VARCHAR(200),
  status VARCHAR(20) DEFAULT 'active',
  is_recommend TINYINT DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX idx_fund_info_ftype ON fund_info (ftype);
CREATE INDEX idx_fund_info_company ON fund_info (fund_company);
CREATE INDEX idx_fund_info_recommend ON fund_info (is_recommend);

-- -----------------------------------------------------------
-- Table: fund_time_trend
-- 基金分时走势数据表
-- -----------------------------------------------------------
CREATE TABLE fund_time_trend (
  code TEXT NOT NULL,
  date TEXT NOT NULL,
  data TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  day_growth REAL,
  nav REAL,
  gsz REAL,
  gszzl REAL,
  is_updated INTEGER DEFAULT 0,
  is_trading_day INTEGER DEFAULT 1,
  settlement_status INTEGER DEFAULT 0,
  settlement_time TEXT,
  PRIMARY KEY (code, date)
);
CREATE INDEX idx_fund_time_trend_date ON fund_time_trend (date);
CREATE INDEX idx_fund_time_trend_timestamp ON fund_time_trend (timestamp);

-- -----------------------------------------------------------
-- Table: stock_time_trend
-- 股票指数分时走势数据表
-- -----------------------------------------------------------
CREATE TABLE stock_time_trend (
  code TEXT NOT NULL,
  date TEXT NOT NULL,
  data TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  day_growth REAL,
  price REAL,
  is_trading_day INTEGER DEFAULT 1,
  PRIMARY KEY (code, date)
);
CREATE INDEX idx_stock_time_trend_date ON stock_time_trend (date);
CREATE INDEX idx_stock_time_trend_timestamp ON stock_time_trend (timestamp);

-- -----------------------------------------------------------
-- Table: fund_tasks
-- 基金任务表（结算任务等）
-- -----------------------------------------------------------
CREATE TABLE fund_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_name TEXT NOT NULL,
  task_type TEXT NOT NULL DEFAULT 'settlement',
  task_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  start_time INTEGER,
  end_time INTEGER,
  description TEXT,
  execute_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- -----------------------------------------------------------
-- Table: holidays
-- 节假日表
-- -----------------------------------------------------------
CREATE TABLE holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  date TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_holidays_year ON holidays (year);
CREATE INDEX idx_holidays_date ON holidays (date);

-- -----------------------------------------------------------
-- Table: biz_system
-- 系统信息表
-- -----------------------------------------------------------
CREATE TABLE biz_system (
  name TEXT PRIMARY KEY,
  last_trading_day TEXT,
  trading_day TEXT,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO biz_system (name, last_trading_day, trading_day, updated_at) VALUES ('fund', '', '', 0);

-- -----------------------------------------------------------
-- Table: system_params
-- 系统参数表
-- -----------------------------------------------------------
CREATE TABLE system_params (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  remark TEXT
);

INSERT OR IGNORE INTO system_params (key, value, remark) VALUES ('delete_visit_ip', '', '清理指定IP的访问记录，多个IP用逗号、竖线或Tab分隔');
INSERT OR IGNORE INTO system_params (key, value, remark) VALUES ('delete_visit_user', 'heny', '清理指定用户的访问记录，多个用户名用逗号、竖线或Tab分隔');

-- -----------------------------------------------------------
-- Table: visit_logs
-- 访问日志表
-- -----------------------------------------------------------
CREATE TABLE visit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  path TEXT,
  user_agent TEXT,
  referer TEXT,
  user_id TEXT,
  visit_date TEXT NOT NULL,
  visit_time INTEGER NOT NULL,
  req_source TEXT
);
CREATE INDEX idx_visit_logs_date ON visit_logs (visit_date);
CREATE INDEX idx_visit_logs_ip ON visit_logs (ip);
CREATE INDEX idx_visit_logs_user ON visit_logs (user_id);
