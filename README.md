# ACCESO LINCE — Proyecto completo (Hackatón LinceCode 2026)

🐆 **Proyecto web + Android, manuales de uso, memoria técnica y archivos de prueba ficticios.**

## 📂 Acceder al proyecto

**[Abrir ACCESO LINCE completo](acceso-lince/README.md)**

| Componente | Carpeta |
|---|---|
| Panel web y servidor Node.js/SQLite V0.5.2 | [`acceso-lince/web/`](acceso-lince/web/) |
| Aplicación Android ACCESO LINCE VIGILANCIA | [`acceso-lince/android/`](acceso-lince/android/) |
| Memoria técnica y manual operativo PDF | [`acceso-lince/documentacion/`](acceso-lince/documentacion/) |
| Archivo Excel con 100 alumnos ficticios | [`acceso-lince/ejemplos/`](acceso-lince/ejemplos/) |

**Inicio rápido web:** instalar Node.js 22.13+; abrir `acceso-lince/web/`; ejecutar `INICIAR_ACCESO_LINCE.bat`; completar el alta inicial de Dirección; entrar a `http://localhost:3000`.

**Android:** en [GitHub Actions](https://github.com/JREP4114/APP-android/actions) ejecutar o consultar **Compilar ACCESO LINCE VIGILANCIA desde codigo**. Descarga el APK desde los artefactos de una ejecución exitosa.

### Seguridad
Este es un prototipo académico para **datos ficticios**, no un sistema de producción. No se publican bases SQLite, usuarios ni contraseñas reales, documentos de identidad, fotos personales, claves ni tokens. Antes de operar con datos personales reales son necesarios HTTPS, autenticación reforzada, autorización institucional, medidas de privacidad y pruebas adicionales.

---

## Histórico de la primera aplicación de vigilancia

La siguiente documentación corresponde a la primera versión Android y se conserva como referencia. **Para el proyecto actual utiliza las carpetas anteriores.**

# LINCE GUARD — Primera versión Android

Aplicación Android de pruebas que escanea QR y códigos de barras continuamente con CameraX + ML Kit y valida las entradas desde el servidor LINCE ACCESS.

## Cómo generar el APK sin Android Studio

1. Descarga del chat el archivo **LINCE_GUARD_GITHUB_ACTIONS_LISTO.zip** (archivo fuente, ~17 KB).
2. En GitHub, en este repositorio, pulsa **Add file → Upload files**.
3. Sube el **ZIP SIN DESCOMPRIMIR**, con el nombre exacto `LINCE_GUARD_GITHUB_ACTIONS_LISTO.zip`, a la **raíz** del repositorio. Haz clic en **Commit changes** en `main`.
4. Abre **Actions → LINCE GUARD - Compilar APK Android**. Se ejecutará automáticamente cuando llegue el ZIP.
5. Si la compilación queda en verde, entra en la ejecución y descarga el artefacto **LINCE_GUARD_APK_ANDROID**.
6. Extrae el ZIP del artefacto; dentro estará `LINCE_GUARD_V0_3_1_DEBUG.apk` para instalarlo en tu teléfono Android.

El flujo `.github/workflows/compilar-apk.yml` ya está configurado para extraer el ZIP, probar Java, compilar el APK y publicarlo.

Si se muestra una X roja en Actions, comparte la captura del primer paso fallido para corregir el problema de compilación.

## Prueba con laptop y teléfono

- En la laptop ejecuta `iniciar-lince.bat` **de la V0.3.1 completa**.
- Conecta el Android a la misma red local compartida (por ejemplo `JREP 2821`).
- Configura la dirección IP real de la laptop en la app Android; `http://192.168.137.1:3000` es un ejemplo frecuente para el punto de acceso de Windows.
- Usa únicamente usuarios y alumnos ficticios durante las pruebas.

**Aviso de seguridad:** este es un prototipo educativo que utiliza HTTP en red local y credenciales de prueba. No subir bases de datos ni datos personales de estudiantes.
