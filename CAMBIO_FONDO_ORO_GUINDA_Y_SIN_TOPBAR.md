# Cambio visual: UAdeO guinda + oro / barra superior eliminada

- Se partió de la versión FONDO_GUINDA_DIFUMINADO_ANIMADO.
- Se eliminó completamente la barra superior del HTML del administrador (sin sustituirla por otra barra).
- Los cuatro identificadores de compatibilidad (`pageTitle`, `breadcrumb`, `clock`, `topAvatar`) permanecen ocultos para no romper `app.js`.
- El botón móvil de menú queda flotante sin encabezado; conserva su ID y el mismo controlador de eventos.
- Se sustituyeron las superficies blancas de tarjetas, paneles, tablas y entradas del administrador por variaciones suaves del oro institucional `#D0A76B`.
- El lienzo completo combina rojo guinda `#9D253C` y oro mediante gradientes difuminados con animación ambiental, sin patrones geométricos.
- Colores y estilos nuevos en `public/uadeo-gold-theme.css`; ninguna modificación al servidor, base de datos, autenticación ni scripts originales.
- Para reducir movimiento, las animaciones ambientales se desactivan respetando la preferencia del sistema.

## Ejecutar
`node server.js` y abrir `http://127.0.0.1:3000/`. Si se ve una versión antigua: Ctrl + Shift + R.
