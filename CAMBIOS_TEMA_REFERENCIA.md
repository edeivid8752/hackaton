# LinceAccess V0.2 · Tema azul y turquesa (referencia visual)

Rediseño de la interfaz web administrativa basado en la referencia aprobada.

- Barra lateral azul marino que comienza contraída (94 px), se despliega (258 px) con un botón y conserva la selección tras recargar.
- Iconos de navegación y distribución mejorados.
- Cabecera LinceAccess, resumen de ocupación, tarjetas con bordes suaves, gráficas en turquesa y tabla de movimientos sin cambiar sus fuentes.
- Aro porcentual del aforo calculado solo leyendo los contadores que ya muestra la aplicación.
- Menú móvil, pantallas de guardia, registros y control de sesión conservados.

Archivos modificados/agregados: `public/index.html`, `public/sidebar-ui.js`, `public/reference-theme.css`, `CAMBIOS_TEMA_REFERENCIA.md`.

NO SE MODIFICARON `server.js`, `public/app.js`, `public/guard.html`, `public/guard.js`, `public/guard.css`, ni la base de datos.

Instrucciones: abre una terminal en la carpeta que contiene `server.js`, ejecuta `node server.js` y visita `http://localhost:3000/`. Antes de arrancar, cierra el servidor anterior si usa el puerto 3000.

Los valores del dashboard son datos reales devueltos por la versión local, no números de la imagen ilustrativa.
