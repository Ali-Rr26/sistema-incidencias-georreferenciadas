## Exploration: Mejora Integral de Interfaz de Feed

### Current State
La aplicación tiene dos caras completamente diferentes:
- **Feed público**: Estilo Instagram, colores planos, sin variables CSS, diseño mobile-first
- **Admin (Freedash)**: Gradientes, sombras, sistema de diseño basado en variables CSS, componentes Bootstrap

No hay consistencia visual entre ambos. El feed no muestra datos críticos de las incidencias (título, descripción, fotos) y hay múltiples bugs funcionales.

---

### Affected Areas

| Archivo | Por qué está afectado |
|---------|----------------------|
| `frontend/app/feed/feed.component.js` | Lógica principal del feed — renderiza cards sin título ni descripción |
| `frontend/app/feed/feed.component.html` | Template del feed — estructura de cards limitada |
| `frontend/app/feed/feed.component.css` | 458 líneas de CSS plano sin usar variables del tema |
| `frontend/app/layout-usuario/layout-usuario.component.*` | Header del feed — sin animaciones, menú básico |
| `frontend/app/feed-create/feed-create.component.*` | Formulario sin carga de fotos, sin campo de dirección |
| `frontend/app/auth/pages/login/login.component.*` | Login con features visuales no funcionales |
| `frontend/app/layout/layout.component.html` | Sidebar + topbar admin — navbar limitado |
| `frontend/app/layout/navbar/navbar.component.css` | Topbar no usa variables del feed si se unifica |
| `frontend/app/layout/sidebar/sidebar.component.css` | Sidebar responsive pero sin colapso nativo |
| `frontend/app/app.js` | Registro de rutas — falta ruta de detalle de incidencia |
| `frontend/core/router.js` | Matching exacto de rutas — no soporta parámetros |
| `frontend/css/variables.css` | Variables CSS definidas pero NO usadas en el feed |
| `frontend/css/global.css` | Estilos globales que el feed ignora |
| `frontend/css/freedash-layout.css` | Layout del admin — no compartido con el feed |
| `frontend/app/incidencias/pages/index/incidencias.index.component.html` | Links a detalle rotos (`#/incidencias/:id` sin ruta) |

---

### Hallazgos Detallados

#### 🔴 HIGH — Bugs críticos

| # | Hallazgo | Archivo | Problema actual | Oportunidad de mejora | Categoría |
|---|----------|---------|-----------------|----------------------|-----------|
| 1 | **El feed NO muestra el título de la incidencia** | `feed.component.js:95-167` | `renderCard()` usa `catName`, `userName`, `locName` y `descText` (prioridad + org), pero NUNCA accede a `inc.title`. La card muestra categoría, usuario y prioridad, pero NO el título del reporte — el dato más importante. | Agregar `inc.title` como heading de la card, con truncamiento después de 2 líneas. | BUG |
| 2 | **El feed NO muestra la descripción** | `feed.component.js:109-126` | `descParts` se construye solo con prioridad y nombre de org. `inc.description` no se incluye en la card. | Mostrar `inc.description` truncado a 3 líneas con enlace "Ver más". | BUG |
| 3 | **Botones "Ver detalle" del admin llevan a 404** | `app.js:57-68`, `router.js:83` | El index de incidencias tiene links a `#/incidencias/${inc.id}`, pero no existe una ruta registrada para ese patrón. El router hace matching exacto, así que cualquier `/incidencias/123` redirige a `/not-found`. | Registrar ruta `/incidencias/:id` con un componente de detalle. O cambiar los links a algo que sí exista. | BUG |
| 4 | **Loader del infinite scroll NUNCA se muestra** | `feed.component.js:226-227` | `sentinel.classList.toggle('loading', hasMore && !cargando)` — pero `cargando` siempre es `true` dentro de `fetchIncidencias()` (se setea en L180, se limpia en L235 en el `finally`). La línea 227 se ejecuta ANTES del finally, así que `!cargando` siempre es `false`. El spinner del sentinel nunca aparece mientras carga. | Mover la lógica del sentinel al bloque `finally` o usar una variable separada. | BUG |
| 5 | **"Recordarme" y toggle de contraseña en login son puramente visuales** | `login.component.html:83-91`, `login.component.js` | El checkbox "Recordarme" y el ojo de mostrar/ocultar contraseña existen en HTML pero NO tienen event handlers ni funcionalidad. Son elementos decorativos que parecen funcionales. | Implementar la funcionalidad o eliminar/estilizar como placeholder con tooltip "Próximamente". | UI/BUG |

#### 🟠 HIGH — UX/UI Crítico

| # | Hallazgo | Archivo | Problema actual | Oportunidad de mejora | Categoría |
|---|----------|---------|-----------------|----------------------|-----------|
| 6 | **Feed no tiene enlace a detalle de incidencia** | `feed.component.js:153-164` | Las cards tienen botones de "Comentar" y "Compartir" sin event handlers. No hay forma de ver el detalle completo de una incidencia desde el feed. | Hacer la card clickeable o agregar botón "Ver detalle" que navegue a una página de detalle. | UX |
| 7 | **Login muestra stats hardcodeadas** | `login.component.html:19-23` | "1,284 incidencias, 67% resueltas, 24 cantones" son valores fijos en HTML. No se cargan desde la API. | Cargar stats reales desde un endpoint público `/stats` o similar. | UX |
| 8 | **Feed CREATE no permite subir fotos** | `feed-create.component.html` | El formulario no tiene campo de carga de imágenes. Las incidencias no pueden incluir evidencia fotográfica. | Agregar input file con preview, subida asíncrona, y soporte múltiple. | UX |
| 9 | **Emojis de categoría son arbitrarios** | `feed.component.js:6,99` | `CAT_EMOJIS` es un array fijo de 8 emojis. Se usa `(id % 8)` para asignar, sin relación semántica con la categoría real. Si la categoría "Agua" tiene ID 1 y "Seguridad" tiene ID 5, cada una recibe un emoji diferente pero no relacionado con su significado. | Usar un mapping por slug de categoría o permitir que cada categoría defina su emoji/icono desde el backend. | UI |
| 10 | **Feed no tiene estado de error distinguible** | `feed.component.js:230-233` | Cuando falla la carga, se muestra el mismo contenedor `ig-empty` que el estado vacío, pero con texto "Error al cargar". Visualmente idéntico al empty state. | Crear estado de error con ícono diferente, botón "Reintentar", y mejor copy. | UX |

#### 🟡 MEDIUM — Consistencia y Diseño

| # | Hallazgo | Archivo | Problema actual | Oportunidad de mejora | Categoría |
|---|----------|---------|-----------------|----------------------|-----------|
| 11 | **Feed NO usa variables CSS del tema** | `feed.component.css` | 458 líneas con colores hardcodeados: `#fafafa`, `#efefef`, `#262626`, `#8e8e8e`, `#0095f6`, etc. No usa ninguna variable de `variables.css`. Si se cambia el tema, el feed no se actualiza. | Refactorizar todo el CSS del feed para usar `var(--color-primary)`, `var(--bg-page)`, `var(--text-dark)`, etc. | CONSISTENCY |
| 12 | **Dos sistemas de diseño incompatibles** | `feed.component.css` vs `global.css` | Feed usa Instagram-style (bordes 0, azul `#0095f6`, fondo `#fafafa`). Admin usa Freedash (bordes 14px, gradiente púrpura `#6a5cf3`, fondo `#f3f4f9`). Parecen dos apps diferentes. | Unificar sistema de diseño: definir si la app es "Instagram-style" o "Freedash". Decisión de diseño arquitectónico. | CONSISTENCY |
| 13 | **Dos marcas diferentes** | `layout-usuario.html:4`, `layout.html:21-22` | El layout-usuario (feed) muestra "📍 Incidencias". El layout admin muestra "GeoReporta — Gestión municipal". Usan logos, colores y tonos distintos. | Unificar branding: misma marca, mismo logo, misma paleta en ambos lados. | CONSISTENCY |
| 14 | **Admin usa 'Be Vietnam Pro' como fuente, feed usa system fonts** | `variables.css:75` vs `feed.component.css:8-10` | Admin carga la fuente desde Google Fonts. Feed declara su propio stack `-apple-system, BlinkMacSystemFont, ...`. La tipografía cambia entre vistas. | Unificar fuente en toda la app usando `var(--font-family)`. | CONSISTENCY |
| 15 | **Topbar search del admin no funciona** | `layout.component.html:119-126` | El input de búsqueda "Buscar incidencia..." está en el HTML pero no tiene ningún event handler ni JS que lo conecte. Es decorativo. | Implementar búsqueda global o eliminar el input. | UX |
| 16 | **Login: texto del botón cambia después de error** | `login.component.js:39,57` | El botón empieza con texto "Ingresar". En submit se cambia a "Ingresando...". En error, el `finally` lo pone como "Iniciar Sesión" (texto diferente al original). | Guardar el texto original en un atributo `data-text` y restaurarlo. O usar `Ingresar` consistentemente. | BUG |
| 17 | **Notificaciones: badges con valores estáticos** | `layout.component.html:64,132` | Badge de sidebar muestra "0" y badge de topbar muestra "5". Ambos son HTML estático. No se cargan desde API. | Cargar conteo real desde endpoint de notificaciones. | UX |

#### 🟢 LOW — Micro-interacciones y pulido

| # | Hallazgo | Archivo | Problema actual | Oportunidad de mejora | Categoría |
|---|----------|---------|-----------------|----------------------|-----------|
| 18 | **Sin animación en cards del feed** | `feed.component.js:220-223` | Las cards aparecen instantáneamente al hacer scroll infinito. Sin fade-in ni stagger animation. | Agregar animación CSS `fadeInUp` con delay incremental. | UI |
| 19 | **Dropdown del menú hamburguesa sin transición** | `layout-usuario.component.js:80` | Usa `classList.toggle('d-none')` — aparece/desaparece instantáneamente. Sin animación. | Usar clases CSS con `opacity`, `transform`, `transition` para un slide-down suave. | UI |
| 20 | **Sin atajo de teclado ni focus management en feed** | `feed.component.js` | Las cards no son focusables con Tab, no hay soporte para navegación con teclado (arrows). | Agregar `tabindex="0"` a las cards, manejar Enter/Space para abrir detalle. | ACCESSIBILITY |
| 21 | **Feed no muestra fotos aunque el CSS las soporte** | `feed.component.css:421-432` | Existe la clase `.ig-card-photos` con grid de 3 columnas para fotos, pero nunca se usa en el render de cards. El backend quizás devuelve fotos pero el frontend no las muestra. | Implementar galería de fotos en las cards si el backend incluye imágenes. | UI |
| 22 | **Login no tiene campo de registro/crear cuenta** | `login.component.html` | Solo hay formulario de login. No hay enlace a "Crear cuenta" o "Registrarse". | Agregar link de registro si existe flujo de registro, o indicar que el registro es solo por invitación. | UX |

---

### Recomendación

**Enfoque por fases:**

1. **Fase 1 — Bugs críticos** (HIGH): Arreglar los items 1, 2, 3, 4, 5. Son bugs que afectan la funcionalidad core.
2. **Fase 2 — Consistencia visual** (MEDIUM): Items 11, 12, 13, 14. Unificar sistema de diseño entre feed y admin. Decidir una dirección visual.
3. **Fase 3 — UX faltante** (HIGH/MEDIUM): Items 6, 7, 8, 9, 10. Agregar detalle de incidencia, fotos, y mejorar estados.
4. **Fase 4 — Pulido** (LOW): Items 18, 19, 20, 21, 22. Micro-interacciones y accesibilidad.

### Riesgos
- **R1**: Unificar el diseño puede ser conflictivo — el feed es mobile-first Instagram-style y el admin es desktop-first Freedash. Forzar la misma paleta puede perjudicar uno de los dos.
- **R2**: Agregar carga de fotos implica cambios en backend (endpoint de upload, almacenamiento).
- **R3**: La ruta de detalle de incidencia no existe ni en frontend ni probablemente en backend. Implica crear componente + endpoint o modal.
- **R4**: Cambiar emojis a un mapping semántico requiere que el backend devuelva un identificador de ícono por categoría.

### Ready for Proposal
**Sí**. Hay suficiente información para pasar a fase de propuesta. Recomiendo priorizar la Fase 1 (bugs funcionales) en la propuesta inicial.
