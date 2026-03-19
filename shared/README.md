# Shared

Directorio compartido entre `backend` y `opencode` para intercambiar jobs del pipeline editorial.

- `shared/jobs/inbox/`: jobs pendientes
- `shared/jobs/outbox/`: resultados procesados
- `shared/jobs/logs/`: logs del worker

Los archivos generados dentro de estas carpetas no deben versionarse.
