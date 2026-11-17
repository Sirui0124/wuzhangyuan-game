@echo off
chcp 65001 >nul
cd /d "%~dp0"
node launch.mjs
if errorlevel 1 (
  pause
) else (
  start "" "http://127.0.0.1:8937/"
)
