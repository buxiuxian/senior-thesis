# RSHub 项目启动指南 (Windows)

## 📋 项目结构

```
RSHub-private/
├── RSHub-agent-main/       # Python FastAPI 后端 (端口 8000)
├── RSHub-web-main/         # Node.js Docusaurus 前端 (端口 3000)
├── RSHub-gitsync-main/     # Git 同步工具
├── start-rshub.ps1         # PowerShell 启动脚本 (推荐)
└── start-rshub.bat         # 批处理启动脚本
```

## 🚀 快速开始

### 方式一：使用 PowerShell 脚本（推荐）

```powershell
# 1. 打开 PowerShell（管理员模式，可选）
# 2. 运行脚本
.\start-rshub.ps1
```

**脚本功能：**
- ✅ 自动检测 `uv`、`Node.js`、`npm` 是否安装
- ✅ 如果缺少依赖，提供安装指南
- ✅ 首次运行时自动执行 `uv sync` 和 `npm install`
- ✅ 自动复制 `.env` 文件（从 `env_example.txt`）
- ✅ 支持选择启动模式（同时启动、仅启动后端、仅启动前端）

### 方式二：使用批处理脚本

```cmd
start-rshub.bat
```

**功能较简单，但适合不熟悉 PowerShell 的用户。**

## 🔧 前置依赖安装

### 1. 安装 uv（Python 包管理工具）

**方式A：PowerShell (推荐)**
```powershell
powershell -ExecutionPolicy BypassUser -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**方式B：pip**
```bash
pip install uv
```

**验证安装：**
```bash
uv --version
```

### 2. 安装 Node.js

访问 https://nodejs.org/ 下载 **LTS 版本**，按默认选项安装。

**验证安装：**
```bash
node --version
npm --version
```

## 📝 手动启动（如果脚本失败）

### Agent Backend (Python)

```bash
cd RSHub-agent-main

# 首次运行
uv sync                    # 安装依赖
cp env_example.txt .env    # 创建配置文件

# 启动服务
uv run start.py
```

服务运行在 `http://localhost:8000`
- API 文档：`http://localhost:8000/docs`
- ReDoc：`http://localhost:8000/redoc`

### Web Frontend (Node.js)

```bash
cd RSHub-web-main

# 首次运行
npm install                # 安装依赖

# 启动服务
npm start
```

服务运行在 `http://localhost:3000`

## ⚙️ 环境配置

### Agent 配置 (.env)

编辑 `RSHub-agent-main/.env` 文件：

```ini
# 服务器配置
HOST=0.0.0.0
PORT=8000
RELOAD=true

# RSHub 配置
RSHUB_BASE_URL=https://rshub.zju.edu.cn

# LLM 配置 (可选，Phase 2)
OPENROUTER_API_KEY=your_openrouter_key_here
LLM_MODEL=google/gemini-3-flash-preview
LLM_TEMPERATURE=1.0
LLM_MAX_TOKENS=64000

# CORS 配置
CORS_ORIGINS=http://localhost:3000,https://rshub.zju.edu.cn

# 计费配置
TASK_SUBMIT_COST=1
AGENT_CHAT_COST=1
```

## 🌐 访问地址

启动后，可访问：

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 | http://localhost:3000 | Docusaurus 网站 |
| 后端 API | http://localhost:8000 | FastAPI 服务 |
| API 文档 | http://localhost:8000/docs | Swagger UI |
| API ReDoc | http://localhost:8000/redoc | ReDoc 文档 |

## 🔍 常见问题

### 问题1：UnicodeDecodeError 编码错误

**解决方案：** 已在 `sync.py` 中修复，使用 UTF-8 编码处理子进程输出。

```python
completed = subprocess.run(
    command,
    encoding='utf-8',
    errors='replace',
    ...
)
```

### 问题2：uv 命令未找到

```powershell
# 重新安装 uv
powershell -ExecutionPolicy BypassUser -c "irm https://astral.sh/uv/install.ps1 | iex"

# 或刷新 PowerShell 环境变量
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

### 问题3：npm install 超时

```bash
# 使用国内镜像
npm config set registry https://registry.npmmirror.com

# 或清除缓存重试
npm cache clean --force
npm install
```

### 问题4：端口已被占用

**查找占用端口的进程：**
```bash
# 查找占用 8000 的进程
netstat -ano | findstr :8000

# 查找占用 3000 的进程
netstat -ano | findstr :3000

# 杀死进程 (替换 PID)
taskkill /PID <PID> /F
```

**或修改端口：**

Agent: 编辑 `.env` 中的 `PORT=8001`
Web: 编辑 `docusaurus.config.js` 或启动时指定端口

## 📚 API 调用示例

### 查询任务状态

```bash
curl -X GET "http://localhost:8000/api/tasks/check?token=xxx&project=soil&task=xxx"
```

### 查询信用额度

```bash
curl -X GET "http://localhost:8000/api/credits/" \
  -H "Authorization: Bearer your_token"
```

## 🛠️ 开发相关

### Agent 后端开发

```bash
cd RSHub-agent-main

# 运行测试
uv run pytest

# 检查代码规范
uv run pylint app/

# 运行服务（自动重载）
uv run start.py
```

### Web 前端开发

```bash
cd RSHub-web-main

# 开发模式（自动热重载）
npm start

# 构建生产版本
npm run build

# 本地预览生产构建
npm run serve
```

## 📞 获取帮助

- 查看 API 文档：`http://localhost:8000/docs`
- 查看前端文档：`http://localhost:3000`
- 项目 README: 
  - Agent: `RSHub-agent-main/README.md`
  - Web: `RSHub-web-main/README.md`

---

**最后更新：** 2026-05-11
