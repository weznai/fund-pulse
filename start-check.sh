#!/bin/bash

echo "[$(date)] 🔍 正在检测 fund-pulse 服务状态..."

# 1. 检查 PID 文件是否存在
if [ ! -f fund.pid ]; then
  echo "❌ fund.pid 不存在，服务可能未启动"
  exit 1
fi

PID=$(cat fund.pid)
if ! kill -0 $PID 2>/dev/null; then
  echo "❌ 进程 PID $PID 已不存在（可能崩溃）"
  rm -f fund.pid
  exit 1
fi

echo "✅ 主进程运行中 (PID: $PID)"

# 2. 检查端口 5173（Vite 前端）
if ss -tuln | grep -q ':5173\b'; then
  echo "✅ 前端服务监听中: http://localhost:5173"
else
  echo "❌ 前端端口 5173 未监听！检查 fund.log 错误"
  exit 1
fi

# 3. 检查端口 3010（后端代理）
if ss -tuln | grep -q ':3010\b'; then
  echo "✅ 后端代理监听中: http://localhost:3010"
else
  echo "❌ 后端端口 3010 未监听！检查 fund.log 错误"
  exit 1
fi

# 4. （可选）尝试访问 API 测试连通性
echo "📡 正在测试后端 API 响应..."
if curl -s --connect-timeout 3 http://localhost:3010/api/eastmoney/FundDetail.ashx?FCODE=000001 | grep -q '"FCODE"'; then
  echo "✅ API 返回正常，服务完全就绪！"
else
  echo "⚠️ API 无响应或返回异常（可能是启动中或配置问题）"
fi

echo "🎉 所有检测通过！服务运行正常。"