# 📋 Plan de Gestión de Calidad de Software
## Proyecto: Sistema Web de Gestión de Incidencias Georreferenciadas

Este Plan de Calidad de Software (SQAP) ha sido estructurado tomando como referencia el estándar internacional **ISO/IEC 25000 (SQuaRE)** para la evaluación de atributos de calidad de producto, y los fundamentos de la Gestión de la Calidad en el Desarrollo de Software, dividiendo las acciones en Aseguramiento de Calidad (QA) y Control de Calidad (QC).

Cada objetivo de este plan se alinea directamente con los criterios de evaluación de la rúbrica de la asignatura **Calidad de Software (20%)**, garantizando trazabilidad entre las actividades planificadas y la evidencia exigida por el tribunal evaluador.

---

## 1. Propósito y Alcance

### 1.1. Propósito
Establecer un marco de trabajo formal para guiar las actividades de prevención, medición y corrección de defectos dentro del proyecto integrador. El fin primordial es asegurar que el software entregado cumpla de manera estricta con las especificaciones técnicas y los criterios de aceptación del tribunal de evaluación, cubriendo los seis criterios de la rúbrica de Calidad de Software.

### 1.2. Alcance
Este plan regula de forma transversal todos los componentes desplegados en el entorno controlado:

| Componente | Tecnología |
| :--- | :--- |
| Base de datos relacional | MySQL, PostgreSQL o motor relacional equivalente |
| Motor lógico del servidor | Laravel API REST |
| Interfaz de usuario | Bootstrap / FreeDash |
| Comunicación asíncrona | JavaScript Fetch API |
| Entorno de despliegue | Docker / Docker Compose |

---

## 2. Referencias Normativas

| Estándar | Descripción |
| :--- | :--- |
| **ISO/IEC 25000 (SQuaRE)** | Marco de referencia para la evaluación de características de calidad de producto de software |
| **ISO/IEC 25010** | Define el modelo de calidad: características y sub-características evaluables (Adecuación Funcional, Fiabilidad, Eficiencia de Rendimiento, Portabilidad) |
| **IEEE 730** | Lineamientos para la elaboración de Planes de Aseguramiento de Calidad del Software (SQAP) |
| **PSR-12** | Guía de estilos de codificación para PHP adoptada por la comunidad Laravel |

---

## 3. Roles y Responsabilidades en el Ciclo de Calidad

| Rol | Área de Responsabilidad |
| :--- | :--- |
| **Especialista en Frontend** | Validaciones de campos en el cliente (Bootstrap/HTML5), inspección visual de interfaz y correcta recepción de datos JSON mediante Fetch API |
| **Especialista en Backend** | Capas de validación del servidor (Laravel Form Requests), manejo de excepciones con bloques `try-catch`, seguridad de endpoints y métricas de resolución temporal |
| **Especialista en Infraestructura y BD** | Persistencia de datos con volúmenes Docker, aislamiento en red de contenedores, integridad referencial del modelo relacional y ejecución de pruebas de estrés |
| **Equipo Completo** | Diseño y ejecución colaborativa de la Matriz de Casos de Prueba funcionales y levantamiento de evidencias |

---

## 4. Objetivos de Calidad

Los seis objetivos de este plan se mapean directamente con los criterios de la rúbrica de **Calidad de Software (20 puntos)** y se sustentan en las características del modelo **ISO/IEC 25010**:

| # | Objetivo | Criterio Rúbrica | Característica ISO 25010 | Puntaje |
| :--- | :--- | :--- | :--- | :---: |
| **O1** | Validaciones del sistema | Validaciones del sistema | Adecuación Funcional — Corrección | 4 |
| **O2** | Casos de prueba funcionales | Casos de prueba funcionales | Adecuación Funcional — Completitud | 4 |
| **O3** | Evidencias de testing | Evidencias de testing | Fiabilidad — Madurez | 4 |
| **O4** | Pruebas de carga o estrés | Pruebas de carga o estrés | Eficiencia de Rendimiento | 3 |
| **O5** | Uso de herramientas de calidad | Uso de herramientas de calidad | Mantenibilidad — Analizabilidad | 3 |
| **O6** | Métricas e indicadores | Métricas e indicadores | Adecuación Funcional — Completitud | 2 |
| | | | **Total** | **20** |

---

## 5. Criterios y Estándares de Calidad

Para que un componente sea declarado **"Apto para Producción"**, debe satisfacer los siguientes estándares técnicos mínimos:

* **Estándar de Código (PHP / PSR-12):** Cumplimiento de la guía de estilos PSR-12, verificado y unificado de forma automatizada mediante **Laravel Pint**.
* **Estándar de Arquitectura de Datos:** Base de datos completamente normalizada bajo la **Tercera Forma Normal (3FN)** para la segmentación de entidades de ubicación (País, Provincia, Ciudad), garantizando la integridad referencial mediante llaves foráneas.
* **Estándar de Comunicación (API REST):** Consumo asíncrono estricto mediante la Fetch API de JavaScript. Los endpoints deben responder con códigos HTTP estándar: `200/201` operaciones exitosas, `422` fallos de validación, `500` excepciones internas.
* **Estándar de Rendimiento:** Tiempo promedio de respuesta del servidor < 2.0 segundos bajo carga concurrente básica.
* **Estándar de Evidencias:** Todo resultado de prueba debe documentarse con captura de pantalla o reporte exportado antes de la sustentación técnica final.

---

## 6. Ciclo de Testing y Actividades (QA vs. QC)

### 6.1. Actividades de Aseguramiento de Calidad (QA — Preventivas)

* **Diseño del Contrato de Datos (Mocking):** Definición previa de estructuras JSON de entrada y salida antes de iniciar el desarrollo. Mitiga errores de acoplamiento entre Frontend y Backend y permite desarrollo en paralelo.
* **Revisiones de Código de Pares (Code Review):** Inspección cruzada de la lógica de código entre integrantes antes de autorizar la fusión de ramas en Git.
* **Verificación Estática con Laravel Pint:** Ejecución automatizada de la herramienta para garantizar cumplimiento del estándar PSR-12 en todo el código PHP del proyecto *(cubre O5)*.

### 6.2. Actividades de Control de Calidad (QC — Correctivas)

Las pruebas se ejecutan de forma incremental siguiendo el ciclo de vida del software:

1. **Pruebas de Validación (Backend):** Verificación de que los endpoints rechacen correctamente peticiones malformadas, retornando HTTP `422` con mensajes de error descriptivos *(cubre O1)*.
2. **Pruebas de Validación (Frontend):** Verificación de que los formularios bloqueen el envío ante campos vacíos o con formato incorrecto antes de realizar el Fetch *(cubre O1)*.
3. **Pruebas Funcionales del Sistema:** Ejecución de la Matriz de Casos de Prueba sobre los flujos principales: registro, edición, cambio de estado, historial, comentarios y notificaciones *(cubre O2)*.
4. **Pruebas de Integración (API ↔ Frontend):** Verificación de que el JavaScript Fetch inyecte correctamente datos dinámicos en tablas y gráficos (ApexCharts) *(cubre O2 y O3)*.
5. **Pruebas de Rendimiento (Carga / Estrés):** Simulación de solicitudes concurrentes sobre endpoints críticos para evaluar estabilidad del entorno contenerizado *(cubre O4)*.

### 6.3. Recolección de Evidencias (QC — Documentación)

Toda prueba ejecutada genera evidencia documentada obligatoria *(cubre O3)*:

* Capturas de pantalla de respuestas HTTP en Postman (validaciones y errores).
* Tabla de casos de prueba con estado "Aprobado" / "Fallido" y observaciones.
* Reporte gráfico de la herramienta de pruebas de carga (latencia, throughput).
* Capturas de la consola del navegador mostrando ausencia de `Uncaught Errors`.

---

## 7. Matriz de Métricas, Indicadores y Evidencias

Cada objetivo se evalúa bajo la siguiente estructura relacional:

| Objetivo | Criterio Rúbrica | Criterio de Aceptación | Métrica / Indicador | Actividad de Calidad | Responsable | Evidencia Técnica Obligatoria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **O1** | Validaciones del sistema | Bloqueo total de peticiones HTTP malformadas o incompletas | % de endpoints protegidos por Form Requests = **100%** | Pruebas de validación backend + frontend | Backend & Frontend Specialist | Capturas Postman con HTTP **422**; capturas de validación en formularios |
| **O2** | Casos de prueba funcionales | Transiciones de estado lógicas y trazabilidad fiel del historial | Tasa de éxito de casos ejecutados = **100%** | Ejecución de la Matriz de Casos de Prueba | Equipo Completo | Tabla de casos con estado "Aprobado" y capturas de flujos CRUD completos |
| **O3** | Evidencias de testing | Toda prueba ejecutada debe contar con evidencia documentada | Cantidad de pruebas sin evidencia = **0** | Recolección y organización de capturas y reportes tras cada ciclo de testing | Equipo Completo | Carpeta de evidencias con capturas ordenadas por módulo y tipo de prueba |
| **O4** | Pruebas de carga o estrés | Estabilidad del API REST bajo concurrencia simulada | Tiempo de respuesta promedio **< 2.0 segundos** | Simulación automatizada de carga sobre contenedores con herramienta externa | Infrastructure Specialist | Reporte gráfico exportado (latencia, solicitudes/seg, tasa de error) |
| **O5** | Uso de herramientas de calidad | Uso demostrable de herramientas en al menos 3 actividades de QA/QC distintas | N° de herramientas utilizadas con evidencia ≥ **3** | Aplicación de Postman, Laravel Pint y herramienta de carga durante el ciclo de testing | Equipo Completo | Capturas de uso de cada herramienta: reporte Pint, colección Postman, reporte de carga |
| **O6** | Métricas e indicadores | Presentación de datos cuantificables del funcionamiento y calidad del sistema | ≥ **3 métricas** documentadas al cierre del proyecto | Consolidación de métricas al finalizar las pruebas QC | Equipo Completo | Tabla de métricas finales con valores obtenidos (ver §8) |

---

## 8. Métricas e Indicadores del Sistema

Las siguientes métricas se medirán y documentarán como entregable final del plan *(cubre O6)*:

| Métrica | Descripción | Valor Objetivo | Herramienta de Medición |
| :--- | :--- | :--- | :--- |
| **Tasa de validación backend** | % de endpoints con Form Requests activos | 100% | Revisión de código / Postman |
| **Tasa de éxito de casos de prueba** | % de casos funcionales aprobados | 100% | Matriz de casos de prueba |
| **Tiempo promedio de respuesta** | Latencia promedio bajo carga concurrente | < 2.0 seg | JMeter / k6 |
| **Errores JS no controlados** | `Uncaught Errors` en consola del navegador | 0 | DevTools del navegador |
| **Cobertura de evidencias** | % de pruebas con captura o reporte adjunto | 100% | Revisión del equipo |
| **Tiempo promedio de resolución** | Tiempo promedio entre creación y estado "Resuelto" | Referencial | Consulta SQL / Dashboard |

---

## 9. Riesgos de Calidad y Acciones Mitigadoras

| Riesgo Técnico Identificado | Impacto | Acción Preventiva (QA) / Acción Correctiva (QC) |
| :--- | :--- | :--- |
| **Falta de Persistencia:** Pérdida de registros al reiniciar los contenedores Docker | Crítico | **Preventiva:** Configurar volúmenes locales (`volumes:`) dentro del servicio MySQL/PostgreSQL en `docker-compose.yml` |
| **Bloqueo por CORS:** El cliente Fetch no tiene permisos para consultar la API local de Laravel | Alto | **Correctiva:** Instalar y parametrizar el middleware de CORS de Laravel para autorizar peticiones desde el dominio del cliente |
| **Inyección de Data Corrupta:** Registro de datos georreferenciados redundantes, vacíos o inválidos | Crítico | **Preventiva:** Implementar reglas estrictas en Laravel (`required`, `integer`, `exists:ciudades,id`) para garantizar integridad referencial |
| **Inconsistencia de Datos:** Redundancia en entidades de ubicación | Alto | **Preventiva:** Aplicar normalización 3FN con tablas separadas para País, Provincia y Ciudad |
| **Evidencias incompletas:** Pruebas ejecutadas sin documentación fotográfica o de reporte | Alto | **Preventiva:** Establecer como política de equipo documentar cada prueba en el momento de ejecución, no al final |

---

## 10. Herramientas de Calidad

| Categoría | Herramienta | Propósito | Objetivo cubierto |
| :--- | :--- | :--- | :--- |
| **Calidad de Código** | Laravel Pint | Verificación automática del estándar PSR-12 en código PHP | O5 |
| **Pruebas de API** | Postman | Validación de endpoints, códigos HTTP y payloads JSON | O1, O3, O5 |
| **Pruebas de Carga** | Apache JMeter / k6 | Simulación de usuarios concurrentes y medición de latencia | O4, O5 |
| **Inspección de UI** | DevTools del navegador | Auditoría de consola JS, red y responsividad | O1, O3 |
| **Orquestación** | Docker Compose | Despliegue, aislamiento y verificación de persistencia del entorno | O4 |
| **Control de Versiones** | Git / GitHub | Gestión de ramas y revisiones de código de pares (Code Review) | O5 |

---

## 11. Seguimiento y Mejora Continua

* **Puntos de Control:** Revisiones internas periódicas del estado de los contenedores y los endpoints de la API previas a la sustentación técnica final. En cada sesión se verificará el cumplimiento de los criterios de aceptación definidos en §7.
* **Bitácora de Control de Errores (QC):** Toda falla funcional detectada durante las fases de prueba será registrada en un reporte técnico interno. El componente afectado será devuelto a desarrollo para corrección inmediata, requiriendo una nueva ronda de testing antes de autorizar su inclusión en el documento técnico final.
* **Criterio de Cierre:** El plan se considera completado cuando el 100% de los indicadores de la Matriz de Métricas (§7) alcancen el umbral definido, las evidencias técnicas obligatorias estén documentadas (§8) y la tabla de métricas finales esté consolidada.
