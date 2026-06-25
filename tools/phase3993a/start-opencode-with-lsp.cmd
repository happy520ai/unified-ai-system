@echo off
setlocal

set "OPENCODE_EXPERIMENTAL_LSP_TOOL=true"
set "OPENCODE_EXPERIMENTAL=true"

for %%I in ("%~dp0..\..") do set "PROJECT_ROOT=%%~fI"
set "OPENCODE_CONFIG_DIR=%USERPROFILE%\.config\opencode"
set "OPENCODE_CONFIG=%PROJECT_ROOT%\opencode.jsonc"
set "OPENCODE_EXE=%LOCALAPPDATA%\Programs\OpenCode\OpenCode.exe"
for %%I in ("%OPENCODE_EXE%") do set "OPENCODE_DIR=%%~dpI"

if not exist "%OPENCODE_EXE%" (
  echo OpenCode executable not found: %OPENCODE_EXE%
  exit /b 1
)

if not exist "%OPENCODE_CONFIG%" (
  echo Project OpenCode config not found: %OPENCODE_CONFIG%
  exit /b 1
)

if not exist "%OPENCODE_CONFIG_DIR%\opencode.json" (
  echo Global OpenCode config not found: %OPENCODE_CONFIG_DIR%\opencode.json
  exit /b 1
)

start "OpenCode LSP" /D "%OPENCODE_DIR%" "%OPENCODE_EXE%" "%PROJECT_ROOT%"
