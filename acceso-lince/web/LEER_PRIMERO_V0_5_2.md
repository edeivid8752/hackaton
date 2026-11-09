# ACCESO LINCE V0.5.2 — Último ajuste web para la nueva app Android

## Resumen
Esta versión conserva la web y las APIs anteriores, y agrega la infraestructura que necesitará LINCE GUARD en su próxima actualización:

1. Múltiples guardias y múltiples Androids operando simultáneamente; no hay restricción de un solo guardia por turno.
2. **Inicio de sesión de vigilantes por gafete QR y Android vinculado, SIN PIN.** El dispositivo se autoriza una vez desde Dirección/Administración. El QR debe pertenecer a un guardia activo; cualquier otro tipo de credencial se rechaza.
3. **Dispositivos Android** en el menú administrativo: vincular nuevos equipos con código de un solo uso de 10 minutos, consultar su última actividad, puerta, último operador y revocar acceso.
4. **Ingresos exprés** en la web: supervisar el registro que hará la app al fotografiar una INE (visitante) o gafete (proveedor). Registra tipo, hora, guardia, acceso, presencia y un comprobante fotográfico temporal cifrado.
5. Protección ante escaneos duplicados casi simultáneos de distintos dispositivos y ante reintentos repetidos de subida de la misma fotografía.
6. Conserva la programación, entrega y recepción de turnos de V0.5.1. Nunca inventa salidas físicas.

## Instalar el parche conservando tu base de estudiantes

1. **Cierra** `iniciar-lince.bat` y todas las ventanas de servidor Node.
2. **Haz una copia COMPLETA** de la carpeta actual de ACCESO LINCE, incluida `lince-data.sqlite` y, si existen, `lince-data.sqlite-wal`, `lince-data.sqlite-shm`. La mejor copia se hace con el servidor detenido.
3. Extrae `ACCESO_LINCE_V0_5_2_PARCHE_WEB.zip`.
4. Copia los archivos/carpetas que contiene **a la carpeta que tiene `iniciar-lince.bat`**, reemplazando archivos con el mismo nombre. No copies una carpeta dentro de otra por error.
5. Inicia con tu **mismo** `iniciar-lince.bat` y entra a `http://localhost:3000`; actualiza con `Ctrl + F5`.
6. Abre Dirección/Administración: aparecerán **Dispositivos Android** e **Ingresos exprés**.

**El parche NO incluye ni reemplaza ninguna base de datos ni archivos de cuentas.** La primera ejecución agrega nuevas tablas a tu SQLite, sin borrar alumnos, claves, QR ni movimientos.

## Qué es operativo HOY
- La web puede generar códigos de vinculación, listar/revocar Androids y mostrar registros de ingresos exprés.
- La API de gafete QR ya admite sesiones de guardias desde diversos dispositivos registrados.
- La API de fotografía ya registra la entrada y conserva temporalmente una foto cifrada.
- El APK Android que está instalado **NO tiene todavía** la pantalla para introducir el código de vinculación, abrir sesión con su propio QR ni los botones de fotografía o relevos. ¡Estas pantallas se crearán al actualizar el APK! El método anterior por contraseña sigue disponible para no romper la app instalada.
- Los turnos existentes continúan igual. Registrar entrada física y marcar comienzo del turno son acciones diferentes.

## Sobre las fotografías de INE / gafetes
- En esta demo **NO se hace OCR** ni se garantiza la autenticidad del documento. El guardia debe revisar el original e informar al visitante/proveedor del uso de la fotografía.
- Para la versión de prueba, utilizar documentos ficticios o no sensibles. No usar INE reales antes de contar con autorización institucional, aviso de privacidad, evaluación de necesidades y retención aprobada.
- Las fotos están cifradas (AES-256-GCM), con retención de **24 horas**. La tabla conserva los metadatos y el registro histórico después de borrar el contenido de la imagen.
- En el primer ingreso exprés se crea el archivo privado `.lince-photo-key` junto al servidor; el archivo contiene la clave de cifrado. **Nunca lo compartas**. Si haces respaldo de la base que contiene imágenes pendientes, resguarda la clave junto con el respaldo de manera segura. Si pierdes esa clave, no podrás recuperar las fotografías cifradas.
- No se almacenan por OCR domicilios, CURP ni claves de elector; las imágenes completas sí podrían contener estos datos durante la retención, por eso la restricción es importante.

## Limitaciones y seguridad
- Un QR físico puede fotografiarse y copiarse. Vincular el Android evita el uso desde dispositivos desconocidos, pero **NO verifica por sí mismo que la persona que presenta el QR sea su dueño**. Sin PIN por preferencia expresa del proyecto; aún no es un método seguro para identidad real de una institución.
- En red compartida sin HTTPS, ni el QR ni el token del dispositivo están protegidos en tránsito. Antes de utilizar personas reales o hacer despliegue universitario: HTTPS, control de acceso físico al Android, administración de dispositivos, protección de datos, pruebas de seguridad y validación institucional.
- Tras migrar TODOS los Android al nuevo QR, se puede impedir el login anterior de vigilantes poniendo `LINCE_REQUIRE_PAIRED_GUARD=1` en el entorno del servidor. **No activar todavía**, porque dejaría sin acceso por contraseña a la app anterior.
- El código de vinculación sirve una sola vez y vence a los 10 minutos. Cada equipo debe guardar su token de forma segura. La revocación deja inválidas las sesiones de ese equipo.

## Pruebas
`npm test` con Node 22.13 o superior.
En la versión entregada se verificaron **280 comprobaciones automáticas** en las suites anteriores y la nueva prueba de múltiples dispositivos y capturas.
Eso no sustituye la prueba con Android físico ni una auditoría de seguridad.
