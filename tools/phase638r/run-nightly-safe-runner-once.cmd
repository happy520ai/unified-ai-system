@echo off
setlocal

cd /d "%~dp0..\.."
if errorlevel 1 exit /b %errorlevel%

cmd /c pnpm run preflight:phase632-token-saving
if errorlevel 1 exit /b %errorlevel%

cmd /c pnpm run nightly:phase638-safe-runner
exit /b %errorlevel%
