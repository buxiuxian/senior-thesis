# RSHub Start Script for Windows PowerShell
# Features: Check dependencies, initialize environment, start Agent and Web services

param(
    [switch]$SkipInstall = $false
)

function Write-Info {
    param([string]$Message)
    Write-Host "i  $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "+  $Message" -ForegroundColor Green
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host "x  $Message" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "!  $Message" -ForegroundColor Yellow
}

function Test-Command {
    param([string]$Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Magenta
Write-Host "  RSHub Start Script (Windows)" -ForegroundColor Magenta
Write-Host "  Agent Backend + Web Frontend" -ForegroundColor Magenta
Write-Host "=====================================" -ForegroundColor Magenta
Write-Host ""

# Get script directory
$scriptDir = $PSScriptRoot
if (-not $scriptDir) {
    $scriptDir = Get-Location
}

Write-Info "Project root: $scriptDir"

# ==================== Dependency Check ====================
Write-Info ""
Write-Info "Checking dependencies..."

$missingDeps = @()

# Check uv
if (-not (Test-Command uv)) {
    Write-Warning "uv not found"
    $missingDeps += "uv"
}
else {
    $uvVersion = & uv --version
    Write-Success "uv: $uvVersion"
}

# Check Node.js
if (-not (Test-Command node)) {
    Write-Warning "Node.js not found"
    $missingDeps += "Node.js"
}
else {
    $nodeVersion = & node --version
    Write-Success "Node.js: $nodeVersion"
}

# Check npm
if (-not (Test-Command npm)) {
    Write-Warning "npm not found"
    $missingDeps += "npm"
}
else {
    $npmVersion = & npm --version
    Write-Success "npm: $npmVersion"
}

if ($missingDeps.Count -gt 0) {
    Write-ErrorMsg "Missing dependencies: $($missingDeps -join ', ')"
    Write-Host ""
    Write-Host "Quick install uv:"
    Write-Host "  powershell -ExecutionPolicy BypassUser -c 'irm https://astral.sh/uv/install.ps1 | iex'"
    Write-Host ""
    exit 1
}

# ==================== Initialize Agent ====================
Write-Info ""
Write-Info "Initializing RSHub Agent (Python Backend)..."

$agentDir = Join-Path $scriptDir "RSHub-agent-main"

if (-not (Test-Path $agentDir)) {
    Write-ErrorMsg "Agent directory not found: $agentDir"
    exit 1
}

Push-Location $agentDir

# Copy .env if not exists
if (-not (Test-Path ".env")) {
    if (Test-Path "env_example.txt") {
        Write-Info "Copying env_example.txt to .env..."
        Copy-Item "env_example.txt" ".env"
        Write-Success ".env created, please edit it with your configuration"
    }
}
else {
    Write-Success ".env exists"
}

# Check and install dependencies
$needsSync = $false

if (-not (Test-Path "uv.lock")) {
    Write-Warning "uv.lock not found, will install dependencies"
    $needsSync = $true
}

if ($needsSync) {
    Write-Info "Running 'uv sync'..."
    & uv sync
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "uv sync failed"
        Pop-Location
        exit 1
    }
    Write-Success "Python dependencies installed"
}
else {
    Write-Success "Python environment ready"
}

Pop-Location

# ==================== Initialize Web ====================
Write-Info ""
Write-Info "Initializing RSHub Web (Node.js Frontend)..."

$webDir = Join-Path $scriptDir "RSHub-web-main"

if (-not (Test-Path $webDir)) {
    Write-ErrorMsg "Web directory not found: $webDir"
    exit 1
}

Push-Location $webDir

# Check and install npm dependencies
$needsNpmInstall = $false

if (-not (Test-Path "node_modules")) {
    Write-Warning "node_modules not found, will install"
    $needsNpmInstall = $true
}

if ($needsNpmInstall) {
    Write-Info "Running 'npm install'..."
    & npm cache clean --force 2>&1 | Out-Null
    & npm install
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "npm install failed"
        Write-Host ""
        Write-Host "Try these solutions:"
        Write-Host "  1. npm cache clean --force"
        Write-Host "  2. Delete node_modules directory"
        Write-Host "  3. npm config set registry https://registry.npmmirror.com"
        Pop-Location
        exit 1
    }
    Write-Success "Node.js dependencies installed"
}
else {
    Write-Success "Node.js environment ready"
}

Pop-Location

# ==================== Start Services ====================
Write-Info ""
Write-Host "Ready to start services" -ForegroundColor Magenta
Write-Host ""
Write-Host "Options:"
Write-Host "  1 - Start both Agent and Web"
Write-Host "  2 - Start Agent only (localhost:8000)"
Write-Host "  3 - Start Web only (localhost:3000)"
Write-Host ""

$choice = Read-Host "Select [1-3] (default 1)"
if ([string]::IsNullOrEmpty($choice)) { $choice = "1" }

if ($choice -eq "1") {
    Write-Success "Starting Agent (localhost:8000)..."
    $agentDir = Join-Path $scriptDir "RSHub-agent-main"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$agentDir' ; uv run start.py"
    
    Start-Sleep -Seconds 2
    
    Write-Success "Starting Web (localhost:3000)..."
    $webDir = Join-Path $scriptDir "RSHub-web-main"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$webDir' ; npm start"
    
    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host "  RSHub Services Started" -ForegroundColor Green
    Write-Host "" -ForegroundColor Green
    Write-Host "  Web: http://localhost:3000" -ForegroundColor Green
    Write-Host "  API: http://localhost:8000" -ForegroundColor Green
    Write-Host "  Docs: http://localhost:8000/docs" -ForegroundColor Green
    Write-Host "" -ForegroundColor Green
    Write-Host "=====================================" -ForegroundColor Green
}
elseif ($choice -eq "2") {
    Write-Success "Starting Agent (localhost:8000)..."
    Write-Host "Docs: http://localhost:8000/docs" -ForegroundColor Green
    $agentDir = Join-Path $scriptDir "RSHub-agent-main"
    Push-Location $agentDir
    & uv run start.py
    Pop-Location
}
elseif ($choice -eq "3") {
    Write-Success "Starting Web (localhost:3000)..."
    Write-Host "Web: http://localhost:3000" -ForegroundColor Green
    $webDir = Join-Path $scriptDir "RSHub-web-main"
    Push-Location $webDir
    & npm start
    Pop-Location
}
else {
    Write-ErrorMsg "Invalid choice"
    exit 1
}
