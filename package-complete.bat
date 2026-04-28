@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   排课管理系统 v1.2 - 完整打包脚本
echo ========================================
echo.
echo 正在创建完整项目包...
echo.

cd /d "%~dp0"

REM 删除旧的打包文件
if exist "scheduling-system-v1.2-complete.zip" del "scheduling-system-v1.2-complete.zip"

REM 创建文件列表
echo 正在收集文件...

REM 使用 PowerShell 创建 zip
powershell -Command "Compress-Archive -Path '.\*' -DestinationPath '.\scheduling-system-v1.2-complete.zip' -Force"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   打包完成！
    echo ========================================
    echo.
    echo 文件名：scheduling-system-v1.2-complete.zip
    echo.
    echo 使用说明:
    echo 1. 解压到任意目录
    echo 2. 双击运行 install.bat 安装依赖
    echo 3. 运行 build.bat 打包成 exe
    echo 4. 安装包在 dist/目录
    echo.
) else (
    echo.
    echo [错误] 打包失败
    echo.
)

pause
