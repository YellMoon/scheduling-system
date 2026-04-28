@echo off
echo.
echo ========================================
echo   Scheduling System v1.2 - Build Script
echo ========================================
echo.

REM Set Electron mirror to Taobao (faster in China)
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_CUSTOM_HOST=https://npmmirror.com/mirrors/electron/

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

echo [1/3] Installing dependencies...
cd /d "%~dp0"
call npm install --legacy-peer-deps
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Dependencies installation failed
    pause
    exit /b 1
)

echo.
echo [2/3] Building React app...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)

echo.
echo [3/3] Packaging to EXE...
call npm run dist:win
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   Build Complete!
    echo ========================================
    echo.
    echo Installer location:
    echo dist\Scheduling System Setup 1.2.0.exe
    echo.
) else (
    echo.
    echo [WARNING] Packaging may have issues
    echo Please check dist folder
    echo.
)

pause
