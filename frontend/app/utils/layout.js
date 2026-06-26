/**
 * initShell — runs ONCE when the app shell (navbar + sidebar) is first shown.
 * Wires persistent UI interactions that live in index.html.
 *
 * initPage — runs on every route change inside the shell.
 * Re-initialises Bootstrap widgets and Feather icons for newly mounted content.
 */

export function initShell() {
  const pageWrapper = document.querySelector('.page-wrapper');
  if (pageWrapper) pageWrapper.style.display = 'block';

  const navToggler = document.querySelector('.nav-toggler');
  if (navToggler) {
    navToggler.addEventListener('click', () => {
      const wrapper = document.getElementById('main-wrapper');
      wrapper?.classList.toggle('show-sidebar');
      const icon = navToggler.querySelector('i');
      if (icon) {
        icon.classList.toggle('ti-menu');
        icon.classList.toggle('ti-close');
      }
    });
  }

  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) {
    overlay.addEventListener('click', () => {
      document.getElementById('main-wrapper')?.classList.remove('show-sidebar');
    });
  }

  updateSidebarActiveState();
  window.addEventListener('hashchange', updateSidebarActiveState);

  if (window.feather) window.feather.replace();
}

function updateSidebarActiveState() {
  const hash = window.location.hash || '#/dashboard';

  document.querySelectorAll('#sidebarnav .sidebar-item').forEach(li => {
    const a = li.querySelector(':scope > a.sidebar-link');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    const isActive = href && href !== 'javascript:void(0)' && hash === href;
    li.classList.toggle('selected', isActive);
  });
}

export function initPage() {
  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
    if (typeof bootstrap !== 'undefined') {
      bootstrap.Tooltip.getInstance(el)?.dispose();
      new bootstrap.Tooltip(el);
    }
  });

  document.querySelectorAll('[data-bs-toggle="popover"]').forEach(el => {
    if (typeof bootstrap !== 'undefined') {
      bootstrap.Popover.getInstance(el)?.dispose();
      new bootstrap.Popover(el);
    }
  });

  if (window.feather) window.feather.replace();
}

/** Backwards-compat alias used by any code that still imports initLayout. */
export function initLayout() {
  initShell();
  initPage();
}
