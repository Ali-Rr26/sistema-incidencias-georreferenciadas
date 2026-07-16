# 📋 ROADMAP DE TAREAS — E1+E2+E3+E4 Mejoras
**Asignación de Tareas para Equipo · Basado en Hallazgos Reales**

**Fecha Generación:** 16 de julio de 2026  
**Fecha Entrega Esperada:** 03 de agosto de 2026 (antes del 04-05-2026 demo)  
**Estado Global:** 🟡 Abierto

---

## 🎯 Propósito

Este documento consolidar todas las tareas de mejora del proyecto identificadas en:
- **E1:** Requisitos (RF, RNF)
- **E2:** Hallazgos críticos (H-01 a H-06)
- **E3:** Casos de prueba (90 casos)
- **E4:** Defectos encontrados (BUG-001 a BUG-007)

Cada tarea está **asignada a especialista**, **estimada en horas**, y tiene **criterios de aceptación claros**.

---

## 📁 Archivos de Tareas

| Archivo | Destinatario | Tareas | Horas |
|---|---|---|---|
| **TASKS-CRITICAL-E4.md** | Todos | TASK-001: BUG-001<br>TASK-002: BUG-005<br>TASK-003: Re-test | 9.5h |
| **TASKS-BACKEND-E4.md** | Integrante 2 (Alisson) | B01-B05: Sanitizar XSS, Validar categoría, Rate-limit, Filters, Seeder | 9.5h |
| **TASKS-FRONTEND-E4.md** | Integrante 1 (Andy) | F01-F05: Escape XSS, Listados, Casos incompletos, Responsive, Performance | 7.5h |
| **TASKS-BD-INFRA-E4.md** | Integrante 3 (Yandris) | BD01-BD06: Migraciones, Triggers, Integridad, Índices, Backup | 8h |

**Total: ~34.5 horas de trabajo**

---

## 🔴 TAREAS CRÍTICAS (Bloquean Demo)

### TAREA-001: Resolver BUG-001 — Tabla `status_history` Ausente

| Aspecto | Detalle |
|---|---|
| **Severidad** | 🔴 Crítico |
| **Responsable** | Integrante 3 (BD) |
| **Estimado** | 2 horas |
| **Impacto** | Bloquea 35 casos de prueba |
| **Dependencias** | Ninguna |
| **Archivo** | TASKS-CRITICAL-E4.md → TASK-001 |

**Descripción:** Ejecutar `php artisan migrate` para crear tablas `status_history`, `comments`, `role_permission`, `menu_permission`.

**Validación:** ✅ Todas las 44 migraciones ejecutan sin error, triggers funcionan

---

### TAREA-002: Resolver BUG-005 — XSS Almacenado

| Aspecto | Detalle |
|---|---|
| **Severidad** | 🔴 Crítico (Seguridad) |
| **Responsables** | Integrante 2 (Backend) + Integrante 1 (Frontend) |
| **Estimado** | 2-3 horas |
| **Impacto** | OWASP CWE-79, ejecución de JS arbitrario |
| **Dependencias** | Ninguna |
| **Archivo** | TASKS-CRITICAL-E4.md → TASK-002 |

**Descripción:** 
- Backend: Instalar Purifier, sanitizar `title`/`description`/`message`
- Frontend: Reemplazar `innerHTML` por `textContent` o `htmlEscape()`

**Validación:** ✅ Payload XSS se almacena sanitizado, frontend no ejecuta

---

### TAREA-003: Re-test Completo E4 Post-Correcciones

| Aspecto | Detalle |
|---|---|
| **Severidad** | 🟠 Alto |
| **Responsable** | Todos (coordinado) |
| **Estimado** | 4-6 horas |
| **Impacto** | Verificar correcciones no rompen otros casos |
| **Dependencias** | TASK-001, TASK-002 |
| **Archivo** | TASKS-CRITICAL-E4.md → TASK-003 |

**Descripción:** Re-ejecutar 35 casos bloqueados (M02, M04, M07) + 2 casos XSS + verificar casos que pasaban sigan pasando

**Validación:** ✅ ≥65/90 casos pasan (72%)

---

## 🟠 TAREAS ALTAS (Pre-Demo, No Bloquean pero Mejoran Mucho)

### Backend (Integrante 2)

| Tarea | Severidad | Estimado | Archivo |
|---|---|---|---|
| **B02:** Validar categoría es hoja | Alto | 1h | TASKS-BACKEND-E4.md |
| **B03:** Rate-limiting POST /login (H-02) | Alto | 1.5h | TASKS-BACKEND-E4.md |
| **B04:** Dashboard filters | Alto | 2h | TASKS-BACKEND-E4.md |

### Frontend (Integrante 1)

| Tarea | Severidad | Estimado | Archivo |
|---|---|---|---|
| **F02:** Completar listados post-BD fix | Alto | 1.5h | TASKS-FRONTEND-E4.md |

### BD/Infra (Integrante 3)

| Tarea | Severidad | Estimado | Archivo |
|---|---|---|---|
| **BD02:** Verificar triggers | Alto | 1h | TASKS-BD-INFRA-E4.md |
| **BD03:** Auditar integridad referencial | Alto | 1h | TASKS-BD-INFRA-E4.md |

---

## 🟡 TAREAS MEDIAS (Mejoras, Post-Demo)

### Backend (Integrante 2)

| Tarea | Detalle | Estimado |
|---|---|---|
| **B05:** IncidentSeeder logging | Bajo | 0.5h |

### Frontend (Integrante 1)

| Tarea | Detalle | Estimado |
|---|---|---|
| **F03:** Completar casos incompletos | CP-01-03-F, CP-08-03-F, etc. | 2h |
| **F04:** Responsive (RNF-08) | Desktop/Tablet/Móvil | 1h |
| **F05:** Performance dashboard (RNF-02) | < 3 segundos | 1h |

### BD/Infra (Integrante 3)

| Tarea | Detalle | Estimado |
|---|---|---|
| **BD04:** Casos BD incompletos | CP-05-04-BD, CP-08-06-BD | 1h |
| **BD05:** Optimizar índices PostGIS | GIST, B-tree | 1.5h |
| **BD06:** Backup/Restore testing | Procedimientos | 1h |

---

## 📊 Matriz de Asignación

```
┌─────────────────────────────────────────────────────────────────┐
│                         ANDY (FRONTEND)                          │
├─────────────────────────────────────────────────────────────────┤
│ CRÍTICO:  TASK-002 (XSS escape) — Coordinado con Backend         │
│ ALTAS:    F02 (Listados post-BD)                                 │
│ MEDIAS:   F03, F04, F05                                          │
│ Total:    ~7.5 horas                                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      ALISSON (BACKEND)                           │
├─────────────────────────────────────────────────────────────────┤
│ CRÍTICO:  TASK-002 (XSS sanitize) — Coordinado con Frontend     │
│ ALTAS:    B02, B03 (Rate-limit), B04 (Filters)                  │
│ BAJAS:    B05 (Seeder logging)                                  │
│ Total:    ~9.5 horas                                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    YANDRIS (BD/INFRAESTRUCTURA)                  │
├─────────────────────────────────────────────────────────────────┤
│ CRÍTICO:  TASK-001 (Migraciones BUG-001)                         │
│ ALTAS:    BD02 (Triggers), BD03 (Integridad)                    │
│ MEDIAS:   BD04, BD05, BD06                                       │
│ Total:    ~8 hours                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📅 Timeline Recomendado

```
2026-07-17 (Miércoles)
├─ YANDRIS: TASK-001 (BD01) — Migraciones
├─ YANDRIS: BD02 — Triggers
└─ ANDY/ALISSON: Coordinación TASK-002

2026-07-18 (Jueves)
├─ ALISSON: B01/B02 — Sanitizar XSS + Validar categoría
├─ ANDY: F01 — Escape XSS + F02 Listados
└─ YANDRIS: BD03 — Integridad

2026-07-19 (Viernes)
├─ ALISSON: B03 — Rate-limiting + B04 Filters
├─ ANDY: F03 — Casos incompletos
└─ YANDRIS: BD04 + BD05 — Índices

2026-07-20 (Sábado)
├─ TODOS: TASK-003 — Re-test completo
├─ YANDRIS: BD06 — Backup/Restore
└─ Buffer de tiempo

2026-07-21 a 2026-07-31 (Buffer)
├─ Fixes adicionales si falla algo
├─ Documentación final
└─ Validación pre-demo
```

---

## ✅ Checklist Previo a Demo (04-05-2026)

Antes de la presentación, verificar:

- [ ] ✅ TASK-001: BUG-001 resuelto (35 casos ahora pasan)
- [ ] ✅ TASK-002: BUG-005 resuelto (XSS sanitizado)
- [ ] ✅ TASK-003: Re-test completo (≥65/90 casos pasan)
- [ ] ✅ E1 Requisitos validados (RF, RNF funcionales)
- [ ] ✅ E2 Hallazgos corregidos (H-01 a H-05 verificados)
- [ ] ✅ E3 Casos ejecutados (90/90)
- [ ] ✅ E4 Defectos resueltos (BUG-001, BUG-005 al menos)
- [ ] ✅ Screenshots/evidencias depositadas
- [ ] ✅ Documentación E4 v2.1 generada

---

## 🚨 Defectos Críticos Conocidos

| Bug | Severidad | Estado | Acción |
|---|---|---|---|
| BUG-001 | 🔴 Crítico | 🔧 TASK-001 | Ejecutar migraciones |
| BUG-005 | 🔴 Crítico | 🔧 TASK-002 | Sanitizar + Escape |
| BUG-002 | 🟠 Alto | ✅ Corregido | Verificado re-test |
| BUG-004 | 🟠 Alto | ✅ Corregido | Verificado re-test |
| BUG-003 | 🟠 Alto | ⏳ Pendiente | B02 Backend |

---

## 🤝 Coordinación Entre Equipos

### Sincronización Necesaria

1. **TASK-002 (XSS):** Backend + Frontend deben coordinar
   - Backend termina sanitización → Frontend prueba
   - Frontend termina escape → Backend verifica API responses

2. **TASK-003 (Re-test):** Todos juntos
   - Asignar casos por módulo/especialista
   - Documentar resultados en matriz E4 v2.1

3. **Daily Standup:** Recomendado 10 min diarios durante tareas críticas
   - Bloqueadores
   - Avances
   - Dependencias

---

## 📞 Puntos de Contacto

| Especialista | Área | Email |
|---|---|---|
| **Andy Bryan Alejandro Vera** | Frontend/UI | <si tienes email> |
| **Alisson Yamel Reyes Ricardo** | Backend/API | <si tienes email> |
| **Yandris Miguel Rivera Torres** | BD/Infraestructura | <si tienes email> |

---

## 📚 Referencias

- **E1:** SRS-v3.0 REALISTA (especificaciones funcionales)
- **E2:** Hallazgos E2 (H-01 a H-06)
- **E3:** 90 Casos de prueba diseñados
- **E4:** Ejecución real + defectos encontrados (BUG-001 a BUG-007)
- **Estos tasks:** Mejoras específicas por especialista

---

## 🎯 Éxito Global

**Meta:** 
- ✅ 0 defectos críticos bloqueadores antes de demo
- ✅ ≥72% de casos de prueba pasando (≥65/90)
- ✅ E1+E2+E3+E4 íntegramente validados
- ✅ Equipo listo para presentación 04-05-2026

---

**Documento Master:** README-TASKS.md  
**Generado:** 16 de julio de 2026  
**Próximo paso:** Leer archivos específicos por especialista y comenzar TASK-001

