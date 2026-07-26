# app-shell-retina-audit.md

**Requirement**: REQ-REDESIGN-10
**Date**: 2026-07-18
**Auditor**: SDD executor (apply phase)
**Worktree**: `yan-feature-navbar-avatar-audit`
**Branch**: `yan/feature/navbar-avatar-audit`

---

## 1. Code Reference

### Avatar rendering function

- **Function**: `renderAvatar(avatarEl, u, _role)`  
  **File**: `frontend/app/app-shell/app-shell.component.js`  
  **Lines**: 683–698

```javascript
function renderAvatar(avatarEl, u, _role) {
  const rawKey = u.profile_image_path ?? null;
  const resolvedUrl = resolveAvatar(rawKey || u.avatar);

  if (resolvedUrl) {
    const src = rawKey ? '/storage/' + rawKey : resolvedUrl;
    avatarEl.innerHTML = `<img src="${src}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`;
  } else {
    const initial = (u.first_name || u.email || '?')[0].toUpperCase();
    avatarEl.textContent = initial;
  }
}
```

### Avatar triggers

| Role    | JS call (line) | DOM element ID      |
|---------|----------------|---------------------|
| admin   | 657            | `#app-shell-user-avatar` |
| citizen | 668            | `#app-shell-avatar`       |

### CSS sizing

| Avatar         | CSS class               | Declared size | File + lines |
|----------------|-------------------------|---------------|--------------|
| admin          | `.app-shell-user-menu__avatar` | 32 × 32 px   | CSS 305–317  |
| citizen letter | `.app-shell-avatar__letter`    | 34 × 34 px   | CSS 487–499  |

---

## 2. Findings

### 2.1 Admin avatar (`#app-shell-user-avatar`)

| Check | Result |
|-------|--------|
| `srcset` attribute | **ABSENT** — the `<img>` tag (line 693) uses only `src`, no `srcset` |
| Higher-res source requested | **NO** — `resolveAvatar()` is called with no DPR context; the returned URL is served as-is |
| DPR-aware CSS (`image-rendering`, `background-size`, etc.) | **NONE** |
| Server-side variant URL construction | **NO** — raw storage key is only prefixed with `/storage/`; no `@2x` or size suffix applied |
| Initials fallback | **YES** — when `resolvedUrl` is falsy, renders the first letter as `textContent` on the span (CSS gradient background, resolution-independent) |

**Retina impact**: On a retina display (DPR 2×), the 32 × 32 px avatar renders at 64 × 64 px CSS pixels. With no higher-res source available, the browser scales the same image up, producing visible blur/pixelation for photo avatars.

### 2.2 Citizen avatar (`#app-shell-avatar`)

| Check | Result |
|-------|--------|
| `srcset` attribute | **ABSENT** — same code path as admin |
| Higher-res source requested | **NO** — same code path as admin |
| DPR-aware CSS | **NONE** |
| Server-side variant URL construction | **NO** — same code path as admin |
| Initials fallback | **YES** — same resolution-independent gradient + letter pattern |

**Retina impact**: Same as admin — the 34 × 34 px avatar renders at 68 × 68 px on DPR 2× screens without a higher-resolution source.

### 2.3 `resolveAvatar()` utility

- **File**: `frontend/app/utils/avatar.js`  
  Not reviewed in full here. Static analysis of the call site shows no DPR variant is passed; the single returned URL is used directly as `src`.

---

## 3. Summary Table

| Avatar | Display size | DPR 2× rendered size | `srcset` | Higher-res source | DPR-aware CSS | Initials fallback |
|--------|-------------|----------------------|----------|-------------------|---------------|-------------------|
| admin  | 32 × 32 px  | 64 × 64 px           | NO       | NO                | NO            | YES               |
| citizen| 34 × 34 px  | 68 × 68 px           | NO       | NO                | NO            | YES               |

---

## 4. Verdict

**ACCEPTABLE — with a known quality gap for photo avatars on retina screens.**

### Reasoning

1. **The initials fallback is retina-proof.** Both avatars use a CSS `linear-gradient(135deg, #6a5cf3, #a06bf5)` background when no image is set. The letter is rendered as text, which scales perfectly on any DPR. This covers the no-photo case completely.

2. **Photo avatars will appear slightly blurry on retina.** Without `srcset` or a server-side `@2x` variant, the browser upscales the same image to fill 64 × 64 or 68 × 68 CSS pixels. For a navbar icon at these small sizes, the practical user impact is **low** — the avatar is a recognition cue, not a detail-critical image.

3. **No `srcset` implementation cost is zero.** This is not a functional regression — both avatars work correctly on standard displays. The gap is purely visual quality on high-DPR screens.

4. **REQ-REDESIGN-10** audits the avatar at retina resolutions. The audit found that the code does not serve higher-resolution images, which is a confirmed gap. However, given the small display size (32–34 px), the gradient initials fallback, and the absence of any current complaint, this is classified as acceptable with a note for future improvement.

### Recommended follow-up (non-blocking)

- Open a low-priority issue to add `srcset` support or server-side `@2x` avatar variants when the storage layer supports it.
- The initials fallback path requires no changes — it is already resolution-independent.

---

**End of audit**
