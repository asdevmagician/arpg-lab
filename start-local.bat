@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required. Install Node.js, then run this file again.
  pause
  exit /b 1
)
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"
if errorlevel 1 (
  echo Please update Node.js to version 22 or newer.
  pause
  exit /b 1
)
set "ARPG_PORT=4180"
if not "%~1"=="" set "ARPG_PORT=%~1"
echo Starting ARPG. Keep this window open while playing.
echo Press Ctrl+C to stop the server.
node scripts/server.js --port "%ARPG_PORT%" --open
if errorlevel 1 pause
endlocal
