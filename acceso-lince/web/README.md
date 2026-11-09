# 🐆 LINCE ACCESS V0.5 — Web universitaria unificada + LINCE GUARD Android

**Versión de pruebas del hackatón LinceCode 2026.** Esta versión se construyó SOBRE la V0.4 funcional, conservando el cascarón visual de UAdeO (logo, seis paletas + editor personalizado, animaciones, menú lateral), las API de entrada/salida y la carpeta de código fuente de LINCE GUARD Android.

## ¡Empieza aquí! (Windows)

1. **Extrae el ZIP en una carpeta NUEVA. No borres tu V0.4, V0.3.1 ni su SQLite.**
2. Necesitas **Node.js 22.13 o superior** (probado con Node 22.16). No se requiere `npm install`, Android Studio ni conexión a Internet para arrancar.
3. **Si deseas conservar tu base anterior**, cierra los servidores y ejecuta `IMPORTAR_BASE_EXISTENTE.bat` con el `lince-data.sqlite` anterior **ANTES del primer inicio**. Se conserva el original y el importador hace copias de respaldo.
4. Para usar la **demo con datos ficticios**, ejecuta **`iniciar-lince.bat`**. Abre `http://localhost:3000`.
5. Para una **base realmente vacía de alumnos**, usa **`iniciar-lince-limpio.bat`** desde una carpeta nueva: crea `lince-institucional.sqlite`, solicita una identificación y un nombre para Dirección, y genera su contraseña aleatoria una sola vez. Esa base se mantiene **separada** de la demo.

**Cuentas ficticias de la demo** (solo en modo `LINCE_DEMO=1`):

| Rol | Usuario para el login | Contraseña de prueba | Identificación institucional equivalente |
|---|---|---|---|
| Dirección | `direccion` | `Direccion123!` | `DIR-DEMO` |
| Administración | `admin` | `Admin123!` | `ADM-DEMO` |
| Guardia Android | `guardia` | `Guardia123!` | `SEG-DEMO` |

Por compatibilidad, los nombres de las cuentas ficticias antiguas siguen sirviendo; también puedes iniciar sesión con sus identificaciones institucionales. **En la base limpia no existen estas cuentas demo.**

## Qué puedes probar ahora

**Dirección:** panel, estudiantes, importación Excel/CSV, visitantes, historial, ajustes, eventos especiales, gestión de administradores y guardias, perfil/QR.

**Administración:** panel, estudiantes, importación Excel/CSV, visitantes, historial, ajustes, eventos especiales, gestión de guardias (NO de administradores), perfil/QR.

**Alumno:** entra al mismo formulario web usando su matrícula y contraseña generada. Solo verá su propia ficha, fotografía opcional, credencial digital con QR, calendario de accesos y su historial. Podrá descargar su **QR SVG** y su **credencial digital PNG**.

**Guardia:** sigue utilizando **el mismo APK V0.3.1 instalado**, sin recompilar. Desde Dirección o Administración puedes registrar un guardia; su identificación, contraseña (mostrada una sola vez) y QR se crean automáticamente. Usa esas credenciales para ingresar desde Android.

**Docentes y otros trabajadores:** se registran con código QR, pero sin cuenta web personal por ahora.

## Prueba con un alumno nuevo

1. En Dirección o Administración abre `Comunidad → + Nuevo usuario`.
2. Selecciona `Alumno` y captura **matrícula numérica**, nombre, **primer apellido**, carrera y grupo. La foto es opcional.
3. Al guardar se crean **su registro, su QR y su cuenta** en una operación. El sistema muestra la contraseña inicial una sola vez.
4. Cierra la sesión web, vuelve a entrar con la **matrícula y contraseña** y abre `Mi espacio`. El alumno solo verá sus datos.
5. En el teléfono con LINCE GUARD abierto, conectado a la misma Wi-Fi privada y configurado con la URL base del servidor, escanea el QR. El movimiento aparecerá en el historial web.

En **modo demo y solo con datos ficticios**, cuando se captura el primer apellido, la contraseña de estudiante se deriva del patrón solicitado: inicial del primer nombre mayúscula + primeras tres letras del primer apellido minúsculas + `.` + últimas cuatro cifras de la matrícula. Ejemplo ficticio `Daniela López / 25051234 → Dlop.1234`. **Esto no es seguro para estudiantes reales**: en modo `LINCE_DEMO=0` la contraseña se genera aleatoriamente y se mantiene fija hasta restablecimiento autorizado. No se obliga a cambiarla en cada acceso.

## Importación masiva

1. Abre `Importar Excel` y descarga `plantilla-estudiantes.csv` o utiliza un archivo `.xlsx` de Excel.
2. La hoja debe tener estas columnas: `matricula`, `nombre_completo`, `apellido_paterno`, `carrera`, `grupo`.
3. Selecciona tu archivo. Verás **vista previa** de matrículas válidas, errores y duplicados **antes de guardar**.
4. Confirma: solo se crean los estudiantes aprobados. Cada uno obtiene cuenta + QR. El sistema ha sido probado con **500 alumnos ficticios**.
5. Descarga un ZIP con archivos **QR SVG por matrícula** y un CSV de matrícula/nombre/código. **El ZIP NO incluye contraseñas.** No lo distribuyas públicamente.

Los límites de esta entrega son **1000 filas** y **5 MB** por archivo. La vista previa de importación dura 20 minutos y no se puede confirmar dos veces. Puedes corregir filas en Excel y volver a importar las rechazadas.

## Historial, cierres y eventos especiales

- El sistema conserva los eventos de acceso como registros inmutables.
- `Corregir salida` permite que Dirección o Administración añadan una **salida manual auditada**, con motivo obligatorio. No modifica ni borra la entrada original.
- **A las 23:59 (America/Mazatlan)**, o la siguiente vez que arranque el servidor si estuvo apagado, se consolida el día. Se registra cuántas personas quedaron pendientes **sin inventar salidas ni poner artificialmente el aforo en cero**.
- En `Eventos especiales` se pueden crear, modificar y cancelar eventos de hasta siete días, incluido un hackatón de 24 horas que cruce medianoche. Los cambios quedan auditados.
- El alumno ve **días de acceso registrados**, no faltas académicas confirmadas: para calcular faltas hace falta el calendario, las clases y los permisos escolares.
- Si se pierde una credencial, Dirección o Administración pueden **Reponer QR**. El código anterior deja de funcionar, pero se conserva su historial.

## Conectar Android

- Abre `iniciar-lince.bat` o `iniciar-lince-limpio.bat` y deja el servidor encendido.
- El teléfono debe estar en **la misma red privada** de la laptop. Configura la URL que la consola indique (ej. `http://192.168.137.1:3000`, solamente si es la IP que tiene tu equipo).
- Conservamos las rutas `/api/login`, `/api/scan`, `/api/stats`, `/api/visitors` y la detección de lecturas consecutivas: el APK Android **no requiere actualización** para escanear los nuevos códigos.
- Si eliges la **base limpia**, crea primero una cuenta de Guardia desde la web; los usuarios demo no existen en esa base.

## Pruebas automáticas

Desde la carpeta principal ejecuta `npm test`. Las pruebas utilizan bases **temporales** y no deben alterar tu base real.

La suite incluye 161 comprobaciones declaradas, entre ellas: escaneo con Android, cuenta nueva, privacía de alumnos, jerarquía de Dirección, cierre sin salidas falsas, QR, eventos, Excel y una importación real de **500 alumnos ficticios**. La interfaz visual final requiere prueba manual en el navegador de tu PC y el Android físico.

## Seguridad y límites

**PROTOTIPO ACADÉMICO / SOLO DATOS FICTICIOS.** La demo usa HTTP local, contraseñas de ejemplo e inicio por matrícula. No lo publiques en Internet ni incorpores datos personales reales sin autorización, HTTPS, revisión de seguridad y políticas de respaldo. Las claves se guardan mediante `scrypt` con sal por cuenta, no en texto plano; las contraseñas iniciales se muestran una vez al autorizar el alta. Para el entorno real habrá que establecer un canal privado de entrega de contraseñas iniciales, especialmente tras una importación masiva.

Las funciones de **turnos/relevos de guardias, alertas de relevo y gafete físico PDF descargable desde Android** se reservaron, tal como acordamos, para la actualización posterior de LINCE GUARD. No las confundas con la credencial digital PNG disponible ahora en la web.


## V0.5.1 — Turnos y relevos

Consulta `LEER_PRIMERO_V0_5_1.md` para el módulo de supervisión de guardias. El plan de inicio de sesión por gafete sin depender de un QR estático está en `PLAN_APK_GAFETE_SEGURO.md`. La app Android incluida sigue siendo la anterior (no se ha recompilado).


## ACCESO LINCE V0.5.2 — Preparación de múltiples Androids

Esta versión agrega paneles **Dispositivos Android** e **Ingresos exprés**, nuevas API de vinculación, login por QR sin PIN para guardias y registro cifrado de fotografía temporal de INE/gafete. Lee `LEER_PRIMERO_V0_5_2.md` antes de aplicar el parche. El APK instalado aún NO implementa estas pantallas nuevas.
