# LINCE ACCESS V0.2 — LINCE ADMIN + LINCE GUARD

Prototipo **educativo** del reto LinceCode 2026. Dos interfaces independientes que comparten un servidor y una base de datos: **LINCE ADMIN** (dirección y administración, laptop) y **LINCE GUARD** (seguridad, teléfono o tablet Android). Identidad visual *inspirada* en los colores UAdeO; **no** es una aplicación oficial ni un sistema para uso operativo real.

## 1. Cómo iniciar en Windows

1. Instala **Node.js 22.13 o superior** y asegúrate de que `node -v` funciona desde CMD. No es necesario hacer `npm install`.
2. Descomprime todo el ZIP (no ejecutes archivos directamente dentro del ZIP).
3. **Cierra el servidor anterior de V0.1** si sigue abierto en el puerto 3000.
4. Haz doble clic en **`iniciar-lince.bat`** (NO en `iniciar-lince.sh`, que es para Linux/macOS).
5. En la laptop abre **http://localhost:3000/**: esa es **LINCE ADMIN**.
6. Si Windows Firewall pregunta, permite **solamente redes privadas**, no públicas.

No cierres la ventana del servidor mientras estés haciendo pruebas.

## 2. Abrir LINCE GUARD desde tu Android

1. Conecta la **laptop y el Android a la misma red Wi-Fi privada**. Desactiva datos móviles para esta prueba si el teléfono cambia de conexión. En redes de campus con aislamiento de dispositivos podrían no comunicarse.
2. En la ventana negra de Windows se imprimen direcciones como:

   `ANDROID (misma Wi-Fi): http://192.168.1.25:3000/guard.html`

   **La IP es un EJEMPLO**. Usa la que aparezca en tu computadora, correspondiente a su adaptador **Wi-Fi**. No uses literalmente `192.168.1.25` si tu laptop muestra otra dirección.
3. Abre esa dirección en **Chrome en Android**. **No uses `localhost` en el teléfono:** allí `localhost` significa el propio teléfono.
4. Inicia sesión en LINCE GUARD con la cuenta de prueba de seguridad.
5. En la laptop inicia sesión en LINCE ADMIN y observa los contadores en tiempo real.

Si la página no abre, comprueba que el `.bat` sigue ejecutándose, que ambos están en la misma Wi-Fi, que el Firewall permite a Node.js en redes privadas y que estás usando la IP Wi-Fi, no una IP de VirtualBox/WSL/VPN. Algunas redes Wi-Fi públicas aíslan a los clientes entre sí.

## 3. Usuarios de demostración

| Aplicación | Usuario | Contraseña | Permisos |
|---|---|---|---|
| LINCE GUARD | `guardia` | `Guardia123!` | Escaneo y visitantes |
| LINCE ADMIN | `admin` | `Admin123!` | Todos los módulos |
| LINCE ADMIN | `direccion` | `Direccion123!` | Estadísticas, directorio, historial y configuración |

**TODAS SON CUENTAS FICTICIAS con contraseñas públicas.** Nunca pongas el servidor en Internet ni ingreses alumnos reales, credenciales verdaderas, fotos privadas o datos personales. El servidor HTTP no cifra las conexiones de red local. Para producción se necesitan HTTPS, cuentas seguras, consentimiento, protección de datos, controles antifraude y pruebas de hardware.

## 4. Tres formas de leer una credencial en LINCE GUARD

**A. Prueba inmediata con código manual (funciona sin Internet):** en el Android, despliega “Ingresar código manualmente”, escribe `LIN-1001`, pulsa VALIDAR. Debería registrar **ENTRADA AUTORIZADA**, y el contador de LINCE ADMIN aumentará sin recargar la página. Repetir en menos de **12 segundos** debe indicar rebote. Después de 12 segundos vuelve a registrar **SALIDA**. Usa `LIN-9001` para acceso denegado (inactivo).

**B. TOMAR FOTO DEL QR (recomendado para probar cámara desde Android por HTTP):** pulsa el botón naranja, usa la cámara para fotografiar un código QR de prueba o selecciónalo de la galería. El navegador toma una imagen y la biblioteca **jsQR** interpreta el código. Abre los códigos de prueba en la laptop desde **http://localhost:3000/credenciales.html**. La biblioteca puede cargarse desde Internet (CDN). Para prepararla antes de una demo *sin Internet*, ejecuta **`preparar-lector-qr-offline.bat`** una vez en Windows, conectado a Internet. Descarga la biblioteca libre `jsQR 1.4.0` en `public/vendor/jsQR.js`, desde donde la aplicación la servirá localmente. Necesita Internet para **ese paso inicial**, pero no para lecturas posteriores. Algunas versiones de Android muestran selector de imagen en vez de abrir la cámara directamente; usar galería es válido.

**C. ESCANEO EN VIVO (cámara de video):** preparado en el código para navegadores compatibles con `getUserMedia` + `BarcodeDetector` o jsQR, pero **Android accediendo a la IP de laptop por HTTP no permite video en vivo**. Es necesario configurar **HTTPS confiable** para este modo; `localhost` es una excepción solo en el propio equipo. No se implementó HTTPS en esta demo. El botón indica el motivo y ofrece alternativas; **no es un error de tu teléfono**.

Se admite QR en el modo fotografía usando jsQR; para códigos de barras lineales necesitarás lector tipo teclado o un navegador con detección de dichos formatos. Las credenciales físicas UAdeO todavía no están integradas.

## 5. Prueba completa con dos dispositivos

1. Abre LINCE ADMIN en la laptop y LINCE GUARD en Android con los usuarios de prueba.
2. Anota el aforo actual en dirección.
3. Registra `LIN-1001` desde el celular.
4. Comprueba que el contador sube **exactamente en 1** en el celular y en la laptop.
5. Repítelo enseguida; debe marcar **ESCANEO REPETIDO** sin aumentar el contador.
6. Espera más de 12 segundos y registra el código de nuevo; debe registrarse **SALIDA**.
7. Registra `LIN-9001`; el acceso debe quedar **DENEGADO**.
8. Abre la pestaña Visitantes en LINCE GUARD, registra un proveedor ficticio y pulsa **REGISTRAR ENTRADA**. Comprueba en el escritorio el aumento de “Externos”.

La respuesta por voz es opcional y pronuncia **solo el estado**, no el nombre de la persona. La vibración depende del soporte del navegador/dispositivo. Las acciones tienen texto, símbolos y color, además de mensajes accesibles (`aria-live`).

## 6. Arquitectura y archivos

- `server.js`: API HTTP, sesiones demo, validación, SQLite, control de rebotes, aforo y streaming **SSE**.
- `public/index.html`, `public/app.js`, `public/styles.css`: LINCE ADMIN (escritorio).
- `public/guard.html`, `public/guard.js`, `public/guard.css`: LINCE GUARD (móviles/tablets).
- `public/codigos/` y `public/credenciales.html`: códigos QR de prueba.
- `preparar-lector-qr-offline.bat`: descarga opcional de jsQR 1.4.0 para lectura de fotografía sin conexión a Internet después de preparar la demo.
- `tests/smoke.js` y `tests/mobile.js`: pruebas automatizadas.
- `DIAGRAMA_DE_DATOS.md`, `DISEÑO_Y_PENDIENTES.md`, `REGISTRO_IA.md`: material de diseño y registro para documentación final.

Al iniciar se crea automáticamente `lince-data.sqlite` con datos de prueba si no existe. Las entradas y salidas se guardan en una tabla inmutable, pero la demostración no registra fotografías reales ni utiliza verificación física de identidad. Si un usuario olvida fichar su salida, la ocupación puede no coincidir con el aforo real; un cierre automático **no demuestra** salida física. No hay servicio de mensajería ni asistente IA integrado todavía.

Para ejecutar pruebas automatizadas (con Node instalado): abrir CMD en esta carpeta y ejecutar `npm test`. **No se requiere instalar paquetes npm para el servidor.**

## 7. Qué quedó para siguientes fases

- Fotografía vinculada a credenciales con verificación y almacenamiento seguros (hoy se muestra nombre, sin inventar fotografía).
- Escaneo de video continuo por HTTPS confiable desde Android y lector USB físico de credenciales reales.
- Autenticación segura, control granular de permisos, caducidad de sesiones, auditoría de rechazos, mitigación de ataques y restauración desde respaldos.
- Notificaciones voluntarias a tutores, con gestión de consentimiento.
- Detección de anomalías o consultas de IA para el nivel 3 del concurso.
- Pruebas reales en tu teléfono Android y con guardias voluntarios, previo consentimiento y sin datos privados.
- PDF final, tal como acordamos.

**IMPORTANTE SOBRE EL CONCURSO:** confirmen si se permite desarrollar código antes del inicio oficial de las 24 horas. Si no se permite, tomen esta versión como entrenamiento o referencia y respeten las bases.
