@echo off
REM Start the Festa Junina server with -B flag to prevent bytecode caching issues
setlocal enabledelayedexpansion
cd /d "%~dp0"
"C:\Users\arthu\AppData\Local\Microsoft\WindowsApps\python3.13.exe" -B -u server.py
pause
