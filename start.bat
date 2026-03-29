@echo off
REM Start Heroes of Fortune with Multiplayer Server

cls
echo 🎮 Heroes of Fortune - Multiplayer Setup
echo ========================================
echo.
echo Installing dependencies...
call npm install

echo.
echo ✅ Dependencies installed!
echo.
echo Choose an option:
echo 1. Start BOTH server and client (recommended)
echo 2. Start only SERVER (port 5000)
echo 3. Start only CLIENT (port 5173)
echo.
set /p choice="Enter choice (1-3): "

if "%choice%"=="1" (
    echo.
    echo 🚀 Starting server on port 5000 in new window...
    start cmd /k "npm run server"
    timeout /t 2 /nobreak
    echo 🚀 Starting client on port 5173...
    call npm run dev
) else if "%choice%"=="2" (
    call npm run server
) else if "%choice%"=="3" (
    call npm run dev
) else (
    echo Invalid choice
)
