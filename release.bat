@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"
if not exist "logs" mkdir "logs"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "TS=%%i"
set "LOG=logs\release-%TS%.log"

set "BASH="
if exist "%ProgramFiles%\Git\bin\bash.exe" set "BASH=%ProgramFiles%\Git\bin\bash.exe"
if exist "%ProgramFiles%\Git\usr\bin\bash.exe" set "BASH=%ProgramFiles%\Git\usr\bin\bash.exe"
if not defined BASH if exist "%ProgramFiles(x86)%\Git\bin\bash.exe" set "BASH=%ProgramFiles(x86)%\Git\bin\bash.exe"
if not defined BASH if exist "%ProgramFiles(x86)%\Git\usr\bin\bash.exe" set "BASH=%ProgramFiles(x86)%\Git\usr\bin\bash.exe"

if not defined BASH (
  echo [ERROR] Git Bash not found. Please install Git for Windows.
  pause
  exit /b 1
)

set "MSG=auto deploy %date% %time%"

echo [release.bat] Starting full release cycle...
echo 1. Build (local)
echo 2. Commit & Push
echo 3. Deploy (server)
echo.
echo Log: %LOG%
echo.

"%BASH%" -lc "./release.sh \"%MSG%\"" 1>>"%LOG%" 2>&1
set "RC=%ERRORLEVEL%"

echo.
if not "%RC%"=="0" (
  echo [ERROR] Release FAILED (exit code %RC%)
  echo See log for details: %LOG%
  echo.
  echo --- Last 50 lines of log ---
  powershell -NoProfile -Command "Get-Content '%LOG%' -Tail 50"
  echo ---------------------------
) else (
  echo [SUCCESS] Release finished successfully.
  echo See log: %LOG%
)

pause
exit /b %RC%
