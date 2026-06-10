# Plan de Tareas por Semanas

División de las 94 tareas según el cronograma del Plan de Calidad (§10.1). Cada tarea usa la nomenclatura combinada `<ID-SRS>_<ID-CP>`.

---

## Semana 1 — Infraestructura + Módulos 01 y 02

**Objetivo:** Configurar entorno de testing y ejecutar pruebas de CRUD y Estados.

### Días 1-2: Configuración del Entorno

| # | Tarea | Capa | Responsable | Estado |
|---|-------|------|-------------|:------:|
| S1-01 | Configurar Postman con colección de endpoints (todos los módulos) | — | Integrante 2 | ☐ |
| S1-02 | Configurar entorno Docker para testing (docker compose up) | — | Integrante 3 | ☐ |
| S1-03 | Crear seeders de datos de prueba (usuarios, ubicaciones, tipos) | BD | Integrante 3 | ☐ |
| S1-04 | Configurar Laravel Pint y verificar PSR-12 base | B | Integrante 2 | ☐ |
| S1-05 | Definir y documentar matriz CP completa v1.0 | — | Todos | ☐ |

### Días 3-5: Módulo 01 — Gestión de Incidencias (CRUD)

| # | Tarea | Capa | Responsable | Estado |
|---|-------|------|-------------|:------:|
| S1-06 | RF-FUNC-001_CP-01-01-F — Formulario completo con todos los campos válidos | F | Integrante 1 | ☐ |
| S1-07 | RF-FUNC-001_CP-01-01-B — POST /api/incidencias guarda correctamente | B | Integrante 2 | ☐ |
| S1-08 | RF-UI-003_CP-01-02-F — Campo título vacío muestra error en UI | F | Integrante 1 | ☐ |
| S1-09 | RF-SW-002_CP-01-02-B — Backend rechaza título vacío HTTP 422 | B | Integrante 2 | ☐ |
| S1-10 | RF-UI-003_CP-01-03-F — Input teléfono solo acepta números | F | Integrante 1 | ☐ |
| S1-11 | RF-SW-002_CP-01-03-B — Backend valida formato teléfono con regex | B | Integrante 2 | ☐ |
| S1-12 | RF-FUNC-004_CP-01-04-F — Editar incidencia carga datos en formulario | F | Integrante 1 | ☐ |
| S1-13 | RF-FUNC-004_CP-01-04-B — PUT actualiza correctamente en BD | B | Integrante 2 | ☐ |
| S1-14 | RF-FUNC-005_CP-01-05-F — Modal de confirmación antes de eliminar | F | Integrante 1 | ☐ |
| S1-15 | RF-FUNC-005_CP-01-06-F — Eliminación exitosa tras confirmar modal | F | Integrante 1 | ☐ |
| S1-16 | RF-FUNC-005_CP-01-06-B — DELETE soft delete | B | Integrante 2 | ☐ |

### Días 3-5: Módulo 02 — Estados e Historial

| # | Tarea | Capa | Responsable | Estado |
|---|-------|------|-------------|:------:|
| S1-17 | RF-FUNC-006_CP-02-01-F — Dropdown muestra todos los estados | F | Integrante 1 | ☐ |
| S1-18 | RF-FUNC-006_CP-02-01-B — GET /api/estados retorna lista | B | Integrante 2 | ☐ |
| S1-19 | RF-FUNC-007_CP-02-02-F — Cambiar Pendiente → En Proceso | F | Integrante 1 | ☐ |
| S1-20 | RF-FUNC-007_CP-02-02-B — PUT estado crea registro en historial | B | Integrante 2 | ☐ |
| S1-21 | RF-FUNC-008_CP-02-03-F — Visualización de historial cronológico | F | Integrante 1 | ☐ |
| S1-22 | RF-FUNC-008_CP-02-03-B — GET historial ordenado por fecha DESC | B | Integrante 2 | ☐ |
| S1-23 | RF-FUNC-007_CP-02-04-F — Validación de flujo (no permite estados inválidos) | F | Integrante 1 | ☐ |
| S1-24 | RF-FUNC-007_CP-02-05-F — Fecha de resolución visible al marcar Resuelto | F | Integrante 1 | ☐ |
| S1-25 | RF-FUNC-007_CP-02-05-B — Fecha resolución guardada correctamente en BD | BD | Integrante 3 | ☐ |
| S1-26 | RF-FUNC-008_CP-02-06-B — Trigger automático genera registro de historial | BD | Integrante 3 | ☐ |

> **Semana 1:** 26 tareas (5 configuración + 12 CRUD + 9 Estados)  
> **Entregable:** Capturas CP-01 y CP-02 organizadas en `evidencias/01_gestion_incidencias/` y `evidencias/02_estados_historial/`

---

## Semana 2 — Módulos 03, 04, 05 y 06

**Objetivo:** Responsables, Comentarios, Ubicación y Clasificación.

### Días 1-3: Módulo 03 — Responsables + Módulo 04 — Comentarios

| # | Tarea | Capa | Responsable | Estado |
|---|-------|------|-------------|:------:|
| S2-01 | RF-FUNC-009_CP-03-01-F — Selector de usuarios con búsqueda | F | Integrante 1 | ☐ |
| S2-02 | RF-FUNC-009_CP-03-01-B — GET /api/usuarios filtrados | B | Integrante 2 | ☐ |
| S2-03 | RF-FUNC-009_CP-03-02-F — Asignar responsable con rol | F | Integrante 1 | ☐ |
| S2-04 | RF-FUNC-009_CP-03-02-B — POST guarda relación en tabla pivote | B | Integrante 2 | ☐ |
| S2-05 | RF-FUNC-010_CP-03-03-F — Múltiples responsables con roles diferentes | F | Integrante 1 | ☐ |
| S2-06 | RF-FUNC-010_CP-03-03-B — Múltiples registros en pivote con FK correctas | BD | Integrante 3 | ☐ |
| S2-07 | RF-FUNC-010_CP-03-04-F — Cambiar rol de responsable existente | F | Integrante 1 | ☐ |
| S2-08 | RF-FUNC-010_CP-03-04-B — PUT actualiza rol en tabla pivote | B | Integrante 2 | ☐ |
| S2-09 | RF-FUNC-011_CP-03-05-F — Eliminar responsable de incidencia | F | Integrante 1 | ☐ |
| S2-10 | RF-FUNC-011_CP-03-05-B — DELETE remueve relación de pivote | B | Integrante 2 | ☐ |
| S2-11 | RF-FUNC-012_CP-04-01-F — Agregar comentario con texto válido | F | Integrante 1 | ☐ |
| S2-12 | RF-FUNC-012_CP-04-01-B — POST crea comentario con usuario y timestamps | B | Integrante 2 | ☐ |
| S2-13 | RF-FUNC-012_CP-04-02-F — Comentario vacío rechazado en frontend | F | Integrante 1 | ☐ |
| S2-14 | RF-FUNC-012_CP-04-02-B — Backend rechaza texto vacío HTTP 422 | B | Integrante 2 | ☐ |
| S2-15 | RF-FUNC-012_CP-04-03-F — Contador de caracteres visible (X/1000) | F | Integrante 1 | ☐ |
| S2-16 | RF-FUNC-013_CP-04-04-F — Comentarios ordenados por fecha (más reciente primero) | F | Integrante 1 | ☐ |
| S2-17 | RF-FUNC-013_CP-04-04-B — GET comentarios ordenados por created_at DESC | B | Integrante 2 | ☐ |
| S2-18 | RF-FUNC-014_CP-04-05-F — Eliminar propio comentario | F | Integrante 1 | ☐ |
| S2-19 | RF-FUNC-014_CP-04-05-B — DELETE soft delete del comentario | B | Integrante 2 | ☐ |

### Días 4-5: Módulo 05 — Ubicación + Módulo 06 — Clasificación

| # | Tarea | Capa | Responsable | Estado |
|---|-------|------|-------------|:------:|
| S2-20 | RF-FUNC-015_CP-05-01-F — Selección cascada: país carga provincias | F | Integrante 1 | ☐ |
| S2-21 | RF-SW-006_CP-05-01-B — GET provincias filtradas por país | B | Integrante 2 | ☐ |
| S2-22 | RF-FUNC-015_CP-05-02-F — Selección completa País → Provincia → Ciudad | F | Integrante 1 | ☐ |
| S2-23 | RF-SW-006_CP-05-02-B — GET ciudades filtradas por provincia | B | Integrante 2 | ☐ |
| S2-24 | RF-FUNC-015_CP-05-03-F — Cambio de provincia limpia ciudad | F | Integrante 1 | ☐ |
| S2-25 | RF-FUNC-015_CP-05-03-B — Backend valida FK provincia-ciudad | B | Integrante 2 | ☐ |
| S2-26 | RF-FUNC-015_CP-05-04-F — Campo ubicación muestra "Argentina > Buenos Aires > La Plata" | F | Integrante 1 | ☐ |
| S2-27 | RF-FUNC-016_CP-05-04-BD — Tablas normalizadas 3FN sin redundancia | BD | Integrante 3 | ☐ |
| S2-28 | RF-FUNC-017_CP-06-01-F — Dropdown muestra tipos de incidencia activos | F | Integrante 1 | ☐ |
| S2-29 | RF-FUNC-018_CP-06-01-B — GET /api/tipos ordenados alfabéticamente | B | Integrante 2 | ☐ |
| S2-30 | RF-FUNC-017_CP-06-02-F — Subtipo depende del tipo (cascada) | F | Integrante 1 | ☐ |
| S2-31 | RF-SW-007_CP-06-02-B — GET subtipos filtrados por tipo | B | Integrante 2 | ☐ |
| S2-32 | RF-FUNC-017_CP-06-03-F — Cambio de tipo limpia subtipo | F | Integrante 1 | ☐ |
| S2-33 | RF-SW-007_CP-06-03-B — Backend valida que subtipo pertenezca al tipo | B | Integrante 2 | ☐ |
| S2-34 | RF-FUNC-018_CP-06-04-BD — Integridad referencial FK tipos-subtipos | BD | Integrante 3 | ☐ |

> **Semana 2:** 34 tareas (10 responsables + 9 comentarios + 8 ubicación + 7 clasificación)  
> **Entregable:** Capturas CP-03, CP-04, CP-05 y CP-06

---

## Semana 3 — Módulos 07, 08, 09 y 10

**Objetivo:** Notificaciones, Dashboard, Autenticación y Validaciones.

### Días 1-3: Módulo 07 — Notificaciones + Módulo 08 — Dashboard

| # | Tarea | Capa | Responsable | Estado |
|---|-------|------|-------------|:------:|
| S3-01 | RF-FUNC-020_CP-07-01-F — Badge muestra contador de no leídas | F | Integrante 1 | ☐ |
| S3-02 | RF-FUNC-020_CP-07-02-F — Click en notificación la marca como leída | F | Integrante 1 | ☐ |
| S3-03 | RF-FUNC-020_CP-07-02-B — PATCH actualiza campo leido=true | B | Integrante 2 | ☐ |
| S3-04 | RF-FUNC-020_CP-07-03-F — Panel desplegable muestra lista de notificaciones | F | Integrante 1 | ☐ |
| S3-05 | RF-FUNC-019_CP-07-04-B — Trigger crea notificación al cambiar estado | BD | Integrante 3 | ☐ |
| S3-06 | RF-FUNC-020_CP-07-05-F — Botón "Marcar todas como leídas" | F | Integrante 1 | ☐ |
| S3-07 | RF-FUNC-020_CP-07-05-B — PATCH masivo actualiza todas las notificaciones | B | Integrante 2 | ☐ |
| S3-08 | RF-FUNC-021_CP-08-01-F — Tarjeta principal muestra total de incidencias | F | Integrante 1 | ☐ |
| S3-09 | RF-FUNC-021_CP-08-01-B — GET /api/metricas/generales | B | Integrante 2 | ☐ |
| S3-10 | RF-FUNC-022_CP-08-02-F — Gráfico de barras por estado | F | Integrante 1 | ☐ |
| S3-11 | RF-FUNC-022_CP-08-02-BD — Query SQL agrupa correctamente por estado | BD | Integrante 3 | ☐ |
| S3-12 | RF-FUNC-023_CP-08-03-F — Filtro por rango de fechas | F | Integrante 1 | ☐ |
| S3-13 | RF-FUNC-023_CP-08-03-B — Endpoint filtra por fechas correctamente | B | Integrante 2 | ☐ |
| S3-14 | RF-FUNC-023_CP-08-04-F — Filtro por tipo muestra datos correctos | F | Integrante 1 | ☐ |
| S3-15 | RF-FUNC-023_CP-08-04-B — Query filtra por tipo_id | B | Integrante 2 | ☐ |
| S3-16 | RF-FUNC-023_CP-08-05-F — Filtro por ubicación | F | Integrante 1 | ☐ |
| S3-17 | RF-FUNC-023_CP-08-05-B — Query filtra por ubicación | B | Integrante 2 | ☐ |
| S3-18 | RF-FUNC-021_CP-08-06-BD — Tiempo promedio de resolución | BD | Integrante 3 | ☐ |

### Días 4-5: Módulo 09 — Autenticación + Módulo 10 — Validaciones

| # | Tarea | Capa | Responsable | Estado |
|---|-------|------|-------------|:------:|
| S3-19 | RF-FUNC-024_CP-09-01-F — Login con credenciales válidas → dashboard | F | Integrante 1 | ☐ |
| S3-20 | RF-FUNC-024_CP-09-01-B — POST /login retorna token JWT | B | Integrante 2 | ☐ |
| S3-21 | RF-UI-001_CP-09-02-F — Password incorrecto muestra error | F | Integrante 1 | ☐ |
| S3-22 | RF-SW-001_CP-09-02-B — Login falla → HTTP 401 | B | Integrante 2 | ☐ |
| S3-23 | RF-UI-001_CP-09-03-F — Email vacío muestra validación | F | Integrante 1 | ☐ |
| S3-24 | RF-FUNC-025_CP-09-04-F — Logout cierra sesión → login | F | Integrante 1 | ☐ |
| S3-25 | RF-FUNC-025_CP-09-04-B — POST /logout invalida token | B | Integrante 2 | ☐ |
| S3-26 | RF-FUNC-026_CP-09-05-F — Acceso sin auth redirige a login | F | Integrante 1 | ☐ |
| S3-27 | RS-006_CP-09-06-F — Sesión expira → redirige a login | F | Integrante 1 | ☐ |
| S3-28 | RS-003_CP-10-01-F — Email inválido muestra error en tiempo real | F | Integrante 1 | ☐ |
| S3-29 | RS-002_CP-10-01-B — Backend valida formato email con regex | B | Integrante 2 | ☐ |
| S3-30 | RS-001_CP-10-02-F — Contador de caracteres en campo descripción | F | Integrante 1 | ☐ |
| S3-31 | RS-003_CP-10-03-F — Caracteres HTML/XSS se sanitizan | F | Integrante 1 | ☐ |
| S3-32 | RS-002_CP-10-03-B — Sanitización backend previene XSS | B | Integrante 2 | ☐ |
| S3-33 | RO-001_CP-10-04-F — Campo numérico no acepta letras | F | Integrante 1 | ☐ |
| S3-34 | RO-001_CP-10-05-F — Fecha inválida muestra mensaje de error | F | Integrante 1 | ☐ |
| S3-35 | RS-002_CP-10-06-B — Backend valida rango de fechas | B | Integrante 2 | ☐ |

> **Semana 3:** 35 tareas (18 notificaciones+dashboard + 9 auth + 8 validaciones)  
> **Entregable:** Capturas CP-07, CP-08, CP-09 y CP-10

---

## Semana 4 — Pruebas Transversales y Consolidación

**Objetivo:** Carga/estrés, integridad BD, herramientas de calidad y evidencias.

### Días 1-2: Pruebas de Carga y Estrés (O4 — 3 pts)

| # | Tarea | Capa | Responsable | Estado |
|---|-------|------|-------------|:------:|
| S4-01 | O4_RR-001 — Prueba de carga: tiempo de respuesta de páginas < 2s | — | Integrante 3 | ☐ |
| S4-02 | O4_RR-002 — Prueba de carga: latencia API CRUD < 1s | — | Integrante 3 | ☐ |
| S4-03 | O4_RR-003 — Prueba de carga: dashboard < 3s | — | Integrante 3 | ☐ |
| S4-04 | O4_RR-005 — Prueba de estrés: 20 usuarios concurrentes sin degradación | — | Integrante 3 | ☐ |
| S4-05 | O4_Reporte — Generar reporte técnico JMeter/k6 con gráficos | — | Integrante 3 | ☐ |

### Días 3-4: Integridad BD + Herramientas de Calidad (O5 — 3 pts)

| # | Tarea | Capa | Responsable | Estado |
|---|-------|------|-------------|:------:|
| S4-06 | O5_RM-002 — Ejecutar Laravel Pint y verificar PSR-12 en todo el código | B | Integrante 2 | ☐ |
| S4-07 | O5_RF-004 — Verificar persistencia de datos con volúmenes Docker | BD | Integrante 3 | ☐ |
| S4-08 | O5_RF-002 — Verificar integridad referencial (todas las FK) | BD | Integrante 3 | ☐ |
| S4-09 | O5_RF-003 — Documentar procedimiento de backup/restore | BD | Integrante 3 | ☐ |
| S4-10 | O5_Exportar — Exportar colección Postman completa como JSON | B | Integrante 2 | ☐ |

### Día 5: Consolidación de Evidencias y Métricas (O6 — 2 pts)

| # | Tarea | Capa | Responsable | Estado |
|---|-------|------|-------------|:------:|
| S4-11 | O6_Evidencias — Organizar carpeta `evidencias/` con estructura estándar | — | Todos | ☐ |
| S4-12 | O6_Métricas — Consolidar tabla de métricas finales | — | Todos | ☐ |
| S4-13 | O6_RO-003 — Verificar formatos de fecha dd/mm/aaaa en toda la UI | F | Integrante 1 | ☐ |
| S4-14 | O6_RS-004 — Verificar tokens CSRF en formularios | B | Integrante 2 | ☐ |
| S4-15 | O6_RS-005 — Verificar configuración CORS en Docker | B | Integrante 2 | ☐ |
| S4-16 | O6_RM-004 — Verificar logs en storage/logs/laravel.log | B | Integrante 2 | ☐ |

> **Semana 4:** 16 tareas (5 carga + 5 herramientas + 6 consolidación)  
> **Entregable:** Reporte JMeter/k6, reporte Laravel Pint, carpeta evidencias organizada, tabla métricas

---

## Semana 5 — Revisión Final y Documentación

**Objetivo:** Checklist pre-sustentación y documentación técnica final.

### Días 1-2: Revisión Final y Checklist

| # | Tarea | Capa | Responsable | Estado |
|---|-------|------|-------------|:------:|
| S5-01 | Revisar 100% de casos de prueba ejecutados (94/94) | — | Todos | ☐ |
| S5-02 | Verificar 0 errores JS no controlados en consola | F | Integrante 1 | ☐ |
| S5-03 | RO-001 — Probar responsividad en desktop, tablet y móvil | F | Integrante 1 | ☐ |
| S5-04 | RO-002 — Verificar contraste de colores y tamaño de fuentes | F | Integrante 1 | ☐ |
| S5-05 | RP-003 — Probar en al menos 2 navegadores (Chrome + Firefox) | F | Integrante 1 | ☐ |
| S5-06 | RP-001 — Verificar `docker compose up --build` exitoso y limpio | — | Integrante 3 | ☐ |
| S5-07 | RP-002 — Verificar migrations compatibles MySQL y PostgreSQL | BD | Integrante 3 | ☐ |
| S5-08 | RM-001 — Revisar cobertura de PHPDoc en funciones principales | B | Integrante 2 | ☐ |
| S5-09 | RM-003 — Verificar separación MVC en estructura de directorios | B | Integrante 2 | ☐ |
| S5-10 | Completar checklist pre-sustentación (§14 del Plan de Calidad) | — | Todos | ☐ |

### Días 3-5: Documentación Técnica Final

| # | Tarea | Capa | Responsable | Estado |
|---|-------|------|-------------|:------:|
| S5-11 | Preparar documento técnico de sustentación (8-12 páginas) | — | Todos | ☐ |
| S5-12 | Generar archivo SQL de respaldo con seeders | BD | Integrante 3 | ☐ |
| S5-13 | Configurar credenciales de acceso de prueba (admin + operador) | — | Todos | ☐ |
| S5-14 | Verificar URL del sistema accesible en entorno de despliegue | — | Integrante 3 | ☐ |
| S5-15 | Actualizar repositorio GitHub con tag de versión final | — | Integrante 2 | ☐ |

> **Semana 5:** 15 tareas (10 revisión + 5 documentación)  
> **Entregable:** Documento técnico, checklist completado, SQL de respaldo, tag GitHub

---

## Resumen por Semana

| Semana | Módulos | Tareas | Frontend | Backend | BD | Otros | Puntaje Rúbrica |
|:------:|---------|:------:|:--------:|:-------:|:--:|:-----:|:---------------:|
| **1** | Config + 01 + 02 | 26 | 10 | 9 | 2 | 5 | — |
| **2** | 03 + 04 + 05 + 06 | 34 | 16 | 14 | 4 | 0 | — |
| **3** | 07 + 08 + 09 + 10 | 35 | 17 | 14 | 4 | 0 | — |
| **4** | Transversales | 16 | 1 | 5 | 4 | 6 | O4(3) + O5(3) + O6(2) |
| **5** | Revisión + Docs | 15 | 4 | 3 | 2 | 6 | — |
| **Total** | **10 módulos** | **126** | **48** | **45** | **16** | **17** | **20 pts** |

> **Nota:** Las 126 tareas incluyen las 94 del Plan de Calidad más 32 tareas de configuración, infraestructura, herramientas transversales, revisión y documentación.

---

## Progreso Global

- [ ] Semana 1 — 0/26 completadas
- [ ] Semana 2 — 0/34 completadas
- [ ] Semana 3 — 0/35 completadas
- [ ] Semana 4 — 0/16 completadas
- [ ] Semana 5 — 0/15 completadas
- [ ] **Total: 0/126 (0%)**

---

*Plan derivado del cronograma semanal del Plan de Calidad (§10.1) con trazabilidad completa a requisitos SRS.*
