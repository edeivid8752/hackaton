# ACCESO LINCE V0.5.1 — Turnos y relevos de guardias

## Qué cambia en la web
- Se agregó **Turnos y relevos** al menú de Dirección y Administración.
- Estos perfiles pueden programar turnos (hasta 36 h, incluso cruzando medianoche), revisar estados, consultar si el guardia escaneó su entrada/salida física y cancelar un turno futuro con motivo.
- Tablero con *En servicio*, *Relevo pendiente*, *Sin cobertura* y *Entregas pendientes*.
- Bitácora de ofertas y aceptaciones de relevo (la parte de confirmación estará disponible al integrar el próximo APK).
- Los horarios de guardias NO se borran con el cierre diario a las 23:59. La entrada al campus y el inicio del servicio son hechos distintos.
- Dirección y Administración pueden consultar, pero NO pueden marcar arbitrariamente un turno como iniciado/entregado usando la interfaz web. Solamente la cuenta del guardia asignado puede confirmar esos movimientos.

## Estado real de la integración
**Web y API:** turnos, programación, controles de permisos, auditoría, ofertas y confirmaciones están implementados y probados.
**Android instalado:** todavía NO tiene botones de *Mi turno*, *Entregar* o *Recibir*. Esas pantallas se implementarán en la siguiente versión del APK. Hasta entonces, los turnos programados se mostrarán como pendientes al llegar su hora, sin fingir que están activos.

## Cómo aplicar el PARCHE sobre tu V0.5 existente (conservando los 300 alumnos)
1. Cierra el servidor `iniciar-lince.bat` (y cualquier ventana de Node que esté usando esa base).
2. Haz una copia de respaldo de **toda tu carpeta V0.5**, incluyendo `lince-data.sqlite`, si existe. No borres ninguna base de datos.
3. Extrae `ACCESO_LINCE_V0_5_1_TURNOS_PARCHE.zip`.
4. Copia su contenido (archivos `server.js`, `shifts.js`, `package.json`, carpeta `public` y `tests`) **dentro de la carpeta que contiene tu `iniciar-lince.bat`**, aceptando reemplazar los archivos homónimos.
5. NO copies ninguna base de datos desde el parche: **el parche no contiene `.sqlite`, `.db`, `.sqlite-wal` ni `.sqlite-shm`**.
6. Ejecuta el mismo `iniciar-lince.bat` que ya utilizabas y abre `http://localhost:3000`; pulsa `Ctrl + F5` si no se ve el módulo.
7. Entra como Dirección o Administración y busca **Turnos y relevos** en el menú. Crea un guardia de prueba desde Gestión de cuentas si aún no existe ninguno.
8. Para probar los QR de guardias, regístralos desde el control Android actual (el escaneo no requiere recompilar APK).

La primera ejecución crea tablas nuevas de turnos en la base SQLite existente, **sin reiniciar ni eliminar alumnos/QR**.

## Pruebas
Desde la carpeta principal, con Node.js 22.13+ disponible:

`npm test`

En esta versión se ejecutan 161 comprobaciones de regresión y 46 comprobaciones específicas de turnos. El resultado de pruebas no equivale a una auditoría de seguridad o puesta en producción.

## Seguridad
Modo demostración: corre en una red privada de pruebas con datos ficticios. El HTTP sin TLS, la gestión local de sesiones y el QR estático de credencial NO son un esquema listo para una universidad operando con datos reales.
