# 🌍 Sistema Web de Gestión de Incidencias Georreferenciadas

> Proyecto integrador de la Carrera de Software — Facultad de Sistemas y Telecomunicaciones, UPSE  
> *Desarrollado con Laravel, Bootstrap, JavaScript, MySQL y Docker*

---

## 📌 Descripción General

Este proyecto consiste en el desarrollo de una **aplicación web completa** para la gestión de **incidencias georreferenciadas**, que va más allá del simple registro: incluye seguimiento, trazabilidad, asignación de responsables, historial de acciones, comentarios, notificaciones, clasificación jerárquica, métricas y visualización gráfica.

El sistema simula un entorno real de gestión municipal o técnica, donde múltiples actores colaboran en la resolución de incidencias, manteniendo la integridad, trazabilidad y organización de la información geográfica y operativa.

---

## 🎯 Objetivo

Desarrollar una aplicación web que permita:

- Gestionar incidencias con información básica y georreferenciada.
- Controlar el ciclo de vida completo de cada incidencia (estados, historial, responsables).
- Integrar frontend, backend, base de datos y despliegue en contenedores.
- Aplicar arquitectura basada en servicios y buenas prácticas de desarrollo.

---

## 🧩 Alcance del Sistema

El sistema debe permitir:

### 1. Gestión de Incidencias
- Registro con información básica (título, descripción, ubicación, tipo, prioridad, etc.)
- Edición y eliminación de incidencias.

### 2. Gestión de Estados
- Flujo de estados: `Pendiente → En proceso → Resuelto`
- Historial completo de cambios de estado con fecha y usuario responsable.

### 3. Asignación de Responsables
- Asignar uno o varios usuarios a una incidencia.
- Definir roles: `responsable`, `apoyo`.

### 4. Sistema de Comentarios / Seguimiento
- Agregar comentarios a cada incidencia.
- Registro de autor y fecha de cada comentario.

### 5. Ubicación Normalizada
- Datos de ubicación almacenados en tablas relacionadas:
  - País
  - Provincia
  - Ciudad

### 6. Clasificación Jerárquica
- Tipo de incidencia → Subtipo
  - Ejemplo: `Infraestructura → Alumbrado`
  - Ejemplo: `Seguridad → Robo`

### 7. Notificaciones del Sistema
- Notificaciones por cambios de estado.
- Estado leído/no leído de notificaciones.

### 8. Prioridad y Control
- Prioridad: alta, media, baja.
- Fecha de creación y tiempo de resolución.

### 9. Consultas con Filtros, Agrupaciones y Métricas
- Incidencias por estado, tipo, ubicación.
- Tiempo promedio de resolución.
- Visualización mediante tablas o componentes gráficos simples (dashboard).

---

## 👥 Organización del Trabajo

- El proyecto se desarrolla en **equipos de 3 estudiantes**.
- Cada integrante asume responsabilidad principal en uno de estos componentes:
  1. **Frontend**: interfaz y visualización (Bootstrap + JavaScript fetch)
  2. **Backend**: servicios y lógica del sistema (Laravel API REST)
  3. **Infraestructura**: diseño de base de datos y despliegue (MySQL + Docker)

> ⚠️ Todos los integrantes deben comprender e integrar el funcionamiento completo del sistema.

---

## 🛠️ Tecnologías y Lineamientos de Desarrollo

| Componente       | Tecnología                     |
|------------------|--------------------------------|
| Backend          | Laravel (API REST)             |
| Frontend         | HTML, CSS, Bootstrap (dashboard) |
| Cliente          | JavaScript (fetch)             |
| Base de datos    | MySQL                          |
| Despliegue       | Contenedores (Docker)          |

### Requisitos Técnicos

- La aplicación debe ser **completa e integrada**.
- Mantener **consistencia en el diseño de la interfaz**.
- Usar **buenas prácticas en la organización del código** (naming, separación de responsabilidades, comentarios, etc.).

---

## ✅ Criterios Adicionales (Valoración Extra)

Se otorgará hasta **5 puntos adicionales** por implementar funcionalidades avanzadas no obligatorias, como:

- Despliegue con múltiples instancias de la aplicación (escalamiento básico).
- Implementación de configuraciones adicionales en contenedores.
- Optimización del sistema más allá de los requerimientos mínimos.

> Estas mejoras deben ser funcionales y debidamente justificadas en el documento técnico.

---

## 📤 Modalidad de Entrega

El proyecto podrá desplegarse en servidores de la carrera, permitiendo acceso mediante URL para evaluación.

### Entregables Obligatorios:

1. Código fuente del sistema.
2. Archivo de base de datos (SQL).
3. Documento técnico del proyecto (8–12 páginas máximo).

---

## 📄 Documento Técnico del Proyecto

Debe evidenciar implementación, decisiones y resultados obtenidos. No debe copiar teoría.

### Estructura Recomendada:

#### Portada
- Nombre del proyecto
- Nombre de la carrera
- Asignaturas involucradas
- Integrantes del equipo
- Docentes
- Fecha

#### 1. Descripción de la Implementación
- Breve explicación de cómo lo implementaron y decisiones tomadas.

#### 2. Arquitectura del Sistema y Tecnologías Utilizadas
- Descripción general de frontend, backend, base de datos, contenedores.
- Diagrama o esquema de relaciones (sin código).

#### 3. Funcionalidades Implementadas
- Qué se implementó y qué no (y por qué).

#### 4. Base de Datos
- Imagen legible del modelo lógico y físico ER.
- Archivo SQL adjunto.

#### 5. Credenciales de Acceso
- Usuario administrador
- Usuario normal
- Contraseñas

#### 6. Instrucciones de Ejecución
- Cómo iniciar el proyecto.
- Cómo conectar la base de datos.
- Cómo acceder al sistema.

#### 7. Despliegue
- Uso de contenedores.
- Entorno donde se ejecuta.
- URL del sistema (para verificar funcionalidad).

#### 8. Evidencias
- Capturas de pantalla principales:
  - Pantalla principal
  - Registro
  - Listado
  - Dashboard

#### 9. Dificultades y Soluciones
- Problemas encontrados y cómo los resolvieron.

#### 10. Conclusiones
- Qué aprendieron.
- Cómo integraron las materias.

---

## 📊 Rúbrica Aplicada

### Tecnologías y Desarrollo Web (50%)

| Criterio                 | Descripción                                                                 | Puntaje |
|--------------------------|-----------------------------------------------------------------------------|---------|
| Interfaz de usuario      | Diseño claro, organizado y funcional utilizando Bootstrap (dashboard)       | 8       |
| Integración frontend-backend | Consumo correcto de servicios web (fetch), envío, recepción y visualización de datos | 8       |
| Funcionalidad del sistema | Implementación del CRUD y funcionalidades adicionales (comentarios, asignación, seguimiento) | 8       |
| Lógica del sistema       | Manejo de estados, roles, flujo funcional y trazabilidad de incidencias     | 6       |
| Dashboard / visualización | Conteos, filtros y visualización de información relevante                   | 5       |
| Organización del código  | Estructura clara, orden y buenas prácticas                                  | 5       |
| Documento técnico        | Claridad, coherencia y evidencia de decisiones de implementación            | 5       |
| Demostración del sistema | Explicación clara del flujo completo del sistema y participación del equipo | 5       |
| **Total**                |                                                                             | **50**  |

### Administración de Data Center (25%)

| Criterio                     | Descripción                                                                 | Puntaje |
|------------------------------|-----------------------------------------------------------------------------|---------|
| Uso de contenedores          | Implementación del sistema utilizando contenedores (backend + base de datos) | 10      |
| Configuración del entorno    | Ejecución correcta del sistema, configuración funcional y persistencia de datos | 7       |
| Integración de servicios     | Comunicación adecuada entre componentes (backend, base de datos, red)        | 5       |
| Organización del despliegue  | Estructura clara del entorno, archivos de configuración organizados          | 3       |
| **Total**                    |                                                                             | **25**  |

### Base de Datos I y II (25%)

| Criterio           | Descripción                                                                 | Puntaje |
|--------------------|-----------------------------------------------------------------------------|---------|
| Modelo de datos    | Diseño adecuado de entidades, relaciones y estructura (incluye ubicación normalizada y manejo de historial) | 8       |
| Normalización      | Estructura relacional correcta, evitando redundancias y aplicando niveles adecuados de normalización | 5       |
| Integridad de datos | Uso adecuado de claves primarias, foráneas y reglas de integridad           | 5       |
| Implementación     | Creación correcta de tablas, relaciones y consistencia de datos en el sistema | 4       |
| Consultas          | Consultas para reportes que incluyan filtros, agrupaciones y análisis de datos | 3       |
| **Total**          |                                                                             | **25**  |

---

## 🎤 Condiciones de la Demostración

- **Tiempo máximo**: 10 minutos por grupo.
- **Debe incluir**:
  - Explicación general del sistema.
  - Demostración funcional.
  - Participación de todos los integrantes.

> La demostración será evaluada únicamente por la asignatura de Tecnologías y Desarrollo Web y equivale al examen final de la materia.

---

## 🗓️ Socialización del Proyecto

- **Fecha**: 04 de mayo de 2026
- **Modalidad**: Sesión en clase para presentar el alcance del proyecto, resolver dudas y orientar el desarrollo por equipos.

---

## 📁 Estructura Recomendada del Repositorio

```
/incidencias-georreferenciadas
├── /backend          # Laravel API REST
├── /frontend         # HTML, CSS, Bootstrap, JS
├── /database         # Scripts SQL, modelos ER
├── /docker           # Dockerfiles, docker-compose.yml
├── /docs             # Documento técnico (PDF o Markdown)
├── README.md         # Este archivo
└── .gitignore
```

---

## 🚀 Cómo Ejecutar el Proyecto (Ejemplo)

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/incidencias-georreferenciadas.git
cd incidencias-georreferenciadas

# Levantar contenedores
docker-compose up -d

# Acceder al sistema
# Frontend: http://localhost:8080
# Backend: http://localhost:8081/api
# Base de datos: localhost:3306
```

> Las credenciales exactas estarán en el documento técnico.

---

## 📞 Contacto

Facultad de Sistemas y Telecomunicaciones  
Universidad Especializada de las Américas (UPSE)  
Campus matriz, La Libertad - Santa Elena - ECUADOR  
📞 (04) 781 - 732 | 🌐 www.upse.edu.ec

---

## 📝 Notas Finales

- Este proyecto es una oportunidad para integrar conocimientos de desarrollo web, bases de datos y administración de infraestructuras.
- Prioriza la calidad, la trazabilidad y la experiencia de usuario.
- ¡Buena suerte y buen código!
