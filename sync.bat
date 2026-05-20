@echo off

REM === RSHub GitSync Launcher ===
REM Self-hide: relaunch hidden via temp VBS
if "%~1"=="__hidden__" goto :MAIN
set "_VBS=%TEMP%\_rshub_launch.vbs"
echo Set s = CreateObject("WScript.Shell") > "%_VBS%"
echo s.Run Chr(34) ^& "%~f0" ^& Chr(34) ^& " __hidden__", 0, False >> "%_VBS%"
cscript //nologo "%_VBS%"
del /q "%_VBS%" >nul 2>&1
exit /b

:MAIN
REM Check git
where git >nul 2>&1 || goto :ERR_GIT
REM Check gh
where gh >nul 2>&1 || goto :ERR_GH
REM Check python: prefer agent venv, then system
if exist "%~dp0RSHub-agent-main\.venv\Scripts\pythonw.exe" goto :RUN
REM Agent venv not found - prompt user
mshta vbscript:Execute("MsgBox""RSHub-agent-main\.venv not found."" & vbCrLf & vbCrLf & ""Please run the following in RSHub-agent-main:"" & vbCrLf & ""  uv sync"" & vbCrLf & vbCrLf & ""See RSHub-agent-main/README.md for details."",48,""RSHub GitSync"":close")
exit /b 1

:RUN
REM Use agent venv python (guaranteed to exist at this point)
set "PYW=%~dp0RSHub-agent-main\.venv\Scripts\pythonw.exe"

REM Install gitsync deps
pushd "%~dp0RSHub-gitsync-main"
if exist "pyproject.toml" "%PYW%" -m pip install -q -e . >nul 2>&1
popd
REM Launch GUI
start "" "%PYW%" "%~dp0RSHub-gitsync-main\gui.py"
exit /b 0

:ERR_GIT
mshta vbscript:Execute("MsgBox""Git not installed. Please install Git from https://git-scm.com"",16,""RSHub GitSync"":close")
exit /b 1

:ERR_GH
mshta vbscript:Execute("MsgBox""GitHub CLI (gh) not installed. Please install from https://cli.github.com"",16,""RSHub GitSync"":close")
exit /b 1