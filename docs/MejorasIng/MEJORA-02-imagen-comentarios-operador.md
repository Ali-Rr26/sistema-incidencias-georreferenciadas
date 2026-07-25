# MEJORA-02: Adjuntar Imágenes en Comentarios (Operador)

**Resumen Ejecutivo**
Extender módulo de comentarios para permitir que operador_organizacion adjunte imágenes (max 10MB, jpeg/png/webp). Guardar en storage + registrar relación en table `comment_images`. Mostrar preview en UI + carrusel de imágenes adjuntas.

## Objetivos
- Crear endpoint POST con validación de imágenes
- Procesar y guardar imágenes en storage
- Crear relación comment_images (ya existe migración)
- UI: input file + preview thumbnail
- Validar permisos: operador_organizacion.comments.create

## Cambios Requeridos

### Backend

**Archivo**: `backend/app/Domains/Comments/Http/StoreCommentRequest.php`

```php
public function rules(): array
{
    return [
        'incident_id' => 'required|exists:incidents,incident_id',
        'content' => 'required|string|max:2000',
        'images' => 'nullable|array|max:5', // Max 5 imágenes
        'images.*' => 'file|image|mimes:jpeg,png,webp|max:10240', // 10MB
    ];
}
```

**Archivo**: Crear `backend/app/Domains/Comments/Services/ImageProcessingService.php`

```php
namespace App\Domains\Comments\Services;

class ImageProcessingService
{
    public function processImages(array $files, int $commentId): void
    {
        foreach ($files as $file) {
            // 1. Generar nombre único
            $filename = uniqid('comment_') . '.' . $file->getClientOriginalExtension();
            
            // 2. Guardar en storage/comments/{year}/{month}/
            $path = $file->storeAs(
                'comments/' . now()->format('Y/m'),
                $filename,
                'public'
            );
            
            // 3. Registrar en table comment_images
            CommentImage::create([
                'comment_id' => $commentId,
                'image_path' => $path,
                'file_size' => $file->getSize(),
            ]);
        }
    }
}
```

**Archivo**: Actualizar `backend/app/Domains/Comments/Http/CommentController.php`

```php
use App\Domains\Comments\Services\ImageProcessingService;

public function store(StoreCommentRequest $request, ImageProcessingService $imageService)
{
    $comment = Comment::create([
        'incident_id' => $request->incident_id,
        'user_id' => auth()->id(),
        'content' => $request->content,
    ]);
    
    // Procesar imágenes si existen
    if ($request->hasFile('images')) {
        $imageService->processImages(
            $request->file('images'),
            $comment->comment_id
        );
    }
    
    return response()->json([
        'id' => $comment->comment_id,
        'content' => $comment->content,
        'images' => $comment->images,
        'created_at' => $comment->created_at,
    ], 201);
}
```

**Archivo**: Actualizar `backend/app/Domains/Comments/Models/Comment.php`

```php
use Illuminate\Database\Eloquent\Relations\HasMany;

class Comment extends Model
{
    // ... existing code ...
    
    public function images(): HasMany
    {
        return $this->hasMany(CommentImage::class, 'comment_id');
    }
}
```

**Archivo**: `backend/app/Domains/Comments/Http/IncidentCommentsController.php` (GET)

```php
// Actualizar para eager-load images
public function index($incidentId)
{
    $comments = Comment::where('incident_id', $incidentId)
        ->with('user', 'images') // Eager load
        ->orderBy('created_at', 'desc')
        ->get();
    
    return response()->json($comments);
}
```

### Frontend

**Archivo**: `frontend/app/incidencias/comentarios.js` (nuevo o existente)

```javascript
async function submitComment() {
    const form = document.querySelector('#form-comentario');
    const content = form.querySelector('textarea[name="content"]').value;
    const images = form.querySelector('input[type="file"]').files;
    const incidentId = getIncidentIdFromUrl();
    
    const formData = new FormData();
    formData.append('incident_id', incidentId);
    formData.append('content', content);
    
    // Agregar imágenes
    for (let i = 0; i < images.length; i++) {
        formData.append(`images[${i}]`, images[i]);
    }
    
    try {
        const response = await fetch('/api/comments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            },
            body: formData // FormData auto-sets Content-Type multipart
        });
        
        if (response.ok) {
            const comment = await response.json();
            renderComment(comment);
            form.reset();
            clearPreview();
        }
    } catch (error) {
        console.error('Error al crear comentario:', error);
        showErrorToast('Error al adjuntar comentario');
    }
}

function previewImages(fileInput) {
    const files = fileInput.files;
    const preview = document.querySelector('#image-preview');
    preview.innerHTML = ''; // Limpiar
    
    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const thumb = document.createElement('div');
            thumb.className = 'image-thumb';
            thumb.innerHTML = `
                <img src="${e.target.result}" alt="preview">
                <button type="button" class="btn-remove-image">×</button>
            `;
            preview.appendChild(thumb);
        };
        reader.readAsDataURL(file);
    });
}

function renderComment(comment) {
    const container = document.querySelector('#comments-list');
    const html = `
        <div class="comment" data-comment-id="${comment.id}">
            <div class="comment-header">
                <strong>${comment.user.name}</strong>
                <time>${new Date(comment.created_at).toLocaleString()}</time>
            </div>
            <p class="comment-content">${escapeHtml(comment.content)}</p>
            ${renderImages(comment.images)}
        </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
}

function renderImages(images) {
    if (!images || images.length === 0) return '';
    
    return `
        <div class="comment-images carousel">
            ${images.map(img => `
                <div class="carousel-slide">
                    <img src="/storage/${img.image_path}" alt="adjunto" loading="lazy">
                </div>
            `).join('')}
        </div>
    `;
}
```

**Archivo**: `frontend/app/incidencias/comentarios.html` (template)

```html
<div id="form-comentario-wrapper">
    <form id="form-comentario" novalidate>
        <div class="mb-3">
            <label for="comment-content">Comentario</label>
            <textarea id="comment-content" name="content" 
                      class="form-control" rows="4" 
                      required maxlength="2000"></textarea>
        </div>
        
        <!-- Input file con preview -->
        <div class="mb-3">
            <label for="comment-images">Adjuntar Imágenes</label>
            <input type="file" id="comment-images" name="images" 
                   class="form-control" multiple accept="image/jpeg,image/png,image/webp"
                   onchange="previewImages(this)">
            <small class="form-text text-muted">
                Max 5 imágenes, 10MB cada una (jpeg, png, webp)
            </small>
        </div>
        
        <!-- Preview de imágenes -->
        <div id="image-preview" class="image-preview"></div>
        
        <div class="button-group">
            <button type="submit" class="btn btn-primary">Enviar Comentario</button>
            <button type="reset" class="btn btn-secondary">Cancelar</button>
        </div>
    </form>
</div>

<div id="comments-list" class="comments-container">
    <!-- Comentarios renderizados aquí -->
</div>
```

**Archivo**: `frontend/css/comentarios.css` (estilos)

```css
.image-preview {
    display: flex;
    gap: 10px;
    margin: 10px 0;
    flex-wrap: wrap;
}

.image-thumb {
    position: relative;
    width: 80px;
    height: 80px;
    border-radius: 4px;
    overflow: hidden;
    background: #f0f0f0;
}

.image-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.btn-remove-image {
    position: absolute;
    top: -5px;
    right: -5px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #dc3545;
    color: white;
    border: none;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
}

.comment-images {
    margin-top: 10px;
    display: flex;
    gap: 10px;
    overflow-x: auto;
}

.comment-images img {
    max-height: 200px;
    border-radius: 4px;
    cursor: pointer;
}
```

### Base de Datos

Migración ya existe: `2026_07_17_000003_create_comment_images_table.php`

Verificar que tabla tenga estructura:
```sql
CREATE TABLE comment_images (
    id BIGINT PRIMARY KEY,
    comment_id BIGINT NOT NULL REFERENCES comments(comment_id) ON DELETE CASCADE,
    image_path VARCHAR(255) NOT NULL,
    file_size INT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX idx_comment_images_comment_id ON comment_images(comment_id);
```

## Archivos Afectados

| Ruta | Cambio |
|------|--------|
| `backend/app/Domains/Comments/Http/StoreCommentRequest.php` | Agregar validación de `images` array |
| `backend/app/Domains/Comments/Services/ImageProcessingService.php` | Crear nuevo service |
| `backend/app/Domains/Comments/Http/CommentController.php` | Procesar images en store() |
| `backend/app/Domains/Comments/Models/Comment.php` | Agregar relación images() |
| `backend/config/filesystems.php` | Verificar disk 'public' configurado |
| `frontend/app/incidencias/comentarios.js` | Lógica de upload + preview |
| `frontend/app/incidencias/comentarios.html` | Agregar input file |
| `frontend/css/comentarios.css` | Estilos para preview y carrusel |

## Pasos de Implementación Detallados

### 1. Backend

**Paso 1.1**: Crear ImageProcessingService
```bash
cd backend
touch app/Domains/Comments/Services/ImageProcessingService.php
```

Implementar lógica según pseudocódigo arriba.

**Paso 1.2**: Actualizar StoreCommentRequest
```php
// Agregar en rules()
'images' => 'nullable|array|max:5',
'images.*' => 'file|image|mimes:jpeg,png,webp|max:10240',
```

**Paso 1.3**: Inyectar ImageProcessingService en controller
```bash
# En CommentController, método store():
# - Inyectar ImageProcessingService
# - Llamar processImages() si $request->hasFile('images')
```

**Paso 1.4**: Configurar storage
```bash
# En .env (o .env.example):
FILESYSTEM_DISK=public

# Generar enlace simbólico:
php artisan storage:link
# Esto crea storage/app/public → public/storage
```

**Paso 1.5**: Verificar Comment model
```php
// Agregar relación:
public function images(): HasMany
{
    return $this->hasMany(CommentImage::class, 'comment_id');
}
```

**Paso 1.6**: Test endpoint
```bash
cd backend
php artisan make:test Feature/StoreCommentWithImagesTest

# En test:
# POST /api/comments con multipart form-data
# images: [file1.jpg, file2.png]
# Verificar: 201 + comment.images array
```

### 2. Frontend

**Paso 2.1**: Crear comentarios.js (o actualizar existente)
```bash
cd frontend
# Si no existe:
touch app/incidencias/comentarios.js
```

Implementar funciones:
- submitComment()
- previewImages()
- renderComment()
- renderImages()

**Paso 2.2**: Actualizar HTML template
```bash
# Agregar input file con validaciones
# Agregar preview container
```

**Paso 2.3**: Agregar estilos
```bash
cd frontend/css
# Crear o actualizar comentarios.css
# Estilos: .image-preview, .image-thumb, .comment-images
```

**Paso 2.4**: Integrar en flujo de incidencias
```javascript
// En incidencias.js (module principal):
// - Importar comentarios.js
// - Al cargar incidencia, mostrar form de comentarios
// - Adjuntar listeners a inputs
```

**Paso 2.5**: Test en browser
```bash
npm run dev

# 1. Navegar a incidencia detail
# 2. Form comentarios visible
# 3. Seleccionar 2-3 imágenes
# 4. Preview mostrando thumbnails
# 5. Enviar → imágenes guardadas + comentario creado
# 6. Recargar → imágenes persisten
```

## Testing

### Caso 1: Upload válido (1 imagen)
```
Usuario: operador_organizacion
Incidencia: #123 (id: 5)
Archivo: test.jpg (500KB, jpeg)
Esperado: 201 Created
- comment.id creado
- comment.images[0].image_path = "comments/2026/07/comment_abc123.jpg"
- Storage: archivo existe en public/storage/comments/2026/07/
```

### Caso 2: Upload múltiple (3 imágenes)
```
Usuario: operador_organizacion
Incidencia: #123
Archivos: img1.png, img2.webp, img3.jpg (total 8MB)
Esperado: 201 Created
- comment.images.length === 3
- Todas las rutas válidas
```

### Caso 3: Archivo muy grande
```
Usuario: operador_organizacion
Archivo: large.jpg (15MB, > 10MB limit)
Esperado: 422 Unprocessable Entity
- Validación: "images.0" => "The images.0 field must not be greater than 10240 kilobytes."
```

### Caso 4: Tipo de archivo inválido
```
Usuario: operador_organizacion
Archivo: documento.pdf
Esperado: 422 Unprocessable Entity
- Validación: "images.0" => "The images.0 field must be an image."
```

### Caso 5: Preview en UI
```
Acción: Seleccionar 3 imágenes en input
Esperado:
- Preview container muestra 3 thumbnails
- Thumbnails clickeables para borrar
- Contador de archivos visible
```

### Caso 6: GET comentarios con imágenes
```
GET /api/incidents/5/comments
Esperado: 200 OK
- Cada comentario incluye array "images"
- images[0].image_path = ruta válida a /storage/
```

## Impacto

### Performance
- Storage: ~5MB/incidencia (5 imágenes × 10MB máx)
- Query: +1 LEFT JOIN a comment_images (lazy-loaded por defecto)
- Recomendación: eager-load con `.with('images')` para list views

### Permisos
- Requiere: `comments.create`
- Roles permitidos: operador_sistema, admin_organizacion, operador_organizacion, usuario
- No requiere permiso nuevo (reutiliza existing)

### Storage
- Crear directorio: `storage/app/public/comments/`
- Enlace: `php artisan storage:link` (si no existe)
- Limpiar viejas: cron job (futuro) para borrar imágenes orphaned

### Data Migration
- Tabla `comment_images` ya existe
- No hay datos legacy que migrar
- Compatibilidad: comentarios sin imágenes siguen funcionando

## Estimación

**Complejidad**: Media  
**Tiempo**: ~3-4 horas  
**Riesgo**: Medio (storage management, file handling)  
**Esfuerzo**: 5 puntos

## Notas

- Usar `FileUploadValidator` si existe en el proyecto
- Considerar virus scan para produción (ClamAV o tercero)
- Implementar cleanup automático de uploads fallos
- Rate-limit: máx 10MB/minuto por usuario (futuro)