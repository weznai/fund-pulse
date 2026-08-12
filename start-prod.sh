#!/bin/bash
# 生产环境启动脚本 - Fund Pulse

# 进入脚本所在目录
cd "$(dirname "$0")"

# 加载 nvm 并切换到 Node v24
# better-sqlite3 原生模块按 v24 编译，系统默认 node 为 v20 会导致 ERR_DLOPEN_FAILED
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 24 >/dev/null 2>&1 || { echo "[$(date)] ❌ 无法切换到 Node v24（better-sqlite3 需要 v24），中止"; exit 1; }
echo "[$(date)] Node 版本: $(node -v)"

# 终止旧进程
echo "[$(date)] 正在终止占用端口 3010 的进程..."
kill $(lsof -t -i:3010) 2>/dev/null || echo "[$(date)] 无旧进程需要终止"

# 等待端口释放
sleep 1

# 构建前端
echo "[$(date)] 正在构建前端..."
npm run build

if [ $? -ne 0 ]; then
  echo "[$(date)] ❌ 构建失败，请检查错误"
  exit 1
fi

# 确保 out 目录存在
mkdir -p out

# 启动服务
echo "[$(date)] 正在启动生产服务..."
nohup npm run server > out/fund.log 2>&1 &

APP_PID=$!
echo $APP_PID > out/fund.pid

echo ""
echo "[$(date)] ✅ 生产服务已启动！"
echo ""
echo "📍 访问地址: http://localhost:3010"
echo "📍 进程 PID: $APP_PID"
echo "📍 日志文件: $(pwd)/out/fund.log"
echo "📍 PID 文件: $(pwd)/out/fund.pid"
echo ""
echo "💡 查看实时日志: tail -f out/fund.log"
echo "🛑 停止服务: kill \$(cat out/fund.pid)"
