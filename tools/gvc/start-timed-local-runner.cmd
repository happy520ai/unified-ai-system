@echo off
setlocal
cd /d "%~dp0\..\.."
echo Starting GVC timed local runner. Press Ctrl+C to stop.
pnpm run gvc:timed-runner -- --intervalMs=30000 --dailyLoopLimit=500 --maxTasksPerLoop=1 --dryRunOnly=true
endlocal
