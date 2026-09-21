# Worker editorial

Proceso Node.js que cada día genera los debates de la plataforma. Tiene dos
motores y el panel decide cuál se usa (`/admin/editorial`, campo «Motor activo»):

- **V2, por etapas** (`worker/src/v2/`). Es el motor nuevo. Este documento lo describe.
- **V1, por conversación** (`worker/src/runner.js`). Es el motor antiguo: busca, elige y redacta en una sola conversación con un CLI de IA. Se conserva mientras el V2 se valida en producción. **No funciona en la imagen de producción**, porque no incluye ese CLI. Ver [Retirada del V1](#retirada-del-v1).

La especificación está en [EDITORIAL_ENGINE_V2.md](EDITORIAL_ENGINE_V2.md) y el análisis del motor antiguo en [CURRENT_ENGINE_ANALYSIS.md](CURRENT_ENGINE_ANALYSIS.md).

## Cómo arranca

`worker/src/index.js` consulta `GET /api/v1/worker/config` cada minuto. Si el
worker está activo y toca (horario cron o botón «Lanzar» del panel), ejecuta el
motor elegido. En el mismo proceso no arranca una ejecución si ya hay otra en
marcha. El backend, además, bloquea las ejecuciones simultáneas entre procesos.

Con el V2 el horario cron se interpreta en hora de Madrid. Con el V1, en la hora del contenedor (UTC).

## Motor V2: etapas

```
fuentes → ingesta → agrupación → preselección → dossier → asignación → redacción + revisión → publicación
```

Cada etapa guarda su estado y sus métricas en `editorial_run_stages`. No hay
conversación global con el modelo: cada llamada recibe solo lo que necesita.

| Etapa | Qué hace | Modelo |
|---|---|---|
| `ingest` | Descarga los RSS/Atom activos. Por cada fuente respeta un máximo de noticias, de tamaño y de tiempo, y usa descarga condicional (ETag / Last-Modified). Guarda titular, extracto y fechas. Una fuente que falla no afecta a las demás. | No |
| `cluster` | Agrupa en acontecimientos las noticias que cuentan el mismo suceso: cercanía en el tiempo, vocabulario y nombres propios compartidos. Respeta los acontecimientos que ya existían. | No |
| `preselect` | Descarta noticias sin fecha, antiguas, piezas de servicio (directos, «Consulte…», sorteos), acontecimientos con solo fuentes institucionales, los ya publicados sin novedades, los parecidos a un debate reciente y la misma historia contada dos veces. Puntúa el resto por actualidad, cobertura independiente y prioridad española. Elige `maxCandidates` repartidos por tema y deja una reserva. | No |
| `dossier` | Por candidato: hechos con cita a la evidencia, declaraciones atribuidas, cifras, discrepancias, incógnitas, propuestas votables y encaje por especialidad. Se guarda en caché por acontecimiento + hash de evidencia + versión del prompt + modelo. Si no salen objetivo + 1 dossiers válidos, tira de la reserva hasta `maxDossiers`. | 1 llamada por candidato nuevo |
| `assign` | Elige a la vez qué acontecimientos y qué personajes, sin modelo: encaje con la especialidad, calidad del acontecimiento y rotación. Después, a cada personaje que se quede sin nada le busca un **debate de fondo** (ver abajo). Guarda la asignación estructurada con sus puntuaciones y motivos. | No |
| `generate` | Por asignación: redacción, validación determinista y revisión editorial. Hay una reparación como mucho. Si un debate se rechaza, prueba con una pareja de reserva que ya tiene dossier válido. | 2 llamadas por debate (3–4 si hay reparación) |
| publicación | Se intenta un debate por personaje (`target_debates`, 8). Si es una ejecución en vivo y hay al menos `minDebates` válidos (1 por defecto), el backend publica en una transacción el lote con todos los válidos. Si no, no publica nada. Los personajes sin debate quedan anotados con el motivo. | No |

### Debates de fondo

Hay personajes (Artemisa, Axion, Nodo) que muchos días no tienen ninguna noticia con una medida concreta de su tema. Para ellos:

- El dossier recoge, además de las medidas concretas, las cuestiones generales de interés público que la noticia plantea (por ejemplo, ante un avance médico: que la sanidad pública financie ese tratamiento). Si solo tiene cuestiones generales, su estado es `background`.
- La asignación, tras repartir la actualidad, da a cada personaje sin debate un acontecimiento de su tema con dossier `ok` o `background` que no esté ya en el lote ni sea del mismo asunto. La asignación queda marcada con `kind: fondo`.
- La redacción parte de la noticia (con sus fuentes) y plantea la cuestión general, sin presentarla como algo que alguien haya propuesto o aprobado. Mismas reglas de neutralidad y la misma revisión.
- Un dossier `background` nunca se usa para un debate de actualidad.

### Neutralidad y estilo

- El dossier solo puede usar la evidencia recibida. Las citas a fragmentos que no existen se eliminan y un hecho sin citas válidas se descarta.
- Las copias de un mismo teletipo de agencia cuentan como una sola fuente.
- La redacción recibe el dossier y el estilo del personaje: nombre, especialidad y rasgos. **No recibe la bio ni «qué representa»**, porque llevan postura.
- El estilo cambia la forma, no los hechos ni la postura.
- Las fuentes del debate las pone el sistema a partir de la evidencia. Las URL que escriba el modelo se ignoran.
- La revisión suspende un borrador por cuatro motivos: un hecho sin respaldo, una declaración presentada como hecho, que tome partido, o una pregunta que no sea votable a favor, en contra o neutral.
- En un caso judicial no se vota nada sobre una persona concreta: ni su culpabilidad, ni si debe ser juzgada, ni las diligencias de su causa. La pregunta tiene que tratar una cuestión pública que plantea el caso.
- Los textos públicos no pueden usar el vocabulario interno del motor («dossier», «fragmento», «extracto»). El lector no sabe qué es eso.

### Validación antes de publicar

El worker (`src/v2/validate.js`) y el backend (`DebateDraftValidator`) aplican las mismas reglas:

| Campo | Regla |
|---|---|
| `title` | 60–120 caracteres, termina en «?». |
| `question` | 80–160 caracteres, termina en «?», distinta del `title` y sin dos preguntas en una. |
| `card_summary` | 100–220 caracteres. |
| `context` | 180–300 palabras. |
| `source_url` y `sources` | Tienen que ser URL de la evidencia recuperada. |

El backend además comprueba tres cosas:

- el personaje es un personaje IA;
- no hay dos debates con el mismo personaje ni el mismo acontecimiento;
- ese personaje no tiene ya debate ese día (`editorial_key` única).

### Día editorial

Se calcula en Europe/Madrid (`src/v2/dates.js`) y se guarda en `debates.day_date`.
Los instantes se guardan en UTC. Las pruebas cubren medianoche y los dos
cambios de hora.

### Presupuesto y límites

Todos se cambian en el panel (`/admin/editorial` → «Límites»). Estos son los valores por defecto:

| Límite | Valor |
|---|---|
| Mínimo de debates para publicar | 1 |
| Llamadas al modelo por ejecución | 60 |
| Tokens por ejecución | 300.000 |
| Candidatos a dossier | 10, más reserva hasta 24 dossiers |
| Fragmentos de evidencia por dossier | 6, de 900 caracteres |
| Caracteres de entrada por llamada | 14.000 |
| Tokens de salida por llamada | 2.500 (auth2api con cuenta de ChatGPT lo ignora; ahí manda el total por ejecución) |
| Tamaño máximo de un feed | 6 MB |
| Reparaciones por paso | 1 |
| Reemplazos de debates rechazados | 3 |
| Llamadas simultáneas | 2 |

Si se agota el presupuesto, la ejecución termina como `incomplete` con el motivo. **Nunca se recurre al V1.**

### Estados de una ejecución

| Estado | Significa |
|---|---|
| `published` | Lote publicado entero. |
| `completed` | Ejecución de prueba terminada. No publica nada. |
| `incomplete` | No se llegó al mínimo de debates válidos: faltan candidatos, evidencia o presupuesto. El motivo queda en el panel. |
| `failed` | Error inesperado o falta de configuración. |
| `aborted` | Sin latido durante 20 minutos: el proceso se cayó. |

Una ejecución `failed`, `aborted` o `incomplete` del mismo día se reanuda en el siguiente intento:

- no vuelve a descargar las fuentes si la ingesta terminó;
- los dossiers salen de la caché;
- las asignaciones ya hechas se reutilizan y se completan las que falten;
- solo se redactan los debates que falten.

### Uso y coste

Cada llamada al modelo queda en `editorial_llm_calls` con los tokens de entrada, salida y caché que devuelve el proveedor. Si el proveedor no los da, se guardan como desconocidos (null), nunca estimados.

El panel `/admin/editorial/uso` suma el consumo por día editorial y muestra los tokens por debate válido. Solo calcula euros si hay una tarifa por token configurada con su fecha. Con suscripción no se inventa un coste.

## Configuración

Todo en el panel (`/admin/editorial`):

| Campo | Qué es |
|---|---|
| Motor activo | V1 o V2. |
| Modo | «Prueba» genera y guarda sin publicar. «Publicar» publica el lote. Empieza en prueba. |
| Dirección base, modelo y clave | Cualquier API compatible con OpenAI (`/v1/chat/completions`). La clave se guarda cifrada con libsodium y una clave derivada de `APP_SECRET`, y no se vuelve a mostrar. |
| Coste | Suscripción, o precio por millón de tokens con su fecha. |
| Límites | Ver [Presupuesto y límites](#presupuesto-y-límites). |

El horario, el número de debates por día, los días de rotación y los días sin repetir siguen en `/admin/worker`.

En producción el modelo es `gpt-5.5` a través de auth2api, con la clave «auth2api - tdd» de la bóveda. Con la cuenta de ChatGPT conectada a auth2api solo responde gpt-5.5; los modelos mini se rechazan.

La clave también se puede guardar por consola, leyéndola de la entrada estándar:

```bash
/home/codehive/bin/vault-usar "auth2api - tdd" K -- sh -c \
  'printf %s "$K" | docker exec -i deployment_tudebatediario-backend-1 php bin/console app:editorial:set-llm-key --base-url=https://auth2api.code-hive.space --model=gpt-5.5'
```

### Fuentes

El catálogo inicial está en `backend/src/Service/Editorial/EditorialSourceCatalog.php`: 42 feeds comprobados el 2026-09-21 desde el servidor. Se carga con:

```bash
php bin/console app:editorial:sources:sync
```

El comando solo da de alta las fuentes que falten; no toca las existentes. Desde `/admin/editorial/fuentes` se activan, desactivan y añaden fuentes, y se ve el estado de la última descarga.

Solo se guarda el titular y el extracto que publica cada feed. No se descargan las páginas.

La descarga rechaza tres tipos de destino, también tras una redirección: direcciones privadas o locales, puertos distintos de 80 y 443, y URL con credenciales.

## Ejecución manual

```bash
cd worker
BACKEND_API_BASE_URL=http://localhost:3000 WORKER_API_KEY=... node src/v2/cli.js
```

| Opción | Efecto |
|---|---|
| (ninguna) | Prueba: no publica nada. |
| `--no-ingest` | No descarga fuentes; usa lo ya guardado. |
| `--no-resume` | No reanuda una ejecución anterior del mismo día. |
| `--report=informe.json` | Guarda el informe completo. |
| `--live --yes` | Publica de verdad. Sin `--yes` se niega. |

## Pruebas

```bash
cd worker && npm test              # node --test, sin red: feeds, backend y modelo simulados
cd backend && php bin/phpunit      # SQLite; con DATABASE_URL de MySQL también funcionan
```

## Despliegue

1. Copia de la base de datos.
2. Actualizar el código y reconstruir, con el comando del README de despliegue del servidor.
3. Migración, que solo añade tablas y columnas: `php bin/console doctrine:migrations:migrate -n`.
4. Fuentes: `php bin/console app:editorial:sources:sync`.
5. Personajes, para que Axion vuelva a «ciencia»: `php bin/console app:personajes:sincronizar`.
6. Clave del modelo: ver [Configuración](#configuración).
7. En el panel: motor V2, modo prueba. Lanzar y revisar el resultado en `/admin/editorial`.
8. Cuando las pruebas sean buenas, pasar a «Publicar».

**Vuelta atrás:**

- Motor V1 en el panel (aunque en producción no genera nada por falta del CLI) o worker desactivado.
- Las tablas nuevas no molestan a la aplicación.
- La migración tiene `down`, pero borra los datos del motor V2.

## Retirada del V1

Cuando el V2 lleve un tiempo publicando bien:

- borrar `worker/src/runner.js`, `session.js`, `context.js`, `personas.js`, `publisher.js`, `validator.js` y `prompts/`;
- quitar la rama V1 de `index.js`, los campos `opencode*` de `worker_config` y los endpoints `/api/v1/worker/publish`, `personas` y `recent-topics`.
