# LINCE ACCESS — Mapa técnico del proyecto

## Objetivo
Controlar entradas y salidas de alumnos, docentes y administrativos; gestionar visitas y proveedores; medir la presencia estimada por tipo, carrera y grupo; y presentar trazabilidad y alertas para dirección y seguridad.

## Entidades de datos V0.1

- `people`: personas, rol institucional, matrícula/código de prueba, carrera y grupo, estatus y vencimiento en visitantes.
- `presence`: estado actual y último escaneo aceptado por persona.
- `access_events`: historial inmutable (entrada, salida, salida automática), marca temporal UTC, usuario operador.
- `config`: capacidad, fecha de cierre y excepción para evento nocturno.

## Flujo de acceso

`Lector / campo de texto / cámara` → `verificar formato de código` → `buscar persona` → `verificar vigencia / estatus` → `evitar rebote 12 s` → `alternar ingreso/egreso` → `evento append-only + presencia` → `SSE → tablero en vivo`.

Para visitantes: `Guardia registra nombre, motivo, área anfitriona y vigencia` → `código temporal` → `verificación de identidad` → `escaneo`.

## Incluido en V0.1

- [x] Servidor local y base SQLite persistente.
- [x] Roles demostrativos guardia, dirección, administración.
- [x] Kiosco y validación de credenciales.
- [x] Control de rebotes durante 12 segundos.
- [x] Entrada/salida, aforo por carrera y grupo.
- [x] Dashboard responsive con actualización SSE.
- [x] Visitantes y proveedores con códigos temporales.
- [x] Historial inmutable e identificación de cierres automáticos.
- [x] Cierre por cambio de fecha institucional y excepción nocturna temporal.
- [x] Tres QR de prueba y escaneo con cámara en navegadores compatibles.
- [x] Pruebas de integración automatizadas.

## Pendiente en siguientes versiones (requisitos de convocatoria)

- [ ] Fotografía real verificada del usuario; interfaz de imagen visible en kiosco (ahora solo nombre / datos).
- [ ] Lectura comprobada con hardware USB real y credenciales UAdeO (sin guardar datos privados).
- [ ] Notificaciones de entrada/salida por correo o WhatsApp basadas en consentimiento explícito; opción de desactivación.
- [ ] Ajustar integración con QR real de la credencial (no asumir que su contenido es la matrícula).
- [ ] IA de anomalías o consultas autorizadas de aforo (Nivel 3).
- [ ] Refuerzo de seguridad: HTTPS, autenticación real, secretos de entorno, validación de credenciales criptográficas, rate-limit, respaldo y cifrado, permisos por recurso.
- [ ] Opciones para operadores con necesidades de accesibilidad: audio más robusto, iconos universales, imágenes de usuario, verificación de usabilidad en campo.
- [ ] Pruebas de cierre nocturno programado, recuperación tras apagones, varios kioscos simultáneos, horario de verano y cambio de fecha.
- [ ] Informe PDF final: portada, objetivo, alcance, roles, logo, modelo de BD, flujograma, código, manual, pruebas, evidencia y prompts IA cronológicos.

## Hechos del audio de la convocatoria

- La prioridad del cliente es saber quién entra y sale; el guardia no se da abasto.
- Se permiten tecnologías libres y económicas.
- Deben contemplarse personas externas: invitados, proveedores, repartidores.
- Existen eventos especiales que podrían atravesar la medianoche.
- Las notificaciones a tutor deben ser una opción consentida.
- El aforo se consulta por carrera y grupo; para ubicación física en aula harían falta sensores/lectores adicionales.
- La interfaz debe ser legible y simple incluso para guardias con dificultades de lectoescritura.
- Importa que el prototipo sea funcional y útil, no que use un lenguaje sofisticado.

## Notas de seguridad/precisión

En esta V0.1 se usa alternancia automática de ingreso/salida porque la convocatoria lo describe. Si alguien no registra su salida, el sistema no puede asegurar su ubicación. Los cierres automáticos son estimaciones administrativas, no evidencia de egreso físico. Los datos de demo son ficticios.

## Avance V0.2 (LINCE ADMIN + LINCE GUARD)

- [x] Dos aplicaciones web separadas; **una API y una base SQLite**.
- [x] LINCE GUARD con disposición móvil, botones de 64 px, estados con símbolos + texto, `aria-live`, voz opcional y vibración cuando el navegador la admita.
- [x] LINCE GUARD con escaneo manual, lectura de fotografía QR mediante jsQR (CDN o instalación local opcional), y modo video opcional solamente donde se permita `getUserMedia`.
- [x] Visitantes/proveedores desde la pantalla móvil, con confirmación adicional antes de registrar entrada.
- [x] Servidor escuchando en Wi-Fi privada cuando se usa el `.bat` de Windows y muestra las URLs de Android.
- [x] LINCE ADMIN preserva la información anterior; recibe contador actualizado con **SSE**, no WebSockets.
- [x] 40 pruebas automáticas superadas en servidor local (21 heredadas + 19 nuevas).
- [ ] Validar en **teléfono Android real**: cámara, permisos, velocidad, audio y conexión Wi-Fi.
- [ ] HTTPS confiable para cámara de video continua y PWA instalable en Android (no es APK).
- [ ] Integrar fotos reales de prueba con almacenamiento privado y autorización (no incluido aún).
- [ ] Asegurar autenticación y datos antes de uso institucional.

**Limitación intencional:** el botón de vídeo continuo no promete funcionar por HTTP con IP de Wi-Fi en Android: los navegadores requieren contexto seguro. Para la primera demostración móvil ofrecemos foto del QR o entrada manual. La biblioteca jsQR se descarga desde Internet (CDN) si no se instaló localmente con `preparar-lector-qr-offline.bat`.
