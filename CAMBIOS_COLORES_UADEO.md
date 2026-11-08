# LinceAccess V0.2 — Corrección de colores UAdeO

**Alcance:** exclusivamente apariencia visual del administrador.

## Cambios
- Barra lateral que se revela automáticamente al acercar el cursor: degradado rojo guinda UAdeO (#9D253C como referencia) y textos/iconos de alto contraste.
- Selección de navegación en guinda más claro; pestañas no seleccionadas legibles.
- Acciones principales, como actualizar, validar, crear y guardar: guinda institucional con estado hover más oscuro.
- Botones secundarios: bordes y textos guinda discretos; acciones neutrales se conservan neutrales.
- Marcador lateral del título y línea de acento en el panel inferior: guinda.
- Indicadores semánticos de acceso correcto, errores y estado operativo mantienen sus colores para evitar confusiones.

## Lo que NO cambia
- El comportamiento hover de apertura y cierre automático de la barra.
- Animaciones de tarjetas, conteos, gráficas, vistas y notificaciones.
- app.js, sidebar-ui.js, admin-motion.js, server.js, rutas/API, SQLite, permisos, registro de accesos y app del guardia.

## Archivos
- Nuevo: `public/uadeo-colors.css` (sobrescribe solo estilos).
- Editado: `public/index.html` para cargar la hoja al final.

Prueba local: desde el directorio donde está `server.js`, ejecutar `node server.js`, abrir `http://127.0.0.1:3000/`.
