# Contrato API para la próxima versión de LINCE GUARD Android

Esta es la referencia de integración. El APK V0.3.1 actualmente instalado no implementa estas pantallas.

## A. Alta de un dispositivo
Dirección/Administración genera código en la web: `POST /api/devices/pair` con `{ "name": "Tableta Norte", "gate": "Puerta norte" }` bajo cookie administrativa. Respuesta: `pair_code` hexadecimal de 16 caracteres, válido por 10 minutos (solo se muestra una vez).

Desde Android aún sin sesión: `POST /api/devices/enroll` con `{ "pair_code": "<CODIGO>" }`. Respuesta: `{ "device": {"id": 1,"name":"...","gate":"..."}, "device_token":"dev_..." }`. **Guardar `device_token` en Android Keystore/almacenamiento seguro; nunca compartirlo ni incluirlo en logs.** Cada equipo se vincula una vez.

## B. Entrada rápida con gafete, SIN PIN
`POST /api/guard/qr-login`
- Cabecera: `X-Lince-Device-Token: dev_<token del equipo>`
- JSON: `{ "code": "LIN-..." }`
- El QR debe pertenecer a `guardia` con cuenta y ficha activas, no revocado ni vencido.
- Devuelve `Set-Cookie: lince_sid=...; HttpOnly; SameSite=Strict`, datos mínimos del guardia y la puerta vinculada; la sesión QR dura 4 horas.
- **En todas las peticiones posteriores** enviar tanto la cookie de sesión como el encabezado del dispositivo. Si falta cualquiera, recibirá 401.
- Una nueva lectura de otro guardia en el mismo equipo sustituye su sesión; en otros equipos son independientes. No interrumpe turnos activos registrados, que deben cerrarse mediante API.
- `POST /api/logout` termina la sesión del guardia (también requiere cookie y token del equipo).
- No se usa PIN. No confundir con validación fuerte de identidad.

## C. Escáner habitual
Con cookie y encabezado del dispositivo ya activos: `POST /api/scan` con `{ "code":"LIN-..." }`. El servidor determina entrada/salida automáticamente y usa la puerta asignada al dispositivo. Reintentos dentro de 12 segundos se ignoran; dos Androids casi simultáneos solo generan un movimiento. Conserva los mensajes existentes.

## D. Ingreso exprés con fotografía
Un guardia autenticado usando gafete y Android vinculado envía `POST /api/express-entry` con cookie y cabecera del dispositivo.
```json
{
  "kind":"visitante",
  "photo_type":"ine",
  "photo_data":"data:image/jpeg;base64,...",
  "request_id":"identificador_unico_aleatorio_por_captura_1234",
  "document_checked":true,
  "notice_confirmed":true
}
```
- Para `proveedor`, usar `photo_type: "gafete"`.
- JPEG/PNG/WEBP, entre 2 KB y 900 KB. Comprimir/redimensionar foto en Android antes de enviar.
- **El guardia debe revisar el documento original y confirmar aviso de privacidad**. Esto se puede hacer en la misma pantalla de captura, sin escribir formularios.
- La primera petición crea persona externa temporal, marca presencia dentro y registra acción `entrada` con operador, fecha, puerta y referencia cifrada a foto. Respuesta 201.
- Si se reenvía el mismo `request_id` desde el mismo dispositivo, retorna 200 con `duplicate:true` sin crear otra entrada.
- No hay OCR ni reconocimiento de autenticidad automáticos; se describe como registro fotográfico. Para uso real es necesario definir requisitos de identificación/autoridad y tratamiento de datos antes de guardar INE.
- La foto se destruye tras 24 horas. La bitácora queda.

## E. Turnos y relevos (API previa, ya habilitada)
- `GET /api/shifts/mine`
- `POST /api/shifts/:id/start` — comenzar servicio
- `POST /api/shifts/:id/finish` — terminar servicio
- `POST /api/shifts/:id/offer` con `to_shift_id` — ofrecer relevo
- `POST /api/shifts/:id/accept` — recibir relevo

La entrada física por QR NO equivale automáticamente a comenzar el turno. Múltiples guardias pueden iniciar turnos distintos al mismo tiempo y distintos dispositivos pueden operar en puertas diferentes.

## F. Supervisión web
- `GET /api/devices` — solo Dirección/Administración.
- `POST /api/devices/:id/revoke` con `{ "reason":"..." }` (mínimo ocho caracteres).
- `GET /api/express-entries` — solo Dirección/Administración.
- `GET /api/express-entries/:id/photo` — fotografía temporal cifrada, descifrada solo para admin autorizado y después eliminada.

**Seguridad:** sistema de demostración. El QR estático + dispositivo autorizado no prueba identidad personal contra alguien con acceso al equipo y una copia del gafete. En producción será necesario un mecanismo adicional y TLS.
