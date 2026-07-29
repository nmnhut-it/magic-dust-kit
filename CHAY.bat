@echo off
setlocal EnableDelayedExpansion
title Magic Dust
cd /d "%~dp0"

echo(
echo   ==========================================
echo     MAGIC DUST - bam dung mot lan la chay
echo   ==========================================
echo(

rem ---- 1. tim Python -------------------------------------------------------
rem `py` la Python Launcher (co san khi cai tu python.org), `python` la ban
rem nam trong PATH. Thu ca hai, vi may nao cai kieu nao cung co.
set "PY="
where py >nul 2>&1 && (py -3 -c "import sys" >nul 2>&1 && set "PY=py -3")
if not defined PY (
  where python >nul 2>&1 && (python -c "import sys" >nul 2>&1 && set "PY=python")
)

rem ---- 2. chua co thi cai --------------------------------------------------
if not defined PY (
  echo   May nay chua co Python. De toi cai giup...
  echo(
  where winget >nul 2>&1
  if errorlevel 1 goto :caitay
  winget install --id Python.Python.3.12 --source winget --accept-package-agreements --accept-source-agreements --silent
  if errorlevel 1 goto :caitay
  echo(
  echo   Da cai xong Python.
  rem Sau khi cai, PATH cua cua so nay van la PATH cu -> goi thang qua launcher
  set "PY=py -3"
  where py >nul 2>&1 || set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
)

rem ---- 3. chay may chu + mo trinh duyet ------------------------------------
%PY% -c "import sys; sys.exit(0)" >nul 2>&1
if errorlevel 1 goto :caitay

echo   Dang mo trinh duyet...
echo(
echo     do choi   : http://localhost:8123/index.html
echo     dao guong : http://localhost:8123/lessons/islandFXFORGE.html
echo(
echo   Bam Ctrl+C o cua so nay de dung.
echo(
start "" http://localhost:8123/index.html
%PY% serve.py 8123
goto :eof

rem ---- neu khong tu cai duoc ------------------------------------------------
:caitay
echo(
echo   Khong tu cai duoc Python. Ban cai tay giup nhe:
echo(
echo     1. Mo  https://www.python.org/downloads/
echo     2. Tai ban moi nhat cho Windows
echo     3. QUAN TRONG: o man hinh dau tien, tich vao o
echo        "Add python.exe to PATH" roi moi bam Install
echo     4. Cai xong thi bam dung file CHAY.bat nay lan nua
echo(
start "" https://www.python.org/downloads/
pause
