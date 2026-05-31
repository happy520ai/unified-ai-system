@echo off
setlocal

cd /d "E:\AI-Data\AI网关系统\unified-ai-system"
if errorlevel 1 exit /b %errorlevel%

cmd /c pnpm run preflight:phase632-token-saving
if errorlevel 1 exit /b %errorlevel%

cmd /c pnpm run nightly:phase638-safe-runner
exit /b %errorlevel%

