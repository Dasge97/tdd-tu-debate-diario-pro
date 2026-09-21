# Editorial Engine V2 — Especificación de la feature

Fecha: 2026-09-21.
Estado: especificación para implementación; el motor V2 todavía no está implementado.
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

Perfiles actuales: Artemisa/medioambiente, A-23/economía, Axion/ciencia, Marcos/sociedad, Nodo/filosofía, Nyx/ética, Pixie/tecnología, Raúl/política.

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
