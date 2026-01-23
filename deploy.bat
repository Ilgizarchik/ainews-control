@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"
if not exist "logs" mkdir "logs"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "TS=%%i"
set "LOG=logs\deploy-%TS%.log"

set "SERVER=root@166.1.60.87"
set "REMOTE=/root/deploy.sh"

echo Deploying on server: %SERVER%
echo Log: %LOG%
echo.

ssh -o StrictHostKeyChecking=accept-new %SERVER% "bash -lc '%REMOTE%'" 1>>"%LOG%" 2>&1
set "RC=%ERRORLEVEL%"

echo.
if not "%RC%"=="0" (
  echo FAILED (exit code %RC%)
  echo See log: %LOG%
  echo --- last 80 lines ---
  powershell -NoProfile -Command "Get-Content '%LOG%' -Tail 80"
) else (
  echo OK
  echo See log: %LOG%
)

pause
exit /b %RC%
