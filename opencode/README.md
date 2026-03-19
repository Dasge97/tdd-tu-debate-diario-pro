# Opencode Worker de TDD

Esta carpeta deja listo el worker que procesa los jobs de generacion editorial de **TDD - Tu Debate Diario** con `opencode`.

## Estado actual

La imagen ya instala el CLI real:

```bash
npm i -g opencode-ai
```

Y ademas deja automatizada esta secuencia:

1. leer `/shared/jobs/inbox/<jobId>.json`
2. ejecutar `opencode run`
3. pedir al modelo un JSON batch editorial alineado con TDD
4. convertir ese JSON en un payload final de debates validos
5. opcionalmente llamar al backend principal de TDD para completar el job e insertar los debates

## Configuracion

En el arranque se genera `/workspace/opencode.json` con estas ideas:

- provider integrado o custom configurable por variables
- modelo configurable por variables
- `share` desactivado
- permisos del agente denegados para evitar herramientas como `bash` o `edit`

Variables principales:

- `OPENCODE_PROVIDER_ID`
- `OPENCODE_PROVIDER_NAME`
- `OPENCODE_PROVIDER_NPM`
- `OPENCODE_BASE_URL`
- `OPENCODE_API_KEY`
- `OPENCODE_MODEL_ID`
- `OPENCODE_AUTO_PROCESS`
- `OPENCODE_AUTO_COMPLETE_JOB`
- `BACKEND_API_BASE_URL`
- `NEWS_API_BASE_URL`

Valor base recomendado ahora mismo:

- proveedor: `OpenCode`
- modelo: `opencode/minimax-m2.5-free`
- candidatos que devuelve el modelo: `10`
- debates finales publicados: `5`
- condicion final obligatoria: `5` categorias distintas

## Modos de uso

Modo manual:

```bash
node /workspace/bin/process-job.js /shared/jobs/inbox/<jobId>.json
```

Modo automatico:

```bash
node /workspace/bin/watch-jobs.js
```

Si `OPENCODE_AUTO_PROCESS=true`, el entrypoint arranca el watcher automaticamente.

## Directorios compartidos

- entrada: `/shared/jobs/inbox`
- salida: `/shared/jobs/outbox`
- logs: `/shared/jobs/logs`

## Contrato esperado

1. La API escribe `/shared/jobs/inbox/<jobId>.json`.
2. `opencode` usa ese JSON como archivo adjunto para el prompt batch.
3. El modelo devuelve JSON editorial estructurado.
4. El worker valida candidatos, selecciona 5 validos con categorias distintas y construye el payload final.
5. El worker guarda ese resultado en `/shared/jobs/outbox/<jobId>.result.json`.
6. Si `OPENCODE_AUTO_COMPLETE_JOB=true`, el worker llama a `POST /generation/jobs/:jobId/complete`.
7. El backend principal valida e inserta los debates en la tabla real `debates`.

## Script mock

El mock sigue disponible para pruebas sin IA real:

```bash
node /workspace/bin/mock-generate-sql.js /shared/jobs/inbox/<jobId>.json
```
