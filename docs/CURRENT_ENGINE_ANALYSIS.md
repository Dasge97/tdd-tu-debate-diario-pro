# Análisis del motor editorial actual de TDD Pro

Fecha: 2026-09-21. Repositorio: Dasge97/tdd-tu-debate-diario-pro.
Base inspeccionada: 5dabb2016b2e5f3bd7f384229d49362c1e08b3d4.
Estado: revisión estática del código; no se ha ejecutado el generador, consultado producción ni medido facturación.
Especificación del reemplazo: [EDITORIAL_ENGINE_V2.md](EDITORIAL_ENGINE_V2.md).

## Producto que debemos preservar

TDD publica cinco debates diarios de actualidad mediante perfiles IA temáticos. La comunidad puede posicionarse con support, oppose o neutral y comentar. Los perfiles son identidades editoriales que los usuarios siguen, no simples categorías. El cambio solicitado afecta al motor que alimenta esas publicaciones.

## Flujo realmente implementado

1. worker/src/index.js consulta /api/v1/worker/config, evalúa horario o trigger manual y ejecuta runner. Hay polling cada 60 segundos.
2. context.js obtiene títulos recientes por API; personas.js obtiene perfiles y días desde la última publicación.
3. calculateSlots prioriza perfiles nunca publicados o con >= rotation_limit_days (por defecto 3); completa aleatoriamente hasta target_debates (por defecto 5).
4. p1-search.js pide al modelo 10–12 noticias de últimas 48 horas, principalmente españolas, evitando los títulos de los últimos 14 días.
5. p2-select.js pide seleccionar exactamente cinco noticias y asignarlas a perfiles.
6. runner.js construye de antemano un p3-debate por perfil. session.js ejecuta los prompts secuencialmente mediante CLI (claude por defecto); desde el segundo turno usa --continue.
7. validateOne comprueba cada respuesta. Los debates inválidos se omiten; basta uno válido para pasar a publicación.
8. publisher.js manda debates y run_id al endpoint /api/v1/worker/publish. WorkerService crea los debates y registra el run.

Para cinco perfiles son siete invocaciones externas (búsqueda, selección y cinco generaciones). Eso no limita las posibles llamadas internas a herramientas que haga el CLI.

## Hallazgos y consecuencias

| Hallazgo | Evidencia | Consecuencia |
|---|---|---|
| Contexto conversacional compartido | session.js, --continue | Cada generación puede incluir búsqueda, selección y publicaciones anteriores. Coste potencial creciente y dependencia de estado implícito. |
| Búsqueda delegada por completo al modelo | p1-search.js | El worker no tiene aquí un catálogo persistente de noticias, extracción propia ni evidencias reutilizables. |
| Neutralidad contradicha | p3-debate.js: «No es un resumen neutro — es cómo ESTE personaje interpreta y presenta el tema.» | Personalidad y posicionamiento se mezclan precisamente en el contexto factual. |
| Asignación no estructurada | p2-select.js devuelve líneas de texto; runner no las parsea | p3 asume que la asignación número i coincide con el perfil i preseleccionado. Puede haber desajustes. |
| Validación factual inexistente en validateOne | source_url solo exige startsWith('http') | Una URL formalmente aceptada no prueba existencia, fecha ni respaldo de la afirmación. |
| Deduplicación basada en instrucciones | context.js y p1-search.js | No existe identidad de acontecimiento en este flujo; los títulos distintos pueden ocultar el mismo suceso. |
| Objetivo configurable, selección fija | runner usa target_debates; p2 exige cinco | Configuración y prompts pueden divergir. El producto deseado sigue siendo cinco diarios. |
| Publicación parcial aceptada | runner omite fallos; WorkerService captura errores por debate | No garantiza cinco debates válidos ni un lote atómico. |
| Repetir run_id no evita reinserciones | WorkerService recupera el run pero vuelve a crear debates | Un reintento puede duplicar publicaciones. |
| Resultado HTTP no equivale a éxito completo | controlador devuelve 201 y publisher no exige errors vacío | Puede registrarse éxito en el worker pese a fallos parciales del backend. |
| Sin exclusión explícita de ejecuciones en el scheduler | setInterval(tick, 60000) | Un proceso lento y nuevos triggers pueden solaparse. |
| Trazabilidad limitada | generación devuelve source_name y source_url únicos | No representa hechos asociados a varias fuentes, discrepancias ni revisiones del acontecimiento. |

PositionService confirma que los valores existentes son support, oppose y neutral. No deben cambiarse.

## Documentación antigua y código

docs/WORKER.md describe cuatro prompts, opencode y parte del acceso directo a MySQL. La implementación leída usa CLI configurable (claude por defecto), 2 + N prompts y APIs para contexto. README conserva referencias a TDD App Móvil pese a estar en el repo Pro. El próximo implementador debe tomar el código actual como evidencia, comprobar cambios posteriores y actualizar la documentación afectada.

## Qué sabemos del coste

El usuario informa de consumo excesivo. El código permite identificar contexto acumulado y búsqueda agentiva como candidatos, pero no cuantificar euros, tokens reales, caché del proveedor ni ahorro futuro. Los logs actuales de session.js registran caracteres de respuesta, no uso facturado.

Antes de afirmar un porcentaje de ahorro, recoger tokens de entrada/salida, tokens cacheados si existen, llamadas de herramientas, modelo, duración, reintentos y coste con tarifa fechada. Si el proveedor no entrega uso, marcarlo como desconocido; no confundir caracteres con tokens.

## Dirección del cambio

Reemplazar el flujo conversacional de búsqueda/selección/generación por ingesta persistente, agrupación por acontecimiento, dossier factual trazable y generación acotada. Conservar la aplicación, perfiles y participación comunitaria. No basta con acortar los prompts actuales.

Esta revisión no es una auditoría completa de seguridad ni describe el estado de producción.
