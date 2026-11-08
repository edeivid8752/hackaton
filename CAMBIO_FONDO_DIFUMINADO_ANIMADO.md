# Nuevo fondo guinda difuminado y animado — LinceAccess V0.2

Este ajuste cambia **solo** `public/uadeo-background.css`.

- Se sustituyó el fondo blanco/gris y sus anillos geométricos por una base rosada-guinda presente en toda el área del administrador.
- Se añadieron dos capas de degradados radiales sin bordes, que mezclan tonos del guinda UAdeO (#9D253C), vino oscuro, rosa y rosa pálido.
- Los degradados se desplazan muy lentamente (25 y 32 segundos) para crear un efecto ambiental sin distraer del contenido.
- Todas las tarjetas, menús, botones, estadísticas, animaciones anteriores, API y SQLite permanecen iguales.
- El movimiento ambiental se desactiva cuando el sistema operativo tiene activado **reducir movimiento**.
- El inicio de sesión y la interfaz de guardia permanecen sin cambios.

Para iniciar: `node server.js` y visitar http://127.0.0.1:3000/.
