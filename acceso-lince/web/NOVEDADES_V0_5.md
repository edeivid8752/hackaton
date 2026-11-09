# LINCE ACCESS V0.5 — Registro de implementación

## Realizado en la web + servidor

- Se conservó el **cascarón del diseño V0.4** y sus seis paletas, editor de color personalizado, logo UAdeO, menú lateral y estadísticas.
- La web tiene **login único**: Dirección, Administración y Alumnos obtienen secciones según su rol; escaneo web para guardias sigue eliminado.
- Cuentas **persistentes en SQLite**, verificadas con `scrypt` y sal aleatoria. Cuentas demo previas conservadas en modo de pruebas.
- Cuenta institucional creada automáticamente con altas de estudiantes; los docentes y empleados comunes no reciben cuenta web por ahora.
- **QR reales (SVG, validables por Android)** para estudiantes, director, administrativos, guardias, docentes y visitantes. Rotación y revocación por reposición de credencial.
- Perfil y credencial propios; estudiantes pueden descargar el **QR SVG o la credencial digital PNG** con fotografía o avatar predeterminado.
- **Importación CSV/XLSX sin npm**: validación de duplicados y datos, previsualización, confirmación atómica, resultado y ZIP con QR por matrícula. Prueba automatizada con 500 alumnos.
- Gestión restringida de cuentas: Dirección administra administradores y guardias; Administración administra guardias. Desactivación conserva historia y revoca acceso.
- Panel personal del estudiante con días de entrada registrados y historial individual; no se inventan faltas académicas.
- **Cierre estadístico a las 23:59** con pendientes de salida; no se crean salidas físicas falsas ni se borra el aforo real.
- Eventos de múltiples jornadas: crear, editar, cancelar, auditar. Inicio y fin fecha/hora, para hackatones 24 h y similares.
- Historial con **Volver al panel**; cierre de sesión con icono de encendido; corrección manual de salida con motivo obligatorio.
- Visitantes con QR temporal; ajustes de aforo accesibles a Dirección y Administración.
- Inicio de base totalmente limpia e independiente (`iniciar-lince-limpio.bat`).
- Compatibilidad de `/api/login`, `/api/scan`, `/api/stats` y flujo Android V0.3.1 **sin recompilar APK**.

## Dejamos para la siguiente actualización

- Perfil de guardia, control de cambios de turno, relevos, alertas y descarga de gafete físico PDF **desde Android**.
- Reglas de asistencia académica por horario, calendario, faltas justificadas, feriados y periodos.
- Entrega segura a gran escala de contraseñas para despliegues reales, recuperación con correo institucional y HTTPS público.
- Pruebas visuales finales y pruebas con Android físico en tu laptop y Wi-Fi; las pruebas automáticas no sustituyen esta verificación.

## Observaciones de seguridad

- No almacenar registros reales de UAdeO en este prototipo local sin aprobación y revisión técnica.
- Patrón predecible de contraseña **solo DEMO** y con alumnos ficticios; producción local (`LINCE_DEMO=0`) usa contraseñas aleatorias iniciales.
- El QR estático se puede copiar o fotografiar: mantener validación de identidad en el acceso y posibilidad de rotación.
- El cierre diario es un corte administrativo, no prueba de que todos abandonaron físicamente el campus.
