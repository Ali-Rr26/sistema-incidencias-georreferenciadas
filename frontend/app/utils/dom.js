/**
 * dom.js — minimal helper for keeping a state object in sync with the DOM.
 *
 * Why this exists: in a no-framework setup, the usual pattern for rendering
 * server-fetched data is `document.getElementById('x').textContent = ...` —
 * once per field, once per render. That scales linearly with the number of
 * fields: 15 fields means 15 lines of glue code that has to be kept in sync
 * with the markup, that the linter can't catch, and that's a magnet for
 * "I forgot to update one field" bugs.
 *
 * `bindView` solves the repetitive half. It scans a root element for elements
 * marked with `data-bind="key"` (or, as a convenience, `[id="key"]`) and
 * exposes a small object you can `view.set({ key: value })` against. The
 * helper also supports declarative per-element transforms via `dataset`:
 *
 *   <span data-bind="status" data-class-for="pending in_progress resolved">
 *     <span data-bind="status-badge"></span>
 *   </span>
 *
 * Keys are arbitrary — they describe what the element represents in your
 * view-model, not the markup. Values can be plain strings (set as textContent)
 * or objects with `{ text, className, hidden, html, style }` for finer
 * control when a field needs more than a string.
 *
 * This is NOT a virtual DOM and NOT a data-binding framework. There is no
 * change detection, no diffing, no reactivity — you call `set()` and it
 * writes to the DOM exactly once. That's the whole point: the framework
 * cost we'd be paying for "real" data binding is way out of proportion to
 * what the project needs.
 */

/**
 * Scan a root element for `[data-bind]` (preferred) or `[id]` (fallback)
 * targets and return an object you can patch by key.
 *
 * @param {Element|Document} root
 * @param {object} [state] initial state — keys present here are also
 *   registered as refs even if they have no matching element yet, so you
 *   can `set()` them later without surprises.
 * @returns {{
 *   state: object,
 *   refs: Record<string, Element>,
 *   set: (patch: object) => void,
 * }}
 */
export function bindView(root, state = {}) {
  const refs = {};
  // Prefer `data-bind`, fall back to `id`. Duplicates are an error in the
  // first case (data-bind exists solely for this helper) and a silent
  // overwrite in the second (DOM guarantees unique ids, so this is safe).
  for (const el of root.querySelectorAll('[data-bind]')) {
    const key = el.dataset.bind;
    if (key && !refs[key]) refs[key] = el;
  }
  for (const el of root.querySelectorAll('[id]')) {
    const id = el.id;
    if (id && !refs[id]) refs[id] = el;
  }

  function applyKey(key, value) {
    const el = refs[key];
    if (!el) return;

    if (value == null) {
      el.textContent = '';
      return;
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      if (value.text !== undefined) el.textContent = value.text;
      if (value.html !== undefined) el.innerHTML = value.html;
      if (value.className !== undefined) el.className = value.className;
      if (value.hidden !== undefined) el.hidden = !!value.hidden;
      if (value.d_none !== undefined) {
        el.classList.toggle('d-none', !!value.d_none);
      }
      return;
    }

    el.textContent = String(value);
  }

  function apply() {
    for (const [key, value] of Object.entries(state)) {
      applyKey(key, value);
    }
  }

  return {
    state,
    refs,

    /** Apply a partial update: any keys present in `patch` are written to the DOM. */
    set(patch) {
      for (const [key, value] of Object.entries(patch)) {
        state[key] = value;
        applyKey(key, value);
      }
    },

    /** One-shot init: apply the current state once. */
    render() {
      apply();
    },
  };
}
