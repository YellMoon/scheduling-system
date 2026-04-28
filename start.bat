@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   排课管理系统 v1.3
echo ========================================
echo.
echo 正在启动服务...
echo.

cd /d "%~dp0"

REM 启动 React 开发服务器
start http://localhost:3000
npm run dev

pause
