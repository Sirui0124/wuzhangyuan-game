@echo off
cd /d "%~dp0\..\.."
node demos/yiling-expert-lab/launch.mjs
if errorlevel 1 pause
