# Exploration: Migraciones desde Diagrama DER

## Current State

### Existing Migrations (Laravel 13.15.0 — PostgreSQL)
| File | Tables Created |
|------|---------------|
| `0001_01_01_000000_create_users_table.php` | `users`, `password_reset_tokens`, `sessions` |
| `0001_01_01_000001_create_cache_table.php` | `cache`, `cache_locks` |
| `0001_01_01_000002_create_jobs_table.php` | `jobs`, `job_batches`, `failed_jobs` |

### Existing Models
- `app/Models/User.php` — extends `Authenticatable`, table `users`, fillable: `name`, `email`, `password`

### Existing Config
- **auth.php**: default guard `web` (session driver), provider `users` → `App\Models\User`
- **session.php**: driver `database`, table `sessions` (created in default migration)
- **database.php**: `pgsql` connection configured with `search_path => public`
- **.env**: `DB_CONNECTION=pgsql`, `SESSION_DRIVER=database`, `QUEUE_CONNECTION=redis`, `CACHE_STORE=redis`

### Composer Dependencies
- `laravel/framework: ^13.8` (actual: v13.15.0)
- **No PostGIS packages installed**
- **No doctrine/dbal** (not needed — Laravel 13 natively handles geometry types)

---

## Gaps & Conflicts

### 1. `users` vs `usuarios` — Naming / Schema Conflict ⚠️ CRITICAL

| Laravel Default `users` | Diagram `usuarios` |
|------------------------|-------------------|
| `id`, `name`, `email`, `email_verified_at`, `password`, `remember_token`, `timestamps` | `id`, `rol_id` (FK→roles), `correo`, `contrasenha`, `timestamps`, `deleted_at` |

These are **different tables with different schemas**. The diagram's `usuarios`:
- Has no `name`, `email` (uses `correo`), no `password` (uses `contrasenha`)
- Has `rol_id` FK to `roles`
- Has `deleted_at` (soft deletes)
- Has no `remember_token` or `email_verified_at`

### 2. PostGIS Support
- **No PostGIS extension** enabled in the Laravel setup
- Diagram requires `geometry` columns in 2 tables:
  - `ubicaciones.geom` — MultiPolygon, SRID 4326
  - `incidencias.geom` — Point, SRID 4326
- Laravel 13 **natively supports** `$table->geometry()` in migrations (no extra package needed for schema creation)
- PostGIS extension must be installed on the PostgreSQL server (`CREATE EXTENSION postgis`)
- For **model-level spatial queries** (ST_Contains, ST_Distance), recommend a package like `clickbar/laravel-postgis`

### 3. PostgreSQL Triggers
- 3 triggers defined in the diagram (plpgsql):
  - `trg_validar_categoria_hoja` — validates leaf category on `incidencias` INSERT/UPDATE
  - `trg_log_estado_incidencia` — logs state changes to `historial_estados`
  - `trg_auto_assign_ubicacion` — auto-assigns administrative location via ST_Contains
- These must run AFTER migrations create the underlying tables
- Can be executed via `DB::statement()` in a migration's `up()` method

### 4. Composite Primary Key in `asignaciones`
- Diagram defines `asignaciones` with: `incidencia_id` (PK, FK), `usuario_id` (PK, FK), `rol_asignacion`, `created_at`
- **Composite PK is not natively supported by Eloquent** — would need model overrides for `setKeysForSaveQuery`, etc.
- **Recommendation**: Add a surrogate `id` primary key, keep a UNIQUE constraint on `(incidencia_id, usuario_id)`, or use a dedicated pivot pattern

### 5. Soft Deletes
- 6 tables use `deleted_at`: `roles`, `usuarios`, `organizaciones`, `categorias_incidencia`, `incidencias`, `comentarios`
- Maps to Laravel's `$table->softDeletes()` and `SoftDeletes` trait

### 6. Sessions Table Already Exists
- `sessions` table created in default migration — OK, since `SESSION_DRIVER=database`

### 7. ID Type Compatibility
- Diagram uses `bigint` for all PKs — compatible with Laravel's `id()` / `bigIncrements()`
- Note: Laravel defaults to **UNSIGNED** bigint. The diagram does not specify unsigned, but PostgreSQL bigint is signed by default. Laravel's Blueprint handles this automatically.

---

## Dependencies — Table Creation Order

```
1. roles                          (no FKs)
2. ubicaciones                    (self-ref FK: parent_id → id)
   └── needs PostGIS extension first
3. usuarios                       (FK: rol_id → roles.id)
4. organizaciones                 (FK: ubicacion_id → ubicaciones.id)
5. categorias_incidencia          (FK: organizacion_id → organizaciones.id, self-ref parent_id)
6. incidencias                    (FK: categoria_incidencia_id, usuario_id, ubicacion_id)
   └── needs geometry column
7. comentarios                    (FK: incidencia_id, usuario_id)
8. asignaciones                   (FK: incidencia_id, usuario_id)
9. historial_estados              (FK: incidencia_id, usuario_id)
10. notificaciones                (FK: usuario_id, incidencia_id)
--- Triggers (after all tables exist) ---
11. trg_validar_categoria_hoja    (depends: incidencias, categorias_incidencia)
12. trg_log_estado_incidencia     (depends: incidencias, historial_estados)
13. trg_auto_assign_ubicacion     (depends: incidencias, ubicaciones)
```

---

## Approaches

### Approach A: Replace `users` with `usuarios` (Recommended)
Modify the existing `users` migration to match the diagram's `usuarios` schema, reconfigure Laravel auth to work with the new schema.

- **What changes**: Modify `0001_01_01_000000` to create `roles` + `usuarios` table instead of `users`; update `User.php` model (table → `usuarios`, fillable → `correo`, `contrasenha`); update auth provider; add `remember_token` to `usuarios` for session support
- **Pros**: Single source of truth for users; clean architecture; no redundant tables
- **Cons**: Breaks Laravel auth defaults (no `name`, `email_verified_at`); needs custom auth logic for `correo`/`contrasenha` field names; need to handle `rol_id` for authorization
- **Effort**: Medium-High

### Approach B: Keep both `users` + `usuarios`
Keep Laravel's `users` table for system authentication and create `usuarios` as a separate business entity for citizens reporting incidents.

- **What changes**: Keep existing migration untouched; add all 10 diagram tables as new migrations; link `usuarios` optionally to `users`
- **Pros**: Laravel auth works out of box; clear separation (admin vs citizen)
- **Cons**: Data duplication; two user concepts; diagram FK relationships point to `usuarios`, not `users`; more complex auth flows
- **Effort**: Low-Medium

### Approach C: Modify `users` to match `usuarios` schema completely
Drop the default `users` migration entirely, create a new `usuarios` table, map `User.php` to it, reconfigure auth.

- **Similar to A** but drops the default instead of modifying it
- **Pros**: Clean slate
- **Cons**: Same auth complications as A; harder rollback
- **Effort**: Medium-High

---

## Recommendation

**Approach A (modified)**: Modify the default `0001_01_01_000000_create_users_table.php` to:
1. Drop the `users` table creation
2. Add `roles` table (needed before `usuarios`)
3. Add `usuarios` table with all diagram fields + `remember_token` (for Laravel sessions)
4. Keep `password_reset_tokens` and `sessions` tables

Update `User.php` to:
- `protected $table = 'usuarios'`
- Use `correo` as the "username" for auth (Laravel can use `username()` method override)
- Cast `contrasenha` as `hashed`
- Add `rol_id` relationship

This gives a clean single-user-table architecture while maintaining compatibility with Laravel's session-based auth.

### Migration Files Strategy

| # | File | Tables | Depends On |
|---|------|--------|-----------|
| 1 | Default (modified) | `roles`, `usuarios`, `password_reset_tokens`, `sessions` | Nothing |
| 2 | Default (unchanged) | `cache`, `cache_locks` | Nothing |
| 3 | Default (unchanged) | `jobs`, `job_batches`, `failed_jobs` | Nothing |
| 4 | New: `create_ubicaciones_organizaciones_table` | `ubicaciones` (with geometry), `organizaciones` | PostGIS extension |
| 5 | New: `create_categorias_incidencia_table` | `categorias_incidencia` | organizaciones |
| 6 | New: `create_incidencias_table` | `incidencias` (with geometry) | categorias_incidencia, usuarios, ubicaciones |
| 7 | New: `create_tablas_secundarias_table` | `comentarios`, `asignaciones`, `historial_estados`, `notificaciones` | incidencias, usuarios |
| 8 | New: `create_triggers` | 3 PostgreSQL triggers (raw SQL) | All above tables |

**Total**: 5 new migration files + 3 existing (modified first one) = 8 total

---

## PostGIS Support

| Need | Solution |
|------|----------|
| Schema creation | Laravel 13 native `$table->geometry()` — no package needed |
| Extension setup | `DB::statement('CREATE EXTENSION IF NOT EXISTS postgis')` in migration |
| Model spatial queries | `clickbar/laravel-postgis` package recommended (ST_Contains, ST_Distance, etc.) |
| SRID 4326 | `$table->geometry('geom', subtype: 'multipolygon', srid: 4326)` |
| Point type | `$table->geometry('geom', subtype: 'point', srid: 4326)` |

---

## Risks

1. **🔴 Auth breakage**: If `users` table is modified/removed, all Laravel auth scaffolding (password reset, remember me, email verification) must be reconfigured
2. **🟡 PostGIS not available**: Migration will fail if PostgreSQL server doesn't have PostGIS extension installed/enabled
3. **🟡 `asignaciones` composite PK**: Not standard Eloquent; add surrogate `id` column or use custom model logic
4. **🟢 Trigger execution order**: Must be last migration — raw SQL in migration is acceptable but testing is harder
5. **🟢 Laravel 13 compatibility**: Geometry support is confirmed native; no composer.json changes needed for schema creation
6. **🟢 `contrasenha` spelling**: The diagram uses `contrasenha` (with 'nh' — Portuguese-influenced) not `contrasena` (standard Spanish). This is what the diagram says; preserve it.

---

## Key Decisions Needed

1. **users vs usuarios**: Do we replace `users` with `usuarios` (Approach A) or keep both (Approach B)?
2. **Auth field mapping**: If using `usuarios`, how to handle `correo` as login field and `contrasenha` as password field in Laravel auth?
3. **`asignaciones` primary key**: Add surrogate `id` or keep composite PK?
4. **Role-based auth**: Does Laravel authorization use the `roles` table or something custom?
5. **Triggers in migrations**: Keep raw SQL in migration or move to a separate `database/triggers/` file?
6. **PostGIS model package**: Install `clickbar/laravel-postgis` or handle spatial queries via raw SQL?

---

## Ready for Proposal

**Yes** — the analysis is complete and all approaches have been identified. The orchestrator should confirm the approach (A vs B) and the `asignaciones` PK decision before moving to specs.
