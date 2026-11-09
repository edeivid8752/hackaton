@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "public\vendor" mkdir "public\vendor"
echo Descargando jsQR 1.4.0, biblioteca de codigo abierto para lectura QR...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; try { Invoke-WebRequest -Uri 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js' -OutFile 'public/vendor/jsQR.js' -TimeoutSec 25 -UseBasicParsing; if ((Get-Item 'public/vendor/jsQR.js').Length -lt 100000) { throw 'Descarga incompleta' }; Write-Host 'OK: lector QR listo para usar sin Internet.'; exit 0 } catch { Write-Host ('Error: ' + $_.Exception.Message); exit 1 }"
if errorlevel 1 echo El sistema todavia permite introducir codigos manualmente.
pause
