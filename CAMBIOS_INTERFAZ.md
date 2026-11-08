# LINCE ACCESS V0.2 — Rediseño visual del administrador

Este paquete conserva la versión funcional de tu compañero. Se modificó **solo la interfaz web de LINCE ADMIN**. El sistema LINCE GUARD no se alteró.

## Cambios

- Menú lateral animado: 250 px expandido y 78 px contraído en PC.
- Botón circular junto al borde superior para contraer/expandir.
- El estado del menú se guarda solo en el almacenamiento local del navegador.
- Al contraer, aparecen únicamente iconos; los botones conservan títulos y etiquetas accesibles.
- En pantallas pequeñas, sigue usándose el menú móvil original.
- Colores más sobrios: azul pizarra, blanco, gris claro y cobre suave.
- Tarjetas, tablas, encabezado, formularios y botones con retoques visuales de coherencia.
- Corrección de etiqueta de versión del panel: V0.2.

## Archivos modificados / agregados

- `public/index.html`: botón del menú, etiquetas y carga del script de interfaz.
- `public/styles.css`: nuevas reglas visuales y animación, agregadas al final.
- `public/sidebar-ui.js`: controlador estrictamente visual del menú.

**Sin cambios:** `server.js`, `public/app.js`, `public/guard.html`, `public/guard.css`, `public/guard.js`, base de datos, pruebas y endpoints.

## Ejecutar

En la carpeta que contiene `server.js`:

```bash
node server.js
```

Abrir http://localhost:3000/ (o el puerto que muestre la consola).

## Pruebas

```bash
npm test
```

Se completaron 40 verificaciones originales (21 de integración + 19 de la versión móvil).

## Precaución

Usar una carpeta distinta de la del avance original para preservar una copia sin cambios.
Las capturas de diseño se crearon con datos visuales de ejemplo, no con registros del campus.
