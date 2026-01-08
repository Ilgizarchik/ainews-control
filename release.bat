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
  echo Git Bash not found. Install Git for Windows. > "%LOG%"
  echo Git Bash not found. Install Git for Windows.
  echo Log: %LOG%
  pause
  exit /b 1
)

set "MSG=auto deploy %date% %time%"

echo Running safe release (build + push + deploy)...
echo Log: %LOG%
echo.

"%BASH%" -lc "./release.sh \"%MSG%\"" 1>>"%LOG%" 2>&1
set "RC=%ERRORLEVEL%"

echo.
if not "%RC%"=="0" (
  echo FAILED (exit code %RC%)
  echo See log: %LOG%
  echo --- last 120 lines ---
  powershell -NoProfile -Command "Get-Content '%LOG%' -Tail 120"
) else (
  echo OK
  echo See log: %LOG%
)

pause
exit /b %RC%
