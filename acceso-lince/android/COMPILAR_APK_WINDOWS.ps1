# ACCESO LINCE VIGILANCIA — compilador Windows para proyecto Android sin gradle-wrapper.jar.
# Descarga Gradle 8.11.1 del dominio oficial, verifica integridad y llama a assembleDebug.
$ErrorActionPreference='Stop'
$project=Split-Path -Parent $MyInvocation.MyCommand.Path
$gradleVer='8.11.1'
$expectedSha='f397b287023acdba1e9f6fc5ea72d22dd63669d59ed4a289a29b1a76eee151c6'
$binUrl="https://services.gradle.org/distributions/gradle-$gradleVer-bin.zip"
$cache=Join-Path $env:LOCALAPPDATA 'LINCE-ACCESS\BuildTools'
$zip=Join-Path $cache "gradle-$gradleVer-bin.zip"
$gradleDir=Join-Path $cache "gradle-$gradleVer"
$gradle=Join-Path $gradleDir 'bin\gradle.bat'

function Stop-Build([string]$msg) { Write-Host "`nERROR: $msg" -ForegroundColor Red; exit 1 }
function Show-Step([string]$msg) { Write-Host "`n[LINCE] $msg" -ForegroundColor Cyan }

Show-Step 'Buscando Android SDK...'
if (-not $env:ANDROID_HOME) {
    $env:ANDROID_HOME=Join-Path $env:LOCALAPPDATA 'Android\Sdk'
}
if (-not (Test-Path (Join-Path $env:ANDROID_HOME 'platforms\android-35\android.jar'))) {
    Stop-Build "Falta Android SDK Platform 35 en $env:ANDROID_HOME. Abre Android Studio > Tools > SDK Manager > SDK Platforms > Android 15 (API 35)."
}
if (-not (Test-Path (Join-Path $env:ANDROID_HOME 'build-tools\35.0.0'))) {
    Stop-Build 'Falta Android SDK Build-Tools 35.0.0. Instala este componente en Android Studio > SDK Manager > SDK Tools (Show Package Details).'
}

Show-Step 'Buscando Java 17 o superior...'
$javaLocations=@()
if ($env:JAVA_HOME) {$javaLocations+= (Join-Path $env:JAVA_HOME 'bin\java.exe')}
$javaLocations+= "${env:ProgramFiles}\Android\Android Studio\jbr\bin\java.exe"
$javaLocations+= "${env:LOCALAPPDATA}\Programs\Android Studio\jbr\bin\java.exe"
$javaLocations+= "${env:ProgramFiles}\Java\jdk-17\bin\java.exe"
$java=($javaLocations | Where-Object {Test-Path $_} | Select-Object -First 1)
if (-not $java) {
  $available=Get-Command java -ErrorAction SilentlyContinue
  if ($available) { $java=$available.Source }
}
if (-not $java) { Stop-Build 'No hay Java. Instala Android Studio desde https://developer.android.com/studio y vuelve a ejecutar.' }
# java -version imprime normalmente en stderr; no debe confundirse con un error.
$oldPreference=$ErrorActionPreference
$ErrorActionPreference='Continue'
try { $javaOut=(& $java -version 2>&1 | Out-String); $javaExit=$LASTEXITCODE }
finally { $ErrorActionPreference=$oldPreference }
if ($javaExit -ne 0) { Stop-Build 'Java no pudo ejecutarse.' }
if ($javaOut -match 'version "(\d+)') { $major=[int]$Matches[1] } else { Stop-Build 'No pude identificar la version de Java.' }
if ($major -lt 17) { Stop-Build "Se necesita Java >=17. Encontrado: $major" }
$env:JAVA_HOME=Split-Path -Parent (Split-Path -Parent $java)
$env:Path=(Join-Path $env:JAVA_HOME 'bin')+';'+$env:Path

if (-not (Test-Path $gradle)) {
    New-Item -ItemType Directory -Force -Path $cache | Out-Null
    $download=$true
    if (Test-Path $zip) {
        $actual=(Get-FileHash -Algorithm SHA256 $zip).Hash.ToLowerInvariant()
        if ($actual -eq $expectedSha) { $download=$false } else { Remove-Item $zip -Force }
    }
    if ($download) {
        Show-Step 'Descargando Gradle oficial; se necesita internet en la laptop esta primera vez...'
        try {
            [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $binUrl -OutFile $zip -UseBasicParsing -TimeoutSec 900
        } catch { Stop-Build "No se pudo descargar Gradle. Comprueba internet de la laptop. Detalle: $($_.Exception.Message)" }
    }
    Show-Step 'Verificando SHA-256...'
    $actual=(Get-FileHash -Algorithm SHA256 $zip).Hash.ToLowerInvariant()
    if ($actual -ne $expectedSha) { Remove-Item $zip -Force; Stop-Build 'El hash no coincide. Descarga rechazada por seguridad.' }
    Show-Step 'Extrayendo Gradle...'
    Expand-Archive -LiteralPath $zip -DestinationPath $cache -Force
}
if (-not (Test-Path $gradle)) { Stop-Build 'No se encontro gradle.bat despues de extraer.' }
# Crear un Gradle Wrapper ESTANDAR en un proyecto Java minimo de bootstrap.
# Android Studio podra sincronizar despues nuestro proyecto sin pasos manuales.
if (-not (Test-Path (Join-Path $project 'gradle\wrapper\gradle-wrapper.jar'))) {
    Show-Step 'Creando Gradle Wrapper estandar para Android Studio...'
    $bootstrap=Join-Path $cache 'wrapper-bootstrap'
    New-Item -ItemType Directory -Path $bootstrap -Force | Out-Null
    Set-Content -Path (Join-Path $bootstrap 'settings.gradle') -Value "rootProject.name = 'bootstrap'" -Encoding Ascii
    Set-Content -Path (Join-Path $bootstrap 'build.gradle') -Value '' -Encoding Ascii
    Push-Location $bootstrap
    try { & $gradle --no-daemon --console=plain wrapper --gradle-version $gradleVer --distribution-type bin; $wrapperExit=$LASTEXITCODE }
    finally { Pop-Location }
    if ($wrapperExit -ne 0) { Stop-Build 'No se pudo generar Gradle Wrapper.' }
    New-Item -ItemType Directory -Path (Join-Path $project 'gradle\wrapper') -Force | Out-Null
    Copy-Item (Join-Path $bootstrap 'gradle\wrapper\*') (Join-Path $project 'gradle\wrapper') -Force
    Copy-Item (Join-Path $bootstrap 'gradlew.bat') $project -Force
    Copy-Item (Join-Path $bootstrap 'gradlew') $project -Force
    Add-Content -Path (Join-Path $project 'gradle\wrapper\gradle-wrapper.properties') -Value "distributionSha256Sum=$expectedSha" -Encoding Ascii
}
Show-Step 'Compilando el APK de ACCESO LINCE VIGILANCIA...'
Push-Location $project
try {
   & $gradle --no-daemon --console=plain assembleDebug
   $exitCode=$LASTEXITCODE
} finally { Pop-Location }
if ($exitCode -ne 0) { Stop-Build "Gradle fallo (codigo $exitCode). Revisa el mensaje arriba." }
$built=Join-Path $project 'app\build\outputs\apk\debug\app-debug.apk'
if (-not (Test-Path $built)) { Stop-Build 'Gradle termino sin encontrar app-debug.apk.' }
$dest=Join-Path $project 'ACCESO_LINCE_VIGILANCIA_INSTALAR.apk'
Copy-Item $built $dest -Force
Write-Host "`nLISTO! APK generado: $dest" -ForegroundColor Green
Write-Host 'Copia ese APK a tu telefono Android por USB y abre el archivo.'
