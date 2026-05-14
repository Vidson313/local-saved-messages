@echo off
chcp 65001 >nul 2>nul
title Local Saved Messages

echo.
echo  ╔══════════════════════════════════════╗
echo  ║     Local Saved Messages             ║
echo  ║     Personal Message Storage         ║
echo  ╚══════════════════════════════════════╝
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install it from https://nodejs.org
    pause
    exit /b 1
)

:: Check if dependencies are installed
if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
    echo.
)

:: Menu
:menu
echo  Select an option:
echo.
echo   [1] Start Development Server  (hot reload, port 3000)
echo   [2] Build & Start Production  (optimized, port 3000)
echo   [3] Build Only
echo   [4] Generate PWA Icons
echo   [5] Exit
echo.
set /p choice="  Enter choice (1-5): "

if "%choice%"=="1" goto dev
if "%choice%"=="2" goto prod
if "%choice%"=="3" goto build
if "%choice%"=="4" goto icons
if "%choice%"=="5" goto end
echo Invalid choice.
echo.
goto menu

:dev
echo.
echo [INFO] Starting development server on http://localhost:3000
echo [INFO] Press Ctrl+C to stop
echo.
call npm run dev
goto end

:prod
echo.
echo [INFO] Building production bundle...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed.
    pause
    goto end
)
echo.
echo [INFO] Starting production server on http://localhost:3000
echo [INFO] Press Ctrl+C to stop
echo.
call npm run start
goto end

:build
echo.
echo [INFO] Building production bundle...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed.
) else (
    echo.
    echo [OK] Build completed successfully!
)
pause
goto end

:icons
echo.
echo [INFO] Generating PWA icons from SVG...
if not exist "public\icon.svg" (
    echo [ERROR] public\icon.svg not found.
    pause
    goto menu
)
node -e "const sharp = require('sharp'); const fs = require('fs'); const svg = fs.readFileSync('public/icon.svg'); Promise.all([sharp(svg).resize(192,192).png().toFile('public/icon-192.png'), sharp(svg).resize(512,512).png().toFile('public/icon-512.png')]).then(() => console.log('[OK] Icons generated: icon-192.png, icon-512.png')).catch(e => console.error('[ERROR]', e.message));"
pause
goto menu

:end
