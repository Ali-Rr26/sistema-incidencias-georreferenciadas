# Tareas — Trazabilidad SRS ↔ Plan de Calidad

Cada tarea vincula un **requisito del SRS** con sus **casos de prueba del Plan de Calidad** usando una nomenclatura compuesta:

```
<ID-REQUISITO>_<ID-PRUEBA>
```

**Ejemplo:** `RF-FUNC-001_CP-01-01` → Requisito "Crear Incidencia" + Prueba "Formulario completo con todos los campos válidos".

---

## Índice de Módulos

| Módulo | Nombre | Requisitos SRS | Casos CP | Archivo |
|--------|--------|---------------|----------|---------|
| 01 | Gestión de Incidencias (CRUD) | 5 | 12 | [modulo-01-crud.md](modulo-01-crud.md) |
| 02 | Estados e Historial | 3 | 11 | [modulo-02-estados.md](modulo-02-estados.md) |
| 03 | Asignación de Responsables | 3 | 10 | [modulo-03-responsables.md](modulo-03-responsables.md) |
| 04 | Sistema de Comentarios | 3 | 10 | [modulo-04-comentarios.md](modulo-04-comentarios.md) |
| 05 | Ubicación Georreferenciada | 2 | 9 | [modulo-05-ubicacion.md](modulo-05-ubicacion.md) |
| 06 | Clasificación Jerárquica | 2 | 8 | [modulo-06-clasificacion.md](modulo-06-clasificacion.md) |
| 07 | Sistema de Notificaciones | 2 | 10 | [modulo-07-notificaciones.md](modulo-07-notificaciones.md) |
| 08 | Dashboard y Métricas | 3 | 12 | [modulo-08-dashboard.md](modulo-08-dashboard.md) |
| 09 | Autenticación y Control de Acceso | 3 | 9 | [modulo-09-autenticacion.md](modulo-09-autenticacion.md) |
| 10 | Validaciones de Formato y Seguridad | 5 | 8 | [modulo-10-validaciones.md](modulo-10-validaciones.md) |
| **—** | **Requisitos No Funcionales** | 22 | 0 | [requisitos-no-funcionales.md](requisitos-no-funcionales.md) |

---

## Matriz de Trazabilidad Completa

| ID Requisito SRS | Descripción Breve | Casos de Prueba Asociados |
|------------------|-------------------|--------------------------|
| **RF-UI-001** | Pantalla de Login | CP-09-01-F, CP-09-01-B, CP-09-02-F, CP-09-02-B, CP-09-03-F |
| **RF-UI-002** | Dashboard Principal | CP-08-01-F, CP-08-02-F, CP-08-03-F, CP-08-04-F, CP-08-05-F |
| **RF-UI-003** | Formulario Creación/Edición Incidencia | CP-01-01-F, CP-01-02-F, CP-01-03-F, CP-01-04-F |
| **RF-UI-004** | Vista Detalle de Incidencia | CP-01-05-F, CP-01-06-F, CP-02-03-F, CP-04-04-F |
| **RF-UI-005** | Panel de Notificaciones | CP-07-01-F, CP-07-02-F, CP-07-03-F, CP-07-05-F |
| **RF-SW-001** | API REST — Autenticación | CP-09-01-B, CP-09-02-B, CP-09-04-B |
| **RF-SW-002** | API REST — Incidencias | CP-01-01-B, CP-01-02-B, CP-01-03-B, CP-01-04-B, CP-01-06-B |
| **RF-SW-003** | API REST — Estados e Historial | CP-02-01-B, CP-02-02-B, CP-02-03-B, CP-02-05-B |
| **RF-SW-004** | API REST — Responsables | CP-03-01-B, CP-03-02-B, CP-03-04-B, CP-03-05-B |
| **RF-SW-005** | API REST — Comentarios | CP-04-01-B, CP-04-02-B, CP-04-04-B, CP-04-05-B |
| **RF-SW-006** | API REST — Ubicación | CP-05-01-B, CP-05-02-B, CP-05-03-B |
| **RF-SW-007** | API REST — Tipos y Subtipos | CP-06-01-B, CP-06-02-B, CP-06-03-B |
| **RF-SW-008** | API REST — Notificaciones | CP-07-02-B, CP-07-04-B, CP-07-05-B |
| **RF-SW-009** | API REST — Métricas | CP-08-01-B, CP-08-03-B, CP-08-04-B, CP-08-05-B |
| **RF-FUNC-001** | Crear Incidencia | CP-01-01-F, CP-01-01-B |
| **RF-FUNC-002** | Listar Incidencias | *(implícito en CP-01-04-F)* |
| **RF-FUNC-003** | Ver Detalle Incidencia | CP-02-03-F, CP-05-04-F |
| **RF-FUNC-004** | Editar Incidencia | CP-01-04-F, CP-01-04-B |
| **RF-FUNC-005** | Eliminar Incidencia | CP-01-05-F, CP-01-06-F, CP-01-06-B |
| **RF-FUNC-006** | Estados Disponibles | CP-02-01-F, CP-02-01-B |
| **RF-FUNC-007** | Cambiar Estado | CP-02-02-F, CP-02-02-B, CP-02-04-F |
| **RF-FUNC-008** | Historial de Cambios | CP-02-03-F, CP-02-03-B, CP-02-06-B |
| **RF-FUNC-009** | Asignar Responsable | CP-03-01-F, CP-03-01-B, CP-03-02-F, CP-03-02-B |
| **RF-FUNC-010** | Modificar Asignación | CP-03-03-F, CP-03-03-B, CP-03-04-F, CP-03-04-B |
| **RF-FUNC-011** | Eliminar Responsable | CP-03-05-F, CP-03-05-B |
| **RF-FUNC-012** | Agregar Comentario | CP-04-01-F, CP-04-01-B, CP-04-03-F |
| **RF-FUNC-013** | Listar Comentarios | CP-04-04-F, CP-04-04-B |
| **RF-FUNC-014** | Eliminar Comentario | CP-04-05-F, CP-04-05-B |
| **RF-FUNC-015** | Selección de Ubicación | CP-05-01-F, CP-05-02-F, CP-05-03-F, CP-05-04-F |
| **RF-FUNC-016** | Normalización de Ubicación | CP-05-04-BD |
| **RF-FUNC-017** | Selección Tipo/Subtipo | CP-06-01-F, CP-06-02-F, CP-06-03-F |
| **RF-FUNC-018** | Tipos de Incidencia Predefinidos | CP-06-01-B, CP-06-04-BD |
| **RF-FUNC-019** | Generación de Notificaciones | CP-07-04-B |
| **RF-FUNC-020** | Gestión de Notificaciones | CP-07-01-F, CP-07-02-F, CP-07-02-B, CP-07-03-F, CP-07-05-F, CP-07-05-B |
| **RF-FUNC-021** | Métricas Generales | CP-08-01-F, CP-08-01-B |
| **RF-FUNC-022** | Visualización de Gráficos | CP-08-02-F, CP-08-02-BD |
| **RF-FUNC-023** | Filtros de Dashboard | CP-08-03-F, CP-08-03-B, CP-08-04-F, CP-08-04-B, CP-08-05-F, CP-08-05-B |
| **RF-FUNC-024** | Login de Usuario | CP-09-01-F, CP-09-01-B |
| **RF-FUNC-025** | Logout de Usuario | CP-09-04-F, CP-09-04-B |
| **RF-FUNC-026** | Protección de Rutas | CP-09-05-F, CP-09-06-F |
| **RF-FUNC-027** | Búsqueda por Texto | *(implícito en CP-03-01-F, CP-03-01-B)* |
| **RF-FUNC-028** | Filtros Avanzados | CP-08-03-F, CP-08-03-B, CP-08-04-F, CP-08-04-B, CP-08-05-F, CP-08-05-B |
| **RS-001** | Contraseñas (hash bcrypt) | CP-10-02-F *[validación longitud]* |
| **RS-002** | Prevención Inyección SQL | CP-10-03-B *[sanitización]* |
| **RS-003** | Prevención XSS | CP-10-03-F, CP-10-03-B |
| **RS-004** | CSRF | *(validación implícita en formularios)* |
| **RS-005** | CORS | *(validación en entorno Docker)* |
| **RS-006** | Sesiones (expiración) | CP-09-06-F |
| **RR-001** | Tiempo de respuesta < 2s | *(pruebas de carga — O4)* |
| **RO-001** | Responsividad | CP-10-05-F *[parcial]* |

> **Total:** 45 requisitos del SRS con trazabilidad a 94 casos de prueba del Plan de Calidad.

---

## Convención de Nomenclatura de Tareas

Cada tarea en los archivos de módulo sigue el formato:

```
### <ID-SRS>_<ID-CP>: <Título de la Tarea>
```

Donde:
- `<ID-SRS>` = identificador del requisito en el SRS (ej: `RF-FUNC-001`)
- `<ID-CP>` = identificador del caso de prueba en el Plan de Calidad (ej: `CP-01-01-F`)
- `<Título>` = descripción accionable de la tarea

---

## Vista por Semanas

Las tareas están reorganizadas por semana según el cronograma del Plan de Calidad (§10.1):

📅 **[plan-por-semanas.md](plan-por-semanas.md)** — 126 tareas distribuidas en 5 semanas con trazabilidad completa.

| Semana | Módulos | Tareas | Puntaje Rúbrica |
|:------:|---------|:------:|:---------------:|
| 1 | Config + CRUD + Estados | 26 | — |
| 2 | Responsables + Comentarios + Ubicación + Clasificación | 34 | — |
| 3 | Notificaciones + Dashboard + Auth + Validaciones | 35 | — |
| 4 | Pruebas carga/estrés + Integridad BD + Herramientas | 16 | O4(3)+O5(3)+O6(2) |
| 5 | Revisión final + Checklist + Documentación | 15 | — |

---

## Cómo usar esta carpeta

1. **Planificación semanal:** abrí `plan-por-semanas.md` para ver qué toca cada semana.
2. **Detalle por módulo:** cada `modulo-XX-*.md` tiene las tareas individuales con su nomenclatura `<ID-SRS>_<ID-CP>`.
3. **Requisitos no funcionales:** `requisitos-no-funcionales.md` cubre rendimiento, seguridad, portabilidad, etc.
4. **Para la sustentación:** la matriz de trazabilidad en este README justifica la cobertura requisito↔prueba.

---

*Generado a partir de `docs/Requisitos/Especificaciones-Requisitos-Software.md` y `docs/Plan de calidad/Plan-de-Calidad.md`.*
