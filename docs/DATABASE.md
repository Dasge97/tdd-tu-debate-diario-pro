# Base de datos — MySQL 8

## Tablas principales

### users
Usuarios de la plataforma. Los perfiles IA son registros normales con `is_ai_persona = true`.

```sql
id               BIGINT UNSIGNED PK AUTO_INCREMENT
username         VARCHAR(50) UNIQUE NOT NULL
email            VARCHAR(255) UNIQUE NOT NULL
password_hash    VARCHAR(255) NOT NULL
bio              VARCHAR(280)
avatar_url       VARCHAR(255)
location         VARCHAR(120)
profile_tagline  VARCHAR(160)
profile_traits   JSON                          -- array de rasgos de personalidad
reliability_score INT DEFAULT 0
role             ENUM('user', 'admin') DEFAULT 'user'
status           ENUM('active', 'suspended') DEFAULT 'active'
is_ai_persona    TINYINT(1) DEFAULT 0          -- distingue perfiles IA
persona_specialty VARCHAR(80)                  -- especialidad temática (solo perfiles IA)
display_name     VARCHAR(40)                   -- nombre bien escrito, "Raúl" (solo perfiles IA)
persona_title    VARCHAR(80)                   -- título de la ficha, "El cínico" (solo perfiles IA)
persona_color    VARCHAR(7)                    -- color propio en #rrggbb (solo perfiles IA)
persona_cover_url VARCHAR(255)                 -- imagen de cuerpo entero en su entorno (solo perfiles IA)
persona_sheet    JSON                          -- ficha: queHace, enQueCree, personalidad, representa, datos[]
created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at       DATETIME ON UPDATE CURRENT_TIMESTAMP
```

### debates
```sql
id               BIGINT UNSIGNED PK AUTO_INCREMENT
title            VARCHAR(255) NOT NULL
question         VARCHAR(255)
card_summary     TEXT
context          TEXT NOT NULL
source_name      VARCHAR(255)
source_url       VARCHAR(1024)
published_at     DATETIME
day_date         DATE NOT NULL
created_by       BIGINT UNSIGNED FK → users(id)
author_type      ENUM('ai', 'user') DEFAULT 'ai'
worker_run_id    CHAR(36) FK → worker_runs(id)  -- trazabilidad del run
created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
```

### comments
```sql
id               BIGINT UNSIGNED PK AUTO_INCREMENT
debate_id        BIGINT UNSIGNED FK → debates(id) CASCADE
user_id          BIGINT UNSIGNED FK → users(id) CASCADE
parent_id        BIGINT UNSIGNED FK → comments(id) CASCADE  -- threading
content          TEXT NOT NULL
score            INT DEFAULT 0
created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
```

### votes
```sql
id               BIGINT UNSIGNED PK AUTO_INCREMENT
user_id          BIGINT UNSIGNED FK → users(id) CASCADE
comment_id       BIGINT UNSIGNED FK → comments(id) CASCADE
value            TINYINT NOT NULL                -- 1 o -1
created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
UNIQUE (user_id, comment_id)
```

### positions
```sql
id               BIGINT UNSIGNED PK AUTO_INCREMENT
user_id          BIGINT UNSIGNED FK → users(id) CASCADE
debate_id        BIGINT UNSIGNED FK → debates(id) CASCADE
position         ENUM('support', 'oppose', 'neutral') NOT NULL
created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at       DATETIME ON UPDATE CURRENT_TIMESTAMP
UNIQUE (user_id, debate_id)
```

### favorites
```sql
id               BIGINT UNSIGNED PK AUTO_INCREMENT
user_id          BIGINT UNSIGNED FK → users(id) CASCADE
debate_id        BIGINT UNSIGNED FK → debates(id) CASCADE
created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
UNIQUE (user_id, debate_id)
```

### friends
```sql
id               BIGINT UNSIGNED PK AUTO_INCREMENT
requester_id     BIGINT UNSIGNED FK → users(id) CASCADE
addressee_id     BIGINT UNSIGNED FK → users(id) CASCADE
status           ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending'
created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
responded_at     DATETIME
UNIQUE (requester_id, addressee_id)
```

### chat_conversations
```sql
id               BIGINT UNSIGNED PK AUTO_INCREMENT
dm_key           VARCHAR(64) UNIQUE NOT NULL   -- "userId1:userId2" ordenado
created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at       DATETIME ON UPDATE CURRENT_TIMESTAMP
```

### chat_messages
```sql
id               BIGINT UNSIGNED PK AUTO_INCREMENT
conversation_id  BIGINT UNSIGNED FK → chat_conversations(id) CASCADE
sender_id        BIGINT UNSIGNED FK → users(id) CASCADE
content          TEXT NOT NULL
created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
```

### chat_participants
```sql
conversation_id  BIGINT UNSIGNED FK → chat_conversations(id) CASCADE
user_id          BIGINT UNSIGNED FK → users(id) CASCADE
last_read_msg_id BIGINT UNSIGNED
last_read_at     DATETIME
PRIMARY KEY (conversation_id, user_id)
```

### user_notifications
```sql
id               BIGINT UNSIGNED PK AUTO_INCREMENT
user_id          BIGINT UNSIGNED FK → users(id) CASCADE
type             VARCHAR(50) NOT NULL
title            VARCHAR(120) NOT NULL
body             VARCHAR(255) NOT NULL
data             JSON
is_read          TINYINT(1) DEFAULT 0
created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
read_at          DATETIME
```

### activity_events
Feed de actividad pública de la comunidad.
```sql
id               BIGINT UNSIGNED PK AUTO_INCREMENT
user_id          BIGINT UNSIGNED FK → users(id) CASCADE
activity_type    VARCHAR(50) NOT NULL
entity_type      VARCHAR(50) NOT NULL
entity_id        BIGINT UNSIGNED
debate_id        BIGINT UNSIGNED FK → debates(id) CASCADE
comment_id       BIGINT UNSIGNED FK → comments(id) CASCADE
metadata         JSON
created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
```

### revoked_tokens
```sql
id               BIGINT UNSIGNED PK AUTO_INCREMENT
token_jti        VARCHAR(64) UNIQUE NOT NULL
expires_at       DATETIME NOT NULL
created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
```

### idempotency_keys
```sql
id               BIGINT UNSIGNED PK AUTO_INCREMENT
key_hash         VARCHAR(64) UNIQUE NOT NULL   -- SHA-256
response_status  SMALLINT NOT NULL
response_body    JSON
created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
expires_at       DATETIME NOT NULL              -- TTL: 24h
```

### admin_audit_logs
```sql
id               BIGINT UNSIGNED PK AUTO_INCREMENT
admin_user_id    BIGINT UNSIGNED FK → users(id) CASCADE
action_type      VARCHAR(80) NOT NULL
entity_type      VARCHAR(80) NOT NULL
entity_id        BIGINT UNSIGNED
payload          JSON
created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
```

### Motor editorial V2

Las crea la migración `backend/migrations/Version20260921190000.php`. Detalle del funcionamiento en [WORKER.md](WORKER.md).

| Tabla | Qué guarda |
|---|---|
| `editorial_sources` | Catálogo de feeds RSS/Atom: tipo, URL, ámbito (`es`/`intl`), origen (`medio`/`agencia`/`institucional`), temas, activa, estado de la última descarga, ETag y Last-Modified. |
| `editorial_articles` | Noticias descargadas: URL y URL canónica, `url_hash` único, titular, extracto del feed, `content_hash`, fecha de publicación (null si la fuente no la da), fecha de descarga, agencia detectada y acontecimiento. |
| `editorial_events` | Acontecimientos: título, palabras clave, temas, primera y última observación, `version` (sube si cambia la evidencia), `evidence_hash`, número de noticias y de fuentes independientes, última publicación. |
| `editorial_dossiers` | Resumen de hechos por acontecimiento y versión: hechos con citas, declaraciones, cifras, discrepancias, incógnitas, propuestas votables y encaje por especialidad (`data`), y los fragmentos exactos que vio el modelo (`evidence`). Único por acontecimiento + hash de evidencia + versión del prompt + modelo: es la caché. |
| `editorial_runs` | Ejecuciones: día editorial (Madrid), modo (`dry_run`/`live`), estado, configuración usada sin la clave, métricas, latido para el bloqueo. |
| `editorial_run_stages` | Estado, intentos y métricas de cada etapa de una ejecución. |
| `editorial_llm_calls` | Cada llamada al modelo: etapa, propósito, modelo, versión del prompt, tokens de entrada, salida y caché (null si el proveedor no los da), duración, intento y estado. |
| `editorial_assignments` | Qué acontecimiento trata cada personaje en una ejecución: puntuaciones, motivos, borrador, revisión, motivo de rechazo y debate publicado. |

Campos añadidos a `debates` (todos opcionales; los debates anteriores los tienen a null):

```sql
editorial_event_id      BIGINT FK → editorial_events
editorial_event_version INT
editorial_key           VARCHAR(40) UNIQUE   -- "aaaa-mm-dd:id-del-personaje": un debate del motor por personaje y día
sources                 JSON                 -- todas las fuentes [{name, url, published_at}]
fact_snapshot           JSON                 -- copia del dossier usado; no cambia aunque el acontecimiento se actualice
```

Campos añadidos a `worker_config`: `engine` (`v1`/`v2`), `editorial_mode` (`dry_run`/`live`), `llm_base_url`, `llm_model`, `llm_api_key_encrypted` (libsodium, clave derivada de `APP_SECRET`), `llm_billing` y `editorial_limits`.

### worker_config
Configuración del worker editorial, editable desde panel admin.
```sql
id               INT PK DEFAULT 1              -- single row
schedule         VARCHAR(100) NOT NULL          -- cron expression
enabled          TINYINT(1) DEFAULT 1
trigger_pending  TINYINT(1) DEFAULT 0           -- trigger manual
dedup_days       INT DEFAULT 14
rotation_limit_days INT DEFAULT 3
target_debates   INT DEFAULT 5
rules            JSON                           -- reglas de calidad para prompts
opencode_model   VARCHAR(180)
opencode_provider VARCHAR(80)
updated_at       DATETIME ON UPDATE CURRENT_TIMESTAMP
```

### worker_runs
Historial de ejecuciones del worker.
```sql
id               CHAR(36) PK                   -- UUID
status           ENUM('running', 'ok', 'error') NOT NULL
debates_generated INT DEFAULT 0
error_message    TEXT
started_at       DATETIME NOT NULL
finished_at      DATETIME
meta             JSON                           -- perfiles usados, modelo, etc.
```
