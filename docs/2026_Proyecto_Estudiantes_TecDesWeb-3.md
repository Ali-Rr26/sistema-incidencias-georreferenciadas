# Facultad de Sistemas y Telecomunicaciones
## Carrera de Software

### Lineamientos del proyecto integrador para Estudiantes
**Sistema Web de Gestión de Incidencias Georreferenciadas**

---

### 1. Descripción general
El proyecto consiste en el desarrollo de un sistema web que permita registrar, gestionar y visualizar incidencias georreferenciadas. El sistema incluirá funcionalidades de registro de datos, gestión de estados con historial, asignación de responsables, seguimiento mediante comentarios, notificación de eventos y visualización de información.

A diferencia de un sistema básico, la solución permitirá gestionar el ciclo de vida completo de una incidencia, evidenciando la trazabilidad de la información, el seguimiento de eventos y la interacción entre los distintos usuarios del sistema.

La solución deberá evidenciar la integración de tecnologías del lado del cliente y del servidor, el manejo estructurado de datos, la validación funcional del sistema y su ejecución en entornos controlados mediante contenedores.

Además, el proyecto deberá incorporar procesos básicos de aseguramiento de calidad, incluyendo pruebas funcionales, validación de requisitos y documentación de incidencias detectadas durante el desarrollo.

---

### 2. Objetivo
Desarrollar una aplicación web que permita gestionar incidencias georreferenciadas con trazabilidad completa, integrando frontend, backend, base de datos, validación de calidad y despliegue en contenedores, mediante una arquitectura basada en servicios.

---

### 3. Alcance del sistema
El sistema deberá permitir:

#### 1. Gestión de incidencias
- Registro de incidencias con información básica.
- Edición.
- Eliminación.

#### 2. Gestión de estados
- Registro histórico de cambios de estado con fecha y usuario responsable.
- Ejemplo: `Pendiente` $\rightarrow$ `En proceso` $\rightarrow$ `Resuelto`.
- Con historial completo.

#### 3. Asignación de responsables
- Asignar uno o varios usuarios a una incidencia.
- Definir roles (responsable, apoyo).

#### 4. Sistema de comentarios / seguimiento
- Agregar comentarios a incidencias.
- Registro de autor y fecha.

#### 5. Ubicación normalizada, almacenada en tablas relacionadas para evitar redundancia
- País.
- Provincia.
- Ciudad.

#### 6. Clasificación jerárquica
- Tipo de incidencia.
- Subtipo.
- Ejemplo:
  - `Infraestructura` $\rightarrow$ `Alumbrado`
  - `Seguridad` $\rightarrow$ `Robo`

#### 7. Notificaciones del sistema
- Notificaciones por cambios.
- Estado leído/no leído.

#### 8. Prioridad y control
- Prioridad (alta, media, baja).
- Fecha de creación.
- Tiempo de resolución.

#### 9. Consultas con filtros, agrupaciones y métricas
- Incidencias por estado.
- Incidencias por tipo.
- Incidencias por ubicación.
- Tiempo promedio de resolución.
- Visualización mediante tablas o componentes gráficos simples.

#### Despliegue
- Ejecución de la aplicación en contenedores.
- Configuración de un entorno que incluya:
  - Aplicación backend.
  - Base de datos.

---

### 4. Organización del trabajo
El proyecto se desarrollará en equipos de 3 estudiantes. Cada integrante asumirá responsabilidad principal en uno de los siguientes componentes:
- Desarrollo de interfaz y visualización (frontend).
- Desarrollo de servicios y lógica del sistema (backend).
- Diseño de base de datos, despliegue e infraestructura.

Las actividades relacionadas con validación funcional, pruebas y aseguramiento básico de calidad deberán ser desarrolladas de manera colaborativa por todos los integrantes del equipo.

Todos los integrantes deberán comprender e integrar el funcionamiento completo del sistema, garantizando la correcta interacción entre los componentes.

---

### 5. Tecnologías y lineamientos de desarrollo
- El desarrollo del proyecto deberá realizarse utilizando las siguientes tecnologías:
  - **Backend:** Laravel (API REST)
  - **Frontend:** HTML, CSS, Bootstrap
  - **Cliente:** JavaScript (fetch)
  - **Base de datos:** MySQL, PostgreSQL o motores relacionales equivalentes.
  - **Despliegue:** Contenedores (Docker)
- El sistema deberá ser desarrollado como una aplicación web completa e integrada.
- Se deberá mantener consistencia en el diseño de la interfaz.
- Se recomienda el uso de buenas prácticas en la organización del código.

---

### 6. Criterios adicionales (valoración extra)
Se otorgará una bonificación adicional de hasta **5 puntos** a los equipos que implementen funcionalidades avanzadas no obligatorias, tales como:
- Despliegue con múltiples instancias de la aplicación (escalamiento básico).
- Implementación de configuraciones adicionales en contenedores.
- Optimización del sistema más allá de los requerimientos mínimos.

Estas mejoras deberán ser funcionales y correctamente justificadas.

---

### 7. Requerimientos de calidad del software
Como parte de la integración con la asignatura de Calidad de Software, el proyecto deberá incorporar prácticas básicas de validación y aseguramiento de calidad del sistema desarrollado.

Los equipos deberán considerar los siguientes aspectos:
- Validaciones y manejo de errores tanto en frontend como en backend.
- Diseño y ejecución de casos de prueba funcionales sobre los principales módulos del sistema.
- Evidencias de testing realizadas durante el desarrollo.
- Uso básico de métricas o indicadores relacionados con el funcionamiento del sistema.
- Prueba básica de carga o estrés sobre funcionalidades principales.
- Uso de herramientas de apoyo para validación, pruebas o análisis de calidad.

Las evidencias deberán incorporarse tanto en el documento técnico como en la demostración funcional del sistema.

---

### 8. Modalidad de entrega
El proyecto podrá ser desplegado en servidores de la carrera, permitiendo el acceso mediante una URL para su evaluación.

Sin embargo, de manera obligatoria, cada equipo deberá entregar:
- Código fuente del sistema.
- Archivo de base de datos.
- Documento técnico del proyecto.
- Enlaces URLs para evidenciar funcionalidad completa del proyecto.

Esto con el fin de garantizar la disponibilidad del sistema para su evaluación, independientemente del entorno de despliegue.

---

### 9. Documento técnico del proyecto
El documento técnico no debe replicar el contenido del proyecto, sino *"evidenciar la implementación, decisiones y resultados obtenidos"*, por lo tanto, debe:
- Ser claro y no copiar teoría.
- Describir lo que hicieron o dejaron de hacer.
- Permitir ejecutar el sistema.
- Tener una extensión de **8 a 12 páginas máximo**.

#### Estructura del documento

##### Portada
- Nombre del proyecto
- Nombre de la carrera
- Asignaturas involucradas
- Integrantes del equipo
- Docentes
- Fecha

##### 1. Descripción de la implementación
Breve explicación de:
- Cómo lo implementaron.
- Decisiones tomadas.

##### 2. Arquitectura del sistema y tecnologías utilizadas
Descripción general de:
- Frontend.
- Backend.
- Base de datos.
- Contenedores.

*Explicar cómo se relacionan (sin código), y representarlo de forma resumida en un diagrama o esquema.*

##### 3. Funcionalidades implementadas
- Describir lo que implementaron y las funcionalidades no completadas.

##### 4. Base de datos
- Incluir imagen legible del modelo lógico y físico del modelo ER.
- Archivo SQL (adjunto).

##### 5. Credenciales de acceso
- Usuario administrador.
- Usuario normal.
- Contraseñas.

##### 6. Instrucciones de ejecución
Pasos para ejecutar el sistema:
- Cómo iniciar el proyecto.
- Cómo conectar la base de datos.
- Cómo acceder al sistema.

##### 7. Despliegue
Descripción de:
- Uso de contenedores.
- Entorno donde se ejecuta.
- URL del sistema (para verificar funcionalidad completa del proyecto).

##### 8. Evidencias de implementación y calidad del sistema
Incluir evidencias relacionadas con el funcionamiento, validación y calidad del sistema desarrollado.

**Capturas del sistema:**
- Pantalla principal del sistema.
- Registro y gestión de incidencias.
- Listados y consultas.
- Dashboard, reportes o componentes de visualización.

**Evidencias de calidad:**
- Validaciones implementadas.
- Evidencias de pruebas funcionales realizadas.
- Resultados básicos de testing o pruebas de carga.

*Podrán presentarse mediante capturas, tablas, resultados o descripciones breves del proceso realizado.*

**Evidencias adicionales:**
Las capturas, resultados de pruebas, tablas, métricas, registros técnicos y demás evidencias complementarias deberán incluirse como anexos del documento técnico.

##### 9. Dificultades y soluciones
- Problemas encontrados.
- Cómo los resolvieron.

##### 10. Conclusiones
- Qué aprendieron.
- Cómo integraron las materias.

---

### 10. Rúbrica aplicada

#### Tecnologías y Desarrollo Web (40%)

| Criterio | Descripción | Puntaje |
| :--- | :--- | :---: |
| Interfaz de usuario | Diseño claro, organizado y funcional utilizando Bootstrap | 6 |
| Integración frontend-backend | Consumo correcto de servicios web (fetch), envío, recepción y visualización de datos | 6 |
| Funcionalidad del sistema | Implementación del CRUD y funcionalidades adicionales (comentarios, asignación, seguimiento) | 6 |
| Lógica del sistema | Manejo de estados, roles, flujo funcional y trazabilidad de incidencias | 5 |
| Visualización y experiencia de usuario | Conteos, filtros y visualización organizada de información relevante | 4 |
| Organización del código | Estructura clara, orden y buenas prácticas | 4 |
| Documento técnico | Claridad, coherencia y evidencia de decisiones de implementación | 4 |
| Demostración del sistema | Explicación clara del flujo completo del sistema y participación del equipo | 5 |
| **Total** | | **40** |

**Condiciones de la demostración:**
- Tiempo máximo: **10 minutos por grupo**.
- Debe incluir:
  - Explicación general del sistema.
  - Demostración funcional.
  - Participación de todos los integrantes.

*La demostración será evaluada únicamente por la asignatura de Tecnologías y Desarrollo Web y equivale al examen final de la materia.*

#### Calidad de Software (20%)

| Criterio | Descripción | Puntaje |
| :--- | :--- | :---: |
| Validaciones del sistema | Implementación de validaciones y manejo de errores en frontend y backend | 4 |
| Casos de prueba funcionales | Diseño y ejecución de pruebas sobre funcionalidades principales | 4 |
| Evidencias de testing | Presentación de capturas, resultados o registros de pruebas realizadas | 4 |
| Pruebas de carga o estrés | Ejecución básica de pruebas sobre funcionalidades relevantes | 3 |
| Uso de herramientas de calidad | Uso de herramientas de validación, testing o análisis del sistema | 3 |
| Métricas e indicadores | Presentación de métricas relacionadas con pruebas, errores o funcionamiento del sistema | 2 |
| **Total** | | **20** |

#### Administración de Data Center (20%)

| Criterio | Descripción | Puntaje |
| :--- | :--- | :---: |
| Uso de contenedores | Implementación del sistema utilizando contenedores (backend y base de datos) | 8 |
| Configuración del entorno | Ejecución correcta del sistema, configuración funcional y persistencia de datos | 5 |
| Integración de servicios | Comunicación adecuada entre los componentes (backend, base de datos, red) | 4 |
| Organización del despliegue | Estructura clara del entorno, archivos de configuración organizados y comprensibles | 3 |
| **Total** | | **20** |

#### Base de Datos I y II (20%)

| Criterio | Descripción | Puntaje |
| :--- | :--- | :---: |
| Modelo de datos | Diseño adecuado de entidades, relaciones y estructura del sistema | 5 |
| Normalización e integridad | Aplicación adecuada de normalización, claves y reglas de integridad | 4 |
| Implementación de la base de datos | Creación correcta de tablas, relaciones y consistencia de datos | 3 |
| Consultas y análisis de datos | Consultas con filtros, agrupaciones, métricas y análisis de información | 3 |
| Programación SQL | Uso de procedimientos almacenados, vistas, triggers, funciones o componentes SQL avanzados según el alcance del proyecto | 5 |
| **Total** | | **20** |

---

### 11. Socialización del proyecto
- **Fecha de socialización del proyecto integrador:** 04 de mayo de 2026.
- **Modalidad:** Sesión en clase para presentar el alcance del proyecto, resolver dudas y orientar el desarrollo por equipos.

---

### 12. Consideraciones académicas
El proyecto deberá representar el trabajo desarrollado por cada equipo durante el período académico.

Durante la demostración y revisión técnica, los estudiantes deberán evidenciar dominio funcional y técnico de los componentes implementados en el sistema.

Los docentes podrán realizar preguntas relacionadas con la implementación, estructura, lógica, base de datos, despliegue y validaciones del sistema con el fin de verificar la participación y comprensión de todos los integrantes del equipo.

El incumplimiento de los lineamientos establecidos o la falta de evidencia funcional del sistema podrá afectar la calificación del proyecto integrador.
