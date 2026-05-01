@echo off
REM Auto News Video - installer cho Windows 10/11
REM Chay bang cach double-click file install.bat (Run as Administrator neu can)

setlocal EnableDelayedExpansion
chcp 65001 >nul
title Auto News Video - Cai dat tu dong

cd /d "%~dp0"

echo.
echo ===================================================
echo    AUTO NEWS VIDEO - Cai dat tu dong (Windows)
echo ===================================================
echo.
echo Ban khong can lam gi them, chi cho 2-5 phut.
echo Neu Windows hoi xac nhan, vui long bam "Yes".
echo.
timeout /t 3 >nul

REM 1. Kiem tra winget
where winget >nul 2>&1
if errorlevel 1 (
  echo [LOI] May tinh chua co Windows Package Manager.
  echo Vui long cap nhat Windows hoac cai App Installer tu Microsoft Store:
  echo   https://aka.ms/getwinget
  pause
  exit /b 1
)

REM 2. Cai Node.js 22 LTS
where node >nul 2>&1
if errorlevel 1 (
  echo --^> Dang cai Node.js 22 LTS...
  winget install -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
)

REM 3. Cai FFmpeg
where ffmpeg >nul 2>&1
if errorlevel 1 (
  echo --^> Dang cai FFmpeg...
  winget install -e --id Gyan.FFmpeg --silent --accept-package-agreements --accept-source-agreements
)

REM 4. Refresh PATH cho phien hien tai
for /f "usebackq tokens=2,*" %%A in (`reg query "HKLM\System\CurrentControlSet\Control\Session Manager\Environment" /v PATH 2^>nul`) do set "SYSPATH=%%B"
for /f "usebackq tokens=2,*" %%A in (`reg query "HKCU\Environment" /v PATH 2^>nul`) do set "USRPATH=%%B"
set "PATH=%SYSPATH%;%USRPATH%"

REM 5. Cai dependencies
echo --^> Dang cai thu vien cho phan loi...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo [LOI] Khong cai duoc thu vien. Hay chay lai install.bat hoac kiem tra ket noi mang.
  pause
  exit /b 1
)

echo --^> Dang dung giao dien web...
pushd ui
call npm install --no-audit --no-fund
call npm run build
popd
if errorlevel 1 (
  echo [LOI] Khong dung duoc giao dien.
  pause
  exit /b 1
)

REM 6. Tao shortcut tren Desktop
set "DESKTOP=%USERPROFILE%\Desktop"
set "APP_DIR=%~dp0"
set "LAUNCHER=%DESKTOP%\Auto News Video.bat"
echo @echo off > "%LAUNCHER%"
echo cd /d "%APP_DIR%" >> "%LAUNCHER%"
echo set NO_OPEN=0 >> "%LAUNCHER%"
echo call npm run server >> "%LAUNCHER%"

echo.
echo ===================================================
echo           CAI DAT HOAN TAT
echo ===================================================
echo.
echo --^> De mo ung dung, double-click "Auto News Video.bat" tren Desktop.
echo --^> Lan dau mo, hay dien API key (huong dan trong app).
echo.
echo Bam phim bat ky de mo ung dung ngay...
pause >nul

REM Khoi chay luon cho lan dau
set NO_OPEN=0
call npm run server
