@echo off
chcp 65001 >nul
cd /d "%~dp0"
title LINCE ACCESS V0.2 - Servidor local
color 1F
echo =====================================================
echo   LINCE ACCESS V0.2 - ADMIN + GUARD ANDROID
echo =====================================================
echo.
where node >nul 2>nul
if errorlevel 1 (
 echo ERROR: Node.js no esta instalado o no esta en PATH.
 echo Instala Node.js 22.13 o superior desde https://nodejs.org/
 pause
 exit /b 1
)
echo Abre LINCE ADMIN en http://localhost:3000
echo.
echo Para usar LINCE GUARD en Android:
echo   1. Laptop y Android deben estar en la MISMA red Wi-Fi privada.
echo   2. Lee la URL ANDROID que aparecera debajo.
echo   3. Abrela en Chrome en tu telefono.
echo   4. En Windows Firewall, si te pregunta, permite SOLO redes privadas.
echo.
echo IMPORTANTE: DEMO sin HTTPS. NO uses datos reales.
echo.
set HOST=0.0.0.0
start "" cmd /c "ping -n 3 127.0.0.1 >nul && start http://localhost:3000"
node server.js
pause
