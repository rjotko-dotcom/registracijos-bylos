@echo off
REM Vienkartinis diegimas (reikia interneto tik siam zingsniui)
cd /d "%~dp0"
python -m pip install -r requirements.txt
pause
