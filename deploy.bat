@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"
if not exist "logs" mkdir "logs"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "TS=%%i"
set "LOG=logs\deploy-%TS%.log"

set "SERVER=root@166.1.60.87"
set "REMOTE=/root/deploy.sh"

echo [deploy.bat] Starting server-only deploy...
echo Target: %SERVER%
echo Script: %REMOTE%
echo Log: %LOG%
echo.

ssh -o StrictHostKeyChecking=accept-new %SERVER% "bash -lc '%REMOTE%'" 1>>"%LOG%" 2>&1
set "RC=%ERRORLEVEL%"

echo.
if not "%RC%"=="0" (
  echo [ERROR] Deploy FAILED (exit code %RC%)
  echo See log for details: %LOG%
  echo.
  echo --- Last 50 lines of log ---
  powershell -NoProfile -Command "Get-Content '%LOG%' -Tail 50"
  echo ---------------------------
) else (
  echo [SUCCESS] Deploy finished successfully.
  echo See log: %LOG%
)

pause
exit /b %RC%
