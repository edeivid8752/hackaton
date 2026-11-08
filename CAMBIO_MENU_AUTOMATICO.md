# Cambio visual: menú lateral automático por cursor

Esta entrega parte de `LINCE_ACCESS_V0_2_AZUL_TURQUESA.zip` y se limita a la interfaz del administrador.

## Interacción nueva en PC
- La barra azul queda fuera de la pantalla mientras no se usa. El tablero aprovecha todo el ancho.
- Acerca el cursor a los **primeros 20 píxeles del borde izquierdo** (hay una guía turquesa muy fina). La barra entra suavemente, completa, con todas sus opciones.
- Al sacar el cursor del panel hacia el tablero, la barra sale y desaparece automáticamente.
- Los botones de navegación, cierre de sesión y restricciones de rol se conservan.
- También se puede acceder al menú con `Tab`, y cerrarlo con `Esc`.
- En dispositivos táctiles/pantallas pequeñas se conserva el menú móvil del proyecto original.

## Archivos que cambian
- `public/index.html`: reubicación del elemento visual que activa el menú y carga de un CSS adicional.
- `public/sidebar-ui.js`: cambio de la interacción visual; se conserva la actualización del círculo de aforo.
- `public/sidebar-hover.css`: archivo nuevo que aplica ocultación, flotación y animación del panel.

**Sin cambios** en `server.js`, `public/app.js`, `public/guard.*`, base de datos, endpoints ni reglas de registro.

## Inicio
En una terminal dentro de la carpeta principal:

```bash
node server.js
```

En Firefox escribe manualmente `http://127.0.0.1:3000/`.
Si el puerto 3000 está ocupado, cierra primero el servidor anterior con Ctrl+C.
