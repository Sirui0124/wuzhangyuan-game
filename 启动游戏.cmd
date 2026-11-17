@echo off
setlocal
chcp 65001 >nul
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22 or newer, then try again.
  pause
  exit /b 1
)
node "%~dp0tools\local-game\launch.mjs" %*
if errorlevel 1 pause
