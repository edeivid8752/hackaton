@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "APK=%~dp0ACCESO_LINCE_VIGILANCIA_INSTALAR.apk"
if not exist "%APK%" (
 echo Falta ACCESO_LINCE_VIGILANCIA_INSTALAR.apk. Primero ejecuta COMPILAR_APK_WINDOWS.bat
 pause
 exit /b 1
)
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not exist "%ADB%" (
 echo Falta adb.exe: instala Android SDK Platform-Tools con Android Studio.
 pause
 exit /b 1
)
echo Conecta TU Android por USB con Depuracion USB autorizada.
"%ADB%" devices
pause
"%ADB%" install -r "%APK%"
if errorlevel 1 (
 echo Instalacion no completada. Revisa autorizacion USB y que se vea el dispositivo.
) else (
 echo Instalacion completada. Busca ACCESO LINCE VIGILANCIA en Android.
)
pause
