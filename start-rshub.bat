@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ╔════════════════════════════════════════╗
echo ║      RSHub 项目启动脚本 (Windows)      ║
echo ║  Agent Backend + Web Frontend Starter   ║
echo ╚════════════════════════════════════════╝
echo.

REM 检测 uv
where uv >nul 2>&1
if errorlevel 1 (
    echo ❌ 未检测到 uv，请先安装:
    echo.
    echo 快速安装 uv:
    echo   powershell -ExecutionPolicy BypassUser -c "irm https://astral.sh/uv/install.ps1 | iex"
    echo.
    echo 或使用 pip:
    echo   pip install uv
    echo.
    pause
    exit /b 1
)

REM 检测 Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo ❌ 未检测到 Node.js，请先安装: https://nodejs.org/
    pause
    exit /b 1
)

REM 检测 npm
where npm >nul 2>&1
if errorlevel 1 (
    echo ❌ 未检测到 npm
    pause
    exit /b 1
)

echo ✅ 所有依赖已检测
echo.

REM ==================== 初始化 Agent ====================
echo ℹ️  初始化 RSHub Agent...
cd RSHub-agent-main

if not exist ".env" (
    if exist "env_example.txt" (
        echo 📋 复制 env_example.txt 为 .env...
        copy env_example.txt .env
        echo ✅ .env 已创建，请编辑配置参数
    )
)

if not exist ".venv" (
    echo 📦 运行 uv sync...
    call uv sync >nul 2>&1
    if errorlevel 1 (
        echo ❌ uv sync 失败
        pause
        exit /b 1
    )
    echo ✅ Python 依赖已安装
) else (
    echo ✅ Python 环境已就绪
)

cd ..

REM ==================== 初始化 Web ====================
echo.
echo ℹ️  初始化 RSHub Web...
cd RSHub-web-main

if not exist "node_modules" (
    echo 📦 运行 npm install...
    call npm install >nul 2>&1
    if errorlevel 1 (
        echo ❌ npm install 失败
        echo 尝试以下解决方案:
        echo   1. npm cache clean --force
        echo   2. 删除 node_modules 目录
        echo   3. npm config set registry https://registry.npmmirror.com
        pause
        exit /b 1
    )
    echo ✅ Node.js 依赖已安装
) else (
    echo ✅ Node.js 环境已就绪
)

cd ..

REM ==================== 启动服务 ====================
echo.
echo ✨ 准备启动两个服务...
echo.
echo 选择启动方式:
echo   1 - 同时启动 Agent 和 Web
echo   2 - 仅启动 Agent (localhost:8000)
echo   3 - 仅启动 Web (localhost:3000)
echo.

set /p choice="请输入选择 [1-3] (默认1): "
if "!choice!"=="" set choice=1

if "!choice!"=="1" (
    echo.
    echo 🚀 启动 Agent ^(localhost:8000^)...
    start "RSHub Agent" cmd /k "cd RSHub-agent-main && uv run start.py"
    
    timeout /t 3 /nobreak
    
    echo 🚀 启动 Web ^(localhost:3000^)...
    start "RSHub Web" cmd /k "cd RSHub-web-main && npm start"
    
    echo.
    echo ✅ 已启动两个服务:
    echo.
    echo    🔌 Agent API:   http://localhost:8000
    echo    📚 API 文档:    http://localhost:8000/docs
    echo    🌐 Web 前端:    http://localhost:3000
    echo.
    pause
) else (
    if "!choice!"=="2" (
        echo.
        echo 🚀 启动 Agent...
        cd RSHub-agent-main
        call uv run start.py
    ) else (
        if "!choice!"=="3" (
            echo.
            echo 🚀 启动 Web...
            cd RSHub-web-main
            call npm start
        ) else (
            echo ❌ 无效的选择
            exit /b 1
        )
    )
)
