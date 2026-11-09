# LINCE ADMIN V0.4 · Nueva interfaz sobre servidor V0.3.1

## Qué se preservó

- Servidor Node.js y SQLite V0.3.1, con todas las tablas, cierre automático, códigos y eventos inmutables.
- Rutas de Android `/api/login`, `/api/scan`, `/api/stats`, `/api/visitors`, `/api/logout` y cookies de sesión (sin cambiar su formato).
- Código fuente Android nativo en `ANDROID/LINCE_GUARD_ANDROID` sin modificaciones.
- Del boceto V0.2 se mantuvieron logotipo UAdeO, inicio de sesión, dashboard, animaciones, menú lateral flotante, seis paletas predefinidas y editor de color personalizado.

## Lo nuevo para administración y dirección

- Página web **solo para administración y dirección**. El antiguo kiosco web y su página `guard.html` fueron retirados.
- Indicador de conexión en vivo entre panel web y servidor.
- Módulo de **Reportes** con ingresos del día, aforo, ocupación, carreras y grupos actualmente presentes.
- **Historial** con búsqueda, filtros por fecha/tipo y exportación CSV (solamente los **últimos 250 movimientos**, según el límite actual del servidor).
- Vista de **autorizaciones temporales** de visitantes y proveedores, vigencia y presencia.
- **Activar/desactivar credenciales** desde Comunidad, reservado a administración. Si la persona está dentro, el sistema impide desactivarla hasta registrar salida.
- **Dirección** consulta datos, historial, reportes y apariencia sin crear personas ni modificar la configuración de aforo.

## Permisos reales en el servidor

| Operación | Administración | Dirección | Guardia Android |
|---|---|---|---|
| Ver aforo | Sí | Sí | Sí |
| Ver directorio, historial y visitantes | Sí | Sí | No |
| Crear/activar/desactivar personas | Sí | No | No |
| Crear visita temporal | Sí | No | Sí* |
| Cambiar configuración de aforo/eventos | Sí | No | No |
| Registrar entrada/salida | **No** | **No** | Sí |

\* Se conserva el endpoint de visitas desde la app Android para no romper su flujo.

## Cómo actualizar sin perder datos

**No reemplaces directamente tu carpeta anterior.** Extrae el ZIP en carpeta nueva. Cierra ambos servidores. Ejecuta `IMPORTAR_BASE_EXISTENTE.bat` en V0.4 e indica el archivo `lince-data.sqlite` de V0.3.1. El importador crea una copia SQLite consistente, conserva el origen y respalda cualquier base de destino preexistente. Después inicia V0.4.

Si no importas la base, se crearán únicamente **datos ficticios de demostración** nuevos al arrancar el servidor.

## Pendientes de producción

Se requiere despliegue con HTTPS, cuentas reales en almacén seguro, contraseñas fuera del código, controles completos de sesión, protección de datos, auditoría de modificaciones, y pruebas con carga antes de operar con alumnos reales. La versión presente es un prototipo de hackatón para red local y datos ficticios.
