# Modelo relacional — V0.1

```mermaid
erDiagram
    PEOPLE ||--o| PRESENCE : "estado actual"
    PEOPLE ||--o{ ACCESS_EVENTS : "genera"
    PEOPLE {
      INTEGER id PK
      TEXT code UK
      TEXT name
      TEXT type
      TEXT career
      TEXT group_name
      TEXT status
      TEXT expires_at
      TEXT reason
      TEXT host_name
      TEXT created_at
    }
    PRESENCE {
      INTEGER person_id PK,FK
      INTEGER inside
      TEXT entered_at
      TEXT last_scan_at
    }
    ACCESS_EVENTS {
      INTEGER id PK
      INTEGER person_id FK
      TEXT action
      TEXT happened_at
      TEXT gate
      TEXT operator
      TEXT note
    }
    CONFIG {
      TEXT key PK
      TEXT value
    }
```

## Flujograma de validación

```mermaid
flowchart TD
    A[Escanear credencial] --> B{¿Existe y está activa?}
    B -->|No| C[Denegar y mostrar alerta roja]
    B -->|Sí| D{¿Vigencia correcta?}
    D -->|No| C
    D -->|Sí| E{¿Reescaneo antes de 12 segundos?}
    E -->|Sí| F[Rebote ignorado]
    E -->|No| G{¿Está dentro?}
    G -->|No| H[Registrar entrada]
    G -->|Sí| I[Registrar salida]
    H --> J[Guardar evento inmutable]
    I --> J
    J --> K[Actualizar presencia y aforo]
    K --> L[Notificar tablero en vivo]
```

**Seguridad:** Los movimientos se conservan en `access_events`, protegido con disparadores contra UPDATE/DELETE. `presence` puede cambiar porque representa el estado actual, no un historial.

## Arquitectura V0.3 (mismo esquema SQLite)

```mermaid
flowchart TD
    A[LINCE GUARD: app Android nativa con CameraX y ML Kit] --> B[API Node.js]
    C[LINCE ADMIN: laptop y dirección] --> B
    B --> D[(SQLite people, presence, access_events, config)]
    B --> E[SSE: cambios de aforo]
    E --> C
    B -->|respuesta inmediata al escaneo| A
```

Los clientes tienen interfaces diferentes pero utilizan los mismos endpoints. La sesión del guardia solo autoriza escaneo y visitantes; la del director no puede registrar accesos. El acceso por Wi-Fi de esta demo es HTTP y **no debe utilizarse fuera de red de pruebas privada**.


**V0.3:** la app Android consulta `/api/scan` y `/api/stats` usando su sesión; la web LINCE ADMIN escucha SSE. La app nativa no usa SSE por ahora.
