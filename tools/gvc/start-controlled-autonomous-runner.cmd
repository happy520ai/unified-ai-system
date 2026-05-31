@echo off
setlocal
cd /d "%~dp0\..\.."
if not exist "apps\ai-gateway-service\evidence\phase2019-gvc-timed-local-runner\formal-runner-logs" mkdir "apps\ai-gateway-service\evidence\phase2019-gvc-timed-local-runner\formal-runner-logs"
echo [%DATE% %TIME%] Starting controlled autonomous GVC runner>>"apps\ai-gateway-service\evidence\phase2019-gvc-timed-local-runner\formal-runner-logs\controlled-autonomous-runner.out.log"
call "%CD%\pnpm.cmd" run gvc:timed-runner -- --intervalMs=30000 --dailyLoopLimit=500 --maxTasksPerLoop=1 --dryRunOnly=false >>"apps\ai-gateway-service\evidence\phase2019-gvc-timed-local-runner\formal-runner-logs\controlled-autonomous-runner.out.log" 2>>"apps\ai-gateway-service\evidence\phase2019-gvc-timed-local-runner\formal-runner-logs\controlled-autonomous-runner.err.log"
echo [%DATE% %TIME%] Runner exited with code %ERRORLEVEL%>>"apps\ai-gateway-service\evidence\phase2019-gvc-timed-local-runner\formal-runner-logs\controlled-autonomous-runner.out.log"
endlocal
