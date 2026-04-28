@echo off
echo.
echo ========================================
echo   排课管理系统 v1.2 - 安装脚本
echo ========================================
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found
    echo Please install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
for /f "tokens=*" %%i in ('npm -v') do set NPM_VER=%%i

echo [OK] Node.js: %NODE_VER%
echo [OK] npm: %NPM_VER%
echo.
echo Installing dependencies, please wait...
echo.

cd /d "%~dp0"
npm install --legacy-peer-deps

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   Installation Complete!
    echo ========================================
    echo.
    echo Start commands:
    echo   Development: npm run dev
    echo   Build EXE:   build.bat
    echo.
) else (
    echo.
    echo [ERROR] Installation failed
    echo Please check network connection
    echo.
)

pause
