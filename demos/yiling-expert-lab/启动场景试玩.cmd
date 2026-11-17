@echo off
cd /d "%~dp0\..\.."
node demos/yiling-expert-lab/launch-scenes.mjs
if errorlevel 1 pause
