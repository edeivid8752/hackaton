@echo off
chcp 65001 >nul
cd /d "%~dp0"
title ACCESO LINCE - BASE LIMPIA
set "LINCE_DB=%~dp0lince-institucional.sqlite"
set "LINCE_DEMO=0"
set "HOST=0.0.0.0"
echo ================================================
echo    ACCESO LINCE - INSTALACION INSTITUCIONAL
echo ================================================
echo.
where node >nul 2>nul
if errorlevel 1 (
 echo ERROR: instala Node.js 22.13 o superior.
 echo https://nodejs.org/
 pause
 exit /b 1
)
echo Comprobando cuenta inicial de Direccion...
node "tools\configurar_directora_inicial.js"
if errorlevel 1 (
 echo.
 echo La configuracion no pudo completarse.
 pause
 exit /b 1
)
echo.
echo Iniciando servidor en http://localhost:3000
echo El servidor debe permanecer encendido para Android.
echo Cierra la ventana o presiona Ctrl+C al terminar.
echo.
start "" cmd /c "ping -n 3 127.0.0.1 >nul && start http://localhost:3000"
node server.js
pause
