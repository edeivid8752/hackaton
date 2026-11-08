# LinceAccess V0.2 — Animaciones visuales y acentos guinda UAdeO

Actualización únicamente de la apariencia del panel administrativo. Basada en la versión con menú lateral automático.

## Animaciones añadidas

1. Entrada escalonada de las cuatro tarjetas de estadísticas (0,37 s y desfase progresivo).
2. Elevación muy ligera de las tarjetas al pasar el ratón (3 px, 0,19 s).
3. Barras de aforo por carrera que se llenan al cargar datos (0,55 s).
4. Contadores con transición numérica visual (0,60 s). El texto de datos que modifica app.js queda inalterado y sigue disponible para lectores de pantalla y pruebas.
5. Desvanecimiento y desplazamiento leve al cambiar secciones (0,24 s).
6. Notificaciones que entran y salen por deslizamiento (0,23 s); no se modifica su contenido ni su tiempo de duración.

## Identidad visual

Acento guinda UAdeO aproximado: `#9D253C`, aplicado con moderación al marcador del título del dashboard, botón principal de creación de usuario, acceso en inicio de sesión y detalle de navegación activa. Se conservan los azules marinos y turquesas restantes.

## Archivos cambiados

- `public/index.html`: incluye dos recursos nuevos (hoja de estilo y script visual).
- `public/admin-motion.css`: color acento y microanimaciones.
- `public/admin-motion.js`: animación de números puramente visual.
- `CAMBIOS_ANIMACIONES_UADEO.md`: esta descripción.

## Archivos NO modificados

- `server.js`, `public/app.js`, `public/guard.js`, `public/guard.css`, `public/guard.html`, archivos de datos y pruebas.
- No se modifica autenticación, control de accesos, cálculos de aforo, historial ni endpoints.

## Accesibilidad

- Preferencia `prefers-reduced-motion`: desactiva las animaciones.
- La interfaz conserva sus controles de teclado, menús y etiquetas.

## Uso

Desde esta carpeta: `node server.js`. Luego abrir `http://127.0.0.1:3000/` en el navegador y entrar con cuenta administrativa de prueba.

Si sigue abierto otro servidor en el puerto 3000, ciérralo antes de iniciar este.
