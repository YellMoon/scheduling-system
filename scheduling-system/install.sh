#!/bin/bash

echo "🚀 排课管理系统 - 安装脚本"
echo "=========================="

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未检测到 Node.js，请先安装 Node.js v18+"
    echo "下载地址：https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js 版本：$(node -v)"
echo "✅ npm 版本：$(npm -v)"

# 进入项目目录
cd "$(dirname "$0")"

# 安装依赖
echo ""
echo "📦 正在安装依赖..."
npm install

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 安装完成！"
    echo ""
    echo "运行方式："
    echo "  开发模式：npm run dev"
    echo "  生产构建：npm run build && npm run dist"
    echo ""
else
    echo "❌ 安装失败，请检查网络或手动运行 npm install"
    exit 1
fi
