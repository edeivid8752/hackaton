@echo off
chcp 65001 >nul
cd /d "%~dp0"
title ACCESO LINCE VIGILANCIA - Compilar APK
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0COMPILAR_APK_WINDOWS.ps1"
if errorlevel 1 (
  echo.
  echo No se genero APK. Revisa el error arriba.
) else (
  echo.
  echo Si todo salio bien, busca ACCESO_LINCE_VIGILANCIA_INSTALAR.apk en esta carpeta.
)
pause
