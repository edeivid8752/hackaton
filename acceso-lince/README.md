# ACCESO LINCE — Control institucional de accesos y aforo

Proyecto académico desarrollado para **Hackatón LinceCode 2026 / UAdeO**.

Incluye:
- **`web/`**: aplicación institucional de Dirección, Administración y estudiantes; servidor Node.js/SQLite (V0.5.2), QR, importación Excel, historial, turnos y dispositivos.
- **`android/`**: proyecto nativo **ACCESO LINCE VIGILANCIA** (V0.5), con escáner de QR, perfiles de vigilantes, registro de visitantes/proveedores y relevos.
- **`documentacion/`**: memoria técnica y manual operativo PDF.
- **`ejemplos/`**: Excel con 100 alumnos **ficticios** para pruebas.

## Ejecutar la web en Windows

1. Instalar **Node.js 22.13 o posterior**.
2. Descargar el repositorio y abrir la carpeta `acceso-lince/web`.
3. Ejecutar **`INICIAR_ACCESO_LINCE.bat`** (o `node server.js`).
4. Durante la primera ejecución, crear Dirección; conservar la contraseña inicial en privado.
5. Abrir `http://localhost:3000` en el navegador.

La base de datos se genera **localmente** en el equipo, no está incluida en GitHub.

## Compilar y vincular Android

Para compilar Android usar Android Studio / Android SDK 35 y Java 17, o la acción de GitHub **Compilar ACCESO LINCE VIGILANCIA desde codigo**.

Con el servidor web encendido, conectar computadora y Android a la misma red. Desde Dirección / Administración generar una vinculación temporal para cada dispositivo; en Android introducir la IP local y el código. Después iniciar como vigilante activo mediante su QR personal.

Los teléfonos autorizados comparten el mismo servidor y pueden operar simultáneamente.

## Seguridad y alcance

**Prototipo académico para datos ficticios.** Funciona sobre HTTP local: no es apto para manejar INE, fotografías ni información personal real sin HTTPS, revisión de seguridad, autorización institucional y controles de privacidad. Los gafetes QR estáticos pueden copiarse y **no** constituyen por sí solos autenticación fuerte.

**No subir**: bases de datos `.sqlite`, archivos con contraseñas, códigos de vinculación, tokens, documentos de identidad, fotos privadas ni llaves de cifrado. Se incluyen reglas de `.gitignore`.

El APK instalable se genera con **GitHub Actions** como artefacto descargable, para no versionar binarios grandes en el código fuente. Revisa `documentacion/` para instrucciones y pruebas.
