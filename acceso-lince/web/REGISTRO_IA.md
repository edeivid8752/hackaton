# Registro inicial de asistencia con IA — Hackatón LinceCode 2026

**Herramienta:** ChatGPT (GPT-6). **Fecha de preparación:** 7 de noviembre de 2026.

Este registro comienza con las instrucciones relacionadas con LINCE ACCESS en la conversación actual. Debe completarse con futuras consultas y los prompts usados durante las 24 horas del hackatón. Los archivos adjuntos (convocatoria y audio) fueron aportados por el participante; el audio fue transcrito utilizando Descript.

## Prompts del participante, en orden

1. «Bro se viene el hackaton en mi universidad vamos a empezar tu y yo contra todos».
2. Se adjuntaron cuatro fotografías de la convocatoria y una grabación de aproximadamente 26 minutos y 44 segundos.
3. «vava igual el pdf seria asta el ultimo».
4. «vava escuchaste todo el audio».
5. «vava escucha el audio».
6. «se queda cargando el complemento help».
7. «yaya quedo haz lo del audio».
8. «vava peerfecto como quieres empezar».
9. «colores tipo uadeo».
10. «igual ay que ver cual es lo primero que haremos».
11. «vava, vamos a empezar ya».

## Qué se produjo en esta etapa

- Análisis de requisitos del audio y convocatoria con mención de proveedores, cierre nocturno y accesibilidad.
- Diseño de arquitectura del prototipo V0.1.
- Implementación inicial de software funcional (servidor local, SQLite, SSE, kiosco, visitantes, administración y pruebas).
- Generación de credenciales ficticias QR para validación en vivo.

**Nota:** Conservar el historial original completo en ChatGPT, porque este resumen no reemplaza la evidencia cronológica íntegra que soliciten los organizadores. Es necesario verificar si se permite iniciar código antes del comienzo oficial del concurso.

## V0.2 — 7 de noviembre de 2026

### Instrucciones del usuario adicionales (orden cronológico, textuales)

1. "OKEY, ay que pensar en la accesibilidad para los guardias y pensar en acerlo para tables android"
2. "vava , tengo mi telefono android para probarlo sin problema entopnces hariamos 2 diferentes la web para dirrecion  y administracion y la de guardias para dispositivos moviles o tablets"
3. "va a darle bro confio"

### Cambios implementados con ayuda de ChatGPT

- Separación de LINCE ADMIN (módulos de dirección, administración, reportes) y LINCE GUARD (accesos y visitantes móviles).
- Diseño de guardia accesible: colores institucionales inspirados en UAdeO, botones grandes, lenguaje claro, símbolos, audio y vibración opcionales.
- Integración con la misma API, SQLite y SSE de V0.1, sin pérdida del registro histórico.
- Alternativa para captura fotográfica QR en Android por HTTP mediante `input capture` y jsQR; se reserva video continuo para HTTPS.
- Arranque Windows en red privada, guía de pruebas con Android y pruebas automatizadas adicionales.

**Nota documental:** este registro no equivale a la exportación completa de prompts de la conversación. Para el PDF final se deberá adjuntar la cronología real y completa solicitada por los organizadores.

## V0.3 — 7 de noviembre de 2026 (continuación)

**Petición del usuario:** «Necesitamos que escanee siempre en vivo ... no lee con las fotos ...» y «vava vamos a hacerlo porque me gusto que justo cree un nuevo alumno y puse sau numero y funciono me gusto esa conectividad».

**Objetivos acordados:**
- Mantener LINCE ADMIN web y sus registros persistentes; no reemplazar la base de datos.
- Proporcionar código fuente de LINCE GUARD Android nativo con vista de cámara permanente durante su uso, sin dependencia del permiso HTTPS de Chrome por HTTP local.
- Decodificar QR y códigos de barras de forma continua con CameraX y modelo ML Kit empaquetado para escaneo sin conexión a Internet público.
- Conservar validación central de la API y actualización del dashboard en vivo, junto con las autorizaciones, rebotes y registros inmutables anteriores.
- Antirrepetición local: exigir retirada de la credencial antes de otra lectura; 12 segundos de protección central.
- Conservar entrada manual como respaldo para las pruebas y una forma segura de migrar usuarios/historial desde V0.2.
- No afirmar que hay APK instalado ni pruebas físicas hasta compilación y validación Android reales.

**Cambios efectuados:** `ANDROID/LINCE_GUARD_ANDROID` (proyecto nativo), `ScanGate.java`, test Java de antirrepetición, prueba integrada `tests/connectivity.js`, herramienta `migrar_alumnos_desde_V02.bat` con copia SQLite consistente y manuales V0.3.

**Pendiente:** compilar en Android Studio con SDK y Gradle, instalar en Android real, probar cámara y enfoque, escanear códigos nuevos, validar estados del servidor, evaluar modo de lector por entrada/salida independientes, robustecer HTTPS/autenticación antes de uso real.
