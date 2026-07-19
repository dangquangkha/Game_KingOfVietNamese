@echo off
echo ========================================
echo   Vua Tieng Viet - Game Server
echo ========================================
echo Dang khoi dong server tai http://localhost:8000
echo Nhan Ctrl+C de dung server
echo.
D:\python.exe -c "import sys; sys.path.insert(0,'D:\\Lib\\site-packages'); sys.path.insert(0,'C:\\Users\\Nhat Anh\\AppData\\Roaming\\Python\\Python313\\site-packages'); import uvicorn; uvicorn.run('main:app', host='0.0.0.0', port=8000, reload=True)"
pause
