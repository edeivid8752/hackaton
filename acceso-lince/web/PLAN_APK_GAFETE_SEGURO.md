# Plan de la siguiente versión Android — Inicio de sesión con gafete y relevos

## Objetivo confirmado
Que un guardia abra LINCE GUARD y escanee su gafete QR para acceder rápidamente al escáner, **sin escribir matrícula ni contraseña en cada relevo**. La app únicamente debe aceptar cuentas de tipo `guardia` activas.

## Vinculación sin PIN, pero sin tratar el QR como autenticación de alta seguridad
Una fotografía/copiar el QR podría permitir suplantar al guardia y registrar accesos falsos si fuese la única prueba de identidad. Por eso Existe `POST /api/guard/qr-login`, pero exige además una credencial secreta de Android previamente vinculado. No necesita PIN. Esto impide iniciar sesión desde un Android desconocido, pero NO impide la suplantación si alguien posee una copia del gafete y tiene acceso al Android vinculado.

## Diseño propuesto para el APK siguiente
1. **Enrolamiento del Android:** Dirección/Administración autoriza una tablet o teléfono institucional usando un código de vinculación de un solo uso; el Android crea una clave por dispositivo y guarda su credencial en almacenamiento seguro.
2. **Pantalla `Escanear mi gafete`:** la cámara lee el QR personal. El código por sí solo identifica a una persona, pero NO da acceso.
3. **Validación en el servidor:** el dispositivo debe seguir autorizado, la credencial QR estar vigente y el usuario vinculado tener cuenta `guardia` activa. Rechazar alumnos, administrativos, docentes, directora, visitantes y cualquier QR revocado.
4. **Sesión corta y revocable:** el servidor emite una sesión operativa que expira; al entregar turno se cierra y el teléfono vuelve a la pantalla de escaneo.
5. **Sin PIN**, por decisión del proyecto. El dispositivo debe estar vinculado previamente y su credencial secreta se almacenará de forma protegida. Hay un riesgo residual de suplantación mediante QR fotografiado y acceso físico al dispositivo.
6. **Mi perfil y mi QR:** datos personales y credencial. Descargar gafete en PDF preparado para imprimir.
7. **Mi turno / Ofrecer relevo / Aceptar relevo:** usar las rutas protegidas del servidor ya preparadas para confirmar inicio y entrega. Un guardia solo puede operar su propio turno. Dirección y Administración lo observan en vivo desde la web.
8. **Conservar todo lo existente:** CameraX, lectura continua, ML Kit, antirrebote, cola de escaneos, control de acceso y conexión con ACCESO LINCE.

## API de turnos disponible en esta versión web
- `GET /api/shifts` — Dirección / Administración: lista y contadores.
- `POST /api/shifts` — Dirección / Administración: programar.
- `POST /api/shifts/:id/cancel` — Dirección / Administración: cancelar con justificación.
- `GET /api/shifts/mine` — Guardia autenticado: turnos propios.
- `POST /api/shifts/:id/start` — Guardia asignado: comenzar servicio.
- `POST /api/shifts/:id/finish` — Guardia asignado: finalizar.
- `POST /api/shifts/:id/offer` — Guardia saliente: proponer relevo a un turno entrante.
- `POST /api/shifts/:id/accept` — Guardia entrante: aceptar, comenzar su servicio y cerrar el saliente con auditoría.

Las rutas de turno requieren sesión autenticada existente; **la API de login por gafete está disponible en el servidor V0.5.2**, pero el APK aún requiere la nueva compilación para utilizarla.
