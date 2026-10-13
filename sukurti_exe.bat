@echo off
REM Sukuria vieno failo programa dist\Saskaitos.exe (veikia be Python)
cd /d "%~dp0"
python -m pip install pyinstaller -r requirements.txt
python -m PyInstaller --noconfirm --onefile --windowed --name Saskaitos --icon saskaitos\assets\app.ico --add-data "saskaitos\assets;saskaitos\assets" --collect-all tkinterdnd2 app.py
pause
