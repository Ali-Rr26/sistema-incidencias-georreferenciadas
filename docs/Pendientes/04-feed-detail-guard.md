# 04 — Guard de `/feed/:id` (decisión de seguridad)

**Tipo:** Seguridad / decisión de diseño
**Severidad:** 🟡 Revisar (puede ser intencional)
**Backend:** — · **Frontend:** ⚠️ Única ruta con shell sin guard

## Problema

La ruta de detalle del feed se registra **sin guards**, mientras que todas las
demás rutas con shell exigen `authGuard`:

```js
// frontend/app/app.js
router.addRoute('/feed', feedComponent, [authGuard], 'user');
router.addRoute('/feed/crear', incidenciaFormComponent, [authGuard], 'user');
router.addRoute('/feed/:id', feedDetailComponent, [], 'user');   // ← sin guard
```

Es la **única** ruta montada en un shell que no valida autenticación.

## Preguntas a resolver

1. ¿Es intencional? El feed público de incidencias podría estar diseñado para ser
   accesible sin login (transparencia ciudadana).
2. Si es público el detalle, **¿por qué `/feed` (el listado) sí exige `authGuard`?**
   Inconsistencia: no podés ver la lista sin loguearte, pero sí un ítem puntual
   si tenés el link directo.
3. ¿El endpoint backend del detalle está protegido por JWT? Verificar:
   - `GET /api/incidents/feed` → `FeedController` está **fuera** del grupo `jwt`
     (público, con `throttle:feed`).
   - `GET /api/incidents/{incident}` (apiResource) está **dentro** del grupo `jwt`.
   - Entonces el frontend sin guard llamaría a un endpoint que sí pide JWT → fallaría.
     **Verificar de dónde lee el detalle el `feed-detail.component.js`.**

## Alcance

- [ ] Confirmar la intención de producto: ¿detalle de incidencia público o privado?
- [ ] Alinear frontend y backend:
  - Si **público**: `/feed` también debería ser accesible sin auth, y el detalle
    debe leer de un endpoint público (feed/Redis), no del `apiResource` con JWT.
  - Si **privado**: agregar `[authGuard]` a `/feed/:id`.
- [ ] Documentar la decisión para que no se "arregle" en la dirección equivocada.

## Criterios de aceptación

- La política de acceso de `/feed`, `/feed/:id` y sus endpoints backend es coherente.
- El componente de detalle lee de un endpoint cuyo nivel de auth coincide con el guard de la ruta.

## Archivos afectados

- `frontend/app/app.js`
- `frontend/app/feed/pages/detail/feed-detail.component.js` (verificar endpoint que consume)
- `backend/routes/api.php` (verificar exposición del detalle)
