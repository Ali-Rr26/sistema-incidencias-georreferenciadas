# Requisitos No Funcionales

**Requisitos SRS:** RR-001 a RR-005, RF-001 a RF-004, RD-001 a RD-003, RS-001 a RS-006, RM-001 a RM-004, RP-001 a RP-003, RO-001 a RO-003
**Casos de prueba:** Incluidos en O4 (pruebas de carga/estrés), O5 (herramientas de calidad), y módulos funcionales

---

## RR — Requisitos de Rendimiento

| ID | Descripción | Criterio | Mediciones |
|----|-------------|----------|------------|
| **RR-001** | Tiempo de respuesta de páginas | < 2 segundos | ☐ Medir con JMeter/k6 en navegación de páginas principales |
| **RR-002** | Tiempo de respuesta de API | < 1 segundo para CRUD | ☐ Medir latencia promedio en Postman/JMeter |
| **RR-003** | Carga de dashboard | < 3 segundos | ☐ Medir con Chrome DevTools Performance |
| **RR-004** | Tiempo de búsqueda | < 2 segundos | ☐ Medir búsqueda con 1000+ registros |
| **RR-005** | Usuarios concurrentes | Mínimo 20 sin degradación | ☐ Simular con JMeter/k6 |

---

## RF — Requisitos de Fiabilidad

| ID | Descripción | Criterio | Verificación |
|----|-------------|----------|--------------|
| **RF-001** | Disponibilidad del sistema | 99% uptime | ☐ Verificar con Docker Compose y reinicios |
| **RF-002** | Integridad de datos | 0% pérdida | ☐ Verificar con CP-XX-BD (integridad referencial) |
| **RF-003** | Recuperación ante fallos | Restauración en 30 min | ☐ Documentar procedimiento de backup/restore |
| **RF-004** | Persistencia de datos | Datos en reinicios Docker | ☐ Verificar volúmenes Docker |

---

## RD — Requisitos de Disponibilidad

| ID | Descripción | Criterio | Verificación |
|----|-------------|----------|--------------|
| **RD-001** | Horario de operación | 24/7 | ☐ Validado por Docker |
| **RD-002** | Mantenimiento programado | Notificación 48h antes | ☐ Documentar procedimiento |
| **RD-003** | Mensajes de error | Claros y útiles | ☐ Verificado en CP-01-02, CP-09-02, CP-10-05 |

---

## RS — Requisitos de Seguridad

| ID | Descripción | Criterio | Casos CP Asociados |
|----|-------------|----------|-------------------|
| **RS-001** | Contraseñas (hash) | bcrypt/argon2 | ☐ CP-10-02-F |
| **RS-002** | Inyección SQL | Prepared statements | ☐ CP-10-01-B, CP-10-03-B, CP-10-06-B |
| **RS-003** | XSS | Sanitización de salida | ☐ CP-10-03-F, CP-10-03-B |
| **RS-004** | CSRF | Tokens en formularios | ☐ Verificar en formularios (Laravel automático) |
| **RS-005** | CORS | Orígenes restringidos | ☐ Verificar config/cors.php en Docker |
| **RS-006** | Sesiones (expiración) | Token con expiración | ☐ CP-09-06-F |

---

## RM — Requisitos de Mantenibilidad

| ID | Descripción | Criterio | Verificación |
|----|-------------|----------|--------------|
| **RM-001** | Código documentado | Comentarios en funciones/clases | ☐ Revisar cobertura de PHPDoc |
| **RM-002** | PSR-12 | Verificado con Laravel Pint | ☐ Ejecutar `./vendor/bin/pint --test` (O5) |
| **RM-003** | Arquitectura MVC | Separación clara de capas | ☐ Verificar estructura de directorios |
| **RM-004** | Logs | Registro de errores y eventos | ☐ Verificar `storage/logs/laravel.log` |

---

## RP — Requisitos de Portabilidad

| ID | Descripción | Criterio | Verificación |
|----|-------------|----------|--------------|
| **RP-001** | Contenedores Docker | Desplegable con Docker Compose | ☐ `docker compose up --build` exitoso |
| **RP-002** | Base de datos | Compatible MySQL y PostgreSQL | ☐ Verificar migrations sin SQL específico de motor |
| **RP-003** | Navegadores | Chrome, Firefox, Safari, Edge | ☐ Probar en al menos 2 navegadores |

---

## RO — Otros Requisitos

| ID | Descripción | Criterio | Verificación |
|----|-------------|----------|--------------|
| **RO-001** | Responsividad | Desktop, tablet, móvil | ☐ Probar con Chrome DevTools Device Mode |
| **RO-002** | Accesibilidad | Contraste y fuentes legibles | ☐ Verificar contraste de colores, tamaño mínimo 14px |
| **RO-003** | Internacionalización | Español, fechas dd/mm/aaaa | ☐ Verificar todos los formatos de fecha en UI |

---

## Pruebas Transversales (Plan de Calidad — Objetivos O4, O5)

| Objetivo | Descripción | Herramienta | Puntaje |
|----------|-------------|-------------|:-------:|
| **O4** | Pruebas de carga o estrés | JMeter / k6 | 3 pts |
| **O5** | Uso de herramientas de calidad | Laravel Pint, Postman, Chrome DevTools | 3 pts |
| **O6** | Métricas e indicadores | Tabla de métricas finales | 2 pts |

---

> **Total requisitos no funcionales:** 22 | **Con casos de prueba directos:** 6 (RS-001 a RS-006) | **Con verificación documental/transversal:** 16
