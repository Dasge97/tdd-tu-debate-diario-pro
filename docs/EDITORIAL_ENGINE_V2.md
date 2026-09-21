# Editorial Engine V2 — Especificación de la feature

Fecha: 2026-09-21.
Estado: implementado (2026-09-21), pendiente de activar en producción. Ver [§9 Estado de la implementación](#9-estado-de-la-implementación) y [WORKER.md](WORKER.md).
Repositorio objetivo: Dasge97/tdd-tu-debate-diario-pro.
Lectura previa: [CURRENT_ENGINE_ANALYSIS.md](CURRENT_ENGINE_ANALYSIS.md).

## 1. Encargo y objetivo

Sustituir completamente el motor actual que delega búsqueda, selección y redacción a una conversación acumulativa de IA. Cada día TDD debe publicar cinco debates de actualidad, variados y asociados a perfiles temáticos. Los lectores deben entender qué ocurre, posicionarse a favor/en contra/neutral y comentar sin que el motor les dicte una conclusión.

Reducir consumo y dependencia de búsquedas agentivas mediante información persistida y reutilizable. El ahorro debe medirse, no prometerse sin datos.

### Requisitos firmes

- Conservar perfiles IA, seguimiento de perfiles, comentarios y posiciones support/oppose/neutral.
- Conservar sus especialidades e identidad reconocible; separar estilo expresivo de hechos y posicionamiento.
- Mantener cinco debates como objetivo diario, uno por perfil seleccionado y sobre acontecimientos distintos.
- Actualidad con prioridad española; admitir acontecimientos internacionales de relevancia transversal.
- Trazabilidad desde publicación hasta acontecimiento, hechos y fuentes.
- IA reservada para tareas semánticas acotadas y redacción; no una llamada LLM por cada noticia descargada ni navegación abierta por defecto.
- Sustituir el motor, no limitarse a cambiar proveedor, modelo o prompt.
- No reescribir frontend, app móvil o backend completo para resolver esta feature.

### Defaults propuestos para V2

Son decisiones de implementación propuestas, no requisitos históricos adicionales: política de lote atómico, timezone Europe/Madrid, límites de extracción, número de candidatos y presupuestos configurables. Documentar cualquier ajuste y su motivo; resolver elecciones técnicas ordinarias sin bloquear por preguntas innecesarias.

## 2. Pipeline

Fuentes → ingesta → normalización/deduplicación → agrupación por acontecimiento → preselección → dossier factual → selección y asignación → generación independiente → validación → publicación.

Las etapas deben poder repetirse con resultados guardados. No mantener una conversación global del modelo como estado del pipeline.

### A. Fuentes e ingesta

- Catálogo configurable de RSS/Atom, APIs y páginas cuya extracción esté permitida. Registrar idioma, ámbito, temas, procedencia editorial y estado.
- Verificar feeds/endpoints reales al implementar. No inventar URLs ni suponer que cualquier medio permite extracción íntegra. No requiere un proveedor comercial fijo.
- Ingesta HTTP con timeouts, límites de tamaño, concurrencia acotada, backoff y caché condicional cuando proceda.
- Guardar URL original/canónica, título, fechas de publicación/actualización/recogida, fuente, texto o extracto permitido y hash.
- No usar la fecha de recogida como si fuera la fecha de la noticia. Conservar fechas desconocidas como tales.
- Eliminar HTML irrelevante antes de procesar. Contenido externo es dato, nunca instrucciones para ejecutar herramientas o cambiar reglas.
- Al descargar enlaces, rechazar destinos locales/privados y validar redirecciones; mantener credenciales fuera de textos, prompts y logs.
- Fallos de una fuente no deben cancelar la ingesta de las demás. Registrar cobertura por especialidad.

### B. Deduplicación y agrupación

- Deduplicar por URL normalizada y hash; agrupar por coincidencia de entidades, fecha, lugar y similitud textual.
- No agrupar únicamente por categoría: dos noticias de vivienda pueden ser sucesos distintos.
- Empezar con reglas y similitud económicas. Embeddings son opcionales si resuelven errores observados; no exigir infraestructura vectorial para el MVP.
- Detectar republicaciones y noticias de agencia: varios medios que reproducen un origen no son varias confirmaciones independientes.
- Mantener identidad estable del Event, artículos vinculados, primera/última observación y versión.
- Una novedad material actualiza el Event. No volver a publicar el mismo hecho solo porque cambió el titular.

### C. Preselección y dossier factual

Aplicar primero filtros baratos de actualidad, cobertura, encaje temático y repetición. Consolidar con IA solo un conjunto acotado de candidatos; no resumir todo el corpus mediante LLM.

Cada Event debe distinguir:
- Hechos respaldados y sus evidencias concretas.
- Declaraciones atribuidas: que alguien afirme algo no demuestra que sea verdad.
- Cifras, fechas y actores.
- Discrepancias entre fuentes.
- Incertidumbres y datos aún no conocidos.
- Fuentes primarias y fuentes que aportan corroboración independiente.

Una consolidación LLM no constituye verificación por sí misma. Las referencias deben apuntar a fragmentos o ubicaciones efectivamente recuperados. Si solo hay un titular o extracto insuficiente, no completar hechos con conocimiento supuesto.

No imponer «dos URLs = verdad». Evaluar independencia y tipo de evidencia. Una fuente primaria puede sostener un hecho limitado (por ejemplo, que se publicó una norma); no acredita automáticamente sus efectos futuros ni todas las afirmaciones de su autor. Marcar como insuficiente cualquier Event cuya evidencia no permita redactar con rigor.

Cachear por versión de Event + conjunto/hash de evidencia + versión de prompt/modelo. Una evidencia nueva relevante invalida el dossier anterior.

### D. Selección y perfiles

Seleccionar conjuntamente acontecimientos y perfiles usando actualidad, relevancia, evidencia, diversidad, especialidad y rotación. Evitar seleccionar cinco perfiles aleatorios antes de conocer la cobertura disponible.

Perfiles actuales: Artemisa/medioambiente, A-23/economía, Axion/ciencia, Marcos/sociedad, Nodo/filosofía, Nyx/ética, Pixie/tecnología, Raúl/política. (Axion tuvo unos días la especialidad «pensamiento crítico»; vuelve a «ciencia» con `app:personajes:sincronizar`.)

- Priorizar perfiles que llevan tres días sin publicar, conservando configuración existente.
- La rotación no permite inventar hechos ni forzar una noticia irrelevante. Registrar excepciones por falta de evidencia.
- Ética y filosofía pueden tratar implicaciones de un acontecimiento real; no exigir una sección de prensa llamada «filosofía».
- Evitar solapamiento del acontecimiento y repetición reciente; permitir una evolución sustancial justificada.
- Guardar asignación estructurada event_id → persona_id → motivo y puntuaciones. No interpretar líneas libres del modelo como contrato.
- Si se conserva target_debates configurable, usar el mismo valor en planificación, validación y publicación. Default del producto: cinco.

### E. Generación de debate

Cada generación recibe únicamente un dossier versionado, evidencias relevantes acotadas, perfil asignado y contrato de salida. Llamadas independientes, sin --continue global ni acceso libre a navegación.

Campos públicos actuales a preservar:
persona_id, title, question, card_summary, context, source_name, source_url, published_at, generation_model.

Añadir relación persistida con Event/version y fuentes múltiples sin romper clientes que consumen los campos actuales. source_url/source_name siguen siendo la referencia principal de compatibilidad; no sustituyen la trazabilidad multifuente. Timestamp y modelo real los fija el sistema.

Reglas editoriales:
- Contexto factual accesible; separar lo ocurrido de hipótesis y declaraciones.
- La personalidad aporta vocabulario, ritmo y forma de plantear la pregunta; no sesgo obligatorio ni juicios presentados como hechos.
- No asumir equivalencia de evidencia entre posiciones. Neutralidad no exige presentar un dato falso como una alternativa válida.
- La pregunta debe referirse a una única propuesta o decisión comprensible con support/oppose/neutral.
- Evitar preguntas dobles, presuposiciones acusatorias, falsa dicotomía y premisas no acreditadas.
- Conservar español y límites actuales de longitud salvo cambio explícitamente justificado por compatibilidad.
- No perseguir indignación como criterio de selección.

Ejemplo ficticio de forma (no noticia publicable):
«¿Debería el ayuntamiento limitar el acceso de vehículos al centro?»
El contexto explicaría la medida documentada, alcance, efectos respaldados y cuestiones abiertas. «¿Cómo cambia esto nuestras vidas?» no tiene un objeto claro para votar a favor o en contra.

## 3. Persistencia mínima

Aprovechar Symfony/Doctrine/MySQL existentes y el worker Node.js. Backend dueño de escritura y migraciones; worker utiliza endpoints internos autenticados. No introducir microservicios, colas distribuidas ni otra base sin necesidad demostrada.

| Entidad lógica | Información mínima |
|---|---|
| Source | Tipo, endpoint, temas, ámbito, procedencia/origen, estado, última ingesta |
| Article | Fuente, URLs, fechas diferenciadas, título, extracto/texto permitido, hash |
| Event | Identidad estable, artículos asociados, temas, fechas, estado y versión |
| EventDossier | Versión, hechos con referencias, declaraciones, discrepancias, incertidumbres, estado de evidencia |
| EditorialAssignment | Día, perfil, Event/version, razones, estado, clave idempotente |
| EditorialRun/Stage | Configuración efectiva, etapa, intentos, métricas, errores y presupuesto |
| Debate | Relación con Event/version y asignación; contrato público compatible |

No son nombres obligatorios de tablas. Elegir nombres y relaciones tras inspeccionar entidades existentes; añadir migraciones compatibles y conservar debates históricos aunque no tengan Event.

## 4. Coste, límites y observabilidad

Configurar máximos de artículos, candidatos a consolidar, fuentes por dossier, caracteres/tokens de entrada, salida, concurrencia e intentos. Propuesta inicial de reintentos: una reparación de contenido por etapa; ajustar con datos. No crear bucles de autocorrección ilimitados.

Registrar por etapa y run:
- Volumen recibido, duplicados, Events, descartes y motivos.
- Llamadas LLM, modelo/proveedor, tokens entrada/salida/cache cuando disponibles, duración e intentos.
- Coste real o estimado con tarifa y fecha; desconocido si no existe telemetría suficiente.
- Calidad editorial, cobertura por perfil y publicaciones válidas.
- Versiones de prompts, configuración y evidencia para reproducibilidad.

Comparar V1 y V2 con las mismas entradas cuando sea posible y distinguir un replay controlado de una ejecución real de búsqueda. Reportar consumo por debate válido, no solo número de llamadas. El V2 podría hacer más llamadas pequeñas y gastar menos; debe demostrarlo.

Al agotar presupuesto, detener la etapa y registrar el motivo. Nunca recurrir silenciosamente al motor caro anterior. Proveedor mediante adaptador; modelo local opcional, no obligación.

## 5. Validación y publicación

Validación determinista:
- Schema/tipos, longitudes, persona válida e IA, correspondencia exacta con la asignación, pregunta distinta del título y puntuación exigida.
- URLs y referencias deben pertenecer a evidencia recuperada; no aceptar fuentes inventadas por el modelo.
- Un Event y perfil por slot; sin duplicados en el lote.
- Fechas coherentes, evidencia vigente, número objetivo y presupuesto.
- La validación estructural no prueba neutralidad: incorporar evaluación editorial acotada sobre fidelidad, atribución y claridad de la propuesta; registrar rechazos y revisar una muestra humana durante la puesta en marcha.

Política inicial propuesta: reunir cinco debates válidos antes de publicar el lote de forma atómica. Si un candidato falla, probar un reemplazo ya respaldado dentro del presupuesto. Si no se completa, registrar ejecución incompleta y mostrar causa en administración; no inventar contenido ni contar una publicación parcial como éxito. Cualquier política alternativa debe ser explícita.

- Definir día editorial con Europe/Madrid por defecto; guardar instantes UTC y probar cambio de hora.
- Exclusión de runs simultáneos y recuperación de bloqueo tras fallo.
- Clave única para día/perfil/asignación según modelo elegido; run_id por sí solo no basta.
- Repetir una publicación o recuperarse de timeout no crea duplicados.
- Backend transaccional e idempotente; cliente comprueba created/errors/estado, no solo HTTP 201.
- Reanudar etapas completadas sin descargar o generar todo de nuevo.
- Tras publicar, conservar snapshot factual utilizado. Una corrección del Event no debe reformular silenciosamente la pregunta sobre la que ya votó la comunidad; mostrar corrección/versionado cuando sea necesario.

## 6. Implementación por fases

1. Releer código y este análisis, identificar cambios posteriores y proponer módulos/migraciones concretos. Actualizar divergencias, sin rediseñar todo el producto.
2. Implementar ingesta, normalización, persistencia y agrupación con fixtures; sin publicar.
3. Implementar dossier trazable, preselección, asignación y adaptador LLM con límites, caché y métricas.
4. Implementar generación independiente, validación, reintentos acotados y publicación transaccional/idempotente.
5. Integrar configuración y diagnóstico en administración existente; migraciones, documentación operativa y ejemplos de configuración sin secretos.
6. Ejecutar dry-run y comparación de calidad/consumo. Activar V2 mediante configuración; mantener reversibilidad temporal. No desplegar ni lanzar publicaciones reales como efecto de tests.
7. Una vez validado y activado, retirar la ruta V1 y su documentación obsoleta. No mantener dos motores indefinidamente.

Entregables del implementador: código integrado, migraciones, pruebas relevantes, configuración de fuentes validada, instrucciones de ejecución/despliegue/rollback, informe de mediciones reales o limitaciones, y actualización de docs/WORKER.md y documentación afectada. No declarar producción lista si faltan credenciales o validación real de fuentes.

## 7. Criterios de aceptación

- [ ] Ingesta de fuentes reales configuradas sin LLM por artículo; fixture reproducible para CI.
- [ ] Varias URLs del mismo acontecimiento forman un Event; sucesos distintos del mismo tema no se fusionan indiscriminadamente.
- [ ] Copias de agencia no cuentan como corroboración independiente.
- [ ] Todos los hechos publicados tienen evidencia recuperada; declaraciones y discrepancias siguen identificadas.
- [ ] Caché reutiliza Events sin cambios y se invalida ante novedades materiales.
- [ ] Cinco asignaciones compatibles, perfiles distintos, rotación explicable y preguntas votables.
- [ ] Personalidad conservada sin contradecir contexto factual ni imponer postura.
- [ ] Llamadas independientes y presupuesto verificable; ningún fallback oculto a navegación V1.
- [ ] Fuentes inaccesibles, fecha desconocida, evidencia insuficiente y falta de candidatos generan estados explícitos.
- [ ] Pruebas de fallo/reintento/timeout/concurrencia no producen debates duplicados ni lotes parcialmente confirmados.
- [ ] Día editorial coherente en límites de medianoche y horario de verano.
- [ ] Web y móvil siguen leyendo debates históricos y nuevos; votos, comentarios y perfiles se conservan.
- [ ] Dry-run no publica; informe de coste no inventa ahorro ni tokens ausentes.
- [ ] Documentación y configuración describen el comportamiento implementado.

Probar las propiedades anteriores con fixtures y mocks del proveedor; usar integración de BD para atomicidad/idempotencia. No probar solo que funciones devuelven exactamente lo que su implementación dicta.

## 8. Fuera de alcance

Rediseño visual, recomendador personalizado, publicación en redes externas, agentes que discuten entre sí, votos/comentarios sintéticos y un agregador universal para terceros. La modularidad permite crecer después, pero este encargo es alimentar TDD con debates diarios fiables y de coste controlado.


## 9. Estado de la implementación

Implementado el 2026-09-21. Funcionamiento y operación en [WORKER.md](WORKER.md).

### Dónde está

| Pieza | Ubicación |
|---|---|
| Pipeline del motor | `worker/src/v2/`: `ingest`, `http`, `feeds`, `cluster`, `preselect`, `dossier`, `assign`, `generate`, `validate`, `llm`, `pipeline`, `cli` |
| Entidades y migración | `backend/src/Entity/Editorial*.php`, `backend/migrations/Version20260921190000.php` |
| Servicios del backend | `backend/src/Service/Editorial/`: configuración y cifrado, almacén, ejecuciones, publicación, validador, catálogo de fuentes, consultas del panel |
| Endpoints internos | `backend/src/Controller/Api/EditorialWorkerController.php` (`/api/v1/worker/editorial/*`, con `X-Worker-Key`) |
| Panel | `/admin/editorial` (configuración y ejecuciones), `/admin/editorial/uso`, `/admin/editorial/fuentes` |
| Pruebas | `worker/test/` (43, `node --test`, sin red) y `backend/tests/Editorial/` (28, PHPUnit con SQLite; pasan también contra MySQL 8) |

### Decisiones y desviaciones

- **Migraciones.** El proyecto no tenía; el esquema de producción se aplicaba con `doctrine:schema:update`. La migración del V2 es la primera: se generó comparando las entidades con una copia de la estructura de producción, se aplicó, se revirtió y se volvió a aplicar sobre un MySQL 8 desechable. Solo funciona en MySQL; en desarrollo (PostgreSQL o SQLite) sigue valiendo `schema:update`.
- **Extracto, no texto completo.** Solo se guarda lo que publica el feed (titular y extracto, hasta 1.200 caracteres). No se descargan las páginas: no consta que los medios lo permitan. Consecuencia medida: bastantes acontecimientos salen con evidencia insuficiente o sin una medida concreta que votar. La reserva de candidatos lo compensa.
- **Asignación sin modelo.** La selección de acontecimientos y personajes es determinista. El encaje por especialidad lo puntúa el dossier en la misma llamada que extrae los hechos; no hay una llamada aparte para elegir.
- **Mismo asunto.** Además de agrupar noticias en acontecimientos, se evita publicar el mismo día dos acontecimientos distintos de un mismo asunto. Lo decide una regla con los nombres propios de los titulares y los actores de los dossiers. Salió de las pruebas reales, donde aparecían dos debates sobre la crisis de Ceuta.
- **Casos judiciales.** No se vota nada que afecte a una persona concreta (culpabilidad, juicio, diligencias). La especificación no lo decía; salió de la revisión humana de las pruebas.
- **Personalidad.** Solo nombre, especialidad y `profile_traits`. La bio y la ficha del personaje no llegan al modelo.
- **Correcciones.** Se guarda en cada debate la copia del dossier usado (`fact_snapshot`), y un debate publicado nunca se reescribe. Mostrar en la web que un acontecimiento cambió después no está hecho: exigía tocar el frontend, fuera del alcance.
- **API pública.** Los debates devuelven un campo nuevo `sources` (todas las fuentes). Los campos anteriores no cambian.
- **Límite de salida.** Se manda `max_completion_tokens`, pero auth2api con cuenta de ChatGPT lo ignora (comprobado). El tope efectivo es el presupuesto de tokens por ejecución.
- **Modelo.** Con la cuenta de ChatGPT conectada a auth2api solo responde `gpt-5.5`. Los modelos mini, más baratos, devuelven «not supported». El adaptador sirve para cualquier API compatible con OpenAI.
- **Comparación con el V1.** No se ha podido hacer: el V1 no puede ejecutarse en producción (falta su CLI) y no hay telemetría histórica de tokens. Solo hay mediciones del V2.
- **Día de "hoy" en la web.** El backend calcula los debates de hoy con la fecha UTC. Entre las 00:00 y las 02:00 de Madrid (01:00 en invierno) la web sigue mostrando los del día anterior. Ya pasaba antes; el V2 no lo cambia.
- **DNS.** La comprobación de destino privado y la conexión resuelven el nombre por separado. Se acepta porque las fuentes las da de alta un administrador.
- **Formularios del panel.** No tienen token CSRF, como el resto del panel. Se apoya en la cookie de sesión `SameSite=Lax`.

### Mediciones reales

Ejecuciones de prueba (sin publicar) del 2026-09-21, con las 42 fuentes reales, `gpt-5.5` por auth2api y una base de datos desechable. Tokens tal como los devolvió el proveedor. Todas las llamadas trajeron tokens de entrada y salida; ninguna trajo tokens en caché.

| Prueba | Qué cambiaba | Dossiers nuevos (de caché) | Llamadas | Entrada | Salida | Total | Por debate válido | Resultado |
|---|---|---|---|---|---|---|---|---|
| 1 | Primera ejecución | 10 (0) | 22 | 27.473 | 20.246 | 47.719 | 9.544 | 5 válidos, 2 del mismo caso |
| 2 | Prompt de dossier v2 | 10 (0) | 23 | 30.349 | 20.712 | 51.061 | 10.212 | 5 válidos |
| 3 | Prompt de dossier v3 | 10 (0) | 10 | 11.547 | 15.123 | 26.670 | — | Incompleta: 7 de 10 sin medida votable |
| 4 | Prompt de dossier v4 y reserva | 14 (0) | 26 | 34.340 | 24.582 | 58.922 | 11.784 | 5 válidos |
| 5 | Mismo día, con descarga | 2 (12) | 14 | 20.898 | 7.693 | 28.591 | 5.718 | 5 válidos |
| 6 | Sin descarga | 0 (14) | 16 | 24.161 | 8.072 | 32.233 | 6.447 | 5 válidos |
| 7 | Código final, sin descarga | 0 (14) | 18 | 26.126 | 8.581 | 34.707 | 6.941 | 5 válidos; la revisión rechazó uno y se reemplazó |

Lecturas:

- Una ejecución completa sin caché gasta unos 48.000–59.000 tokens: unos 10.000–12.000 por debate válido.
- La mayor parte del coste, sobre todo de salida, está en los dossiers. Cada uno ronda 1.100 tokens de entrada y 1.400 de salida.
- La redacción y la revisión de un debate suman unos 3.500–4.000 tokens.
- La caché funciona: si los acontecimientos no cambian, una segunda ejecución del mismo día no vuelve a hacer dossiers y gasta alrededor de la mitad.
- El tiempo de modelo de una ejecución sin caché ronda 6–8 minutos, con dos llamadas simultáneas.
- Con suscripción no hay coste en euros que calcular. Con una API de pago, el coste sale del panel de uso con la tarifa y su fecha.

Estas cifras no se pueden comparar con el V1 (ver arriba). Son una línea de base para vigilar el consumo desde `/admin/editorial/uso`.

### Criterios de aceptación

| Criterio | Estado |
|---|---|
| Ingesta real sin modelo por noticia; fixture reproducible | Hecho. 42 fuentes comprobadas; fixtures en `worker/test/fixtures.js`. |
| Mismo acontecimiento agrupado; sucesos distintos del mismo tema separados | Hecho. Probado con fixtures y ajustado con datos reales (el caso Begoña Gómez pasó de 3 acontecimientos a 1). |
| Copias de agencia no cuentan como corroboración | Hecho, en el recuento de fuentes independientes y en la corroboración de cada hecho. |
| Hechos con evidencia recuperada; declaraciones y discrepancias identificadas | Hecho. Las citas inventadas se eliminan; las URL las pone el sistema. |
| Caché reutilizada y con invalidación ante novedades | Hecho. Probado y medido (pruebas 5 y 6). |
| Cinco asignaciones compatibles, rotación explicable, preguntas votables | Hecho. Las excepciones de rotación quedan registradas con su motivo. |
| Personalidad sin contradecir los hechos ni imponer postura | Hecho en los prompts y en la revisión automática. Revisado a mano en las pruebas. Conviene seguir revisando una muestra en los primeros días reales. |
| Llamadas independientes, presupuesto verificable, sin vuelta oculta al V1 | Hecho. |
| Fuentes inaccesibles, fecha desconocida, evidencia insuficiente y falta de candidatos con estado explícito | Hecho. |
| Fallos, reintentos, tiempos agotados y concurrencia sin duplicados ni lotes parciales | Hecho. Pruebas de backend (también en MySQL) y del adaptador del modelo. |
| Día editorial coherente en medianoche y horario de verano | Hecho. Probado. |
| Web y móvil leen debates históricos y nuevos | Hecho. Las columnas nuevas son opcionales y la API solo añade `sources`. |
| La prueba no publica; el informe no inventa tokens ni ahorro | Hecho. |
| Documentación y configuración coherentes con lo implementado | Hecho. |

### Pendiente

- Desplegar: migración, fuentes, clave del modelo y activación en modo prueba (ver [WORKER.md](WORKER.md), «Despliegue»).
- Unos días en modo prueba en producción, revisando los borradores en `/admin/editorial`, antes de pasar a «Publicar».
- Retirar el V1 cuando el V2 lleve un tiempo publicando.
