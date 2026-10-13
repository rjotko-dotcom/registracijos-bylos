@echo off
cd /d "%~dp0"
if "%~1"=="" (
    start "" pythonw app.py
) else (
    set SASKAITOS_PAUSE=1
    python app.py %*
)
